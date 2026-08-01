'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

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

export function MessagesClient({ slpId, slpName }: { slpId: string; slpName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async (initial = false) => {
    const res = await fetch(`/api/messages?with=${slpId}`);
    if (!res.ok) return;
    const data = (await res.json()) as MessagesResponse;
    setMessages(data.messages);
    if (initial) {
      // Determine our own user id from message data if possible
      // We rely on to_user_id/from_user_id — we'll derive myId from context later
      // but since we don't have a /api/me endpoint, set myId from any message sent by us
      // The safest approach: find a message where to_user_id === slpId (we sent it)
      const sent = data.messages.find(m => m.to_user_id === slpId);
      const received = data.messages.find(m => m.from_user_id === slpId);
      if (sent) setMyId(sent.from_user_id);
      else if (received) setMyId(received.to_user_id);
      setLoading(false);
    }
  }, [slpId]);

  // Initial load
  useEffect(() => {
    fetchMessages(true).catch(console.error);
  }, [fetchMessages]);

  // Poll every 15 seconds
  useEffect(() => {
    const id = setInterval(() => {
      fetchMessages(false).catch(console.error);
    }, 15000);
    return () => clearInterval(id);
  }, [fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_user_id: slpId, content: trimmed }),
      });
      if (res.ok) {
        const data = (await res.json()) as SendResponse;
        setMessages(prev => {
          // Set myId if not yet known
          if (!myId) setMyId(data.message.from_user_id);
          return [...prev, data.message];
        });
        setContent('');
      }
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <p className="text-slate-400 text-sm">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800">
        <p className="text-white font-semibold text-sm">{slpName}</p>
        <p className="text-slate-500 text-xs mt-0.5">Your speech-language pathologist</p>
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
            const isMe = myId ? msg.from_user_id === myId : msg.to_user_id === slpId;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? 'bg-emerald-500/20 border border-emerald-500/30 text-white'
                      : 'bg-slate-800 border border-slate-700 text-slate-200'
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
      <div className="border-t border-slate-800 p-4 flex gap-3 items-end">
        <textarea
          rows={2}
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={2000}
          placeholder="Type a message… (Enter to send)"
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-emerald-500 transition-colors"
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
  );
}
