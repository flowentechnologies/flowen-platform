'use client';

import Link from 'next/link';
import { useState } from 'react';
import { VoiceCalibration } from '@/components/avatar/VoiceCalibration';

interface Props {
  existingVoiceId:   string | null;
  existingVoiceName: string | null;
}

type Step = 'overview' | 'record' | 'done';

export function VoiceSetupClient({ existingVoiceId, existingVoiceName }: Props) {
  const [step, setStep]           = useState<Step>(existingVoiceId ? 'done' : 'overview');
  const [voiceId, setVoiceId]     = useState<string | null>(existingVoiceId);
  const [voiceName, setVoiceName] = useState<string | null>(existingVoiceName);

  const handleComplete = (newVoiceId: string) => {
    setVoiceId(newVoiceId);
    setVoiceName('Your voice');
    setStep('done');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-8">

      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors group mb-4"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4" />
          </svg>
          Settings
        </Link>
        <h1 className="text-2xl font-bold text-white">AI Voice Setup</h1>
        <p className="text-slate-400 text-sm">
          Record 60 seconds of natural speech and your practice avatar will speak back in your own voice.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3">
        {(['overview', 'record', 'done'] as Step[]).map((s, i) => {
          const label = ['How it works', 'Record', 'Done'][i];
          const past  = ['overview', 'record', 'done'].indexOf(step) > i;
          const cur   = step === s;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                past ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                     : cur  ? 'border-emerald-500 text-emerald-400 bg-transparent'
                            : 'border-slate-700 text-slate-600 bg-transparent'
              }`}>
                {past ? (
                  <svg viewBox="0 0 14 14" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2,7 5.5,11 12,3" />
                  </svg>
                ) : String(i + 1)}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${
                cur ? 'text-emerald-400' : past ? 'text-emerald-600' : 'text-slate-600'
              }`}>{label}</span>
              {i < 2 && <div className={`flex-1 h-px w-8 mx-1 ${past ? 'bg-emerald-500' : 'bg-slate-700'}`} />}
            </div>
          );
        })}
      </div>

      {/* Step: overview */}
      {step === 'overview' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: '🎙️', title: '60 seconds', desc: 'Read a short phonetically rich script aloud. Natural pace, clear voice.' },
              { icon: '🤖', title: 'ElevenLabs clone', desc: 'Your recording is processed to create a personalised AI voice model.' },
              { icon: '🧏', title: 'Avatar speaks as you', desc: 'Every response from your practice avatar will sound like your own voice.' },
            ].map((c) => (
              <div key={c.title} className="flex flex-col gap-2">
                <span className="text-2xl">{c.icon}</span>
                <p className="text-sm font-semibold text-white">{c.title}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-800 pt-4 space-y-2">
            <p className="text-[11px] text-slate-600 uppercase tracking-wider font-semibold">Privacy note</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your recording is sent to ElevenLabs solely to generate the voice model.
              Flowen does not store your audio after processing. You can delete your voice model at any time.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep('record')}
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20"
            >
              Start recording →
            </button>
            <Link
              href="/dashboard/settings"
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Skip for now
            </Link>
          </div>
        </div>
      )}

      {/* Step: record */}
      {step === 'record' && (
        <VoiceCalibration
          onComplete={handleComplete}
          onSkip={() => setStep('overview')}
        />
      )}

      {/* Step: done */}
      {step === 'done' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-5 text-center">
          <div className="text-4xl">🎉</div>
          <div>
            <h2 className="text-lg font-bold text-white">Voice ready</h2>
            <p className="text-sm text-slate-400 mt-1">
              Your avatar now speaks as{' '}
              <span className="text-violet-400 font-medium">{voiceName ?? 'you'}</span>.
              Every practice session will use this voice.
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 pt-2">
            <Link
              href="/dashboard/practice"
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20"
            >
              Start practising →
            </Link>
            <button
              onClick={() => setStep('record')}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Re-record voice
            </button>
          </div>

          {voiceId && (
            <p className="text-[10px] text-slate-700 font-mono">Voice ID: {voiceId}</p>
          )}
        </div>
      )}
    </div>
  );
}
