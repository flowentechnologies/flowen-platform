/**
 * /api/cron/backup — daily database backup
 *
 * Runs at 01:00 UTC every day (see vercel.json).
 * Exports all critical tables as gzipped JSONL to the private
 * "backups" Supabase Storage bucket, then prunes backups older than 30 days.
 *
 * Storage layout:
 *   backups/db/2026-08-21/manifest.json
 *   backups/db/2026-08-21/profiles.jsonl.gz
 *   backups/db/2026-08-21/practice_sessions.jsonl.gz
 *   ...
 *
 * Security: CRON_SECRET required (same as all other cron routes).
 * The backup bucket is private — all access uses the service-role key.
 */

import { NextRequest, NextResponse }  from 'next/server';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { gzipSync }                   from 'node:zlib';
import { verifyCronRequest }          from '@/lib/cron-auth';
import { sendEmail, FROM, ADMIN_INBOX } from '@/lib/email';

// ── Config ────────────────────────────────────────────────────────────────────

/** Tables exported in order. High-value data first so a timeout still captures the most critical rows. */
const BACKUP_TABLES = [
  // Core user + billing
  'profiles',
  'customers',
  'subscriptions',
  // Practice data
  'practice_sessions',
  'user_programme',
  'stage_progressions',
  'training_samples',
  // Clinical
  'treatment_plans',
  'slp_assignments',
  'slp_session_notes',
  'slp_messages',
  // Business / admin
  'waitlist_signups',
  'investors',
  'cap_table_entries',
  'grants',
  'affiliates',
  'affiliate_commissions',
  'affiliate_payouts',
  'compliance_items',
  'roadmap_milestones',
  'workflow_definitions',
  'hazard_log',
  'ip_assets',
  'ip_audit_items',
  'ip_funding_items',
  'venture_config',
  'valuation_config',
  'valuation_snapshots',
  'app_config',
  'feature_flags',
  'nhs_icb_contacts',
  'nhs_slp_signups',
  'nhs_block_pledges',
  'slp_beta_applications',
  'consent_audit_log',
  'gdpr_requests',
  'nps_responses',
  'feedback',
  'campaign_milestones',
  'deploy_log',
  'backup_log',
] as const;

const RETENTION_DAYS  = 30;
const PAGE_SIZE       = 1_000;

/**
 * Primary-key column for keyset pagination.
 * Most tables use `id`; the two exceptions are listed here.
 * Keeping this explicit is safer than querying information_schema at runtime.
 */
