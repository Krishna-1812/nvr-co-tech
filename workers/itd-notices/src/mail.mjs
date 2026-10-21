// Sending the emails, and writing them.
//
// Three ways out, chosen by what is configured: Resend (RESEND_API_KEY, the
// service the site's other emails were planned on), any SMTP server such as a
// Gmail account with an app password (SMTP_URL), or a folder (ITD_MAIL_OUTBOX)
// that the end-to-end test reads. With none of them the run still happens and
// the dashboard still fills; the summary says no email went.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { maskPan } from './parse.mjs';

const MAX_ATTACH = 15 * 1024 * 1024;

export function mailer(cfg) {
  if (cfg.outbox) {
    let n = 0;
    return {
      kind: 'outbox',
      async send(m) {
        await mkdir(cfg.outbox, { recursive: true });
        await writeFile(join(cfg.outbox, `${String(++n).padStart(2, '0')}.json`), JSON.stringify({ ...m, attachments: (m.attachments ?? []).map((a) => ({ filename: a.filename, bytes: a.content.length })) }, null, 2));
      },
    };
  }
  if (cfg.resendKey) {
    return {
      kind: 'resend',
      async send(m) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${cfg.resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: cfg.from,
            to: m.to,
            subject: m.subject,
            html: m.html,
            text: m.text,
            attachments: (m.attachments ?? []).map((a) => ({ filename: a.filename, content: a.content.toString('base64') })),
          }),
        });
        if (!res.ok) throw new Error(`Resend refused the email: ${res.status} ${(await res.text()).slice(0, 200)}`);
      },
    };
  }
  if (cfg.smtpUrl) {
    let transport;
    return {
      kind: 'smtp',
      async send(m) {
        if (!transport) transport = (await import('nodemailer')).default.createTransport(cfg.smtpUrl);
        await transport.sendMail({ from: cfg.from, to: m.to.join(', '), subject: m.subject, html: m.html, text: m.text, attachments: m.attachments });
      },
    };
  }
  return { kind: 'none', async send() {} };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const human = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00+05:30`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
};
const daysTo = (iso) => Math.round((Date.parse(`${iso}T00:00:00+05:30`) - Date.parse(`${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}T00:00:00+05:30`)) / 86_400_000);
const who = (a) => `${a.name || 'Client'} (PAN ${maskPan(a.userId)})`;

// The site's palette, written out because email clients ignore stylesheets:
// bone page, a lighter card, sand for wells, terracotta for the one action.
const C = {
  page: '#F6EFE4', card: '#FBF6EE', well: '#F1E6D6', line: '#E2D3BF',
  ink: '#2B211B', muted: '#4A3D33', subtle: '#67574A', brand: '#B5593A',
  red: '#A3352A', redBg: '#F6E0D8', amber: '#93471A', green: '#4E6A2C',
};
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** A response date as a pill: red when two days or less (or missed), amber within a week. */
function duePill(iso) {
  const n = daysTo(iso);
  const words = n < 0 ? `was due ${human(iso)}` : n === 0 ? `due today, ${human(iso)}` : n === 1 ? `due tomorrow, ${human(iso)}` : `due ${human(iso)}, in ${n} days`;
  const [fg, bg] = n <= 2 ? [C.red, C.redBg] : n <= 7 ? [C.amber, C.card] : [C.muted, C.card];
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${bg};border:1px solid ${fg};color:${fg};font-size:12px;font-weight:700;white-space:nowrap">Response ${esc(words)}</span>`;
}

