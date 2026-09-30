import { describe, it, expect } from 'vitest';
import { getAsrConfig, decodeWav } from './config';
import { datasetPage, validAnnotations } from './dataset';
describe('ASR configuration and audio validation', () => {
  it('uses unchanged model and no invented coaching prompt', () => expect(getAsrConfig({})).toEqual({ model: 'whisper-1', language: 'en', timeoutMs: 20000, prompt: '', configured: false }));
  it('bounds configuration', () => { expect(getAsrConfig({ ASR_TIMEOUT_MS: '999999', ASR_LANGUAGE: 'bad', ASR_VOCABULARY_PROMPT: 'x'.repeat(2000) }).timeoutMs).toBe(30000); expect(getAsrConfig({ ASR_TIMEOUT_MS: 'NaN' }).timeoutMs).toBe(20000); });
  it('rejects malformed or fake WAVs', () => { expect(decodeWav('!!!!')).toBeNull(); expect(decodeWav(Buffer.alloc(44).toString('base64'))).toBeNull(); });
  it('accepts mono PCM16 and rejects truncated data', () => {
    const b = Buffer.alloc(16044); b.write('RIFF'); b.writeUInt32LE(16036, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(16000, 40);
    expect(decodeWav(b.toString('base64'))).not.toBeNull(); b.writeUInt32LE(20000, 40); expect(decodeWav(b.toString('base64'))).toBeNull();
  });
});
describe('dataset review validation', () => {
  it('rejects unbounded and fractional pages', () => { for (const n of ['NaN', '-1', '0.5', 'Infinity', '100001']) expect(datasetPage(n)).toBeNull(); expect(datasetPage(null)).toBe(0); });
  it('accepts valid annotations and rejects unknown/out-of-bounds events', () => {
    expect(validAnnotations([{ type: 'BLOCK', onset_ms: 0, duration_ms: 500 }], 1)).toBe(true);
    expect(validAnnotations([{ type: 'BLOCK', onset_ms: 900, duration_ms: 500 }], 1)).toBe(false);
    expect(validAnnotations([{ type: 'FAKE', onset_ms: 0, duration_ms: 1 }], 1)).toBe(false);
    expect(validAnnotations([], 0)).toBe(false);
    expect(validAnnotations([{ id: 1, type: 'BLOCK', source: 'rule-based', onset_ms: 0, duration_ms: 500, confidence: 0.7 }], 1)).toBe(true);
    expect(validAnnotations([{ type: 'BLOCK', ts_ms: 0, duration_ms: 500 }], 1)).toBe(false);
  });
});
