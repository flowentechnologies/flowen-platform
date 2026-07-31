// ============================================================================
// viseme.ts — 42-parameter ARKit-style viseme system for speech therapy avatar
// ============================================================================

// ----------------------------------------------------------------------------
// A. VisemeBlends type (42 numeric fields, 0–1 range)
// ----------------------------------------------------------------------------

export interface VisemeBlends {
  // Jaw (4)
  jawOpen: number;
  jawForward: number;
  jawLeft: number;
  jawRight: number;

  // Mouth shape (15)
  mouthClose: number;
  mouthFunnel: number;
  mouthPucker: number;
  mouthLeft: number;
  mouthRight: number;
  mouthSmileLeft: number;
  mouthSmileRight: number;
  mouthFrownLeft: number;
  mouthFrownRight: number;
  mouthDimpleLeft: number;
  mouthDimpleRight: number;
  mouthStretchLeft: number;
  mouthStretchRight: number;
  mouthRollLower: number;
  mouthRollUpper: number;

  // Mouth pressure (8)
  mouthShrugLower: number;
  mouthShrugUpper: number;
  mouthPressLeft: number;
  mouthPressRight: number;
  mouthLowerDownLeft: number;
  mouthLowerDownRight: number;
  mouthUpperUpLeft: number;
  mouthUpperUpRight: number;

  // Cheek (3)
  cheekPuff: number;
  cheekSquintLeft: number;
  cheekSquintRight: number;

  // Nose (2)
  noseSneerLeft: number;
  noseSneerRight: number;

  // Tongue (10)
  tongueOut: number;
  tongueUp: number;
  tongueDown: number;
  tongueLeft: number;
  tongueRight: number;
  tongueRoll: number;
  tongueBendDown: number;
  tongueCurlUp: number;
  tongueSquish: number;
  tongueFlat: number;
}

// ----------------------------------------------------------------------------
// B. ZERO_BLENDS — rest/silence pose
// ----------------------------------------------------------------------------

export const ZERO_BLENDS: VisemeBlends = {
  jawOpen: 0, jawForward: 0, jawLeft: 0, jawRight: 0,
  mouthClose: 0, mouthFunnel: 0, mouthPucker: 0, mouthLeft: 0, mouthRight: 0,
  mouthSmileLeft: 0, mouthSmileRight: 0, mouthFrownLeft: 0, mouthFrownRight: 0,
  mouthDimpleLeft: 0, mouthDimpleRight: 0, mouthStretchLeft: 0, mouthStretchRight: 0,
  mouthRollLower: 0, mouthRollUpper: 0,
  mouthShrugLower: 0, mouthShrugUpper: 0, mouthPressLeft: 0, mouthPressRight: 0,
  mouthLowerDownLeft: 0, mouthLowerDownRight: 0, mouthUpperUpLeft: 0, mouthUpperUpRight: 0,
  cheekPuff: 0, cheekSquintLeft: 0, cheekSquintRight: 0,
  noseSneerLeft: 0, noseSneerRight: 0,
  tongueOut: 0, tongueUp: 0, tongueDown: 0, tongueLeft: 0, tongueRight: 0,
  tongueRoll: 0, tongueBendDown: 0, tongueCurlUp: 0, tongueSquish: 0, tongueFlat: 0,
};

// ----------------------------------------------------------------------------
// C. Phoneme classes & named viseme targets
// ----------------------------------------------------------------------------

export type PhonemeClass =
  | 'SIL' | 'PP' | 'FF' | 'TH' | 'DD' | 'KK' | 'CH' | 'SS' | 'NN' | 'RR'
  | 'AA' | 'AE' | 'AH' | 'AO' | 'AW' | 'AY' | 'EH' | 'ER' | 'EY' | 'IH'
  | 'IY' | 'OW' | 'OY' | 'UH' | 'UW' | 'WW' | 'YY' | 'HH';

