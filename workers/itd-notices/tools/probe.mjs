// Can this machine reach the e-Filing portal, and does the portal let a
// browser from here in? Run it once on any new host before the morning check:
//
//   node tools/probe.mjs
//
// Prints this machine's public address, a plain request to the portal, and
// then the login page loaded in Chromium in both of Playwright's headless
// modes, listing every request the portal refused and what the page said.
// Reads no accounts and logs in to nothing.

import { chromium } from 'playwright';

const BASE = process.env.ITD_BASE || 'https://eportal.incometax.gov.in/iec/foservices/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const say = (...a) => console.log('PROBE', ...a);
const squeeze = (t, n) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

try {
  say('ip', await (await fetch('https://api.ipify.org', { signal: AbortSignal.timeout(15000) })).text());
} catch (e) {
  say('ip unknown', e.message);
}
try {
  const r = await fetch(BASE, { headers: { 'user-agent': UA, accept: 'text/html' }, signal: AbortSignal.timeout(30000) });
  say('plain', r.status, squeeze(await r.text(), 80));
} catch (e) {
  say('plain failed', e.message);
}

for (const [mode, opts] of [
  ['headless-shell', { headless: true }],
  ['new-headless', { headless: true, channel: 'chromium' }],
]) {
  let browser;
  try {
    browser = await chromium.launch({ ...opts, args: ['--disable-blink-features=AutomationControlled'] });
    const context = await browser.newContext({ userAgent: UA, locale: 'en-IN', timezoneId: 'Asia/Kolkata', viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const bad = [];
    page.on('response', (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url().slice(0, 110)}`));
    page.on('requestfailed', (r) => bad.push(`failed ${r.failure()?.errorText} ${r.url().slice(0, 110)}`));
    const started = Date.now();
    await page.goto(BASE + '#/login', { waitUntil: 'domcontentloaded', timeout: 90000 }).catch((e) => bad.push(`goto ${e.message.split('\n')[0]}`));
    const box = await page.getByPlaceholder(/PAN/i).first().waitFor({ timeout: 60000 }).then(() => true, () => false);
    say(mode, box ? 'LOGIN PAGE LOADED' : 'login page did not load', `${Math.round((Date.now() - started) / 1000)}s`);
    say(mode, 'page says:', squeeze(await page.locator('body').innerText().catch(() => ''), 200));
    for (const b of bad.slice(0, 12)) say(mode, '  refused:', b);
    if (bad.length > 12) say(mode, `  …and ${bad.length - 12} more`);
  } catch (e) {
    say(mode, 'could not start', e.message.split('\n')[0]);
  } finally {
    await browser?.close().catch(() => {});
  }
}
