'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { AdminUserProfile } from '@/app/api/admin/users/[id]/route';

function fmt(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function fmtRelative(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function Initials({ name, email }: { name: string | null; email: string }) {
  const src = name ?? email;
  const letters = src
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl font-bold font-mono">
      {letters || '?'}
    </div>
  );
}

function Badge({ label, colour }: { label: string; colour: string }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border ${colour}`}>
      {label}
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminUserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<AdminUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/users/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('User not found');
        return r.json();
      })
      .then((data) => setUser(data.user ?? null))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-48 bg-slate-100 dark:bg-slate-800 rounded" />
        <div className="h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Back to Users
        </Link>
        <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-8 text-center">
          <p className="text-red-400 font-semibold">{error ?? 'User not found'}</p>
          <p className="text-slate-500 text-sm mt-1">The user ID may be invalid or the profile may have been deleted.</p>
        </div>
      </div>
    );
  }

  const tierColours: Record<string, string> = {
    founding:        'bg-amber-500/10 text-amber-400 border-amber-500/30',
    standard:        'bg-sky-500/10 text-sky-400 border-sky-500/30',
    public_funds:    'bg-purple-500/10 text-purple-400 border-purple-500/30',
    vocali_freemium: 'bg-slate-700/50 text-slate-400 border-slate-600/30',
    pro:             'bg-sky-500/10 text-sky-400 border-sky-500/30',
    free:            'bg-slate-700/50 text-slate-400 border-slate-600/30',
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/admin/users" className="hover:text-slate-900 dark:hover:text-white transition-colors">Users</Link>
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd"/>
        </svg>
        <span className="text-slate-600 dark:text-slate-300 truncate max-w-xs">{user.email}</span>
      </div>

      {/* Identity card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex items-start gap-5">
          <Initials name={user.display_name} email={user.email} />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
              {user.display_name ?? <span className="text-slate-500 italic font-normal text-base">No display name</span>}
            </h1>
            <p className="text-sm text-slate-400 font-mono mt-0.5 truncate">{user.email}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {user.tier && (
                <Badge
                  label={user.tier.toUpperCase()}
                  colour={tierColours[user.tier] ?? 'bg-slate-700/50 text-slate-400 border-slate-600/30'}
                />
              )}
              {user.is_admin && <Badge label="ADMIN" colour="bg-purple-500/10 text-purple-400 border-purple-500/30" />}
              {user.early_access && <Badge label="BETA" colour="bg-emerald-500/10 text-emerald-400 border-emerald-500/30" />}
              {user.onboarding_complete && <Badge label="ONBOARDED" colour="bg-teal-500/10 text-teal-400 border-teal-500/30" />}
              {user.id_verified
                ? <Badge label="ID VERIFIED" colour="bg-emerald-500/10 text-emerald-400 border-emerald-500/30" />
                : <Badge label="UNVERIFIED" colour="bg-slate-700/50 text-slate-500 border-slate-600/30" />
              }
            </div>
          </div>
          <div className="shrink-0 text-right text-[10px] font-mono text-slate-600 space-y-1">
            <p>Joined {fmt(user.created_at)}</p>
            <p>Last sign-in {fmt(user.last_sign_in_at)}</p>
            <p className="text-slate-700 break-all max-w-[180px]">{user.id}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat
          label="Sessions"
          value={user.total_sessions.toString()}
          sub="last 20 loaded"
        />
        <Stat
          label="Total practice"
          value={fmtDuration(user.total_duration_seconds)}
        />
        <Stat
          label="Last session"
          value={fmtRelative(user.last_session_at)}
          sub={user.last_session_at ? fmt(user.last_session_at) : undefined}
        />
        <Stat
          label="Onboarded"
          value={user.onboarding_complete ? 'Yes' : 'No'}
        />
      </div>

      {/* Account details */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-5">Account details</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {[
            { label: 'User ID',            value: user.id,                                    mono: true },
            { label: 'Email',              value: user.email,                                 mono: true },
            { label: 'Display name',       value: user.display_name ?? '—',                   mono: false },
            { label: 'Role',               value: user.role ?? '—',                           mono: true },
            { label: 'Tier',               value: user.tier ?? 'None',                        mono: true },
            { label: 'Admin',              value: user.is_admin ? 'Yes' : 'No',               mono: false },
            { label: 'Beta access',        value: user.early_access ? 'Yes' : 'No',           mono: false },
            { label: 'Onboarding complete',value: user.onboarding_complete ? 'Yes' : 'No',    mono: false },
            { label: 'Joined',             value: fmt(user.created_at),                       mono: true },
            { label: 'Last sign-in',       value: fmt(user.last_sign_in_at),                  mono: true },
            { label: 'Last session',       value: fmt(user.last_session_at),                  mono: true },
          ].map(({ label, value, mono }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-[10px] font-mono uppercase tracking-widest text-slate-600">{label}</dt>
              <dd className={`text-sm text-slate-200 break-all ${mono ? 'font-mono' : ''}`}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* KYC & Identity */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">KYC & Identity</h2>
          {user.id_verified
            ? (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/>
                </svg>
                Verified {user.id_verified_at ? fmt(user.id_verified_at) : ''}
              </span>
            ) : (
              <span className="text-[10px] font-mono text-slate-600">Not yet verified</span>
            )
          }
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {/* Date of birth — show age, not raw DOB, to reduce exposure */}
          <div className="flex flex-col gap-0.5">
            <dt className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Date of birth</dt>
            <dd className="text-sm text-slate-200 font-mono">
              {user.date_of_birth
                ? (() => {
                    const dob = new Date(user.date_of_birth);
                    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                    return `${dob.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} (age ${age})`;
                  })()
                : '—'}
            </dd>
          </div>

          <div className="flex flex-col gap-0.5">
            <dt className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Country of residence</dt>
            <dd className="text-sm text-slate-200 font-mono">
              {user.country_of_residence === 'GB'
                ? '🇬🇧 United Kingdom'
                : user.country_of_residence === 'IE'
                ? '🇮🇪 Republic of Ireland'
                : user.country_of_residence === 'OTHER'
                ? '🌍 Other'
                : user.country_of_residence ?? '—'}
            </dd>
          </div>

          <div className="flex flex-col gap-0.5">
            <dt className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Phone number</dt>
            <dd className="text-sm text-slate-200 font-mono">
              {user.phone_number
                ? <a href={`tel:${user.phone_number}`} className="hover:text-emerald-400 transition-colors">{user.phone_number}</a>
                : '—'}
            </dd>
          </div>

          <div className="flex flex-col gap-0.5">
            <dt className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Marketing consent</dt>
            <dd className={`text-sm font-mono ${user.marketing_consent ? 'text-emerald-400' : 'text-slate-500'}`}>
              {user.marketing_consent ? 'Opted in' : 'Not opted in'}
            </dd>
          </div>

          {/* Funding / professional fields — only show non-null ones */}
          {user.employer_name && (
            <div className="flex flex-col gap-0.5">
              <dt className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Employer (AtW)</dt>
              <dd className="text-sm text-slate-200">{user.employer_name}</dd>
            </div>
          )}
          {user.hcpc_number && (
            <div className="flex flex-col gap-0.5">
              <dt className="text-[10px] font-mono uppercase tracking-widest text-slate-600">HCPC number</dt>
              <dd className="text-sm text-slate-200 font-mono">
                <a
                  href={`https://www.hcpc-uk.org/check-the-register/?registrantId=${user.hcpc_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-400 transition-colors underline underline-offset-2"
                >
                  {user.hcpc_number} ↗
                </a>
              </dd>
            </div>
          )}
          {user.institution_name && (
            <div className="flex flex-col gap-0.5">
              <dt className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Institution (DSA / NHS)</dt>
              <dd className="text-sm text-slate-200">{user.institution_name}</dd>
            </div>
          )}
        </dl>

        {/* Address sub-section */}
        {user.address_line1 && (
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Home address</p>
              {user.address_verified_at ? (
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                  <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/>
                  </svg>
                  Postcode verified {fmt(user.address_verified_at)}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-amber-500">Postcode not verified</span>
              )}
            </div>
            <address className="not-italic text-sm text-slate-200 leading-relaxed">
              {user.address_line1}<br />
              {user.address_line2 && <>{user.address_line2}<br /></>}
              {user.address_city && <>{user.address_city}<br /></>}
              {user.address_postcode && (
                <span className="font-mono font-semibold">{user.address_postcode}</span>
              )}
              {user.address_region && (
                <span className="text-slate-500 text-xs ml-2">({user.address_region})</span>
              )}
            </address>
          </div>
        )}
      </div>

      {/* Recent sessions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
            Recent practice sessions
            <span className="ml-2 text-slate-600 normal-case tracking-normal">(last {user.recent_sessions.length})</span>
          </h2>
        </div>
        {user.recent_sessions.length === 0 ? (
          <div className="px-6 py-10 text-center text-slate-600 text-sm">No sessions recorded yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">Duration</th>
                  <th className="px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">Stage</th>
                  <th className="px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">Blocks</th>
                  <th className="px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">Reps</th>
                  <th className="px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">Prolongs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {user.recent_sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {fmt(s.created_at)}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                      {fmtDuration(s.duration_seconds)}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {s.stage_id != null ? `Stage ${s.stage_id}` : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {s.total_blocks_detected ?? 0}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {s.total_repetitions_detected ?? 0}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {s.total_prolongations_detected ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href="/admin/users"
          className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-600 text-sm font-medium transition-colors"
        >
          ← Back to Users
        </Link>
      </div>
    </div>
  );
}
