import { queryOne } from '../db/pool.js';
import { ensureUserExists } from '../utils/ensureUser.js';
import { sendEmail } from './emailService.js';
import { config } from '../config/index.js';

type NotificationType =
  | 'new_match'
  | 'verification_question'
  | 'verification_result'
  | 'match_approved'
  | 'match_rejected'
  | 'item_returned'
  | 'admin_message';

type ItemType = 'lost' | 'found';

/**
 * Create an in-app notification and optionally send an email.
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  itemId?: string,
  itemType?: ItemType,
  matchId?: string
): Promise<void> {
  // 1. Ensure the recipient has a users row (local-dev fallback / backfill).
  await ensureUserExists(userId);

  // 2. Insert in-app notification
  const notification = await queryOne<{ id: string }>(
    `INSERT INTO notifications (user_id, type, title, message, match_id, item_id, item_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [userId, type, title, message, matchId || null, itemId || null, itemType || null]
  );

  // 2. Fetch user email for email notification
  const user = await queryOne<{ email: string; full_name: string }>(
    `SELECT email, full_name FROM users WHERE id = $1`,
    [userId]
  );

  if (user?.email) {
    try {
      await sendEmail({
        to: user.email,
        subject: title,
        html: buildEmailTemplate(user.full_name, message, type, matchId),
      });

      // Mark email as sent
      if (notification?.id) {
        await queryOne(
          `UPDATE notifications SET email_sent = true WHERE id = $1`,
          [notification.id]
        );
      }
    } catch (err) {
      console.error(`Failed to send email notification to ${user.email}:`, err);
      // Non-fatal: in-app notification still exists
    }
  }
}

/**
 * Build a simple HTML email template.
 */
function buildEmailTemplate(
  userName: string,
  message: string,
  type: NotificationType,
  matchId?: string
): string {
  const accentColour = type === 'new_match' ? '#22c55e' : '#3b82f6';
  const actionUrl = matchId
    ? `${config.frontendUrl}/matches/${matchId}`
    : `${config.frontendUrl}/notifications`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${accentColour}; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">Lost & Found AI Matcher</h1>
  </div>
  <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb;">
    <p>Hi ${userName},</p>
    <p>${message}</p>
    <p style="margin-top: 24px;">
      <a href="${actionUrl}" style="display: inline-block; background: ${accentColour}; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none;">
        View in App
      </a>
    </p>
  </div>
  <div style="padding: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
    <p>This is an automated notification from Lost & Found AI Matcher.</p>
  </div>
</body>
</html>`.trim();
}
