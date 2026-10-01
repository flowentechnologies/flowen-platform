import { afterEach, describe, expect, it, vi } from 'vitest';
import { ownerChannel, ownerAgentName, validAgentId, agentBelongsToOwner } from './ownership';
const owner = '12345678-1234-1234-1234-123456789abc';
const response = (ids: string[], cursor = '') => Response.json({ data: { list: ids.map(agent_id => ({ agent_id })) }, meta: { cursor } });
afterEach(() => vi.unstubAllGlobals());
describe('provider-bound agent ownership', () => {
  it('uses full identity for channel and name, not collision-prone prefixes', () => {
    expect(ownerChannel(owner)).toBe('flowen-12345678123412341234123456789abc');
    expect(ownerAgentName(owner)).toBe(`flowen-agent-${owner}`);
    expect(ownerChannel(owner)).not.toBe(ownerChannel(owner.slice(0, -1) + 'd'));
    expect(ownerAgentName(owner)).not.toBe(ownerAgentName(owner.slice(0, -1) + 'd'));
  });
  it.each([null, undefined, 7, '', '../other', 'a?b', 'a/b', 'x'.repeat(129)])('rejects invalid agent path %s', value => expect(validAgentId(value)).toBe(false));
  it('accepts a safe provider identifier', () => expect(validAgentId('agent_ABC-123')).toBe(true));
  it('requires exact membership on the server-derived channel', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(['mine'])); vi.stubGlobal('fetch', fetchMock);
    expect(await agentBelongsToOwner('https://provider.example', 'app', owner, 'mine', {})).toBe(true);
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.searchParams.get('channel')).toBe(ownerChannel(owner));
    expect(url.searchParams.get('state')).toBe('0,1,2,3');
    expect(url.searchParams.get('from_time')).toBe('0');
    expect(fetchMock.mock.calls[0][1].cache).toBe('no-store');
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
  });
  it('returns false for a foreign or unknown ID', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(['mine'])));
    expect(await agentBelongsToOwner('https://provider.example', 'app', owner, 'foreign', {})).toBe(false);
  });
  it('follows the documented top-level meta cursor', async () => {
    const mock = vi.fn().mockResolvedValueOnce(response(['first'], 'next')).mockResolvedValueOnce(response(['mine']));
    vi.stubGlobal('fetch', mock);
    expect(await agentBelongsToOwner('https://provider.example', 'app', owner, 'mine', {})).toBe(true);
    expect((mock.mock.calls[1][0] as URL).searchParams.get('cursor')).toBe('next');
  });
  it('fails closed on HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(agentBelongsToOwner('https://provider.example', 'app', owner, 'mine', {})).rejects.toThrow();
  });
  it.each([null, {}, {data:{list:[]}}, {data:{list:null},meta:{cursor:''}}])('fails closed on malformed response', async body => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)));
    await expect(agentBelongsToOwner('https://provider.example', 'app', owner, 'mine', {})).rejects.toThrow();
  });
  it('fails closed on cursor cycles', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response([], 'cycle'))));
    await expect(agentBelongsToOwner('https://provider.example', 'app', owner, 'mine', {})).rejects.toThrow();
  });
  it('fails closed when bounded pagination is exhausted', async () => {
    let n=0; const mock=vi.fn().mockImplementation(() => Promise.resolve(response([], String(++n)))); vi.stubGlobal('fetch',mock);
    await expect(agentBelongsToOwner('https://provider.example', 'app', owner, 'mine', {})).rejects.toThrow();
    expect(mock).toHaveBeenCalledTimes(10);
  });
});
