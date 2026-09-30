import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const m = vi.hoisted(() => ({ forbidden: false, tokens: vi.fn(), chart: vi.fn() }));
vi.mock('@/lib/admin/guard', () => ({ assertAdmin: async () => { if (m.forbidden) throw new Error(); } }));
vi.mock('@/lib/xero', () => ({ getAllXeroTokens: m.tokens, listChartOfAccounts: m.chart }));
import { GET } from './route';
const req = (entity: string) => new NextRequest(`https://example.com/api/admin/xero/accounts?entity=${entity}`);
describe('admin Xero active chart read', () => {
  beforeEach(() => {
    vi.clearAllMocks(); m.forbidden = false;
    m.tokens.mockResolvedValue([{ entity: 'labs', tenant_id: 'tenant', tenant_name: 'FLOWEN LABS LTD', access_token: 'secret' }]);
    m.chart.mockResolvedValue([{ Code: '400', Name: 'Hosting', Type: 'OVERHEADS', Class: 'EXPENSE', AccountID: 'private-id' }]);
  });
  it('returns only chart fields for the selected connected entity, without caching', async () => {
    const res = await GET(req('labs'));
    expect(res.status).toBe(200); expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ entity: 'labs', tenantName: 'FLOWEN LABS LTD', accounts: [{ code: '400', name: 'Hosting', type: 'OVERHEADS', class: 'EXPENSE' }] });
    expect(m.chart).toHaveBeenCalledWith('labs');
  });
  it('requires admin before fetching any connection', async () => {
    m.forbidden = true; expect((await GET(req('labs'))).status).toBe(403);
    expect(m.tokens).not.toHaveBeenCalled(); expect(m.chart).not.toHaveBeenCalled();
  });
  it('rejects unknown entities', async () => {
    expect((await GET(req('unknown'))).status).toBe(400); expect(m.chart).not.toHaveBeenCalled();
  });
  it('rejects disconnected entities', async () => {
    expect((await GET(req('speech-technologies'))).status).toBe(409); expect(m.chart).not.toHaveBeenCalled();
  });
  it('does not expose upstream errors or credentials', async () => {
    m.chart.mockRejectedValue(new Error('secret token'));
    const res = await GET(req('labs')); expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
  });
});
