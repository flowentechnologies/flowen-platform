import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ user: vi.fn(), owned: vi.fn(), token: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/supabase/from-request', () => ({ getUserFromRequest: mocks.user }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ single: async () => ({data:{voice_clone_id:null}}) }) }) }) }) }));
vi.mock('agora-token', () => ({ RtcTokenBuilder: { buildTokenWithUid: mocks.token }, RtcRole: { PUBLISHER: 1 } }));
vi.mock('@/lib/agora/ownership', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/agora/ownership')>(), agentBelongsToOwner: mocks.owned }));
import { POST, DELETE } from './route';
import { ownerChannel } from '@/lib/agora/ownership';
const owner='12345678-1234-1234-1234-123456789abc';
const request=(method:string,body:unknown)=>new Request('https://flowen.test/api/agora/convoai',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal('fetch',mocks.fetch);
  mocks.user.mockResolvedValue({id:owner}); mocks.owned.mockResolvedValue(true); mocks.token.mockReturnValue('server-agent-token');
  Object.assign(process.env,{AGORA_APP_ID:'app',AGORA_APP_CERTIFICATE:'certificate',AGORA_CUSTOMER_ID:'customer',AGORA_CUSTOMER_SECRET:'secret',NEXT_PUBLIC_SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'db-test'});
  mocks.fetch.mockImplementation(async (_url,opts) => opts.method==='DELETE'?Response.json({}):Response.json({agent_id:'mine'}));
});
describe('DELETE authorization',()=>{
  it('checks provider ownership even without a client channel',async()=>{
    mocks.owned.mockResolvedValue(false);
    expect((await DELETE(request('DELETE',{agentId:'foreign'}))).status).toBe(403);
    expect(mocks.owned).toHaveBeenCalledWith(expect.any(String),'app',owner,'foreign',expect.anything());
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('correct caller channel does not authorize a foreign agent ID',async()=>{
    mocks.owned.mockResolvedValue(false);
    expect((await DELETE(request('DELETE',{agentId:'foreign',channel:ownerChannel(owner)}))).status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('rejects a different supplied channel before any provider action',async()=>{
    expect((await DELETE(request('DELETE',{agentId:'mine',channel:'foreign'}))).status).toBe(403);
    expect(mocks.owned).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('stops only a verified owned agent',async()=>{
    expect((await DELETE(request('DELETE',{agentId:'mine'}))).status).toBe(200);
    expect(mocks.fetch.mock.calls[0][0]).toContain('/agents/mine/leave');
    expect(mocks.fetch.mock.calls[0][1].method).toBe('DELETE');
  });
  it('fails closed on ownership outage',async()=>{
    mocks.owned.mockRejectedValue(new Error('down'));
    expect((await DELETE(request('DELETE',{agentId:'mine'}))).status).toBe(503); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([null,[],{agentId:'../foreign'},{}])('rejects malformed body',async body=>{
    expect((await DELETE(request('DELETE',body))).status).toBe(400); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('requires authentication',async()=>{
    mocks.user.mockResolvedValue(null); expect((await DELETE(request('DELETE',{agentId:'mine'}))).status).toBe(401); expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
describe('POST authorization',()=>{
  it('rejects a foreign channel before starting any provider agent',async()=>{
    expect((await POST(request('POST',{channel:'foreign',token:'client-token'}))).status).toBe(403);expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('ignores caller token and mints channel and UID scoped agent token',async()=>{
    const res=await POST(request('POST',{channel:ownerChannel(owner),token:'foreign-client-token',agentUid:9999}));expect(res.status).toBe(200);
    expect(mocks.token).toHaveBeenCalledWith('app','certificate',ownerChannel(owner),9999,1,expect.any(Number),expect.any(Number));
    const payload=JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(payload.properties.channel).toBe(ownerChannel(owner));expect(payload.properties.token).toBe('server-agent-token');expect(payload.name).toBe(`flowen-agent-${owner}`);
  });
  it('accepts omitted channel only by deriving it server-side',async()=>{
    expect((await POST(request('POST',{}))).status).toBe(200); expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).properties.channel).toBe(ownerChannel(owner));
  });
  it.each([null,[],{agentUid:0},{systemPrompt:5}])('rejects invalid configuration before provider join',async body=>{
    expect((await POST(request('POST',body))).status).toBe(400); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('never stops a foreign agent ID supplied by a conflict response',async()=>{
    mocks.fetch.mockResolvedValueOnce(Response.json({agent_id:'foreign',reason:'TaskConflict'},{status:409})); mocks.owned.mockResolvedValue(false);
    expect((await POST(request('POST',{}))).status).toBe(409); expect(mocks.fetch).toHaveBeenCalledTimes(1);expect(mocks.owned).toHaveBeenCalled();
  });
  it('fails closed when conflict ownership cannot be verified',async()=>{
    mocks.fetch.mockResolvedValueOnce(Response.json({agent_id:'mine',reason:'TaskConflict'},{status:409})); mocks.owned.mockRejectedValue(new Error('down'));
    expect((await POST(request('POST',{}))).status).toBe(503); expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it('only retries after a verified conflict agent was successfully stopped',async()=>{
    mocks.fetch.mockResolvedValueOnce(Response.json({agent_id:'mine',reason:'TaskConflict'},{status:409})).mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(Response.json({agent_id:'new'}));
    expect((await POST(request('POST',{}))).status).toBe(200); expect(mocks.owned).toHaveBeenCalled(); expect(mocks.fetch.mock.calls[1][1].method).toBe('DELETE');expect(mocks.fetch).toHaveBeenCalledTimes(3);
  });
  it('rejects invalid success IDs',async()=>{
    mocks.fetch.mockResolvedValueOnce(Response.json({agent_id:'../foreign'}));expect((await POST(request('POST',{}))).status).toBe(502);
  });
});
