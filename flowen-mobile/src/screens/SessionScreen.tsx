/**
 * SessionScreen
 *
 * Two modes:
 *
 * PRACTICE MODE (default)
 *   - Owns FlowenAudio pipeline (PCM frames → WavEncoder → Whisper ASR)
 *   - Block counting via VAD falling edges
 *   - AI coach polling every 60 s
 *   - Post-session summary with BPM card, sparkline, transcript snippet
 *
 * CONVERSATION MODE
 *   - Joins an Agora RTC channel via react-native-agora
 *   - Starts a ConvoAI agent on the server (GPT-4o-mini + ElevenLabs TTS)
 *   - Full-duplex audio with the AI speech-therapy assistant
 *   - Mute/unmute button; no ASR or block counting
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAudioPipeline }    from '../lib/audio/AudioPipeline';
import { WavEncoder }          from '../lib/audio/WavEncoder';
import { useAgoraConvoAI }     from '../hooks/useAgoraConvoAI';
import type { UserProfile }    from '../../App';
import { supabase }            from '../../App';

// ── Constants ──────────────────────────────────────────────────────────────────

const API_BASE               = process.env.EXPO_PUBLIC_API_BASE ?? 'https://flowen.digital';
const ASR_FLUSH_MS           = 15_000;  // flush PCM buffer every 15 s
const ASR_MIN_BYTES          = 16_000;  // ~0.5 s of PCM — skip tiny flushes
const COACH_INTERVAL_MS      = 60_000;  // poll coach every 60 s
const DEFAULT_STAGE_ID       = 1;
const PROGRESSION_THRESHOLD  = 3.5;    // blocks/min — matches server-side value

// ── Session mode ───────────────────────────────────────────────────────────────

type SessionMode = 'practice' | 'conversation';

// ── Types ──────────────────────────────────────────────────────────────────────

type ScreenPhase = 'idle' | 'recording' | 'saving' | 'summary';

interface HistoricalSession {
  id: string;
  bpm: number;
  duration_seconds: number;
  created_at: string;
}

interface SessionResult {
  sessionId:       string;
  durationSeconds: number;
  blocksDetected:  number;
  bpm:             number;
  transcript:      string;
  progression:     { advanced: boolean; newWeek?: number } | null;
}

// ── BPM helpers ────────────────────────────────────────────────────────────────

function calcBpm(blocks: number, durationSecs: number): number {
  return durationSecs > 0 ? blocks / (durationSecs / 60) : 0;
}

/** Colour token for a BPM value relative to the progression threshold. */
function bpmColor(bpm: number): string {
  if (bpm === 0)                       return '#64748b'; // no data
  if (bpm < 2.0)                       return '#4ade80'; // excellent
  if (bpm <= PROGRESSION_THRESHOLD)    return '#fbbf24'; // on target
  return '#f87171';                                       // above threshold
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function apiFetch(path: string, body: unknown, token: string): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify(body),
  });
}

// ── SessionScreen ──────────────────────────────────────────────────────────────

interface Props {
  profile:   UserProfile;
  onSignOut: () => void;
}

