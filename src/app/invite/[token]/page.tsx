import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

// ── DB client ─────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── Sub-pages ─────────────────────────────────────────────────────────────────

function BrandMark() {
  return (
    <div className="flex items-center gap-2 mb-8">
      <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-slate-950 font-black text-sm">
        F
      </div>
      <span className="font-bold text-white text-base tracking-tight">Flowen</span>
    </div>
  );
}

function ErrorPage({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0D14] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <BrandMark />
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-xl font-bold text-white mb-3">{title}</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">{body}</p>
          {cta}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;

  const { data: row } = await db()
    .from('waitlist_signups')
    .select('id, email, invite_expires_at, converted_at')
    .eq('invite_token', token)
    .maybeSingle();

  // Not found
  if (!row) {
    return (
      <ErrorPage
        title="Invalid invitation"
        body="This invitation link is invalid or has already been used. Please check your email for the correct link."
      />
    );
  }

  const signup = row as {
    id: string;
    email: string;
    invite_expires_at: string | null;
    converted_at: string | null;
  };

  // Already converted
  if (signup.converted_at !== null) {
    return (
      <ErrorPage
        title="Already joined"
        body="You have already accepted this invitation and created your account. Sign in below to continue."
        cta={
          <Link
            href="/auth/login"
            className="inline-block bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm px-6 py-3 rounded-xl transition-colors"
          >
            Sign in
          </Link>
        }
      />
    );
  }

  // Expired
  if (!signup.invite_expires_at || new Date(signup.invite_expires_at) < new Date()) {
    return (
      <ErrorPage
        title="Invitation expired"
        body="This invitation link has expired. Please contact hello@flowen.digital to request a new invitation."
      />
    );
  }

  // Valid — mark as converted
  await db()
    .from('waitlist_signups')
    .update({ converted_at: new Date().toISOString() })
    .eq('id', signup.id);

  const loginUrl = `/auth/login?email=${encodeURIComponent(signup.email)}&invited=1`;

  return (
    <div className="min-h-screen bg-[#0A0D14] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <BrandMark />
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <span className="inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold px-3 py-1 rounded-full">
              Invitation accepted
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">
            You&apos;re in, {signup.email.split('@')[0]}.
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Your Flowen account is ready. Click below and we&apos;ll send a magic sign-in link to{' '}
            <span className="text-slate-200 font-medium">{signup.email}</span>. No password needed.
          </p>
          <Link
            href={loginUrl}
            className="block w-full text-center bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm px-6 py-3.5 rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
          >
            Continue to sign in
          </Link>
          <p className="text-slate-600 text-xs text-center mt-4">
            You&apos;ll receive a one-time magic link at {signup.email}
          </p>
        </div>
      </div>
    </div>
  );
}
