import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export interface AdminUserProfile {
  id: string;
  email: string;
  display_name: string | null;
  tier: string | null;
  role: string | null;
  is_admin: boolean;
  early_access: boolean;
  onboarding_complete: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  // KYC fields
  date_of_birth: string | null;
  country_of_residence: string | null;
  phone_number: string | null;
  employer_name: string | null;
  hcpc_number: string | null;
  institution_name: string | null;
  marketing_consent: boolean;
  id_verified: boolean;
  id_verified_at: string | null;
  // Address
  address_line1: string | null;
  address_line2: string | null;
  address_city: string | null;
  address_postcode: string | null;
  address_region: string | null;
  address_verified_at: string | null;
  // practice stats
  total_sessions: number;
  total_duration_seconds: number;
  last_session_at: string | null;
  recent_sessions: {
    id: string;
    created_at: string;
    duration_seconds: number;
    stage_id: number | null;
    total_blocks_detected: number;
    total_repetitions_detected: number;
    total_prolongations_detected: number;
  }[];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const client = serviceClient();

  const [profileRes, authRes, sessionsRes] = await Promise.all([
    client
      .from('profiles')
      // eslint-disable-next-line max-len
      .select('id,display_name,tier,role,is_admin,early_access,onboarding_complete,created_at,date_of_birth,country_of_residence,phone_number,employer_name,hcpc_number,institution_name,marketing_consent,id_verified,id_verified_at,address_line1,address_line2,address_city,address_postcode,address_region,address_verified_at')
      .eq('id', id)
      .single(),
    client.schema('auth').from('users').select('id,email,last_sign_in_at').eq('id', id).single(),
    client
      .from('practice_sessions')
      .select(
        'id,created_at,duration_seconds,stage_id,total_blocks_detected,total_repetitions_detected,total_prolongations_detected',
      )
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (profileRes.error || !profileRes.data) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const profile = profileRes.data;
  const auth = authRes.data;
  const sessions = (sessionsRes.data ?? []) as AdminUserProfile['recent_sessions'];

  const totalDuration = sessions.reduce((s, r) => s + (r.duration_seconds ?? 0), 0);
  const lastSession = sessions[0]?.created_at ?? null;

  const result: AdminUserProfile = {
    id: profile.id,
    email: auth?.email ?? '',
    display_name: profile.display_name,
    tier: profile.tier,
    role: profile.role ?? null,
    is_admin: profile.is_admin,
    early_access: profile.early_access,
    onboarding_complete: profile.onboarding_complete,
    created_at: profile.created_at,
    last_sign_in_at: auth?.last_sign_in_at ?? null,
    // KYC
    date_of_birth:        profile.date_of_birth ?? null,
    country_of_residence: profile.country_of_residence ?? null,
    phone_number:         profile.phone_number ?? null,
    employer_name:        profile.employer_name ?? null,
    hcpc_number:          profile.hcpc_number ?? null,
    institution_name:     profile.institution_name ?? null,
    marketing_consent:    profile.marketing_consent ?? false,
    id_verified:          profile.id_verified ?? false,
    id_verified_at:       profile.id_verified_at ?? null,
    // Address
    address_line1:        profile.address_line1 ?? null,
    address_line2:        profile.address_line2 ?? null,
    address_city:         profile.address_city ?? null,
    address_postcode:     profile.address_postcode ?? null,
    address_region:       profile.address_region ?? null,
    address_verified_at:  profile.address_verified_at ?? null,
    // practice stats
    total_sessions: sessions.length,
    total_duration_seconds: totalDuration,
    last_session_at: lastSession,
    recent_sessions: sessions.slice(0, 10),
  };

  return NextResponse.json({ user: result });
}
