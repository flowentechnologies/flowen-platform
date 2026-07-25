'use client';
import React from 'react';
import MainNavbar from '@/components/MainNavbar';

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <MainNavbar />
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-10">
        <h1 className="text-3xl font-extrabold text-white mb-4">Legal & Privacy Governance</h1>
        <p className="text-slate-400 text-sm">Flowen digital platform terms of service, privacy parameters, and HIPAA/GDPR clinical compliance specifications.</p>
      </main>
    </div>
  );
}
