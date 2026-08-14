'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { sendEmail, FROM } from '@/lib/email';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── Approve ───────────────────────────────────────────────────────────────────

export async function approveSlpApplication(
  id: string,
  applicantEmail: string,
  applicantName: string,
): Promise<{ ok: boolean; error?: string; hadAccount: boolean }> {
  const supabase = db();

  // 1. Mark accepted
  const { error: statusErr } = await supabase
    .from('slp_beta_applications')
    .update({ status: 'accepted' })
    .eq('id', id);
  if (statusErr) return { ok: false, error: statusErr.message, hadAccount: false };

  // 2. Try to set role='slp' on their profile (may not have an account yet)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('email', applicantEmail.toLowerCase())
    .single();

  const hadAccount = !!profile;
  if (profile) {
    await supabase
      .from('profiles')
      .update({ role: 'slp' })
      .eq('id', profile.id);
  }

  // 3. Send acceptance email
  const signupUrl = 'https://flowen.digital/auth/signup';
  const portalUrl = 'https://flowen.digital/slp';

  await sendEmail({
    from:    FROM.clinical,
    to:      applicantEmail,
    subject: "You're in — Flowen SLT Beta",
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;">
        <div style="background:#06080F;padding:24px 32px;border-radius:12px 12px 0 0;">
          <p style="color:#10B981;font-weight:900;font-size:18px;letter-spacing:-0.5px;margin:0;">FLOWEN</p>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <h1 style="font-size:22px;font-weight:800;margin:0 0 16px;">Welcome to the SLT Beta, ${applicantName.split(' ')[0]}.</h1>
          <p style="color:#374151;line-height:1.6;">Your application to the Flowen SLT Beta Programme has been accepted. You now have access to the clinical portal.</p>

          ${hadAccount
            ? `<p style="color:#374151;line-height:1.6;">Your existing Flowen account has been upgraded. Head straight to your portal:</p>
               <a href="${portalUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#10B981;color:#000;font-weight:700;border-radius:8px;text-decoration:none;">Open SLT Portal →</a>`
            : `<p style="color:#374151;line-height:1.6;">First, create your Flowen account using this email address — your portal access will be activated automatically:</p>
               <a href="${signupUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#10B981;color:#000;font-weight:700;border-radius:8px;text-decoration:none;">Create Your Account →</a>`
          }

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />

          <p style="color:#374151;line-height:1.6;font-size:14px;"><strong>What's included in the beta:</strong></p>
          <ul style="color:#374151;line-height:1.8;font-size:14px;padding-left:20px;">
            <li>Full caseload dashboard — up to 10 patients</li>
            <li>Session telemetry and 30-day activity charts</li>
            <li>Treatment plan management</li>
            <li>Clinical notes per session</li>
            <li>Safety flag alerts</li>
          </ul>

          <p style="color:#374151;line-height:1.6;font-size:14px;">
            Your dedicated training manual is at <a href="https://flowen.digital/training/clinicians" style="color:#10B981;">flowen.digital/training/clinicians</a>.
          </p>

          <p style="color:#374151;line-height:1.6;font-size:14px;">
            Any questions — reply to this email or reach us at <a href="mailto:clinical@flowen.digital" style="color:#10B981;">clinical@flowen.digital</a>.
          </p>

          <p style="color:#374151;font-size:14px;margin-top:24px;">
            — The Flowen Clinical Team
          </p>
        </div>
      </div>
    `,
  });

  revalidatePath('/admin/slp-beta');
  return { ok: true, hadAccount };
}

// ── Reject ────────────────────────────────────────────────────────────────────

export async function rejectSlpApplication(
  id: string,
  applicantEmail: string,
  applicantName: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db();

  const { error } = await supabase
    .from('slp_beta_applications')
    .update({ status: 'rejected' })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  await sendEmail({
    from:    FROM.clinical,
    to:      applicantEmail,
    subject: 'Flowen SLT Beta — Application Update',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;">
        <div style="background:#06080F;padding:24px 32px;border-radius:12px 12px 0 0;">
          <p style="color:#10B981;font-weight:900;font-size:18px;letter-spacing:-0.5px;margin:0;">FLOWEN</p>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <h1 style="font-size:22px;font-weight:800;margin:0 0 16px;">Thank you for applying, ${applicantName.split(' ')[0]}.</h1>
          <p style="color:#374151;line-height:1.6;">
            Thank you for your interest in the Flowen SLT Beta Programme. After reviewing your application, we're unable to offer you a place in the current cohort.
          </p>
          <p style="color:#374151;line-height:1.6;">
            Our beta is limited to a small group of clinicians at this stage, and we received more applications than we have capacity for. We'll keep your details and will be in touch if a place becomes available in a future cohort.
          </p>
          <p style="color:#374151;line-height:1.6;font-size:14px;">
            Any questions — <a href="mailto:clinical@flowen.digital" style="color:#10B981;">clinical@flowen.digital</a>.
          </p>
          <p style="color:#374151;font-size:14px;margin-top:24px;">— The Flowen Clinical Team</p>
        </div>
      </div>
    `,
  });

  revalidatePath('/admin/slp-beta');
  return { ok: true };
}

// ── Waitlist ──────────────────────────────────────────────────────────────────

export async function waitlistSlpApplication(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await db()
    .from('slp_beta_applications')
    .update({ status: 'waitlisted' })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/slp-beta');
  return { ok: true };
}
