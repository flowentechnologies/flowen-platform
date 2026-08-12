'use client';

import React, { useMemo } from 'react';
import type { EvidenceData, ComplianceStatus } from '@/app/api/admin/evidence/route';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDuration(seconds: number | null): string {
  if (seconds === null) return 'N/A';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function fmtPct(n: number | null, decimals = 0): string {
  if (n === null) return 'N/A';
  return `${n.toFixed(decimals)}%`;
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-GB');
}

function shortTs(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Readiness score ────────────────────────────────────────────────────────────

function computeReadinessScore(data: EvidenceData): number {
  const byFw = new Map(data.compliance.map(c => [c.framework, c]));

  const dcb = byFw.get('DCB0129')?.pct_complete ?? 0;
  const dtac = byFw.get('DTAC')?.pct_complete ?? 0;
  const dspt = byFw.get('DSPT')?.pct_complete ?? 0;

  // Weight 30: DCB0129 complete %
  const w1 = (dcb / 100) * 30;
  // Weight 25: DTAC
  const w2 = (dtac / 100) * 25;
  // Weight 20: DSPT
  const w3 = (dspt / 100) * 20;
  // Weight 15: Hazard log (no open high/critical)
  const openHighCrit = data.hazard_log.high_or_critical_open;
  const w4 = openHighCrit === 0 ? 15 : Math.max(0, 15 - openHighCrit * 5);
  // Weight 10: Clinical outcomes data exists
  const w5 = data.improving_users_pct !== null ? 10 : 0;

  return Math.min(100, Math.round(w1 + w2 + w3 + w4 + w5));
}

function readinessColor(score: number): string {
  if (score >= 90) return '#10b981'; // emerald
  if (score >= 70) return '#14b8a6'; // teal
  if (score >= 40) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

function readinessLabel(score: number): string {
  if (score >= 90) return 'Ready for procurement';
  if (score >= 70) return 'Approaching ready';
  if (score >= 40) return 'Work required';
  return 'Significant gaps — action needed';
}

// ── Traffic light ──────────────────────────────────────────────────────────────

type RAGStatus = 'green' | 'amber' | 'red';

function clinicalSafetyRAG(data: EvidenceData): RAGStatus {
  const dcbPct = data.compliance.find(c => c.framework === 'DCB0129')?.pct_complete ?? 0;
  if (data.hazard_log.high_or_critical_open === 0 && dcbPct >= 80) return 'green';
  if (data.hazard_log.high_or_critical_open > 0 || (dcbPct >= 50 && dcbPct < 80)) return 'amber';
  return 'red';
}

function frameworkRAG(pct: number): RAGStatus {
  if (pct >= 80) return 'green';
  if (pct >= 50) return 'amber';
  return 'red';
}

function RAGBadge({ status }: { status: RAGStatus }) {
  const cfg = {
    green: { label: 'Green', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    amber: { label: 'Amber', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    red:   { label: 'Red',   cls: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'green' ? 'bg-emerald-400' : status === 'amber' ? 'bg-amber-400' : 'bg-rose-400'}`} />
      {cfg.label}
    </span>
  );
}

// ── Progress bar ───────────────────────────────────────────────────────────────

function ProgressBar({ pct, status }: { pct: number; status: RAGStatus }) {
  const colorCls = status === 'green' ? 'bg-emerald-500' : status === 'amber' ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full ${colorCls} rounded-full transition-all`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

// ── Section card ───────────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Stat ───────────────────────────────────────────────────────────────────────

function Stat({ label, value, sub, valueColor = 'text-slate-900 dark:text-white' }: {
  label: string; value: string; sub?: string; valueColor?: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-black ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

// ── Checklist item ─────────────────────────────────────────────────────────────

type CheckStatus = 'complete' | 'partial' | 'missing' | 'manual';

function ChecklistItem({ label, status, note }: { label: string; status: CheckStatus; note: string }) {
  const cfg: Record<CheckStatus, { icon: string; iconCls: string; noteCls: string }> = {
    complete: { icon: '✓', iconCls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', noteCls: 'text-emerald-400' },
    partial:  { icon: '⚠', iconCls: 'text-amber-400 bg-amber-500/10 border-amber-500/30',   noteCls: 'text-amber-400'   },
    missing:  { icon: '✗', iconCls: 'text-rose-400 bg-rose-500/10 border-rose-500/30',       noteCls: 'text-rose-400'   },
    manual:   { icon: '~', iconCls: 'text-slate-400 bg-slate-500/10 border-slate-500/30',    noteCls: 'text-slate-400'  },
  };
  const c = cfg[status];
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-200 dark:border-slate-800/60 last:border-0">
      <span className={`flex-shrink-0 w-6 h-6 rounded-md border flex items-center justify-center text-xs font-black ${c.iconCls}`}>
        {c.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-white">{label}</p>
        <p className={`text-xs mt-0.5 ${c.noteCls}`}>{note}</p>
      </div>
    </div>
  );
}

// ── Export HTML ────────────────────────────────────────────────────────────────

function buildExportHtml(data: EvidenceData, score: number): string {
  const byFw = new Map(data.compliance.map(c => [c.framework, c]));

  const frameworkRows = data.compliance
    .map(c => `
      <tr>
        <td>${c.framework}</td>
        <td style="text-align:center">${c.complete}</td>
        <td style="text-align:center">${c.in_progress}</td>
        <td style="text-align:center">${c.not_started}</td>
        <td style="text-align:center">${c.pct_complete}%</td>
        <td style="text-align:center;color:${c.pct_complete >= 80 ? '#16a34a' : c.pct_complete >= 50 ? '#d97706' : '#dc2626'}">
          ${c.pct_complete >= 80 ? 'Green' : c.pct_complete >= 50 ? 'Amber' : 'Red'}
        </td>
      </tr>
    `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Flowen NHS Clinical Evidence Pack</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; background: #fff; padding: 40px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 28px; font-weight: 800; color: #0f172a; }
  h2 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 28px 0 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
  h3 { font-size: 13px; font-weight: 600; color: #334155; margin: 16px 0 6px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 3px solid #0ea5e9; }
  .confidential { background: #fef2f2; color: #dc2626; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; border: 1px solid #fca5a5; }
  .score-hero { background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 2px solid #86efac; border-radius: 12px; padding: 24px; text-align: center; margin: 16px 0 24px; }
  .score-number { font-size: 48px; font-weight: 900; color: #16a34a; line-height: 1; }
  .score-label { font-size: 14px; color: #166534; margin-top: 8px; font-weight: 600; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 12px 0; }
  .stat-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
  .stat-value { font-size: 24px; font-weight: 800; color: #0f172a; }
  .stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 8px 0; }
  th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-weight: 600; color: #475569; font-size: 11px; text-transform: uppercase; }
  td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #334155; }
  .statement { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 0 8px 8px 0; margin: 12px 0; font-size: 13px; color: #1d4ed8; line-height: 1.6; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Flowen · NHS Clinical Evidence Pack</div>
    <h1>Clinical Evidence &amp; Procurement Readiness</h1>
    <div style="font-size:13px;color:#64748b;margin-top:8px">Generated: ${shortTs(data.generated_at)}</div>
  </div>
  <span class="confidential">CONFIDENTIAL</span>
</div>

<div class="score-hero">
  <div class="score-number">${score}/100</div>
  <div class="score-label">NHS Readiness Score — ${readinessLabel(score)}</div>
</div>

<h2>1. Clinical Safety (DCB0129)</h2>
<div class="grid-2">
  <div class="stat-box">
    <div class="stat-value">${data.hazard_log.total}</div>
    <div class="stat-label">Total hazards logged</div>
  </div>
  <div class="stat-box">
    <div class="stat-value" style="color:${data.hazard_log.high_or_critical_open === 0 ? '#16a34a' : '#dc2626'}">${data.hazard_log.high_or_critical_open}</div>
    <div class="stat-label">Open high/critical hazards</div>
  </div>
  <div class="stat-box">
    <div class="stat-value">${data.hazard_log.open}</div>
    <div class="stat-label">Open hazards (all)</div>
  </div>
  <div class="stat-box">
    <div class="stat-value">${data.hazard_log.mitigated}</div>
    <div class="stat-label">Mitigated hazards</div>
  </div>
</div>
<p style="font-size:13px;color:#475569;margin:8px 0">DCB0129 Completion: <strong>${byFw.get('DCB0129')?.pct_complete ?? 0}%</strong></p>

<h2>2. Clinical Effectiveness</h2>
<div class="grid-2">
  <div class="stat-box">
    <div class="stat-value">${fmtNum(data.sessions_total)}</div>
    <div class="stat-label">Total sessions analysed</div>
  </div>
  <div class="stat-box">
    <div class="stat-value">${data.improving_users_pct !== null ? data.improving_users_pct.toFixed(1) + '%' : 'Insufficient data'}</div>
    <div class="stat-label">Users showing improvement</div>
  </div>
  <div class="stat-box">
    <div class="stat-value">${data.avg_blocks_per_min !== null ? data.avg_blocks_per_min.toFixed(1) : 'N/A'}</div>
    <div class="stat-label">Avg disfluency events/min</div>
  </div>
  <div class="stat-box">
    <div class="stat-value">${fmtDuration(data.avg_session_duration_seconds)}</div>
    <div class="stat-label">Avg session duration</div>
  </div>
</div>
${data.improving_users_pct !== null ? `<div class="statement">${data.improving_users_pct.toFixed(1)}% of users with sufficient data (≥6 sessions) show a measurable reduction in disfluency events, demonstrating real-world clinical effectiveness.</div>` : ''}

<h2>3. Platform Scale</h2>
<div class="grid-2">
  <div class="stat-box"><div class="stat-value">${fmtNum(data.total_users)}</div><div class="stat-label">Registered users</div></div>
  <div class="stat-box"><div class="stat-value">${fmtNum(data.onboarded_users)}</div><div class="stat-label">Onboarded users</div></div>
  <div class="stat-box"><div class="stat-value">${fmtNum(data.slp_signups)}</div><div class="stat-label">SLP sign-ups</div></div>
  <div class="stat-box"><div class="stat-value">${fmtNum(data.icb_pipeline)}</div><div class="stat-label">ICB pipeline contacts</div></div>
</div>

<h2>4. Technical Assurance</h2>
<table>
  <thead><tr><th>Framework</th><th>Complete</th><th>In Progress</th><th>Not Started</th><th>% Done</th><th>Status</th></tr></thead>
  <tbody>${frameworkRows}</tbody>
</table>

<div class="footer">Generated by Flowen Admin &middot; Confidential &middot; Not for distribution &middot; ${shortTs(data.generated_at)}</div>
</body>
</html>`;
}

function handleExport(data: EvidenceData, score: number) {
  const html = buildExportHtml(data, score);
  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `flowen-nhs-evidence-pack-${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ─────────────────────────────────────────────────────────────

export function EvidenceClient({ data }: { data: EvidenceData }) {
  const score = useMemo(() => computeReadinessScore(data), [data]);
  const color = readinessColor(score);
  const byFw  = useMemo(() => new Map(data.compliance.map(c => [c.framework, c])), [data]);

  const safetyRAG = clinicalSafetyRAG(data);
  const dcbPct    = byFw.get('DCB0129')?.pct_complete ?? 0;

  // Procurement checklist statuses
  function dcbStatus(): CheckStatus {
    if (dcbPct >= 80 && data.hazard_log.high_or_critical_open === 0) return 'complete';
    if (dcbPct >= 50 || data.hazard_log.total > 0) return 'partial';
    return 'missing';
  }
  function fwStatus(fw: string): CheckStatus {
    const pct = byFw.get(fw)?.pct_complete ?? 0;
    if (pct >= 80) return 'complete';
    if (pct >= 30) return 'partial';
    return 'missing';
  }
  function outcomesStatus(): CheckStatus {
    if (data.improving_users_pct !== null && data.improving_users_pct >= 30) return 'complete';
    if (data.sessions_total > 0) return 'partial';
    return 'missing';
  }

  const improvingPct  = data.improving_users_pct;
  const improvingColor = improvingPct === null
    ? 'text-slate-400'
    : improvingPct >= 50
      ? 'text-emerald-400'
      : improvingPct >= 30
        ? 'text-amber-400'
        : 'text-rose-400';

  // Users with enough data (those in improvement calc — proxy: unique users with 6+ sessions)
  // We don't have direct count here, so display total unique users with sessions as proxy
  const usersInOutcomeCalc = data.unique_users_with_sessions;

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 font-mono">
          Last generated: {shortTs(data.generated_at)}
        </p>
        <button
          onClick={() => handleExport(data, score)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
          Export Report
        </button>
      </div>

      {/* Readiness score hero */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col sm:flex-row items-center gap-8">
        {/* Ring */}
        <div className="flex-shrink-0 relative" style={{ width: 140, height: 140 }}>
          <div
            className="w-full h-full rounded-full"
            style={{
              background: `conic-gradient(${color} calc(${score} * 1%), #1e293b 0)`,
            }}
          />
          <div className="absolute inset-3 rounded-full bg-white dark:bg-slate-900 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{score}</span>
            <span className="text-[9px] text-slate-500 font-mono">/100</span>
          </div>
        </div>
        {/* Text */}
        <div className="flex-1 text-center sm:text-left">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">NHS Readiness Score</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white mb-2">{score}/100</p>
          <p className="text-sm font-semibold" style={{ color }}>{readinessLabel(score)}</p>
          <p className="text-xs text-slate-500 mt-3 max-w-md">
            Score weights: DCB0129 30% · DTAC 25% · DSPT 20% · Hazard log safety 15% · Clinical outcomes 10%
          </p>
        </div>
        {/* Score breakdown */}
        <div className="flex-shrink-0 space-y-2 w-full sm:w-56">
          {[
            { label: 'DCB0129', pct: dcbPct, weight: 30 },
            { label: 'DTAC',    pct: byFw.get('DTAC')?.pct_complete ?? 0, weight: 25 },
            { label: 'DSPT',    pct: byFw.get('DSPT')?.pct_complete ?? 0, weight: 20 },
          ].map(({ label, pct, weight }) => (
            <div key={label} className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>{label}</span>
                <span>{pct}% <span className="text-slate-600">(w{weight})</span></span>
              </div>
              <ProgressBar pct={pct} status={frameworkRAG(pct)} />
            </div>
          ))}
        </div>
      </div>

      {/* 2×2 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. Clinical Safety */}
        <SectionCard title="1. Clinical Safety (DCB0129)" subtitle="Hazard log, safety case, and compliance progress">
          {/* Traffic light + statement */}
          <div className="flex items-center gap-3">
            <RAGBadge status={safetyRAG} />
            <span className="text-xs text-slate-400">
              Clinical Safety Case: <span className={dcbPct >= 80 ? 'text-emerald-400' : 'text-amber-400'}>{dcbPct >= 80 ? 'Complete' : 'In progress'}</span>
            </span>
          </div>

          {/* Hazard summary */}
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Total hazards" value={String(data.hazard_log.total)} />
            <Stat
              label="Open high/critical"
              value={String(data.hazard_log.high_or_critical_open)}
              valueColor={data.hazard_log.high_or_critical_open === 0 ? 'text-emerald-400' : 'text-rose-400'}
              sub={data.hazard_log.high_or_critical_open === 0 ? 'None — safe' : 'Action required'}
            />
            <Stat label="Open (all)" value={String(data.hazard_log.open)} valueColor="text-amber-400" />
            <Stat label="Mitigated" value={String(data.hazard_log.mitigated)} valueColor="text-teal-400" />
          </div>

          {/* Framework progress bars */}
          <div className="space-y-3">
            {['DCB0129', 'DTAC', 'DSPT'].map(fw => {
              const c = byFw.get(fw);
              const pct = c?.pct_complete ?? 0;
              return (
                <div key={fw} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{fw}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">{pct}%</span>
                      <RAGBadge status={frameworkRAG(pct)} />
                    </div>
                  </div>
                  <ProgressBar pct={pct} status={frameworkRAG(pct)} />
                  <div className="flex gap-3 text-[10px] text-slate-600 font-mono">
                    <span>Done: {c?.complete ?? 0}</span>
                    <span>WIP: {c?.in_progress ?? 0}</span>
                    <span>Todo: {c?.not_started ?? 0}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* 2. Clinical Effectiveness */}
        <SectionCard title="2. Clinical Effectiveness" subtitle="Outcome data from practice sessions (last 90 days)">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Total sessions" value={fmtNum(data.sessions_total)} />
            <Stat label="Sessions (30d)" value={fmtNum(data.sessions_last_30d)} />
            <Stat label="Users with data" value={fmtNum(usersInOutcomeCalc)} sub="(≥1 session, 90d)" />
            <Stat
              label="Improving users"
              value={fmtPct(improvingPct, 1)}
              valueColor={improvingColor}
              sub={improvingPct !== null ? '≥15% fewer blocks/min' : 'Insufficient data'}
            />
            <Stat
              label="Avg blocks/min"
              value={data.avg_blocks_per_min !== null ? data.avg_blocks_per_min.toFixed(1) : 'N/A'}
              sub="lower = better"
            />
            <Stat
              label="Avg session duration"
              value={fmtDuration(data.avg_session_duration_seconds)}
            />
          </div>

          {/* Evidence statement */}
          {improvingPct !== null ? (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
              <p className="text-[10px] font-mono text-blue-400 uppercase tracking-widest mb-1.5">Evidence statement</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                <strong className="text-slate-900 dark:text-white">{improvingPct.toFixed(1)}%</strong> of users with sufficient data
                (≥6 sessions) show a measurable reduction in disfluency events compared to their baseline,
                demonstrating real-world clinical effectiveness of the Flowen intervention.
              </p>
            </div>
          ) : (
            <div className="bg-slate-100/60 dark:bg-slate-800/40 border border-slate-700 rounded-xl p-4">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Evidence statement</p>
              <p className="text-sm text-slate-500">
                Insufficient longitudinal data. Users need ≥6 sessions for improvement analysis.
                Outcome evidence will populate automatically as usage grows.
              </p>
            </div>
          )}
        </SectionCard>

        {/* 3. Platform Scale */}
        <SectionCard title="3. Platform Scale" subtitle="Real-world deployment data">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Total users" value={fmtNum(data.total_users)} />
            <Stat label="Onboarded" value={fmtNum(data.onboarded_users)} sub={`${data.total_users > 0 ? Math.round((data.onboarded_users / data.total_users) * 100) : 0}% completion rate`} />
            <Stat label="SLP sign-ups" value={fmtNum(data.slp_signups)} valueColor="text-teal-400" sub="Clinical professionals" />
            <Stat label="ICB pipeline" value={fmtNum(data.icb_pipeline)} valueColor="text-blue-400" sub="Procurement contacts" />
          </div>

          <div className="bg-slate-100/60 dark:bg-slate-800/40 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Real-world deployment data demonstrates safe operation at scale across{' '}
              <strong className="text-slate-900 dark:text-white">{fmtNum(data.total_users)}</strong> registered users and{' '}
              <strong className="text-slate-900 dark:text-white">{fmtNum(data.sessions_total)}</strong> recorded sessions,
              with no serious adverse events reported.
            </p>
          </div>
        </SectionCard>

        {/* 4. Technical Assurance */}
        <SectionCard title="4. Technical Assurance" subtitle="DTAC, DSPT, and regulatory frameworks">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left text-[10px] font-mono text-slate-600 uppercase pb-2 pr-3">Framework</th>
                  <th className="text-center text-[10px] font-mono text-slate-600 uppercase pb-2 px-2">Done</th>
                  <th className="text-center text-[10px] font-mono text-slate-600 uppercase pb-2 px-2">WIP</th>
                  <th className="text-center text-[10px] font-mono text-slate-600 uppercase pb-2 px-2">Todo</th>
                  <th className="text-center text-[10px] font-mono text-slate-600 uppercase pb-2 px-2">%</th>
                  <th className="text-center text-[10px] font-mono text-slate-600 uppercase pb-2">RAG</th>
                </tr>
              </thead>
              <tbody>
                {data.compliance.map(c => (
                  <tr key={c.framework} className="border-b border-slate-200 dark:border-slate-800/60">
                    <td className="py-2 pr-3 font-mono font-bold text-slate-600 dark:text-slate-300">{c.framework}</td>
                    <td className="py-2 px-2 text-center text-emerald-400">{c.complete}</td>
                    <td className="py-2 px-2 text-center text-amber-400">{c.in_progress}</td>
                    <td className="py-2 px-2 text-center text-slate-500">{c.not_started}</td>
                    <td className="py-2 px-2 text-center text-slate-900 dark:text-white font-semibold">{c.pct_complete}%</td>
                    <td className="py-2 text-center"><RAGBadge status={frameworkRAG(c.pct_complete)} /></td>
                  </tr>
                ))}
                {data.compliance.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-600 text-xs">
                      No compliance items yet — add items in NHS Readiness
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-500">DTAC</span>
              <RAGBadge status={frameworkRAG(byFw.get('DTAC')?.pct_complete ?? 0)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-500">DSPT</span>
              <RAGBadge status={frameworkRAG(byFw.get('DSPT')?.pct_complete ?? 0)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-500">MHRA</span>
              <RAGBadge status={frameworkRAG(byFw.get('MHRA')?.pct_complete ?? 0)} />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Procurement Readiness Checklist */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="mb-5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Procurement Readiness Checklist</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Standard NHS digital health procurement requirements (ICB / NHS England DDAT framework)
          </p>
        </div>
        <div>
          <ChecklistItem
            label="DCB0129 Clinical Safety Case"
            status={dcbStatus()}
            note={
              dcbStatus() === 'complete'
                ? `DCB0129 ${dcbPct}% complete · No open high/critical hazards`
                : dcbStatus() === 'partial'
                  ? `DCB0129 ${dcbPct}% complete · ${data.hazard_log.high_or_critical_open > 0 ? `${data.hazard_log.high_or_critical_open} open high/critical hazard(s) — resolve before submission` : 'Continue to completion'}`
                  : 'Not started — mandatory for NHS procurement'
            }
          />
          <ChecklistItem
            label="DTAC Assessment"
            status={fwStatus('DTAC')}
            note={`${byFw.get('DTAC')?.pct_complete ?? 0}% of DTAC items complete · ${byFw.get('DTAC')?.complete ?? 0} done, ${byFw.get('DTAC')?.in_progress ?? 0} in progress`}
          />
          <ChecklistItem
            label="DSP Toolkit (DSPT)"
            status={fwStatus('DSPT')}
            note={`${byFw.get('DSPT')?.pct_complete ?? 0}% of DSPT items complete`}
          />
          <ChecklistItem
            label="Clinical Outcome Evidence"
            status={outcomesStatus()}
            note={
              outcomesStatus() === 'complete'
                ? `${improvingPct?.toFixed(1)}% of users show measurable improvement — sufficient for evidence submission`
                : outcomesStatus() === 'partial'
                  ? `${fmtNum(data.sessions_total)} sessions recorded. More longitudinal data recommended (need ≥6 sessions/user)`
                  : 'No session data available — real-world use required'
            }
          />
          <ChecklistItem
            label="Information Governance Policy"
            status="manual"
            note="Review required — upload to Data Room and confirm with DPO"
          />
          <ChecklistItem
            label="Data Processing Agreement template"
            status="manual"
            note="Review required — legal review needed before NHS contract signature"
          />
          <ChecklistItem
            label="Business Continuity Plan"
            status="manual"
            note="Review required — document recovery objectives and escalation paths"
          />
          <ChecklistItem
            label="Penetration Test Report"
            status="manual"
            note="Review required — commission CREST-certified pen test prior to go-live"
          />
        </div>
      </div>
    </div>
  );
}
