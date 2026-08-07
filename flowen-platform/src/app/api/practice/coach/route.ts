import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, requireAnthropicKey } from '@/lib/anthropic';
import { checkAiRateLimit } from '@/lib/rate-limit';

const STAGE_PROMPTS: Record<number, string> = {
  1: 'The user is practising diaphragmatic breathing — 4-count inhale, 6-count exhale. Give one short, warm encouragement about their breathing rhythm. Mention belly expansion or steady exhale if relevant.',
  2: 'The user is practising Easy Onset — starting words with a soft, floating vocal onset instead of a hard glottal attack. Respond to what they said with brief, specific feedback on their onset quality. If no transcript, encourage them to keep each word start gentle.',
  3: 'The user is practising Light Articulatory Contacts — barely touching lips and tongue for plosive consonants like p, b, t, d, k, g. Give one sentence of feedback on keeping contacts light and effortless.',
  4: 'The user is practising Pausing and Phrasing — speaking in 3-5 word chunks with deliberate pauses. Respond with brief feedback on their phrasing rhythm and whether they are letting the pauses belong to them.',
  5: 'You are having a natural, supportive conversation with the user who is practising Conversational Flow. Respond genuinely to what they said as you would in a real conversation — be interested, warm, and natural. End with a short follow-up question to keep the conversation going. Do NOT mention therapy, techniques, or stammering — just have a normal conversation.',
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Per-user rate limit: 30 coach requests per hour.
  // Prevents a single user from generating unbounded Claude API costs.
  const withinLimit = await checkAiRateLimit(user.id);
  if (!withinLimit) {
    return NextResponse.json(
      { error: 'Rate limit reached — maximum 30 coaching requests per hour.' },
      { status: 429 },
    );
  }

  const keyError = requireAnthropicKey();
  if (keyError) return keyError;

  let body: { stageId: number; transcript: string; sessionElapsed: number; lastCoachResponse?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { stageId, transcript, sessionElapsed, lastCoachResponse } = body;
  // stageName is not used server-side — stageId selects the prompt

  const stageInstruction = STAGE_PROMPTS[stageId] ?? STAGE_PROMPTS[5];
  const systemPrompt = `You are a warm, encouraging speech therapy voice coach for someone who stammers. Keep all responses under 2 sentences — they will be spoken aloud immediately. Never comment negatively on disfluency. ${stageInstruction}`;

  const userContent = transcript
    ? `Session time: ${Math.floor(sessionElapsed / 60)}m ${sessionElapsed % 60}s.\n\nUser said: "${transcript.slice(-400)}"`
    : `Session time: ${Math.floor(sessionElapsed / 60)}m ${sessionElapsed % 60}s. The user is practising in silence.`;

  const messages: Anthropic.MessageParam[] = [];
  if (lastCoachResponse) {
    messages.push({ role: 'assistant', content: lastCoachResponse });
  }
  messages.push({ role: 'user', content: userContent });

  let reply: string;
  try {
    const msg = await getAnthropicClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      system: systemPrompt,
      messages,
    });
    reply = msg.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join(' ')
      .trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ reply });
}
