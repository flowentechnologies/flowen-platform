import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn(), finish: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ adminDb: () => ({
  rpc: mocks.rpc, from: () => ({ update: mocks.update }),
}) }));
import { deliverConversion } from './conversion-delivery';
beforeEach(() => {
  vi.clearAllMocks();
  const chain = { eq: vi.fn() }; chain.eq.mockReturnValueOnce(chain).mockReturnValueOnce(chain).mockImplementationOnce(mocks.finish);
  mocks.update.mockReturnValue(chain); mocks.finish.mockResolvedValue({ error: null });
});
describe('per-destination invoice delivery', () => {
  it('never sends a destination already completed', async () => {
    mocks.rpc.mockResolvedValue({ data: 'sent', error: null });
    const send = vi.fn(); await deliverConversion('in_real','ga4','user',send);
    expect(send).not.toHaveBeenCalled();
  });
  it('sends only with an atomic durable claim and records completion', async () => {
    mocks.rpc.mockResolvedValue({ data: 'claimed', error: null });
    const send = vi.fn().mockResolvedValue(undefined); await deliverConversion('in_real','ga4','user',send);
    expect(send).toHaveBeenCalledOnce(); expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({state:'sent'}));
  });
  it('does not send on a storage failure or concurrent lease', async () => {
    const send=vi.fn(); mocks.rpc.mockResolvedValue({data:null,error:{message:'no table'}});
    await expect(deliverConversion('in_real','meta','user',send)).rejects.toThrow('claim failed');
    mocks.rpc.mockResolvedValue({data:'sending',error:null});
    await expect(deliverConversion('in_real','meta','user',send)).rejects.toThrow('busy');
    expect(send).not.toHaveBeenCalled();
  });
});
