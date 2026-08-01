export type ExerciseType = 'words' | 'phrases' | 'passage' | 'prompt';

export interface Exercise {
  id: string;
  title: string;
  type: ExerciseType;
  instructions: string;
  content: string[];
}

export const EXERCISES: Record<number, Exercise[]> = {
  1: [
    {
      id: '1-vowels',
      title: 'Sustained Vowels',
      type: 'words',
      instructions: 'Sustain each sound for 3–5 seconds with a steady breath. Keep your chest still — feel your belly expand.',
      content: ['aaah', 'eeeh', 'iiih', 'oooh', 'uuuh', 'mmm', 'sss', 'ffff'],
    },
    {
      id: '1-counts',
      title: 'Breath Counts',
      type: 'phrases',
      instructions: 'Say each phrase aloud, stretching the exhale across all counts. Take a natural breath before each one.',
      content: [
        'In: 1-2-3-4 / Out: 1-2-3-4-5-6',
        'In: 1-2-3-4 / Out: 1-2-3-4-5-6-7-8',
        'In: 1-2-3 / Out: 1-2-3-4-5-6',
        'In: 1-2-3-4-5 / Out: 1-2-3-4-5-6-7',
        'Breathe... relax... let go',
        'Air in... hold... slow release',
      ],
    },
    {
      id: '1-passage',
      title: 'Breathing Narrative',
      type: 'passage',
      instructions: 'Read at half your normal pace. Pause at every "/" to inhale slowly through your nose.',
      content: [
        'I breathe in slowly / and let my belly rise. / I hold for a moment / then release gently. / My shoulders are still. / My chest is relaxed. / The air flows out / steadily and completely.',
      ],
    },
  ],
  2: [
    {
      id: '2-vowels',
      title: 'Vowel-Initial Words',
      type: 'words',
      instructions: 'Start each word with a soft, floating onset. Never push — let the sound appear from nothing.',
      content: [
        'aim', 'easy', 'ice', 'open', 'up',
        'each', 'age', 'out', 'arm', 'even',
        'old', 'ache', 'earn', 'over', 'under',
        'only', 'always', 'after', 'often', 'into',
      ],
    },
    {
      id: '2-phrases',
      title: 'Easy Onset Phrases',
      type: 'phrases',
      instructions: 'Lead each phrase with a gentle vowel onset. The first sound should feel completely effortless.',
      content: [
        'easy afternoon',
        'open opportunity',
        'autumn evening',
        'all is well',
        'afternoon air',
        'absolutely excellent',
        'each and every one',
        'on an ordinary day',
        'ample time ahead',
        'always and often',
      ],
    },
    {
      id: '2-passage',
      title: 'Easy Onset Passage',
      type: 'passage',
      instructions: 'Read slowly. At each vowel-initial word, use an extra-gentle onset — imagine the sound appearing from nothing.',
      content: [
        'On an early autumn evening, / I took a walk along an open path. / Each step was easy and unhurried. / I arrived at a quiet place / and sat for a while, / simply enjoying the air around me.',
      ],
    },
  ],
  3: [
    {
      id: '3-plosives',
      title: 'Plosive Word List',
      type: 'words',
      instructions: 'Say each word with the lightest possible contact. Lips and tongue should barely touch — just enough to shape the sound.',
      content: [
        'pick', 'book', 'take', 'dog', 'keep', 'good',
        'paper', 'butter', 'topic', 'paddle', 'pocket', 'garden',
        'public', 'battle', 'captain', 'deeply', 'broken', 'kitchen',
      ],
    },
    {
      id: '3-pairs',
      title: 'Minimal Pairs',
      type: 'phrases',
      instructions: 'Read each pair aloud. Notice how both sounds use minimal contact — voiced and voiceless versions feel equally light.',
      content: [
        'pin — bin',
        'tap — dab',
        'cap — gap',
        'park — bark',
        'tip — dip',
        'coat — goat',
        'pile — bile',
        'town — down',
        'Kate — gate',
        'pick — big',
      ],
    },
    {
      id: '3-passage',
      title: 'Plosive-Rich Passage',
      type: 'passage',
      instructions: 'Read with extra care on plosive sounds (p, b, t, d, k, g). Use the lightest possible contact at every stop consonant.',
      content: [
        'Peter picked a big basket / of beautiful garden tomatoes. / He packed each one carefully / into a paper bag. / By the time he was done, / the kitchen table / was covered with bright red produce.',
      ],
    },
  ],
  4: [
    {
      id: '4-chunks',
      title: 'Phrase Chunks',
      type: 'phrases',
      instructions: 'Read each phrase as one smooth unit. Pause briefly at the "/" markers — let each pause be a full, unhurried breath.',
      content: [
        'Today is a good day / to practise speaking.',
        'I woke up this morning / feeling rested and calm.',
        'The key to fluency / is patient, consistent practice.',
        'Each session I complete / moves me one step forward.',
        'I can take my time / there is no rush.',
        'Speaking slowly and clearly / feels natural with practice.',
        'When I pause between phrases / my listener understands me better.',
        'Fluency is a skill / that improves with repetition.',
      ],
    },
    {
      id: '4-passage',
      title: 'Phrased Passage',
      type: 'passage',
      instructions: 'Pause at every "/" for one natural breath. Keep each chunk smooth — don\'t stop mid-phrase.',
      content: [
        'Every morning / I sit quietly / and think about my goals. / I remind myself / that progress takes time / and that each small step counts. / I speak to myself / with patience and kindness. / Then I begin my day / ready for whatever comes.',
      ],
    },
    {
      id: '4-prompt',
      title: 'Spontaneous Phrasing',
      type: 'prompt',
      instructions: 'Speak freely on this topic in 3–5 word chunks. Take a real pause between each chunk — let the silence belong to you.',
      content: [
        'Describe your ideal morning routine.\n\nSpeak in short, deliberate chunks of 3–5 words. Let each pause be a full breath before continuing.',
      ],
    },
  ],
  5: [
    {
      id: '5-passage',
      title: 'Connected Passage',
      type: 'passage',
      instructions: 'Read at a comfortable pace. Apply your techniques in the background — don\'t over-monitor. Let the words flow.',
      content: [
        'Confidence grows each time we speak / and trust ourselves to find the words. / We don\'t need to be perfect — / we need to keep going. / Every conversation is a chance / to practise being present, / to use our techniques naturally, / and to feel comfortable in our voice. / The goal is not silence — / the goal is connection.',
      ],
    },
    {
      id: '5-narrative',
      title: 'Personal Narrative',
      type: 'prompt',
      instructions: 'Speak freely for at least 2 minutes. Apply your techniques as you go — breathe, pace yourself, and keep moving forward even if you stumble.',
      content: [
        'Tell the story of a memorable journey or trip you have taken.\n\nWhere did you go? What happened? How did it feel? Speak as if telling a friend.',
      ],
    },
    {
      id: '5-conversation',
      title: 'Conversation Starter',
      type: 'prompt',
      instructions: 'Respond to this question as if speaking to a friend. Keep your techniques active but unforced — natural conversation is the goal.',
      content: [
        'What is something you are looking forward to in the next few weeks?\n\nTalk through your plans, feelings, and any details that come to mind. There are no right or wrong answers.',
      ],
    },
  ],
};
