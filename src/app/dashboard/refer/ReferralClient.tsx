'use client';

import { useState } from 'react';

interface Props {
  referralUrl: string;
  refCode:     string;
  clickCount:  number;
}

export function ReferralClient({ referralUrl, refCode, clickCount }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback: select the input
      const el = document.getElementById('ref-input') as HTMLInputElement | null;
      el?.select();
    }
  };

  const shareText = encodeURIComponent(
    `I've been using Flowen for speech fluency practice — it's been genuinely useful. You can try it free for 7 days here:`,
  );
  const whatsappUrl = `https://wa.me/?text=${shareText}%20${encodeURIComponent(referralUrl)}`;
  const emailUrl    = `mailto:?subject=Try%20Flowen%20free%20for%207%20days&body=${shareText}%20${encodeURIComponent(referralUrl)}`;

  return (
    <div className="space-y-5">
      {/* Stat strip */}
      {clickCount > 0 && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
          <span className="text-emerald-400 text-lg">🔗</span>
          <p className="text-sm text-emerald-300">
            <strong>{clickCount}</strong> {clickCount === 1 ? 'person has' : 'people have'} clicked your link so far.
          </p>
        </div>
      )}

      {/* Link box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          Your referral link · code {refCode}
        </p>
        <div className="flex gap-2">
          <input
            id="ref-input"
            type="text"
            readOnly
            value={referralUrl}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-300 font-mono focus:outline-none focus:border-emerald-500/50 cursor-text select-all"
            onFocus={e => e.target.select()}
          />
          <button
            onClick={copy}
            className={`shrink-0 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
              copied
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
            }`}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Share buttons */}
      <div className="flex gap-3">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] text-sm font-semibold hover:bg-[#25D366]/15 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp
        </a>
        <a
          href={emailUrl}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
          Email
        </a>
      </div>
    </div>
  );
}
