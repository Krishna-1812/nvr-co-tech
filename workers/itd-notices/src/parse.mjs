// Reading the e-Filing portal's pages, and deciding what is new.
//
// Everything here is pure: text in, records out, so it is tested without a
// browser (test/parse.test.mjs). The portal is read as the text a person sees
// (`innerText`), not by its HTML structure, because the wording on screen
// ("Proceeding Name :", "View Notices/Orders (2)") changes far less often than
// the markup underneath it, and when it does change the failure is loud: no
// proceedings found where there were some yesterday.

import { createHash } from 'node:crypto';

export const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;
const DATE_RE = /\b(\d{1,2})-([A-Za-z]{3})-(\d{4})\b/;
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** "5-Jun-2026" → "2026-06-05"; anything else → null. */
export function isoDate(s) {
  const m = String(s ?? '').match(DATE_RE);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** "2026-10-19" → "19 Oct 2026", for people. */
export function humanDate(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso ?? '');
  const name = Object.keys(MONTHS)[Number(m[2]) - 1];
  return `${Number(m[3])} ${name[0].toUpperCase()}${name.slice(1)} ${m[1]}`;
}

/** Hide a PAN except its last four characters, for logs and emails. */
export function maskPan(s) {
  return String(s ?? '').replace(PAN_RE, (p) => `XXXXXX${p.slice(6)}`);
}

const field = (block, label) => {
  const m = block.match(new RegExp(`${label}\\s*:\\s*([^\\n]+)`, 'i'));
  return m ? m[1].trim() : null;
};

/**
 * The tab counts at the top of e-Proceedings: "For your Action (3)",
 * "For your Information (6)". Null for a tab the page does not show.
 */
export function readTabCounts(text) {
  const n = (label) => {
    const m = text.match(new RegExp(`${label}\\s*\\((\\d+)\\)`, 'i'));
    return m ? Number(m[1]) : null;
  };
  return { action: n('For your Action'), information: n('For your Information') };
}

/**
 * One record per proceeding card on the page, in the order shown.
 *
 * A card reads, top to bottom: "Proceeding Name : Issue Letter" (with a "New"
 * badge sometimes), "Assessment Year : 2015-16", PAN, Name of Assessee, a
 * column of dates each with a status ("5-Jun-2026 / Open"), "Financial Year",
 * "Applicable Act", and "View Notices/Orders (2)".
 */
export function parseProceedings(text) {
  const blocks = String(text ?? '').split(/Proceeding Name\s*:/i).slice(1);
  return blocks.map((raw) => {
    const block = raw.split(/\n\s*(?:Showing|Page)\s+\d+/i)[0];
    const head = block.split(/Assessment Year/i)[0].trim();
    const firstLine = head.split('\n')[0].trim();
    const markedNew = /\bNew\b\s*$/.test(firstLine) || /^\s*New\s*$/m.test(head.split('\n').slice(1).join('\n'));
    const name = firstLine.replace(/\s*\bNew\b\s*$/, '').trim();

    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const dates = [];
    for (let i = 0; i < lines.length; i++) {
      // A date on a line of its own (not "Assessment Year : …" or similar),
      // with its status on the same line or the next one.
      if (/:/.test(lines[i])) continue;
      const d = isoDate(lines[i]);
      if (!d) continue;
      let status = lines[i].replace(DATE_RE, '').trim();
      if (!status && lines[i + 1] && !isoDate(lines[i + 1]) && !/:/.test(lines[i + 1]) && lines[i + 1].length <= 30) status = lines[i + 1];
      dates.push({ date: d, status: status || null });
    }

    const pan = (block.match(/\bPAN\b\s*:?\s*\n?\s*([A-Z]{5}[0-9]{4}[A-Z])/) || [])[1] ?? null;
    const assessee = (block.match(/Name of Assessee\s*:?\s*\n?\s*([^\n]+)/i) || [])[1]?.trim() ?? null;
    const count = block.match(/View Notices\/Orders\s*\((\d+)\)/i);

    return {
      name,
      ay: field(block, 'Assessment Year'),
      fy: field(block, 'Financial Year'),
      act: field(block, 'Applicable Act'),
      pan,
      assessee,
      dates,
      noticeCount: count ? Number(count[1]) : null,
      markedNew,
    };
  });
}

