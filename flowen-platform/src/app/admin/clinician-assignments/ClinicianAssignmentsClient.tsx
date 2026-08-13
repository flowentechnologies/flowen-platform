'use client';

import React, { useState } from 'react';
import type { AssignmentsData, Assignment, ClinicianOption } from '@/app/api/admin/clinician-assignments/route';

function displayName(name: string | null, email: string | null): string {
  return name ?? email?.split('@')[0] ?? 'Unknown';
}

function SelectUser({ options, value, onChange, placeholder }: {
  options: ClinicianOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
    >
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.id} value={o.id}>
          {displayName(o.display_name, o.email)} — {o.email}
        </option>
      ))}
    </select>
  );
}

export function ClinicianAssignmentsClient({ initialData }: { initialData: AssignmentsData }) {
  const [data, setData]       = useState<AssignmentsData>(initialData);
  const [slpId, setSlpId]     = useState('');
  const [patId, setPatId]     = useState('');
  const [notes, setNotes]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const assign = async () => {
    if (!slpId || !patId) { setError('Select both a clinician and a patient.'); return; }
    setSaving(true); setError(null);
    const res = await fetch('/api/admin/clinician-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign', slp_user_id: slpId, patient_user_id: patId, notes: notes || null }),
    });
    const json = await res.json() as { error?: string; data?: Assignment };
    if (!res.ok) { setError(json.error ?? 'Failed'); setSaving(false); return; }
    const slp = data.clinicians.find(c => c.id === slpId);
    const pat = data.patients.find(p => p.id === patId);
    const newAssignment: Assignment = {
      id: (json.data as Assignment).id,
      slp_user_id: slpId, slp_name: slp?.display_name ?? null, slp_email: slp?.email ?? null,
      patient_user_id: patId, patient_name: pat?.display_name ?? null, patient_email: pat?.email ?? null,
      assigned_at: new Date().toISOString(), assigned_by: null, notes: notes || null,
    };
    setData(d => ({ ...d, assignments: [newAssignment, ...d.assignments] }));
    setSlpId(''); setPatId(''); setNotes(''); setSaving(false);
  };

  const unassign = async (id: string) => {
    setRemoving(id);
    await fetch('/api/admin/clinician-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unassign', id }),
    });
    setData(d => ({ ...d, assignments: d.assignments.filter(a => a.id !== id) }));
    setRemoving(null);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Clinician Assignments</h1>
        <p className="text-slate-400 text-sm mt-1">
          Assign patients (PWS) to speech & language pathologists.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total assignments', value: data.assignments.length },
          { label: 'Clinicians with patients', value: new Set(data.assignments.map(a => a.slp_user_id)).size },
          { label: 'Patients assigned', value: new Set(data.assignments.map(a => a.patient_user_id)).size },
        ].map(card => (
          <div key={card.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-1">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">{card.label}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* New assignment form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-slate-900 dark:text-white font-semibold text-sm">New Assignment</h2>

        {data.clinicians.length === 0 && (
          <p className="text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
            No users with role=&apos;clinician&apos; found. Users set their role during onboarding.
          </p>
        )}
        {data.patients.length === 0 && (
          <p className="text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
            No users with role=&apos;pwds&apos; (person who stutters) found.
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wide text-slate-500">Clinician (SLP)</label>
            <SelectUser options={data.clinicians} value={slpId} onChange={setSlpId} placeholder="Select clinician…" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wide text-slate-500">Patient (PWS)</label>
            <SelectUser options={data.patients} value={patId} onChange={setPatId} placeholder="Select patient…" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wide text-slate-500">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Referred by Dr Smith — focus on fluency shaping"
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">{error}</p>
        )}

        <button
          onClick={assign}
          disabled={saving || !slpId || !patId}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors disabled:opacity-40"
        >
          {saving ? 'Assigning…' : 'Assign'}
        </button>
      </div>

      {/* Assignments table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-slate-900 dark:text-white font-semibold text-sm">
            Current Assignments <span className="text-slate-600 font-normal">({data.assignments.length})</span>
          </h2>
        </div>

        {data.assignments.length === 0 ? (
          <div className="px-6 py-10 text-center text-slate-500 text-sm">No assignments yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 dark:border-slate-800/60">
                  {['Clinician', 'Patient', 'Assigned', 'Notes', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.assignments.map(a => (
                  <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-slate-900 dark:text-white text-xs font-medium">{displayName(a.slp_name, a.slp_email)}</p>
                      <p className="text-slate-500 text-[10px]">{a.slp_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-900 dark:text-white text-xs font-medium">{displayName(a.patient_name, a.patient_email)}</p>
                      <p className="text-slate-500 text-[10px]">{a.patient_email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(a.assigned_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">
                      {a.notes ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => unassign(a.id)}
                        disabled={removing === a.id}
                        className="px-2.5 py-1 rounded-lg bg-red-950 hover:bg-red-900 text-red-400 text-[10px] border border-red-800/40 transition-colors disabled:opacity-40"
                      >
                        {removing === a.id ? '…' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
