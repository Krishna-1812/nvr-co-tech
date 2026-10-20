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

let page = false;
const browser = await chromium.launch();
try {
  const p = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36' });
  const r = await p.goto(URL + '#/login', { timeout: 60000, waitUntil: 'domcontentloaded' });
  say(`browser: HTTP ${r?.status()}`);
  page = await p.getByPlaceholder(/PAN/i).first().waitFor({ timeout: 45000 }).then(() => true, () => false);
  say(`browser: login box ${page ? 'appeared' : 'did NOT appear'}`);
} catch (e) { say(`browser: failed (${String(e.message).split('\n')[0]})`); }
await browser.close();

say(page ? 'VERDICT: PASS - the portal login page works from this Railway server'
  : plain ? 'VERDICT: PARTIAL - the portal answers but its login page did not load in the browser'
  : 'VERDICT: FAIL - the portal refuses this Railway server');
