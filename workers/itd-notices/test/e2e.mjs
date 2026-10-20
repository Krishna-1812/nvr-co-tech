// Three mornings against the stand-in portal, start to finish:
//
//   1. First run: two accounts read and recorded (nothing called new), their
//      notices downloaded; one account needs an OTP, one has a wrong
//      password, and both are reported. One account is "logged in
//      elsewhere" and is taken over.
//   2. Overnight a notice is added to a known proceeding and a new
//      proceeding appears: both are raised, emailed with the files attached,
//      and the due date is picked up.
//   3. Nothing changes: nothing new is raised.
//
//   ITD_CHROMIUM_PATH=/path/to/chromium node test/e2e.mjs

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..');
const dir = await mkdtemp(join(tmpdir(), 'itd-e2e-'));
const port = 8790 + Math.floor(Math.random() * 100);
const fmt = (d) => `${d.getDate()}-${d.toLocaleString('en-GB', { month: 'short' })}-${d.getFullYear()}`;
const inDays = (n) => fmt(new Date(Date.now() + n * 86_400_000));

const state = {
  accounts: {
    ABCDE1234F: {
      name: 'SAMPLE CLIENT ONE', password: 'secret-one',
      action: [{ name: 'Issue Letter', ay: '2015-16', fy: '2014-15', dates: [['5-Jun-2026', 'Open'], ['22-Jan-2026', 'Open']], notices: [
        { din: 'ITBA/AST/S/148/2026-27/1000000001(1)', section: '148', issued: '22-Jan-2026', due: '20-Feb-2026' },
        { din: 'ITBA/AST/S/142(1)/2026-27/1000000002(1)', section: '142(1)', issued: '5-Jun-2026', due: '20-Jun-2026' },
      ] }],
      information: [{ name: 'Issue Letter', ay: 'Not Available', fy: 'Not Available', isNew: true, dates: [['11-Sep-2025', 'Open']], notices: [
        { din: 'ITBA/COM/F/17/2025-26/1000000003(1)', section: '133(6)', issued: '11-Sep-2025', due: '25-Sep-2025' },
      ] }],
    },
    FGHIJ5678K: { name: 'SAMPLE CLIENT TWO', password: 'secret-two', elsewhere: true, action: [], information: [
      { name: 'Intimation u/s 143(1)', ay: '2025-26', fy: '2024-25', dates: [['2-Aug-2026', 'Closed']], notices: [{ din: 'CPC/2526/A1/1000000004', section: '143(1)', issued: '2-Aug-2026', due: '1-Sep-2026' }] },
    ] },
    KLMNO9012P: { name: 'OTP CLIENT', password: 'secret-three', otpAfter: true, action: [], information: [] },
    PQRST3456U: { name: 'WRONG PASSWORD CLIENT', password: 'the-real-one', action: [], information: [] },
  },
};

await writeFile(join(dir, 'state.json'), JSON.stringify(state));
await writeFile(join(dir, 'accounts.csv'), [
  'Client,PAN,Password,Notify,Active',
  'Sample Client One,ABCDE1234F,secret-one,client.one@example.com,',
  'Sample Client Two,FGHIJ5678K,secret-two,,yes',
  'OTP Client,KLMNO9012P,secret-three,,',
  'Wrong Password Client,PQRST3456U,not-it,,',
  'Paused Client,UVWXY7890Z,whatever,,No',
].join('\n'));

const server = spawn(process.execPath, [join(here, 'mock-portal/server.mjs'), join(dir, 'state.json'), String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

async function run(day) {
  const outbox = join(dir, `mail-${day}`);
  const env = {
    ...process.env,
    ITD_BASE: `http://localhost:${port}/iec/foservices/`,
    ITD_ACCOUNTS_FILE: join(dir, 'accounts.csv'),
    ITD_STATE_FILE: join(dir, 'store/state.json'),
    ITD_MAIL_OUTBOX: outbox,
    NOTIFY_TO: 'team@example.com',
    ITD_PAUSE_SECONDS: '0',
    SUPABASE_SERVICE_ROLE_KEY: '',
    NO_PROXY: 'localhost',
  };
  const out = await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [join(root, 'src/run.mjs')], { env, cwd: dir });
    let text = '';
    p.stdout.on('data', (d) => (text += d));
    p.stderr.on('data', (d) => (text += d));
    p.on('exit', (code) => (code === 0 ? resolve(text) : reject(new Error(`run exited ${code}\n${text}`))));
  });
  console.log(`── day ${day} ──\n${out.trim()}`);
  const store = JSON.parse(await readFile(join(dir, 'store/state.json'), 'utf8'));
  const mails = [];
  try { for (const f of (await readdir(outbox)).sort()) mails.push(JSON.parse(await readFile(join(outbox, f), 'utf8'))); } catch {}
  return { out, store, mails };
}