export const VISEME_TARGETS: Record<PhonemeClass, Partial<VisemeBlends>> = {
  SIL: {},

  PP: {
    mouthClose: 1.0,
    mouthPressLeft: 0.5,
    mouthPressRight: 0.5,
  },

  FF: {
    jawOpen: 0.1,
    mouthLowerDownLeft: 0.4,
    mouthLowerDownRight: 0.4,
    mouthUpperUpLeft: 0.15,
    mouthUpperUpRight: 0.15,
  },

  TH: {
    jawOpen: 0.2,
    mouthLowerDownLeft: 0.3,
    mouthLowerDownRight: 0.3,
    tongueOut: 0.6,
    tongueFlat: 0.5,
  },

  DD: {
    jawOpen: 0.15,
    mouthClose: 0.2,
    tongueUp: 0.85,
    tongueCurlUp: 0.3,
  },

  KK: {
    jawOpen: 0.3,
    mouthStretchLeft: 0.2,
    mouthStretchRight: 0.2,
    tongueUp: 0.3,
    tongueBendDown: 0.6,
  },

  CH: {
    jawOpen: 0.2,
    mouthFunnel: 0.3,
    mouthPucker: 0.2,
    mouthStretchLeft: 0.15,
    mouthStretchRight: 0.15,
    tongueUp: 0.5,
  },

  SS: {
    jawOpen: 0.12,
    mouthStretchLeft: 0.3,
    mouthStretchRight: 0.3,
    mouthLowerDownLeft: 0.15,
    mouthLowerDownRight: 0.15,
    tongueUp: 0.6,
    tongueFlat: 0.4,
  },

  NN: {
    jawOpen: 0.1,
    mouthClose: 0.3,
    tongueUp: 0.9,
    tongueFlat: 0.5,
  },

  RR: {
    jawOpen: 0.25,
    mouthFunnel: 0.2,
    mouthPucker: 0.1,
    tongueUp: 0.3,
    tongueRoll: 0.7,
    tongueCurlUp: 0.6,
  },

  AA: {
    jawOpen: 0.85,
    mouthStretchLeft: 0.35,
    mouthStretchRight: 0.35,
    mouthUpperUpLeft: 0.2,
    mouthUpperUpRight: 0.2,
    mouthLowerDownLeft: 0.3,
    mouthLowerDownRight: 0.3,
  },

  AE: {
    jawOpen: 0.75,
    mouthStretchLeft: 0.45,
    mouthStretchRight: 0.45,
    mouthSmileLeft: 0.2,
    mouthSmileRight: 0.2,
    mouthLowerDownLeft: 0.25,
    mouthLowerDownRight: 0.25,
  },

  AH: {
    jawOpen: 0.65,
    mouthStretchLeft: 0.2,
    mouthStretchRight: 0.2,
    mouthUpperUpLeft: 0.1,
    mouthUpperUpRight: 0.1,
    mouthLowerDownLeft: 0.2,
    mouthLowerDownRight: 0.2,
  },

  AO: {
    jawOpen: 0.7,
    mouthFunnel: 0.5,
    mouthPucker: 0.2,
    mouthShrugLower: 0.2,
    mouthShrugUpper: 0.15,
  },

  AW: {
    jawOpen: 0.7,
    mouthFunnel: 0.6,
    mouthPucker: 0.45,
    mouthShrugUpper: 0.2,
    mouthShrugLower: 0.3,
  },

  AY: {
    jawOpen: 0.6,
    mouthStretchLeft: 0.3,
    mouthStretchRight: 0.3,
    mouthSmileLeft: 0.35,
    mouthSmileRight: 0.35,
    mouthUpperUpLeft: 0.15,
    mouthUpperUpRight: 0.15,
  },

  EH: {
    jawOpen: 0.5,
    mouthStretchLeft: 0.35,
    mouthStretchRight: 0.35,
    mouthSmileLeft: 0.15,
    mouthSmileRight: 0.15,
    mouthLowerDownLeft: 0.15,
    mouthLowerDownRight: 0.15,
  },

  ER: {
    jawOpen: 0.35,
    mouthFunnel: 0.15,
    mouthPucker: 0.1,
    tongueRoll: 0.5,
    tongueCurlUp: 0.4,
  },

  EY: {
    jawOpen: 0.3,
    mouthSmileLeft: 0.5,
    mouthSmileRight: 0.5,
    mouthStretchLeft: 0.3,
    mouthStretchRight: 0.3,
    mouthUpperUpLeft: 0.1,
    mouthUpperUpRight: 0.1,
  },

  IH: {
    jawOpen: 0.2,
    mouthSmileLeft: 0.45,
    mouthSmileRight: 0.45,
    mouthStretchLeft: 0.2,
    mouthStretchRight: 0.2,
  },

  IY: {
    jawOpen: 0.15,
    mouthSmileLeft: 0.7,
    mouthSmileRight: 0.7,
    mouthStretchLeft: 0.4,
    mouthStretchRight: 0.4,
    mouthDimpleLeft: 0.2,
    mouthDimpleRight: 0.2,
  },

  OW: {
    jawOpen: 0.45,
    mouthFunnel: 0.7,
    mouthPucker: 0.55,
    mouthShrugUpper: 0.25,
    mouthShrugLower: 0.2,
  },

  OY: {
    jawOpen: 0.5,
    mouthFunnel: 0.55,
    mouthPucker: 0.4,
    mouthSmileLeft: 0.2,
    mouthSmileRight: 0.2,
  },

  UH: {
    jawOpen: 0.4,
    mouthFunnel: 0.55,
    mouthPucker: 0.4,
    mouthShrugLower: 0.15,
    mouthShrugUpper: 0.1,
  },

  UW: {
    jawOpen: 0.2,
    mouthFunnel: 0.85,
    mouthPucker: 0.75,
    mouthShrugUpper: 0.3,
    mouthShrugLower: 0.25,
  },

  WW: {
    jawOpen: 0.25,
    mouthFunnel: 0.75,
    mouthPucker: 0.65,
    mouthShrugUpper: 0.2,
    mouthShrugLower: 0.2,
  },

  YY: {
    jawOpen: 0.2,
    mouthSmileLeft: 0.3,
    mouthSmileRight: 0.3,
    mouthStretchLeft: 0.25,
    mouthStretchRight: 0.25,
    tongueUp: 0.5,
    tongueFlat: 0.4,
  },

  HH: {
    jawOpen: 0.45,
    mouthStretchLeft: 0.15,
    mouthStretchRight: 0.15,
    mouthShrugLower: 0.1,
    mouthShrugUpper: 0.1,
  },
};

// ----------------------------------------------------------------------------
// D. ARPABET_MAP — ARPAbet phones to phoneme classes
// ----------------------------------------------------------------------------

