'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const TYPE_ICON: Record<string, string> = {
  inbox_new: '📥',
  draft_pending: '✍️',
  vendor_invoice: '💳',
  crm_new: '🤝',
  system: '⚙️',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/bell');
      if (!res.ok) return;
      const data = await res.json() as { notifications: Notification[]; unread_count: number };
      setItems(data.notifications);
      setUnreadCount(data.unread_count);
    } catch {
      // Silent — the bell just stays at its last known state until the next poll.
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

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
    await fetch('/api/admin/bell', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
  }

  async function markOneRead(id: string) {
    await fetch('/api/admin/bell', {
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
        className="relative text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 7a5 5 0 0 0-10 0c0 5.5-2 6.5-2 6.5h14s-2-1-2-6.5" />
          <path d="M8.5 16.5a1.5 1.5 0 0 0 3 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-900 dark:text-white">Notifications</span>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline">
                Mark all read
              </button>
            )}
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
                    className={`block px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${!n.read_at ? 'bg-emerald-50/50 dark:bg-emerald-500/5' : ''}`}
                  >
                    <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-start gap-1.5">
                      <span>{TYPE_ICON[n.type] ?? '🔔'}</span>
                      <span className="flex-1">{n.title}</span>
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
