import { assertAdmin } from '@/lib/admin/guard';
import { stripe } from '@/lib/stripe';
import { IntegrationsClient } from './IntegrationsClient';
import { adminDb } from '@/lib/supabase/admin';

// Every query on this page reads live state (cron_runs, token tables, queue
// backlogs) specifically to answer "is X actually working right now" — never
// statically cache this page. assertAdmin()'s cookie read already forces
// dynamic rendering, but this is explicit because staleness here is exactly
// the failure mode this page exists to catch.
export const dynamic = 'force-dynamic';

// ── DB client ─────────────────────────────────────────────────────────────────

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
  /** When this integration last actually succeeded at doing its job — not
   *  when the page was loaded. Null when there's no real activity signal
   *  (e.g. a plain env-var-presence check with nothing to run). */
  lastSuccessAt: string | null;
  /** The real, specific reason it's broken — not a generic "Error" badge.
   *  Null when healthy or when there's no activity signal. */
  lastError: string | null;
  /** One more fact worth surfacing next to the status — a backlog count,
   *  which entity/account, etc. */
  detail: string | null;
}

// ── Integration catalog ───────────────────────────────────────────────────────

interface LiveSignal {
  lastSuccessAt: string | null;
  lastError: string | null;
  detail: string | null;
}

const NO_SIGNAL: LiveSignal = { lastSuccessAt: null, lastError: null, detail: null };