export function SessionScreen({ profile, onSignOut }: Props) {
  const ORB = 152;
  const orbScale = useRef(new Animated.Value(1)).current;

  // Mode selection (idle-only toggle)
  const [sessionMode, setSessionMode] = useState<SessionMode>('practice');

  // Agora ConvoAI hook (conversation mode)
  const convoAI = useAgoraConvoAI();

  // Session accumulators (refs = no re-render on update)
  const elapsedRef      = useRef(0);
  const blocksRef       = useRef(0);
  const transcriptRef   = useRef('');
  const lastVadRef      = useRef(false);
  const lastCoachRef    = useRef<string | undefined>(undefined);
  const wavEncoderRef   = useRef(new WavEncoder());
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const coachTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const asrTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // UI state
  const [phase,          setPhase]         = useState<ScreenPhase>('idle');
  const [elapsedSecs,    setElapsedSecs]   = useState(0);
  const [blocksDetected, setBlocksDetected] = useState(0);
  const [transcript,     setTranscript]    = useState('');
  const [interimText,    setInterimText]   = useState(''); // "transcribing…" hint
  const [coachMsg,       setCoachMsg]      = useState<string | null>(null);
  const [result,         setResult]        = useState<SessionResult | null>(null);
  const [saveError,      setSaveError]     = useState<string | null>(null);
  const [history,        setHistory]       = useState<HistoricalSession[]>([]);

  // ── Fetch BPM history on mount ────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/api/practice/sessions?n=10`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json() as { sessions?: HistoricalSession[] };
          if (json.sessions) setHistory(json.sessions);
        }
      } catch { /* offline — history stays empty */ }
    })();
  }, []);

  // ── PCM frame callback (passed to AudioPipeline) ─────────────────────────────

  const handlePCMFrame = useCallback((base64: string) => {
    wavEncoderRef.current.push(base64);
  }, []);

  const pipeline = useAudioPipeline(handlePCMFrame);

  // ── Orb animation ─────────────────────────────────────────────────────────────

  useEffect(() => {
    Animated.spring(orbScale, {
      toValue:         1 + Math.min(pipeline.rms / 0.3, 1) * 0.5,
      useNativeDriver: true,
      tension:         80,
      friction:        6,
    }).start();
  }, [pipeline.rms, orbScale]);

  // ── Block counting (VAD falling edge) ────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'recording') return;
    if (lastVadRef.current && !pipeline.isVoiceActive) {
      blocksRef.current += 1;
      setBlocksDetected(blocksRef.current);
    }
    lastVadRef.current = pipeline.isVoiceActive;
  }, [pipeline.isVoiceActive, phase]);

  // ── ASR flush ─────────────────────────────────────────────────────────────────

  const flushASR = useCallback(async () => {
    const enc = wavEncoderRef.current;
    if (enc.bytes < ASR_MIN_BYTES) return; // too short to transcribe
    const wavBase64 = enc.flush();         // resets encoder
    if (!wavBase64) return;

    const durationSeconds = enc.durationSeconds; // captured before reset
    setInterimText('Transcribing…');
    const token = await getToken();
    if (!token) { setInterimText(''); return; }

    try {
      const res = await apiFetch('/api/practice/asr', { audio: wavBase64, durationSeconds }, token);
      if (res.ok) {
        const json = await res.json() as { text?: string };
        const text = (json.text ?? '').trim();
        if (text) {
          transcriptRef.current = `${transcriptRef.current} ${text}`.trim();
          setTranscript(transcriptRef.current);
        }
      }
    } catch { /* network error — skip, next flush will catch up */ }

    setInterimText('');
  }, []);

  // ── Coach polling ─────────────────────────────────────────────────────────────

  const fetchCoach = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await apiFetch('/api/practice/coach', {
        stageId:           DEFAULT_STAGE_ID,
        transcript:        transcriptRef.current.slice(-400),
        sessionElapsed:    elapsedRef.current,
        lastCoachResponse: lastCoachRef.current,
      }, token);
      if (res.ok) {
        const json = await res.json() as { reply?: string };
        if (json.reply) {
          setCoachMsg(json.reply);
          lastCoachRef.current = json.reply;
        }
      }
    } catch { /* skip */ }
  }, []);

  // ── Start ─────────────────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    // Reset shared state
    elapsedRef.current     = 0;
    blocksRef.current      = 0;
    transcriptRef.current  = '';
    lastVadRef.current     = false;
    lastCoachRef.current   = undefined;
    wavEncoderRef.current.reset();
    setElapsedSecs(0);
    setBlocksDetected(0);
    setTranscript('');
    setInterimText('');
    setCoachMsg(null);
    setResult(null);
    setSaveError(null);

    if (sessionMode === 'conversation') {
      // ── Conversation mode: join Agora + start ConvoAI agent ──────────────
      const token = await getToken();
      if (!token) {
        setSaveError('Could not authenticate');
        return;
      }
      await convoAI.join(token);
      if (convoAI.status !== 'error') {
        setPhase('recording');
        timerRef.current = setInterval(() => {
          elapsedRef.current += 1;
          setElapsedSecs(elapsedRef.current);
        }, 1000);
      }
      return;
    }

    // ── Practice mode: FlowenAudio + ASR + coach ──────────────────────────
    await pipeline.start();
    setPhase('recording');

    timerRef.current      = setInterval(() => {
      elapsedRef.current += 1;
      setElapsedSecs(elapsedRef.current);
    }, 1000);

    asrTimerRef.current   = setInterval(flushASR, ASR_FLUSH_MS);
    coachTimerRef.current = setInterval(fetchCoach, COACH_INTERVAL_MS);
    setTimeout(fetchCoach, 12_000); // first coach message after 12 s
  }, [sessionMode, pipeline, flushASR, fetchCoach, convoAI]);

  // ── Stop + save ───────────────────────────────────────────────────────────────

  const handleStop = useCallback(async () => {
    if (timerRef.current)     { clearInterval(timerRef.current);     timerRef.current     = null; }
    if (asrTimerRef.current)  { clearInterval(asrTimerRef.current);  asrTimerRef.current  = null; }
    if (coachTimerRef.current){ clearInterval(coachTimerRef.current); coachTimerRef.current = null; }

    if (sessionMode === 'conversation') {
      // ── Conversation mode: leave Agora channel + stop agent ───────────────
      await convoAI.leave();
      setPhase('idle'); // no summary for conversation sessions currently
      return;
    }

    await pipeline.stop();
    setPhase('saving');

    // Flush any remaining audio before saving
    await flushASR();

    const durationSeconds = elapsedRef.current;
    const blocks          = blocksRef.current;
    const fullTranscript  = transcriptRef.current;

    if (durationSeconds < 5) { setPhase('idle'); return; }

    const token = await getToken();
    if (!token) {
      setSaveError('Could not authenticate — session not saved.');
      setPhase('summary');
      return;
    }

    try {
      const res = await apiFetch('/api/practice/sessions', {
        duration_seconds:      durationSeconds,
        total_blocks_detected: blocks,
        stage_id:              DEFAULT_STAGE_ID,
        transcript:            fullTranscript.slice(0, 20_000) || undefined,
      }, token);

      const json = await res.json() as {
        ok?: boolean;
        session?: { id: string };
        progression?: { advanced: boolean; newWeek?: number } | null;
        error?: string;
      };

      if (!res.ok || !json.ok) {
        setSaveError(json.error ?? `Server error ${res.status}`);
      } else {
        setResult({
          sessionId:       json.session?.id ?? '',
          durationSeconds,
          blocksDetected:  blocks,
          bpm:             calcBpm(blocks, durationSeconds),
          transcript:      fullTranscript,
          progression:     json.progression ?? null,
        });
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Network error');
    }

    setPhase('summary');
  }, [sessionMode, pipeline, flushASR, convoAI]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────

  useEffect(() => () => {
    if (timerRef.current)     clearInterval(timerRef.current);
    if (asrTimerRef.current)  clearInterval(asrTimerRef.current);
    if (coachTimerRef.current) clearInterval(coachTimerRef.current);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────────

  const isRecording = phase === 'recording';
  const isSaving    = phase === 'saving';

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>FLOWEN</Text>
        <Pressable onPress={onSignOut} hitSlop={12}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Tier chip */}
        <View style={styles.tierChip}>
          <Text style={styles.tierText}>
            {profile.display_name ? `${profile.display_name} · ` : ''}{profile.tier}
          </Text>
        </View>

        {/* ── Summary ── */}
        {phase === 'summary' && (
          <View style={styles.summaryBox}>
            {saveError ? (
              <>
                <Text style={styles.summaryEmoji}>⚠️</Text>
                <Text style={styles.summaryHeading}>Session not saved</Text>
                <Text style={styles.summaryBody}>{saveError}</Text>
              </>
            ) : result ? (
              <>
                <Text style={styles.summaryEmoji}>🎉</Text>
                <Text style={styles.summaryHeading}>Session complete</Text>

                {/* Stats row: duration + blocks */}
                <View style={styles.statsRow}>
                  <Metric label="Duration" value={fmt(result.durationSeconds)} />
                  <Metric label="Blocks"   value={`${result.blocksDetected}`} />
                </View>

                {/* BPM card */}
                <BpmCard bpm={result.bpm} history={history} />

                {/* Progression banner */}
                {result.progression?.advanced && (
                  <View style={styles.progressionBanner}>
                    <Text style={styles.progressionText}>
                      🏆 Advanced to week {result.progression.newWeek}!
                    </Text>
                  </View>
                )}

                {/* Transcript snippet */}
                {result.transcript.length > 0 && (
                  <View style={styles.transcriptBox}>
                    <Text style={styles.transcriptLabel}>TRANSCRIPT</Text>
                    <Text style={styles.transcriptText} numberOfLines={6}>
                      {result.transcript}
                    </Text>
                  </View>
                )}
              </>
            ) : null}
            <Pressable style={styles.cta} onPress={() => setPhase('idle')}>
              <Text style={styles.ctaText}>New Session</Text>
            </Pressable>
          </View>
        )}

        {/* ── Recording / Idle ── */}
        {phase !== 'summary' && (
          <>
            {/* Mode toggle — only visible when idle */}
            {phase === 'idle' && (
              <ModeToggle
                mode={sessionMode}
                onChange={setSessionMode}
              />
            )}

            {/* ── CONVERSATION MODE recording UI ── */}
            {sessionMode === 'conversation' && isRecording ? (
              <>
                <View style={styles.convoOrbWrap}>
                  <Animated.View
                    style={[
                      styles.glow,
                      {
                        width: ORB, height: ORB, borderRadius: ORB / 2,
                        transform: [{ scale: orbScale }],
                        opacity:   0.7,
                        backgroundColor: '#7c3aed',
                        shadowColor:     '#7c3aed',
                      },
                    ]}
                  />
                  <View style={[styles.core, { backgroundColor: '#ddd6fe' }]} />
                </View>

                <Text style={styles.convoStatus}>
                  {convoAI.status === 'joining' ? '⏳ Connecting…' : '🤖 AI Coach active'}
                </Text>

                <MetricPill label="Time" value={fmt(elapsedSecs)} />

                {/* Mute toggle */}
                <Pressable
                  style={[styles.muteBtn, convoAI.isMuted && styles.muteBtnActive]}
                  onPress={convoAI.toggleMute}
                >
                  <Text style={styles.muteBtnText}>
                    {convoAI.isMuted ? '🔇 Unmute' : '🎙 Mute'}
                  </Text>
                </Pressable>

                {/* ConvoAI error */}
                {convoAI.error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{convoAI.error}</Text>
                  </View>
                )}

                {/* Stop */}
                <Pressable style={[styles.cta, styles.ctaStop]} onPress={handleStop}>
                  <Text style={styles.ctaText}>End Conversation</Text>
                </Pressable>
              </>
            ) : (
              <>
                {/* ── PRACTICE MODE (or idle) UI ── */}

                {/* Pacer orb */}
                <View style={[styles.orbWrap, { width: ORB, height: ORB }]}>
                  <Animated.View
                    style={[
                      styles.glow,
                      {
                        width: ORB, height: ORB, borderRadius: ORB / 2,
                        transform:   [{ scale: orbScale }],
                        opacity:     Math.min(0.2 + pipeline.rms * 2.5, 0.9),
                      },
                    ]}
                  />
                  <View style={styles.core} />
                </View>

                {/* Live metrics */}
                {isRecording && (
                  <View style={styles.metricsRow}>
                    <MetricPill label="Time"   value={fmt(elapsedSecs)} />
                    <MetricPill label="Blocks" value={`${blocksDetected}`} />
                    <MetricPill
                      label="Blk/min"
                      value={elapsedSecs >= 10
                        ? calcBpm(blocksDetected, elapsedSecs).toFixed(1)
                        : '—'}
                      color={elapsedSecs >= 10
                        ? bpmColor(calcBpm(blocksDetected, elapsedSecs))
                        : undefined}
                    />
                  </View>
                )}

                {/* VAD */}
                <Text style={[styles.vad, pipeline.isVoiceActive && styles.vadActive]}>
                  {isRecording
                    ? pipeline.isVoiceActive ? '● Voice detected' : '○ Listening…'
                    : sessionMode === 'conversation'
                    ? 'Speak with your AI coach'
                    : 'Ready to start'}
                </Text>

                {/* Meter */}
                <View style={styles.meterTrack}>
                  <View
                    style={[
                      styles.meterFill,
                      { height: `${Math.max(0, (pipeline.decibelLevel + 60) / 60) * 100}%` },
                    ]}
                  />
                </View>

                {/* Live transcript + interim */}
                {isRecording && (transcript || interimText) && (
                  <View style={styles.captionBox}>
                    {transcript.length > 0 && (
                      <Text style={styles.captionText} numberOfLines={4}>
                        {transcript}
                      </Text>
                    )}
                    {interimText.length > 0 && (
                      <Text style={styles.interimText}>{interimText}</Text>
                    )}
                  </View>
                )}

                {/* Coach */}
                {coachMsg && (
                  <View style={styles.coachBox}>
                    <Text style={styles.coachLabel}>COACH</Text>
                    <Text style={styles.coachText}>{coachMsg}</Text>
                  </View>
                )}

                {/* Pipeline error */}
                {pipeline.error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{pipeline.error}</Text>
                  </View>
                )}

                {/* CTA */}
                <Pressable
                  style={[styles.cta, isRecording && styles.ctaStop, isSaving && styles.ctaDisabled]}
                  onPress={isRecording ? handleStop : handleStart}
                  disabled={isSaving}
                >
                  {isSaving
                    ? <ActivityIndicator color="#ffffff" />
                    : <Text style={styles.ctaText}>
                        {isRecording ? 'Stop Session' : 'Start Session'}
                      </Text>
                  }
                </Pressable>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

// ── ModeToggle ─────────────────────────────────────────────────────────────────

function ModeToggle({
  mode,
  onChange,
}: { mode: SessionMode; onChange: (m: SessionMode) => void }) {
  return (
    <View style={styles.modeRow}>
      <Pressable
        style={[styles.modeTab, mode === 'practice' && styles.modeTabActive]}
        onPress={() => onChange('practice')}
      >
        <Text style={[styles.modeTabText, mode === 'practice' && styles.modeTabTextActive]}>
          🎙 Practice
        </Text>
      </Pressable>
      <Pressable
        style={[styles.modeTab, mode === 'conversation' && styles.modeTabActive]}
        onPress={() => onChange('conversation')}
      >
        <Text style={[styles.modeTabText, mode === 'conversation' && styles.modeTabTextActive]}>
          🤖 Conversation
        </Text>
      </Pressable>
    </View>
  );
}

function MetricPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * BpmCard — shows this session's BPM vs historical average.
 *
 * Colour coding (matches server-side PROGRESSION_BPM_THRESHOLD = 3.5):
 *   < 2.0  → emerald   (excellent)
 *   2–3.5  → amber     (on target for progression)
 *   > 3.5  → red       (above threshold, won't advance this week)
 */
function BpmCard({ bpm, history }: { bpm: number; history: HistoricalSession[] }) {
  const color = bpmColor(bpm);

  // Avg BPM from up to last 10 sessions (exclude 0-duration outliers)
  const validHistory = history.filter(s => s.duration_seconds >= 10);
  const avgBpm       = validHistory.length > 0
    ? validHistory.reduce((sum, s) => sum + s.bpm, 0) / validHistory.length
    : null;

  // Delta: negative = improved (fewer blocks/min)
  const delta = avgBpm !== null ? bpm - avgBpm : null;

  const label = bpm < 2.0
    ? 'Excellent — very few blocks'
    : bpm <= PROGRESSION_THRESHOLD
    ? `On target — under ${PROGRESSION_THRESHOLD} blk/min`
    : `Above ${PROGRESSION_THRESHOLD} blk/min threshold`;

  return (
    <View style={styles.bpmCard}>
      <Text style={styles.bpmCardLabel}>BLOCKS / MINUTE</Text>
      <Text style={[styles.bpmValue, { color }]}>{bpm.toFixed(1)}</Text>
      <Text style={styles.bpmSubLabel}>{label}</Text>

      {avgBpm !== null && (
        <View style={styles.bpmHistoryRow}>
          <Text style={styles.bpmHistoryText}>
            Your avg ({validHistory.length} sessions): {avgBpm.toFixed(1)} blk/min
          </Text>
          {delta !== null && Math.abs(delta) >= 0.1 && (
            <Text style={[styles.bpmDelta, { color: delta < 0 ? '#4ade80' : '#f87171' }]}>
              {delta < 0 ? `↓ ${Math.abs(delta).toFixed(1)} better` : `↑ ${delta.toFixed(1)} higher`}
            </Text>
          )}
        </View>
      )}

      {/* Mini sparkline — last 7 sessions newest on right */}
      {validHistory.length >= 2 && (
        <BpmSparkline sessions={[...validHistory].reverse().slice(-7)} current={bpm} />
      )}
    </View>
  );
}

function BpmSparkline({
  sessions, current,
}: { sessions: HistoricalSession[]; current: number }) {
  const all     = [...sessions.map(s => s.bpm), current];
  const maxVal  = Math.max(...all, PROGRESSION_THRESHOLD, 1);

  return (
    <View style={styles.sparkline}>
      {sessions.map((s, i) => {
        const h = Math.max(4, Math.min(40, (s.bpm / maxVal) * 40));
        return (
          <View key={s.id ?? i} style={styles.sparklineBarWrap}>
            <View style={[styles.sparklineBar, { height: h, backgroundColor: bpmColor(s.bpm) }]} />
          </View>
        );
      })}
      {/* Current session bar — slightly wider */}
      <View style={[styles.sparklineBarWrap, { width: 10 }]}>
        <View style={[
          styles.sparklineBar,
          { height: Math.max(4, Math.min(40, (current / maxVal) * 40)), backgroundColor: bpmColor(current), borderRadius: 3 },
        ]} />
      </View>
      {/* Threshold line label */}
      <Text style={[styles.sparklineThreshold, { bottom: Math.max(4, Math.min(40, (PROGRESSION_THRESHOLD / maxVal) * 40)) }]}>
        — {PROGRESSION_THRESHOLD}
      </Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  wordmark: { fontSize: 18, fontWeight: '900', color: '#ffffff', letterSpacing: 3 },
  signOut:  { fontSize: 13, color: '#475569' },

  scroll: {
    alignItems: 'center', paddingHorizontal: 24, paddingBottom: 40,
    gap: 16, flexGrow: 1, justifyContent: 'center',
  },

  tierChip: {
    backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b',
    borderRadius: 20, paddingVertical: 4, paddingHorizontal: 12,
  },
  tierText: {
    fontSize: 11, color: '#64748b', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1,
  },

  // Orb
  orbWrap: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute', backgroundColor: '#2563eb',
    shadowColor: '#3b82f6', shadowRadius: 40, shadowOpacity: 0.7,
    shadowOffset: { width: 0, height: 0 }, elevation: 12,
  },
  core: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#bfdbfe',
    shadowColor: '#93c5fd', shadowRadius: 12, shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
  },

  // Metrics
  metricsRow: { flexDirection: 'row', gap: 24, justifyContent: 'center' },
  metric:      { alignItems: 'center' },
  metricValue: {
    fontSize: 20, fontWeight: '800', color: '#f1f5f9',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: { fontSize: 10, color: '#475569', marginTop: 2, letterSpacing: 0.5 },

  // VAD / meter
  vad:      { fontSize: 13, color: '#334155', fontWeight: '600' },
  vadActive: { color: '#22d3ee' },
  meterTrack: {
    width: 12, height: 80, backgroundColor: '#0f172a',
    borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end',
  },
  meterFill: { width: '100%', backgroundColor: '#22d3ee', borderRadius: 4 },

  // Captions
  captionBox: {
    backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b',
    borderRadius: 14, padding: 14, width: '100%',
  },
  captionText:  { fontSize: 13, color: '#cbd5e1', lineHeight: 20 },
  interimText:  { fontSize: 12, color: '#475569', fontStyle: 'italic', marginTop: 4 },

  // Coach
  coachBox: {
    backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b',
    borderRadius: 16, padding: 16, width: '100%',
  },
  coachLabel: { fontSize: 9, color: '#3b82f6', fontWeight: '700', letterSpacing: 2, marginBottom: 6 },
  coachText:  { fontSize: 14, color: '#cbd5e1', lineHeight: 22 },

  // Error
  errorBox:  { backgroundColor: '#450a0a', borderRadius: 10, padding: 12, width: '100%' },
  errorText: { color: '#fca5a5', fontSize: 12, textAlign: 'center' },

  // CTA
  cta: {
    backgroundColor: '#3b82f6', paddingVertical: 15, paddingHorizontal: 40,
    borderRadius: 14, alignItems: 'center', minWidth: 180,
  },
  ctaStop:     { backgroundColor: '#ef4444' },
  ctaDisabled: { opacity: 0.6 },
  ctaText:     { color: '#ffffff', fontSize: 15, fontWeight: '700' },

  // Summary
  summaryBox:    { alignItems: 'center', gap: 16, width: '100%' },
  summaryEmoji:  { fontSize: 52 },
  summaryHeading:{ fontSize: 22, fontWeight: '800', color: '#ffffff', textAlign: 'center' },
  summaryBody:   { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 22 },
  statsRow:      { flexDirection: 'row', gap: 32, justifyContent: 'center', marginTop: 4 },
  stat:          { alignItems: 'center' },
  statValue:     { fontSize: 28, fontWeight: '900', color: '#f1f5f9', fontVariant: ['tabular-nums'] },
  statLabel:     { fontSize: 11, color: '#475569', marginTop: 2, letterSpacing: 0.5, textTransform: 'uppercase' },
  progressionBanner: {
    backgroundColor: '#052e16', borderWidth: 1, borderColor: '#16a34a',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20,
  },
  progressionText: { color: '#4ade80', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  transcriptBox: {
    backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b',
    borderRadius: 12, padding: 14, width: '100%',
  },
  transcriptLabel: { fontSize: 9, color: '#475569', fontWeight: '700', letterSpacing: 2, marginBottom: 6 },
  transcriptText:  { fontSize: 13, color: '#64748b', lineHeight: 20 },

  // BPM card
  bpmCard: {
    backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b',
    borderRadius: 16, padding: 16, width: '100%', alignItems: 'center',
  },
  bpmCardLabel:    { fontSize: 9, color: '#475569', fontWeight: '700', letterSpacing: 2, marginBottom: 6 },
  bpmValue:        { fontSize: 40, fontWeight: '900', fontVariant: ['tabular-nums'] },
  bpmSubLabel:     { fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center' },
  bpmHistoryRow:   { marginTop: 10, alignItems: 'center', gap: 4 },
  bpmHistoryText:  { fontSize: 11, color: '#475569' },
  bpmDelta:        { fontSize: 12, fontWeight: '700' },

  // Sparkline
  sparkline: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 3,
    marginTop: 14, height: 44, width: '100%',
  },
  sparklineBarWrap: { width: 7, alignItems: 'center', justifyContent: 'flex-end' },
  sparklineBar:     { width: '100%', borderRadius: 2 },
  sparklineThreshold: {
    position: 'absolute', right: 0,
    fontSize: 8, color: '#64748b',
  },

  // Mode toggle
  modeRow: {
    flexDirection: 'row', borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#1e293b',
  },
  modeTab: {
    flex: 1, paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  modeTabActive: { backgroundColor: '#1e3a5f' },
  modeTabText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  modeTabTextActive: { color: '#93c5fd' },

  // Conversation mode
  convoOrbWrap: { alignItems: 'center', justifyContent: 'center', width: 152, height: 152 },
  convoStatus: { fontSize: 14, color: '#a78bfa', fontWeight: '600', marginTop: 4 },
  muteBtn: {
    borderWidth: 1, borderColor: '#334155', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 28, backgroundColor: '#0f172a',
  },
  muteBtnActive: { borderColor: '#ef4444', backgroundColor: '#450a0a' },
  muteBtnText:   { fontSize: 14, color: '#e2e8f0', fontWeight: '600' },
});
