import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ admin: vi.fn(), db: vi.fn(), audit: vi.fn(), user: vi.fn(), limit: vi.fn() }));
vi.mock('@/lib/admin/guard', () => ({ requireAdmin: mocks.admin }));
vi.mock('@/lib/supabase/admin', () => ({ adminDb: mocks.db }));
vi.mock('@/lib/admin/audit', () => ({ logAuditEvent: mocks.audit }));
vi.mock('@/lib/supabase/from-request', () => ({ getUserFromRequest: mocks.user }));
vi.mock('@/lib/asr/rate-limit', () => ({ allowAsr: mocks.limit }));
import { GET } from '@/app/api/admin/dataset/route';
import { POST as samplePost } from '@/app/api/admin/dataset/sample/route';
import { POST as asrPost } from '@/app/api/practice/asr/route';
const id = '00000000-0000-4000-8000-000000000001';
function query(value: unknown) {
  const chain: Record<string, unknown> = {};
  for (const key of ['select', 'eq', 'is', 'in', 'order', 'range', 'maybeSingle', 'update']) chain[key] = vi.fn(() => chain);
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(value).then(resolve);
  return chain;
}
function dbWith(...responses: unknown[]) { const signed = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://fixture.invalid/audio' }, error: null }); const db = { from: vi.fn(() => query(responses.shift())), storage: { from: vi.fn(() => ({ createSignedUrl: signed })) } }; mocks.db.mockReturnValue(db); return { db, signed }; }
const req = (body: unknown) => new Request('https://flowen.digital/api/admin/dataset/sample', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); mocks.admin.mockResolvedValue({ id: 'admin' }); mocks.user.mockResolvedValue({ id: 'user' }); mocks.limit.mockResolvedValue(true); vi.stubEnv('OPENAI_API_KEY', 'fixture'); });
describe('admin dataset API', () => {
  it('requires admin before reading speech data', async () => { mocks.admin.mockResolvedValue(null); expect((await GET(new Request('https://flowen.digital/api/admin/dataset'))).status).toBe(401); expect((await samplePost(req({id, action:'playback'}))).status).toBe(401); expect(mocks.db).not.toHaveBeenCalled(); });
  it('rejects invalid paging and null request bodies', async () => { expect((await GET(new Request('https://flowen.digital/api/admin/dataset?page=NaN'))).status).toBe(400); expect((await samplePost(req(null))).status).toBe(400); });
  it('reports database errors rather than fake zero counts', async () => { dbWith({ error: {message:'table missing'} }, {count:0}); expect((await GET(new Request('https://flowen.digital/api/admin/dataset'))).status).toBe(503); });
  it('hides withdrawn transcript/events and never exposes identity/path', async () => {
    dbWith({data:[{id, user_id:'private-user',transcript:'private speech',disfluency_events:[1],consent_version:'v1'}], count:1}, {count:0}, {data:[{id:'private-user',consent_data_collection:false}]});
    const body = await (await GET(new Request('https://flowen.digital/api/admin/dataset?export=1'))).json();
    expect(body.samples[0]).toMatchObject({eligible:false,transcript:null,disfluency_events:null});expect(JSON.stringify(body)).not.toContain('private-user');expect(JSON.stringify(body)).not.toContain('signedUrl');
  });
  it('fails closed on withdrawn/missing collection consent', async () => {
    for (const consent of [false,true]) {
      const {signed}=dbWith({data:{id,user_id:'user',storage_path:'private',consent_version:consent?null:'v1'}},{data:{consent_data_collection:consent}});
      expect((await samplePost(req({id,action:'playback'}))).status).toBe(403);expect(signed).not.toHaveBeenCalled();
    }
  });
  it('issues only short-lived consent-checked playback and audits it', async () => {
    const {signed}=dbWith({data:{id,user_id:'user',storage_path:'private',consent_version:'v1'}},{data:{consent_data_collection:true}});
    const r=await samplePost(req({id,action:'playback'}));expect(r.status).toBe(200);expect(signed).toHaveBeenCalledWith('private',60);expect(mocks.audit).toHaveBeenCalled();expect(r.headers.get('cache-control')).toContain('no-store');
  });
  it('rejects stale annotations before updating', async () => {
    const {db}=dbWith({data:{id,user_id:'user',consent_version:'v1',duration_seconds:10,transcript:'new',disfluency_events:[]}},{data:{consent_data_collection:true}});
    expect((await samplePost(req({id,action:'annotate',transcript:'edit',events:[],previous:'old',previousEvents:'[]'}))).status).toBe(409); expect(db.from).toHaveBeenCalledTimes(2);
  });
  it('uses conditional update and audits metadata without speech content', async () => {
    const {db}=dbWith({data:{id,user_id:'user',consent_version:'v1',duration_seconds:10,transcript:'old',disfluency_events:[]}},{data:{consent_data_collection:true}}, {data:[{id}]});
    expect((await samplePost(req({id,action:'annotate',transcript:'new private words',events:[],previous:'old',previousEvents:'[]'}))).status).toBe(200);expect(db.from).toHaveBeenCalledTimes(3);expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain('private words');
  });
});
describe('ASR endpoint boundaries', () => {
  it('rejects unauthenticated and null bodies', async () => { expect((await asrPost(req(null))).status).toBe(400);mocks.user.mockResolvedValue(null);expect((await asrPost(req({}))).status).toBe(401); });
  it('does not contact provider for invalid WAV or rate limited requests', async () => {
    const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
    const body={audio:'aGVsbG8=',durationSeconds:1};expect((await asrPost(req(body))).status).toBe(400);
    mocks.limit.mockResolvedValue(false);expect((await asrPost(req(body))).status).toBe(429);expect(fetchMock).not.toHaveBeenCalled();vi.unstubAllGlobals();
  });
});
