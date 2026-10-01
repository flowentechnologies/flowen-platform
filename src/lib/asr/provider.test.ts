import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAsrConfig } from './config';
import { transcribe } from './provider';
const base = { ASR_ENDPOINT_URL:'https://fixture.modal.run/transcribe', ASR_ENDPOINT_KEY:'x'.repeat(32) };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
beforeEach(() => vi.stubEnv('ASR_ENDPOINT_KEY', base.ASR_ENDPOINT_KEY));
describe('self-hosted provider', () => {
  it('never uses OpenAI credentials as ASR configuration', () => expect(getAsrConfig({ OPENAI_API_KEY:'fixture' }).configured).toBe(false));
  it.each(['http://fixture.modal.run', 'https://api.openai.com/v1/audio/transcriptions', 'https://fixture.modal.run.evil.invalid', 'https://fixture.modal.run?secret=x', 'https://user:pass@fixture.modal.run'])('fails closed for %s', url => expect(getAsrConfig({...base, ASR_ENDPOINT_URL:url}).configured).toBe(false));
  it('supports Runpod custom HTTP workers without fallback', () => { expect(getAsrConfig({...base,ASR_PROVIDER:'runpod',ASR_ENDPOINT_URL:'https://fixture.api.runpod.ai/transcribe'}).configured).toBe(true);expect(getAsrConfig({...base,ASR_PROVIDER:'unknown'}).configured).toBe(false); });
  it('rejects unsupported models and non-English distilled requests', () => { expect(getAsrConfig({...base,ASR_MODEL:'whisper-1'}).configured).toBe(false);expect(getAsrConfig({...base,ASR_MODEL:'distil-large-v3',ASR_LANGUAGE:'cy'}).configured).toBe(false); });
  it('posts bounded WAV JSON, disables redirects and preserves response contract', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({text:'  hello hello  '}));vi.stubGlobal('fetch',fetch);
    expect(await transcribe(Buffer.from('fixture'),getAsrConfig(base))).toBe('hello hello');
    const [url, options] = fetch.mock.calls[0];expect(url).toBe(base.ASR_ENDPOINT_URL);expect(options.redirect).toBe('error');expect(JSON.parse(options.body)).toMatchObject({model:'large-v3-turbo',prompt:'',audio:Buffer.from('fixture').toString('base64')});
  });
  it.each([Response.json({text:4}),Response.json({error:'oops'}),Response.json({text:'x'.repeat(17000)}),new Response('x'.repeat(65537)),new Response('',{status:503})])('rejects malformed, oversized and failed responses',async response => { vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response));await expect(transcribe(Buffer.from('fixture'),getAsrConfig(base))).rejects.toThrow(); });
  it('fails closed without an endpoint and never contacts a provider',async () => { const fetch=vi.fn();vi.stubGlobal('fetch',fetch);await expect(transcribe(Buffer.from('fixture'),getAsrConfig({}))).rejects.toThrow();expect(fetch).not.toHaveBeenCalled(); });
  it('does not retry or switch processor after timeout',async () => {const fetch=vi.fn().mockRejectedValue(new Error('timeout'));vi.stubGlobal('fetch',fetch);await expect(transcribe(Buffer.from('fixture'),getAsrConfig(base))).rejects.toThrow();expect(fetch).toHaveBeenCalledTimes(1);});
});
