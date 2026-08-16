import { Resend } from 'resend';
import { config } from '../config/index.js';

const resend = new Resend(config.email.resendApiKey);

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email via Resend.
 */
export async function sendEmail({ to, subject, html }: EmailOptions): Promise<void> {
  if (!config.email.resendApiKey) {
    console.warn('Resend API key not configured; skipping email.');
    return;
  }

  const { error } = await resend.emails.send({
    from: config.email.from,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }
}
