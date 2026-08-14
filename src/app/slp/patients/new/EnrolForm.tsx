'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { enrolPatient } from '@/app/actions/slp-patient-actions';

const PHASES = ['assessment', 'intensive', 'maintenance'] as const;
const STAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export default function EnrolForm({ slpId }: { slpId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [email,        setEmail]        = useState('');
  const [phase,        setPhase]        = useState<string>('assessment');
  const [sessPerWeek,  setSessPerWeek]  = useState(3);
  const [minsPerSess,  setMinsPerSess]  = useState(15);
  const [goals,        setGoals]        = useState('');
  const [stages,       setStages]       = useState<number[]>([1, 2, 3]);
  const [error,        setError]        = useState('');

  function toggleStage(s: number) {
    setStages(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s].sort((a, b) => a - b)
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim())  { setError('Patient email is required.'); return; }
    if (!goals.trim())  { setError('Clinical goals are required.'); return; }
    if (!stages.length) { setError('Select at least one stage.'); return; }

    startTransition(async () => {
      const res = await enrolPatient({
        patientEmail:    email.trim(),
        slpId,
        phase,
        sessionsPerWeek: sessPerWeek,
        minutesPerSession: minsPerSess,
        goals,
        prescribedStages: stages,
      });
      if (res.ok && res.patientId) {
        router.push(`/slp/patients/${res.patientId}`);
      } else {
        setError(res.error ?? 'Failed to enrol patient.');
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">

      {/* Patient lookup */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-white mb-4">Patient Account</h2>
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">
            Patient email address <span className="text-rose-400">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="patient@example.com"
            required
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
          />
          <p className="text-[11px] text-slate-500 mt-1.5">
            The patient must already have a Flowen account. If they don{"'"}t, ask them to sign up at{' '}
            <span className="text-slate-400">flowen.digital/auth/signup</span> first.
          </p>
        </div>
      </div>

      {/* Treatment plan */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-white mb-4">Treatment Plan</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Phase <span className="text-rose-400">*</span></label>
            <select
              value={phase}
              onChange={e => setPhase(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500"
            >
              {PHASES.map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Sessions / week <span className="text-rose-400">*</span></label>
            <input
              type="number" min={1} max={14}
              value={sessPerWeek}
              onChange={e => setSessPerWeek(+e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Minutes / session <span className="text-rose-400">*</span></label>
            <input
              type="number" min={5} max={60}
              value={minsPerSess}
              onChange={e => setMinsPerSess(+e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs text-slate-400 block mb-1.5">
            Clinical goals <span className="text-rose-400">*</span>
          </label>
          <textarea
            value={goals}
            onChange={e => setGoals(e.target.value)}
            rows={3}
            placeholder="e.g. Reduce stuttering frequency in conversational speech using prolonged speech technique. Target: <5 disfluencies per 100 syllables within 8 weeks."
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-2">
            Prescribed stages <span className="text-rose-400">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {STAGES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => toggleStage(s)}
                className={`
                  w-10 h-10 rounded-lg border text-sm font-semibold transition-colors
                  ${stages.includes(s)
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500'}
                `}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Stages {stages.join(', ') || '—'} selected
          </p>
        </div>
      </div>

      {/* Error + submit */}
      {error && (
        <div className="px-4 py-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-sm text-rose-400">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold text-sm transition-colors"
        >
          {pending ? 'Enrolling…' : 'Enrol Patient'}
        </button>
        <a href="/slp/caseload" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
          Cancel
        </a>
      </div>
    </form>
  );
}
