'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import VisemeMouth from '@/components/avatar/VisemeMouth';
import {
  type PhonemeClass,
  type VisemeBlends,
  VISEME_TARGETS,
  ZERO_BLENDS,
  buildTargetBlends,
  lerpBlends,
} from '@/lib/viseme';

// ── Phoneme metadata ──────────────────────────────────────────────────────────

interface PhonemeInfo {
  id: PhonemeClass;
  label: string;
  ipa: string;
  examples: string;
  category: 'silence' | 'consonant' | 'vowel' | 'approximant';
}

const PHONEMES: PhonemeInfo[] = [
  { id: 'SIL', label: 'Silence',   ipa: '—',   examples: 'pause, rest',       category: 'silence' },
  { id: 'PP',  label: 'Bilabial',  ipa: '/p b m/', examples: 'put · bee · me', category: 'consonant' },
  { id: 'FF',  label: 'Labiodental', ipa: '/f v/', examples: 'fan · van',      category: 'consonant' },
  { id: 'TH',  label: 'Dental',    ipa: '/θ ð/', examples: 'think · this',     category: 'consonant' },
  { id: 'DD',  label: 'Alveolar Plosive', ipa: '/d t/', examples: 'dog · top', category: 'consonant' },
  { id: 'KK',  label: 'Velar',     ipa: '/k g/', examples: 'cat · go',         category: 'consonant' },
  { id: 'CH',  label: 'Affricate', ipa: '/tʃ dʒ ʃ/', examples: 'chip · shoe', category: 'consonant' },
  { id: 'SS',  label: 'Sibilant',  ipa: '/s z/', examples: 'sun · zoo',        category: 'consonant' },
  { id: 'NN',  label: 'Alveolar Nasal', ipa: '/n ŋ/', examples: 'no · sing · ring', category: 'consonant' },
  { id: 'LL',  label: 'Lateral',      ipa: '/l/',   examples: 'let · call · light', category: 'consonant' },
  { id: 'RR',  label: 'Rhotic',    ipa: '/r/',   examples: 'run · red',        category: 'consonant' },
  { id: 'HH',  label: 'Glottal',   ipa: '/h/',   examples: 'hot · hat',        category: 'consonant' },
  { id: 'WW',  label: 'Labio-velar', ipa: '/w/', examples: 'wet · way',        category: 'approximant' },
  { id: 'YY',  label: 'Palatal',   ipa: '/j/',   examples: 'yes · you',        category: 'approximant' },
  { id: 'AA',  label: 'Open Back', ipa: '/ɑː/',  examples: 'father · calm',    category: 'vowel' },
  { id: 'AE',  label: 'Near-Open', ipa: '/æ/',   examples: 'cat · bag',        category: 'vowel' },
  { id: 'AH',  label: 'Open-Mid',  ipa: '/ʌ/',   examples: 'cup · fun',        category: 'vowel' },
  { id: 'AO',  label: 'Open-Mid Back', ipa: '/ɔː/', examples: 'call · saw',   category: 'vowel' },
  { id: 'AW',  label: 'Diphthong', ipa: '/aʊ/',  examples: 'how · out',        category: 'vowel' },
  { id: 'AY',  label: 'Diphthong', ipa: '/aɪ/',  examples: 'my · fly',         category: 'vowel' },
  { id: 'EH',  label: 'Open-Mid Front', ipa: '/ɛ/', examples: 'bed · get',     category: 'vowel' },
  { id: 'ER',  label: 'R-coloured', ipa: '/ɜr/', examples: 'bird · her',       category: 'vowel' },
  { id: 'EY',  label: 'Close-Mid', ipa: '/eɪ/',  examples: 'say · day',        category: 'vowel' },
  { id: 'IH',  label: 'Near-Close', ipa: '/ɪ/',  examples: 'bit · sit',        category: 'vowel' },
  { id: 'IY',  label: 'Close Front', ipa: '/iː/', examples: 'see · fee',       category: 'vowel' },
  { id: 'OW',  label: 'Close-Mid Back', ipa: '/oʊ/', examples: 'go · know',    category: 'vowel' },
  { id: 'OY',  label: 'Diphthong', ipa: '/ɔɪ/',  examples: 'boy · toy',        category: 'vowel' },
  { id: 'UH',  label: 'Near-Close Back', ipa: '/ʊ/', examples: 'book · put',   category: 'vowel' },
  { id: 'UW',  label: 'Close Back', ipa: '/uː/', examples: 'you · blue',       category: 'vowel' },
];

