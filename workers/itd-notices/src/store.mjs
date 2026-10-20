// Where the worker keeps what it finds.
//
// Two backends with one shape. `supabase` writes the tables of migration 0037
// with the service-role key and the notices' files to the private
// `itd-notices` bucket; the Admin screen reads them from there. `file` keeps
// the same records in a JSON file and the files in a folder beside it, for a
// dry run on a laptop and for the end-to-end test, so both exercise exactly
// the code the morning run uses.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const safe = (s) => String(s || 'notice.pdf').replace(/[^\w.-]+/g, '_').slice(-80);
// Responses due within `days`, and those missed in the last fortnight. Older
// misses are history, not a reminder: repeating them every morning would
// bury the ones that still matter.
const dueWindow = (days) => ({
  from: new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10),
  until: new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10),
});
export const docPath = (pan, key, hash, name) => `${pan}/${key}/${hash.slice(0, 12)}-${safe(name)}`;

const procRow = (pan, p, now) => ({
  key: p.key,
  pan,
  tab: p.tab,
  name: p.name,
  ay: p.ay,
  fy: p.fy,
  act: p.act,
  assessee: p.assessee,
  dates: p.dates,
  notice_count: p.noticeCount,
  marked_new: p.markedNew,
  last_seen_at: now,
  gone_at: null,
});

// ── Supabase ────────────────────────────────────────────────────────────────

export async function supabaseStore({ url, serviceKey }) {
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const ok = ({ data, error }, what) => {
    if (error) throw new Error(`${what}: ${error.message}`);
    return data;
  };
  const bucket = db.storage.from('itd-notices');

  return {
    kind: 'supabase',
    async getAccount(pan) {
      return ok(await db.from('itd_accounts').select('*').eq('pan', pan).maybeSingle(), 'read account');
    },
    async getProceedings(pan) {
      return ok(await db.from('itd_proceedings').select('*').eq('pan', pan).is('gone_at', null), 'read proceedings');
    },
    async startRun(host) {
      return ok(await db.from('itd_runs').insert({ host }).select('id').single(), 'start run').id;
    },
    async upsertAccount(row) {
      ok(await db.from('itd_accounts').upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'pan' }), 'save account');
    },
    async markSheet(pans) {
      ok(await db.from('itd_accounts').update({ in_sheet: false }).not('pan', 'in', `(${pans.map((p) => `"${p}"`).join(',') || '""'})`), 'mark sheet');
      if (pans.length) ok(await db.from('itd_accounts').update({ in_sheet: true }).in('pan', pans), 'mark sheet');
    },
    async saveProceedings(pan, rows, { changed, now }) {
      if (!rows.length) return;
      const body = rows.map((p) => ({
        ...procRow(pan, p, now),
        ...(changed.has(p.key) ? { last_change_at: now, handled_at: null, handled_by: null, handled_note: null } : {}),
      }));
      // Two batches so that rows without a change keep their handled state.
      const a = body.filter((r) => 'last_change_at' in r);
      const b = body.filter((r) => !('last_change_at' in r));
      if (a.length) ok(await db.from('itd_proceedings').upsert(a, { onConflict: 'key' }), 'save proceedings');
      if (b.length) ok(await db.from('itd_proceedings').upsert(b, { onConflict: 'key' }), 'save proceedings');
    },
    async markGone(keys, now) {
      if (keys.length) ok(await db.from('itd_proceedings').update({ gone_at: now }).in('key', keys), 'mark gone');
    },
    async setNoticeInfo(key, { text, dueOn }) {
      const patch = { notice_text: text?.slice(0, 20000) ?? null };
      if (dueOn) patch.due_on = dueOn;
      ok(await db.from('itd_proceedings').update(patch).eq('key', key), 'save notice text');
    },
    async addDocument({ proceedingKey, pan, label, fileName, bytes }) {
      const hash = sha256(bytes);
      const path = docPath(pan, proceedingKey, hash, fileName);
      const { error } = await bucket.upload(path, bytes, { contentType: /\.pdf$/i.test(fileName) ? 'application/pdf' : 'application/octet-stream', upsert: false });
      if (error && !/exists|duplicate/i.test(error.message)) throw new Error(`upload: ${error.message}`);
      const res = await db.from('itd_documents').upsert(
        { proceeding_key: proceedingKey, pan, label, file_name: fileName, storage_path: path, size_bytes: bytes.length, sha256: hash },
        { onConflict: 'proceeding_key,sha256', ignoreDuplicates: true },
      ).select('id');
      ok(res, 'save document');
      return { path, isNew: (res.data ?? []).length > 0 };
    },
    async addAlerts(runId, alerts) {
      if (!alerts.length) return [];
      return ok(await db.from('itd_alerts').insert(alerts.map((a) => ({ run_id: runId, pan: a.pan, proceeding_key: a.key, kind: a.kind, detail: a.detail, at: a.at }))).select('id'), 'save alerts');
    },
    async addCheck(runId, check, shot) {
      let shot_path = null;
      if (shot) {
        shot_path = `checks/${runId}/${check.pan.slice(-4)}-${check.status}.png`;
        await bucket.upload(shot_path, shot, { contentType: 'image/png', upsert: true }).catch(() => (shot_path = null));
      }
      ok(await db.from('itd_checks').insert({ run_id: runId, ...check, shot_path }), 'save check');
    },
    async dueSoon(days) {
      const { from, until } = dueWindow(days);
      const rows = ok(await db.from('itd_proceedings').select('key, pan, name, ay, due_on').is('gone_at', null).is('handled_at', null).gte('due_on', from).lte('due_on', until).order('due_on'), 'due soon');
      return rows;
    },
    async markEmailed(ids) {
      if (ids.length) ok(await db.from('itd_alerts').update({ emailed_at: new Date().toISOString() }).in('id', ids), 'mark emailed');
    },
    async finishRun(runId, stats) {
      ok(await db.from('itd_runs').update({ ...stats, finished_at: new Date().toISOString() }).eq('id', runId), 'finish run');
    },
  };
}

