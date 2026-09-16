import { describe, it, expect } from 'vitest';
import { buildRecordingR2Key, buildRecordingR2Metadata } from './recording-storage';

describe('buildRecordingR2Key', () => {
  it('builds the full brand/stage/year-month/user/session layout', () => {
    const key = buildRecordingR2Key({
      userId: 'user-123',
      sessionId: 'session-abc',
      brand: 'flowen',
      stageId: 3,
      createdAt: '2026-03-14T10:00:00Z',
    });
    expect(key).toBe('flowen/stage-3/2026-03/user-123/session-abc.webm');
  });

  it('falls back to unbranded/stage-unknown when brand and stage are missing', () => {
    const key = buildRecordingR2Key({
      userId: 'user-123',
      sessionId: 'session-abc',
      brand: null,
      stageId: null,
      createdAt: '2026-03-14T10:00:00Z',
    });
    expect(key).toBe('unbranded/stage-unknown/2026-03/user-123/session-abc.webm');
  });

  it('lowercases and strips unsafe characters from the brand segment', () => {
    const key = buildRecordingR2Key({
      userId: 'user-123',
      sessionId: 'session-abc',
      brand: 'Flowen Speech!',
      stageId: 1,
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect(key).toBe('flowen-speech-/stage-1/2026-01/user-123/session-abc.webm');
  });

  it('falls back to unknown-date for an invalid createdAt rather than throwing', () => {
    const key = buildRecordingR2Key({
      userId: 'user-123',
      sessionId: 'session-abc',
      brand: 'flowen',
      stageId: 2,
      createdAt: 'not-a-date',
    });
    expect(key).toBe('flowen/stage-2/unknown-date/user-123/session-abc.webm');
  });
});

describe('buildRecordingR2Metadata', () => {
  it('includes every populated field, stringified', () => {
    const meta = buildRecordingR2Metadata({
      userId: 'user-123',
      sessionId: 'session-abc',
      brand: 'flowen',
      stageId: 3,
      createdAt: '2026-03-14T10:00:00Z',
      durationSeconds: 42,
      blocksDetected: 5,
      repetitionsDetected: 2,
      prolongationsDetected: 1,
    });
    expect(meta).toEqual({
      'session-id': 'session-abc',
      'user-id': 'user-123',
      brand: 'flowen',
      'stage-id': '3',
      'duration-seconds': '42',
      'blocks-detected': '5',
      'repetitions-detected': '2',
      'prolongations-detected': '1',
    });
  });

  it('omits null/undefined fields instead of writing the string "null"', () => {
    const meta = buildRecordingR2Metadata({
      userId: 'user-123',
      sessionId: 'session-abc',
      brand: null,
      stageId: null,
      createdAt: null,
      durationSeconds: null,
      blocksDetected: undefined,
    });
    expect(meta).toEqual({
      'session-id': 'session-abc',
      'user-id': 'user-123',
    });
  });

  it('does not confuse 0 with a missing value — zero counts are real data', () => {
    const meta = buildRecordingR2Metadata({
      userId: 'user-123',
      sessionId: 'session-abc',
      brand: 'flowen',
      stageId: 0,
      createdAt: null,
      durationSeconds: 0,
      blocksDetected: 0,
    });
    expect(meta['stage-id']).toBe('0');
    expect(meta['duration-seconds']).toBe('0');
    expect(meta['blocks-detected']).toBe('0');
  });
});
