'use client';

import React, { useState, useTransition, useCallback, useRef } from 'react';
import type { ComplianceItem } from './page';

// ── Types ─────────────────────────────────────────────────────────────────────

type Status =
  | 'not_started'
  | 'in_progress'
  | 'complete'
  | 'not_applicable'
  | 'blocked';

type Framework = 'dcb0129' | 'dtac' | 'dspt' | 'mhra' | 'wcag';

interface FrameworkItemDef {
  code: string;
  title: string;
  desc: string;
}

interface MergedItem extends FrameworkItemDef {
  framework: Framework;
  status: Status;
  notes: string | null;
  evidence_url: string | null;
  updated_at: string | null;
}

// ── Framework definitions (static) ───────────────────────────────────────────

const DCB0129_ITEMS: FrameworkItemDef[] = [
  {
    code: 'dcb0129_01',
    title: 'Clinical Safety Officer Appointed',
    desc: 'A qualified CSO (clinical background, relevant experience) must be formally appointed and documented.',
  },
  {
    code: 'dcb0129_02',
    title: 'Clinical Safety Management System (CSMS) Established',
    desc: 'Documented system for managing clinical risk throughout the software lifecycle.',
  },
  {
    code: 'dcb0129_03',
    title: 'Hazard Log Created',
    desc: 'All potential clinical hazards identified, assessed for severity and likelihood, and logged.',
  },
  {
    code: 'dcb0129_04',
    title: 'Clinical Risk Assessment Completed',
    desc: 'Formal assessment of each hazard with risk scoring (severity × likelihood) and mitigations.',
  },
  {
    code: 'dcb0129_05',
    title: 'Clinical Safety Case (Initial) Issued',
    desc: 'Initial safety case document demonstrating the software is acceptably safe for deployment.',
  },
  {
    code: 'dcb0129_06',
    title: 'Clinical Safety Case Report Issued',
    desc: 'Full report submitted to procuring NHS organisation before go-live.',
  },
  {
    code: 'dcb0129_07',
    title: 'In-Service Monitoring Plan',
    desc: 'Post-deployment monitoring strategy to detect adverse events and near-misses.',
  },
  {
    code: 'dcb0129_08',
    title: 'Annual Review Scheduled',
    desc: 'Recurring annual review of the safety case and hazard log.',
  },
];

const DTAC_ITEMS: FrameworkItemDef[] = [
  {
    code: 'dtac_01',
    title: 'Clinical Safety',
    desc: 'Evidence of DCB0129 compliance or equivalent clinical safety standard adherence.',
  },
  {
    code: 'dtac_02',
    title: 'Data Protection',
    desc: 'UK GDPR compliance, Data Protection Impact Assessment (DPIA) completed, ICO registration.',
  },
  {
    code: 'dtac_03',
    title: 'Technical Security',
    desc: 'Penetration test (CREST/NCSC CHECK), vulnerability management, ISO 27001 or Cyber Essentials Plus.',
  },
  {
    code: 'dtac_04',
    title: 'Interoperability',
    desc: 'FHIR R4 / HL7 support, structured data exchange capability, API documentation.',
  },
  {
    code: 'dtac_05',
    title: 'Usability & Accessibility',
    desc: 'User research evidence, usability testing with intended users, WCAG 2.1 AA compliance.',
  },
  {
    code: 'dtac_06',
    title: 'Equality & Health Inequalities',
    desc: 'Equality Impact Assessment, evidence product does not worsen health inequalities.',
  },
  {
    code: 'dtac_07',
    title: 'Sustainability',
    desc: 'Environmental impact assessment, carbon footprint consideration in design.',
  },
  {
    code: 'dtac_08',
    title: 'Procurement',
    desc: 'Appropriate procurement route used (G-Cloud, NHS frameworks, compliant direct award).',
  },
  {
    code: 'dtac_09',
    title: 'AI Transparency',
    desc: 'AI Governance Framework compliance, explainability documentation, bias testing.',
  },
  {
    code: 'dtac_10',
    title: 'Commercial Viability',
    desc: 'Financial robustness evidence, business continuity plan, exit/transition plan.',
  },
];

