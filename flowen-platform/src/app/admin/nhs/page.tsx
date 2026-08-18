import { assertAdmin } from '@/lib/admin/guard';
import { NHSClient } from './NHSClient';
import type { ICBContact, SLPSignup, BlockPledge } from '@/app/api/admin/nhs/route';
import { adminDb as db } from '@/lib/supabase/admin';

export default async function NHSPage() {
  await assertAdmin();

  const client = db();

  const [icbRes, slpRes, pledgeRes] = await Promise.all([
    client.from('nhs_icb_contacts').select('*').order('created_at', { ascending: false }),
    client.from('nhs_slp_signups').select('*').order('created_at', { ascending: false }),
    client.from('nhs_block_pledges').select('*').order('created_at', { ascending: false }),
  ]);

  const icbContacts:  ICBContact[]   = icbRes.error    ? [] : (icbRes.data    ?? []);
  const slpSignups:   SLPSignup[]    = slpRes.error    ? [] : (slpRes.data    ?? []);
  const blockPledges: BlockPledge[]  = pledgeRes.error ? [] : (pledgeRes.data ?? []);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          {/* NHS-blue icon mark */}
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-600/30 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">NHS Partnership Pipeline</h1>
        </div>
        <p className="text-sm text-slate-500 font-mono mt-1 ml-11">ICB procurement, SLP portal adoption, and block funding pledges</p>
      </div>
      <NHSClient
        initialICBContacts={icbContacts}
        initialSLPSignups={slpSignups}
        initialBlockPledges={blockPledges}
      />
    </div>
  );
}
