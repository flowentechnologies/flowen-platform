import { NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/supabase/admin';
import {
  sendAffiliateApplicationConfirmation,
  sendAdminAffiliateApplicationAlert,
} from '@/lib/email';
import { checkAffiliateRateLimit } from '@/lib/rate-limit';

// ── Tier config (mirrors admin TIER_CONFIG) ────────────────────────────────────

const TIER_CONFIG = {
  standard: { label: 'Standard', commission_pct: 7.5,  recurring_months: 3  },
  premium:  { label: 'Premium',  commission_pct: 10.0, recurring_months: 6  },
  partner:  { label: 'Partner',  commission_pct: 15.0, recurring_months: 12 },
} as const;
type Tier = keyof typeof TIER_CONFIG;
const VALID_TIERS = new Set<string>(Object.keys(TIER_CONFIG));

// ── Referral code generator ────────────────────────────────────────────────────

function generateCode(name: string): string {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('-');
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${base || 'AFF'}-${suffix}`;
}

// ── Redirect helpers ───────────────────────────────────────────────────────────

function redirectTo(baseUrl: string, params: Record<string, string>): NextResponse {
  const url = new URL('/affiliates', baseUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // Anchor to the form section for errors/info so the user sees the message
  if (params.error || params.info) url.hash = 'apply';
  return NextResponse.redirect(url, 303);
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── Rate limit — 5 applications per IP per hour ───────────────────────────
  const forwarded = (req.headers as Headers).get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  const allowed = await checkAffiliateRateLimit(ip);
  if (!allowed) {
    return redirectTo(req.url, { error: 'Too many applications from this IP. Please try again later.' });
  }

  // Parse — handle both multipart/form-data and application/x-www-form-urlencoded
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return redirectTo(req.url, { error: 'Could not read form submission. Please try again.' });
  }

  const name             = (formData.get('name')             as string ?? '').trim();
  const email            = (formData.get('email')            as string ?? '').trim().toLowerCase();
  const tier             = (formData.get('tier')             as string ?? '').trim();
  const promotion_method = (formData.get('promotion_method') as string ?? '').trim();
  const rawUrl           = (formData.get('url')              as string ?? '').trim();

  // ── Validate ─────────────────────────────────────────────────────────────────

  if (!name || name.length < 2 || name.length > 120) {
    return redirectTo(req.url, { error: 'Full name is required (2–120 characters).' });
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return redirectTo(req.url, { error: 'A valid email address is required.' });
  }
  if (!VALID_TIERS.has(tier)) {
    return redirectTo(req.url, { error: 'Invalid tier selected.' });
  }
  if (!promotion_method || promotion_method.length < 10) {
    return redirectTo(req.url, { error: "Please describe how you'll promote Flowen (at least 10 characters)." });
  }
  if (promotion_method.length > 2000) {
    return redirectTo(req.url, { error: 'Promotion description must be under 2000 characters.' });
  }
  if (rawUrl && !/^https?:\/\/.+/.test(rawUrl)) {
    return redirectTo(req.url, { error: 'Website URL must start with https://' });
  }

  const website = rawUrl || null;
  const tierCfg = TIER_CONFIG[tier as Tier];

  // ── Duplicate check ───────────────────────────────────────────────────────────

  const client = db();
  const { data: existing } = await client
    .from('affiliates')
    .select('id, status')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    const s = existing.status as string;
    if (s === 'pending') {
      return redirectTo(req.url, {
        info: "You already have a pending application — we'll be in touch within 2 business days.",
      });
    }
    if (s === 'active') {
      return redirectTo(req.url, {
        info: "You're already an active affiliate. Check your email for your referral link.",
      });
    }
    if (s === 'suspended') {
      return redirectTo(req.url, {
        info: 'Your affiliate account is currently suspended. Write to affiliates@flowen.digital to discuss.',
      });
    }
    // status === 'rejected' — allow re-application; fall through and update the row
    const { error: updateErr } = await client
      .from('affiliates')
      .update({
        name,
        tier,
        commission_pct:   tierCfg.commission_pct,
        recurring_months: tierCfg.recurring_months,
        channel:          website ? 'web' : null,
        website,
        notes:            promotion_method,
        status:           'pending',
        updated_at:       new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updateErr) {
      console.error('[affiliate/apply] re-apply update error:', updateErr);
      return redirectTo(req.url, { error: 'Something went wrong — please try again.' });
    }

    void Promise.all([
      sendAffiliateApplicationConfirmation({
        email,
        displayName:     name.split(' ')[0],
        tier:            tierCfg.label,
        commissionPct:   tierCfg.commission_pct,
        recurringMonths: tierCfg.recurring_months,
      }),
      sendAdminAffiliateApplicationAlert({
        name, email,
        tier:            tierCfg.label,
        commissionPct:   tierCfg.commission_pct,
        promotionMethod: promotion_method,
        website,
        affiliateId:     existing.id,
      }),
    ]);

    return redirectTo(req.url, { applied: '1' });
  }

  // ── Insert new record ─────────────────────────────────────────────────────────

  const code = generateCode(name);
  const { data: affiliate, error: insertErr } = await client
    .from('affiliates')
    .insert({
      name,
      email,
      code,
      tier,
      status:           'pending',
      commission_pct:   tierCfg.commission_pct,
      recurring_months: tierCfg.recurring_months,
      channel:          website ? 'web' : null,
      website,
      notes:            promotion_method,
      updated_at:       new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertErr) {
    console.error('[affiliate/apply] insert error:', insertErr);
    return redirectTo(req.url, { error: 'Something went wrong — please try again.' });
  }

  // ── Send emails (non-blocking) ────────────────────────────────────────────────

  void Promise.all([
    sendAffiliateApplicationConfirmation({
      email,
      displayName:     name.split(' ')[0],
      tier:            tierCfg.label,
      commissionPct:   tierCfg.commission_pct,
      recurringMonths: tierCfg.recurring_months,
    }),
    sendAdminAffiliateApplicationAlert({
      name, email,
      tier:            tierCfg.label,
      commissionPct:   tierCfg.commission_pct,
      promotionMethod: promotion_method,
      website,
      affiliateId:     affiliate.id,
    }),
  ]);

  return redirectTo(req.url, { applied: '1' });
}
