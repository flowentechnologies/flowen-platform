'use client';

/**
 * ClinicianNotificationBell — real-time notification bell for clinicians,
 * shown in DashboardNav next to "Clinician View". Same realtime-subscription
 * + Web-Audio-API chime pattern as components/admin/NotificationBell.tsx,
 * generalized to slp_notifications (a clinician's own rows only, enforced
 * both by RLS and by /api/clinician/bell's own auth check).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  priority: 'high' | 'normal' | 'low';
}

const TYPE_ICON: Record<string, string> = {
  new_message:       '💬',
  session_completed: '✅',
};

const PRIORITY_BORDER: Record<string, string> = {
  high:   'border-l-4 border-l-rose-500',
  normal: 'border-l-4 border-l-transparent',
  low:    'border-l-4 border-l-transparent opacity-70',
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/** Same short two-tone chime as the admin bell — no audio asset needed. */
function playChime() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const notes = [880, 1174.66]; // A5, D6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  } catch {
    // Audio can fail (autoplay policy before any user interaction, no
    // AudioContext support) — the visual badge/count still updates either way.
  }
}

export function ClinicianNotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundMuted, setSoundMuted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);
  const soundMutedRef = useRef(false);

  useEffect(() => {
    try {
      const muted = localStorage.getItem('flowen_clinician_notif_muted') === 'true';
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a synchronous external store (localStorage) on mount, not a cascading update
      setSoundMuted(muted);
      soundMutedRef.current = muted;
    } catch { /* ignore */ }
  }, []);

  function toggleMute() {
    setSoundMuted(prev => {
      const next = !prev;
      soundMutedRef.current = next;
      try { localStorage.setItem('flowen_clinician_notif_muted', String(next)); } catch { /* ignore */ }
      return next;
    });
  }

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/clinician/bell');
      if (!res.ok) return;
      const data = await res.json() as { notifications: Notification[]; unread_count: number };
      setItems(data.notifications);
      setUnreadCount(data.unread_count);
      initialLoadDone.current = true;
    } catch {
      // Silent — the bell just stays at its last known state until the next poll.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount + poll, not a cascading render (matches DashboardNav's fetchUnread pattern)
    fetchNotifications();
    // Realtime is the primary channel; this is just a safety-net refresh in
    // case the websocket ever silently drops without reconnecting.
    const interval = setInterval(fetchNotifications, 5 * 60_000);

    const supabase = createClient();
    const channel = supabase
      .channel(`slp_notifications_bell_${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'slp_notifications', filter: `slp_user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as Notification;
          setItems(prev => [row, ...prev].slice(0, 100));
          setUnreadCount(prev => prev + 1);
          if (initialLoadDone.current && !soundMutedRef.current) playChime();
        },
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications, userId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function markAllRead() {
    setUnreadCount(0);
    setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    await fetch('/api/clinician/bell', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
  }

  async function markOneRead(id: string) {
    await fetch('/api/clinician/bell', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="relative text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-1.5"
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 7a5 5 0 0 0-10 0c0 5.5-2 6.5-2 6.5h14s-2-1-2-6.5" />
          <path d="M8.5 16.5a1.5 1.5 0 0 0 3 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-900 dark:text-white">Notifications</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={toggleMute} title={soundMuted ? 'Unmute sound' : 'Mute sound'} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                {soundMuted ? '🔇' : '🔔'}
              </button>
              {unreadCount > 0 && (
                <button type="button" onClick={markAllRead} className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline">
                  Mark all read
                </button>
              )}
            </div>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-slate-400">Nothing new.</p>
          ) : (
            <ul>
              {items.map(n => (
                <li key={n.id} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                  <Link
                    href={n.link ?? '#'}
                    onClick={() => { markOneRead(n.id); setOpen(false); }}
                    className={`block px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${PRIORITY_BORDER[n.priority] ?? PRIORITY_BORDER.normal} ${!n.read_at ? 'bg-emerald-50/50 dark:bg-emerald-500/5' : ''}`}
                  >
                    <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-start gap-1.5">
                      <span>{TYPE_ICON[n.type] ?? '🔔'}</span>
                      <span className="flex-1">{n.title}</span>
                      <span className="text-[10px] font-normal text-slate-400 whitespace-nowrap">{relativeTime(n.created_at)}</span>
                    </p>
                    {n.body && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 ml-5 line-clamp-2">{n.body}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