function wrap(title, body, link, preheader = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;font-family:${SANS};color:${C.ink}">
<tr><td style="padding:0 6px 14px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${C.subtle}"><span style="color:${C.brand};font-weight:700">&#9679;</span>&nbsp; The Finance Intelligence &middot; Tax Notice Watch</td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:18px;padding:28px 26px">
<h1 style="margin:0 0 6px;font-family:${SERIF};font-size:26px;line-height:1.2;font-weight:700;color:${C.ink}">${esc(title)}</h1>
${body}
${link ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 0"><tr><td style="background:${C.brand};border-radius:999px"><a href="${esc(link)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none">Open Tax Notice Watch &rarr;</a></td></tr></table>` : ''}
</td></tr>
<tr><td style="padding:16px 8px 0;font-size:12px;line-height:1.5;color:${C.subtle}">Read from the Income Tax e-Filing portal, Pending Actions &rarr; e-Proceedings, by the morning check. Always confirm on the portal before acting.</td></tr>
</table></td></tr></table></body></html>`;
}

const KIND_WORDS = { 'new-proceeding': 'New proceeding', 'more-notices': 'More notices', 'new-date': 'New entry' };

/** One client's new notices, with the files attached when they came down. */
export function alertEmail(account, alerts, docs, { dashboardUrl }) {
  const title = `New income tax notice${alerts.length > 1 ? 's' : ''} for ${account.name || 'a client'}`;
  const items = alerts.map((a) => {
    const detail = String(a.detail).replace(/^New proceeding:\s*/i, '');
    return `<tr><td style="padding:0 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.well};border-radius:12px;border-left:4px solid ${C.brand}"><tr><td style="padding:14px 16px">
<p style="margin:0 0 4px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:${C.brand}">${esc(KIND_WORDS[a.kind] ?? 'New')}</p>
<p style="margin:0;font-size:15px;line-height:1.45;color:${C.ink}">${esc(detail)}</p>
${a.dueOn ? `<p style="margin:10px 0 0">${duePill(a.dueOn)}</p>` : ''}
</td></tr></table></td></tr>`;
  }).join('');
  let size = 0;
  const attachments = [];
  const left = [];
  for (const d of docs) {
    if (size + d.bytes.length <= MAX_ATTACH) { attachments.push({ filename: d.fileName, content: d.bytes }); size += d.bytes.length; }
    else left.push(d.fileName);
  }
  const files = attachments.length
    ? `${attachments.length} notice file${attachments.length === 1 ? ' is' : 's are'} attached: ${esc(attachments.map((x) => x.filename).join(', '))}.${left.length ? ` ${left.length} more ${left.length === 1 ? 'is' : 'are'} on the dashboard (too large to attach).` : ''}`
    : 'The notice files could not be downloaded automatically; open them on the portal or the dashboard.';
  const body = `<p style="margin:0 0 20px;font-size:14px;color:${C.subtle}">PAN ${esc(maskPan(account.userId))} &middot; found by this morning&rsquo;s check</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
<p style="margin:8px 0 0;font-size:13.5px;line-height:1.5;color:${C.muted}">${files}</p>`;
  const html = wrap(title, body, dashboardUrl, alerts.map((a) => a.detail).join(' · '));
  const text = `${title}\n${who(account)}\n\n${alerts.map((a) => `- ${a.detail}${a.dueOn ? ` (response due ${human(a.dueOn)})` : ''}`).join('\n')}\n\n${dashboardUrl ?? ''}`;
  return { subject: `${title}: PAN ${maskPan(account.userId)}`, html, text, attachments };
}

const STATUS_WORDS = {
  'bad-password': 'password rejected: update it in the sheet (not retried for a week)',
  refused: 'the portal refused the automated login; it is tried again tomorrow',
  'bad-user': 'user ID not accepted: check the PAN in the sheet',
  otp: 'asks for an OTP, so it cannot be checked unattended',
  captcha: 'the portal asked for a CAPTCHA',
  locked: 'the portal says the account is locked',
  'portal-down': 'the portal did not load',
  layout: 'the portal page looked different from usual',
  timeout: 'the check took too long',
  error: 'something unexpected went wrong',
};

const section = (heading, tone, rows) => `<h2 style="margin:26px 0 10px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${tone}">${heading}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line}">${rows.map((r) => `<tr><td style="padding:11px 0;border-bottom:1px solid ${C.line};font-size:14px;line-height:1.45;color:${C.ink}">${r}</td></tr>`).join('')}</table>`;

const stat = (value, label, tone) => `<td width="33%" valign="top" style="padding:0 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.well};border-radius:12px"><tr><td style="padding:12px 14px">
<p style="margin:0;font-family:${SERIF};font-size:28px;line-height:1;font-weight:700;color:${value ? tone : C.subtle}">${value}</p>
<p style="margin:6px 0 0;font-size:11.5px;white-space:nowrap;color:${C.subtle}">${label}</p></td></tr></table></td>`;

const cap = (t) => String(t ?? '').charAt(0).toUpperCase() + String(t ?? '').slice(1);
const client = (name, pan) => `<strong>${esc(name)}</strong> <span style="color:${C.subtle};font-size:12.5px">PAN ${esc(maskPan(pan))}</span>`;

/** The morning summary for the team: only sent when there is something in it. */
export function summaryEmail({ date, checked, failures, alertsByAccount, due, baselined, skipped }, { dashboardUrl }) {
  const parts = [];
  const nNew = alertsByAccount.reduce((n, x) => n + x.alerts.length, 0);
  if (nNew) {
    parts.push(section('New since yesterday', C.brand, alertsByAccount.flatMap(({ account, alerts }) => alerts.map((a) => `${client(account.name || 'Client', account.userId)}<br><span style="color:${C.muted}">${esc(a.detail)}</span>`))));
  }
  if (due.length) {
    parts.push(section('Responses due within 7 days, or recently missed', C.amber, due.map((d) => `${client(d.clientName || 'Client', d.pan)}<br><span style="color:${C.muted}">${esc(d.name)}${d.ay ? `, AY ${esc(d.ay)}` : ''}</span><br><span style="display:inline-block;margin-top:6px">${duePill(d.due_on)}</span>`)));
  }
  if (failures.length) {
    parts.push(section('Not checked today', C.red, failures.map((f) => `${client(f.account.name || 'Client', f.account.userId)}<br><span style="color:${C.muted}">${esc(cap(STATUS_WORDS[f.status] ?? f.message))}</span>`)));
  }
  if (baselined.length) {
    parts.push(`<p style="margin:22px 0 0;padding:12px 14px;background:${C.well};border-radius:12px;font-size:13.5px;line-height:1.5;color:${C.muted}">Now watching ${baselined.length} new account${baselined.length === 1 ? '' : 's'}: ${esc(baselined.map((b) => `${b.account.name || maskPan(b.account.userId)} (${b.count} proceeding${b.count === 1 ? '' : 's'})`).join(', '))}. What is already there is recorded; only what appears from tomorrow is reported as new.</p>`);
  }
  if (skipped.length) {
    parts.push(`<p style="margin:14px 0 0;font-size:13px;color:${C.subtle}">Rows skipped in the sheet: ${esc(skipped.join('; '))}.</p>`);
  }
  if (!parts.length) return null;
  const bits = [nNew && `${nNew} new`, due.length && `${due.length} due soon`, failures.length && `${failures.length} not checked`].filter(Boolean);
  const title = `Tax notice check, ${date}: ${bits.length ? bits.join(', ') : 'all quiet'}`;
  const body = `<p style="margin:0 0 20px;font-size:14px;color:${C.subtle}">${checked} account${checked === 1 ? '' : 's'} checked this morning.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -4px"><tr>${stat(nNew, 'New', C.brand)}${stat(due.length, 'Due soon', C.amber)}${stat(failures.length, 'Not checked', C.red)}</tr></table>
${parts.join('')}`;
  const html = wrap(`Morning check, ${date}`, body, dashboardUrl, bits.join(', '));
  const text = `${title}\n${checked} accounts checked.\n${alertsByAccount.flatMap(({ account, alerts }) => alerts.map((a) => `NEW ${who(account)}: ${a.detail}`)).join('\n')}\n${due.map((d) => `DUE ${d.clientName || maskPan(d.pan)}: ${d.name} ${human(d.due_on)}`).join('\n')}\n${failures.map((f) => `NOT CHECKED ${who(f.account)}: ${STATUS_WORDS[f.status] ?? f.message}`).join('\n')}`;
  return { subject: title, html, text };
}