const CATEGORY_COLORS: Record<PhonemeInfo['category'], string> = {
  silence:     'border-slate-700 bg-slate-900/40',
  consonant:   'border-violet-500/30 bg-violet-500/5',
  vowel:       'border-emerald-500/30 bg-emerald-500/5',
  approximant: 'border-sky-500/30 bg-sky-500/5',
};

const CATEGORY_BADGE: Record<PhonemeInfo['category'], string> = {
  silence:     'bg-slate-800 text-slate-400',
  consonant:   'bg-violet-500/15 text-violet-400',
  vowel:       'bg-emerald-500/15 text-emerald-400',
  approximant: 'bg-sky-500/15 text-sky-400',
};

// ── Blend parameter groups ────────────────────────────────────────────────────

const BLEND_GROUPS: { label: string; keys: (keyof VisemeBlends)[] }[] = [
  { label: 'Jaw',  keys: ['jawOpen', 'jawForward', 'jawLeft', 'jawRight'] },
  { label: 'Mouth Shape', keys: ['mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
      'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
      'mouthDimpleLeft', 'mouthDimpleRight', 'mouthStretchLeft', 'mouthStretchRight',
      'mouthRollLower', 'mouthRollUpper'] },
  { label: 'Lip Pressure', keys: ['mouthShrugLower', 'mouthShrugUpper', 'mouthPressLeft', 'mouthPressRight',
      'mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthUpperUpLeft', 'mouthUpperUpRight'] },
  { label: 'Cheek & Nose', keys: ['cheekPuff', 'cheekSquintLeft', 'cheekSquintRight', 'noseSneerLeft', 'noseSneerRight'] },
  { label: 'Tongue', keys: ['tongueOut', 'tongueUp', 'tongueDown', 'tongueLeft', 'tongueRight',
      'tongueRoll', 'tongueBendDown', 'tongueCurlUp', 'tongueSquish', 'tongueFlat'] },
];

