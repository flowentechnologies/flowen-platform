'use server';

import { createClient } from '@supabase/supabase-js';
import { sendEmail, FROM, ADMIN_INBOX } from '@/lib/email';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin credentials not configured');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export interface SlpBetaPayload {
  name: string;
  email: string;
  organisation: string;
  caseload_size: string;
  client_group: string;
  motivation?: string;
}

export async function applySlpBeta(
  data: SlpBetaPayload,
): Promise<{ success: boolean; message: string }> {
  const { name, email, organisation, caseload_size, client_group, motivation } = data;

  if (!name?.trim())         return { success: false, message: 'Your name is required.' };
  if (!email || !/^\S+@\S+\.\S+$/.test(email))
                             return { success: false, message: 'A valid work email is required.' };
  if (!organisation?.trim()) return { success: false, message: 'Organisation is required.' };
  if (!caseload_size)        return { success: false, message: 'Please select your caseload size.' };
  if (!client_group)         return { success: false, message: 'Please select your client group.' };

  const normalised = email.toLowerCase().trim();

  try {
    const { error } = await adminClient()
      .from('slp_beta_applications')
      .insert({
        name:          name.trim(),
        email:         normalised,
        organisation:  organisation.trim(),
        caseload_size,
        client_group,
        motivation:    motivation?.trim() || null,
      });

    if (error) {
      if (error.code === '23505') {
        // Already applied — don't reveal this, return success silently
        return { success: true, message: 'Application received!' };
      }
      console.error('[apply-slp-beta] insert error:', error.message);
      return { success: false, message: 'Unable to submit right now. Please try again.' };
    }

    // Confirmation email to the applicant
    void sendEmail({
      from:    FROM.clinical,
      to:      normalised,
      subject: 'Your Flowen SLT Beta Application — received',
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;background:#06080F;color:#e2e8f0;padding:40px 32px;border-radius:16px">
          <div style="margin-bottom:28px">
            <span style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#34d399">FLOWEN CLINICAL</span>
          </div>
          <h1 style="font-size:22px;font-weight:800;color:#fff;margin:0 0 12px">Hi ${name.trim()}, your application is in.</h1>
          <p style="font-size:15px;line-height:1.6;color:#94a3b8;margin:0 0 20px">
            Thank you for applying to the Flowen SLT Beta Programme. We're reviewing applications in the order they arrive and selecting the first 10 SLTs who are a good fit for the initial cohort.
          </p>
          <p style="font-size:15px;line-height:1.6;color:#94a3b8;margin:0 0 20px">
            We'll be in touch within <strong style="color:#e2e8f0">5–7 working days</strong> with a decision. If selected, you'll receive onboarding materials, patient enrolment instructions, and a direct line to our clinical team.
          </p>
          <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:20px;margin:24px 0;font-size:13px;color:#64748b">
            <strong style="color:#94a3b8;display:block;margin-bottom:8px">Your application summary</strong>
            Organisation: ${organisation.trim()}<br/>
            Caseload size: ${caseload_size}<br/>
            Client group: ${client_group}
          </div>
          <p style="font-size:13px;color:#475569;margin:24px 0 0">Questions? Reply to this email or write to <a href="mailto:clinical@flowen.digital" style="color:#34d399">clinical@flowen.digital</a></p>
        </div>
      `,
      text: `Hi ${name.trim()},\n\nThank you for applying to the Flowen SLT Beta Programme. We'll be in touch within 5–7 working days.\n\nFlowen Clinical\nclinical@flowen.digital`,
    });

    // Admin alert
    void sendEmail({
      from:    FROM.alerts,
      to:      ADMIN_INBOX,
      subject: `New SLT Beta Application — ${name.trim()} (${organisation.trim()})`,
      html: `
        <p><strong>Name:</strong> ${name.trim()}</p>
        <p><strong>Email:</strong> ${normalised}</p>
        <p><strong>Organisation:</strong> ${organisation.trim()}</p>
        <p><strong>Caseload size:</strong> ${caseload_size}</p>
        <p><strong>Client group:</strong> ${client_group}</p>
        <p><strong>Motivation:</strong> ${motivation?.trim() || '—'}</p>
      `,
      text: `New SLT Beta Application\n\nName: ${name.trim()}\nEmail: ${normalised}\nOrganisation: ${organisation.trim()}\nCaseload: ${caseload_size}\nGroup: ${client_group}\nMotivation: ${motivation?.trim() || '—'}`,
    });

    return { success: true, message: 'Application received!' };
  } catch (err) {
    console.error('[apply-slp-beta] unexpected error:', err);
    return { success: false, message: 'Unable to submit right now. Please try again.' };
  }
}
