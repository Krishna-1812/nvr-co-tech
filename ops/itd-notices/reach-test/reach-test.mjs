// Runs once on Railway: can this server open the e-Filing login page?
// No account is used. Prints one line per check, then a verdict.
import { chromium } from 'playwright';

const URL = 'https://eportal.incometax.gov.in/iec/foservices/';
const say = (s) => console.log(`[reach-test] ${s}`);

try {
  const ip = await fetch('https://api.ipify.org?format=json').then((r) => r.json());
  say(`server address: ${ip.ip} (region ${process.env.RAILWAY_REPLICA_REGION || 'unknown'})`);
} catch { say('server address: unknown'); }

let plain = false;
try {
  const r = await fetch(URL, { signal: AbortSignal.timeout(30000) });
  plain = r.ok;
  say(`plain request: HTTP ${r.status}`);
} catch (e) { say(`plain request: failed (${e.cause?.code || e.message})`); }

// Two tries, each allowed two minutes, recording what loads, what fails and
// what is still hanging, so a slow page can be told apart from a blocked one.
let page = false;
const browser = await chromium.launch();
for (let attempt = 1; attempt <= 2 && !page; attempt++) {
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
  const p = await ctx.newPage();
  const pending = new Map(), failed = [], done = [];
  const short = (u) => { try { const x = new URL(u); return x.host + x.pathname.slice(0, 60); } catch { return u.slice(0, 80); } };
  p.on('request', (r) => pending.set(r, Date.now()));
  p.on('requestfinished', async (r) => { const t = Date.now() - (pending.get(r) || Date.now()); pending.delete(r); const res = await r.response().catch(() => null); done.push(`${res?.status() ?? '?'} ${t}ms ${short(r.url())}`); });
  p.on('requestfailed', (r) => { pending.delete(r); failed.push(`${r.failure()?.errorText} ${short(r.url())}`); });
  const t0 = Date.now();
  try {
    const r = await p.goto(URL + '#/login', { timeout: 120000, waitUntil: 'commit' });
    say(`try ${attempt}: first byte HTTP ${r?.status()} after ${Date.now() - t0}ms`);
    page = await p.getByPlaceholder(/PAN/i).first().waitFor({ timeout: 120000 }).then(() => true, () => false);
    say(`try ${attempt}: login box ${page ? 'appeared' : 'did NOT appear'} after ${Date.now() - t0}ms; title "${await p.title().catch(() => '')}"`);
  } catch (e) { say(`try ${attempt}: failed after ${Date.now() - t0}ms (${String(e.message).split('\n')[0]})`); }
  say(`try ${attempt}: ${done.length} requests finished, ${failed.length} failed, ${pending.size} still waiting`);
  for (const l of done.slice(0, 25)) say(`  ok   ${l}`);
  for (const l of failed.slice(0, 15)) say(`  FAIL ${l}`);
  for (const [r, at] of [...pending].slice(0, 15)) say(`  WAIT ${Date.now() - at}ms ${short(r.url())}`);
  if (!page) say(`try ${attempt}: page text: ${(await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)}`);
  await ctx.close();
}
await browser.close();

say(page ? 'VERDICT: PASS - the portal login page works from this Railway server'
  : plain ? 'VERDICT: PARTIAL - the portal answers but its login page did not load in the browser'
  : 'VERDICT: FAIL - the portal refuses this Railway server');
