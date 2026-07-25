'use client';

import React, { useState } from 'react';
import MainNavbar from '@/components/MainNavbar';

export default function PracticeEnginePage() {
  const [currentStage, setCurrentStage] = useState(1);
  const [isRecording, setIsRecording] = useState(false);

  const stages = [
    { id: 1, name: 'Diaphragmatic Breathing', desc: 'Regulate airflow and establish vocal rhythm prior to speech onset.', target: 'Pacing Rate: 6 BPM' },
    { id: 2, name: 'Easy Onset & Prolongation', desc: 'Soft vocal fold contact to reduce laryngeal tension on initial vowels.', target: 'Continuous Vowel Flow' },
    { id: 3, name: 'Light Articulatory Contacts', desc: 'Minimal pressure on plosive sounds (/p/, /b/, /t/, /d/).', target: 'Pressure Threshold < 20%'},
    { id: 4, name: 'Pausing & Phrasing', desc: 'Group words into natural thought chunks with structured pauses.', target: 'Chunk Size: 3-5 Words' },
    { id: 5, name: 'Real-time Conversational Flow', desc: 'Simulated spontaneous dialogue with real-time acoustic telemetry.', target: 'Target Fluency > 85%' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <MainNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              STAGE {currentStage} OF 5
            </span>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">5-Stage Practice Engine</h1>
          </div>
        </div>

        <button
          onClick={async () => {
            if (isRecording) {
              await fetch('/api/telemetry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: 'usr_alexander', pitchSmoothness: 94.2, hesitationCount: 0 })
              });
            }
            setIsRecording(!isRecording);
          }}
          className="w-full py-4 rounded-xl font-bold text-sm bg-emerald-500 text-slate-950"
        >
          {isRecording ? '⏹ Stop & Process Telemetry' : '🎙️ Start Stage Exercise'}
        </button>
      </main>
    </div>
  );
}
