import { createClient } from '@supabase/supabase-js';
import { assertAdmin } from '@/lib/admin/guard';
import { stripe } from '@/lib/stripe';
import { IntegrationsClient } from './IntegrationsClient';

// ── DB client ─────────────────────────────────────────────────────────────────

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  revoked: boolean;
  created_at: string;
}

export interface WebhookEventRow {
  event_id: string;
  event_type: string;
  processed_at: string;
}

export interface IntegrationDef {
  name: string;
  category: string;
  description: string;
  envVars: string[];
  status: 'connected' | 'missing' | 'error';
  latencyMs: number | null;
}

// ── Integration catalog ───────────────────────────────────────────────────────

function buildIntegrations(stripeLatencyMs: number | null, stripeError: string | null): IntegrationDef[] {
  const hasStripe = Boolean(
    process.env.STRIPE_LIVE_SECRET_KEY ??
    process.env.STRIPE_SECRET_KEY ??
    process.env.STRIPE_TEST_SECRET_KEY,
  );
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasSentry   = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
  const hasR2       = Boolean(process.env.STORAGE_R2_BUCKET_NAME) && Boolean(process.env.STORAGE_R2_ACCESS_KEY_ID);
  const hasVercel   = Boolean(process.env.VERCEL);
  const hasSmtp     = Boolean(process.env.EMAIL_SERVER_HOST) && Boolean(process.env.EMAIL_SERVER_USER);

  return [
    {
      name: 'Stripe',
      category: 'Payments',
      description: 'Payment processing, subscriptions, and webhooks.',
      envVars: ['STRIPE_SECRET_KEY_LIVE', 'STRIPE_SECRET_KEY'],
      status: !hasStripe ? 'missing' : stripeError ? 'error' : 'connected',
      latencyMs: stripeLatencyMs,
    },
    {
      name: 'Supabase',
      category: 'Database',
      description: 'Primary database, auth, and realtime subscriptions.',
      envVars: ['NEXT_PUBLIC_SUPABASE_URL'],
      status: hasSupabase ? 'connected' : 'missing',
      latencyMs: null,
    },
    {
      name: 'Sentry',
      category: 'Monitoring',
      description: 'Error tracking and performance monitoring.',
      envVars: ['NEXT_PUBLIC_SENTRY_DSN'],
      status: hasSentry ? 'connected' : 'missing',
      latencyMs: null,
    },
    {
      name: 'Cloudflare R2',
      category: 'Storage',
      description: 'Object storage for assets and audio files.',
      envVars: ['STORAGE_R2_BUCKET_NAME', 'STORAGE_R2_ACCESS_KEY_ID'],
      status: hasR2 ? 'connected' : 'missing',
      latencyMs: null,
    },
    {
      name: 'Vercel',
      category: 'Hosting',
      description: 'Serverless deployment, edge network, and CI/CD.',
      envVars: ['VERCEL'],
      status: hasVercel ? 'connected' : 'missing',
      latencyMs: null,
    },
    {
      name: 'SMTP Email',
      category: 'Email',
      description: 'Transactional email delivery via SMTP.',
      envVars: ['EMAIL_SERVER_HOST', 'EMAIL_SERVER_USER'],
      status: hasSmtp ? 'connected' : 'missing',
      latencyMs: null,
    },
  ];
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function IntegrationsPage() {
  await assertAdmin();

  const db = adminDb();

  // ── Stripe live latency probe ────────────────────────────────────────────
  let stripeLatencyMs: number | null = null;
  let stripeError: string | null     = null;
  const hasStripeKey = Boolean(
    process.env.STRIPE_LIVE_SECRET_KEY ??
    process.env.STRIPE_SECRET_KEY ??
    process.env.STRIPE_TEST_SECRET_KEY,
  );

  if (hasStripeKey) {
    const t0 = Date.now();
    try {
      await stripe.balance.retrieve();
      stripeLatencyMs = Date.now() - t0;
    } catch (err) {
      stripeLatencyMs = Date.now() - t0;
      stripeError = err instanceof Error ? err.message : 'Unknown error';
    }
  }

  // ── DB queries ───────────────────────────────────────────────────────────
  const [webhooksRes, webhookCountRes, apiKeysRes] = await Promise.all([
    db
      .from('processed_webhook_events')
      .select('event_id,event_type,processed_at')
      .order('processed_at', { ascending: false })
      .limit(50),
    db.from('processed_webhook_events').select('*', { count: 'exact', head: true }),
    db
      .from('api_keys')
      .select('id,name,key_prefix,scopes,expires_at,last_used_at,revoked,created_at')
      .order('created_at', { ascending: false }),
  ]);

  const webhookEvents   = (webhooksRes.data    ?? []) as WebhookEventRow[];
  const totalWebhooks   = webhookCountRes.count ?? 0;
  const apiKeys         = (apiKeysRes.data      ?? []) as ApiKeyRow[];
  const activeApiKeys   = apiKeys.filter(k => !k.revoked).length;

  const integrations = buildIntegrations(stripeLatencyMs, stripeError);
  const connectedCount = integrations.filter(i => i.status === 'connected').length;

  // Webhook type breakdown
  const webhookTypes: Record<string, number> = {};
  for (const w of webhookEvents) {
    webhookTypes[w.event_type] = (webhookTypes[w.event_type] ?? 0) + 1;
  }

  const generatedAt = new Date().toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Integrations</h1>
          <p className="text-slate-400 text-sm mt-1">Third-party services · Webhooks · API keys</p>
        </div>
        <span className="text-[10px] text-slate-500 font-mono hidden sm:block">{generatedAt} (London)</span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Active Integrations',
            value: `${connectedCount} / ${integrations.length}`,
            color: connectedCount === integrations.length ? 'text-emerald-400' : 'text-amber-400',
          },
          {
            label: 'Webhook Events',
            value: totalWebhooks.toLocaleString(),
            color: 'text-slate-900 dark:text-white',
          },
          {
            label: 'API Keys Issued',
            value: String(activeApiKeys),
            color: 'text-slate-900 dark:text-white',
          },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">{kpi.label}</p>
            <p className={`text-4xl font-black ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Client-rendered tabs: Services | API Keys | Webhooks */}
      <IntegrationsClient
        integrations={integrations}
        apiKeys={apiKeys}
        webhookEvents={webhookEvents}
        webhookTypes={webhookTypes}
        totalWebhooks={totalWebhooks}
      />

    </div>
  );
}
