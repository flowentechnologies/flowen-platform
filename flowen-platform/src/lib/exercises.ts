export type ExerciseType = 'words' | 'phrases' | 'passage' | 'prompt';

export interface Exercise {
  id: string;
  title: string;
  type: ExerciseType;
  instructions: string;
  content: string[];
}

export const EXERCISES: Record<number, Exercise[]> = {
  // ── Stage 1: Diaphragmatic Breathing ──────────────────────────────────────
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
    {
      id: '1-humming',
      title: 'Resonant Humming',
      type: 'words',
      instructions: 'Hum each sound on one smooth breath. Feel the vibration in your chest and lips — this builds breath support naturally.',
      content: ['mmmmm', 'nnnnn', 'nnnggg', 'hmmm', 'vvvvv', 'zzzzz', 'mmmah', 'mmmoh', 'mmmee'],
    },
    {
      id: '1-sighs',
      title: 'Sigh Releases',
      type: 'phrases',
      instructions: 'Take a slow nasal breath, then sigh each phrase out on a long, effortless exhale. Sighing naturally relaxes the larynx.',
      content: [
        '(sigh) ... aaah',
        '(sigh) ... ohhh',
        '(sigh) ... let it go',
        '(sigh) ... slow down',
        '(sigh) ... easy now',
        '(sigh) ... breathe out',
      ],
    },
    {
      id: '1-box',
      title: 'Box Breathing',
      type: 'phrases',
      instructions: 'Follow each line precisely: in for 4, hold for 4, out for 4, hold for 4. Repeat all six cycles.',
      content: [
        'In: 1-2-3-4 / Hold: 1-2-3-4 / Out: 1-2-3-4 / Hold: 1-2-3-4',
        'In: 1-2-3-4 / Hold: 1-2-3-4 / Out: 1-2-3-4 / Hold: 1-2-3-4',
        'In: 1-2-3-4 / Hold: 1-2-3-4 / Out: 1-2-3-4 / Hold: 1-2-3-4',
        'In: 1-2-3-4 / Hold: 1-2-3-4 / Out: 1-2-3-4 / Hold: 1-2-3-4',
        'In: 1-2-3-4 / Hold: 1-2-3-4 / Out: 1-2-3-4 / Hold: 1-2-3-4',
        'In: 1-2-3-4 / Hold: 1-2-3-4 / Out: 1-2-3-4 / Hold: 1-2-3-4',
      ],
    },
    {
      id: '1-belly',
      title: 'Belly Breath Awareness',
      type: 'passage',
      instructions: 'Place one hand on your belly. Read slowly, feeling your hand rise and fall with each breath mark.',
      content: [
        'I rest my hand on my belly / and notice it rise as I inhale. / My shoulders stay completely still. / On the exhale, / my belly falls gently inward. / This is diaphragmatic breathing — / the foundation of easy, fluid speech.',
      ],
    },
    {
      id: '1-478',
      title: '4-7-8 Pattern',
      type: 'phrases',
      instructions: 'Inhale for 4, hold for 7, exhale for 8. This ratio activates the parasympathetic nervous system and reduces pre-speech anxiety.',
      content: [
        'In: 1-2-3-4 / Hold: 1-2-3-4-5-6-7 / Out: 1-2-3-4-5-6-7-8',
        'In: 1-2-3-4 / Hold: 1-2-3-4-5-6-7 / Out: 1-2-3-4-5-6-7-8',
        'In: 1-2-3-4 / Hold: 1-2-3-4-5-6-7 / Out: 1-2-3-4-5-6-7-8',
        'In: 1-2-3-4 / Hold: 1-2-3-4-5-6-7 / Out: 1-2-3-4-5-6-7-8',
      ],
    },
    {
      id: '1-body-scan',
      title: 'Breath Body Scan',
      type: 'prompt',
      instructions: 'Read aloud slowly while consciously checking each body area. Pause between sentences to take a full diaphragmatic breath.',
      content: [
        'Breathe into your lower belly. Notice any tightness in your jaw — let it soften. Relax your shoulders away from your ears. Feel your ribcage expand side-to-side. On each exhale, allow your whole body to settle a little lower.',
      ],
    },
    {
      id: '1-pacing',
      title: 'Paced Breath Phrases',
      type: 'phrases',
      instructions: 'Each phrase takes one full breath to say. Speak only on the exhale — don\'t speak while inhaling.',
      content: [
        'slow and steady wins the race',
        'air in... words out',
        'one breath at a time',
        'breathe first, then speak',
        'calm breath, calm voice',
        'every exhale carries my voice forward',
        'my breath is my foundation',
        'I speak on the wave of my breath',
      ],
    },
  ],

  // ── Stage 2: Easy Onset & Prolongation ────────────────────────────────────
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
    {
      id: '2-names',
      title: 'Vowel-Initial Names',
      type: 'words',
      instructions: 'Say each name gently, floating into the initial vowel sound. Treat every name as a soft breath turned into speech.',
      content: [
        'Alice', 'Owen', 'Ellie', 'Aaron', 'Isla',
        'Ava', 'Ethan', 'Oliver', 'Emily', 'Arthur',
        'Uma', 'Ivy', 'Oscar', 'Amelia', 'Elliot',
      ],
    },
    {
      id: '2-prolonged',
      title: 'Prolonged Onset Words',
      type: 'words',
      instructions: 'Deliberately stretch the initial vowel for 2–3 seconds before continuing the word. This exaggerates the gentle onset.',
      content: [
        'eeeasy', 'ooopen', 'aaaaim', 'uuunder', 'iiice',
        'eeeach', 'oooffer', 'aaafter', 'ooover', 'eeearn',
      ],
    },
    {
      id: '2-sentences',
      title: 'Vowel-Start Sentences',
      type: 'phrases',
      instructions: 'Every sentence begins with a vowel. Float into the first word — the rest of the sentence can follow naturally.',
      content: [
        'All I need is one gentle start.',
        'Each word can begin effortlessly.',
        'Opening my voice feels light today.',
        'Anything is possible with easy onset.',
        'Every morning I practise this skill.',
        'On the exhale, my voice arrives.',
        'At the start of every sentence, I float in.',
        'Under my breath I find calm.',
      ],
    },
    {
      id: '2-passage-2',
      title: 'Onset Awareness Passage',
      type: 'passage',
      instructions: 'Every "/" marks an onset word. Slow down at each marker — float into that word with no tension.',
      content: [
        'I begin every morning / with an easy breath. / I open my jaw gently / and allow sound to arrive. / Each word is an invitation, / not a demand. / I am never in a rush / to find my voice — / it is always / already there.',
      ],
    },
    {
      id: '2-numbers',
      title: 'Number Onset Drill',
      type: 'words',
      instructions: 'Number words are vowel-initial — perfect for onset practice. Ease into each one as if counting in slow motion.',
      content: [
        'one', 'eight', 'eleven', 'eighteen', 'eighty',
        'eleven', 'one hundred', 'a thousand', 'any number',
        'one more', 'each time', 'every count',
      ],
    },
    {
      id: '2-contrast',
      title: 'Hard vs Soft Contrast',
      type: 'phrases',
      instructions: 'Read the second version of each pair — soft onset only. Notice how the hard version feels strained; the soft version feels free.',
      content: [
        'HARD: \'At\' — SOFT: \'...aat\'',
        'HARD: \'Each\' — SOFT: \'...eeeach\'',
        'HARD: \'Open\' — SOFT: \'...oooopen\'',
        'HARD: \'Ask\' — SOFT: \'...aaask\'',
        'HARD: \'April\' — SOFT: \'...Aaapril\'',
        'HARD: \'Always\' — SOFT: \'...Aaaalways\'',
      ],
    },
    {
      id: '2-prompt',
      title: 'Spontaneous Easy Onset',
      type: 'prompt',
      instructions: 'Speak freely on this topic. Make every vowel-initial word your focus — float into the sound each time. Don\'t stop if you push; just reset and try again.',
      content: [
        'Describe your ideal evening at home.\n\nSpeak naturally, but pay attention to every word that begins with a vowel sound. Each one is an opportunity to practise a floating, effortless onset.',
      ],
    },
  ],

  // ── Stage 3: Light Articulatory Contacts ──────────────────────────────────
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
    {
      id: '3-multisyllable',
      title: 'Multi-Syllable Plosives',
      type: 'words',
      instructions: 'Each word contains multiple plosive sounds. Keep every single contact light — don\'t let buried consonants sneak in harder.',
      content: [
        'capital', 'particular', 'competition', 'practical',
        'participate', 'capability', 'backpacker', 'comfortable',
        'production', 'definitely', 'appreciate', 'typically',
        'spectacular', 'department', 'population', 'acceptable',
      ],
    },
    {
      id: '3-sentences',
      title: 'Light Contact Sentences',
      type: 'phrases',
      instructions: 'Read each sentence focusing on the underlined plosive words. Keep every contact feather-light.',
      content: [
        'The big dog kept quietly by the gate.',
        'Picking blueberries takes patience and care.',
        'David put the kettle on the top shelf.',
        'Kate packed the book into the green bag.',
        'The captain kept a careful daily record.',
        'Patrick brought two tickets for the back row.',
        'Deborah quietly tapped the tabletop twice.',
        'The park café opened for breakfast at eight.',
      ],
    },
    {
      id: '3-fricatives',
      title: 'Light Fricative Extension',
      type: 'words',
      instructions: 'Fricatives (f, v, th, s, z) can also be produced with excessive pressure. Practise these with the same feather-light approach.',
      content: [
        'five', 'seven', 'voice', 'smooth', 'soft',
        'that', 'this', 'then', 'through', 'think',
        'safe', 'leave', 'breathe', 'phase', 'thrive',
      ],
    },
    {
      id: '3-tongue-twisters',
      title: 'Light Contact Twisters',
      type: 'phrases',
      instructions: 'Go slowly — speed is not the goal. Every plosive must stay light even when the pattern is rapid.',
      content: [
        'Peter Piper picked a peck of pickled peppers.',
        'Pad kid poured curd pulled cold.',
        'Betty bought some butter but the butter was bitter.',
        'Top cop, drop top, pop cop.',
        'Big black bug bleed black blood.',
        'Keep cool, keep calm, keep kind.',
      ],
    },
    {
      id: '3-passage-2',
      title: 'Conversation-Style Passage',
      type: 'passage',
      instructions: 'Read as if chatting with a friend. Keep all plosives light — especially at sentence starts where tension naturally increases.',
      content: [
        'Did you know that the best part of practising / is getting to notice small improvements? / Every time I keep my contacts light / I can feel my speech getting easier. / It takes patience, but it builds. / Two weeks ago / a word like "particular" / would trip me up completely. / Today it comes out smoothly.',
      ],
    },
    {
      id: '3-words-2',
      title: 'Category Plosive Drill',
      type: 'words',
      instructions: 'Words grouped by the dominant plosive. Work through each group separately, keeping the target consonant consistently light.',
      content: [
        '— P sounds: —', 'people', 'pretty', 'purple', 'power', 'proper',
        '— B sounds: —', 'between', 'broken', 'beyond', 'brief', 'bright',
        '— T sounds: —', 'taking', 'talent', 'total', 'telling', 'trying',
        '— D sounds: —', 'during', 'direct', 'decide', 'divide', 'develop',
      ],
    },
    {
      id: '3-prompt',
      title: 'Spontaneous Light Contacts',
      type: 'prompt',
      instructions: 'Speak freely but stay aware of every plosive. Don\'t pause to pre-plan — just monitor in real time and reset when you feel a hard contact.',
      content: [
        'Tell me about a typical working or study day.\n\nDescribe what you do from morning to evening. Focus on keeping all plosive consonants (p, b, t, d, k, g) light and unforced throughout.',
      ],
    },
  ],

  // ── Stage 4: Pausing & Phrasing ───────────────────────────────────────────
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
    {
      id: '4-news',
      title: 'News Anchor Style',
      type: 'passage',
      instructions: 'Read like a news presenter — measured, deliberate, with confident pauses. The silence is power, not failure.',
      content: [
        'Good evening. / Tonight\'s story comes from a small town / in the north of England. / Residents say they have noticed / something remarkable in recent weeks. / A local initiative, / started by just three people, / has grown into a community movement / of over two hundred volunteers.',
      ],
    },
    {
      id: '4-dialogue',
      title: 'Dialogue Phrasing',
      type: 'phrases',
      instructions: 'Read each line as a full thought unit — even short responses get a pause before and after. Natural conversation is built from well-timed pauses.',
      content: [
        '"So... / what do you think?"',
        '"I think... / it is a good idea."',
        '"When did you hear about it... / for the first time?"',
        '"Last week... / on Tuesday morning."',
        '"And how did it make you feel... / at the time?"',
        '"Honestly... / I was quite surprised."',
        '"That makes sense... / I felt the same."',
        '"What would you do... / if you were in charge?"',
      ],
    },
    {
      id: '4-list',
      title: 'Pause-List Drill',
      type: 'phrases',
      instructions: 'After each item, hold the pause for a full second. Feel how the pause makes each item land more clearly.',
      content: [
        'The three things I need today are... one / two / three.',
        'First... I breathe. Then... I pause. Then... I speak.',
        'Monday... Tuesday... Wednesday... Thursday... Friday.',
        'In the morning... at noon... in the evening.',
        'Slowly... steadily... smoothly... surely.',
        'Breathe in... hold... breathe out... pause... begin.',
      ],
    },
    {
      id: '4-passage-2',
      title: 'Story with Pauses',
      type: 'passage',
      instructions: 'Every "/" is a breath pause. Let the story unfold at a relaxed, confident rhythm — never rush to fill the silence.',
      content: [
        'Once, a man walked into a library / and asked for a book. / The librarian smiled / and asked him what kind. / He paused for a moment / and said, / "Something that will change / the way I think." / She handed him a small notebook / and said, / "Write in this. / That is the only book / that can do that."',
      ],
    },
    {
      id: '4-questions',
      title: 'Question & Answer Pauses',
      type: 'phrases',
      instructions: 'Read the question, hold a 2-second pause, then speak the answer. The pause before you speak is the technique — own it.',
      content: [
        'Q: What is your name? / A: My name is... [your name].',
        'Q: Where do you work? / A: I work at... [your workplace].',
        'Q: What did you do today? / A: This morning I... [your answer].',
        'Q: How are you feeling? / A: Right now I feel... [your answer].',
        'Q: What are your plans? / A: My plan is to... [your answer].',
        'Q: Tell me about yourself. / A: Well, I... [your answer].',
      ],
    },
    {
      id: '4-long-passage',
      title: 'Extended Phrased Reading',
      type: 'passage',
      instructions: 'A longer passage for sustained phrasing practice. Maintain your pause rhythm all the way to the end — don\'t let it slip in the second half.',
      content: [
        'I used to believe / that fluent people spoke faster / than I did. / Now I understand / that fluent people / know when to stop. / A confident speaker / uses pauses deliberately. / The pause is not hesitation — / it is punctuation. / It gives the listener time to process / what has been said, / and it gives the speaker time to breathe / and choose the next phrase. / I practise my pauses / every single day.',
      ],
    },
    {
      id: '4-prompt-2',
      title: 'Conversational Chunk Talk',
      type: 'prompt',
      instructions: 'Use deliberate 3–5 word chunks throughout. If you find yourself rushing, pause and reset. The listener is comfortable with your pauses.',
      content: [
        'Talk about a film, book, or series you have enjoyed recently.\n\nDescribe the story, what you liked about it, and whether you would recommend it. Use short phrase chunks with confident pauses between them.',
      ],
    },
  ],

  // ── Stage 5: Conversational Flow ──────────────────────────────────────────
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
    {
      id: '5-passage-2',
      title: 'Voice & Identity Passage',
      type: 'passage',
      instructions: 'Read with intention — this passage is about your own journey. Let the meaning land. Apply all techniques without focusing on any single one.',
      content: [
        'My voice is my own. / I have worked to understand it, / to practise with it, / and to trust it more each day. / There are still moments of difficulty — / but they do not define me. / What defines me / is that I keep going. / I keep speaking. / I keep showing up.',
      ],
    },
    {
      id: '5-description',
      title: 'Scene Description',
      type: 'prompt',
      instructions: 'Describe the scene in as much detail as you can. Use all your techniques naturally — breath support, gentle onset, light contacts, phrasing.',
      content: [
        'Imagine you are standing at the edge of a forest on a quiet morning. Describe what you see, hear, and feel in as much sensory detail as possible.\n\nSpeak for at least 90 seconds, as if narrating a scene in a documentary.',
      ],
    },
    {
      id: '5-opinion',
      title: 'Reasoned Opinion',
      type: 'prompt',
      instructions: 'Give your view, explain your reasoning, and consider a counter-argument. This mirrors the real communicative demands of professional and social life.',
      content: [
        'What is one change you would make to improve your local area, workplace, or daily life?\n\nExplain why it matters, who it would help, and how you would make it happen. Speak for at least 2 minutes.',
      ],
    },
    {
      id: '5-story',
      title: 'Vivid Story Passage',
      type: 'passage',
      instructions: 'Read expressively — this passage has varied rhythm. Let your voice carry the tone without over-engineering any individual technique.',
      content: [
        'She stood at the front of the room / and took one slow breath. / The audience was quiet. / In that moment / she wasn\'t thinking about technique — / she was thinking about what she wanted to say. / And when she opened her mouth, / the words came. / Not perfectly. / Not without effort. / But they came. / And that was enough.',
      ],
    },
    {
      id: '5-podcast',
      title: 'Podcast Monologue',
      type: 'prompt',
      instructions: 'You are hosting a solo podcast. Speak directly to your audience — curious, warm, and unhurried. Apply your techniques as part of your natural presence.',
      content: [
        'Today on your podcast you are talking about a skill you have learned in the last year — not speech fluency, but any skill.\n\nIntroduce the topic, explain how you started, what you found hard, and what you have learned. Aim for 2–3 minutes.',
      ],
    },
    {
      id: '5-dialogue',
      title: 'Natural Dialogue Lines',
      type: 'phrases',
      instructions: 'Read each line as if mid-conversation. Speak naturally — this is the final test of whether your techniques have become automatic.',
      content: [
        'So I was saying — the thing that really struck me was...',
        'Honestly, I think the best approach would probably be to just...',
        'What I mean is, it\'s not that complicated once you...',
        'I\'ve been thinking about this a lot, and I keep coming back to...',
        'The interesting thing is, when you look at it from the other angle...',
        'I don\'t want to overcomplicate it, but essentially what\'s happening is...',
        'Can I just say — and I mean this genuinely —',
        'The way I see it, the most important thing here is...',
      ],
    },
    {
      id: '5-reflection',
      title: 'Reflective Speaking',
      type: 'prompt',
      instructions: 'Speak reflectively and honestly. There is no performance here — just your voice, your thoughts, and your techniques working quietly in the background.',
      content: [
        'How has your relationship with speaking changed since you started practising with Flowen?\n\nReflect on what felt hard at the beginning, what has shifted, and where you want to be in 3 months. Speak honestly for as long as feels natural.',
      ],
    },
  ],
};