/**
 * What a notices view says, as far as it can be read without knowing its
 * layout: the reference numbers (DIN), the dates, any response due date and
 * the sections quoted. Kept loose on purpose; the page text itself is stored
 * beside it so nothing is lost when this misses.
 */
export function parseNoticeText(text) {
  const t = String(text ?? '');
  const dins = [...new Set(t.match(/\b(?:ITBA|CPC|ITD)\/[A-Z0-9/().-]{8,}/g) ?? [])];
  const due = [];
  const dueRe = /(?:response\s*due|due\s*date|date\s*of\s*compliance|last\s*date|respond\s*by|compliance\s*date)[^\d\n]{0,40}(\d{1,2}-[A-Za-z]{3}-\d{4})/gi;
  for (let m; (m = dueRe.exec(t)); ) {
    const d = isoDate(m[1]);
    if (d) due.push(d);
  }
  const sections = [...new Set([...t.matchAll(/(?:u\/s|under section|section)\s*([0-9]{2,3}[A-Z]{0,3}(?:\(\d+[A-Za-z]?\))*)/gi)].map((m) => m[1]))];
  return { dins, dueDates: [...new Set(due)].sort(), sections };
}

/** A stable identity for a proceeding: the account plus what does not change. */
export function proceedingKey(pan, p) {
  const first = [...p.dates.map((d) => d.date)].sort()[0] ?? '';
  return createHash('sha256').update([pan, p.name, p.ay ?? '', p.fy ?? '', first].join('|')).digest('hex').slice(0, 24);
}

/**
 * Compare today's proceedings for one account with what was stored.
 *
 * `previous` is what the store holds for this account and has not marked
 * gone. `baseline` is true until the account has been read once: the first
 * read records everything and raises nothing, so adding a client with ten old
 * proceedings does not announce ten "new notices".
 *
 * Returns the rows to keep (with their keys), the alerts to raise, and the
 * keys of stored proceedings no longer on the portal.
 */
export function diffProceedings(pan, current, previous, { baseline = false, now = new Date().toISOString() } = {}) {
  const prevByKey = new Map(previous.map((p) => [p.key, p]));
  const seen = new Map();
  const rows = [];
  const alerts = [];

  for (const p of current) {
    let key = proceedingKey(pan, p);
    // Two cards that look identical in everything stable (it happens with
    // "Assessment Year : Not Available") are told apart by their order.
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n > 1) key = `${key}-${n}`;

    const before = prevByKey.get(key);
    const row = { ...p, key, pan };
    rows.push(row);
    if (baseline) continue;

    const where = `${p.name}${p.ay && !/not available/i.test(p.ay) ? `, AY ${p.ay}` : ''}`;
    if (!before) {
      alerts.push({ key, pan, kind: 'new-proceeding', detail: `New proceeding: ${where}${p.noticeCount ? ` (${p.noticeCount} notice${p.noticeCount === 1 ? '' : 's'})` : ''}`, at: now });
      continue;
    }
    const oldDates = new Set((before.dates ?? []).map((d) => d.date));
    const newDates = p.dates.filter((d) => !oldDates.has(d.date)).map((d) => humanDate(d.date));
    const more = p.noticeCount != null && before.notice_count != null && p.noticeCount > before.notice_count;
    if (more) {
      alerts.push({ key, pan, kind: 'more-notices', detail: `${where}: notices went from ${before.notice_count} to ${p.noticeCount}${newDates.length ? `, dated ${newDates.join(', ')}` : ''}`, at: now });
    } else if (newDates.length) {
      alerts.push({ key, pan, kind: 'new-date', detail: `${where}: new entry dated ${newDates.join(', ')}`, at: now });
    }
  }

  const keys = new Set(rows.map((r) => r.key));
  const gone = previous.filter((p) => !keys.has(p.key)).map((p) => p.key);
  return { rows, alerts, gone };
}
