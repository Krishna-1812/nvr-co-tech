// The list of accounts to check: a Google Sheet the owner keeps.
//
// One row per account, columns found by their heading so the sheet can be
// arranged however the team likes:
//   PAN / User ID   (required)   the portal login
//   Password        (required)
//   Name / Client   (optional)   shown in emails and on the dashboard
//   Notify / Email  (optional)   extra addresses for this client's alerts, comma separated
//   Active          (optional)   "No" skips the row; blank means yes
//
// The sheet is shared with a Google service account (read-only), and read with
// a token signed here rather than through Google's client library, which would
// be the largest thing in this folder by a distance. For local runs and tests,
// ITD_ACCOUNTS_FILE points at a CSV with the same headings instead.

import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const b64url = (s) => Buffer.from(s).toString('base64url');

async function googleToken(email, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const sign = createSign('RSA-SHA256');
  sign.update(`${head}.${claims}`);
  const jwt = `${head}.${claims}.${sign.sign(privateKey.replace(/\\n/g, '\n'), 'base64url')}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`Google sign-in failed: ${body.error_description || body.error || res.status}`);
  return body.access_token;
}

async function readGoogleSheet({ sheetId, range, email, privateKey }) {
  const token = await googleToken(email, privateKey);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Could not read the sheet: ${body.error?.message || res.status}. Is it shared with ${email}?`);
  return body.values ?? [];
}

/** A small CSV reader: quoted fields, commas and newlines inside quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const COLUMNS = {
  userId: /^(pan(\s*(no\.?|number))?|user\s*id|login(\s*id)?|pan\s*\/\s*user\s*id|user)$/i,
  password: /pass(word)?/i,
  name: /^(name|client|client\s*name|assessee|assessee\s*name)$/i,
  notify: /(notify|e-?mails?|alerts?\s*to)/i,
  active: /^(active|enabled|watch|check)$/i,
};

/** Rows (first one the headings) → accounts. Rows without a login or password are reported, not dropped silently. */
export function rowsToAccounts(rows) {
  const [head = [], ...body] = rows;
  const col = {};
  head.forEach((h, i) => {
    for (const [k, re] of Object.entries(COLUMNS)) if (col[k] === undefined && re.test(String(h).trim())) col[k] = i;
  });
  if (col.userId === undefined || col.password === undefined) {
    throw new Error('The sheet needs a "PAN" (or "User ID") column and a "Password" column in its first row');
  }
  const accounts = [];
  const skipped = [];
  body.forEach((r, i) => {
    const get = (k) => (col[k] === undefined ? '' : String(r[col[k]] ?? '').trim());
    const userId = get('userId').toUpperCase();
    if (!userId && !get('password')) return;
    if (/^(no|n|false|0|off|stop)$/i.test(get('active'))) return;
    if (!userId || !get('password')) { skipped.push(`row ${i + 2}: missing ${userId ? 'password' : 'PAN / user ID'}`); return; }
    accounts.push({
      userId,
      password: get('password'),
      name: get('name') || null,
      notify: get('notify').split(/[,;\s]+/).filter((e) => /.+@.+\..+/.test(e)),
    });
  });
  // The same login twice would log itself out mid-check.
  const seen = new Set();
  return {
    accounts: accounts.filter((a) => (seen.has(a.userId) ? (skipped.push(`${a.userId.slice(-4)}: listed twice, checked once`), false) : seen.add(a.userId))),
    skipped,
  };
}

export async function loadAccounts(cfg) {
  const rows = cfg.accountsFile
    ? parseCsv(await readFile(cfg.accountsFile, 'utf8'))
    : await readGoogleSheet({ sheetId: cfg.sheetId, range: cfg.sheetRange, email: cfg.googleEmail, privateKey: cfg.googleKey });
  return rowsToAccounts(rows);
}
