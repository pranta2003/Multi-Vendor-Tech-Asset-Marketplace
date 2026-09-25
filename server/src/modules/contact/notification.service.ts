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

export interface NotificationResult {
  status: 'EMAIL_SENT' | 'EMAIL_FAILED' | 'SKIPPED_NO_API_KEY';
  id?: string;
  error?: string;
}

/**
 * Builds the responsive HTML email template for owner support notifications.
 */
export function buildNotificationEmailHtml(
  payload: TicketNotificationPayload,
  adminUrl: string,
): string {
  const formattedDate = new Date(payload.createdAt).toUTCString();
  const phoneDisplay = payload.phone?.trim() ? payload.phone.trim() : 'Not provided';
  const orderDisplay = payload.orderId?.trim() ? payload.orderId.trim() : 'Not provided';

  // Sanitize message for safe HTML display while preserving newlines
  const safeMessage = payload.message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br />');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Customer Support Request</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 620px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 28px 32px; border-bottom: 3px solid #6366f1;">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">AssetHub</span>
                    <span style="font-size: 14px; font-weight: 500; color: #94a3b8; margin-left: 8px;">Support Notification</span>
                  </td>
                  <td align="right">
                    <span style="background-color: #312e81; color: #c7d2fe; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 6px; font-family: monospace;">
                      ${payload.ticketNumber}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Notice banner -->
          <tr>
            <td style="padding: 24px 32px 12px 32px;">
              <h1 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #0f172a;">
                New Customer Support Request
              </h1>
              <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.5;">
                A customer has submitted a support inquiry on the AssetHub platform.
              </p>
            </td>
          </tr>

          <!-- Ticket Details Table -->
          <tr>
            <td style="padding: 12px 32px 20px 32px;">
              <table role="presentation" width="100%" style="border-collapse: collapse; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
                <tr>
                  <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; width: 35%;">Ticket Number</td>
                  <td style="padding: 10px 16px; font-size: 13px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${payload.ticketNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0;">Customer Name</td>
                  <td style="padding: 10px 16px; font-size: 14px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${payload.name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0;">Customer Email</td>
                  <td style="padding: 10px 16px; font-size: 14px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">
                    <a href="mailto:${payload.email}" style="color: #4f46e5; text-decoration: none; font-weight: 500;">${payload.email}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0;">Phone</td>
                  <td style="padding: 10px 16px; font-size: 14px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${phoneDisplay}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0;">Inquiry Type</td>
                  <td style="padding: 10px 16px; font-size: 13px; font-weight: 600; color: #4338ca; border-bottom: 1px solid #e2e8f0;">${payload.inquiryType}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0;">Order ID</td>
                  <td style="padding: 10px 16px; font-size: 13px; color: #1e293b; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${orderDisplay}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0;">Subject</td>
                  <td style="padding: 10px 16px; font-size: 14px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${payload.subject}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b;">Submitted At</td>
                  <td style="padding: 10px 16px; font-size: 13px; color: #64748b;">${formattedDate}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Customer Message Callout -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">
                Customer Message:
              </div>
              <div style="background-color: #f1f5f9; border-left: 4px solid #6366f1; border-radius: 4px; padding: 16px; font-size: 14px; line-height: 1.6; color: #1e293b;">
                ${safeMessage}
              </div>
            </td>
          </tr>

          <!-- Direct Reply Alert Box -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <table role="presentation" width="100%" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px;">
                <tr>
                  <td>
                    <span style="font-size: 13px; color: #1e40af; line-height: 1.5;">
                      <strong>Direct Reply:</strong> Replying directly to this email in your email client will send your response to <strong>${payload.email}</strong>.
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Action Button -->
          <tr>
            <td align="center" style="padding: 0 32px 32px 32px;">
              <a href="${adminUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.3);">
                View Ticket in AssetHub Admin &rarr;
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; 2025 Pranta Kumer Pandit. All rights reserved. | AssetHub Marketplace
              </p>
              <p style="margin: 6px 0 0 0; font-size: 11px; color: #cbd5e1;">
                This is an automated notification from the AssetHub Contact Us support pipeline.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Builds clean plain-text fallback format for email clients that do not render HTML.
 */
export function buildNotificationEmailText(
  payload: TicketNotificationPayload,
  adminUrl: string,
): string {
  const formattedDate = new Date(payload.createdAt).toUTCString();

  return [
    `AssetHub — New Customer Support Request`,
    `==================================================`,
    ``,
    `Ticket Number:`,
    payload.ticketNumber,
    ``,
    `Customer Name:`,
    payload.name,
    ``,
    `Customer Email:`,
    payload.email,
    ``,
    `Phone:`,
    payload.phone?.trim() ? payload.phone.trim() : 'Not provided',
    ``,
    `Inquiry Type:`,
    payload.inquiryType,
    ``,
    `Order ID:`,
    payload.orderId?.trim() ? payload.orderId.trim() : 'Not provided',
    ``,
    `Subject:`,
    payload.subject,
    ``,
    `Message:`,
    payload.message,
    ``,
    `Submitted:`,
    formattedDate,
    ``,
    `View Ticket in AssetHub Admin:`,
    adminUrl,
    ``,
    `--------------------------------------------------`,
    `Replying to this notification sends your response directly to ${payload.email}.`,
    `--------------------------------------------------`,
  ].join('\n');
}

/**
 * Dispatches an email notification to the site owner / support mailbox (prantakumerpandit@gmail.com)
 * when a customer submits a support ticket.
 *
 * Uses Resend transactional email API when RESEND_API_KEY is configured.
 * Never throws an unhandled error so ticket persistence is never rolled back.
 */
export async function sendTicketNotifications(
  payload: TicketNotificationPayload,
): Promise<NotificationResult> {
  const { ticketNumber, email } = payload;

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const destinationEmail =
    process.env.SUPPORT_EMAIL?.trim() ||
    process.env.SUPPORT_OWNER_EMAIL?.trim() ||
    'prantakumerpandit@gmail.com';

  const emailFrom =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.SUPPORT_EMAIL_FROM?.trim() ||
    'AssetHub Support <onboarding@resend.dev>';

  const clientOrigin =
    process.env.CLIENT_ORIGIN?.trim() ||
    'https://multi-vendor-tech-asset-marketplace-ashen.vercel.app';

  const adminUrl = `${clientOrigin.replace(/\/+$/, '')}/account?tab=admin-support`;

  if (!resendApiKey) {
    logger.info(
      {
        event: 'SKIPPED_NO_API_KEY',
        ticketNumber,
        inquiryType: payload.inquiryType,
        destination: destinationEmail,
        customerEmail: email,
      },
      'No RESEND_API_KEY configured; support notification logged and stored in DB without email dispatch',
    );
    return { status: 'SKIPPED_NO_API_KEY' };
  }

  const subject = `AssetHub — New Customer Support Request [${ticketNumber}]`;
  const html = buildNotificationEmailHtml(payload, adminUrl);
  const text = buildNotificationEmailText(payload, adminUrl);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: emailFrom,
        to: destinationEmail,
        reply_to: email,
        headers: {
          'Reply-To': email,
        },
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errorMessage =
        (errBody as any)?.message ||
        (errBody as any)?.name ||
        `Resend responded with HTTP ${res.status}`;

      logger.error(
        {
          event: 'EMAIL_FAILED',
          ticketNumber,
          httpStatus: res.status,
          error: errorMessage,
          destination: destinationEmail,
        },
        'Resend API rejected support notification email',
      );

      return { status: 'EMAIL_FAILED', error: errorMessage };
    }

    const data = await res.json().catch(() => ({}));
    const emailId = (data as any)?.id;

    logger.info(
      {
        event: 'EMAIL_SENT',
        ticketNumber,
        emailId,
        destination: destinationEmail,
        replyTo: email,
      },
      'Support notification email sent to owner successfully via Resend',
    );

    return { status: 'EMAIL_SENT', id: emailId };
  } catch (err: any) {
    const msg = err?.message || String(err);
    logger.error(
      {
        event: 'EMAIL_FAILED',
        ticketNumber,
        error: msg,
        destination: destinationEmail,
      },
      'Network or transport error dispatching support notification email via Resend',
    );

    return { status: 'EMAIL_FAILED', error: msg };
  }
}
