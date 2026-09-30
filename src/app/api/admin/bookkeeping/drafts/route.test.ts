import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  draft: {} as Record<string, unknown>, saved: {} as Record<string, unknown> | null,
  update: vi.fn(), audit: vi.fn(), xero: vi.fn(), forbidden: false,
}));
vi.mock('@/lib/admin/guard', () => ({ assertAdmin: async () => {
  if (mocks.forbidden) throw new Error('Forbidden');
  return { id: 'admin' };
} }));
vi.mock('@/lib/admin/audit', () => ({ logAuditEvent: mocks.audit }));
vi.mock('@/lib/xero', () => ({
  createXeroInvoiceAndPayment: mocks.xero, categorizeBankTransaction: mocks.xero,
  createXeroBill: mocks.xero, createXeroManualJournal: mocks.xero,
  createXeroShareCapitalSetoff: mocks.xero, listChartOfAccounts: mocks.xero,
}));
vi.mock('@/lib/supabase/admin', () => ({ adminDb: () => ({ from: () => {
  const chain = {
    select: () => chain, eq: () => chain,
    single: async () => ({ data: mocks.draft, error: null }),
    update: (value: unknown) => { mocks.update(value); return chain; },
    maybeSingle: async () => ({ data: mocks.saved, error: null }),
  };
  return chain;
} }) }));
import { PATCH } from './route';

const payload = { expenseAccountCode: '', gbpAmount: null, evidenceUrl: 'https://example.com/receipt',
  vatNote: 'Review pending', vatReview: true, currency: 'USD', amount: 24, dlaAccountCode: '835' };
const request = (body: unknown) => new NextRequest('https://example.com/api/admin/bookkeeping/drafts', {
  method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
});
describe('pending vendor DLA save', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.forbidden = false;
    mocks.draft = { id: 'draft', draft_type: 'vendor_dla', entity: 'speech-technologies', status: 'pending', proposed_payload: payload };
    mocks.saved = { id: 'draft', status: 'pending', proposed_payload: payload };
  });
  it('merges verified edits without reviewing or posting to Xero', async () => {
    const res = await PATCH(request({ id: 'draft', action: 'save', payload: { expenseAccountCode: '400', gbpAmount: 18.50 } }));
    expect(res.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ proposed_payload: { ...payload, expenseAccountCode: '400', gbpAmount: 18.50 } });
    expect(mocks.xero).not.toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalledOnce();
  });
  it('allows incomplete drafts to save evidence notes without approval', async () => {
    expect((await PATCH(request({ id: 'draft', action: 'save', payload: { vatNote: 'VAT invoice awaited' } }))).status).toBe(200);
    expect(mocks.xero).not.toHaveBeenCalled();
  });
  it.each([
    { gbpAmount: -1 }, { gbpAmount: 1.001 }, { gbpAmount: '18.50' },
    { expenseAccountCode: 'bad' }, { evidenceUrl: 'http://example.com' },
    { vatNote: 'x'.repeat(501) }, { amount: 1 }, { vatReview: false }, {},
  ])('rejects invalid or protected edits %j', async edit => {
    expect((await PATCH(request({ id: 'draft', action: 'save', payload: edit }))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.xero).not.toHaveBeenCalled();
  });
  it('keeps GBP source amounts fixed', async () => {
    mocks.draft.proposed_payload = { ...payload, currency: 'GBP', gbpAmount: 24 };
    expect((await PATCH(request({ id: 'draft', action: 'save', payload: { gbpAmount: 25 } }))).status).toBe(400);
  });
  it('rejects reviewed drafts', async () => {
    mocks.draft.status = 'applied';
    expect((await PATCH(request({ id: 'draft', action: 'save', payload: { vatNote: 'note' } }))).status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('does not change share-capital drafts', async () => {
    mocks.draft.draft_type = 'share_capital_setoff';
    expect((await PATCH(request({ id: 'draft', action: 'save', payload: { vatNote: 'note' } }))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('detects a pending-state race', async () => {
    mocks.saved = null;
    expect((await PATCH(request({ id: 'draft', action: 'save', payload: { vatNote: 'note' } }))).status).toBe(409);
    expect(mocks.audit).not.toHaveBeenCalled(); expect(mocks.xero).not.toHaveBeenCalled();
  });
  it('requires admin and rejects unknown actions', async () => {
    expect((await PATCH(request({ id: 'draft', action: 'other' }))).status).toBe(400);
    mocks.forbidden = true;
    expect((await PATCH(request({ id: 'draft', action: 'save', payload: { vatNote: 'note' } }))).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
