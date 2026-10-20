import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffProceedings, isoDate, maskPan, parseNoticeText, parseProceedings, proceedingKey, readTabCounts } from '../src/parse.mjs';
import { parseCsv, rowsToAccounts } from '../src/sheet.mjs';

// The e-Proceedings page as innerText gives it, laid out like the owner's
// screenshot of 20 Oct 2026 (sample PAN and name, not a real person's).
const PAGE = `e-Proceeding
View e-Proceeding related to:
Self
Of Other PAN/TAN
For your Action (2)
For your Information (6)
Filter
Excel Download
Proceeding Name : Issue Letter
Assessment Year : 2015-16
PAN
ABCDE1234F
Name of Assessee
SAMPLE PERSON NAME
5-Jun-2026
Open
22-Jan-2026
Open
Financial Year : 2014-15
Applicable Act : Income Tax Act 1961
View Notices/Orders (2)
+ Add / View Authorised Representative
Proceeding Name : Issue Letter New
Assessment Year : Not Available
PAN
ABCDE1234F
Name of Assessee
SAMPLE PERSON NAME
11-Sep-2025
Open
Financial Year : Not Available
Applicable Act : Income Tax Act 1961
View Notices/Orders (1)
+ Add / View Authorised Representative
Feedback |Website Policies
Last reviewed and updated on : 20-Oct-2026`;

test('dates read as the portal writes them', () => {
  assert.equal(isoDate('5-Jun-2026'), '2026-06-05');
  assert.equal(isoDate('22-jan-2026 Open'), '2026-01-22');
  assert.equal(isoDate('Not Available'), null);
});

test('dates for people', async () => {
  const { humanDate } = await import('../src/parse.mjs');
  assert.equal(humanDate('2026-10-19'), '19 Oct 2026');
  assert.equal(humanDate('2026-06-05'), '5 Jun 2026');
});

test('a PAN shows only its last four characters', () => {
  assert.equal(maskPan('PAN ABCDE1234F and FGHIJ5678K'), 'PAN XXXXXX234F and XXXXXX678K');
});

test('tab counts', () => {
  assert.deepEqual(readTabCounts(PAGE), { action: 2, information: 6 });
  assert.deepEqual(readTabCounts('nothing here'), { action: null, information: null });
});

test('proceeding cards', () => {
  const [a, b] = parseProceedings(PAGE);
  assert.equal(parseProceedings(PAGE).length, 2);
  assert.deepEqual(
    { name: a.name, ay: a.ay, fy: a.fy, act: a.act, pan: a.pan, assessee: a.assessee, n: a.noticeCount, isNew: a.markedNew },
    { name: 'Issue Letter', ay: '2015-16', fy: '2014-15', act: 'Income Tax Act 1961', pan: 'ABCDE1234F', assessee: 'SAMPLE PERSON NAME', n: 2, isNew: false },
  );
  assert.deepEqual(a.dates, [{ date: '2026-06-05', status: 'Open' }, { date: '2026-01-22', status: 'Open' }]);
  assert.equal(b.name, 'Issue Letter');
  assert.equal(b.markedNew, true);
  assert.equal(b.ay, 'Not Available');
  assert.deepEqual(b.dates, [{ date: '2025-09-11', status: 'Open' }]);
  // The footer's "updated on : 20-Oct-2026" is not a proceeding date.
  assert.ok(!b.dates.some((d) => d.date === '2026-10-20'));
});

test('no cards, no proceedings', () => {
  assert.deepEqual(parseProceedings('For your Action (0)\nNo records found'), []);
});

test('a notices view: reference numbers, due dates, sections', () => {
  const t = 'ITBA/AST/S/143(2)/2026-27/1000000001(1)\tNotice u/s 143(2)\tIssued on 5-Jun-2026\tResponse Due Date 20-Jun-2026\nNotice under section 142(1) ... last date 2-Jul-2026';
  const r = parseNoticeText(t);
  assert.deepEqual(r.dins, ['ITBA/AST/S/143(2)/2026-27/1000000001(1)']);
  assert.deepEqual(r.dueDates, ['2026-06-20', '2026-07-02']);
  assert.ok(r.sections.includes('143(2)') && r.sections.includes('142(1)'));
});

