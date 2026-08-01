export interface ProgrammeWeek {
  week: number;
  phase: string;
  title: string;
  stages: number[];
  targetSessions: number;
  targetMinutes: number;
  focus: string;
  tip: string;
}

export const PROGRAMME: ProgrammeWeek[] = [
  {
    week: 1, phase: 'Foundation', title: 'Diaphragmatic Breathing',
    stages: [1], targetSessions: 3, targetMinutes: 5,
    focus: 'Establish breath support and slow your speaking rate before adding any other techniques.',
    tip: 'Breathe from your belly, not your chest. 4 counts in through the nose, 6 counts out.',
  },
  {
    week: 2, phase: 'Foundation', title: 'Easy Onset',
    stages: [1, 2], targetSessions: 3, targetMinutes: 7,
    focus: 'Practise soft vocal starts. Hard glottal attacks increase block frequency — ease into every word.',
    tip: 'Imagine your voice "floating" into sound rather than being pushed.',
  },
  {
    week: 3, phase: 'Building', title: 'Light Articulatory Contacts',
    stages: [2, 3], targetSessions: 3, targetMinutes: 7,
    focus: 'Reduce contact pressure on plosive consonants (/p/, /b/, /t/, /d/, /k/, /g/).',
    tip: 'Your lips and tongue only need to barely touch — just enough to shape the sound.',
  },
  {
    week: 4, phase: 'Building', title: 'Pausing & Phrasing',
    stages: [3, 4], targetSessions: 4, targetMinutes: 10,
    focus: 'Group speech into short phrases of 3–5 words with deliberate pauses between them.',
    tip: 'Own the pause. Silence is not failure — it is part of fluent speech.',
  },
  {
    week: 5, phase: 'Integration', title: 'Combining Techniques',
    stages: [2, 3, 4], targetSessions: 4, targetMinutes: 10,
    focus: 'Layer easy onset, light contacts, and phrasing together in connected speech.',
    tip: 'If you feel a block coming, pause first — then use a light onset to continue.',
  },
  {
    week: 6, phase: 'Integration', title: 'Sustained Connected Speech',
    stages: [3, 4, 5], targetSessions: 4, targetMinutes: 12,
    focus: 'Apply all techniques across longer utterances without breaking natural flow.',
    tip: 'Stop monitoring individual sounds. Trust the techniques and focus on meaning.',
  },
  {
    week: 7, phase: 'Transfer', title: 'Conversational Flow',
    stages: [4, 5], targetSessions: 4, targetMinutes: 15,
    focus: 'Practise spontaneous, natural speech. Apply techniques without conscious monitoring.',
    tip: 'Describe your day, tell a story, or narrate anything. Real communication is the goal.',
  },
  {
    week: 8, phase: 'Maintenance', title: 'Building Fluency Confidence',
    stages: [5], targetSessions: 5, targetMinutes: 15,
    focus: 'Consolidate all gains. Focus on naturalness over perfection.',
    tip: 'Fluency is a skill, not a destination. Regular practice maintains and improves it.',
  },
];

export interface ProgrammeState {
  currentWeek: number;
  week: ProgrammeWeek;
  weekStartedAt: string;
  completedWeeks: number[];
  sessionsThisWeek: number;
  isComplete: boolean;
  canAdvance: boolean;
  progressPct: number;
}

export function computeProgrammeState(
  currentWeek: number,
  weekStartedAt: string,
  completedWeeks: number[],
  sessionsThisWeek: number,
): ProgrammeState {
  const clampedWeek = Math.min(Math.max(currentWeek, 1), PROGRAMME.length);
  const week = PROGRAMME[clampedWeek - 1];
  const isComplete = completedWeeks.length >= PROGRAMME.length;
  const canAdvance = sessionsThisWeek >= week.targetSessions && !isComplete;
  const progressPct = Math.round(((clampedWeek - 1) / PROGRAMME.length) * 100);
  return { currentWeek: clampedWeek, week, weekStartedAt, completedWeeks, sessionsThisWeek, isComplete, canAdvance, progressPct };
}

export function weekForSessionCount(totalSessions: number): number {
  let accum = 0;
  for (const w of PROGRAMME) {
    accum += w.targetSessions;
    if (totalSessions < accum) return w.week;
  }
  return PROGRAMME.length;
}

export const PROGRESSION_BPM_THRESHOLD = 3.5;
export const PROGRESSION_MIN_SESSION_S = 90;

export interface QualifiedSession {
  duration_seconds: number;
  total_blocks_detected: number;
}

export interface AutoAdvanceResult {
  advanced: boolean;
  newWeek?: number;
  weekTitle?: string;
  weekPhase?: string;
  nextStages?: number[];
  avgBpm?: number;
}

export function evaluateAutoAdvance(
  currentWeek: number,
  sessionsThisWeek: number,
  targetSessions: number,
  recentSessions: QualifiedSession[],
): AutoAdvanceResult {
  if (currentWeek >= PROGRAMME.length) return { advanced: false };
  if (sessionsThisWeek < targetSessions) return { advanced: false };

  const longSessions = recentSessions.filter(s => s.duration_seconds >= PROGRESSION_MIN_SESSION_S);

  // Require enough long-enough sessions to evaluate quality — short sessions
  // don't give a reliable BPM signal and shouldn't count toward advancement.
  if (longSessions.length < targetSessions) return { advanced: false };

  const avgBpm = longSessions.reduce(
    (sum, s) => sum + (s.duration_seconds > 0 ? s.total_blocks_detected / (s.duration_seconds / 60) : 0),
    0,
  ) / longSessions.length;
  if (avgBpm > PROGRESSION_BPM_THRESHOLD) return { advanced: false, avgBpm };

  const newWeek = currentWeek + 1;
  const nextWeek = PROGRAMME[newWeek - 1];
  return {
    advanced: true,
    newWeek,
    weekTitle: nextWeek.title,
    weekPhase: nextWeek.phase,
    nextStages: [...nextWeek.stages],
    avgBpm,
  };
}
