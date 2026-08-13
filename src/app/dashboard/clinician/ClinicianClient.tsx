'use client';

import React from 'react';
import Link from 'next/link';
import type { PatientSummary } from '@/app/api/clinician/patients/route';

function ago(d: string): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const TREND_STYLES = {
  improving:        { cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', label: 'Improving' },
  plateauing:       { cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30',   label: 'Plateauing' },
  regressing:       { cls: 'bg-red-500/10 text-red-400 border-red-500/30',         label: 'Regressing' },
  insufficient_data:{ cls: 'bg-slate-700/50 text-slate-400 border-slate-600/30',   label: 'Not enough data' },
};

function TrendBadge({ trend }: { trend: PatientSummary['trend'] }) {
  const { cls, label } = TREND_STYLES[trend];
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${cls}`}>
      {label}
    </span>
  );
}

export function ClinicianClient({ patients }: { patients: PatientSummary[] }) {
  const improving = patients.filter(p => p.trend === 'improving').length;
  const avgImprovement = patients
    .filter(p => p.improvementPct !== null)
    .reduce((sum, p, _, arr) => sum + (p.improvementPct ?? 0) / arr.length, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Your Patients</h1>
          <p className="text-slate-400 text-sm mt-1">
            {patients.length === 0
              ? 'No patients assigned yet.'
              : `${patients.length} patient${patients.length !== 1 ? 's' : ''} assigned to you`}
          </p>
        </div>
        {patients.length > 0 && (
          <div className="flex gap-4 text-right">
            <div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-wide">Improving</p>
              <p className="text-2xl font-bold text-emerald-400">{improving}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-wide">Avg improvement</p>
              <p className={`text-2xl font-bold ${avgImprovement >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {avgImprovement >= 0 ? '+' : ''}{avgImprovement.toFixed(0)}%
              </p>
            </div>
          </div>
        )}
      </div>

      {patients.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <p className="text-slate-900 dark:text-white font-semibold text-lg">No patients assigned</p>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Contact your administrator to get patients assigned to your caseload.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {patients.map(p => (
            <Link
              key={p.id}
              href={`/dashboard/clinician/${p.id}`}
              className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-all space-y-4"
            >
              {/* Name + trend */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-slate-900 dark:text-white font-semibold truncate">
                    {p.display_name ?? p.email?.split('@')[0] ?? 'Unknown'}
                  </p>
                  <p className="text-slate-500 text-xs truncate">{p.email}</p>
                </div>
                <TrendBadge trend={p.trend} />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600">Sessions</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{p.totalSessions}</p>
                </div>
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600">Practice</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{p.totalMins}m</p>
                </div>
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600">Blk/min</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {p.recentBpm !== null ? p.recentBpm.toFixed(1) : '—'}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-600">
                  {p.lastSessionAt ? `Last: ${ago(p.lastSessionAt)}` : 'No sessions yet'}
                </span>
                <span className="text-xs text-slate-500 group-hover:text-emerald-400 transition-colors font-semibold">
                  View →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
