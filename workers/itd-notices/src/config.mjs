// Every setting the worker reads, in one place, with what happens if it is
// missing. The README lists them for whoever sets the server up.

const list = (s) => String(s ?? '').split(/[,;\s]+/).filter((e) => /.+@.+\..+/.test(e));

export function loadConfig({ dry = false } = {}) {
  const env = process.env;
  const site = (env.SITE_URL || 'https://thefinanceintelligence.com').replace(/\/$/, '');
  const cfg = {
    // The portal itself; the tests point this at the stand-in.
    base: env.ITD_BASE || 'https://eportal.incometax.gov.in/iec/foservices/',

    // Accounts: a Google Sheet shared with the service account, or a CSV file.
    sheetId: env.ITD_SHEET_ID,
    sheetRange: env.ITD_SHEET_RANGE || 'A:Z',
    googleEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    googleKey: env.GOOGLE_PRIVATE_KEY,
    accountsFile: env.ITD_ACCOUNTS_FILE,

    // Where findings go: Supabase (service-role key), else a local JSON file.
    supabaseUrl: env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    stateFile: env.ITD_STATE_FILE || 'itd-state/state.json',

    // Email: Resend, or SMTP (e.g. smtps://you%40gmail.com:app-password@smtp.gmail.com:465), or a test folder.
    resendKey: dry ? null : env.RESEND_API_KEY,
    smtpUrl: dry ? null : env.SMTP_URL,
    outbox: env.ITD_MAIL_OUTBOX,
    from: env.NOTIFY_FROM_EMAIL || 'Tax notice watch <notices@thefinanceintelligence.com>',
    notifyTo: list(env.NOTIFY_TO),
    dashboardUrl: `${site}/analytics/notices`,

    // Pace: seconds between accounts, and a cap on notices opened per tab per account.
    pauseMs: Number(env.ITD_PAUSE_SECONDS ?? 20) * 1000,
    maxOpenPerTab: Number(env.ITD_MAX_OPEN ?? 25),
  };
  if (!cfg.accountsFile && !(cfg.sheetId && cfg.googleEmail && cfg.googleKey)) {
    throw new Error('Set ITD_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY (or ITD_ACCOUNTS_FILE for a local CSV)');
  }
  return cfg;
}
