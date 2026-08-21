'use client';

import React, { useState, useMemo, useTransition } from 'react';
import type { ValuationConfig, ValuationSnapshot, LiveKpis, RoadmapStatus } from '@/app/api/admin/valuation/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtGBP(pence: number, compact = false): string {
  const p = Math.round(pence) / 100;
  if (compact) {
    if (p >= 1_000_000) return `£${(p / 1_000_000).toFixed(1)}m`;
    if (p >= 1_000)     return `£${(p / 1_000).toFixed(0)}k`;
    return `£${p.toLocaleString('en-GB')}`;
  }
  if (p >= 1_000_000) return `£${(p / 1_000_000).toFixed(2)}m`;
  if (p >= 1_000)     return `£${Math.round(p / 1_000)}k`;
  return `£${p.toLocaleString('en-GB')}`;
}

function parsePounds(s: string): number {
  const n = parseFloat(s.replace(/[£,]/g, ''));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

function poundsStr(pence: number): string {
  return String(Math.round(pence / 100));
}

async function apiPost(payload: Record<string, unknown>) {
  const res = await fetch('/api/admin/valuation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ config?: ValuationConfig; snapshot?: ValuationSnapshot; ok?: boolean; error?: string }>;
}

// ── Default config ────────────────────────────────────────────────────────────

function defaultConfig(): ValuationConfig {
  // Updated Aug 2026 — reflects Flowen's current stage:
  // working AI SaaS product live in production, founding member revenue model,
  // NHS pipeline conversations beginning, proprietary stuttering ASR dataset.
  return {
    id: '',
    // Berkus: working product (not just prototype), founding revenue, NHS interest
    berkus_sound_idea:           45_000_000,   // £450k — clear differentiated proposition
    berkus_prototype:            45_000_000,   // £450k — full working AI product live
    berkus_management_team:      35_000_000,   // £350k — SLT + AI + product expertise
    berkus_strategic_rel:        20_000_000,   // £200k — NHS conversations forming
    berkus_product_rollout:      25_000_000,   // £250k — first revenue, founding model
    // Scorecard: above-median on product/IP and market; building on marketing
    scorecard_median_pence:     150_000_000,   // £1.5m UK pre-seed median
    scorecard_team:              1.30,         // above avg — clinical + AI domain depth
    scorecard_market_size:       1.40,         // strong — NHS + private SLT + £2.5B TAM
    scorecard_product_tech:      1.50,         // strong — proprietary ASR pipeline + IP
    scorecard_competition:       1.10,         // moderate — limited direct AI SLT rivals
    scorecard_marketing:         0.90,         // early stage — still building channels
    scorecard_investment_need:   1.00,         // average — lean pre-seed ask
    scorecard_other:             1.10,         // SEIS eligibility, NHS strategic alignment
    // ARR multiple: AI/healthtech premium above sector baseline
    arr_multiple:                8.0,
    // VC: realistic UK healthtech acquisition target (Nuance/M&S-tier exit)
    vc_exit_valuation_pence:  7_500_000_000,   // £75m — realistic UK healthtech M&A exit
    vc_investment_pence:         25_000_000,   // £250k — pre-seed round size
    vc_years_to_exit:            5,
    vc_required_irr:             35.0,
    // Comparable: AI premium range; 20% traction bonus for early users + waitlist
    comp_arr_multiple_low:       6.0,
    comp_arr_multiple_high:      15.0,         // AI premium ceiling
    comp_baseline_pence:        250_000_000,   // £2.5m — working product baseline
    comp_traction_premium_pct:   20,           // waitlist + NHS interest + early users
    // DCF: projections based on NHS pilot path + consumer scaling
    dcf_discount_rate:           35.0,
    dcf_terminal_multiple:       5.0,
    dcf_year1_revenue_pence:  12_000_000,      // £120k — founding members + pilot
    dcf_year2_revenue_pence:  48_000_000,      // £480k — NHS expansion + consumer
    dcf_year3_revenue_pence: 150_000_000,      // £1.5m — multi-ICB + product suite
    // NHS: 5 ICBs at 750 patients, £600/patient/year, 30% pipeline probability
    nhs_price_per_patient_pence: 60_000,       // £600/patient/year
    nhs_patients_per_icb:        750,
    nhs_icb_count:               5,
    nhs_probability_pct:         30.0,
    updated_at: new Date().toISOString(),
  };
}

// ── Valuation Engine ──────────────────────────────────────────────────────────

interface MethodResult {
  id:          string;
  name:        string;
  shortName:   string;
  category:    'qualitative' | 'revenue' | 'projection' | 'market' | 'sector';
  pence:       number | null;   // null = locked or not computable
  low:         number | null;
  high:        number | null;
  locked:      boolean;
  lockReason:  string;
  gateLabel:   string;
  gateStatus:  'locked' | 'in_progress' | 'unlocked';
  methodology: string;
  keyInputs:   string[];
}

function computeBerkus(cfg: ValuationConfig): number {
  return (
    cfg.berkus_sound_idea +
    cfg.berkus_prototype +
    cfg.berkus_management_team +
    cfg.berkus_strategic_rel +
    cfg.berkus_product_rollout
  );
}

function computeScorecard(cfg: ValuationConfig): number {
  const weights = [0.30, 0.25, 0.15, 0.10, 0.10, 0.05, 0.05];
  const scores  = [
    cfg.scorecard_team,
    cfg.scorecard_market_size,
    cfg.scorecard_product_tech,
    cfg.scorecard_competition,
    cfg.scorecard_marketing,
    cfg.scorecard_investment_need,
    cfg.scorecard_other,
  ];
  const multiplier = weights.reduce((acc, w, i) => acc + w * (scores[i] ?? 1), 0);
  return Math.round(cfg.scorecard_median_pence * multiplier);
}

function computeARR(cfg: ValuationConfig, kpis: LiveKpis): { val: number; arr: number } {
  const arr = kpis.mrrPence * 12;
  return { val: Math.round(arr * cfg.arr_multiple), arr };
}

function computeVC(cfg: ValuationConfig): number {
  const discount = (1 + cfg.vc_required_irr / 100) ** cfg.vc_years_to_exit;
  const postMoney = Math.round(cfg.vc_exit_valuation_pence / discount);
  return Math.max(0, postMoney - cfg.vc_investment_pence);
}

function computeComp(cfg: ValuationConfig, kpis: LiveKpis): { low: number; mid: number; high: number } {
  if (kpis.mrrPence > 0) {
    const arr  = kpis.mrrPence * 12;
    const prem = 1 + cfg.comp_traction_premium_pct / 100;
    return {
      low:  Math.round(arr * cfg.comp_arr_multiple_low  * prem),
      mid:  Math.round(arr * ((cfg.comp_arr_multiple_low + cfg.comp_arr_multiple_high) / 2) * prem),
      high: Math.round(arr * cfg.comp_arr_multiple_high * prem),
    };
  }
  const prem = 1 + cfg.comp_traction_premium_pct / 100;
  return {
    low:  Math.round(cfg.comp_baseline_pence * 0.8 * prem),
    mid:  Math.round(cfg.comp_baseline_pence * prem),
    high: Math.round(cfg.comp_baseline_pence * 1.5 * prem),
  };
}

function computeDCF(cfg: ValuationConfig): number {
  const r = cfg.dcf_discount_rate / 100;
  const pv1 = cfg.dcf_year1_revenue_pence / (1 + r);
  const pv2 = cfg.dcf_year2_revenue_pence / ((1 + r) ** 2);
  const pv3 = cfg.dcf_year3_revenue_pence / ((1 + r) ** 3);
  const terminal = (cfg.dcf_year3_revenue_pence * cfg.dcf_terminal_multiple) / ((1 + r) ** 3);
  return Math.round(pv1 + pv2 + pv3 + terminal);
}

function computeNHS(cfg: ValuationConfig): { val: number; gross: number } {
  const gross = cfg.nhs_price_per_patient_pence * cfg.nhs_patients_per_icb * cfg.nhs_icb_count;
  return { val: Math.round(gross * (cfg.nhs_probability_pct / 100)), gross };
}

// Gate check helpers
function hasMilestoneComplete(milestones: RoadmapStatus[], keywords: string[]): boolean {
  return milestones.some(m =>
    m.status === 'complete' &&
    keywords.some(kw => m.title.toLowerCase().includes(kw.toLowerCase()))
  );
}
function hasMilestoneActive(milestones: RoadmapStatus[], keywords: string[]): boolean {
  return milestones.some(m =>
    (m.status === 'in_progress' || m.status === 'complete') &&
    keywords.some(kw => m.title.toLowerCase().includes(kw.toLowerCase()))
  );
}
function hasPhaseProgress(milestones: RoadmapStatus[], phase: string): boolean {
  return milestones.some(m => m.phase === phase && (m.status === 'complete' || m.status === 'in_progress'));
}

function buildMethods(cfg: ValuationConfig, kpis: LiveKpis, milestones: RoadmapStatus[]): MethodResult[] {
  // Gate states
  const hasRevenue      = kpis.mrrPence > 0;
  const nhsPilotActive  = hasPhaseProgress(milestones, 'nhs_pilot');
  const nhsMilestone    = hasMilestoneActive(milestones, ['NHS', 'ICB', 'DSPT', 'pilot', 'pipeline']);
  const fundingMilestone= hasMilestoneComplete(milestones, ['funding', 'SEIS', 'seed', 'raise', 'investor']);

  // ── 1. Berkus ──────────────────────────────────────────────────────────────

  const berkusVal = computeBerkus(cfg);
  const berkusGate: MethodResult['gateStatus'] = 'unlocked';

  // ── 2. Scorecard ──────────────────────────────────────────────────────────

  const scorecardVal = computeScorecard(cfg);

  // ── 3. ARR Multiple ───────────────────────────────────────────────────────

  const arrLocked = !hasRevenue;
  const arrGate: MethodResult['gateStatus'] = hasRevenue ? 'unlocked' : 'locked';
  const arrResult = hasRevenue ? computeARR(cfg, kpis) : null;

  // ── 4. VC Method ─────────────────────────────────────────────────────────

  const vcGate: MethodResult['gateStatus'] = fundingMilestone ? 'unlocked' : (hasPhaseProgress(milestones, 'launch') ? 'in_progress' : 'locked');
  const vcVal = computeVC(cfg);

  // ── 5. Comparable Company ─────────────────────────────────────────────────

  const compResult = computeComp(cfg, kpis);
  const compGate: MethodResult['gateStatus'] = 'unlocked';

  // ── 6. DCF ───────────────────────────────────────────────────────────────

  const dcfLocked = !nhsPilotActive;
  const dcfGate: MethodResult['gateStatus'] = nhsPilotActive ? 'unlocked' : (nhsMilestone ? 'in_progress' : 'locked');
  const dcfVal = nhsPilotActive ? computeDCF(cfg) : null;

  // ── 7. NHS Contract Value ─────────────────────────────────────────────────

  const nhsLocked = !nhsMilestone;
  const nhsGate: MethodResult['gateStatus'] = nhsMilestone ? 'unlocked' : 'locked';
  const nhsResult = nhsMilestone ? computeNHS(cfg) : null;

  return [
    {
      id: 'berkus', name: 'Berkus Method', shortName: 'Berkus',
      category: 'qualitative',
      pence: berkusVal, low: Math.round(berkusVal * 0.85), high: Math.round(berkusVal * 1.15),
      locked: false, lockReason: '', gateLabel: 'Always available',
      gateStatus: berkusGate,
      methodology: 'Assigns up to £500k value to 5 risk reduction factors: sound idea, working prototype, management team, strategic relationships, and product/sales evidence. Max £2.5m pre-revenue.',
      keyInputs: ['5 qualitative risk factors', 'Up to £500k each', 'Max £2.5m total'],
    },
    {
      id: 'scorecard', name: 'Scorecard (Payne) Method', shortName: 'Scorecard',
      category: 'qualitative',
      pence: scorecardVal, low: Math.round(scorecardVal * 0.80), high: Math.round(scorecardVal * 1.20),
      locked: false, lockReason: '', gateLabel: 'Always available',
      gateStatus: 'unlocked',
      methodology: 'Adjusts the regional pre-seed median (£1.5m UK) by weighted scorecard factors. Team (30%), Market (25%), Product/IP (15%), Competition (10%), Marketing (10%), Funding need (5%), Other (5%).',
      keyInputs: [`Regional median: ${fmtGBP(cfg.scorecard_median_pence)}`, '7 weighted factors', 'Range: 0–2× per factor'],
    },
    {
      id: 'arr', name: 'ARR Multiple', shortName: 'ARR ×',
      category: 'revenue',
      pence: arrResult?.val ?? null,
      low:  arrResult ? Math.round(arrResult.val * 0.75) : null,
      high: arrResult ? Math.round(arrResult.val * 1.50) : null,
      locked: arrLocked,
      lockReason: 'Requires first paid revenue (MRR > £0)',
      gateLabel: arrLocked ? 'Unlock: first MRR' : `MRR: ${fmtGBP(kpis.mrrPence)} | ARR: ${fmtGBP(kpis.mrrPence * 12)}`,
      gateStatus: arrGate,
      methodology: `Applies a revenue multiple to Annual Recurring Revenue. Healthtech/AI SaaS early-stage multiples typically range 5–12×. Currently using ${cfg.arr_multiple}×.`,
      keyInputs: [`MRR: ${fmtGBP(kpis.mrrPence)}`, `Multiple: ${cfg.arr_multiple}×`, 'ARR = MRR × 12'],
    },
    {
      id: 'vc', name: 'VC Return Method', shortName: 'VC Method',
      category: 'projection',
      pence: vcVal, low: Math.round(vcVal * 0.70), high: Math.round(vcVal * 1.30),
      locked: false, lockReason: '',
      gateLabel: vcGate === 'unlocked' ? 'Funding milestone reached' : 'Unlock: funding milestone',
      gateStatus: vcGate,
      methodology: `Works backward from a target exit valuation. Pre-money = (Exit ÷ (1 + IRR)^years) − Investment. Currently: ${fmtGBP(cfg.vc_exit_valuation_pence)} exit, ${cfg.vc_required_irr}% IRR over ${cfg.vc_years_to_exit} years.`,
      keyInputs: [`Exit: ${fmtGBP(cfg.vc_exit_valuation_pence)}`, `IRR: ${cfg.vc_required_irr}%`, `Years: ${cfg.vc_years_to_exit}`],
    },
    {
      id: 'comp', name: 'Comparable Company', shortName: 'Comps',
      category: 'market',
      pence: compResult.mid, low: compResult.low, high: compResult.high,
      locked: false, lockReason: '', gateLabel: 'Always available',
      gateStatus: compGate,
      methodology: `Based on comparable healthtech/AI company multiples. ${kpis.mrrPence > 0 ? `Applies ${cfg.comp_arr_multiple_low}–${cfg.comp_arr_multiple_high}× ARR range to live ARR.` : `Uses pre-revenue baseline of ${fmtGBP(cfg.comp_baseline_pence)} with traction premium.`} References: Livi/Kry, Brightside Health, Nuance Communications, SpeechTherapy.com.`,
      keyInputs: kpis.mrrPence > 0
        ? [`ARR: ${fmtGBP(kpis.mrrPence * 12)}`, `Multiple: ${cfg.comp_arr_multiple_low}–${cfg.comp_arr_multiple_high}×`]
        : [`Pre-revenue baseline: ${fmtGBP(cfg.comp_baseline_pence)}`, `Traction premium: +${cfg.comp_traction_premium_pct}%`],
    },
    {
      id: 'dcf', name: 'Discounted Cash Flow', shortName: 'DCF',
      category: 'projection',
      pence: dcfVal, low: dcfVal ? Math.round(dcfVal * 0.70) : null, high: dcfVal ? Math.round(dcfVal * 1.40) : null,
      locked: dcfLocked,
      lockReason: 'Requires NHS Pilot phase to be in progress',
      gateLabel: dcfLocked ? 'Unlock: NHS Pilot milestone' : 'NHS Pilot in progress',
      gateStatus: dcfGate,
      methodology: `3-year DCF with terminal value. Discounts projected revenue at ${cfg.dcf_discount_rate}% (early-stage risk rate) and applies ${cfg.dcf_terminal_multiple}× terminal multiple to Year 3 revenue.`,
      keyInputs: [`Discount rate: ${cfg.dcf_discount_rate}%`, `Terminal multiple: ${cfg.dcf_terminal_multiple}×`, `3-year projections`],
    },
    {
      id: 'nhs', name: 'NHS Contract Value', shortName: 'NHS TAM',
      category: 'sector',
      pence: nhsResult?.val ?? null,
      low:  nhsResult ? Math.round(nhsResult.val * 0.5) : null,
      high: nhsResult ? Math.round(nhsResult.gross)     : null,
      locked: nhsLocked,
      lockReason: 'Requires NHS pipeline milestone to be active',
      gateLabel: nhsLocked ? 'Unlock: NHS pipeline milestone' : `${cfg.nhs_icb_count} ICBs · ${cfg.nhs_patients_per_icb} patients each`,
      gateStatus: nhsGate,
      methodology: `Values the company on probability-weighted NHS contract TAM. ${cfg.nhs_icb_count} ICBs × ${cfg.nhs_patients_per_icb} patients × £${(cfg.nhs_price_per_patient_pence / 100).toFixed(0)}/patient/year × ${cfg.nhs_probability_pct}% probability.`,
      keyInputs: [`${cfg.nhs_icb_count} ICBs`, `£${(cfg.nhs_price_per_patient_pence / 100).toFixed(0)}/patient/yr`, `${cfg.nhs_probability_pct}% probability`],
    },
  ];
}

function computeConsensus(methods: MethodResult[]): { low: number; mid: number; high: number; count: number } {
  const unlocked = methods.filter(m => !m.locked && m.pence !== null && m.pence > 0);
  if (unlocked.length === 0) return { low: 0, mid: 0, high: 0, count: 0 };

  const lows  = unlocked.map(m => m.low  ?? m.pence!);
  const mids  = unlocked.map(m => m.pence!);
  const highs = unlocked.map(m => m.high ?? m.pence!);

  return {
    low:   Math.round(lows.reduce((a, b) => a + b, 0)  / lows.length),
    mid:   Math.round(mids.reduce((a, b) => a + b, 0)  / mids.length),
    high:  Math.round(highs.reduce((a, b) => a + b, 0) / highs.length),
    count: unlocked.length,
  };
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, kind }: { message: string; kind: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-mono shadow-xl border ${
      kind === 'success'
        ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
        : 'bg-red-950 border-red-800 text-red-300'
    }`}>
      {message}
    </div>
  );
}

// ── Consensus Hero ────────────────────────────────────────────────────────────

function ConsensusHero({ consensus, methods, kpis, onSnapshot }: {
  consensus: ReturnType<typeof computeConsensus>;
  methods: MethodResult[];
  kpis: LiveKpis;
  onSnapshot: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const unlockedCount = methods.filter(m => !m.locked).length;

  function copyForInvestor() {
    const lines = [
      `Flowen Technologies Ltd — Valuation Estimate`,
      `As of: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`,
      '',
      `CONSENSUS PRE-MONEY VALUATION`,
      `  Conservative: ${fmtGBP(consensus.low)}`,
      `  Mid-point:    ${fmtGBP(consensus.mid)}`,
      `  Optimistic:   ${fmtGBP(consensus.high)}`,
      '',
      `METHODOLOGY BREAKDOWN (${consensus.count}/${methods.length} methods active)`,
      ...methods.filter(m => !m.locked && m.pence).map(m =>
        `  ${m.shortName.padEnd(14)} ${fmtGBP(m.pence!)} (${fmtGBP(m.low ?? m.pence!)} – ${fmtGBP(m.high ?? m.pence!)})`
      ),
      '',
      `LIVE METRICS`,
      `  MRR:        ${fmtGBP(kpis.mrrPence)}`,
      `  Total Users: ${kpis.totalUsers.toLocaleString()}`,
      `  Waitlist:    ${kpis.waitlistTotal.toLocaleString()}`,
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 border border-amber-500/20 rounded-2xl p-6">
      <div className="absolute -top-10 -right-10 w-56 h-56 bg-amber-600/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-indigo-600/8 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 tracking-widest">LIVE VALUATION</span>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-slate-700 text-slate-400">{consensus.count}/{methods.length} METHODS ACTIVE</span>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 animate-pulse">LIVE</span>
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Consensus Pre-Money Valuation</h2>
          <p className="text-xs text-slate-500 mt-0.5">Arithmetic mean of {consensus.count} active method outputs · {unlockedCount} methods unlocked</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={copyForInvestor}
            className={`px-3.5 py-2 text-xs font-mono font-bold rounded-xl border transition-all ${
              copied ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-500'
            }`}>
            {copied ? 'Copied ✓' : 'Copy for investor'}
          </button>
          <button type="button" onClick={onSnapshot}
            className="px-3.5 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-500 transition-all">
            📸 Save snapshot
          </button>
        </div>
      </div>

      {/* 3-column valuation range */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-100 dark:bg-slate-950/60 rounded-xl p-4 border border-slate-200 dark:border-slate-800/60">
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Conservative</p>
          <p className="text-2xl sm:text-3xl font-black text-slate-600 dark:text-slate-300">{fmtGBP(consensus.low, true)}</p>
          <p className="text-[9px] font-mono text-slate-600 mt-1">Average low-end</p>
        </div>
        <div className="bg-slate-100 dark:bg-slate-950/60 rounded-xl p-4 border border-amber-500/20">
          <p className="text-[9px] font-mono text-amber-500/80 uppercase tracking-widest mb-1.5">Mid-Point</p>
          <p className="text-3xl sm:text-4xl font-black text-amber-400">{fmtGBP(consensus.mid, true)}</p>
          <p className="text-[9px] font-mono text-slate-600 mt-1">Recommended to share</p>
        </div>
        <div className="bg-slate-100 dark:bg-slate-950/60 rounded-xl p-4 border border-slate-200 dark:border-slate-800/60">
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Optimistic</p>
          <p className="text-2xl sm:text-3xl font-black text-slate-600 dark:text-slate-300">{fmtGBP(consensus.high, true)}</p>
          <p className="text-[9px] font-mono text-slate-600 mt-1">Average high-end</p>
        </div>
      </div>

      {/* Method contribution bar */}
      <div className="space-y-2">
        <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Method contributions</p>
        <div className="flex gap-1.5 flex-wrap">
          {methods.map(m => {
            const active = !m.locked && m.pence !== null;
            return (
              <div key={m.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono ${
                active
                  ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
                  : 'bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-600'
              }`}>
                {active ? '●' : '○'} {m.shortName}
                {active && m.pence ? <span className="font-bold">{fmtGBP(m.pence, true)}</span> : <span className="text-slate-700">locked</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Live metrics row */}
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/60 flex flex-wrap gap-x-6 gap-y-1">
        {[
          { label: 'MRR', value: fmtGBP(kpis.mrrPence) },
          { label: 'Users', value: kpis.totalUsers.toLocaleString() },
          { label: 'Waitlist', value: kpis.waitlistTotal.toLocaleString() },
          { label: 'Founding', value: String(kpis.foundingCount) },
          { label: 'ARR', value: fmtGBP(kpis.mrrPence * 12) },
        ].map(m => (
          <div key={m.label} className="text-[10px] font-mono">
            <span className="text-slate-600">{m.label}: </span>
            <span className="text-slate-600 dark:text-slate-300 font-bold">{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Milestone unlock track ────────────────────────────────────────────────────

const GATE_COLOURS = {
  unlocked:    { dot: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
  in_progress: { dot: 'bg-amber-500',   text: 'text-amber-400',   border: 'border-amber-500/30',   bg: 'bg-amber-500/10' },
  locked:      { dot: 'bg-slate-700',   text: 'text-slate-500',   border: 'border-slate-200 dark:border-slate-800',      bg: 'bg-white dark:bg-slate-900' },
};

const CATEGORY_BADGE: Record<MethodResult['category'], string> = {
  qualitative: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  revenue:     'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  projection:  'bg-sky-500/15 text-sky-400 border border-sky-500/30',
  market:      'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  sector:      'bg-rose-500/15 text-rose-400 border border-rose-500/30',
};

function MilestoneUnlockTrack({ methods, milestones }: { methods: MethodResult[]; milestones: RoadmapStatus[] }) {
  const total    = methods.length;
  const unlocked = methods.filter(m => !m.locked).length;
  const inProg   = methods.filter(m => m.gateStatus === 'in_progress').length;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Milestone Unlock Track</h3>
          <p className="text-[11px] font-mono text-slate-500 mt-0.5">Complete roadmap milestones to unlock richer valuation methods</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-slate-500">{unlocked}/{total} unlocked</span>
          <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${(unlocked / total) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {methods.map(m => {
          const g = GATE_COLOURS[m.gateStatus];
          return (
            <div key={m.id} className={`rounded-xl border p-3.5 ${g.bg} ${g.border}`}>
              <div className="flex items-start gap-2 mb-2">
                <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${g.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold leading-tight ${m.locked ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>{m.shortName}</p>
                  <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${CATEGORY_BADGE[m.category]}`}>
                    {m.category}
                  </span>
                </div>
              </div>
              <p className={`text-[10px] font-mono leading-relaxed ${m.locked ? 'text-slate-600' : g.text}`}>
                {m.gateLabel}
              </p>
              {m.locked && (
                <p className="text-[9px] font-mono text-slate-700 mt-1.5 leading-relaxed">{m.lockReason}</p>
              )}
              {!m.locked && m.pence !== null && (
                <p className={`text-base font-black mt-2 ${g.text}`}>{fmtGBP(m.pence, true)}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Relevant milestone status */}
      {milestones.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-2">Live roadmap gates</p>
          <div className="flex flex-wrap gap-2">
            {milestones
              .filter(m => ['nhs_pilot', 'scale'].includes(m.phase) || m.category === 'fundraising' || m.category === 'commercial')
              .slice(0, 8)
              .map(m => (
                <div key={m.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono border ${
                  m.status === 'complete'    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' :
                  m.status === 'in_progress' ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' :
                  'bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-600'
                }`}>
                  <span>{m.status === 'complete' ? '✓' : m.status === 'in_progress' ? '→' : '○'}</span>
                  <span className="truncate max-w-[160px]">{m.title}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Method Card ───────────────────────────────────────────────────────────────

function MethodCard({ method, onEdit }: { method: MethodResult; onEdit: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const g = GATE_COLOURS[method.gateStatus];

  const rangeWidth = (method.pence && method.low && method.high && method.high > 0)
    ? Math.min(100, Math.round(((method.pence - method.low) / (method.high - method.low || 1)) * 100))
    : 50;

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      method.locked
        ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 opacity-60'
        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-700'
    }`}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${CATEGORY_BADGE[method.category]}`}>
                {method.category}
              </span>
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                method.locked
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-800'
                  : method.gateStatus === 'in_progress'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              }`}>
                {method.locked ? 'LOCKED' : method.gateStatus === 'in_progress' ? 'IN PROGRESS' : 'UNLOCKED'}
              </span>
            </div>
            <p className={`text-sm font-bold ${method.locked ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>{method.name}</p>
          </div>
          {!method.locked && (
            <button type="button" onClick={onEdit}
              className="shrink-0 px-2.5 py-1 text-[10px] font-mono rounded-lg border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-600 transition-colors">
              Edit inputs
            </button>
          )}
        </div>

        {/* Valuation output */}
        {method.locked ? (
          <div className="bg-slate-100/60 dark:bg-slate-800/40 rounded-xl px-4 py-3 mb-3">
            <p className="text-xs font-mono text-slate-600">{method.lockReason}</p>
            <p className={`text-[10px] font-mono mt-1 ${g.text}`}>{method.gateLabel}</p>
          </div>
        ) : (
          <div className="mb-3">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-black text-amber-400">{method.pence !== null ? fmtGBP(method.pence, true) : '—'}</span>
              {method.low !== null && method.high !== null && (
                <span className="text-xs font-mono text-slate-500">
                  {fmtGBP(method.low, true)} – {fmtGBP(method.high, true)}
                </span>
              )}
            </div>
            {/* Range bar */}
            {method.low !== null && method.high !== null && method.pence !== null && (
              <div className="relative h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                <div
                  className="absolute top-0 bottom-0 bg-amber-500/30 rounded-full"
                  style={{ left: '0%', right: '0%' }}
                />
                <div
                  className="absolute top-0 w-2.5 h-1.5 bg-amber-400 rounded-full -translate-x-1/2"
                  style={{ left: `${rangeWidth}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Key inputs chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {method.keyInputs.map((inp, i) => (
            <span key={i} className="px-2 py-0.5 rounded text-[9px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-800">
              {inp}
            </span>
          ))}
        </div>

        {/* Expandable methodology */}
        <button type="button" onClick={() => setExpanded(v => !v)}
          className="text-[10px] font-mono text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1">
          <svg className={`w-3 h-3 transition-transform ${expanded ? '' : '-rotate-90'}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
          Methodology
        </button>
        {expanded && (
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{method.methodology}</p>
        )}
      </div>
    </div>
  );
}

// ── Input panel (slide-in) ────────────────────────────────────────────────────

type EditingMethod = 'berkus' | 'scorecard' | 'arr' | 'vc' | 'comp' | 'dcf' | 'nhs';

function SlidePanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur-md">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="4" y1="4" x2="14" y2="14"/><line x1="14" y1="4" x2="4" y2="14"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 px-6 py-5">{children}</div>
      </aside>
    </>
  );
}

const inputCls  = 'w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50';
const labelCls  = 'block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5';

function ScoreSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const pct   = Math.round((value / 2) * 100);
  const color = value < 0.7 ? 'text-red-400' : value < 1.2 ? 'text-amber-400' : 'text-emerald-400';
  const desc  = value < 0.5 ? 'Well below avg' : value < 0.8 ? 'Below avg' : value < 1.2 ? 'Average' : value < 1.6 ? 'Above avg' : 'Exceptional';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className={labelCls}>{label}</label>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-black font-mono ${color}`}>{value.toFixed(2)}×</span>
          <span className="text-[9px] font-mono text-slate-600">{desc}</span>
        </div>
      </div>
      <input
        type="range" min="0" max="2" step="0.05"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-amber-500"
      />
      <div className="flex justify-between text-[9px] font-mono text-slate-700">
        <span>0× (None)</span><span>1× (Avg)</span><span>2× (Best)</span>
      </div>
    </div>
  );
}

function BerkusSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const MAX = 50_000_000; // £500k
  const pct = Math.round((value / MAX) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className={labelCls}>{label}</label>
        <span className="text-xs font-black font-mono text-amber-400">{fmtGBP(value, true)}</span>
      </div>
      <input
        type="range" min="0" max={MAX} step={500_000}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-amber-500"
      />
      <div className="flex justify-between text-[9px] font-mono text-slate-700">
        <span>£0</span><span>£250k</span><span>£500k</span>
      </div>
    </div>
  );
}

function EditPanel({ method, cfg, onChange, onSave, saving }: {
  method: EditingMethod;
  cfg: ValuationConfig;
  onChange: (updates: Partial<ValuationConfig>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  function field(key: keyof ValuationConfig, val: unknown) {
    onChange({ [key]: val } as Partial<ValuationConfig>);
  }
  function poundsField(key: keyof ValuationConfig, val: string) {
    field(key, parsePounds(val));
  }

  if (method === 'berkus') return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">Assign up to £500k for each risk reduction factor. Total maximum: £2.5m (pre-revenue).</p>
      <BerkusSlider label="1. Sound / Unique Business Idea" value={cfg.berkus_sound_idea}        onChange={v => field('berkus_sound_idea',        v)} />
      <BerkusSlider label="2. Working Prototype / IP"       value={cfg.berkus_prototype}          onChange={v => field('berkus_prototype',          v)} />
      <BerkusSlider label="3. Quality Management Team"      value={cfg.berkus_management_team}    onChange={v => field('berkus_management_team',    v)} />
      <BerkusSlider label="4. Strategic Relationships"      value={cfg.berkus_strategic_rel}      onChange={v => field('berkus_strategic_rel',      v)} />
      <BerkusSlider label="5. Product Rollout / Sales"      value={cfg.berkus_product_rollout}    onChange={v => field('berkus_product_rollout',    v)} />
      <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
        <p className="text-xs font-mono text-slate-400">Total: <span className="font-black text-amber-400">{fmtGBP(computeBerkus(cfg))}</span></p>
      </div>
    </div>
  );

  if (method === 'scorecard') return (
    <div className="space-y-5">
      <div>
        <label className={labelCls}>UK Pre-seed Median (£)</label>
        <input type="number" className={inputCls} value={poundsStr(cfg.scorecard_median_pence)} onChange={e => poundsField('scorecard_median_pence', e.target.value)} />
        <p className="text-[10px] font-mono text-slate-600 mt-1">UK typical: £1.0m–£2.0m. Current: {fmtGBP(cfg.scorecard_median_pence)}</p>
      </div>
      <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide">Weighted factor scores (0–2×)</p>
        <ScoreSlider label="Team Strength (30%)"               value={cfg.scorecard_team}             onChange={v => field('scorecard_team',             v)} />
        <ScoreSlider label="Market Size (25%)"                 value={cfg.scorecard_market_size}      onChange={v => field('scorecard_market_size',      v)} />
        <ScoreSlider label="Product / IP (15%)"                value={cfg.scorecard_product_tech}     onChange={v => field('scorecard_product_tech',     v)} />
        <ScoreSlider label="Competitive Environment (10%)"     value={cfg.scorecard_competition}      onChange={v => field('scorecard_competition',      v)} />
        <ScoreSlider label="Marketing / Sales (10%)"           value={cfg.scorecard_marketing}        onChange={v => field('scorecard_marketing',        v)} />
        <ScoreSlider label="Need for Investment (5%)"          value={cfg.scorecard_investment_need}  onChange={v => field('scorecard_investment_need',  v)} />
        <ScoreSlider label="Other Factors (5%)"                value={cfg.scorecard_other}            onChange={v => field('scorecard_other',            v)} />
      </div>
      <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
        <p className="text-xs font-mono text-slate-400">Result: <span className="font-black text-amber-400">{fmtGBP(computeScorecard(cfg))}</span></p>
      </div>
    </div>
  );

  if (method === 'arr') return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Revenue multiple applied to Annual Recurring Revenue. Healthtech/AI SaaS early-stage: typically 5–12×.</p>
      <div>
        <label className={labelCls}>ARR Multiple</label>
        <input type="number" min="1" max="30" step="0.5" className={inputCls} value={cfg.arr_multiple} onChange={e => field('arr_multiple', parseFloat(e.target.value) || 7)} />
      </div>
      <div className="bg-slate-800/50 rounded-xl px-4 py-3 text-xs font-mono text-slate-400 space-y-1">
        <div className="flex justify-between"><span>Current MRR</span><span className="text-slate-900 dark:text-white">{fmtGBP(cfg.arr_multiple * 0)}</span></div>
        <p className="text-[10px] text-slate-600">ARR Multiple method unlocks automatically when MRR {'>'} £0</p>
      </div>
    </div>
  );

  if (method === 'vc') return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Works backward from a target exit to derive today's pre-money valuation using required VC return (IRR).</p>
      <div>
        <label className={labelCls}>Expected Exit Valuation (£)</label>
        <input type="number" className={inputCls} value={poundsStr(cfg.vc_exit_valuation_pence)} onChange={e => poundsField('vc_exit_valuation_pence', e.target.value)} />
        <p className="text-[10px] font-mono text-slate-600 mt-1">Current: {fmtGBP(cfg.vc_exit_valuation_pence)}</p>
      </div>
      <div>
        <label className={labelCls}>Round Size / Investment (£)</label>
        <input type="number" className={inputCls} value={poundsStr(cfg.vc_investment_pence)} onChange={e => poundsField('vc_investment_pence', e.target.value)} />
        <p className="text-[10px] font-mono text-slate-600 mt-1">Current: {fmtGBP(cfg.vc_investment_pence)}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Years to Exit</label>
          <input type="number" min="1" max="15" className={inputCls} value={cfg.vc_years_to_exit} onChange={e => field('vc_years_to_exit', parseInt(e.target.value) || 5)} />
        </div>
        <div>
          <label className={labelCls}>Required IRR (%)</label>
          <input type="number" min="10" max="100" className={inputCls} value={cfg.vc_required_irr} onChange={e => field('vc_required_irr', parseFloat(e.target.value) || 40)} />
        </div>
      </div>
      <div className="bg-slate-800/50 rounded-xl px-4 py-3 text-xs font-mono text-slate-400 space-y-1">
        <div className="flex justify-between"><span>Post-money today</span><span className="text-sky-400">{fmtGBP(Math.round(cfg.vc_exit_valuation_pence / ((1 + cfg.vc_required_irr / 100) ** cfg.vc_years_to_exit)))}</span></div>
        <div className="flex justify-between"><span>Pre-money today</span><span className="text-amber-400 font-black">{fmtGBP(computeVC(cfg))}</span></div>
      </div>
    </div>
  );

  if (method === 'comp') return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Based on comparable healthtech/AI company transaction multiples. Applies ARR range when revenue exists, or pre-revenue baseline.</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>ARR Multiple Low</label>
          <input type="number" min="1" max="30" step="0.5" className={inputCls} value={cfg.comp_arr_multiple_low} onChange={e => field('comp_arr_multiple_low', parseFloat(e.target.value) || 5)} />
        </div>
        <div>
          <label className={labelCls}>ARR Multiple High</label>
          <input type="number" min="1" max="50" step="0.5" className={inputCls} value={cfg.comp_arr_multiple_high} onChange={e => field('comp_arr_multiple_high', parseFloat(e.target.value) || 12)} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Pre-Revenue Baseline (£)</label>
        <input type="number" className={inputCls} value={poundsStr(cfg.comp_baseline_pence)} onChange={e => poundsField('comp_baseline_pence', e.target.value)} />
        <p className="text-[10px] font-mono text-slate-600 mt-1">Used when MRR = £0. Current: {fmtGBP(cfg.comp_baseline_pence)}</p>
      </div>
      <div>
        <label className={labelCls}>Traction Premium (%)</label>
        <input type="number" min="0" max="200" className={inputCls} value={cfg.comp_traction_premium_pct} onChange={e => field('comp_traction_premium_pct', parseFloat(e.target.value) || 0)} />
        <p className="text-[10px] font-mono text-slate-600 mt-1">Additional % premium for user traction, IP, waitlist</p>
      </div>
      <div className="bg-slate-100/60 dark:bg-slate-800/40 rounded-xl px-4 py-3 text-[10px] font-mono text-slate-500 space-y-1">
        <p className="font-bold text-slate-400 mb-1">Reference comps</p>
        {[
          { name: 'Livi/Kry (digital health)',   val: '~£500m Ser.C' },
          { name: 'Brightside (mental health AI)', val: '$55m Ser.B' },
          { name: 'Nuance (speech AI — acquired)', val: '$19.7bn MS' },
          { name: 'SpeechPathology.com',           val: 'private' },
        ].map(c => (
          <div key={c.name} className="flex justify-between">
            <span>{c.name}</span><span className="text-slate-400">{c.val}</span>
          </div>
        ))}
      </div>
    </div>
  );

  if (method === 'dcf') return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">3-year discounted cash flow with terminal value. Unlocked by NHS Pilot milestone progress.</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Year 1 Revenue (£)</label>
          <input type="number" className={inputCls} value={poundsStr(cfg.dcf_year1_revenue_pence)} onChange={e => poundsField('dcf_year1_revenue_pence', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Year 2 Revenue (£)</label>
          <input type="number" className={inputCls} value={poundsStr(cfg.dcf_year2_revenue_pence)} onChange={e => poundsField('dcf_year2_revenue_pence', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Year 3 Revenue (£)</label>
          <input type="number" className={inputCls} value={poundsStr(cfg.dcf_year3_revenue_pence)} onChange={e => poundsField('dcf_year3_revenue_pence', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Discount Rate (%)</label>
          <input type="number" min="10" max="80" className={inputCls} value={cfg.dcf_discount_rate} onChange={e => field('dcf_discount_rate', parseFloat(e.target.value) || 35)} />
          <p className="text-[10px] font-mono text-slate-600 mt-1">Early-stage: 30–50%</p>
        </div>
        <div>
          <label className={labelCls}>Terminal Multiple (×)</label>
          <input type="number" min="1" max="20" step="0.5" className={inputCls} value={cfg.dcf_terminal_multiple} onChange={e => field('dcf_terminal_multiple', parseFloat(e.target.value) || 4)} />
        </div>
      </div>
      {(cfg.dcf_year3_revenue_pence > 0) && (
        <div className="bg-slate-800/50 rounded-xl px-4 py-3 text-xs font-mono text-slate-400">
          <div className="flex justify-between"><span>DCF valuation</span><span className="text-amber-400 font-black">{fmtGBP(computeDCF(cfg))}</span></div>
        </div>
      )}
    </div>
  );

  if (method === 'nhs') return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Values the company on probability-weighted NHS contract total contract value. Unlocks when NHS pipeline milestone is active.</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>ICB Count</label>
          <input type="number" min="1" max="42" className={inputCls} value={cfg.nhs_icb_count} onChange={e => field('nhs_icb_count', parseInt(e.target.value) || 3)} />
          <p className="text-[10px] font-mono text-slate-600 mt-1">42 ICBs in England</p>
        </div>
        <div>
          <label className={labelCls}>Patients per ICB</label>
          <input type="number" min="100" max="10000" className={inputCls} value={cfg.nhs_patients_per_icb} onChange={e => field('nhs_patients_per_icb', parseInt(e.target.value) || 500)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Price / Patient / Year (£)</label>
          <input type="number" min="100" className={inputCls} value={poundsStr(cfg.nhs_price_per_patient_pence)} onChange={e => poundsField('nhs_price_per_patient_pence', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Probability (%)</label>
          <input type="number" min="1" max="100" className={inputCls} value={cfg.nhs_probability_pct} onChange={e => field('nhs_probability_pct', parseFloat(e.target.value) || 25)} />
        </div>
      </div>
      {(() => {
        const r = computeNHS(cfg);
        return (
          <div className="bg-slate-800/50 rounded-xl px-4 py-3 text-xs font-mono text-slate-400 space-y-1">
            <div className="flex justify-between"><span>Gross contract value</span><span>{fmtGBP(r.gross)}</span></div>
            <div className="flex justify-between"><span>Probability-weighted</span><span className="text-amber-400 font-black">{fmtGBP(r.val)}</span></div>
          </div>
        );
      })()}
    </div>
  );

  return null;
}

// ── Business Plan + Supporting Documents ─────────────────────────────────────
//
// Inline investment memo that contextualises the valuation numbers. Surfaces:
//   - Financial projections that feed the DCF + ARR methods
//   - Market opportunity breakdown (NHS / private / international)
//   - Business model & use of funds
//   - Quick link to the pitch deck invite system
//
// Deliberately static — the numbers here should mirror the DCF inputs above.
// When you update DCF projections, update this section too.

const BP_MARKET_ROWS = [
  { segment: 'NHS / ICB contracts',     tam: '£840m',  sam: '£42m',   som: '£3m',   note: '42 ICBs · est. 750 SLT patients/ICB · £600/yr' },
  { segment: 'UK private SLT',          tam: '£320m',  sam: '£64m',   som: '£6m',   note: 'Private practice, waiting-list overflow' },
  { segment: 'Consumer self-help (UK)',  tam: '£180m',  sam: '£36m',   som: '£3m',   note: 'Direct B2C, SEIS-eligible founders tier' },
  { segment: 'International (EU / US)', tam: '£2.1bn', sam: '£210m',  som: '£12m',  note: '5-yr expansion; US insurance reimbursement path' },
];

const BP_PROJECTIONS = [
  { year: 'FY1 (2026)', revenue: '£120k', arr: '£120k',  users: '20–50',   driver: 'Founding members + NHS pilot (1 ICB)' },
  { year: 'FY2 (2027)', revenue: '£480k', arr: '£480k',  users: '200–400', driver: '3 ICBs + consumer launch + SLP portal' },
  { year: 'FY3 (2028)', revenue: '£1.5m', arr: '£1.5m+', users: '1,000+',  driver: '5 ICBs + private referrals + international seed' },
];

const BP_USE_OF_FUNDS = [
  { area: 'Clinical validation & NHS pilot',  pct: 35, color: 'bg-sky-500' },
  { area: 'Product & AI engineering',         pct: 30, color: 'bg-violet-500' },
  { area: 'Regulatory (CE/UKCA) & compliance',pct: 15, color: 'bg-amber-500' },
  { area: 'Sales & market access',            pct: 12, color: 'bg-emerald-500' },
  { area: 'Operations & legal',               pct:  8, color: 'bg-rose-500' },
];

function BusinessPlanSection() {
  const [tab, setTab] = useState<'projections' | 'market' | 'funds' | 'model'>('projections');

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Business Plan &amp; Investment Memo</h3>
          <p className="text-[11px] font-mono text-slate-500 mt-0.5">Financial projections, market sizing and use of funds — supplementing the valuation above</p>
        </div>
        <a
          href="/admin/pitch-deck"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-mono font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors"
        >
          📊 Pitch Deck →
        </a>
      </div>

      {/* Tab nav */}
      <div className="flex gap-0.5 px-5 pt-3 pb-0 border-b border-slate-200 dark:border-slate-800">
        {([
          ['projections', '📈 Projections'],
          ['market',      '🌍 Market'],
          ['funds',       '💰 Use of Funds'],
          ['model',       '⚙️ Business Model'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              'px-3 py-2 text-xs font-mono font-semibold rounded-t-lg border-b-2 -mb-px transition-all',
              tab === id
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-300',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-5">

        {/* ── Projections ─────────────────────────────────────────────────── */}
        {tab === 'projections' && (
          <div className="space-y-4">
            <p className="text-[11px] font-mono text-slate-500">
              3-year revenue projections feeding the DCF method. Conservative estimates based on NHS pilot pathway and founding member subscription model.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    {['Year', 'Revenue', 'ARR', 'Users', 'Key Driver'].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {BP_PROJECTIONS.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-3 font-mono font-bold text-slate-300 whitespace-nowrap">{r.year}</td>
                      <td className="px-3 py-3 font-mono font-black text-amber-400">{r.revenue}</td>
                      <td className="px-3 py-3 font-mono text-slate-400">{r.arr}</td>
                      <td className="px-3 py-3 font-mono text-slate-400">{r.users}</td>
                      <td className="px-3 py-3 text-slate-500">{r.driver}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {[
                { label: 'Gross Margin Target', value: '82%', note: 'SaaS + NHS B2B' },
                { label: 'Payback Period', value: '<12mo', note: 'NHS contract basis' },
                { label: 'Churn Target', value: '<8% yr', note: 'Clinical stickiness' },
                { label: 'LTV/CAC Target', value: '4×+', note: 'At 24-month LTV' },
              ].map(m => (
                <div key={m.label} className="bg-slate-800/40 rounded-xl p-3">
                  <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">{m.label}</p>
                  <p className="text-xl font-black text-white mt-0.5">{m.value}</p>
                  <p className="text-[9px] font-mono text-slate-600">{m.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Market ──────────────────────────────────────────────────────── */}
        {tab === 'market' && (
          <div className="space-y-4">
            <p className="text-[11px] font-mono text-slate-500">
              Total Addressable Market for AI-assisted speech therapy across NHS, private, and consumer channels.
              SOM = Serviceable Obtainable Market at Year 3 (FY2028).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    {['Segment', 'TAM', 'SAM', 'SOM (Yr3)', 'Notes'].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {BP_MARKET_ROWS.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-3 font-semibold text-slate-300 whitespace-nowrap">{r.segment}</td>
                      <td className="px-3 py-3 font-mono font-black text-slate-300">{r.tam}</td>
                      <td className="px-3 py-3 font-mono text-sky-400">{r.sam}</td>
                      <td className="px-3 py-3 font-mono font-bold text-amber-400">{r.som}</td>
                      <td className="px-3 py-3 text-[10px] text-slate-600">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-700">
                    <td className="px-3 py-3 font-bold text-slate-300 text-[11px]">Total</td>
                    <td className="px-3 py-3 font-mono font-black text-white">£3.44bn</td>
                    <td className="px-3 py-3 font-mono font-black text-sky-300">£352m</td>
                    <td className="px-3 py-3 font-mono font-black text-amber-400">£24m</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="bg-slate-800/40 rounded-xl p-4 text-[11px] font-mono text-slate-400 leading-relaxed">
              <span className="text-amber-400 font-bold">Comparable exits:</span>{' '}
              Nuance Communications (speech AI) — $19.7bn acquisition by Microsoft.
              Livi/Kry (digital health) — £500m+ Series C.
              Brightside Health (mental health AI) — $55m Series B.
              UK healthtech M&A activity up 34% YoY (2025 data).
            </div>
          </div>
        )}

        {/* ── Use of Funds ─────────────────────────────────────────────────── */}
        {tab === 'funds' && (
          <div className="space-y-4">
            <p className="text-[11px] font-mono text-slate-500">
              Pre-seed round allocation. Capital deployed to de-risk NHS pathway and build clinical evidence base.
            </p>
            <div className="space-y-2.5">
              {BP_USE_OF_FUNDS.map(f => (
                <div key={f.area}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-300 font-mono">{f.area}</span>
                    <span className="text-xs font-black text-slate-300 font-mono">{f.pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${f.color} opacity-80 transition-all duration-500`} style={{ width: `${f.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-slate-800/40 rounded-xl p-4">
                <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">Round Size</p>
                <p className="text-2xl font-black text-white">£250k</p>
                <p className="text-[10px] font-mono text-slate-500 mt-0.5">Pre-seed · SEIS eligible</p>
              </div>
              <div className="bg-slate-800/40 rounded-xl p-4">
                <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">Runway</p>
                <p className="text-2xl font-black text-white">18 mo</p>
                <p className="text-[10px] font-mono text-slate-500 mt-0.5">To first NHS contract close</p>
              </div>
            </div>
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 text-[11px] font-mono text-amber-300/80">
              <span className="font-bold">SEIS eligibility:</span> Flowen Technologies Ltd qualifies for SEIS (Seed Enterprise Investment Scheme) —
              investors benefit from 50% income tax relief + CGT exemption on qualifying shares.
            </div>
          </div>
        )}

        {/* ── Business Model ────────────────────────────────────────────────── */}
        {tab === 'model' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  tier: 'B2B NHS / ICB',
                  price: '£600/patient/yr',
                  margin: '88%',
                  notes: 'Annual contract, per-patient SaaS. Procurement via ICB digital transformation budgets. DSPT-aligned.',
                  color: 'border-sky-500/30 bg-sky-500/5',
                  badge: 'bg-sky-500/15 text-sky-400',
                },
                {
                  tier: 'Founding Member',
                  price: '£19.96–£35.96/mo',
                  margin: '91%',
                  notes: 'Early adopter founding tier — locked pricing for life. Annual billing preferred. No churn incentive.',
                  color: 'border-amber-500/30 bg-amber-500/5',
                  badge: 'bg-amber-500/15 text-amber-400',
                },
                {
                  tier: 'SLP / Clinician Portal',
                  price: '£49/mo per SLP',
                  margin: '85%',
                  notes: 'Caseload management, progress reports, DM. Bundled into NHS contracts or sold direct to private practice.',
                  color: 'border-violet-500/30 bg-violet-500/5',
                  badge: 'bg-violet-500/15 text-violet-400',
                },
              ].map(t => (
                <div key={t.tier} className={`rounded-xl border p-4 ${t.color}`}>
                  <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold mb-2 ${t.badge}`}>{t.tier}</span>
                  <p className="text-base font-black text-white mb-1">{t.price}</p>
                  <p className="text-[10px] font-mono text-slate-500 mb-2">Gross margin: <span className="text-emerald-400 font-bold">{t.margin}</span></p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{t.notes}</p>
                </div>
              ))}
            </div>
            <div className="bg-slate-800/40 rounded-xl p-4 text-[11px] font-mono text-slate-400 leading-relaxed space-y-2">
              <p><span className="text-white font-bold">Regulatory path:</span> UKCA Medical Device registration (Class I SaMD) in progress. CE mark for EU expansion. DSPT compliance for NHS data access.</p>
              <p><span className="text-white font-bold">Moat:</span> Proprietary stuttering ASR training dataset (not publicly available). Clinical validation evidence. NHS procurement relationships. SEIS status limits competing clones.</p>
              <p><span className="text-white font-bold">Exit scenarios:</span> Strategic acquisition (NHS supplier, speech tech group, mental health platform) · Series A with NHS anchor contract · NHS Pathways programme listing.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Snapshot history ──────────────────────────────────────────────────────────

function SnapshotHistory({ snapshots, onDelete }: {
  snapshots: ValuationSnapshot[];
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (snapshots.length === 0) return (
    <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
      <p className="text-sm text-slate-600 font-mono">No snapshots saved yet</p>
      <p className="text-xs text-slate-700 font-mono mt-1">Save a snapshot above to track valuation over time</p>
    </div>
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800">
            <th className="text-left px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Date</th>
            <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Label</th>
            <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 hidden sm:table-cell">Low</th>
            <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Mid</th>
            <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 hidden md:table-cell">High</th>
            <th className="text-right px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {snapshots.map(s => (
            <React.Fragment key={s.id}>
              <tr className="hover:bg-slate-800/40 transition-colors group">
                <td className="px-5 py-3.5 text-[11px] font-mono text-slate-500 whitespace-nowrap">
                  {new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3.5 text-sm font-semibold text-slate-900 dark:text-white">{s.label}</td>
                <td className="px-4 py-3.5 text-xs font-mono text-slate-500 hidden sm:table-cell">{fmtGBP(s.low_pence, true)}</td>
                <td className="px-4 py-3.5 text-sm font-black text-amber-400">{fmtGBP(s.mid_pence, true)}</td>
                <td className="px-4 py-3.5 text-xs font-mono text-slate-500 hidden md:table-cell">{fmtGBP(s.high_pence, true)}</td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => setExpanded(id => id === s.id ? null : s.id)}
                      className="px-2.5 py-1 text-[10px] font-mono rounded-lg border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                      {expanded === s.id ? 'Hide' : 'View'}
                    </button>
                    <button type="button" onClick={() => onDelete(s.id)}
                      className="px-2 py-1 text-[10px] font-mono rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 hover:text-red-400 hover:border-red-800/50 transition-colors">
                      ×
                    </button>
                  </div>
                </td>
              </tr>
              {expanded === s.id && (
                <tr>
                  <td colSpan={6} className="px-5 py-4 bg-slate-100 dark:bg-slate-950/60">
                    <div className="flex flex-wrap gap-3 mb-2">
                      {Object.entries(s.method_outputs).map(([k, v]) => (
                        <div key={k} className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg">
                          <span className="text-slate-500">{k}: </span>
                          <span className="text-amber-400 font-bold">{fmtGBP(v, true)}</span>
                        </div>
                      ))}
                    </div>
                    {s.note && <p className="text-xs text-slate-500 italic">{s.note}</p>}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Save snapshot modal ───────────────────────────────────────────────────────

function SnapshotModal({ consensus, methods, kpis, onSave, onClose }: {
  consensus: ReturnType<typeof computeConsensus>;
  methods: MethodResult[];
  kpis: LiveKpis;
  onSave: (label: string, note: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(`Flowen Valuation — ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`);
  const [note, setNote]   = useState('');

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Save Valuation Snapshot</h3>
          <p className="text-xs text-slate-500 mb-5">Records current method outputs and consensus range for tracking over time.</p>

          <div className="grid grid-cols-3 gap-3 mb-5">
            {[{ l: 'Conservative', v: consensus.low }, { l: 'Mid-Point', v: consensus.mid }, { l: 'Optimistic', v: consensus.high }].map(x => (
              <div key={x.l} className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-center">
                <p className="text-[9px] font-mono text-slate-500 mb-1">{x.l}</p>
                <p className="text-lg font-black text-amber-400">{fmtGBP(x.v, true)}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelCls}>Label *</label>
              <input value={label} onChange={e => setLabel(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Note (optional)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Context, round stage, key milestones..." className={`${inputCls} resize-none`} />
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button type="button" onClick={() => onSave(label, note)} disabled={!label}
              className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors disabled:opacity-40">
              Save Snapshot
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

interface Props {
  initialConfig:    ValuationConfig | null;
  initialSnapshots: ValuationSnapshot[];
  initialKpis:      LiveKpis;
  initialMilestones: RoadmapStatus[];
}

export default function ValuationClient({ initialConfig, initialSnapshots, initialKpis, initialMilestones }: Props) {
  const [cfg,       setCfg]       = useState<ValuationConfig>(initialConfig ?? defaultConfig());
  const [snapshots, setSnapshots] = useState<ValuationSnapshot[]>(initialSnapshots);
  const [editMethod, setEditMethod] = useState<EditingMethod | null>(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  function showToast(msg: string, kind: 'success' | 'error') {
    setToast({ message: msg, kind });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Live computation ───────────────────────────────────────────────────────

  const methods   = useMemo(() => buildMethods(cfg, initialKpis, initialMilestones), [cfg, initialKpis, initialMilestones]);
  const consensus = useMemo(() => computeConsensus(methods), [methods]);

  // ── Config persistence ─────────────────────────────────────────────────────

  async function saveConfig() {
    setSaving(true);
    const res = await apiPost({ action: 'save_config', ...cfg });
    setSaving(false);
    if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
    if (res.config) setCfg(res.config);
    if (editMethod) setEditMethod(null);
    showToast('Valuation inputs saved', 'success');
  }

  // ── Snapshot ───────────────────────────────────────────────────────────────

  async function saveSnapshot(label: string, note: string) {
    const methodOutputs: Record<string, number> = {};
    methods.forEach(m => { if (m.pence !== null) methodOutputs[m.shortName] = m.pence; });

    const res = await apiPost({
      action:         'save_snapshot',
      label,
      low_pence:      consensus.low,
      mid_pence:      consensus.mid,
      high_pence:     consensus.high,
      method_outputs: methodOutputs,
      mrr_pence:      initialKpis.mrrPence,
      total_users:    initialKpis.totalUsers,
      note: note || null,
    });
    if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
    setSnapshots(prev => [res.snapshot!, ...prev]);
    setShowSnapshotModal(false);
    showToast('Snapshot saved', 'success');
  }

  async function deleteSnapshot(id: string) {
    startTransition(async () => {
      const res = await apiPost({ action: 'delete_snapshot', id });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      setSnapshots(prev => prev.filter(s => s.id !== id));
    });
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} kind={toast.kind} />}

      {/* Consensus hero */}
      <ConsensusHero
        consensus={consensus}
        methods={methods}
        kpis={initialKpis}
        onSnapshot={() => setShowSnapshotModal(true)}
      />

      {/* Milestone unlock track */}
      <MilestoneUnlockTrack methods={methods} milestones={initialMilestones} />

      {/* Business Plan + Supporting Documents */}
      <BusinessPlanSection />

      {/* Method grid */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Valuation Methods</h3>
          <button type="button" onClick={saveConfig} disabled={saving}
            className="px-4 py-2 text-xs font-mono font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <span className="inline-block w-3 h-3 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />}
            {saving ? 'Saving…' : 'Save all inputs'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {methods.map(m => (
            <MethodCard key={m.id} method={m} onEdit={() => setEditMethod(m.id as EditingMethod)} />
          ))}
        </div>
      </div>

      {/* Snapshot history */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Valuation History</h3>
        <SnapshotHistory snapshots={snapshots} onDelete={deleteSnapshot} />
      </div>

      {/* Edit slide panel */}
      {editMethod && (
        <SlidePanel
          title={methods.find(m => m.id === editMethod)?.name ?? 'Edit Inputs'}
          onClose={() => setEditMethod(null)}
        >
          <EditPanel
            method={editMethod}
            cfg={cfg}
            onChange={updates => setCfg(prev => ({ ...prev, ...updates }))}
            onSave={saveConfig}
            saving={saving}
          />
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={saveConfig} disabled={saving}
              className="w-full py-2.5 text-sm font-mono font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Save inputs'}
            </button>
          </div>
        </SlidePanel>
      )}

      {/* Snapshot modal */}
      {showSnapshotModal && (
        <SnapshotModal
          consensus={consensus}
          methods={methods}
          kpis={initialKpis}
          onSave={saveSnapshot}
          onClose={() => setShowSnapshotModal(false)}
        />
      )}
    </div>
  );
}
