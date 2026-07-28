'use client';

import React from 'react';
import Link from 'next/link';

interface FlowenLogoProps {
  className?: string;
  showText?: boolean;
}

export function FlowenLogo({ className = 'h-8', showText = true }: FlowenLogoProps) {
  return (
    <Link 
      href="/" 
      className="inline-flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-emerald-500/50 rounded-xl p-1 transition-all"
    >
      {/* Dual Waveform Logo Mark */}
      <svg
        viewBox="0 0 120 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${className} w-auto transition-transform group-hover:scale-105`}
      >
        <defs>
          <linearGradient id="flowen-wave-gradient" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#F59E0B" />    {/* Amber / Yellow-Gold */}
            <stop offset="35%" stopColor="#10B981" />   {/* Emerald Green */}
            <stop offset="100%" stopColor="#06B6D4" />  {/* Teal / Cyan */}
          </linearGradient>
        </defs>

        {/* Top Wave Stream */}
        <path
          d="M 10 25 C 20 25, 25 38, 35 38 C 48 38, 52 12, 65 12 C 78 12, 82 42, 95 42 C 105 42, 108 30, 115 30"
          stroke="url(#flowen-wave-gradient)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />

        {/* Bottom Wave Stream (Parallel Flow) */}
        <path
          d="M 10 33 C 20 33, 25 46, 35 46 C 48 46, 52 20, 65 20 C 78 20, 82 50, 95 50 C 105 50, 108 38, 115 38"
          stroke="url(#flowen-wave-gradient)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Brand Text */}
      {showText && (
        <span className="text-xl font-black tracking-tight text-white group-hover:text-emerald-400 transition-colors">
          FLOWEN
        </span>
      )}
    </Link>
  );
}
