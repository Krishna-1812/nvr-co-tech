// The morning run: every account in the sheet, one after another.
//
//   node src/run.mjs            the real thing (settings from the environment)
//   node src/run.mjs --dry      no email, and a local JSON store, whatever is set
//   node src/run.mjs --only ABCDE1234F   one account, for trying a new row
//
// One account at a time, with a pause between them, and one browser for the
// whole run. An account that fails (wrong password, OTP, the portal down) is
// recorded and reported and the run moves on; nothing one account does can
// stop the others being checked. The run exits 0 even when accounts failed,
// because that is news for the email, not a crash for the scheduler; it exits
// 1 only when it could not run at all (no sheet, no store).

import { hostname } from 'node:os';
import { chromium } from 'playwright';
import { loadConfig } from './config.mjs';
import { loadAccounts } from './sheet.mjs';
import { fileStore, supabaseStore } from './store.mjs';
import { alertEmail, mailer, summaryEmail } from './mail.mjs';
import { checkAccount } from './portal.mjs';
import { diffProceedings, maskPan } from './parse.mjs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
// A dry run also reports what it read, card by card, so a first run against
// the real portal shows whether every field and file came through.
const report = dry || args.includes('--report');
const only = args.includes('--only') ? String(args[args.indexOf('--only') + 1] ?? '').toUpperCase() : null;

const cfg = loadConfig({ dry });
const log = (s) => console.log(`[${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}] ${maskPan(s)}`);
const squeeze = (t, n) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Set once the run is recorded, so a crash after that point is recorded too.
let recorded = null;