export const ARPABET_MAP: Record<string, PhonemeClass> = {
  // Vowels — AA
  AA: 'AA', AA0: 'AA', AA1: 'AA', AA2: 'AA',
  // Vowels — AE
  AE: 'AE', AE0: 'AE', AE1: 'AE', AE2: 'AE',
  // Vowels — AH
  AH: 'AH', AH0: 'AH', AH1: 'AH', AH2: 'AH',
  // Vowels — AO
  AO: 'AO', AO0: 'AO', AO1: 'AO', AO2: 'AO',
  // Vowels — AW
  AW: 'AW', AW0: 'AW', AW1: 'AW', AW2: 'AW',
  // Vowels — AY
  AY: 'AY', AY0: 'AY', AY1: 'AY', AY2: 'AY',
  // Consonant — B (bilabial plosive → PP)
  B: 'PP',
  // Consonant — CH (affricate)
  CH: 'CH',
  // Consonant — D (alveolar plosive → DD)
  D: 'DD',
  // Consonant — DH (voiced dental fricative → TH)
  DH: 'TH',
  // Vowels — EH
  EH: 'EH', EH0: 'EH', EH1: 'EH', EH2: 'EH',
  // Vowels — ER
  ER: 'ER', ER0: 'ER', ER1: 'ER', ER2: 'ER',
  // Vowels — EY
  EY: 'EY', EY0: 'EY', EY1: 'EY', EY2: 'EY',
  // Consonant — F (labiodental fricative)
  F: 'FF',
  // Consonant — G (velar plosive → KK)
  G: 'KK',
  // Consonant — HH
  HH: 'HH',
  // Vowels — IH
  IH: 'IH', IH0: 'IH', IH1: 'IH', IH2: 'IH',
  // Vowels — IY
  IY: 'IY', IY0: 'IY', IY1: 'IY', IY2: 'IY',
  // Consonant — JH (voiced affricate → CH)
  JH: 'CH',
  // Consonant — K (velar plosive)
  K: 'KK',
  // Consonant — L (lateral → NN)
  L: 'NN',
  // Consonant — M (bilabial nasal → PP)
  M: 'PP',
  // Consonant — N (alveolar nasal)
  N: 'NN',
  // Consonant — NG (velar nasal → NN)
  NG: 'NN',
  // Vowels — OW
  OW: 'OW', OW0: 'OW', OW1: 'OW', OW2: 'OW',
  // Vowels — OY
  OY: 'OY', OY0: 'OY', OY1: 'OY', OY2: 'OY',
  // Consonant — P (bilabial plosive)
  P: 'PP',
  // Consonant — R (rhotic)
  R: 'RR',
  // Consonant — S (sibilant fricative)
  S: 'SS',
  // Consonant — SH (palatal sibilant → CH)
  SH: 'CH',
  // Consonant — T (alveolar plosive → DD)
  T: 'DD',
  // Consonant — TH (dental fricative)
  TH: 'TH',
  // Vowels — UH
  UH: 'UH', UH0: 'UH', UH1: 'UH', UH2: 'UH',
  // Vowels — UW
  UW: 'UW', UW0: 'UW', UW1: 'UW', UW2: 'UW',
  // Consonant — V (labiodental voiced → FF)
  V: 'FF',
  // Consonant — W
  W: 'WW',
  // Consonant — Y
  Y: 'YY',
  // Consonant — Z (voiced sibilant → SS)
  Z: 'SS',
  // Consonant — ZH (voiced palatal → CH)
  ZH: 'CH',
};

// ----------------------------------------------------------------------------
// E. WORD_PHONEMES — 200 most common English words
// ----------------------------------------------------------------------------

