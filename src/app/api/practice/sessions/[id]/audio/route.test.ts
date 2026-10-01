import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), adminDb: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/supabase/admin', () => ({ adminDb: mocks.adminDb }));
import { POST } from './route';

function setup(results: unknown[]) {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ['select', 'eq', 'insert']) query[name] = vi.fn(() => query);
  query.single = vi.fn(async () => results.shift());
  query.maybeSingle = vi.fn(async () => results.shift());
  mocks.createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) } });
  mocks.adminDb.mockReturnValue({ from: () => query, storage: { from: () => ({ upload, remove }) } });
  const form = new FormData();
  form.set('audio', new File(['audio'], 'test.webm', { type: 'audio/webm' }));
  const req = new Request('https://example.invalid/api/practice/sessions/session/audio', { method: 'POST', body: form });
  return { req, upload, remove };
}
const profile = { data: { consent_data_collection: true }, error: null };
const session = { data: { id: 'session', duration_seconds: 10 }, error: null };
const missing = { data: null, error: null };
const failed = { data: null, error: { message: 'insert failed' } };
const context = { params: Promise.resolve({ id: 'session' }) };
beforeEach(() => vi.clearAllMocks());
describe('training audio persistence', () => {
  it('does not report success when insert fails; removes an unreferenced upload', async () => {
    const { req, remove } = setup([profile, session, missing, failed, missing]);
    const response = await POST(req, context);
    expect(response.status).toBe(500);
    expect(remove).toHaveBeenCalledWith(['user/session.webm']);
  });
  it('keeps the object if a concurrent insert succeeded', async () => {
    const { req, remove } = setup([profile, session, missing, failed, { data: { id: 'committed' }, error: null }]);
    const response = await POST(req, context);
    expect(await response.json()).toEqual({ ok: true, sampleId: 'committed', existed: true });
    expect(remove).not.toHaveBeenCalled();
  });
  it('does not upload when the idempotency read fails', async () => {
    const { req, upload } = setup([profile, session, failed]);
    expect((await POST(req, context)).status).toBe(500);
    expect(upload).not.toHaveBeenCalled();
  });
  it('does not delete when the reference recheck is unverifiable', async () => {
    const { req, remove } = setup([profile, session, missing, failed, failed]);
    expect((await POST(req, context)).status).toBe(500);
    expect(remove).not.toHaveBeenCalled();
  });
  it('keeps the existing consent gate', async () => {
    const { req, upload } = setup([{ data: { consent_data_collection: false } }]);
    expect((await POST(req, context)).status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
  });
  it('returns the persisted sample id after success', async () => {
    const { req, remove } = setup([profile, session, missing, { data: { id: 'saved' }, error: null }]);
    expect(await (await POST(req, context)).json()).toEqual({ ok: true, sampleId: 'saved' });
    expect(remove).not.toHaveBeenCalled();
  });
});
