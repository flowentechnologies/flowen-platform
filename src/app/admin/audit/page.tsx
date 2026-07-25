'use client';

import React, { useState, useEffect } from 'react';
import MainNavbar from '@/components/MainNavbar';

interface AuditLog {
  id: string;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'SECURITY_ALERT';
  category: string;
  actorId: string;
  actorRole: string;
  action: string;
  hash: string;
}

export default function SecurityAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  useEffect(() => {
    fetch('/api/audit')
      .then((res) => res.json())
      .then((data) => { if (data.logs) setLogs(data.logs); })
      .catch(() => {});
  }, []);

  const filteredLogs = logs.filter((l) => filterSeverity === 'ALL' ? true : l.severity === filterSeverity);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <MainNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                SECURITY & COMPLIANCE FRAMEWORK
              </span>
              <span className="text-xs text-slate-400 font-mono">SOC 2 TYPE II • HIPAA • GDPR</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">System Audit & Access Matrix</h1>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            HASH INTEGRITY VALIDATED
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase">
              <tr>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Severity</th>
                <th className="p-4">Category</th>
                <th className="p-4">Actor</th>
                <th className="p-4">Action</th>
                <th className="p-4">Hash Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td className="p-4 text-slate-400">{log.timestamp}</td>
                  <td className="p-4 font-bold">{log.severity}</td>
                  <td className="p-4">{log.category}</td>
                  <td className="p-4">{log.actorId}</td>
                  <td className="p-4 font-bold">{log.action}</td>
                  <td className="p-4 text-emerald-400 text-[10px] truncate max-w-[180px]">{log.hash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