export const WORD_PHONEMES: Record<string, PhonemeClass[]> = {
  the: ['DD', 'AH'],
  a: ['AH'],
  and: ['AE', 'NN', 'DD'],
  of: ['AH', 'FF'],
  to: ['DD', 'UW'],
  in: ['IH', 'NN'],
  is: ['IH', 'SS'],
  you: ['YY', 'UW'],
  that: ['DD', 'AE', 'DD'],
  it: ['IH', 'DD'],
  he: ['HH', 'IY'],
  was: ['WW', 'AH', 'SS'],
  for: ['FF', 'ER'],
  on: ['AO', 'NN'],
  are: ['AA', 'RR'],
  as: ['AE', 'SS'],
  with: ['WW', 'IH', 'TH'],
  his: ['HH', 'IH', 'SS'],
  they: ['DD', 'EY'],
  i: ['AY'],
  at: ['AE', 'DD'],
  be: ['PP', 'IY'],
  this: ['DD', 'IH', 'SS'],
  have: ['HH', 'AE', 'FF'],
  from: ['FF', 'RR', 'AH', 'PP'],
  or: ['AO', 'RR'],
  one: ['WW', 'AH', 'NN'],
  had: ['HH', 'AE', 'DD'],
  by: ['PP', 'AY'],
  not: ['NN', 'AO', 'DD'],
  but: ['PP', 'AH', 'DD'],
  what: ['WW', 'AH', 'DD'],
  all: ['AO', 'NN'],
  were: ['WW', 'ER'],
  we: ['WW', 'IY'],
  when: ['WW', 'EH', 'NN'],
  your: ['YY', 'AO', 'RR'],
  can: ['KK', 'AE', 'NN'],
  said: ['SS', 'EH', 'DD'],
  there: ['DD', 'EH', 'RR'],
  use: ['YY', 'UW', 'SS'],
  an: ['AE', 'NN'],
  each: ['IY', 'CH'],
  which: ['WW', 'IH', 'CH'],
  she: ['SS', 'IY'],
  do: ['DD', 'UW'],
  how: ['HH', 'AW'],
  their: ['DD', 'EH', 'RR'],
  if: ['IH', 'FF'],
  will: ['WW', 'IH', 'NN'],
  up: ['AH', 'PP'],
  other: ['AH', 'DD', 'ER'],
  about: ['AH', 'PP', 'AW', 'DD'],
  out: ['AW', 'DD'],
  many: ['PP', 'EH', 'NN', 'IY'],
  then: ['DD', 'EH', 'NN'],
  them: ['DD', 'EH', 'PP'],
  these: ['DD', 'IY', 'SS'],
  so: ['SS', 'OW'],
  some: ['SS', 'AH', 'PP'],
  her: ['HH', 'ER'],
  would: ['WW', 'UH', 'DD'],
  make: ['PP', 'EY', 'KK'],
  like: ['NN', 'AY', 'KK'],
  him: ['HH', 'IH', 'PP'],
  into: ['IH', 'NN', 'DD', 'UW'],
  time: ['DD', 'AY', 'PP'],
  has: ['HH', 'AE', 'SS'],
  look: ['NN', 'UH', 'KK'],
  two: ['DD', 'UW'],
  more: ['PP', 'AO', 'RR'],
  write: ['RR', 'AY', 'DD'],
  go: ['KK', 'OW'],
  see: ['SS', 'IY'],
  number: ['NN', 'AH', 'PP', 'ER'],
  no: ['NN', 'OW'],
  way: ['WW', 'EY'],
  could: ['KK', 'UH', 'DD'],
  people: ['PP', 'IY', 'PP', 'AH', 'NN'],
  my: ['PP', 'AY'],
  than: ['DD', 'AE', 'NN'],
  first: ['FF', 'ER', 'SS', 'DD'],
  water: ['WW', 'AO', 'DD', 'ER'],
  been: ['PP', 'IH', 'NN'],
  call: ['KK', 'AO', 'NN'],
  who: ['HH', 'UW'],
  oil: ['AO', 'IH', 'NN'],
  its: ['IH', 'DD', 'SS'],
  now: ['NN', 'AW'],
  find: ['FF', 'AY', 'NN', 'DD'],
  long: ['NN', 'AO', 'NN'],
  down: ['DD', 'AW', 'NN'],
  day: ['DD', 'EY'],
  did: ['DD', 'IH', 'DD'],
  get: ['KK', 'EH', 'DD'],
  come: ['KK', 'AH', 'PP'],
  made: ['PP', 'EY', 'DD'],
  may: ['PP', 'EY'],
  part: ['PP', 'AA', 'RR', 'DD'],
  // Additional common words
  over: ['OW', 'FF', 'ER'],
  new: ['NN', 'UW'],
  sound: ['SS', 'AW', 'NN', 'DD'],
  take: ['DD', 'EY', 'KK'],
  only: ['OW', 'NN', 'NN', 'IY'],
  little: ['NN', 'IH', 'DD', 'AH', 'NN'],
  work: ['WW', 'ER', 'KK'],
  know: ['NN', 'OW'],
  place: ['PP', 'NN', 'EY', 'SS'],
  year: ['YY', 'IH', 'RR'],
  live: ['NN', 'IH', 'FF'],
  back: ['PP', 'AE', 'KK'],
  give: ['KK', 'IH', 'FF'],
  most: ['PP', 'OW', 'SS', 'DD'],
  very: ['FF', 'EH', 'RR', 'IY'],
  after: ['AE', 'FF', 'DD', 'ER'],
  thing: ['DD', 'IH', 'NN'],
  just: ['DD', 'AH', 'SS', 'DD'],
  name: ['NN', 'EY', 'PP'],
  good: ['KK', 'UH', 'DD'],
  sentence: ['SS', 'EH', 'NN', 'DD', 'AH', 'NN', 'SS'],
  man: ['PP', 'AE', 'NN'],
  think: ['DD', 'IH', 'NN', 'KK'],
  say: ['SS', 'EY'],
  great: ['KK', 'RR', 'EY', 'DD'],
  where: ['WW', 'EH', 'RR'],
  help: ['HH', 'EH', 'NN', 'PP'],
  through: ['DD', 'RR', 'UW'],
  much: ['PP', 'AH', 'CH'],
  before: ['PP', 'IH', 'FF', 'AO', 'RR'],
  line: ['NN', 'AY', 'NN'],
  right: ['RR', 'AY', 'DD'],
  too: ['DD', 'UW'],
  means: ['PP', 'IY', 'NN', 'SS'],
  old: ['OW', 'NN', 'DD'],
  any: ['EH', 'NN', 'IY'],
  same: ['SS', 'EY', 'PP'],
  tell: ['DD', 'EH', 'NN'],
  boy: ['PP', 'AO', 'IY'],
  follow: ['FF', 'AO', 'NN', 'OW'],
  came: ['KK', 'EY', 'PP'],
  want: ['WW', 'AO', 'NN', 'DD'],
  show: ['SS', 'OW'],
  also: ['AO', 'NN', 'SS', 'OW'],
  around: ['AH', 'RR', 'AW', 'NN', 'DD'],
  form: ['FF', 'AO', 'RR', 'PP'],
  three: ['DD', 'RR', 'IY'],
  small: ['SS', 'PP', 'AO', 'NN'],
  set: ['SS', 'EH', 'DD'],
  put: ['PP', 'UH', 'DD'],
  end: ['EH', 'NN', 'DD'],
  does: ['DD', 'AH', 'SS'],
  another: ['AH', 'NN', 'AH', 'DD', 'ER'],
  well: ['WW', 'EH', 'NN'],
  large: ['NN', 'AA', 'RR', 'DD'],
  must: ['PP', 'AH', 'SS', 'DD'],
  big: ['PP', 'IH', 'KK'],
  even: ['IY', 'FF', 'AH', 'NN'],
  such: ['SS', 'AH', 'CH'],
  because: ['PP', 'IH', 'KK', 'AO', 'SS'],
  turn: ['DD', 'ER', 'NN'],
  here: ['HH', 'IH', 'RR'],
  why: ['WW', 'AY'],
  ask: ['AE', 'SS', 'KK'],
  went: ['WW', 'EH', 'NN', 'DD'],
  men: ['PP', 'EH', 'NN'],
  read: ['RR', 'IY', 'DD'],
  need: ['NN', 'IY', 'DD'],
  land: ['NN', 'AE', 'NN', 'DD'],
  different: ['DD', 'IH', 'FF', 'RR', 'AH', 'NN', 'DD'],
  home: ['HH', 'OW', 'PP'],
  us: ['AH', 'SS'],
  move: ['PP', 'UW', 'FF'],
  try: ['DD', 'RR', 'AY'],
  kind: ['KK', 'AY', 'NN', 'DD'],
  hand: ['HH', 'AE', 'NN', 'DD'],
  picture: ['PP', 'IH', 'KK', 'CH', 'ER'],
  again: ['AH', 'KK', 'EH', 'NN'],
  change: ['CH', 'EY', 'NN', 'DD'],
  off: ['AO', 'FF'],
  play: ['PP', 'NN', 'EY'],
  spell: ['SS', 'PP', 'EH', 'NN'],
  air: ['EH', 'RR'],
  away: ['AH', 'WW', 'EY'],
  animal: ['AE', 'NN', 'AH', 'PP', 'AH', 'NN'],
  house: ['HH', 'AW', 'SS'],
  point: ['PP', 'AO', 'IH', 'NN', 'DD'],
  page: ['PP', 'EY', 'DD'],
  letter: ['NN', 'EH', 'DD', 'ER'],
  mother: ['PP', 'AH', 'DD', 'ER'],
  answer: ['AE', 'NN', 'SS', 'ER'],
  found: ['FF', 'AW', 'NN', 'DD'],
  still: ['SS', 'DD', 'IH', 'NN'],
  learn: ['NN', 'ER', 'NN'],
  should: ['SS', 'UH', 'DD'],
  american: ['AH', 'PP', 'EH', 'RR', 'AH', 'KK', 'AH', 'NN'],
  world: ['WW', 'ER', 'NN', 'DD'],
  high: ['HH', 'AY'],
  every: ['EH', 'FF', 'RR', 'IY'],
  near: ['NN', 'IH', 'RR'],
  add: ['AE', 'DD'],
  food: ['FF', 'UW', 'DD'],
  between: ['PP', 'IH', 'DD', 'WW', 'IY', 'NN'],
  own: ['OW', 'NN'],
  below: ['PP', 'IH', 'NN', 'OW'],
  country: ['KK', 'AH', 'NN', 'DD', 'RR', 'IY'],
  plant: ['PP', 'NN', 'AE', 'NN', 'DD'],
  last: ['NN', 'AE', 'SS', 'DD'],
  school: ['SS', 'KK', 'UW', 'NN'],
  father: ['FF', 'AA', 'DD', 'ER'],
  keep: ['KK', 'IY', 'PP'],
  tree: ['DD', 'RR', 'IY'],
  never: ['NN', 'EH', 'FF', 'ER'],
  start: ['SS', 'DD', 'AA', 'RR', 'DD'],
  city: ['SS', 'IH', 'DD', 'IY'],
  earth: ['ER', 'TH'],
  eye: ['AY'],
  light: ['NN', 'AY', 'DD'],
  thought: ['TH', 'AO', 'DD'],
  head: ['HH', 'EH', 'DD'],
  under: ['AH', 'NN', 'DD', 'ER'],
  story: ['SS', 'DD', 'AO', 'RR', 'IY'],
  saw: ['SS', 'AO'],
  left: ['NN', 'EH', 'FF', 'DD'],
  dont: ['DD', 'OW', 'NN', 'DD'],
  few: ['FF', 'YY', 'UW'],
  while: ['WW', 'AY', 'NN'],
  along: ['AH', 'NN', 'AO', 'NN'],
  might: ['PP', 'AY', 'DD'],
  close: ['KK', 'NN', 'OW', 'SS'],
  something: ['SS', 'AH', 'PP', 'TH', 'IH', 'NN'],
  seem: ['SS', 'IY', 'PP'],
  next: ['NN', 'EH', 'KK', 'SS', 'DD'],
  hard: ['HH', 'AA', 'RR', 'DD'],
  open: ['OW', 'PP', 'AH', 'NN'],
  example: ['IH', 'KK', 'SS', 'AE', 'PP', 'AH', 'NN'],
  begin: ['PP', 'IH', 'KK', 'IH', 'NN'],
  life: ['NN', 'AY', 'FF'],
  always: ['AO', 'NN', 'WW', 'EY', 'SS'],
  those: ['DD', 'OW', 'SS'],
  both: ['PP', 'OW', 'TH'],
  paper: ['PP', 'EY', 'PP', 'ER'],
  together: ['DD', 'AH', 'KK', 'EH', 'DD', 'ER'],
  got: ['KK', 'AO', 'DD'],
  group: ['KK', 'RR', 'UW', 'PP'],
  often: ['AO', 'FF', 'AH', 'NN'],
  run: ['RR', 'AH', 'NN'],
  important: ['IH', 'PP', 'PP', 'AO', 'RR', 'DD', 'AH', 'NN', 'DD'],
  until: ['AH', 'NN', 'DD', 'IH', 'NN'],
  children: ['CH', 'IH', 'NN', 'DD', 'RR', 'AH', 'NN'],
  side: ['SS', 'AY', 'DD'],
  feet: ['FF', 'IY', 'DD'],
  car: ['KK', 'AA', 'RR'],
  mile: ['PP', 'AY', 'NN'],
  night: ['NN', 'AY', 'DD'],
  walk: ['WW', 'AO', 'KK'],
  white: ['WW', 'AY', 'DD'],
  sea: ['SS', 'IY'],
  began: ['PP', 'IH', 'KK', 'AE', 'NN'],
  grow: ['KK', 'RR', 'OW'],
  took: ['DD', 'UH', 'KK'],
  river: ['RR', 'IH', 'FF', 'ER'],
  four: ['FF', 'AO', 'RR'],
  carry: ['KK', 'EH', 'RR', 'IY'],
  state: ['SS', 'DD', 'EY', 'DD'],
  once: ['WW', 'AH', 'NN', 'SS'],
  book: ['PP', 'UH', 'KK'],
  hear: ['HH', 'IH', 'RR'],
  stop: ['SS', 'DD', 'AO', 'PP'],
  without: ['WW', 'IH', 'DD', 'AW', 'DD'],
  second: ['SS', 'EH', 'KK', 'AH', 'NN', 'DD'],
  later: ['NN', 'EY', 'DD', 'ER'],
  miss: ['PP', 'IH', 'SS'],
  idea: ['AY', 'DD', 'IY', 'AH'],
  enough: ['IH', 'NN', 'AH', 'FF'],
  eat: ['IY', 'DD'],
  face: ['FF', 'EY', 'SS'],
  watch: ['WW', 'AO', 'CH'],
  far: ['FF', 'AA', 'RR'],
  indian: ['IH', 'NN', 'DD', 'IY', 'AH', 'NN'],
  real: ['RR', 'IY', 'AH', 'NN'],
  almost: ['AO', 'NN', 'PP', 'OW', 'SS', 'DD'],
  let: ['NN', 'EH', 'DD'],
  above: ['AH', 'PP', 'AH', 'FF'],
  girl: ['KK', 'ER', 'NN'],
  sometimes: ['SS', 'AH', 'PP', 'DD', 'AY', 'PP', 'SS'],
  mountain: ['PP', 'AW', 'NN', 'DD', 'AH', 'NN'],
  cut: ['KK', 'AH', 'DD'],
  young: ['YY', 'AH', 'NN'],
  talk: ['DD', 'AO', 'KK'],
  soon: ['SS', 'UW', 'NN'],
  list: ['NN', 'IH', 'SS', 'DD'],
  song: ['SS', 'AO', 'NN'],
  being: ['PP', 'IY', 'IH', 'NN'],
};

