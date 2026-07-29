export default function TicketsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Tickets</h1>
          <p className="text-slate-400 text-sm mt-1">Support queue, SLA, handoff</p>
        </div>
        <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          UNDER CONSTRUCTION
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Open Tickets', value: '—' },
          { label: 'Avg Resolution Time', value: '—' },
          { label: 'SLA Breaches', value: '—' },
        ].map((stat) => (
          <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <p className="text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">{stat.label}</p>
            <p className="text-4xl font-black text-slate-600">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
        <h2 className="text-lg font-bold text-white mb-3">Coming soon</h2>
        <p className="text-slate-400 text-sm leading-relaxed">
          This section will include a full support ticketing system with SLA tracking,
          team assignment and handoff, canned responses, escalation rules, GDPR request handling,
          ticket tagging, and integration with email and Slack notifications.
        </p>
      </div>
    </div>
  );
}
