// One-account test of the e-Filing portal: log in, open Pending Actions →
// e-Proceedings, read both tabs, open the first proceeding's notices, try the
// downloads, log out. It saves screenshots and a short report to try-output/
// and prints the report. Every PAN is masked on screen before a screenshot is
// taken and in the report; names are not, so look before you share.
//
// Run:  node try-itd.mjs          (asks for the user ID and password; the
//                                  password is not shown or saved anywhere)

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import readline from 'node:readline';

const BASE = process.env.ITD_BASE || 'https://eportal.incometax.gov.in/iec/foservices/';
const OUT = join('try-output', new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(OUT, { recursive: true });

const PAN = /[A-Z]{5}[0-9]{4}[A-Z]/g;
const mask = (s) => s.replace(PAN, 'XXXXX0000X');
const lines = [];
const log = (s) => { const m = mask(s); lines.push(m); console.log(m); };

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = (c) => { if (c.includes(question)) rl.output.write(c); };
    rl.question(question, (a) => { rl.close(); if (hidden) console.log(); resolve(a.trim()); });
  });
}

const user = process.env.ITD_USER || (await ask('User ID (PAN): '));
const pass = process.env.ITD_PASS || (await ask('Password (hidden): ', true));
if (!user || !pass) { console.log('Need both a user ID and a password.'); process.exit(1); }

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'en-IN',
  timezoneId: 'Asia/Kolkata',
  acceptDownloads: true,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
});
const page = await context.newPage();
let shot = 0;