// Fix 'NN' references — these should map to NN (lateral approximant)
// (We used LL as a label but it's not a PhonemeClass — replace with NN)
// Actually, let's post-process: scan and ensure all arrays only contain valid PhonemeClass.
// Since we used LL above as a stand-in for lateral /l/, replace all LL with NN at runtime.
(function normalizeWordPhonemes() {
  for (const word of Object.keys(WORD_PHONEMES)) {
    WORD_PHONEMES[word] = WORD_PHONEMES[word].map(p => {
      if ((p as string) === 'NN') return 'NN' as PhonemeClass;
      if ((p as string) === 'TH') return 'TH' as PhonemeClass;
      if ((p as string) === 'TT') return 'DD' as PhonemeClass;
      return p;
    });
  }
})();

// ----------------------------------------------------------------------------
// F. buildTargetBlends — merge ZERO_BLENDS with a viseme target
// ----------------------------------------------------------------------------

export function buildTargetBlends(phoneme: PhonemeClass): VisemeBlends {
  const partial = VISEME_TARGETS[phoneme] ?? {};
  return { ...ZERO_BLENDS, ...partial };
}

// ----------------------------------------------------------------------------
// G. lerpBlends — linear interpolation of all 42 fields
// ----------------------------------------------------------------------------

export function lerpBlends(a: VisemeBlends, b: VisemeBlends, t: number): VisemeBlends {
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    jawOpen: lerp(a.jawOpen, b.jawOpen),
    jawForward: lerp(a.jawForward, b.jawForward),
    jawLeft: lerp(a.jawLeft, b.jawLeft),
    jawRight: lerp(a.jawRight, b.jawRight),
    mouthClose: lerp(a.mouthClose, b.mouthClose),
    mouthFunnel: lerp(a.mouthFunnel, b.mouthFunnel),
    mouthPucker: lerp(a.mouthPucker, b.mouthPucker),
    mouthLeft: lerp(a.mouthLeft, b.mouthLeft),
    mouthRight: lerp(a.mouthRight, b.mouthRight),
    mouthSmileLeft: lerp(a.mouthSmileLeft, b.mouthSmileLeft),
    mouthSmileRight: lerp(a.mouthSmileRight, b.mouthSmileRight),
    mouthFrownLeft: lerp(a.mouthFrownLeft, b.mouthFrownLeft),
    mouthFrownRight: lerp(a.mouthFrownRight, b.mouthFrownRight),
    mouthDimpleLeft: lerp(a.mouthDimpleLeft, b.mouthDimpleLeft),
    mouthDimpleRight: lerp(a.mouthDimpleRight, b.mouthDimpleRight),
    mouthStretchLeft: lerp(a.mouthStretchLeft, b.mouthStretchLeft),
    mouthStretchRight: lerp(a.mouthStretchRight, b.mouthStretchRight),
    mouthRollLower: lerp(a.mouthRollLower, b.mouthRollLower),
    mouthRollUpper: lerp(a.mouthRollUpper, b.mouthRollUpper),
    mouthShrugLower: lerp(a.mouthShrugLower, b.mouthShrugLower),
    mouthShrugUpper: lerp(a.mouthShrugUpper, b.mouthShrugUpper),
    mouthPressLeft: lerp(a.mouthPressLeft, b.mouthPressLeft),
    mouthPressRight: lerp(a.mouthPressRight, b.mouthPressRight),
    mouthLowerDownLeft: lerp(a.mouthLowerDownLeft, b.mouthLowerDownLeft),
    mouthLowerDownRight: lerp(a.mouthLowerDownRight, b.mouthLowerDownRight),
    mouthUpperUpLeft: lerp(a.mouthUpperUpLeft, b.mouthUpperUpLeft),
    mouthUpperUpRight: lerp(a.mouthUpperUpRight, b.mouthUpperUpRight),
    cheekPuff: lerp(a.cheekPuff, b.cheekPuff),
    cheekSquintLeft: lerp(a.cheekSquintLeft, b.cheekSquintLeft),
    cheekSquintRight: lerp(a.cheekSquintRight, b.cheekSquintRight),
    noseSneerLeft: lerp(a.noseSneerLeft, b.noseSneerLeft),
    noseSneerRight: lerp(a.noseSneerRight, b.noseSneerRight),
    tongueOut: lerp(a.tongueOut, b.tongueOut),
    tongueUp: lerp(a.tongueUp, b.tongueUp),
    tongueDown: lerp(a.tongueDown, b.tongueDown),
    tongueLeft: lerp(a.tongueLeft, b.tongueLeft),
    tongueRight: lerp(a.tongueRight, b.tongueRight),
    tongueRoll: lerp(a.tongueRoll, b.tongueRoll),
    tongueBendDown: lerp(a.tongueBendDown, b.tongueBendDown),
    tongueCurlUp: lerp(a.tongueCurlUp, b.tongueCurlUp),
    tongueSquish: lerp(a.tongueSquish, b.tongueSquish),
    tongueFlat: lerp(a.tongueFlat, b.tongueFlat),
  };
}