test('keys stay the same when a notice is added, and differ between proceedings', () => {
  const [a, b] = parseProceedings(PAGE);
  const later = { ...a, noticeCount: 3, dates: [{ date: '2026-10-19', status: 'Open' }, ...a.dates] };
  assert.equal(proceedingKey('ABCDE1234F', a), proceedingKey('ABCDE1234F', later));
  assert.notEqual(proceedingKey('ABCDE1234F', a), proceedingKey('ABCDE1234F', b));
  assert.notEqual(proceedingKey('ABCDE1234F', a), proceedingKey('FGHIJ5678K', a));
});

test('first read records everything and raises nothing', () => {
  const { rows, alerts, gone } = diffProceedings('ABCDE1234F', parseProceedings(PAGE), [], { baseline: true });
  assert.equal(rows.length, 2);
  assert.deepEqual(alerts, []);
  assert.deepEqual(gone, []);
});

const stored = (rows) => rows.map((r) => ({ key: r.key, notice_count: r.noticeCount, dates: r.dates }));

test('a new notice on a known proceeding, and a new proceeding, are both raised', () => {
  const first = diffProceedings('ABCDE1234F', parseProceedings(PAGE), []).rows;
  const today = PAGE
    .replace('View Notices/Orders (2)', 'View Notices/Orders (3)')
    .replace('5-Jun-2026\nOpen', '19-Oct-2026\nOpen\n5-Jun-2026\nOpen')
    .replace('Feedback', 'Proceeding Name : Faceless Assessment\nAssessment Year : 2024-25\n1-Oct-2026\nOpen\nFinancial Year : 2023-24\nView Notices/Orders (1)\nFeedback');
  const { alerts, gone } = diffProceedings('ABCDE1234F', parseProceedings(today), stored(first));
  assert.deepEqual(alerts.map((a) => a.kind), ['more-notices', 'new-proceeding']);
  assert.match(alerts[0].detail, /Issue Letter, AY 2015-16: notices went from 2 to 3, dated 19 Oct 2026/);
  assert.match(alerts[1].detail, /New proceeding: Faceless Assessment, AY 2024-25 \(1 notice\)/);
  assert.deepEqual(gone, []);
});

test('a new date without a higher count is still raised; nothing changed raises nothing', () => {
  const first = diffProceedings('ABCDE1234F', parseProceedings(PAGE), []).rows;
  assert.deepEqual(diffProceedings('ABCDE1234F', parseProceedings(PAGE), stored(first)).alerts, []);
  const today = PAGE.replace('5-Jun-2026\nOpen', '19-Oct-2026\nOpen\n5-Jun-2026\nOpen');
  const { alerts } = diffProceedings('ABCDE1234F', parseProceedings(today), stored(first));
  assert.deepEqual(alerts.map((a) => a.kind), ['new-date']);
});

test('a proceeding no longer listed is reported gone', () => {
  const first = diffProceedings('ABCDE1234F', parseProceedings(PAGE), []).rows;
  const today = PAGE.split('Proceeding Name : Issue Letter New')[0];
  const { gone } = diffProceedings('ABCDE1234F', parseProceedings(today), stored(first));
  assert.deepEqual(gone, [first[1].key]);
});

test('two cards identical in everything stable still get their own keys', () => {
  const card = 'Proceeding Name : Issue Letter\nAssessment Year : Not Available\nFinancial Year : Not Available\nView Notices/Orders (1)\n';
  const { rows } = diffProceedings('ABCDE1234F', parseProceedings(card + card), []);
  assert.equal(new Set(rows.map((r) => r.key)).size, 2);
});

test('sheet: headings in any order, inactive and incomplete rows', () => {
  const rows = parseCsv('Client Name,PAN,Password,Notify,Active\n"Sharma, R",abcde1234f,pw1,"a@x.com; b@y.in",\nOld client,FGHIJ5678K,pw2,,No\nNo password,KLMNO9012P,,,\n,,,,\nTwice,ABCDE1234F,pw3,,yes\n');
  const { accounts, skipped } = rowsToAccounts(rows);
  assert.deepEqual(accounts, [{ userId: 'ABCDE1234F', password: 'pw1', name: 'Sharma, R', notify: ['a@x.com', 'b@y.in'] }]);
  assert.equal(skipped.length, 2);
  assert.match(skipped.join(' '), /row 4: missing password/);
  assert.match(skipped.join(' '), /listed twice/);
});

test('sheet: a missing Password column is a clear error', () => {
  assert.throws(() => rowsToAccounts([['PAN', 'Name'], ['ABCDE1234F', 'x']]), /Password/);
});
