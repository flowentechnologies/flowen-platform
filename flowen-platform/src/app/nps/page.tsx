import type { Metadata } from 'next';
import NpsClient from './NpsClient';
import { adminDb as db } from '@/lib/supabase/admin';

export const metadata: Metadata = {
  title: 'Share your feedback | Flowen',
  robots: { index: false, follow: false },
};

export default async function NpsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; score?: string }>;
}) {
  const params = await searchParams;
  const token  = params.token ?? '';
  const scoreParam = params.score ? parseInt(params.score, 10) : null;
  const initialScore = scoreParam !== null && scoreParam >= 0 && scoreParam <= 10 ? scoreParam : null;

  // Validate token & check if already answered
  let alreadyResponded = false;
  let validToken = false;

  if (token) {
    const { data } = await db()
      .from('nps_responses')
      .select('responded_at')
      .eq('survey_token', token)
      .single();

    if (data) {
      validToken = true;
      alreadyResponded = data.responded_at !== null;
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <img
            src="/email-logo.svg"
            width={44}
            height={22}
            alt="Flowen"
            className="block"
          />
          <span className="text-lg font-black tracking-tight text-slate-100">FLOWEN</span>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="h-0.5 bg-emerald-500" />
          <div className="p-8">

            {!token || !validToken ? (
              <div className="text-center py-8">
                <p className="text-slate-400 text-sm">This survey link is invalid or has expired.</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-5">
                  Quick question
                </p>
                <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight mb-2">
                  How likely are you to recommend Flowen?
                </h1>
                <p className="text-slate-400 text-sm mb-8">
                  Your answer helps us understand what&apos;s working and what isn&apos;t.
                </p>
                <NpsClient
                  initialScore={initialScore}
                  token={token}
                  alreadyResponded={alreadyResponded}
                />
              </>
            )}

          </div>
        </div>

        <p className="text-center text-xs text-slate-700 mt-6">
          Flowen Speech Technology Ltd · England &amp; Wales
        </p>
      </div>
    </div>
  );
}