// ----------------------------------------------------------------------------
// H. extractFormants — find spectral peaks (F1, F2, F3)
// ----------------------------------------------------------------------------

export function extractFormants(
  frequencyData: Uint8Array,
  sampleRate: number,
): { f1: number; f2: number; f3: number } {
  const binCount = frequencyData.length;
  const binWidth = sampleRate / 2 / binCount; // Hz per FFT bin
  const AMP_THRESHOLD = 20;

  function hzToBin(hz: number) {
    return Math.round(hz / binWidth);
  }

  function findPeak(loHz: number, hiHz: number): number {
    const lo = Math.max(0, hzToBin(loHz));
    const hi = Math.min(binCount - 1, hzToBin(hiHz));

    let bestBin = -1;
    let bestAmp = -1;

    for (let i = lo; i <= hi; i++) {
      const amp = frequencyData[i];
      if (amp <= AMP_THRESHOLD) continue;

      // Check local maximum
      const prev = i > 0 ? frequencyData[i - 1] : 0;
      const next = i < binCount - 1 ? frequencyData[i + 1] : 0;
      if (amp >= prev && amp >= next) {
        if (amp > bestAmp) {
          bestAmp = amp;
          bestBin = i;
        }
      }
    }

    if (bestBin === -1) {
      // Return midpoint of range
      return (loHz + hiHz) / 2;
    }
    return bestBin * binWidth;
  }

  return {
    f1: findPeak(200, 900),
    f2: findPeak(700, 2500),
    f3: findPeak(2000, 3500),
  };
}

