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

function wrap(title, body, link) {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f4ef;font-family:Arial,Helvetica,sans-serif;color:#1f2328">
<div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e3e1d8;border-radius:12px;padding:24px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b6f76">Tax notice watch</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${esc(title)}</h1>
${body}
${link ? `<p style="margin:24px 0 0"><a href="${esc(link)}" style="display:inline-block;background:#1f2328;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px">Open the dashboard</a></p>` : ''}
<p style="margin:24px 0 0;font-size:12px;color:#6b6f76">Read from the Income Tax e-Filing portal, Pending Actions → e-Proceedings. Always confirm on the portal before acting.</p>
</div></body></html>`;
}

/** One client's new notices, with the files attached when they came down. */
export function alertEmail(account, alerts, docs, { dashboardUrl }) {
  const title = `New income tax notice${alerts.length > 1 ? 's' : ''} for ${account.name || 'a client'}`;
  const items = alerts.map((a) => {
    const due = a.dueOn ? ` <strong style="color:#b42318">Response due ${esc(human(a.dueOn))}${daysTo(a.dueOn) >= 0 ? ` (in ${daysTo(a.dueOn)} day${daysTo(a.dueOn) === 1 ? '' : 's'})` : ' (date has passed)'}</strong>` : '';
    return `<li style="margin:0 0 8px">${esc(a.detail)}.${due}</li>`;
  }).join('');
  let size = 0;
  const attachments = [];
  const left = [];
  for (const d of docs) {
    if (size + d.bytes.length <= MAX_ATTACH) { attachments.push({ filename: d.fileName, content: d.bytes }); size += d.bytes.length; }
    else left.push(d.fileName);
  }
  const files = attachments.length
    ? `<p style="margin:12px 0 0;font-size:14px">${attachments.length} notice file${attachments.length === 1 ? ' is' : 's are'} attached.${left.length ? ` ${left.length} more ${left.length === 1 ? 'is' : 'are'} on the dashboard (too large to attach).` : ''}</p>`
    : `<p style="margin:12px 0 0;font-size:14px">The notice files could not be downloaded automatically; open them on the portal or the dashboard.</p>`;
  const html = wrap(title, `<p style="margin:0 0 12px;font-size:15px">${esc(who(account))}</p><ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.5">${items}</ul>${files}`, dashboardUrl);
  const text = `${title}\n${who(account)}\n\n${alerts.map((a) => `- ${a.detail}${a.dueOn ? ` (response due ${human(a.dueOn)})` : ''}`).join('\n')}\n\n${dashboardUrl ?? ''}`;
  return { subject: `${title}: PAN ${maskPan(account.userId)}`, html, text, attachments };
}

const STATUS_WORDS = {
  'bad-password': 'password rejected: update it in the sheet',
  'bad-user': 'user ID not accepted: check the PAN in the sheet',
  otp: 'asks for an OTP, so it cannot be checked unattended',
  captcha: 'the portal asked for a CAPTCHA',
  locked: 'the portal says the account is locked',
  'portal-down': 'the portal did not load',
  layout: 'the portal page looked different from usual',
  timeout: 'the check took too long',
  error: 'something unexpected went wrong',
};

/** The morning summary for the team: only sent when there is something in it. */
export function summaryEmail({ date, checked, failures, alertsByAccount, due, baselined, skipped }, { dashboardUrl }) {
  const parts = [];
  const nNew = alertsByAccount.reduce((n, x) => n + x.alerts.length, 0);
  if (nNew) {
    parts.push(`<h2 style="font-size:16px;margin:16px 0 8px">New since yesterday</h2><ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.5">${alertsByAccount.map(({ account, alerts }) => alerts.map((a) => `<li>${esc(who(account))}: ${esc(a.detail)}</li>`).join('')).join('')}</ul>`);
  }
  if (due.length) {
    parts.push(`<h2 style="font-size:16px;margin:16px 0 8px">Responses due in the next 7 days, or recently missed (not marked handled)</h2><ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.5">${due.map((d) => `<li>${esc(d.clientName || maskPan(d.pan))}: ${esc(d.name)}${d.ay ? `, AY ${esc(d.ay)}` : ''}: <strong>${esc(human(d.due_on))}</strong>${daysTo(d.due_on) < 0 ? ` (passed ${-daysTo(d.due_on)} day${daysTo(d.due_on) === -1 ? '' : 's'} ago)` : daysTo(d.due_on) === 0 ? ' (today)' : ` (in ${daysTo(d.due_on)} day${daysTo(d.due_on) === 1 ? '' : 's'})`}</li>`).join('')}</ul>`);
  }
  if (failures.length) {
    parts.push(`<h2 style="font-size:16px;margin:16px 0 8px">Not checked today</h2><ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.5">${failures.map((f) => `<li>${esc(who(f.account))}: ${esc(STATUS_WORDS[f.status] ?? f.message)}</li>`).join('')}</ul>`);
  }
  if (baselined.length) {
    parts.push(`<p style="font-size:14px;margin:16px 0 0">Now watching ${baselined.length} new account${baselined.length === 1 ? '' : 's'}: ${esc(baselined.map((b) => `${b.account.name || maskPan(b.account.userId)} (${b.count} proceeding${b.count === 1 ? '' : 's'})`).join(', '))}. What is already there is recorded; only what appears from tomorrow is reported as new.</p>`);
  }
  if (skipped.length) {
    parts.push(`<p style="font-size:14px;margin:16px 0 0">Rows skipped in the sheet: ${esc(skipped.join('; '))}.</p>`);
  }
  if (!parts.length) return null;
  const bits = [nNew && `${nNew} new`, due.length && `${due.length} due soon`, failures.length && `${failures.length} not checked`].filter(Boolean);
  const title = `Tax notice check, ${date}: ${bits.length ? bits.join(', ') : 'all quiet'}`;
  const html = wrap(title, `<p style="margin:0;font-size:14px">${checked} account${checked === 1 ? '' : 's'} checked.</p>${parts.join('')}`, dashboardUrl);
  const text = `${title}\n${checked} accounts checked.\n${alertsByAccount.flatMap(({ account, alerts }) => alerts.map((a) => `NEW ${who(account)}: ${a.detail}`)).join('\n')}\n${due.map((d) => `DUE ${d.clientName || maskPan(d.pan)}: ${d.name} ${human(d.due_on)}`).join('\n')}\n${failures.map((f) => `NOT CHECKED ${who(f.account)}: ${STATUS_WORDS[f.status] ?? f.message}`).join('\n')}`;
  return { subject: title, html, text };
}
