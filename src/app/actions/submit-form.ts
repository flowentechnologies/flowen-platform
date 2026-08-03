'use server';

import { sendEmail, FROM, ADMIN_INBOX } from '@/lib/email';

export type FormState = {
  success: boolean;
  message: string;
  errors?: Record<string, string>;
};

export async function submitContactForm(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const name    = formData.get('name')    as string;
  const email   = formData.get('email')   as string;
  const role    = formData.get('role')    as string;
  const tier    = formData.get('tier')    as string;
  const message = formData.get('message') as string;

  const errors: Record<string, string> = {};
  if (!name || name.trim().length < 2) errors.name = 'Full name is required.';
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) errors.email = 'Valid email address is required.';
  if (!message || message.trim().length < 10) errors.message = 'Message must be at least 10 characters.';

  if (Object.keys(errors).length > 0) {
    return { success: false, message: 'Please correct the errors in the form.', errors };
  }

  const text = `Name: ${name}
Email: ${email}
Role/Organization: ${role || 'Not specified'}
Selected Tier: ${tier || 'General Interest'}

Message:
${message}

--
Sent from Flowen landing page · ${new Date().toISOString()}`;

  const ok = await sendEmail({
    from:    FROM.hello,
    to:      ADMIN_INBOX,
    subject: `[Flowen Inquiry] ${tier || 'General'} from ${name}`,
    replyTo: email,
    text,
    html: `<pre style="font-family:sans-serif;font-size:14px;line-height:1.7;white-space:pre-wrap;">${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`,
  });

  if (ok) {
    return { success: true, message: 'Thank you. Your inquiry has been sent to our team at hello@flowen.digital.' };
  }
  return { success: false, message: 'Unable to send your message right now. Please email us directly at hello@flowen.digital.' };
}
