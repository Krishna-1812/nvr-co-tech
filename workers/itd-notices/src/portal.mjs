// Driving the e-Filing portal for one account: log in, read e-Proceedings,
// open the notices asked for, download what they offer, log out.
//
// Written against the portal as the owner's screenshots showed it on 20 Oct
// 2026 and proven against a stand-in built from them (test/mock-portal). Every
// step finds things by the words a person sees, and every way a login can end
// is told apart, so a morning's email can say "this account needs an OTP"
// rather than "something went wrong".
//
// It never solves a CAPTCHA or an OTP and never retries a password: an account
// that asks for either is reported and left alone, and a rejected password is
// tried once a day at most, so the portal never locks anyone out on our account.

import { parseNoticeText, parseProceedings, readTabCounts } from './parse.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

/** A failure with a status the run report and the dashboard understand. */
export class CheckError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const visible = (loc, ms) => loc.first().waitFor({ state: 'visible', timeout: ms }).then(() => true, () => false);

async function pageText(page) {
  return page.locator('body').innerText().catch(() => '');
}

/** Hide every PAN on the page before a screenshot is taken of it. */
async function maskPage(page) {
  await page.evaluate(() => {
    const has = /[A-Z]{5}[0-9]{4}[A-Z]/, re = /[A-Z]{5}[0-9]{4}[A-Z]/g;
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (has.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(re, 'XXXXX0000X');
    for (const i of document.querySelectorAll('input')) if (has.test(i.value)) i.value = i.value.replace(re, 'XXXXX0000X');
  }).catch(() => {});
}

async function login(page, base, account, log) {
  await page.goto(base + '#/login', { waitUntil: 'domcontentloaded', timeout: 90000 }).catch((e) => {
    throw new CheckError('portal-down', `The portal did not answer (${String(e.message).split('\n')[0]})`);
  });
  const userBox = page.getByPlaceholder(/PAN/i);
  if (!(await visible(userBox, 60000))) throw new CheckError('portal-down', 'The login page did not load');
  await userBox.first().fill(account.userId);
  await page.getByRole('button', { name: /continue/i }).first().click();

  const pwBox = page.locator('input[type="password"]');
  if (!(await visible(pwBox, 45000))) {
    const t = await pageText(page);
    if (/captcha/i.test(t)) throw new CheckError('captcha', 'The portal asked for a CAPTCHA');
    if (/\botp\b|one time password/i.test(t)) throw new CheckError('otp', 'This account asks for an OTP before the password');
    if (/invalid|not registered|does not exist|not valid/i.test(t)) throw new CheckError('bad-user', 'The portal did not accept this user ID');
    throw new CheckError('layout', 'The password page never appeared');
  }

  const tick = page.getByRole('checkbox').first();
  if (await visible(tick, 3000)) {
    if (!(await tick.isChecked().catch(() => false))) {
      await tick.check({ force: true }).catch(() => page.getByText(/secure access message/i).first().click());
    }
  }
  await pwBox.first().fill(account.password);
  await page.getByRole('button', { name: /continue/i }).first().click();

  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (page.url().includes('#/dashboard')) return;
    const here = page.getByRole('button', { name: /login here/i });
    if (await visible(here, 500)) {
      log('logged in elsewhere; taking over the session');
      await here.first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(4000);
      continue;
    }
    const t = await pageText(page);
    if (/captcha/i.test(t)) throw new CheckError('captcha', 'The portal asked for a CAPTCHA after the password');
    if (/one time password|enter (the )?otp|\botp\b.*(sent|mobile|email)/i.test(t)) throw new CheckError('otp', 'This account needs an OTP to log in, so it cannot be checked unattended');
    if (/invalid password|incorrect password|password is incorrect|wrong password/i.test(t)) throw new CheckError('bad-password', 'The portal rejected the password');
    if (/locked|disabled|deactivated/i.test(t) && !/unlock/i.test(t)) throw new CheckError('locked', 'The portal says this account is locked');
    await page.waitForTimeout(1000);
  }
  throw new CheckError('layout', 'Did not reach the dashboard after the password');
}

async function openEProceedings(page, base) {
  try {
    await page.getByText(/^\s*Pending Actions\s*$/i).first().click({ timeout: 15000 });
    await page.getByText(/^\s*E-Proceedings\s*$/i).first().click({ timeout: 10000 });
  } catch {
    await page.goto(base + '#/dashboard/eProceedings', { waitUntil: 'domcontentloaded' });
  }
  if (!(await visible(page.getByText(/For your Action/i), 60000))) throw new CheckError('layout', 'The e-Proceedings page did not load');
  await settle(page);
}

/** Wait for the list to stop changing, and pull in anything loaded on scroll. */
async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  let last = -1;
  for (let i = 0; i < 10; i++) {
    const n = await page.getByText(/Proceeding Name/i).count().catch(() => 0);
    if (n === last) break;
    last = n;
    await page.mouse.wheel(0, 20000).catch(() => {});
    await page.waitForTimeout(1200);
    const more = page.getByRole('button', { name: /^(load|show|view) more$/i });
    if (await visible(more, 300)) await more.first().click().catch(() => {});
  }
  await page.mouse.wheel(0, -40000).catch(() => {});
}