function buildIntegrations(
  stripeLatencyMs: number | null,
  stripeError: string | null,
  live: Record<string, LiveSignal>,
): IntegrationDef[] {
  const hasStripe = Boolean(
    process.env.STRIPE_LIVE_SECRET_KEY ??
    process.env.STRIPE_SECRET_KEY ??
    process.env.STRIPE_TEST_SECRET_KEY,
  );
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasSentry   = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
  const hasR2       = Boolean(process.env.STORAGE_R2_ACCOUNT_ID) &&
    Boolean(process.env.STORAGE_R2_ACCESS_KEY_ID) &&
    Boolean(process.env.STORAGE_R2_SECRET_ACCESS_KEY) &&
    Boolean(process.env.STORAGE_R2_BUCKET_NAME);
  const hasVercel   = Boolean(process.env.VERCEL);
  const hasSmtp     = Boolean(process.env.EMAIL_SERVER_HOST) && Boolean(process.env.EMAIL_SERVER_USER);
  const hasXero     = Boolean(process.env.XERO_CLIENT_ID) && Boolean(process.env.XERO_CLIENT_SECRET);
  const hasGoogleAds = Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN) && Boolean(process.env.GOOGLE_ADS_CUSTOMER_ID);
  const hasGmail    = Boolean(process.env.GMAIL_CLIENT_ID);
  const hasPinterest = Boolean(process.env.PINTEREST_CLIENT_ID);
  const hasExplee   = Boolean(process.env.EXPLEE_API_KEY);

  // A job/token signal that exists but shows no real error is 'connected'
  // even without a live probe; a job/token signal reporting a real error
  // is 'error', not a generic env-var-presence 'missing'.
  function statusFor(configured: boolean, signal: LiveSignal): IntegrationDef['status'] {
    if (!configured) return 'missing';
    if (signal.lastError) return 'error';
    return 'connected';
  }

  return [
    {
      name: 'Stripe',
      category: 'Payments',
      description: 'Payment processing, subscriptions, and webhooks.',
      envVars: ['STRIPE_SECRET_KEY_LIVE', 'STRIPE_SECRET_KEY'],
      status: !hasStripe ? 'missing' : stripeError ? 'error' : 'connected',
      latencyMs: stripeLatencyMs,
      lastSuccessAt: null, lastError: stripeError, detail: null,
    },
    {
      name: 'Supabase',
      category: 'Database',
      description: 'Primary database, auth, and realtime subscriptions.',
      envVars: ['NEXT_PUBLIC_SUPABASE_URL'],
      status: hasSupabase ? 'connected' : 'missing',
      latencyMs: null, lastSuccessAt: null, lastError: null, detail: null,
    },
    {
      name: 'Sentry',
      category: 'Monitoring',
      description: 'Error tracking and performance monitoring.',
      envVars: ['NEXT_PUBLIC_SENTRY_DSN'],
      status: hasSentry ? 'connected' : 'missing',
      latencyMs: null, lastSuccessAt: null, lastError: null, detail: null,
    },
    {
      name: 'Cloudflare R2',
      category: 'Storage',
      description: 'Object storage — practice session audio recordings (pilot bucket; egress-free at scale, unlike Supabase Storage). Falls back to Supabase Storage when not configured.',
      envVars: ['STORAGE_R2_ACCOUNT_ID', 'STORAGE_R2_ACCESS_KEY_ID', 'STORAGE_R2_SECRET_ACCESS_KEY', 'STORAGE_R2_BUCKET_NAME'],
      status: hasR2 ? 'connected' : 'missing',
      latencyMs: null, lastSuccessAt: null, lastError: null, detail: null,
    },
    {
      name: 'Vercel',
      category: 'Hosting',
      description: 'Serverless deployment, edge network, and CI/CD.',
      envVars: ['VERCEL'],
      status: hasVercel ? 'connected' : 'missing',
      latencyMs: null, lastSuccessAt: null, lastError: null, detail: null,
    },
    {
      name: 'SMTP Email',
      category: 'Email',
      description: 'Transactional email delivery via SMTP.',
      envVars: ['EMAIL_SERVER_HOST', 'EMAIL_SERVER_USER'],
      status: hasSmtp ? 'connected' : 'missing',
      latencyMs: null, lastSuccessAt: null, lastError: null, detail: null,
    },
    {
      name: 'Xero',
      category: 'Accounting',
      description: 'Bookkeeping AI agent — Stripe sync, categorisation, VAT/intercompany reconciliation, manual journals. See /admin/bookkeeping for per-entity connection status.',
      envVars: ['XERO_CLIENT_ID', 'XERO_CLIENT_SECRET'],
      status: statusFor(hasXero, live.xero ?? NO_SIGNAL),
      latencyMs: null,
      lastSuccessAt: live.xero?.lastSuccessAt ?? null,
      lastError: live.xero?.lastError ?? null,
      detail: live.xero?.detail ?? null,
    },
    {
      name: 'Gmail',
      category: 'Email',
      description: 'Inbox sync, vendor invoice capture, AI draft replies.',
      envVars: ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET'],
      status: statusFor(hasGmail, live.gmail ?? NO_SIGNAL),
      latencyMs: null,
      lastSuccessAt: live.gmail?.lastSuccessAt ?? null,
      lastError: live.gmail?.lastError ?? null,
      detail: live.gmail?.detail ?? null,
    },
    {
      name: 'Google Ads',
      category: 'Marketing',
      description: 'Ad spend/performance sync (campaign, ad group, ad level) into ad_platform_stats.',
      envVars: ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID', 'GOOGLE_ADS_LOGIN_CUSTOMER_ID'],
      status: statusFor(hasGoogleAds, live.googleAds ?? NO_SIGNAL),
      latencyMs: null,
      lastSuccessAt: live.googleAds?.lastSuccessAt ?? null,
      lastError: live.googleAds?.lastError ?? null,
      detail: live.googleAds?.detail ?? null,
    },
    {
      name: 'Meta Ads',
      category: 'Marketing',
      description: 'Ad spend/performance sync + server-side Conversions API (hashed email only, no PII).',
      envVars: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'],
      status: statusFor(Boolean(process.env.META_ACCESS_TOKEN), live.metaAds ?? NO_SIGNAL),
      latencyMs: null,
      lastSuccessAt: live.metaAds?.lastSuccessAt ?? null,
      lastError: live.metaAds?.lastError ?? null,
      detail: live.metaAds?.detail ?? null,
    },
    {
      name: 'Social Publishing',
      category: 'Marketing',
      description: 'Scheduled Instagram/Facebook posts (auto) + LinkedIn (semi-manual) from social_publish_queue.',
      envVars: ['META_ACCESS_TOKEN'],
      status: statusFor(Boolean(process.env.META_ACCESS_TOKEN), live.socialPublish ?? NO_SIGNAL),
      latencyMs: null,
      lastSuccessAt: live.socialPublish?.lastSuccessAt ?? null,
      lastError: live.socialPublish?.lastError ?? null,
      detail: live.socialPublish?.detail ?? null,
    },
    {
      name: 'Pinterest',
      category: 'Marketing',
      description: 'Scheduled Pinterest pin publishing.',
      envVars: ['PINTEREST_CLIENT_ID', 'PINTEREST_CLIENT_SECRET'],
      status: statusFor(hasPinterest, live.pinterest ?? NO_SIGNAL),
      latencyMs: null,
      lastSuccessAt: live.pinterest?.lastSuccessAt ?? null,
      lastError: live.pinterest?.lastError ?? null,
      detail: live.pinterest?.detail ?? null,
    },
    {
      name: 'Explee',
      category: 'Sales',
      description: 'Prospecting, outreach campaigns, and hot-lead detection.',
      envVars: ['EXPLEE_API_KEY'],
      status: statusFor(hasExplee, live.explee ?? NO_SIGNAL),
      latencyMs: null,
      lastSuccessAt: live.explee?.lastSuccessAt ?? null,
      lastError: live.explee?.lastError ?? null,
      detail: live.explee?.detail ?? null,
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
  const [
    webhooksRes, webhookCountRes, apiKeysRes,
    latestRunsRes, xeroTokensRes, gmailTokensRes,
    pinterestBacklogRes, pinterestFailedRes,
  ] = await Promise.all([
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
    // Every cron_runs job used below, most-recent-first — de-duplicated to
    // the latest row per job_id in JS (Supabase has no DISTINCT ON via the
    // JS client).
    db
      .from('cron_runs')
      .select('job_id,status,error,result,started_at')
      .in('job_id', [
        'gmail-sync', 'marketing-sync-google', 'marketing-sync-meta',
        'social-publish', 'pinterest-token-refresh',
        'explee-hot-leads', 'explee-outreach-sync',
      ])
      .order('started_at', { ascending: false })
      .limit(200),
    db.from('xero_oauth_tokens').select('entity, tenant_name, expires_at, updated_at'),
    db.from('gmail_oauth_tokens').select('mailbox, expires_at, updated_at').limit(1),
    db.from('social_publish_queue').select('*', { count: 'exact', head: true }).eq('platform', 'pinterest').eq('status', 'pending'),
    db.from('social_publish_queue').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
  ]);

  const webhookEvents   = (webhooksRes.data    ?? []) as WebhookEventRow[];
  const totalWebhooks   = webhookCountRes.count ?? 0;
  const apiKeys         = (apiKeysRes.data      ?? []) as ApiKeyRow[];
  const activeApiKeys   = apiKeys.filter(k => !k.revoked).length;

  // ── Derive one live signal per integration from the latest-run-per-job data ──
  type CronRun = { job_id: string; status: string; error: string | null; result: Record<string, unknown> | null; started_at: string };
  const runsByJob = new Map<string, CronRun>();
  for (const r of (latestRunsRes.data ?? []) as CronRun[]) {
    if (!runsByJob.has(r.job_id)) runsByJob.set(r.job_id, r); // first hit per job_id = most recent, since already ordered
  }
  function signalFrom(jobId: string, detail?: (run: CronRun) => string | null): LiveSignal {
    const run = runsByJob.get(jobId);
    if (!run) return NO_SIGNAL;
    const ok = run.status === 'success';
    return {
      lastSuccessAt: ok ? run.started_at : null,
      lastError: ok ? null : (run.error ?? 'Unknown error'),
      detail: detail ? detail(run) : null,
    };
  }

  const xeroRows = (xeroTokensRes.data ?? []) as { entity: string; tenant_name: string | null; expires_at: string; updated_at: string }[];
  const xeroConnectedCount = xeroRows.length;
  const xeroLatestUpdate = xeroRows.reduce<string | null>((latest, r) =>
    !latest || r.updated_at > latest ? r.updated_at : latest, null);

  const gmailRow = ((gmailTokensRes.data ?? [])[0] ?? null) as { mailbox: string; expires_at: string; updated_at: string } | null;

  const pinterestBacklog = pinterestBacklogRes.count ?? 0;
  const socialFailedCount = pinterestFailedRes.count ?? 0;

  const live: Record<string, LiveSignal> = {
    xero: {
      lastSuccessAt: xeroLatestUpdate,
      lastError: xeroConnectedCount < 4 ? `Only ${xeroConnectedCount}/4 group entities connected` : null,
      detail: `${xeroConnectedCount}/4 entities: ${xeroRows.map(r => r.entity).join(', ') || 'none'}`,
    },
    gmail: {
      lastSuccessAt: gmailRow ? runsByJob.get('gmail-sync')?.started_at ?? gmailRow.updated_at : null,
      lastError: gmailRow ? signalFrom('gmail-sync').lastError : 'No Gmail account connected',
      detail: gmailRow?.mailbox ?? null,
    },
    googleAds: signalFrom('marketing-sync-google'),
    metaAds: signalFrom('marketing-sync-meta'),
    socialPublish: {
      ...signalFrom('social-publish'),
      detail: socialFailedCount > 0 ? `${socialFailedCount} post(s) failed permanently — see /admin/social` : null,
    },
    pinterest: {
      lastSuccessAt: null,
      lastError: pinterestBacklog > 0
        ? `Not connected — ${pinterestBacklog} post(s) queued and waiting`
        : (runsByJob.get('pinterest-token-refresh')?.result?.skipped as string | undefined) ?? null,
      detail: pinterestBacklog > 0 ? `${pinterestBacklog} pin(s) backlogged since first missed post` : null,
    },
    explee: (() => {
      const hot = signalFrom('explee-hot-leads');
      const outreach = signalFrom('explee-outreach-sync');
      return {
        lastSuccessAt: [hot.lastSuccessAt, outreach.lastSuccessAt].filter(Boolean).sort().pop() ?? null,
        lastError: hot.lastError ?? outreach.lastError,
        detail: null,
      };
    })(),
  };

  const integrations = buildIntegrations(stripeLatencyMs, stripeError, live);
  const connectedCount = integrations.filter(i => i.status === 'connected').length;
  const errorCount = integrations.filter(i => i.status === 'error').length;

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
          <p className="text-slate-400 text-sm mt-1">Third-party services · Webhooks · API keys — live status, generated on every load</p>
        </div>
        <span className="text-[10px] text-slate-500 font-mono hidden sm:block">{generatedAt} (London)</span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Active Integrations',
            value: `${connectedCount} / ${integrations.length}`,
            color: connectedCount === integrations.length ? 'text-emerald-400' : 'text-amber-400',
          },
          {
            label: 'Currently Failing',
            value: String(errorCount),
            color: errorCount === 0 ? 'text-emerald-400' : 'text-red-400',
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