const DSPT_ITEMS: FrameworkItemDef[] = [
  {
    code: 'dspt_01',
    title: 'People: Policies & Procedures',
    desc: 'Data security policies published, annual mandatory training completed by all staff.',
  },
  {
    code: 'dspt_02',
    title: 'People: Training',
    desc: '100% staff completion of NHS Data Security Awareness training (Level 1).',
  },
  {
    code: 'dspt_03',
    title: 'People: Staff Responsibilities',
    desc: 'Clear roles and responsibilities for data security defined and communicated.',
  },
  {
    code: 'dspt_04',
    title: 'Data: GDPR Compliance',
    desc: 'Data Protection Officer appointed, Records of Processing Activities (ROPA) maintained.',
  },
  {
    code: 'dspt_05',
    title: 'Data: Confidential Data Identified',
    desc: 'All personal confidential data flows mapped and documented.',
  },
  {
    code: 'dspt_06',
    title: 'Data: Storage & Handling',
    desc: 'Encryption at rest and in transit, secure disposal of data and devices.',
  },
  {
    code: 'dspt_07',
    title: 'Technology: Cyber Essentials',
    desc: 'Cyber Essentials certification (or Plus) achieved and current.',
  },
  {
    code: 'dspt_08',
    title: 'Technology: Patching',
    desc: 'Systems kept up to date, unsupported systems documented and risk-assessed.',
  },
  {
    code: 'dspt_09',
    title: 'Technology: Incident Response',
    desc: 'Security incident response plan, 72-hour breach notification process, ICO reporting.',
  },
  {
    code: 'dspt_10',
    title: 'Technology: Business Continuity',
    desc: 'Business continuity and disaster recovery plan tested annually.',
  },
];

const MHRA_ITEMS: FrameworkItemDef[] = [
  {
    code: 'mhra_01',
    title: 'Intended Purpose Documented',
    desc: 'Formal Intended Purpose Statement drafted per MDR 2017 / UKCA requirements.',
  },
  {
    code: 'mhra_02',
    title: 'SaMD Classification Determined',
    desc: 'Risk class assessed: Class I (low), IIa, IIb, or III (high). For Flowen: likely Class I/IIa.',
  },
  {
    code: 'mhra_03',
    title: 'Technical File Initiated',
    desc: 'Technical documentation file started per Annex II/III of UK MDR 2002.',
  },
  {
    code: 'mhra_04',
    title: 'Responsible Person Designated',
    desc: 'UK Responsible Person (RP) appointed for MHRA communications.',
  },
  {
    code: 'mhra_05',
    title: 'UKCA Marking Assessment',
    desc: 'Assessment of whether UKCA marking is required for the intended use case.',
  },
  {
    code: 'mhra_06',
    title: 'Post-Market Surveillance Plan',
    desc: 'Plan for monitoring product performance and adverse events post-launch.',
  },
];

const WCAG_ITEMS: FrameworkItemDef[] = [
  {
    code: 'wcag_01',
    title: 'Automated Audit Completed',
    desc: 'Lighthouse / axe / WAVE automated scan run and issues triaged.',
  },
  {
    code: 'wcag_02',
    title: 'Manual Keyboard Navigation',
    desc: 'Full keyboard navigation tested (tab order, focus indicators, skip links).',
  },
  {
    code: 'wcag_03',
    title: 'Screen Reader Testing',
    desc: 'VoiceOver (iOS/macOS) and TalkBack (Android) testing completed.',
  },
  {
    code: 'wcag_04',
    title: 'Colour Contrast (4.5:1 minimum)',
    desc: 'All text meets WCAG AA contrast ratios. Checked with Colour Contrast Analyser.',
  },
  {
    code: 'wcag_05',
    title: 'Alt Text & Labels',
    desc: 'All images have meaningful alt text. Form inputs have associated labels.',
  },
  {
    code: 'wcag_06',
    title: 'Error Identification',
    desc: 'Form validation errors clearly identified and described in text.',
  },
  {
    code: 'wcag_07',
    title: 'Focus Management',
    desc: 'Modals and dynamic content manage focus correctly. No focus traps.',
  },
  {
    code: 'wcag_08',
    title: 'Captions & Transcripts',
    desc: 'All audio/video content has captions. Speech sessions have transcript output.',
  },
];

const FRAMEWORK_ITEMS: Record<Framework, FrameworkItemDef[]> = {
  dcb0129: DCB0129_ITEMS,
  dtac:    DTAC_ITEMS,
  dspt:    DSPT_ITEMS,
  mhra:    MHRA_ITEMS,
  wcag:    WCAG_ITEMS,
};

