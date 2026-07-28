'use server';

import nodemailer from 'nodemailer';

export type FormState = {
  success: boolean;
  message: string;
  errors?: Record<string, string>;
};

export async function submitContactForm(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const role = formData.get('role') as string;
  const tier = formData.get('tier') as string;
  const message = formData.get('message') as string;

  const errors: Record<string, string> = {};
  if (!name || name.trim().length < 2) errors.name = 'Full name is required.';
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) errors.email = 'Valid email address is required.';
  if (!message || message.trim().length < 10) errors.message = 'Message must be at least 10 characters.';

  if (Object.keys(errors).length > 0) {
    return { success: false, message: 'Please correct the errors in the form.', errors };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.office365.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'flowenspeech@outlook.com',
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"Flowen Web Portal" <${process.env.SMTP_USER || 'flowenspeech@outlook.com'}>`,
      to: 'flowenspeech@outlook.com',
      replyTo: email,
      subject: `[Flowen Submission] ${tier || 'Inquiry'} from ${name}`,
      text: `
Name: ${name}
Email: ${email}
Role/Organization: ${role || 'Not specified'}
Selected Tier: ${tier || 'General Interest'}

Message:
${message}

--------------------------------------------------
Sent from Flowen Global Landing Page (${new Date().toISOString()})
      `,
    };

    await transporter.sendMail(mailOptions);

    return {
      success: true,
      message: 'Thank you. Your inquiry has been sent directly to our team at flowenspeech@outlook.com.',
    };
  } catch (error) {
    console.error('Mail Dispatch Error:', error);
    return {
      success: false,
      message: 'Unable to send your message right now. Please email us directly at flowenspeech@outlook.com.',
    };
  }
}
