import { createClient } from '@supabase/supabase-js';
import { assertAdmin } from '@/lib/admin/guard';
import { ErrorLogList } from './ErrorLog';

// ── DB client ─────────────────────────────────────────────────────────────────

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ErrorRow {
  id: string;
  source: string;
  error_code: string | null;
  message: string;
  stack_trace: string | null;
  environment: string;
  resolved: boolean;
  timestamp: string;
  metadata: Record<string, unknown> | null;
}

interface WebhookRow {
  event_id: string;
  event_type: string;
  processed_at: string;
}

interface AuditRow {
  severity: string;
  category: string;
}

// ── Environment variable manifest ─────────────────────────────────────────────

const ENV_MANIFEST = [
  { name: 'NEXT_PUBLIC_SUPABASE_URL',          label: 'Supabase URL',             category: 'Supabase',    required: true  },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',     label: 'Supabase Anon Key',        category: 'Supabase',    required: true  },
  { name: 'SUPABASE_SERVICE_ROLE_KEY',         label: 'Service Role Key',         category: 'Supabase',    required: true  },
  { name: 'SUPABASE_JWT_SECRET',               label: 'JWT Secret',               category: 'Supabase',    required: false },
  { name: 'STRIPE_SECRET_KEY',                 label: 'Stripe Secret Key',        category: 'Stripe',      required: true  },
  { name: 'STRIPE_WEBHOOK_SECRET',             label: 'Webhook Secret',           category: 'Stripe',      required: true  },
  { name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',label: 'Publishable Key',          category: 'Stripe',      required: true  },
  { name: 'EMAIL_SERVER_HOST',                 label: 'SMTP Host',                category: 'Email',       required: false },
  { name: 'EMAIL_SERVER_USER',                 label: 'SMTP User',                category: 'Email',       required: false },
  { name: 'EMAIL_SERVER_PASSWORD',             label: 'SMTP Password',            category: 'Email',       required: true  },
  { name: 'EMAIL_SERVER_PORT',                 label: 'SMTP Port',                category: 'Email',       required: false },
  { name: 'NEXT_PUBLIC_SENTRY_DSN',            label: 'Sentry DSN',              category: 'Monitoring',  required: false },
  { name: 'SENTRY_AUTH_TOKEN',                 label: 'Sentry Auth Token',        category: 'Monitoring',  required: false },
  { name: 'SENTRY_ORG',                        label: 'Sentry Org',               category: 'Monitoring',  required: false },
  { name: 'SENTRY_PROJECT',                    label: 'Sentry Project',           category: 'Monitoring',  required: false },
  { name: 'NEXT_PUBLIC_SITE_URL',              label: 'Site URL',                 category: 'App',         required: true  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function fmtMs(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SystemPage() {
  await assertAdmin();

  const db  = adminDb();
  const now = new Date();
  const oneDayAgo   = new Date(now.getTime() -  1 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // ── Service latency probe ──────────────────────────────────────────────────
  const t0 = Date.now();
  const [
    errorsRes,
    unresolvedRes,
    errors24hRes,
    errors7dRes,
    recentErrorsRes,
    webhooksRes,
    auditSummaryRes,
    totalWebhooksRes,
  ] = await Promise.all([
    db.from('system_error_logs').select('*', { count: 'exact', head: true }),
    db.from('system_error_logs').select('*', { count: 'exact', head: true }).eq('resolved', false),
    db.from('system_error_logs').select('*', { count: 'exact', head: true }).gte('timestamp', oneDayAgo),
    db.from('system_error_logs').select('*', { count: 'exact', head: true }).gte('timestamp', sevenDaysAgo),
    db.from('system_error_logs').select('id,source,error_code,message,stack_trace,environment,resolved,timestamp,metadata').order('timestamp', { ascending: false }).limit(50),
    db.from('processed_webhook_events').select('event_id,event_type,processed_at').order('processed_at', { ascending: false }).limit(25),
    db.from('audit_logs').select('severity,category').gte('timestamp', sevenDaysAgo),
    db.from('processed_webhook_events').select('*', { count: 'exact', head: true }),
  ]);
  const dbLatencyMs = Date.now() - t0;

  // ── Derived metrics ────────────────────────────────────────────────────────

  const totalErrors   = errorsRes.count        ?? 0;
  const unresolved    = unresolvedRes.count     ?? 0;
  const errors24h     = errors24hRes.count      ?? 0;
  const errors7d      = errors7dRes.count       ?? 0;
  const recentErrors  = (recentErrorsRes.data   ?? []) as ErrorRow[];
  const webhooks      = (webhooksRes.data        ?? []) as WebhookRow[];
  const auditRows     = (auditSummaryRes.data    ?? []) as AuditRow[];
  const totalWebhooks = totalWebhooksRes.count  ?? 0;

  // Audit summary
  const auditBySeverity: Record<string, number> = {};
  const auditByCategory: Record<string, number> = {};
  for (const row of auditRows) {
    auditBySeverity[row.severity] = (auditBySeverity[row.severity] ?? 0) + 1;
    auditByCategory[row.category] = (auditByCategory[row.category] ?? 0) + 1;
  }

  // Overall status
  const status = unresolved === 0 ? 'OPERATIONAL'
    : errors24h > 5              ? 'DEGRADED'
    : 'WARNING';

  const statusCls = {
    OPERATIONAL: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    WARNING:     'bg-amber-500/10 text-amber-400 border-amber-500/30',
    DEGRADED:    'bg-red-500/10 text-red-400 border-red-500/30',
  }[status];

  // Env var check
  const envChecks = ENV_MANIFEST.map(v => ({
    ...v,
    set: Boolean(process.env[v.name]),
  }));
  const envCategories = [...new Set(ENV_MANIFEST.map(v => v.category))];
  const missingRequired = envChecks.filter(v => v.required && !v.set);

  // Process info
  const processInfo = {
    nodeVersion:  process.version,
    environment:  process.env.NODE_ENV        ?? 'unknown',
    vercelEnv:    process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'local',
    commitSha:    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null,
    vercelRegion: process.env.VERCEL_REGION   ?? null,
    siteUrl:      process.env.NEXT_PUBLIC_SITE_URL ?? null,
  };

  // Webhook event type counts
  const webhookTypes: Record<string, number> = {};
  for (const w of webhooks) {
    webhookTypes[w.event_type] = (webhookTypes[w.event_type] ?? 0) + 1;
  }

  const generatedAt = now.toLocaleString('en-GB', {
    timeZone: 'Europe/London', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">System</h1>
          <p className="text-slate-400 text-sm mt-1">Infrastructure health · Errors · Env · Webhooks</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] text-slate-500 font-mono hidden sm:block">{generatedAt} (London)</span>
          <span className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold border ${statusCls}`}>
            {status}
          </span>
        </div>
      </div>

      {/* Missing required env vars banner */}
      {missingRequired.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl px-6 py-4 flex items-start gap-3">
          <div className="mt-0.5 w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400 mb-1">
              {missingRequired.length} required environment variable{missingRequired.length !== 1 ? 's' : ''} missing
            </p>
            <p className="text-xs text-red-300/70 font-mono">
              {missingRequired.map(v => v.name).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Service health cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label:  'Supabase',
            status: dbLatencyMs < 500 ? 'OK' : 'SLOW',
            detail: `${fmtMs(dbLatencyMs)} query time`,
            ok:     dbLatencyMs < 500,
          },
          {
            label:  'Stripe',
            status: process.env.STRIPE_SECRET_KEY ? 'CONFIGURED' : 'MISSING KEY',
            detail: `${totalWebhooks} events processed`,
            ok:     Boolean(process.env.STRIPE_SECRET_KEY),
          },
          {
            label:  'Email (SMTP)',
            status: process.env.EMAIL_SERVER_PASSWORD ? 'CONFIGURED' : 'NOT SET',
            detail: process.env.EMAIL_SERVER_HOST ?? 'smtp.outlook.com',
            ok:     Boolean(process.env.EMAIL_SERVER_PASSWORD),
          },
          {
            label:  'Sentry',
            status: process.env.NEXT_PUBLIC_SENTRY_DSN ? 'CONFIGURED' : 'NOT SET',
            detail: process.env.SENTRY_ORG ? `org: ${process.env.SENTRY_ORG}` : 'DSN only',
            ok:     Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
          },
        ].map(svc => (
          <div key={svc.label} className={`bg-slate-900 border rounded-2xl p-5 ${svc.ok ? 'border-slate-800' : 'border-amber-500/30'}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${svc.ok ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              <p className="text-xs font-mono text-slate-400 uppercase tracking-wide">{svc.label}</p>
            </div>
            <p className={`text-sm font-bold ${svc.ok ? 'text-white' : 'text-amber-400'}`}>{svc.status}</p>
            <p className="text-[10px] text-slate-500 mt-1">{svc.detail}</p>
          </div>
        ))}
      </div>

      {/* Error summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Errors',    value: totalErrors,   color: 'text-white'    },
          { label: 'Unresolved',      value: unresolved,    color: unresolved > 0 ? 'text-red-400' : 'text-emerald-400'  },
          { label: 'Last 24h',        value: errors24h,     color: errors24h > 0  ? 'text-amber-400' : 'text-white'       },
          { label: 'Last 7 days',     value: errors7d,      color: 'text-white'    },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">{s.label}</p>
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Error log */}
      <div className={`bg-slate-900 rounded-2xl overflow-hidden border ${unresolved > 0 ? 'border-red-500/30' : 'border-slate-800'}`}>
        <div className={`px-5 py-4 border-b ${unresolved > 0 ? 'border-red-500/20 bg-red-500/5' : 'border-slate-800'} flex items-center justify-between`}>
          <h2 className="text-sm font-bold text-white">Error Log</h2>
          <span className="text-[10px] font-mono text-slate-500">{totalErrors} total · showing {recentErrors.length}</span>
        </div>
        <ErrorLogList initialErrors={recentErrors} />
      </div>

      {/* Webhook events + Audit summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Webhook events */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Processed Webhook Events</h2>
            <span className="text-[10px] font-mono text-slate-500">{totalWebhooks} total</span>
          </div>

          {/* Type breakdown */}
          {Object.keys(webhookTypes).length > 0 && (
            <div className="px-5 py-3 border-b border-slate-800 flex flex-wrap gap-2">
              {Object.entries(webhookTypes).map(([type, count]) => (
                <span key={type} className="px-2 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-400">
                  {type.replace('customer.', '').replace('invoice.', 'inv.')} ×{count}
                </span>
              ))}
            </div>
          )}

          <div className="divide-y divide-slate-800 max-h-72 overflow-y-auto">
            {webhooks.length === 0 ? (
              <p className="px-5 py-8 text-xs text-slate-500 text-center">No webhook events</p>
            ) : webhooks.map(w => (
              <div key={w.event_id} className="px-5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-white font-mono truncate">{w.event_type}</p>
                  <p className="text-[10px] text-slate-600 font-mono mt-0.5 truncate">{w.event_id}</p>
                </div>
                <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap shrink-0">
                  {fmtDate(w.processed_at)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Audit summary (7d) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Audit Events (7d)</h2>
            <span className="text-[10px] font-mono text-slate-500">{auditRows.length} total</span>
          </div>

          {auditRows.length === 0 ? (
            <p className="px-5 py-8 text-xs text-slate-500 text-center">No audit events</p>
          ) : (
            <div className="p-5 space-y-5">
              {/* By severity */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-3">By severity</p>
                <div className="space-y-2">
                  {[
                    { key: 'INFO',           cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
                    { key: 'WARNING',        cls: 'text-amber-400   bg-amber-500/10   border-amber-500/30'   },
                    { key: 'CRITICAL',       cls: 'text-red-400     bg-red-500/10     border-red-500/30'     },
                    { key: 'SECURITY_ALERT', cls: 'text-red-300     bg-red-500/10     border-red-500/30'     },
                  ].filter(s => auditBySeverity[s.key]).map(s => (
                    <div key={s.key} className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${s.cls} w-28 text-center`}>
                        {s.key}
                      </span>
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-500 rounded-full"
                          style={{ width: `${(auditBySeverity[s.key] / auditRows.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-slate-400 w-8 text-right">
                        {auditBySeverity[s.key]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By category */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-3">By category</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(auditByCategory).sort(([,a],[,b]) => b - a).map(([cat, count]) => (
                    <div key={cat} className="bg-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">{cat.replace('_', ' ')}</span>
                      <span className="text-xs font-bold text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Environment variables */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Environment Variables</h2>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-emerald-400">{envChecks.filter(v => v.set).length} set</span>
            {missingRequired.length > 0 && (
              <span className="text-[10px] font-mono text-red-400">{missingRequired.length} required missing</span>
            )}
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {envCategories.map(cat => (
            <div key={cat}>
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600 mb-3">{cat}</p>
              <div className="space-y-2">
                {envChecks.filter(v => v.category === cat).map(v => (
                  <div key={v.name} className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${v.set ? 'bg-emerald-400' : v.required ? 'bg-red-400 animate-pulse' : 'bg-slate-600'}`} />
                    <span className={`text-[10px] font-mono ${v.set ? 'text-slate-300' : v.required ? 'text-red-400' : 'text-slate-600'}`}>
                      {v.label}
                    </span>
                    {!v.set && (
                      <span className="text-[9px] font-mono text-slate-700">{v.required ? 'REQUIRED' : 'optional'}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Process / deployment info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-white mb-4">Process & Deployment</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Node.js',      value: processInfo.nodeVersion },
            { label: 'Environment',  value: processInfo.environment },
            { label: 'Vercel Env',   value: processInfo.vercelEnv },
            { label: 'Region',       value: processInfo.vercelRegion ?? 'iad1' },
            { label: 'Commit',       value: processInfo.commitSha ? processInfo.commitSha.slice(0, 7) : '—' },
            { label: 'Site URL',     value: processInfo.siteUrl ? new URL(processInfo.siteUrl).hostname : '—' },
          ].map(item => (
            <div key={item.label}>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">{item.label}</p>
              <p className="text-xs font-mono text-white">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