// ── Tab config ────────────────────────────────────────────────────────────────

const TABS: { id: Framework; label: string; shortLabel: string; accent: string }[] = [
  { id: 'dcb0129', label: 'DCB0129',  shortLabel: 'DCB0129', accent: 'text-purple-400 border-purple-500' },
  { id: 'dtac',    label: 'DTAC',     shortLabel: 'DTAC',    accent: 'text-teal-400 border-teal-500' },
  { id: 'dspt',    label: 'DSPT',     shortLabel: 'DSPT',    accent: 'text-sky-400 border-sky-500' },
  { id: 'mhra',    label: 'MHRA',     shortLabel: 'MHRA',    accent: 'text-amber-400 border-amber-500' },
  { id: 'wcag',    label: 'WCAG 2.1', shortLabel: 'WCAG',    accent: 'text-emerald-400 border-emerald-500' },
];

const FRAMEWORK_LABELS: Record<Framework, string> = {
  dcb0129: 'DCB0129 — Clinical Safety Standard',
  dtac:    'DTAC — Digital Technology Assessment Criteria',
  dspt:    'DSPT — Data Security Protection Toolkit',
  mhra:    'MHRA — Software as Medical Device',
  wcag:    'WCAG 2.1 AA — Accessibility',
};

const FRAMEWORK_SUBTITLES: Record<Framework, string> = {
  dcb0129: 'Mandatory for all health software in NHS. Requires appointed Clinical Safety Officer.',
  dtac:    '10-criteria NHS procurement gate. Must pass before any NHS trust can buy Flowen.',
  dspt:    'Annual submission to NHS Digital. Required for handling any NHS patient data.',
  mhra:    'UK Medicines & Healthcare products Regulatory Agency. UKCA marking if SaMD applies.',
  wcag:    'Web Content Accessibility Guidelines 2.1 Level AA. DTAC requirement for NHS procurement.',
};

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CYCLE: Status[] = [
  'not_started',
  'in_progress',
  'complete',
  'not_applicable',
  'blocked',
];

const STATUS_CONFIG: Record<
  Status,
  { label: string; pill: string; dot?: string; icon?: string }
> = {
  not_started: {
    label: 'Not Started',
    pill:  'bg-slate-700/60 text-slate-400 border-slate-600/50',
  },
  in_progress: {
    label: 'In Progress',
    pill:  'bg-amber-500/15 text-amber-300 border-amber-500/40',
    dot:   'bg-amber-400',
  },
  complete: {
    label: 'Complete',
    pill:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    icon:  '✓',
  },
  not_applicable: {
    label: 'N/A',
    pill:  'bg-slate-100/80 dark:bg-slate-800/60 text-slate-500 border-slate-700/40',
  },
  blocked: {
    label: 'Blocked',
    pill:  'bg-red-500/15 text-red-300 border-red-500/40',
    icon:  '✕',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildMergedItems(
  framework: Framework,
  dbItems: ComplianceItem[],
): MergedItem[] {
  const defs = FRAMEWORK_ITEMS[framework];
  const dbMap = new Map(
    dbItems
      .filter(i => i.framework === framework)
      .map(i => [i.item_code, i]),
  );

  return defs.map(def => {
    const db = dbMap.get(def.code);
    return {
      ...def,
      framework,
      status:       (db?.status as Status) ?? 'not_started',
      notes:        db?.notes        ?? null,
      evidence_url: db?.evidence_url ?? null,
      updated_at:   db?.updated_at   ?? null,
    };
  });
}

function computeCounts(items: MergedItem[]) {
  return {
    complete:       items.filter(i => i.status === 'complete').length,
    in_progress:    items.filter(i => i.status === 'in_progress').length,
    blocked:        items.filter(i => i.status === 'blocked').length,
    not_started:    items.filter(i => i.status === 'not_started').length,
    not_applicable: items.filter(i => i.status === 'not_applicable').length,
    total:          items.length,
  };
}

function ragStatus(counts: ReturnType<typeof computeCounts>): 'green' | 'amber' | 'red' {
  const actionable = counts.total - counts.not_applicable;
  if (counts.blocked > 0) return 'red';
  if (actionable === 0) return 'green';
  const pct = counts.complete / actionable;
  if (pct >= 1) return 'green';
  if (pct >= 0.5) return 'amber';
  return 'red';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusPill({ status, onClick }: { status: Status; onClick: () => void }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <button
      onClick={onClick}
      title="Click to cycle status"
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border cursor-pointer select-none transition-opacity hover:opacity-80 ${cfg.pill}`}
    >
      {cfg.dot && (
        <span className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse ${cfg.dot}`} />
      )}
      {cfg.icon && <span className="text-[10px] font-bold">{cfg.icon}</span>}
      {cfg.label}
    </button>
  );
}

