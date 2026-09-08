import { describe, it, expect, vi } from 'vitest';
import { getUserWithRetry } from './get-user-with-retry';

function mockSupabase(getUserImpl: () => Promise<{ data: { user: unknown }; error: { status: number } | null }>) {
  return { auth: { getUser: vi.fn(getUserImpl) } } as any;
}

describe('getUserWithRetry', () => {
  it('returns the user immediately on success, with no retry', async () => {
    const user = { id: 'u1' };
    const supabase = mockSupabase(async () => ({ data: { user }, error: null }));
    expect(await getUserWithRetry(supabase)).toBe(user);
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
  });

  it('retries once on a transient 400 (refresh-token race) and succeeds on the second attempt', async () => {
    const user = { id: 'u1' };
    let call = 0;
    const supabase = mockSupabase(async () => {
      call++;
      if (call === 1) return { data: { user: null }, error: { status: 400 } };
      return { data: { user }, error: null };
    });
    expect(await getUserWithRetry(supabase, { delayMs: 0 })).toBe(user);
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(2);
  });

  it('gives up after the retry budget is exhausted and returns null', async () => {
    const supabase = mockSupabase(async () => ({ data: { user: null }, error: { status: 400 } }));
    expect(await getUserWithRetry(supabase, { retries: 1, delayMs: 0 })).toBeNull();
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-400 error (a real auth failure, not a race)', async () => {
    const supabase = mockSupabase(async () => ({ data: { user: null }, error: { status: 401 } }));
    expect(await getUserWithRetry(supabase, { delayMs: 0 })).toBeNull();
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
  });

  it('treats a thrown AuthApiError the same as a returned 400 error', async () => {
    const user = { id: 'u1' };
    let call = 0;
    const supabase = mockSupabase(async () => {
      call++;
      if (call === 1) throw new Error('AuthApiError');
      return { data: { user }, error: null };
    });
    expect(await getUserWithRetry(supabase, { delayMs: 0 })).toBe(user);
  });

  it('respects a custom retry budget', async () => {
    const supabase = mockSupabase(async () => ({ data: { user: null }, error: { status: 400 } }));
    await getUserWithRetry(supabase, { retries: 3, delayMs: 0 });
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(4); // initial attempt + 3 retries
  });
});
