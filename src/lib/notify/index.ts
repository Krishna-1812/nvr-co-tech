import { logServerError } from '@/lib/errors/server';

/**
 * Transactional email, and the one thing the product had none of.
 *
 * The whole promise of Voucher Desk is passing work to the right person, and
 * until now nobody was ever told anything: not that a voucher was waiting on
 * them, not that theirs had come back, not even that they had been invited —
 * invites were a link the admin copied and relayed by hand. The approvals queue
 * had a full staleness apparatus (amber at three days, red at seven, a longest-
 * waiting alarm) which was an elaborate way of *displaying* neglect to whoever
 * eventually logged in. This is the part that stops it happening.
 *
 * Written against Resend's REST API with `fetch` rather than its SDK: one POST
 * to one URL does not justify a dependency, and this way there is nothing to
 * keep up to date.
 *
 * Every function here is best-effort and never throws. A voucher that was
 * approved has been approved whether or not the email about it went out, and a
 * workflow that failed because a mail provider was down would be worse than
 * one that is quiet.
 */

const ENDPOINT = 'https://api.resend.com/emails';

/** Absent in local development and in CI, where sending real mail is the wrong default. */
function config(): { key: string; from: string } | null {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL;
  if (!key || !from) return null;
  return { key, from };
}

/** Whether mail is configured at all — for surfacing "no email is sent" honestly in the UI. */
export const emailConfigured = (): boolean => config() !== null;

export type Mail = {
  to: string | string[];
  subject: string;
  /** Plain text. Deliberately the only body: see the note in templates.ts. */
  text: string;
};

export async function sendEmail(mail: Mail): Promise<{ sent: boolean; reason?: string }> {
  const cfg = config();
  if (!cfg) return { sent: false, reason: 'not_configured' };

  const to = (Array.isArray(mail.to) ? mail.to : [mail.to]).filter(Boolean);
  if (to.length === 0) return { sent: false, reason: 'no_recipients' };

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: cfg.from, to, subject: mail.subject, text: mail.text }),
      // A slow provider must not hold a server action open behind it.
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      await logServerError({
        route: '/lib/notify',
        message: `Resend refused a message (${res.status}): ${detail.slice(0, 300)}`,
      });
      return { sent: false, reason: `http_${res.status}` };
    }

    return { sent: true };
  } catch (error) {
    await logServerError({
      route: '/lib/notify',
      message: error instanceof Error ? error.message : 'Unknown error sending email',
    });
    return { sent: false, reason: 'network' };
  }
}

/**
 * Fire and forget, for call sites inside a workflow step.
 *
 * The caller does not await this: an approval should not wait on an SMTP round
 * trip, and there is nothing it could usefully do with the outcome. Failures
 * are already recorded by sendEmail.
 */
export function notify(mail: Mail): void {
  void sendEmail(mail);
}