try {
  // ── Day 1 ──
  const d1 = await run(1);
  assert.doesNotMatch(d1.out, /ABCDE1234F|FGHIJ5678K/, 'the log never shows a whole PAN');
  const acc = Object.fromEntries(d1.store.accounts.map((a) => [a.pan, a]));
  assert.equal(acc.ABCDE1234F.status, 'ok');
  assert.equal(acc.FGHIJ5678K.status, 'ok', 'logged in elsewhere is taken over');
  assert.equal(acc.KLMNO9012P.status, 'otp');
  assert.equal(acc.PQRST3456U.status, 'bad-password');
  assert.ok(!acc.UVWXY7890Z, 'a row marked No is not checked');
  assert.equal(d1.store.proceedings.length, 3);
  assert.equal(d1.store.alerts.length, 0, 'the first read raises nothing');
  assert.equal(d1.store.documents.length, 4, 'every notice file came down on the first read');
  const letter = d1.store.proceedings.find((p) => p.ay === '2015-16');
  assert.equal(letter.notice_count, 2);
  assert.equal(letter.tab, 'action');
  assert.equal(d1.store.proceedings.find((p) => p.ay === 'Not Available').marked_new, true);
  assert.equal(d1.mails.length, 1, 'only the team summary');
  assert.match(d1.mails[0].subject, /2 not checked/);
  assert.match(d1.mails[0].html, /asks for an OTP/i);
  assert.match(d1.mails[0].html, /password rejected/i);
  assert.match(d1.mails[0].html, /Now watching 2 new accounts/);
  assert.equal(d1.store.checks.filter((c) => c.shot_path).length, 2, 'a screenshot for each failure');
  assert.equal(d1.store.runs[0].status, 'done');

  // ── Overnight: a new notice on the known letter, and a new proceeding ──
  const s = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8'));
  const due = inDays(5);
  s.accounts.ABCDE1234F.action[0].dates.unshift([inDays(-1), 'Open']);
  s.accounts.ABCDE1234F.action[0].notices.push({ din: 'ITBA/AST/S/142(1)/2026-27/1000000009(1)', section: '142(1)', issued: inDays(-1), due });
  s.accounts.ABCDE1234F.information.push({ name: 'Faceless Assessment', ay: '2024-25', fy: '2023-24', dates: [[inDays(-1), 'Open']], notices: [
    { din: 'ITBA/AST/F/143(2)/2026-27/1000000010(1)', section: '143(2)', issued: inDays(-1), due: inDays(12) },
  ] });
  await writeFile(join(dir, 'state.json'), JSON.stringify(s));

  // ── Day 2 ──
  const d2 = await run(2);
  const alerts = d2.store.alerts;
  assert.deepEqual(alerts.map((a) => a.kind).sort(), ['more-notices', 'new-proceeding']);
  assert.ok(alerts.every((a) => a.pan === 'ABCDE1234F'), 'nothing raised for the unchanged account');
  assert.ok(alerts.every((a) => a.emailed_at), 'alerts marked emailed');
  const alertMail = d2.mails.find((m) => /New income tax notices for Sample Client One/.test(m.subject));
  assert.ok(alertMail, 'the client alert was sent');
  assert.deepEqual(alertMail.to.sort(), ['client.one@example.com', 'team@example.com']);
  assert.equal(alertMail.attachments.length, 2, 'only the new files are attached');
  assert.match(alertMail.html, /Response due/);
  assert.doesNotMatch(alertMail.subject + alertMail.html, /ABCDE1234F/, 'emails show only the end of a PAN');
  const summary = d2.mails.find((m) => /Tax notice check/.test(m.subject));
  assert.match(summary.subject, /2 new/);
  assert.match(summary.subject, /due soon/);
  const updated = d2.store.proceedings.find((p) => p.ay === '2015-16');
  assert.equal(updated.notice_count, 3);
  assert.ok(updated.due_on, 'the response due date was read from the notices view');
  assert.equal(d2.store.documents.length, 6);

  // ── Day 3: nothing changes ──
  const d3 = await run(3);
  assert.equal(d3.store.alerts.length, 2, 'no new alerts');
  assert.ok(!d3.mails.some((m) => /New income tax notice/.test(m.subject)));
  assert.equal(d3.store.runs.length, 3);
  console.log('\nEND-TO-END: all checks passed');
} finally {
  server.kill();
  if (!process.env.KEEP) await rm(dir, { recursive: true, force: true });
  else console.log(`kept ${dir}`);
}