const TABLE_PK: Partial<Record<typeof BACKUP_TABLES[number], string>> = {
  app_config:     'key',
  user_programme: 'user_id',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function db() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function dateFolder(d = new Date()) {
  return d.toISOString().slice(0, 10); // "2026-08-21"
}

/** Fetch all rows from a table using keyset pagination on its primary key. */
async function exportTable(
  admin: ReturnType<typeof db>,
  table: typeof BACKUP_TABLES[number],
): Promise<{ rows: unknown[]; error: string | null }> {
  const pk = TABLE_PK[table] ?? 'id';
  const rows: unknown[] = [];
  let cursor: string | null = null;

  for (;;) {
    let q = admin.from(table).select('*').order(pk, { ascending: true }).limit(PAGE_SIZE);
    if (cursor) q = q.gt(pk, cursor);

    const { data, error } = await q;
    if (error) return { rows, error: error.message };
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;

    const last = data[data.length - 1] as Record<string, unknown>;
    cursor = String(last[pk] ?? '');
    if (!cursor) break;
  }

  return { rows, error: null };
}

/** Convert rows to JSONL (one JSON object per line) and gzip. */
function toGzipJsonl(rows: unknown[]): Buffer {
  const jsonl = rows.map(r => JSON.stringify(r)).join('\n');
  return gzipSync(Buffer.from(jsonl, 'utf8'));
}

/** Upload a buffer to Supabase Storage, overwriting if exists. */
async function upload(
  admin: ReturnType<typeof db>,
  path: string,
  data: Buffer,
  contentType: string,
): Promise<void> {
  // upsert so re-runs on the same day overwrite cleanly
  const { error } = await admin.storage.from('backups').upload(path, data, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed for ${path}: ${error.message}`);
}

/** List all backup date-folders older than RETENTION_DAYS and delete them. */
async function pruneOldBackups(admin: ReturnType<typeof db>): Promise<number> {
  const { data: items } = await admin.storage.from('backups').list('db');
  if (!items) return 0;

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  let pruned = 0;
  for (const item of items) {
    if (item.name < cutoff) {
      // list files in the folder then remove them
      const { data: files } = await admin.storage.from('backups').list(`db/${item.name}`);
      if (files && files.length > 0) {
        const paths = files.map(f => `db/${item.name}/${f.name}`);
        await admin.storage.from('backups').remove(paths);
        pruned += paths.length;
      }
    }
  }
  return pruned;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronRequest(req.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started     = Date.now();
  const admin       = db();
  const folder      = dateFolder();
  const basePath    = `db/${folder}`;

  const tableResults: Array<{ table: string; rows: number; bytes: number; error: string | null }> = [];
  let totalRows  = 0;
  let totalBytes = 0;
  let failed     = 0;

  // ── Export each table ──────────────────────────────────────────────────────
  for (const table of BACKUP_TABLES) {
    const { rows, error } = await exportTable(admin, table);

    if (error) {
      console.error(`[backup] ${table} export error:`, error);
      tableResults.push({ table, rows: 0, bytes: 0, error });
      failed++;
      continue;
    }

    if (rows.length === 0) {
      tableResults.push({ table, rows: 0, bytes: 0, error: null });
      continue;
    }

    try {
      const gz = toGzipJsonl(rows);
      await upload(admin, `${basePath}/${table}.jsonl.gz`, gz, 'application/gzip');
      tableResults.push({ table, rows: rows.length, bytes: gz.length, error: null });
      totalRows  += rows.length;
      totalBytes += gz.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[backup] ${table} upload error:`, msg);
      tableResults.push({ table, rows: rows.length, bytes: 0, error: msg });
      failed++;
    }
  }

  // ── Write manifest ─────────────────────────────────────────────────────────
  const manifest = {
    generated_at:  new Date().toISOString(),
    folder,
    tables:        tableResults,
    total_rows:    totalRows,
    total_bytes:   totalBytes,
    failed_tables: failed,
  };
  try {
    await upload(
      admin,
      `${basePath}/manifest.json`,
      Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'),
      'application/json',
    );
  } catch (err) {
    console.error('[backup] manifest upload error:', err);
  }

  // ── Prune old backups ──────────────────────────────────────────────────────
  let prunedFiles = 0;
  try {
    prunedFiles = await pruneOldBackups(admin);
  } catch (err) {
    console.error('[backup] prune error:', err);
  }

  // ── Log to backup_log ──────────────────────────────────────────────────────
  const durationMs = Date.now() - started;
  const status     = failed === 0 ? 'success' : failed < BACKUP_TABLES.length ? 'partial' : 'failed';

  await admin.from('backup_log').insert({
    status,
    tables_backed: tableResults.filter(t => t.error === null && t.rows > 0).map(t => t.table),
    total_rows:    totalRows,
    storage_bytes: totalBytes,
    duration_ms:   durationMs,
    storage_path:  basePath,
    error:         failed > 0
      ? tableResults.filter(t => t.error).map(t => `${t.table}: ${t.error}`).join('; ')
      : null,
  });

  // ── Email admin ────────────────────────────────────────────────────────────
  const statusEmoji  = status === 'success' ? '✅' : status === 'partial' ? '⚠️' : '❌';
  const tableHtml    = tableResults
    .filter(t => t.rows > 0 || t.error)
    .map(t => `<tr>
      <td style="padding:3px 10px 3px 0;font-family:monospace">${t.table}</td>
      <td style="padding:3px 10px 3px 0;text-align:right">${t.rows.toLocaleString()}</td>
      <td style="padding:3px 0;text-align:right;color:${t.error ? '#ef4444' : '#64748b'}">${t.error ? t.error.slice(0, 60) : `${(t.bytes / 1024).toFixed(1)} KB`}</td>
    </tr>`).join('');

  await sendEmail({
    from:    FROM.alerts,
    to:      ADMIN_INBOX,
    subject: `${statusEmoji} Flowen daily backup — ${folder} (${status})`,
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:600px">
        <h2 style="margin:0 0 4px">${statusEmoji} Daily Database Backup</h2>
        <p style="color:#64748b;margin:0 0 20px">${folder} · ${(durationMs / 1000).toFixed(1)}s · ${(totalBytes / 1024 / 1024).toFixed(2)} MB compressed</p>
        <table style="border-collapse:collapse;width:100%;font-size:13px">
          <thead><tr>
            <th style="text-align:left;padding:3px 10px 6px 0;border-bottom:1px solid #e2e8f0">Table</th>
            <th style="text-align:right;padding:3px 10px 6px 0;border-bottom:1px solid #e2e8f0">Rows</th>
            <th style="text-align:right;padding:3px 0 6px;border-bottom:1px solid #e2e8f0">Size / Error</th>
          </tr></thead>
          <tbody>${tableHtml}</tbody>
        </table>
        <p style="margin:20px 0 4px;font-size:13px;color:#64748b">
          Total: <strong>${totalRows.toLocaleString()} rows</strong> across ${BACKUP_TABLES.length} tables · ${failed} failed · ${prunedFiles} old files pruned
        </p>
        <p style="margin:4px 0;font-size:12px;color:#94a3b8">
          Storage path: <code>backups/${basePath}/</code> · Retention: ${RETENTION_DAYS} days
        </p>
      </div>`,
    text: `Flowen daily backup ${folder}: ${status}. ${totalRows.toLocaleString()} rows, ${(totalBytes / 1024 / 1024).toFixed(2)} MB. ${failed} failed. Path: backups/${basePath}/`,
  });

  return NextResponse.json({ ok: true, status, folder, total_rows: totalRows, total_bytes: totalBytes, duration_ms: durationMs, failed });
}

// Allow manual GET trigger from admin dashboard (same auth)
export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
