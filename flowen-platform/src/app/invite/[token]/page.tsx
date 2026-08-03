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
      <svg viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-auto">
        <defs>
          <linearGradient id="fw-invite" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#F59E0B"/>
            <stop offset="35%" stopColor="#10B981"/>
            <stop offset="100%" stopColor="#06B6D4"/>
          </linearGradient>
        </defs>
        <path d="M 10 25 C 20 25, 25 38, 35 38 C 48 38, 52 12, 65 12 C 78 12, 82 42, 95 42 C 105 42, 108 30, 115 30" stroke="url(#fw-invite)" strokeWidth="6" strokeLinecap="round" fill="none"/>
        <path d="M 10 33 C 20 33, 25 46, 35 46 C 48 46, 52 20, 65 20 C 78 20, 82 50, 95 50 C 105 50, 108 38, 115 38" stroke="url(#fw-invite)" strokeWidth="6" strokeLinecap="round" fill="none"/>
      </svg>
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
    const loginUrl = `/auth/login?email=${encodeURIComponent(signup.email)}&invited=1`;
    return (
      <ErrorPage
        title="Invitation already claimed"
        body={`This invitation has already been accepted. Click below to sign in as ${signup.email}.`}
        cta={
          <Link
            href={loginUrl}
            className="inline-block bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm px-6 py-3 rounded-xl transition-colors"
          >
            Sign in →
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
        body="This invitation link has expired. Request a new one and we'll send it right away."
        cta={
          <a
            href="mailto:hello@flowen.digital?subject=New invitation request"
            className="inline-block bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm px-6 py-3 rounded-xl transition-colors"
          >
            Request a new invitation →
          </a>
        }
      />
    );
  }

  // Atomic claim: the WHERE .is('converted_at', null) guard ensures only one
  // concurrent request can mark the invite as used (TOCTOU protection).
  const { count: claimed } = await db()
    .from('waitlist_signups')
    .update({ converted_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', signup.id)
    .is('converted_at', null);

  if (!claimed) {
    const loginUrl = `/auth/login?email=${encodeURIComponent(signup.email)}&invited=1`;
    return (
      <ErrorPage
        title="Invitation already claimed"
        body={`This invitation has already been accepted. Click below to sign in as ${signup.email}.`}
        cta={
          <Link
            href={loginUrl}
            className="inline-block bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm px-6 py-3 rounded-xl transition-colors"
          >
            Sign in →
          </Link>
        }
      />
    );
  }

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