async function snap(name) {
  // Hide every PAN on the page itself, so the screenshot carries none.
  await page.evaluate(() => {
    const has = /[A-Z]{5}[0-9]{4}[A-Z]/, re = /[A-Z]{5}[0-9]{4}[A-Z]/g;
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (has.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(re, 'XXXXX0000X');
    for (const i of document.querySelectorAll('input')) if (has.test(i.value)) i.value = i.value.replace(re, 'XXXXX0000X');
  }).catch(() => {});
  const file = join(OUT, `${String(++shot).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  return file;
}
const text = async () => mask(await page.locator('body').innerText().catch(() => ''));
const visible = (loc, ms = 1500) => loc.first().waitFor({ state: 'visible', timeout: ms }).then(() => true, () => false);

async function stop(reason) {
  log(`✗ STOPPED: ${reason}`);
  await snap('stopped');
  writeFileSync(join(OUT, 'page-text-at-stop.txt'), await text());
  await finish();
}
async function finish() {
  writeFileSync(join(OUT, 'report.txt'), lines.join('\n') + '\n');
  await browser.close();
  console.log(`\nScreenshots and report are in ${OUT}/`);
  process.exit(0);
}

try {
  // 1 ── Login page
  const res = await page.goto(BASE + '#/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  log(`✓ Portal answered (HTTP ${res?.status()})`);
  const userBox = page.getByPlaceholder(/PAN/i);
  if (!(await visible(userBox, 30000))) await stop('the login box never appeared (the portal may be down, or it blocked this browser)');
  await userBox.first().fill(user);
  await snap('user-id');
  await page.getByRole('button', { name: /continue/i }).first().click();

  // 2 ── Password page (or something else: OTP, captcha, an error)
  const pwBox = page.locator('input[type="password"]');
  if (!(await visible(pwBox, 30000))) {
    const t = await text();
    const why = /captcha/i.test(t) ? 'the portal asked for a CAPTCHA'
      : /otp/i.test(t) ? 'the portal asked for an OTP before the password'
      : /invalid|not registered|does not exist/i.test(t) ? 'the portal did not accept this user ID'
      : 'the password page never appeared';
    await stop(why);
  }
  log('✓ Reached the password page');
  const tick = page.getByRole('checkbox').first();
  if (await visible(tick, 3000)) {
    if (!(await tick.isChecked().catch(() => false))) {
      await tick.check({ force: true }).catch(() => page.getByText(/secure access message/i).first().click());
    }
    log('✓ Ticked "confirm your secure access message"');
  }
  await pwBox.first().fill(pass);
  await snap('password');
  await page.getByRole('button', { name: /continue/i }).first().click();

  // 3 ── After the password: dashboard, or a dual-login prompt, OTP, or an error
  const deadline = Date.now() + 60000;
  let outcome = '';
  while (Date.now() < deadline && !outcome) {
    if (page.url().includes('#/dashboard')) outcome = 'dashboard';
    else if (await visible(page.getByRole('button', { name: /login here/i }), 500)) {
      log('• The portal said this account is logged in elsewhere; continuing here');
      await page.getByRole('button', { name: /login here/i }).first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(4000);
    } else {
      const t = await text();
      if (/one time password|enter otp|\botp\b/i.test(t) && !/forgot/i.test(t.slice(0, 200))) outcome = 'otp';
      else if (/captcha/i.test(t)) outcome = 'captcha';
      else if (/invalid password|incorrect password|password is incorrect|account (is )?locked/i.test(t)) outcome = 'bad-password';
      else await page.waitForTimeout(1000);
    }
  }
  if (outcome === 'otp') await stop('this account needs an OTP to log in, so it cannot be checked unattended');
  if (outcome === 'captcha') await stop('the portal asked for a CAPTCHA after the password');
  if (outcome === 'bad-password') await stop('the portal rejected the password (or the account is locked)');
  if (outcome !== 'dashboard') await stop('did not reach the dashboard within a minute');
  log('✓ Logged in, dashboard open');
  await page.waitForTimeout(3000);
  await snap('dashboard');

  // 4 ── Pending Actions → E-Proceedings (menu first, the page's own address if that fails)
  let viaMenu = false;
  try {
    await page.getByText(/^\s*Pending Actions\s*$/i).first().click({ timeout: 10000 });
    await page.getByText(/^\s*E-Proceedings\s*$/i).first().click({ timeout: 10000 });
    viaMenu = true;
  } catch {
    await page.goto(BASE + '#/dashboard/eProceedings', { waitUntil: 'domcontentloaded' });
  }
  if (!(await visible(page.getByText(/For your Action/i), 45000))) await stop('the e-Proceedings page did not load');
  log(`✓ e-Proceedings open (${viaMenu ? 'through the menu' : 'by its address'})`);
  await page.waitForTimeout(3000);

  const read = async (tab) => {
    const t = await text();
    const blocks = t.split(/Proceeding Name\s*:/i).slice(1);
    log(`  ${tab}: ${blocks.length} proceeding(s) shown`);
    for (const b of blocks.slice(0, 15)) {
      const name = b.split(/Assessment Year/i)[0].trim().split('\n')[0].replace(/\s*New\s*$/, '').trim();
      const ay = (b.match(/Assessment Year\s*:\s*([^\n]+)/i) || [])[1]?.trim() || '?';
      const notices = (b.match(/View Notices\/Orders\s*\((\d+)\)/i) || [])[1] || '?';
      log(`   - ${name} | AY ${ay} | ${notices} notice(s)${/\bNew\b/.test(b.slice(0, 80)) ? ' | marked New' : ''}`);
    }
    writeFileSync(join(OUT, `page-text-${tab.replace(/\W+/g, '-').toLowerCase()}.txt`), t);
  };
  const counts = (await text()).match(/For your Action\s*\((\d+)\)[\s\S]*?For your Information\s*\((\d+)\)/i);
  if (counts) log(`✓ Counts on the tabs: For your Action ${counts[1]}, For your Information ${counts[2]}`);
  await read('For your Action');
  await snap('eproceedings-action');

  // 5 ── The Excel download on this page
  try {
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.getByRole('button', { name: /excel download/i }).first().click(),
    ]);
    const f = join(OUT, 'eproceedings' + (dl.suggestedFilename().match(/\.\w+$/)?.[0] || '.xlsx'));
    await dl.saveAs(f);
    log(`✓ Excel download works (${dl.suggestedFilename().replace(PAN, 'XXXXX0000X')})`);
  } catch { log('✗ Excel download did not start'); }

  // 6 ── The other tab
  try {
    await page.getByText(/For your Information/i).first().click({ timeout: 10000 });
    await page.waitForTimeout(3000);
    await read('For your Information');
    await snap('eproceedings-information');
    await page.getByText(/For your Action/i).first().click({ timeout: 10000 });
    await page.waitForTimeout(2000);
  } catch { log('✗ Could not switch to "For your Information"'); }

  // 7 ── First proceeding's notices, and a try at downloading one
  const viewBtn = page.getByRole('button', { name: /View Notices\/Orders/i }).or(page.getByText(/View Notices\/Orders/i));
  if (await visible(viewBtn, 5000)) {
    await viewBtn.first().click();
    await page.waitForTimeout(5000);
    log('✓ Opened the first proceeding\'s notices');
    await snap('notices');
    writeFileSync(join(OUT, 'page-text-notices.txt'), await text());
    const pdf = page.getByRole('link', { name: /pdf|download|view/i }).or(page.getByRole('button', { name: /pdf|download/i }))
      .filter({ hasNotText: /excel/i });
    try {
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), pdf.first().click({ timeout: 10000 })]);
      await dl.saveAs(join(OUT, 'notice' + (dl.suggestedFilename().match(/\.\w+$/)?.[0] || '.pdf')));
      log('✓ A notice downloaded');
    } catch {
      log('• Could not download a notice automatically yet (expected on a first try; the screenshot shows me how that page works)');
    }
  } else {
    log('• No "View Notices/Orders" button on this tab, so nothing to open');
  }

  // 8 ── Log out
  let out = false;
  for (const opener of [page.getByText(/^\s*(Individual|Company|HUF|Firm|Trust|AOP|BOI|LLP)\s*$/), page.locator('img[alt*="profile" i], img[src*="profile" i]')]) {
    try {
      await opener.first().click({ timeout: 5000 });
      const btn = page.getByText(/^\s*Log ?out\s*$/i);
      if (await visible(btn, 3000)) {
        await btn.first().click({ timeout: 5000 }).catch(() => btn.first().dispatchEvent('click'));
        out = true; break;
      }
    } catch {}
  }
  await page.waitForTimeout(3000);
  log(out ? '✓ Logged out' : '• Could not find Log out; the session will expire on its own (your next manual login may ask to "Login Here")');
  await finish();
} catch (e) {
  await stop(`unexpected error: ${String(e?.message || e).split('\n')[0]}`);
}
