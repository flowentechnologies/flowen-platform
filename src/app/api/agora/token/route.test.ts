import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({user:vi.fn(),token:vi.fn()}));
vi.mock('@/lib/supabase/from-request',()=>({getUserFromRequest:mocks.user}));
vi.mock('agora-token',()=>({RtcTokenBuilder:{buildTokenWithUid:mocks.token},RtcRole:{PUBLISHER:1}}));
import {POST} from './route';
import {ownerChannel} from '@/lib/agora/ownership';
const owner='12345678-1234-1234-1234-123456789abc';
const req=(body:unknown)=>new Request('https://flowen.test/api/agora/token',{method:'POST',body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();mocks.user.mockResolvedValue({id:owner});mocks.token.mockReturnValue('user-token');process.env.AGORA_APP_ID='app';process.env.AGORA_APP_CERTIFICATE='cert';});
describe('RTC caller token ownership',()=>{
 it('forces the full owner channel even when a foreign channel is supplied',async()=>{const res=await POST(req({channel:'foreign',uid:5}));expect(res.status).toBe(200);expect((await res.json()).channel).toBe(ownerChannel(owner));expect(mocks.token).toHaveBeenCalledWith('app','cert',ownerChannel(owner),5,1,expect.any(Number),expect.any(Number));});
 it.each([null,[],{uid:9999},{uid:-1},{uid:1.5},{uid:0x100000000},{uid:'1'}])('rejects malformed or reserved UID',async body=>{expect((await POST(req(body))).status).toBe(400);expect(mocks.token).not.toHaveBeenCalled();});
 it('requires authentication',async()=>{mocks.user.mockResolvedValue(null);expect((await POST(req({}))).status).toBe(401);expect(mocks.token).not.toHaveBeenCalled();});
});
