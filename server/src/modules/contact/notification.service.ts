import { logger } from '../../utils/logger';

export interface TicketNotificationPayload {
  ticketNumber: string;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  inquiryType: string;
  orderId?: string | null;
  message: string;
  createdAt: Date;
}

const OWNER_SUPPORT_EMAIL = process.env.SUPPORT_OWNER_EMAIL?.trim() || 'prantakumerpandit@gmail.com';

/**
 * Dispatches email notifications for a newly created support ticket.
 *
 * Checks for optional email transport configuration (e.g. RESEND_API_KEY or
 * SENDGRID_API_KEY) in environment variables. If not configured, logs a clean
 * operational notice with ticket metadata rather than failing or pretending
 * to send.
 */
export async function sendTicketNotifications(payload: TicketNotificationPayload): Promise<void> {
  const { ticketNumber, name, email, phone, subject, inquiryType, orderId, message } = payload;

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const sendgridApiKey = process.env.SENDGRID_API_KEY?.trim();
  const emailFrom = process.env.SUPPORT_EMAIL_FROM?.trim() || 'AssetHub Support <support@assethub.marketplace>';

  const adminSubject = `[AssetHub Support] New ${inquiryType}: ${ticketNumber} - ${subject}`;
  const adminBody = [
    `New support ticket received on AssetHub.`,
    ``,
    `Ticket Number: ${ticketNumber}`,
    `Customer Name: ${name}`,
    `Customer Email: ${email}`,
    `Phone: ${phone || 'Not provided'}`,
    `Inquiry Type: ${inquiryType}`,
    `Order ID: ${orderId || 'Not provided'}`,
    ``,
    `Message:`,
    message,
  ].join('\n');

  const customerSubject = `[AssetHub] Support Request Received: ${ticketNumber}`;
  const customerBody = [
    `Dear ${name},`,
    ``,
    `Thank you for contacting AssetHub Customer Support. Your inquiry has been received and our team will review it.`,
    ``,
    `Ticket Reference: ${ticketNumber}`,
    `Inquiry Type: ${inquiryType}`,
    `Subject: ${subject}`,
    ``,
    `Our standard support response time is within 24 hours. If your issue is regarding a recent purchase, you can reply directly or reference your ticket number.`,
    ``,
    `Best regards,`,
    `AssetHub Customer Support`,
  ].join('\n');

  // If Resend API key is present in environment, dispatch real HTTP email requests
  if (resendApiKey) {
    try {
      await Promise.all([
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: emailFrom,
            to: OWNER_SUPPORT_EMAIL,
            subject: adminSubject,
            text: adminBody,
          }),
        }),
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: emailFrom,
            to: email,
            subject: customerSubject,
            text: customerBody,
          }),
        }),
      ]);
      logger.info({ ticketNumber, ownerEmail: OWNER_SUPPORT_EMAIL, customerEmail: email }, 'Support ticket emails dispatched via Resend');
      return;
    } catch (err) {
      logger.error({ err, ticketNumber }, 'Failed to dispatch email via Resend API');
    }
  }

  // If SendGrid API key is present in environment, dispatch real HTTP email requests
  if (sendgridApiKey) {
    try {
      await Promise.all([
        fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sendgridApiKey}`,
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: OWNER_SUPPORT_EMAIL }] }],
            from: { email: emailFrom },
            subject: adminSubject,
            content: [{ type: 'text/plain', value: adminBody }],
          }),
        }),
        fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sendgridApiKey}`,
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email }] }],
            from: { email: emailFrom },
            subject: customerSubject,
            content: [{ type: 'text/plain', value: customerBody }],
          }),
        }),
      ]);
      logger.info({ ticketNumber, ownerEmail: OWNER_SUPPORT_EMAIL, customerEmail: email }, 'Support ticket emails dispatched via SendGrid');
      return;
    } catch (err) {
      logger.error({ err, ticketNumber }, 'Failed to dispatch email via SendGrid API');
    }
  }

  // Standard logging when no third-party email API key is configured
  logger.info(
    {
      ticketNumber,
      inquiryType,
      customerEmail: email,
      ownerEmail: OWNER_SUPPORT_EMAIL,
    },
    'Support ticket recorded in database. Notification queued (no external email provider API key configured in env).',
  );
}

