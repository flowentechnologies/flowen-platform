'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import posthog from 'posthog-js';
import { createClient } from '@/lib/supabase/client';

interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

interface MessagesResponse {
  messages: Message[];
  other_user: { id: string; display_name: string | null; email: string | null };
}

interface SendResponse {
  message: Message;
}

function fmt(d: string) {
  return new Date(d).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}

export function MessagesClient({ slpId, slpName, myId }: { slpId: string; slpName: string; myId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Initial fetch via API (uses service role — handles assignment check + marks read)
  const fetchMessages = useCallback(async (initial = false) => {
    const res = await fetch(`/api/messages?with=${slpId}`);
    if (!res.ok) return;
    const data = (await res.json()) as MessagesResponse;
    setMessages(data.messages);
    if (initial) setLoading(false);
  }, [slpId]);

  useEffect(() => {
    fetchMessages(true).catch(console.error);
  }, [fetchMessages]);

  // Supabase Realtime — subscribe to new messages and read receipts
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`slp_messages:${myId}:${slpId}`)
      // New incoming messages (from SLP → me)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'slp_messages',
          filter: `to_user_id=eq.${myId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          // Only care about this conversation
          if (msg.from_user_id !== slpId) return;
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // Mark the incoming message as read immediately
          supabase
            .from('slp_messages')
            .update({ read_at: new Date().toISOString() })
            .eq('id', msg.id)
            .then(() => {});
        },
      )
      // Read receipts — SLP reads my message (UPDATE sets read_at on my sent messages)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'slp_messages',
          filter: `from_user_id=eq.${myId}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          if (!updated.read_at) return;
          setMessages(prev =>
            prev.map(m => (m.id === updated.id ? { ...m, read_at: updated.read_at } : m)),
          );
        },
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId, slpId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_user_id: slpId, content: trimmed }),
      });
      if (res.ok) {
        const data = (await res.json()) as SendResponse;
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        setContent('');
        posthog.capture('message_sent', { recipient_type: 'clinician' });
      } else {
        setSendError('Message could not be sent. Please try again.');
      }
    } catch {
      setSendError('Network error — check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send().catch(console.error);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
        <p className="text-slate-400 text-sm">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <p className="text-slate-900 dark:text-white font-semibold text-sm">{slpName}</p>
          <p className="text-slate-500 text-xs mt-0.5">Your speech-language pathologist</p>
        </div>
        <span
          title={connected ? 'Live updates active' : 'Connecting…'}
          className={`w-2 h-2 rounded-full transition-colors ${connected ? 'bg-emerald-400' : 'bg-slate-400 animate-pulse'}`}
        />
      </div>

      {/* Messages scroll area */}
      <div
        className="flex flex-col gap-2 p-4 overflow-y-auto"
        style={{ maxHeight: '400px' }}
      >
        {messages.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">
            No messages yet. Send your clinician a message.
          </p>
        ) : (
          messages.map(msg => {
            const isMe = msg.from_user_id === myId;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? 'bg-emerald-500/20 border border-emerald-500/30 text-slate-900 dark:text-white'
                      : 'bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {msg.content}
                </div>
                <div className="flex items-center gap-1.5 mt-1 px-1">
                  <span className="text-[10px] text-slate-600 font-mono">{fmt(msg.created_at)}</span>
                  {isMe && msg.read_at && (
                    <span className="text-[10px] text-emerald-600">Seen</span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-2">
        {sendError && (
          <p className="text-rose-400 text-xs px-1" role="alert">{sendError}</p>
        )}
        <div className="flex gap-3 items-end">
          <textarea
            rows={2}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={2000}
            placeholder="Type a message… (Enter to send)"
            className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-500 resize-none focus:outline-none focus:border-emerald-500 transition-colors"
          />
          <button
            onClick={() => send().catch(console.error)}
            disabled={sending || !content.trim()}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
