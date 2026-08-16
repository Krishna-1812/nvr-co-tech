/**
 * A push, alongside the row written to error_log.
 *
 * Before this, a caught server error only ever reached a database table that
 * nobody sees unless they think to open /analytics/errors — production could
 * be broken for days with the only record of it sitting unread. This does not
 * replace that table (still the place to see history and detail); it is the
 * difference between "somebody could look" and "somebody gets told".
 *
 * Without ERROR_ALERT_WEBHOOK_URL set, this does nothing at all — same stance
 * as every other optional integration in .env.example. Posts a Slack-shaped
 * body ({ text }), since a Slack incoming webhook is the fastest thing to
 * stand up with nothing to install; a Discord webhook or most other chat
 * tools' webhooks read a plain `text` field well enough to be useful too.
 */
export async function notifyErrorAlert(input: {
  route: string | null;
  message: string;
  userEmail?: string | null;
}): Promise<void> {
  const url = process.env.ERROR_ALERT_WEBHOOK_URL;
  if (!url) return;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: [
          `:rotating_light: *${input.route ?? 'unknown route'}*`,
          input.message,
          input.userEmail ? `_for ${input.userEmail}_` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      }),
      // A hung webhook endpoint must never be why an error handler itself hangs.
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Same rule as everything else in lib/errors: monitoring must never
    // become a second failure on top of the one it is reporting.
  }
}