// ── File (dry runs and tests) ────────────────────────────────────────────────

export async function fileStore(file) {
  const empty = { accounts: [], runs: [], checks: [], proceedings: [], documents: [], alerts: [] };
  let s;
  try { s = { ...empty, ...JSON.parse(await readFile(file, 'utf8')) }; } catch { s = empty; }
  const dir = join(dirname(file), 'files');
  const save = async () => { await mkdir(dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(s, null, 2)); };
  const id = (list) => (list.at(-1)?.id ?? 0) + 1;

  return {
    kind: 'file',
    state: () => s,
    async getAccount(pan) { return s.accounts.find((a) => a.pan === pan) ?? null; },
    async getProceedings(pan) { return s.proceedings.filter((p) => p.pan === pan && !p.gone_at); },
    async startRun(host) { const r = { id: id(s.runs), host, started_at: new Date().toISOString(), status: 'running' }; s.runs.push(r); await save(); return r.id; },
    async upsertAccount(row) {
      const i = s.accounts.findIndex((a) => a.pan === row.pan);
      if (i >= 0) s.accounts[i] = { ...s.accounts[i], ...row }; else s.accounts.push({ in_sheet: true, notify: [], ...row });
      await save();
    },
    async markSheet(pans) { for (const a of s.accounts) a.in_sheet = pans.includes(a.pan); await save(); },
    async saveProceedings(pan, rows, { changed, now }) {
      for (const p of rows) {
        const row = procRow(pan, p, now);
        if (changed.has(p.key)) Object.assign(row, { last_change_at: now, handled_at: null });
        const i = s.proceedings.findIndex((x) => x.key === p.key);
        if (i >= 0) s.proceedings[i] = { ...s.proceedings[i], ...row }; else s.proceedings.push({ first_seen_at: now, ...row });
      }
      await save();
    },
    async markGone(keys, now) { for (const p of s.proceedings) if (keys.includes(p.key)) p.gone_at = now; await save(); },
    async setNoticeInfo(key, { text, dueOn }) {
      const p = s.proceedings.find((x) => x.key === key);
      if (p) { p.notice_text = text; if (dueOn) p.due_on = dueOn; }
      await save();
    },
    async addDocument({ proceedingKey, pan, label, fileName, bytes }) {
      const hash = sha256(bytes);
      const path = docPath(pan, proceedingKey, hash, fileName);
      if (s.documents.some((d) => d.proceeding_key === proceedingKey && d.sha256 === hash)) return { path, isNew: false };
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), bytes);
      s.documents.push({ id: id(s.documents), proceeding_key: proceedingKey, pan, label, file_name: fileName, storage_path: path, size_bytes: bytes.length, sha256: hash });
      await save();
      return { path, isNew: true };
    },
    async addAlerts(runId, alerts) {
      const out = alerts.map((a) => ({ id: id(s.alerts) + alerts.indexOf(a), run_id: runId, pan: a.pan, proceeding_key: a.key, kind: a.kind, detail: a.detail, at: a.at }));
      s.alerts.push(...out);
      await save();
      return out.map((a) => ({ id: a.id }));
    },
    async addCheck(runId, check, shot) {
      let shot_path = null;
      if (shot) {
        shot_path = `checks/${runId}/${check.pan.slice(-4)}-${check.status}.png`;
        await mkdir(dirname(join(dir, shot_path)), { recursive: true });
        await writeFile(join(dir, shot_path), shot);
      }
      s.checks.push({ id: id(s.checks), run_id: runId, ...check, shot_path });
      await save();
    },
    async dueSoon(days) {
      const { from, until } = dueWindow(days);
      return s.proceedings.filter((p) => !p.gone_at && !p.handled_at && p.due_on && p.due_on >= from && p.due_on <= until).sort((a, b) => a.due_on.localeCompare(b.due_on));
    },
    async markEmailed(ids) { const now = new Date().toISOString(); for (const a of s.alerts) if (ids.includes(a.id)) a.emailed_at = now; await save(); },
    async finishRun(runId, stats) { Object.assign(s.runs.find((r) => r.id === runId), stats, { finished_at: new Date().toISOString() }); await save(); },
  };
}