function TabSummaryBar({ items }: { items: MergedItem[] }) {
  const counts = computeCounts(items);
  const actionable = counts.total - counts.not_applicable;
  const completePct = actionable > 0 ? (counts.complete / actionable) * 100 : 0;

  return (
    <div className="flex flex-col gap-2 mb-5">
      {/* Mini progress bar */}
      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${completePct}%` }}
        />
      </div>
      {/* Count chips */}
      <div className="flex flex-wrap gap-2 text-[11px] font-mono">
        {counts.complete > 0 && (
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="font-bold">{counts.complete}</span> Complete
          </span>
        )}
        {counts.in_progress > 0 && (
          <span className="flex items-center gap-1 text-amber-400">
            <span className="font-bold">{counts.in_progress}</span> In Progress
          </span>
        )}
        {counts.blocked > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <span className="font-bold">{counts.blocked}</span> Blocked
          </span>
        )}
        {counts.not_started > 0 && (
          <span className="flex items-center gap-1 text-slate-500">
            <span className="font-bold">{counts.not_started}</span> Not Started
          </span>
        )}
        {counts.not_applicable > 0 && (
          <span className="flex items-center gap-1 text-slate-600">
            <span className="font-bold">{counts.not_applicable}</span> N/A
          </span>
        )}
        <span className="ml-auto text-slate-600">
          {Math.round(completePct)}% complete
        </span>
      </div>
    </div>
  );
}

interface ItemCardProps {
  item: MergedItem;
  onStatusChange: (code: string, next: Status) => void;
  onNotesChange:  (code: string, notes: string) => void;
  onEvidenceChange: (code: string, url: string) => void;
  saving: boolean;
}

function ItemCard({ item, onStatusChange, onNotesChange, onEvidenceChange, saving }: ItemCardProps) {
  const [notesExpanded, setNotesExpanded]       = useState(false);
  const [localNotes, setLocalNotes]             = useState(item.notes ?? '');
  const [localEvidence, setLocalEvidence]       = useState(item.evidence_url ?? '');
  const [evidenceEditing, setEvidenceEditing]   = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Keep local state in sync when parent updates
  React.useEffect(() => { setLocalNotes(item.notes ?? ''); },        [item.notes]);
  React.useEffect(() => { setLocalEvidence(item.evidence_url ?? ''); }, [item.evidence_url]);

  const cycleStatus = () => {
    const idx  = STATUS_CYCLE.indexOf(item.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    onStatusChange(item.code, next);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col gap-3 hover:border-slate-700 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
              {item.code}
            </span>
            {saving && (
              <span className="text-[9px] font-mono text-slate-600 animate-pulse">saving…</span>
            )}
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{item.title}</p>
          <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
        </div>
        <div className="shrink-0">
          <StatusPill status={item.status} onClick={cycleStatus} />
        </div>
      </div>

      {/* Notes section */}
      <div>
        <button
          onClick={() => {
            setNotesExpanded(v => !v);
            if (!notesExpanded) setTimeout(() => notesRef.current?.focus(), 50);
          }}
          className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
        >
          <span className={`transition-transform ${notesExpanded ? 'rotate-90' : ''}`}>▶</span>
          {localNotes ? 'Notes' : 'Add notes'}
          {localNotes && !notesExpanded && (
            <span className="text-slate-600 font-mono truncate max-w-[200px]">
              &nbsp;— {localNotes.slice(0, 60)}{localNotes.length > 60 ? '…' : ''}
            </span>
          )}
        </button>
        {notesExpanded && (
          <textarea
            ref={notesRef}
            value={localNotes}
            onChange={e => setLocalNotes(e.target.value)}
            onBlur={() => {
              if (localNotes !== (item.notes ?? '')) {
                onNotesChange(item.code, localNotes);
              }
            }}
            placeholder="Add notes, links, responsible person…"
            rows={3}
            className="mt-2 w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-slate-500 transition-colors"
          />
        )}
      </div>

      {/* Evidence URL */}
      <div className="flex items-center gap-2">
        {evidenceEditing ? (
          <form
            className="flex items-center gap-2 flex-1"
            onSubmit={e => {
              e.preventDefault();
              onEvidenceChange(item.code, localEvidence);
              setEvidenceEditing(false);
            }}
          >
            <input
              autoFocus
              type="url"
              value={localEvidence}
              onChange={e => setLocalEvidence(e.target.value)}
              onBlur={() => {
                onEvidenceChange(item.code, localEvidence);
                setEvidenceEditing(false);
              }}
              placeholder="https://docs.example.com/evidence"
              className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
            />
            <button type="submit" className="text-[11px] text-emerald-400 hover:text-emerald-300 font-mono shrink-0">
              Save
            </button>
          </form>
        ) : localEvidence ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <a
              href={localEvidence}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-teal-400 hover:text-teal-300 truncate max-w-[240px] font-mono"
            >
              Evidence ↗
            </a>
            <button
              onClick={() => setEvidenceEditing(true)}
              className="text-[10px] text-slate-600 hover:text-slate-400 shrink-0"
            >
              edit
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEvidenceEditing(true)}
            className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            + Add evidence URL
          </button>
        )}
        {item.updated_at && (
          <span className="ml-auto text-[10px] text-slate-700 font-mono shrink-0">
            {timeAgo(item.updated_at)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Overall score header ──────────────────────────────────────────────────────

function OverallHeader({ allItems }: { allItems: MergedItem[] }) {
  const counts = computeCounts(allItems);
  const rag    = ragStatus(counts);
  const actionable = counts.total - counts.not_applicable;
  const pct    = actionable > 0 ? (counts.complete / actionable) * 100 : 0;
  const circumference = 2 * Math.PI * 36; // r=36
  const dashOffset    = circumference - (pct / 100) * circumference;

  const ragColors: Record<'red' | 'amber' | 'green', string> = {
    green: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    amber: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    red:   'text-red-400 border-red-500/30 bg-red-500/10',
  };
  const ragStroke: Record<'red' | 'amber' | 'green', string> = {
    green: '#10b981',
    amber: '#f59e0b',
    red:   '#ef4444',
  };
  const ragLabel: Record<'red' | 'amber' | 'green', string> = {
    green: 'GREEN — Ready',
    amber: 'AMBER — In Progress',
    red:   'RED — Action Required',
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        {/* Progress ring */}
        <div className="flex items-center justify-center shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
            <circle cx="48" cy="48" r="36" fill="none" stroke="#1e293b" strokeWidth="8" />
            <circle
              cx="48" cy="48" r="36"
              fill="none"
              stroke={ragStroke[rag]}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-xl font-black text-slate-900 dark:text-white">{Math.round(pct)}%</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-slate-900 dark:text-white font-bold text-lg">
              {counts.complete} of {actionable} items complete
            </p>
            <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${ragColors[rag]}`}>
              {ragLabel[rag]}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat label="Complete"    value={counts.complete}    color="text-emerald-400" />
            <MiniStat label="In Progress" value={counts.in_progress} color="text-amber-400" />
            <MiniStat label="Blocked"     value={counts.blocked}     color="text-red-400" />
            <MiniStat label="Not Started" value={counts.not_started} color="text-slate-500" />
          </div>
        </div>

        {/* Per-framework quick view */}
        <div className="shrink-0 space-y-1.5">
          {(Object.keys(FRAMEWORK_ITEMS) as Framework[]).map(fw => {
            const fwItems  = allItems.filter(i => i.framework === fw);
            const fwCounts = computeCounts(fwItems);
            const fwRag    = ragStatus(fwCounts);
            const fwDot: Record<string, string> = {
              green: 'bg-emerald-500',
              amber: 'bg-amber-500',
              red:   'bg-red-500',
            };
            return (
              <div key={fw} className="flex items-center gap-2 text-[11px] font-mono">
                <span className={`w-2 h-2 rounded-full shrink-0 ${fwDot[fwRag]}`} />
                <span className="text-slate-400 w-16 shrink-0 uppercase">{fw}</span>
                <span className="text-slate-500">
                  {fwCounts.complete}/{fwItems.length - fwCounts.not_applicable}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-800/50 rounded-xl px-3 py-2">
      <p className={`text-xl font-black ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{label}</p>
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export function ComplianceClient({ initialItems }: { initialItems: ComplianceItem[] }) {
  const [activeTab, setActiveTab]   = useState<Framework>('dcb0129');
  const [items, setItems]           = useState<ComplianceItem[]>(initialItems);
  const [savingCodes, setSaving]    = useState<Set<string>>(new Set());
  const [, startTransition]         = useTransition();

  // Build merged items for all frameworks
  const allMergedItems: MergedItem[] = (Object.keys(FRAMEWORK_ITEMS) as Framework[]).flatMap(
    fw => buildMergedItems(fw, items),
  );

  // Merged items for active tab
  const tabItems = buildMergedItems(activeTab, items);

  const save = useCallback(async (
    code: string,
    framework: Framework,
    patch: Partial<{ status: Status; notes: string; evidence_url: string }>,
  ) => {
    setSaving(prev => new Set(prev).add(code));

    // Find current item to merge with patch
    const current = allMergedItems.find(i => i.code === code && i.framework === framework);
    if (!current) { setSaving(prev => { const s = new Set(prev); s.delete(code); return s; }); return; }

    const body = {
      framework,
      item_code:    code,
      status:       patch.status       ?? current.status,
      notes:        patch.notes        !== undefined ? patch.notes        : (current.notes        ?? ''),
      evidence_url: patch.evidence_url !== undefined ? patch.evidence_url : (current.evidence_url ?? ''),
    };

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/compliance', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        });
        if (res.ok) {
          const { item } = await res.json() as { item: ComplianceItem };
          setItems(prev => {
            const exists = prev.find(i => i.framework === framework && i.item_code === code);
            if (exists) {
              return prev.map(i =>
                i.framework === framework && i.item_code === code ? item : i,
              );
            }
            return [...prev, item];
          });
        }
      } finally {
        setSaving(prev => { const s = new Set(prev); s.delete(code); return s; });
      }
    });
  }, [allMergedItems]);

  const handleStatusChange = useCallback((code: string, next: Status) => {
    save(code, activeTab, { status: next });
  }, [save, activeTab]);

  const handleNotesChange = useCallback((code: string, notes: string) => {
    save(code, activeTab, { notes });
  }, [save, activeTab]);

  const handleEvidenceChange = useCallback((code: string, evidence_url: string) => {
    save(code, activeTab, { evidence_url });
  }, [save, activeTab]);

  // Grid columns: DCB0129 + MHRA use 2-col on lg; DTAC + DSPT use 1-col (longer text)
  const twoCol = activeTab === 'dcb0129' || activeTab === 'mhra' || activeTab === 'wcag';

  const activeTabMeta = TABS.find(t => t.id === activeTab)!;

  return (
    <div className="space-y-6">
      {/* Overall compliance score */}
      <OverallHeader allItems={allMergedItems} />

      {/* Pill tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(tab => {
          const fwItems  = buildMergedItems(tab.id, items);
          const fwCounts = computeCounts(fwItems);
          const fwRag    = ragStatus(fwCounts);
          const isActive = activeTab === tab.id;
          const ragDotCol: Record<string, string> = {
            green: 'bg-emerald-500',
            amber: 'bg-amber-500',
            red:   'bg-red-500',
          };
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                isActive
                  ? `bg-slate-100 dark:bg-slate-800 border-slate-600 text-slate-900 dark:text-white`
                  : 'bg-transparent border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${ragDotCol[fwRag]}`} />
              {tab.label}
              <span className={`text-[10px] font-mono ${isActive ? 'text-slate-400' : 'text-slate-600'}`}>
                {fwCounts.complete}/{fwItems.length - fwCounts.not_applicable}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab panel */}
      <div className="space-y-4">
        {/* Tab header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className={`text-base font-bold ${activeTabMeta.accent.split(' ')[0]}`}>
              {FRAMEWORK_LABELS[activeTab]}
            </h2>
          </div>
          <p className="text-xs text-slate-500">{FRAMEWORK_SUBTITLES[activeTab]}</p>
        </div>

        {/* Tab summary bar */}
        <TabSummaryBar items={tabItems} />

        {/* Item cards grid */}
        <div className={`grid gap-4 ${twoCol ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {tabItems.map(item => (
            <ItemCard
              key={item.code}
              item={item}
              onStatusChange={handleStatusChange}
              onNotesChange={handleNotesChange}
              onEvidenceChange={handleEvidenceChange}
              saving={savingCodes.has(item.code)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
