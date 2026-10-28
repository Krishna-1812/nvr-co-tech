#!/usr/bin/env node
/**
 * Tell Bing (and the other IndexNow engines) which public pages changed.
 *
 * Bing's index is what Copilot answers from, and what ChatGPT's search and
 * DuckDuckGo lean on; left to itself it may take weeks to recrawl a page that
 * changed this morning. IndexNow is the way to say "these URLs changed" the
 * moment they do. Google does not take part, and reads the sitemap instead.
 *
 * Run after a production deployment (.github/workflows/indexnow.yml). It reads
 * the live sitemap, fetches every page, and compares the text of each with what
 * it saw last time (the state file, kept between runs by the workflow's cache).
 * Only pages whose words changed are submitted: IndexNow asks for changed URLs,
 * not the whole site every time, and an engine that is sent everything on every
 * deploy learns to give the submissions less weight. With no state file (the
 * first run) every page in the sitemap goes.
 *
 * The key is the file in public/ named <key>.txt, which is how the engines
 * check that whoever submits for this host controls it. It is not a secret.
 *
 *   node scripts/indexnow.mjs [--state .indexnow-state.json] [--dry-run]
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = (process.env.SITE_URL || 'https://www.thefinanceintelligence.com').replace(/\/+$/, '');
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const statePath = option('--state');
const dryRun = flag('--dry-run');

const keyFile = readdirSync(join(import.meta.dirname, '..', 'public')).find((f) => /^[a-f0-9]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('No IndexNow key file (public/<32 hex characters>.txt).');
const key = keyFile.replace(/\.txt$/, '');

/** A page's words, without the markup, scripts and build hashes that change on every deploy. */
export function wordsOf(html) {
  return html
    .replace(/<(script|style|noscript|template)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function text(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'TFI-IndexNow/1.0 (+https://www.thefinanceintelligence.com)' } });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
}

const sitemap = await text(`${SITE}/sitemap.xml`);
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
if (urls.length === 0) throw new Error('The sitemap lists no pages.');

const before = statePath && existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : null;
const after = {};
for (const url of urls) {
  after[url] = createHash('sha256').update(wordsOf(await text(url))).digest('hex');
}

const changed = before ? urls.filter((u) => before[u] !== after[u]) : urls;
console.log(`${urls.length} pages in the sitemap; ${before ? `${changed.length} changed since the last run` : 'no earlier run, so all of them'}.`);
for (const u of changed) console.log(`  ${u}`);

if (changed.length > 0 && !dryRun) {
  const host = new URL(SITE).host;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key, keyLocation: `${SITE}/${keyFile}`, urlList: changed }),
  });
  // 200 and 202 both mean received; anything else is worth failing the run for,
  // so a broken key or a rejected host shows up as a red workflow, not silence.
  console.log(`IndexNow answered ${res.status}.`);
  if (res.status !== 200 && res.status !== 202) {
    console.error(await res.text());
    process.exit(1);
  }
}

if (statePath && !dryRun) writeFileSync(statePath, JSON.stringify(after, null, 1));