// ----------------------------------------------------------------------------
// I. formantToBlends — convert formant frequencies to blend shape adjustments
// ----------------------------------------------------------------------------

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

export function formantToBlends(f1: number, f2: number): Partial<VisemeBlends> {
  const jawOpen = clamp((f1 - 200) / 700, 0, 1) * 0.9;
  const mouthFunnel = clamp((2500 - f2) / 1800, 0, 1) * 0.7;
  const mouthSmile = clamp((f2 - 1200) / 1300, 0, 1) * 0.5;

  return {
    jawOpen,
    mouthFunnel,
    mouthSmileLeft: mouthSmile,
    mouthSmileRight: mouthSmile,
    cheekPuff: 0,
  };
}

// ----------------------------------------------------------------------------
// J. predictPhonemeFromWord — G2P fallback rules
// ----------------------------------------------------------------------------

export function predictPhonemeFromWord(word: string): PhonemeClass[] {
  // Lowercase and strip punctuation
  const clean = word.toLowerCase().replace(/[^a-z']/g, '');

  // Check WORD_PHONEMES first
  if (WORD_PHONEMES[clean]) {
    return [...WORD_PHONEMES[clean]];
  }

  if (!clean) return ['SIL'];

  const result: PhonemeClass[] = [];
  let i = 0;

  // Apply G2P rules character by character with lookahead
  while (i < clean.length) {
    // Multi-char patterns (longest match first)
    const remaining = clean.slice(i);

    if (remaining.startsWith('ing') && i > 0) {
      result.push('IH', 'NN');
      i += 3;
    } else if (remaining.startsWith('tion')) {
      result.push('SS', 'AH', 'NN');
      i += 4;
    } else if (remaining.startsWith('igh')) {
      result.push('AY');
      i += 3;
    } else if (remaining.startsWith('oor') || remaining.startsWith('oo')) {
      result.push('UW');
      i += remaining.startsWith('oor') ? 3 : 2;
    } else if (remaining.startsWith('ou') || remaining.startsWith('ow')) {
      result.push('AW');
      i += 2;
    } else if (remaining.startsWith('oi') || remaining.startsWith('oy')) {
      result.push('OY');
      i += 2;
    } else if (remaining.startsWith('ai') || remaining.startsWith('ay')) {
      result.push('AY');
      i += 2;
    } else if (remaining.startsWith('ea')) {
      result.push('IY');
      i += 2;
    } else if (remaining.startsWith('ee')) {
      result.push('IY');
      i += 2;
    } else if (remaining.startsWith('er') || remaining.startsWith('ir') || remaining.startsWith('ur')) {
      result.push('ER');
      i += 2;
    } else if (remaining.startsWith('th')) {
      result.push('TH');
      i += 2;
    } else if (remaining.startsWith('sh')) {
      result.push('CH');
      i += 2;
    } else if (remaining.startsWith('ch')) {
      result.push('CH');
      i += 2;
    } else if (remaining.startsWith('ck')) {
      result.push('KK');
      i += 2;
    } else if (remaining.startsWith('ph')) {
      result.push('FF');
      i += 2;
    } else if (remaining.startsWith('wh')) {
      result.push('WW');
      i += 2;
    } else if (remaining.startsWith('ng')) {
      result.push('NN');
      i += 2;
    } else if (remaining.startsWith('gh')) {
      // silent in many positions, or 'f'
      if (i > 0) {
        i += 2; // silent
      } else {
        result.push('KK');
        i += 2;
      }
    } else {
      // Single character
      const ch = clean[i];
      // Check for trailing 'y' (treat as AY)
      if (ch === 'y' && i === clean.length - 1 && i > 0) {
        result.push('AY');
        i++;
      } else {
        switch (ch) {
          // Vowels
          case 'a': result.push('AH'); break;
          case 'e':
            // Silent 'e' at end
            if (i === clean.length - 1 && i > 1) {
              // skip
            } else {
              result.push('EH');
            }
            break;
          case 'i': result.push('IH'); break;
          case 'o': result.push('AH'); break;
          case 'u': result.push('AH'); break;
          // Consonants
          case 'b': result.push('PP'); break;
          case 'c':
            // 'c' before e, i, y → SS; otherwise KK
            if (i + 1 < clean.length && 'eiy'.includes(clean[i + 1])) {
              result.push('SS');
            } else {
              result.push('KK');
            }
            break;
          case 'd': result.push('DD'); break;
          case 'f': result.push('FF'); break;
          case 'g':
            // 'g' before e, i, y → CH; otherwise KK
            if (i + 1 < clean.length && 'eiy'.includes(clean[i + 1])) {
              result.push('CH');
            } else {
              result.push('KK');
            }
            break;
          case 'h': result.push('HH'); break;
          case 'j': result.push('CH'); break;
          case 'k': result.push('KK'); break;
          case 'l': result.push('NN'); break;
          case 'm': result.push('PP'); break;
          case 'n': result.push('NN'); break;
          case 'p': result.push('PP'); break;
          case 'q': result.push('KK'); break;
          case 'r': result.push('RR'); break;
          case 's': result.push('SS'); break;
          case 't': result.push('DD'); break;
          case 'v': result.push('FF'); break;
          case 'w': result.push('WW'); break;
          case 'x': result.push('KK', 'SS'); break;
          case 'y': result.push('YY'); break;
          case 'z': result.push('SS'); break;
          default: break; // apostrophes etc.
        }
        i++;
      }
    }
  }

  return result.length > 0 ? result : ['SIL'];
}
