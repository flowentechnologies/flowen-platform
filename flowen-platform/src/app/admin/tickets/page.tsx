import { createClient } from '@supabase/supabase-js';
import { assertAdmin } from '@/lib/admin/guard';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { TicketsClient } from './TicketsClient';
import Link from 'next/link';

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export default async function TicketsPage() {
  await assertAdmin();

  const cookieStore = await cookies();
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
  const { data: { user } } = await anonClient.auth.getUser();
  const adminEmail = user?.email ?? 'admin@flowen.digital';

  const db = adminDb();
  const [ticketsRes, messagesRes] = await Promise.all([
    db.from('support_tickets').select('*').order('created_at', { ascending: false }),
    db.from('ticket_messages').select('id, ticket_id, from_admin, author, body, created_at').order('created_at', { ascending: true }),
  ]);

  const tickets  = ticketsRes.data  ?? [];
  const messages = messagesRes.data ?? [];

  const msgMap: Record<string, typeof messages> = {};
  for (const m of messages) {
    if (!msgMap[m.ticket_id]) msgMap[m.ticket_id] = [];
    msgMap[m.ticket_id].push(m);
  }
  const enriched = tickets.map(t => ({ ...t, messages: msgMap[t.id] ?? [] }));

  const now = new Date();
  const open       = tickets.filter(t => t.status === 'open').length;
  const breached   = tickets.filter(t => !['resolved','closed'].includes(t.status) && new Date(t.sla_due_at) < now).length;
  const resolved   = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');
  const avgMs      = resolved.length > 0
    ? resolved.reduce((sum, t) => sum + (new Date(t.resolved_at ?? t.updated_at).getTime() - new Date(t.created_at).getTime()), 0) / resolved.length
    : null;
  const avgHours   = avgMs ? Math.round(avgMs / 3_600_000) : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Tickets</h1>
          <p className="text-slate-400 text-sm mt-1">Support queue · SLA tracking · reply thread</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/tickets/gdpr-requests"
            className="px-3 py-1.5 text-xs font-mono font-bold rounded-xl border border-red-700/50 text-red-400 hover:bg-red-500/10 transition-colors">
            GDPR Requests →
          </Link>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            SUPPORT
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`border rounded-2xl p-5 ${open > 0 ? 'bg-slate-900 border-slate-800' : 'bg-slate-900 border-slate-800'}`}>
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Open Tickets</p>
          <p className="text-4xl font-black text-white">{open}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">{tickets.length} total</p>
        </div>
        <div className={`border rounded-2xl p-5 ${breached > 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-slate-900 border-slate-800'}`}>
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">SLA Breaches</p>
          <p className={`text-4xl font-black ${breached > 0 ? 'text-red-400' : 'text-white'}`}>{breached}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">active tickets over SLA</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Avg Resolution</p>
          <p className="text-4xl font-black text-white">{avgHours !== null ? `${avgHours}h` : '—'}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">{resolved.length} resolved</p>
        </div>
      </div>

      {/* Board */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <TicketsClient initialTickets={enriched} adminEmail={adminEmail} />
      </div>
    </div>
  );
}
