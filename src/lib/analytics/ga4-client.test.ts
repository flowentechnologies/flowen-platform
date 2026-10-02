import { describe, it, expect, vi, afterEach } from 'vitest';
import { queueGa4Event } from './ga4-client';
afterEach(() => vi.unstubAllGlobals());
describe('consented GA4 readiness queue', () => {
  it('fails closed before consent', () => {
    vi.stubGlobal('document', { cookie: 'flowen_cookie_consent=necessary' });
    vi.stubGlobal('window', {});
    expect(queueGa4Event('sign_up')).toBe(false);
    expect(window.dataLayer).toBeUndefined();
  });
  it('queues arguments when gtag is not ready without dropping the real event', () => {
    vi.stubGlobal('document', { cookie: 'flowen_cookie_consent=all' });
    vi.stubGlobal('window', {});
    expect(queueGa4Event('sign_up', { method: 'email' })).toBe(true);
    expect(Array.from(window.dataLayer![0] as IArguments)).toEqual(['event','sign_up',{method:'email'}]);
  });
  it('does not mistake a lookalike cookie for permission', () => {
    vi.stubGlobal('document', { cookie: 'not_flowen_cookie_consent=all' });
    vi.stubGlobal('window', {});
    expect(queueGa4Event('purchase')).toBe(false);
  });
});
