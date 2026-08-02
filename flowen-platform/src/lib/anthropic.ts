import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export function requireAnthropicKey(): NextResponse | null {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI features are not configured' }, { status: 503 });
  }
  return null;
}