async function main() {
  const store = cfg.supabaseUrl && cfg.serviceKey && !dry
    ? await supabaseStore({ url: cfg.supabaseUrl, serviceKey: cfg.serviceKey })
    : await fileStore(cfg.stateFile);
  const mail = mailer(cfg);
  log(`store: ${store.kind}; email: ${mail.kind}; portal: ${cfg.base}`);

  const { accounts: all, skipped } = await loadAccounts(cfg);
  const accounts = only ? all.filter((a) => a.userId === only) : all;
  log(`${accounts.length} account(s) to check${skipped.length ? `; skipped ${skipped.length} row(s)` : ''}`);
  if (!only) await store.markSheet(all.map((a) => a.userId));

  const runId = await store.startRun(hostname());
  recorded = { store, runId };
  const now = () => new Date().toISOString();
  const failures = [];
  const alertsByAccount = [];
  const baselined = [];
  const alertIds = [];
  let ok = 0;

  // Without the automation flag the browser looks like any other Chrome to the
  // portal's firewall, which refused it at least once from a cloud host.
  // Playwright's full Chromium in its new headless mode, which is closer to
  // the Chrome a person uses than the stripped-down headless shell.
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.ITD_CHROMIUM_PATH ? {} : { channel: 'chromium' }),
    args: ['--disable-blink-features=AutomationControlled'],
    ...(process.env.ITD_CHROMIUM_PATH ? { executablePath: process.env.ITD_CHROMIUM_PATH } : {}),
  });
  try {
    for (const [i, account] of accounts.entries()) {
      if (i > 0) await sleep(cfg.pauseMs);
      const pan = account.userId;
      const started = Date.now();
      log(`(${i + 1}/${accounts.length}) ${pan} ${account.name ?? ''}`);
      const before = await store.getAccount(pan);
      // A password the portal rejected is not tried again for a week, so a
      // wrong password in the sheet can never walk an account into a lockout.
      // Correcting it in the sheet and waiting, or a person logging in, is the fix.
      if (['bad-password', 'locked'].includes(before?.status) && before.last_checked_at && Date.parse(before.last_checked_at) > Date.now() - 7 * 86_400_000) {
        log(`  skipped: the last try ended "${before.status}" on ${before.last_checked_at.slice(0, 10)}; not trying the password again for a week`);
        failures.push({ account, status: before.status, message: before.message ?? before.status });
        continue;
      }
      await store.upsertAccount({ pan, name: account.name, notify: account.notify });
      const previous = await store.getProceedings(pan);
      const baseline = !before?.first_ok_at;

      // Which cards' notices to open: on the first read, all of them (so the
      // dashboard starts with every file); after that, only what changed.
      const prevByKey = new Map(previous.map((p) => [p.key, p]));
      const planned = new Map();
      const want = (tab, list) => {
        const { rows } = diffProceedings(pan, list, previous, { baseline: true });
        const idx = [];
        rows.forEach((r, k) => {
          r.tab = tab;
          const old = prevByKey.get(r.key);
          const changed = !old || (r.noticeCount ?? 0) > (old.notice_count ?? 0) || r.dates.some((d) => !(old.dates ?? []).some((o) => o.date === d.date));
          if ((baseline || changed) && idx.length < cfg.maxOpenPerTab) { idx.push(k); planned.set(`${tab}:${k}`, r.key); }
        });
        return idx;
      };

      try {
        const res = await checkAccount(browser, account, { base: cfg.base, want, log: (s) => log(`  ${s}`) });
        const current = [
          ...(res.tabs.action ?? []).map((p) => ({ ...p, tab: 'action' })),
          ...(res.tabs.information ?? []).map((p) => ({ ...p, tab: 'information' })),
        ];
        const { rows, alerts, gone } = diffProceedings(pan, current, previous, { baseline, now: now() });
        // Keys are worked out across both tabs together, so a card's key here
        // is the one the store keeps; restore each row's tab after the diff.
        rows.forEach((r, k) => (r.tab = current[k].tab));
        const changed = new Set([...alerts.map((a) => a.key), ...rows.filter((r) => !prevByKey.has(r.key)).map((r) => r.key)]);
        await store.saveProceedings(pan, rows, { changed, now: now() });
        await store.markGone(gone, now());

        // Notices that were opened: their text, due dates and files.
        const docs = [];
        const dueByKey = new Map();
        for (const n of res.notices) {
          const tabRows = rows.filter((r) => r.tab === n.tab);
          const key = tabRows[n.index]?.key ?? planned.get(`${n.tab}:${n.index}`);
          if (!key) continue;
          // The latest notice's due date is the one that matters; a proceeding
          // whose latest entry the portal marks Closed has nothing due.
          const row = tabRows[n.index];
          const closed = /closed|completed|disposed/i.test(row?.dates?.[0]?.status ?? '');
          const dueOn = closed ? null : (n.parsed.dueDates.at(-1) ?? null);
          if (dueOn) dueByKey.set(key, dueOn);
          await store.setNoticeInfo(key, { text: n.text, dueOn });
          for (const f of n.files) {
            const saved = await store.addDocument({ proceedingKey: key, pan, label: f.label, fileName: f.name, bytes: f.bytes });
            if (saved.isNew) docs.push({ key, fileName: f.name, bytes: f.bytes });
          }
        }

        const ids = await store.addAlerts(runId, alerts);
        await store.upsertAccount({
          pan,
          status: 'ok',
          message: res.loggedOut ? null : 'Could not find Log out; the session ends on its own',
          last_checked_at: now(),
          last_ok_at: now(),
          ...(baseline ? { first_ok_at: now() } : {}),
          action_count: res.tabs.action?.length ?? null,
          information_count: res.tabs.information?.length ?? null,
        });
        await store.addCheck(runId, { pan, status: 'ok', message: null, proceedings: rows.length, took_ms: Date.now() - started });
        ok++;
        log(`  ok: ${rows.length} proceeding(s), ${alerts.length} new, ${res.notices.length} opened, ${docs.length} new file(s)`);
        if (report) {
          log(`  tabs say: action ${res.counts?.action ?? '?'}, information ${res.counts?.information ?? '?'}`);
          rows.forEach((r) => log(`  [${r.tab}] ${r.name} | AY ${r.ay ?? '-'} | FY ${r.fy ?? '-'} | ${r.noticeCount ?? '?'} notice(s) | dates ${r.dates.map((d) => `${d.date}${d.status ? ` ${d.status}` : ''}`).join(', ') || '-'}${r.markedNew ? ' | NEW' : ''}`));
          for (const n of res.notices) {
            log(`  opened [${n.tab} #${n.index + 1}]: ${n.files.length} file(s)${n.files.length ? ` (${n.files.map((f) => `${f.name} ${Math.round(f.bytes.length / 1024)} KB`).join(', ')})` : ''}; DINs ${n.parsed.dins.length}; sections ${n.parsed.sections.join(', ') || '-'}; due ${n.parsed.dueDates.join(', ') || '-'}`);
            log(`    view text: ${squeeze(n.text, 700)}`);
          }
        }

        if (baseline) baselined.push({ account, count: rows.length });
        if (alerts.length) {
          const withDue = alerts.map((a) => ({ ...a, dueOn: dueByKey.get(a.key) ?? null }));
          alertsByAccount.push({ account, alerts: withDue });
          const keys = new Set(alerts.map((a) => a.key));
          const email = alertEmail(account, withDue, docs.filter((d) => keys.has(d.key)), { dashboardUrl: cfg.dashboardUrl });
          const to = [...new Set([...cfg.notifyTo, ...account.notify])];
          if (to.length && mail.kind !== 'none') {
            try {
              await mail.send({ to, ...email });
              alertIds.push(...ids.map((x) => x.id));
            } catch (e) {
              log(`  email failed: ${e.message}`);
            }
          }
        }
      } catch (e) {
        const status = e.status ?? 'error';
        log(`  not checked: ${status}: ${e.message}`);
        if (report) {
          if (e.url) log(`    at: ${e.url.replace(/[?].*$/, '')}`);
          for (const n of e.notes ?? []) log(`    portal says: ${squeeze(n, 300)}`);
          // The portal's header and menu come first on every page; skip to
          // what is under them.
          const text = squeeze(e.pageText, 4000);
          const at = text.search(/Downloads\s+Help\s+/i);
          if (e.pageText) log(`    page text: ${squeeze(at > 0 ? text.slice(at + 15) : text, 1500)}`);
        }
        failures.push({ account, status, message: e.message });
        await store.upsertAccount({ pan, status, message: e.message, last_checked_at: now() });
        await store.addCheck(runId, { pan, status, message: e.message, took_ms: Date.now() - started }, e.shot ?? null);
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  // The team's summary: new notices, responses due within a week, accounts
  // that could not be checked, and newly added accounts. Nothing → no email.
  const dueRows = await store.dueSoon(7);
  const names = new Map(all.map((a) => [a.userId, a.name]));
  const due = dueRows.map((d) => ({ ...d, clientName: names.get(d.pan) ?? null }));
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const summary = summaryEmail({ date, checked: ok, failures, alertsByAccount, due, baselined, skipped }, { dashboardUrl: cfg.dashboardUrl });
  let emailed = false;
  if (summary && cfg.notifyTo.length && mail.kind !== 'none') {
    try {
      await mail.send({ to: cfg.notifyTo, ...summary });
      emailed = true;
    } catch (e) {
      log(`summary email failed: ${e.message}`);
    }
  }
  await store.markEmailed(alertIds);
  const nAlerts = alertsByAccount.reduce((n, x) => n + x.alerts.length, 0);
  await store.finishRun(runId, { status: 'done', accounts: accounts.length, ok, failed: failures.length, alerts: nAlerts, emailed, note: summary?.subject ?? 'Nothing new' });
  log(`done: ${ok} checked, ${failures.length} not checked, ${nAlerts} new, summary ${summary ? (emailed ? 'emailed' : 'not emailed') : 'not needed'}`);
}

main().catch(async (e) => {
  const why = maskPan(e?.message ?? String(e));
  console.error(`Run could not finish: ${why}`);
  if (recorded) await recorded.store.finishRun(recorded.runId, { status: 'crashed', note: why.slice(0, 500) }).catch(() => {});
  process.exit(1);
});
