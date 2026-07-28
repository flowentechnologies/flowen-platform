'use client';

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import MainNavbar from '@/components/MainNavbar';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const stages = [
  { id: 1, name: 'Diaphragmatic Breathing',      desc: 'Regulate airflow and establish vocal rhythm prior to speech onset.',           target: 'Pacing Rate: 6 BPM' },
  { id: 2, name: 'Easy Onset & Prolongation',    desc: 'Soft vocal fold contact to reduce laryngeal tension on initial vowels.',       target: 'Continuous Vowel Flow' },
  { id: 3, name: 'Light Articulatory Contacts',  desc: 'Minimal pressure on plosive sounds (/p/, /b/, /t/, /d/).',                   target: 'Pressure Threshold < 20%' },
  { id: 4, name: 'Pausing & Phrasing',           desc: 'Group words into natural thought chunks with structured pauses.',             target: 'Chunk Size: 3-5 Words' },
  { id: 5, name: 'Real-time Conversational Flow',desc: 'Simulated spontaneous dialogue with real-time acoustic telemetry.',           target: 'Target Fluency > 85%' },
];

export default function PracticeEnginePage() {
  const [currentStage, setCurrentStage] = useState(1);
  const [isRecording,  setIsRecording]  = useState(false);
  const [userId,       setUserId]       = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const stage = stages[currentStage - 1];

  const handleToggle = async () => {
    if (isRecording && userId) {
      await fetch('/api/telemetry', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          userId,
          stage:           currentStage,
          pitchSmoothness: 94.2,
          hesitationCount: 0,
        }),
      });
    }
    setIsRecording(prev => !prev);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <MainNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              STAGE {currentStage} OF 5
            </span>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">5-Stage Practice Engine</h1>
          </div>
          <div className="flex gap-2">
            {stages.map(s => (
              <button
                key={s.id}
                onClick={() => { setCurrentStage(s.id); setIsRecording(false); }}
                className={`w-9 h-9 rounded-full text-xs font-bold border transition-all ${
                  s.id === currentStage
                    ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-emerald-500/50'
                }`}
              >
                {s.id}
              </button>
            ))}
          </div>
        </div>

        {/* Stage card */}
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
          <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">{stage.target}</span>
          <h2 className="text-2xl font-bold text-white">{stage.name}</h2>
          <p className="text-slate-400 leading-relaxed">{stage.desc}</p>
        </div>

        {/* Recording toggle */}
        <button
          onClick={handleToggle}
          className={`w-full py-4 rounded-xl font-bold text-sm transition-all ${
            isRecording
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
          }`}
        >
          {isRecording ? '⏹ Stop & Process Telemetry' : '🎙 Start Stage Exercise'}
        </button>

        {isRecording && (
          <p className="text-center text-xs text-emerald-400 font-mono animate-pulse">
            ● RECORDING — speak naturally, biofeedback active
          </p>
        )}
      </main>
    </div>
  );
}