function camelToLabel(s: string) {
  return s.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Filter = 'all' | 'consonant' | 'vowel' | 'approximant' | 'silence';

export default function VisemePage() {
  const [selected, setSelected]   = useState<PhonemeClass>('SIL');
  const [animated, setAnimated]   = useState<VisemeBlends>({ ...ZERO_BLENDS });
  const [autoPlay, setAutoPlay]   = useState(false);
  const [filter, setFilter]       = useState<Filter>('all');
  const rafRef  = useRef<number>(0);
  const autoRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const selectedInfo = PHONEMES.find(p => p.id === selected)!;
  const target = buildTargetBlends(selected);

  // Animate lerp toward selected target
  useEffect(() => {
    let current = { ...animated };
    let last = performance.now();

    function tick(now: number) {
      const dt = now - last;
      last = now;
      current = lerpBlends(current, target, Math.min(1, 0.12 * dt));
      setAnimated({ ...current });
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Auto-play cycle
  useEffect(() => {
    clearInterval(autoRef.current);
    if (!autoPlay) return;
    const list = PHONEMES.filter(p => filter === 'all' || p.category === filter || (filter === 'silence' && p.category === 'silence'));
    let idx = 0;
    autoRef.current = setInterval(() => {
      idx = (idx + 1) % list.length;
      setSelected(list[idx].id);
    }, 1200);
    return () => clearInterval(autoRef.current);
  }, [autoPlay, filter]);

  const visible = PHONEMES.filter(p =>
    filter === 'all' || p.category === filter,
  );

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">← Flowen</Link>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300 text-sm font-mono">Viseme Reference</span>
        </div>
        <button
          onClick={() => setAutoPlay(v => !v)}
          className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
            autoPlay
              ? 'bg-emerald-500 text-slate-950'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          {autoPlay ? '⏸ pause' : '▶ auto-cycle'}
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">

        {/* Left: grid */}
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">42-State Viseme System</h1>
            <p className="text-slate-400 text-sm mt-1">
              ARKit-compatible blend shapes mapping 28 phoneme classes to 42 facial muscle parameters.
              Click any state to inspect all active parameters.
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {(['all', 'consonant', 'vowel', 'approximant', 'silence'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-mono font-bold capitalize transition-colors ${
                  filter === f
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                {f} {f !== 'all' && `(${PHONEMES.filter(p => p.category === f).length})`}
              </button>
            ))}
          </div>

          {/* Phoneme grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {visible.map(p => {
              const isSelected = selected === p.id;
              const staticBlend = buildTargetBlends(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => { setSelected(p.id); setAutoPlay(false); }}
                  className={`group relative rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? 'border-emerald-500/60 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                      : `${CATEGORY_COLORS[p.category]} hover:border-slate-600`
                  }`}
                >
                  {isSelected && (
                    <div className="absolute inset-0 rounded-xl ring-1 ring-emerald-500/30 pointer-events-none" />
                  )}
                  <div className="flex justify-center mb-2">
                    <VisemeMouth blends={isSelected ? animated : staticBlend} size={80} />
                  </div>
                  <div className="font-bold text-white text-sm">{p.id}</div>
                  <div className="text-slate-400 text-xs leading-tight mt-0.5">{p.label}</div>
                  <div className="font-mono text-xs text-emerald-400/80 mt-1">{p.ipa}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="lg:sticky lg:top-6 h-fit space-y-4">
          {/* Live mouth */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-white">{selected}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${CATEGORY_BADGE[selectedInfo.category]}`}>
                    {selectedInfo.category}
                  </span>
                </div>
                <div className="text-slate-400 text-sm mt-0.5">{selectedInfo.label}</div>
              </div>
              <span className="font-mono text-emerald-400 text-lg">{selectedInfo.ipa}</span>
            </div>

            <div className="flex justify-center bg-slate-950 rounded-xl py-4">
              <VisemeMouth blends={animated} size={160} />
            </div>

            <div className="mt-4 text-xs text-slate-500 font-mono">
              Examples: <span className="text-slate-300">{selectedInfo.examples}</span>
            </div>
          </div>

          {/* 42 blend parameters */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
              42 Active Blend Parameters
            </div>

            {BLEND_GROUPS.map(group => {
              const activeKeys = group.keys.filter(k => (target[k] ?? 0) > 0.01);
              return (
                <div key={group.label}>
                  <div className="text-xs text-slate-600 font-mono uppercase mb-2">{group.label}</div>
                  {activeKeys.length === 0 ? (
                    <div className="text-xs text-slate-700 italic">— all at rest</div>
                  ) : (
                    <div className="space-y-1.5">
                      {activeKeys.map(key => {
                        const v = animated[key] ?? 0;
                        const t = target[key] ?? 0;
                        return (
                          <div key={key} className="flex items-center gap-2">
                            <div className="text-xs text-slate-400 font-mono w-40 shrink-0 truncate">
                              {camelToLabel(key)}
                            </div>
                            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-75"
                                style={{ width: `${v * 100}%` }}
                              />
                            </div>
                            <div className="text-xs font-mono text-slate-500 w-8 text-right shrink-0">
                              {(t * 100).toFixed(0)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Show zero-value groups count */}
            {(() => {
              const totalActive = BLEND_GROUPS.flatMap(g => g.keys).filter(k => (target[k] ?? 0) > 0.01).length;
              return (
                <div className="pt-2 border-t border-slate-800 text-xs text-slate-600 font-mono">
                  {totalActive} / 42 parameters active
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
