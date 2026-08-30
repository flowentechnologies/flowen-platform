'use client';

import { useRef, useState } from 'react';

export default function DemoVideoPlayer() {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted,   setMuted]   = useState(true);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-2xl shadow-black/60 bg-slate-900">
      <video
        ref={videoRef}
        muted={muted}
        loop
        playsInline
        preload="none"
        poster="/assets/videos/flowen_demo_poster.jpg"
        className="w-full aspect-video object-cover"
      >
        <source src="/assets/videos/flowen_demo.mp4" type="video/mp4" />
      </video>

      {!playing && (
        <button
          onClick={() => {
            const vid = videoRef.current;
            if (!vid) return;
            setMuted(false);
            vid.muted = false;
            vid.play().then(() => setPlaying(true)).catch(() => {});
          }}
          className="absolute inset-0 flex items-center justify-center group"
          aria-label="Play demo"
        >
          <span className="w-16 h-16 rounded-full bg-emerald-500/90 flex items-center justify-center shadow-lg shadow-emerald-500/40 group-hover:bg-emerald-400 transition-colors">
            <svg className="w-7 h-7 text-slate-950 ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}

      {playing && (
        <button
          onClick={() => {
            const vid = videoRef.current;
            if (!vid) return;
            vid.muted = !vid.muted;
            setMuted(vid.muted);
          }}
          className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? (
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97V10.18L16.45 12.63C16.48 12.42 16.5 12.21 16.5 12M19 12C19 12.94 18.8 13.82 18.46 14.64L19.97 16.15C20.63 14.91 21 13.5 21 12C21 7.72 18.01 4.14 14 3.23V5.29C16.89 6.15 19 8.83 19 12M4.27 3L3 4.27L7.73 9H3V15H7L12 20V13.27L16.25 17.52C15.58 18.04 14.83 18.45 14 18.7V20.76C15.38 20.43 16.63 19.78 17.68 18.9L19.73 21L21 19.73L12 10.73L4.27 3M12 4L9.91 6.09L12 8.18V4Z"/>
            </svg>
          ) : (
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          )}
        </button>
      )}

      <div className="absolute inset-0 rounded-2xl ring-1 ring-emerald-500/10 pointer-events-none" />
    </div>
  );
}
