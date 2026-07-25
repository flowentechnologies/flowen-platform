import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST || 'smtp.outlook.com',
  port: parseInt(process.env.EMAIL_SERVER_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_SERVER_USER || 'flowenspeech@outlook.com',
    pass: process.env.EMAIL_SERVER_PASSWORD || '',
  },
});

export async function sendWaitlistNotification(lead: { email: string; fullName: string; planTier: string; organization?: string }) {
  const mailOptions = {
    from: '"Flowen Platform" <flowenspeech@outlook.com>',
    to: 'flowenspeech@outlook.com',
    subject: `New Waitlist Lead: ${lead.fullName} (${lead.planTier})`,
    text: `New lead registered on Flowen platform:
    
Name: ${lead.fullName}
Email: ${lead.email}
Plan/Tier: ${lead.planTier}
Organization: ${lead.organization || 'N/A'}
Timestamp: ${new Date().toISOString()}`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('[Email Dispatch Error]:', err);
  }
}
