import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getStripeClient } from '@/lib/stripe';
import { buildPurchaseEventPayload, type PurchaseEventPayload } from '@/lib/analytics/purchase-event';
import { PurchaseEventTracker } from '@/components/analytics/PurchaseEventTracker';

export const metadata = { title: 'Welcome to Flowen' };

/**
 * Stripe redirects here with ?session_id={CHECKOUT_SESSION_ID} — see
 * success_url in /api/stripe/checkout. Resolves the real transaction for
 * GA4's purchase event (src/lib/analytics/purchase-event.ts) rather than
 * reporting nothing, or static/hardcoded values, on the one page in the app
 * whose entire job is confirming a purchase.
 *
 * Verifies the session's own email matches the signed-in user before using
 * it for anything — a session_id is a plausible thing to see turn up as a
 * copy-pasted or replayed query param, and this is a live Stripe API call
 * against whatever id is handed to it.
 */
async function resolvePurchaseEvent(
  sessionId: string | undefined,
  userEmail: string | null | undefined,
): Promise<PurchaseEventPayload | null> {
  if (!sessionId || !userEmail) return null;

  try {
    const { client } = await getStripeClient();
    const session = await client.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'line_items.data.price.product'],
    });

    if (session.customer_details?.email?.toLowerCase() !== userEmail.toLowerCase()) {
      return null;
    }

    const lineItems = session.line_items?.data ?? [];
    if (lineItems.length === 0) return null;

    return buildPurchaseEventPayload(session.id, session.currency, lineItems);
  } catch (err) {
    // A dead/invalid/already-expired session id must never break the
    // welcome page itself — worst case, this one purchase goes untracked.
    console.error('[dashboard/welcome] failed to resolve checkout session for GA4 purchase event:', err);
    return null;
  }
}

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const [{ data: profile }, purchaseEvent] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
    resolvePurchaseEvent(session_id, user.email),
  ]);

  const firstName = (profile?.display_name ?? user.email?.split('@')[0] ?? 'there')
    .split(' ')[0];

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-6 py-12">
      {purchaseEvent && <PurchaseEventTracker payload={purchaseEvent} />}
      <div className="max-w-lg w-full space-y-10 text-center">

        {/* Celebration */}
        <div className="space-y-4">
          <div className="text-6xl">🎉</div>
          <div>
            <p className="text-[11px] font-mono uppercase tracking-widest text-emerald-500 mb-2">
              7-day free trial started
            </p>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight" style={{ textWrap: 'balance' }}>
              You&apos;re in, {firstName}.
            </h1>
            <p className="text-slate-400 text-sm mt-2 leading-relaxed">
              No charge for 7 days. Full access from right now.
            </p>
          </div>
        </div>

        {/* First-week plan */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left space-y-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Your first week — what to do
          </p>
          {[
            {
              day: 'Today',
              color: 'emerald',
              title: 'Do your first session',
              body: 'Pick Stage 1 (Breathing) and speak for 3 minutes. This gives you your baseline block-per-minute — the number every session from here improves.',
            },
            {
              day: 'Days 2–4',
              color: 'sky',
              title: 'Build the habit',
              body: 'One session a day, any stage. The AI tracks your patterns — you\'ll start seeing which techniques move your numbers.',
            },
            {
              day: 'Day 7',
              color: 'violet',
              title: 'Review your progress',
              body: 'Check your dashboard for your before-vs-after BPM, session count, and streak. That\'s one week of real data.',
            },
          ].map(({ day, color, title, body }) => (
            <div key={day} className="flex gap-4">
              <div className={`shrink-0 mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold font-mono whitespace-nowrap ${
                color === 'emerald' ? 'bg-emerald-500/15 text-emerald-400' :
                color === 'sky'     ? 'bg-sky-500/15     text-sky-400'     :
                                      'bg-violet-500/15  text-violet-400'
              }`}>{day}</div>
              <div>
                <p className="text-sm font-bold text-slate-100 leading-tight">{title}</p>
                <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="space-y-3">
          <Link
            href="/dashboard/practice"
            className="block w-full rounded-xl px-6 py-4 font-bold text-sm bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 transition-all hover:scale-[1.02] shadow-lg shadow-emerald-500/20"
          >
            Start my first session →
          </Link>
          <Link
            href="/dashboard"
            className="block w-full rounded-xl px-6 py-3 font-medium text-sm bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
          >
            Go to dashboard first
          </Link>
        </div>

        {/* Reassurance */}
        <p className="text-xs text-slate-600">
          No charge until day 8 · Cancel any time before then · From £19.96/mo after trial
        </p>

      </div>
    </div>
  );
}
