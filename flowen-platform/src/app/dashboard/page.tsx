'use client';

import React, { useState } from 'react';

export default function EnterpriseDashboard() {
  const [activeTab, setActiveTab] = useState<'user' | 'professional' | 'admin'>('user');

  return (
    <div className="min-h-screen bg-[#0C0E1A] text-[#F5F3EE] p-6 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 mb-8 border-b border-[rgba(245,243,238,0.1)] gap-4">
          <div>
            <h1 className="font-serif text-3xl font-semibold">Enterprise Control Center</h1>
            <p className="text-xs font-mono text-[#A6A3BE] mt-1">Flowen Compliance & Telemetry Engine // SECURE SESSION</p>
          </div>
          <div className="flex gap-2 font-mono text-xs">
            <button onClick={() => setActiveTab('user')} className={`px-4 py-2 rounded-lg border ${activeTab === 'user' ? 'bg-[#2FBBA3] text-[#0C0E1A] border-[#2FBBA3]' : 'bg-[#14172E] text-[#A6A3BE] border-[rgba(245,243,238,0.1)]'}`}>User Portal</button>
            <button onClick={() => setActiveTab('professional')} className={`px-4 py-2 rounded-lg border ${activeTab === 'professional' ? 'bg-[#2FBBA3] text-[#0C0E1A] border-[#2FBBA3]' : 'bg-[#14172E] text-[#A6A3BE] border-[rgba(245,243,238,0.1)]'}`}>SLP Professional</button>
            <button onClick={() => setActiveTab('admin')} className={`px-4 py-2 rounded-lg border ${activeTab === 'admin' ? 'bg-[#2FBBA3] text-[#0C0E1A] border-[#2FBBA3]' : 'bg-[#14172E] text-[#A6A3BE] border-[rgba(245,243,238,0.1)]'}`}>Staff Admin</button>
          </div>
        </header>

        {activeTab === 'user' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-[#14172E] border border-[rgba(245,243,238,0.1)] rounded-xl">
              <span className="text-xs font-mono text-[#2FBBA3]">PRACTICE STAGE</span>
              <h3 className="font-serif text-xl mt-2 mb-1">Stage 03: Sentences</h3>
              <p className="text-xs text-[#A6A3BE]">Viseme breath sync active. Next session scheduled for today.</p>
            </div>
            <div className="p-6 bg-[#14172E] border border-[rgba(245,243,238,0.1)] rounded-xl">
              <span className="text-xs font-mono text-[#E2703A]">SUBSCRIPTION STATUS</span>
              <h3 className="font-serif text-xl mt-2 mb-1">Founding Member</h3>
              <p className="text-xs text-[#A6A3BE]">£4.99/mo locked for 12 months.</p>
            </div>
            <div className="p-6 bg-[#14172E] border border-[rgba(245,243,238,0.1)] rounded-xl">
              <span className="text-xs font-mono text-[#2FBBA3]">TELEMETRY LATENCY</span>
              <h3 className="font-serif text-xl mt-2 mb-1">112 ms average</h3>
              <p className="text-xs text-[#A6A3BE]">Sub-150ms real-time constraint met.</p>
            </div>
          </div>
        )}

        {activeTab === 'professional' && (
          <div className="p-8 bg-[#14172E] border border-[rgba(47,187,163,0.35)] rounded-xl space-y-4">
            <span className="text-xs font-mono text-[#2FBBA3]">SLP CLINICAL TELEMETRY PORTAL</span>
            <h2 className="font-serif text-2xl">Assigned Patient Cohort</h2>
            <p className="text-sm text-[#A6A3BE]">Review consented progress metrics, assign practice pathways, and leave audio feedback notes securely.</p>
            <div className="p-4 bg-[#0C0E1A] rounded-lg font-mono text-xs text-[#2FBBA3]">
              [Secure NHS ICB Telemetry Feed Connected]
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="p-8 bg-[#14172E] border border-[rgba(226,112,58,0.35)] rounded-xl space-y-4">
            <span className="text-xs font-mono text-[#E2703A]">STAFF ADMINISTRATION &amp; WAITLIST CRM</span>
            <h2 className="font-serif text-2xl">Global Waitlist Lead Capture Engine</h2>
            <p className="text-sm text-[#A6A3BE]">All inbound leads automatically synchronize to Supabase and forward instantly to <strong>flowenspeech@outlook.com</strong>.</p>
            <div className="p-4 bg-[#0C0E1A] rounded-lg font-mono text-xs text-[#A6A3BE] space-y-2">
              <div>• Compliance: DTAC Aligned &amp; DCB0129 Clinical Safety Active</div>
              <div>• Storage: Encrypted in transit &amp; at rest (UK GDPR / DSPT)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