async function showTab(page, tab) {
  const label = tab === 'action' ? /For your Action/i : /For your Information/i;
  await page.getByText(label).first().click({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await settle(page);
}

/**
 * Open the notices of the card at `index` on the current tab, read the view,
 * and download what it offers. Returns the page text and the files.
 */
async function readNotices(page, index, { maxFiles = 10 } = {}) {
  const buttons = page.getByRole('button', { name: /View Notices\/Orders/i }).or(page.getByRole('link', { name: /View Notices\/Orders/i }));
  const before = page.url();
  await buttons.nth(index).click({ timeout: 15000 });
  await page.waitForTimeout(4000);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  const text = await pageText(page);
  const files = [];

  const candidates = page
    .getByRole('link', { name: /pdf|download|view notice|view order/i })
    .or(page.getByRole('button', { name: /pdf|download/i }))
    .or(page.locator('a[href$=".pdf" i]'))
    .filter({ hasNotText: /excel|authori[sz]ed representative/i });
  const n = Math.min(await candidates.count().catch(() => 0), maxFiles);
  for (let i = 0; i < n; i++) {
    const label = ((await candidates.nth(i).innerText().catch(() => '')) || `document ${i + 1}`).trim().slice(0, 120);
    try {
      // A notice either downloads, or opens in a new tab as a PDF.
      const got = await Promise.race([
        page.waitForEvent('download', { timeout: 20000 }).then(async (dl) => {
          const path = await dl.path();
          const { readFile } = await import('node:fs/promises');
          return { name: dl.suggestedFilename(), bytes: await readFile(path) };
        }),
        page.context().waitForEvent('page', { timeout: 20000 }).then(async (tab) => {
          await tab.waitForLoadState('domcontentloaded').catch(() => {});
          const res = await page.context().request.get(tab.url());
          const bytes = await res.body();
          await tab.close().catch(() => {});
          return { name: decodeURIComponent(new URL(tab.url()).pathname.split('/').pop() || 'notice.pdf'), bytes };
        }),
        candidates.nth(i).click({ timeout: 10000 }).then(() => new Promise(() => {})),
      ]);
      if (got?.bytes?.length) files.push({ label, ...got });
    } catch {
      // Nothing came of this one; the page text is kept regardless.
    }
  }

  // Back to the list: the view was either a route of its own or a dialog.
  if (page.url() !== before) await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
  else {
    const close = page.getByRole('button', { name: /^(close|back|×|x)$/i });
    if (await visible(close, 1000)) await close.first().click().catch(() => {});
    else await page.keyboard.press('Escape').catch(() => {});
  }
  if (!(await visible(page.getByText(/For your Action/i), 30000))) {
    await page.goto(before, { waitUntil: 'domcontentloaded' }).catch(() => {});
  }
  return { text, files, parsed: parseNoticeText(text) };
}

async function logout(page) {
  for (const opener of [page.getByText(/^\s*(Individual|Company|HUF|Firm|Trust|AOP|BOI|LLP|AJP|Local Authority)\s*$/), page.locator('img[alt*="profile" i], img[src*="profile" i]')]) {
    try {
      await opener.first().click({ timeout: 5000 });
      const btn = page.getByText(/^\s*Log ?out\s*$/i);
      if (await visible(btn, 3000)) {
        await btn.first().click({ timeout: 5000 }).catch(() => btn.first().dispatchEvent('click'));
        await page.waitForTimeout(2000);
        return true;
      }
    } catch {}
  }
  return false;
}

/**
 * Check one account.
 *
 * `want(tab, proceedings)` is asked, per tab, which cards' notices to open;
 * it returns indexes. Returns what was read, or throws a CheckError. A
 * screenshot of wherever it stopped (PANs hidden) rides on the error as
 * `shot`.
 */
export async function checkAccount(browser, account, { base, want = () => [], log = () => {}, timeoutMs = 6 * 60_000 }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', acceptDownloads: true, userAgent: UA });
  const page = await context.newPage();
  const result = { tabs: {}, counts: null, notices: [], loggedOut: false };
  let timer;
  try {
    const work = (async () => {
      await login(page, base, account, log);
      await openEProceedings(page, base);
      result.counts = readTabCounts(await pageText(page));
      for (const tab of ['action', 'information']) {
        await showTab(page, tab).catch(() => {});
        const list = parseProceedings(await pageText(page));
        result.tabs[tab] = list;
        const expected = result.counts?.[tab];
        if (expected != null && expected !== list.length) log(`${tab}: tab says ${expected}, ${list.length} read`);
        // Notices are opened by position, so only when every card has its own
        // button; otherwise the wrong proceeding's files could be filed.
        const buttons = await page.getByRole('button', { name: /View Notices\/Orders/i }).or(page.getByRole('link', { name: /View Notices\/Orders/i })).count();
        const wanted = want(tab, list);
        if (wanted.length && buttons !== list.length) {
          log(`${tab}: ${buttons} notice buttons for ${list.length} cards; not opening notices this time`);
          continue;
        }
        for (const index of wanted) {
          try {
            const got = await readNotices(page, index);
            result.notices.push({ tab, index, ...got });
            await showTab(page, tab).catch(() => {});
          } catch (e) {
            log(`could not open notices for ${tab} #${index + 1}: ${String(e.message).split('\n')[0]}`);
          }
        }
      }
    })();
    await Promise.race([work, new Promise((_, no) => (timer = setTimeout(() => no(new CheckError('timeout', 'The check took longer than six minutes')), timeoutMs)))]);
    result.loggedOut = await logout(page);
    return result;
  } catch (e) {
    const err = e instanceof CheckError ? e : new CheckError('error', String(e?.message ?? e).split('\n')[0]);
    await maskPage(page);
    err.shot = await page.screenshot({ fullPage: true }).catch(() => null);
    err.pageText = (await pageText(page)).slice(0, 4000);
    if (page.url().includes('#/dashboard')) await logout(page).catch(() => {});
    throw err;
  } finally {
    clearTimeout(timer);
    await context.close().catch(() => {});
  }
}
