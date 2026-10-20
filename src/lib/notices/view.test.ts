import { describe, expect, it } from 'vitest';
import type { ItdAccountRow, ItdAlertRow, ItdProceedingRow, ItdRunRow } from '@/lib/supabase/types';
import { buildNoticesView, dueWords, noticeFacts } from './view';

const TODAY = '2026-10-20';
const NOW = Date.parse('2026-10-20T09:00:00+05:30');

const account = (pan: string, over: Partial<ItdAccountRow> = {}): ItdAccountRow => ({
  pan, name: null, notify: [], status: 'ok', message: null, last_checked_at: null, last_ok_at: null, first_ok_at: null,
  action_count: null, information_count: null, in_sheet: true, updated_at: '2026-10-20T03:00:00Z', ...over,
});
const proc = (key: string, pan: string, over: Partial<ItdProceedingRow> = {}): ItdProceedingRow => ({
  key, pan, tab: 'action', name: 'Issue Letter', ay: '2015-16', fy: '2014-15', act: null, assessee: null,
  dates: [{ date: '2026-06-05', status: 'Open' }], notice_count: 1, marked_new: false, due_on: null, notice_text: null,
  first_seen_at: '2026-10-01T03:00:00Z', last_seen_at: '2026-10-20T03:00:00Z', last_change_at: null, gone_at: null,
  handled_at: null, handled_by: null, handled_note: null, ...over,
});
const alert = (key: string, at: string): ItdAlertRow => ({ id: 1, run_id: 1, pan: 'ABCDE1234F', proceeding_key: key, kind: 'more-notices', detail: 'went from 1 to 2', at, emailed_at: at });
const run = (finished: string | null, status: ItdRunRow['status'] = 'done'): ItdRunRow => ({
  id: 1, started_at: finished ?? '2026-10-20T01:30:00Z', finished_at: finished, host: null, accounts: 2, ok: 2, failed: 0, alerts: 0, emailed: false, status, note: null,
});

describe('buildNoticesView', () => {
  const base = {
    accounts: [account('ABCDE1234F', { name: 'Sharma' }), account('FGHIJ5678K', { status: 'otp' }), account('KLMNO9012P', { status: 'bad-password', in_sheet: false })],
    documents: [],
    runs: [run('2026-10-20T01:45:00Z')],
    today: TODAY,
    now: NOW,
  };

  it('puts what is new or due first, and leaves out what is handled or gone', () => {
    const v = buildNoticesView({
      ...base,
      proceedings: [
        proc('a', 'ABCDE1234F', { due_on: '2026-10-25' }),
        proc('b', 'ABCDE1234F'),
        proc('c', 'ABCDE1234F', { due_on: '2026-10-22', handled_at: '2026-10-19T10:00:00Z' }),
        proc('d', 'ABCDE1234F', { gone_at: '2026-10-19T03:00:00Z', due_on: '2026-10-21' }),
        proc('e', 'FGHIJ5678K', { due_on: '2026-10-21', tab: 'information' }),
        proc('f', 'FGHIJ5678K', { due_on: '2026-08-01' }),
      ],
      alerts: [alert('b', '2026-10-19T03:00:00Z'), alert('a', '2026-09-01T03:00:00Z')],
    });
    expect(v.attention.map((i) => i.key)).toEqual(['e', 'a', 'b']);
    expect(v.attention[1]!.dueIn).toBe(5);
    expect(v.attention[2]!.fresh?.detail).toBe('went from 1 to 2');
    expect(v.tiles).toEqual({ fresh: 1, due: 2, notChecked: 1, forAction: 3 });
  });

  it('names a client by the sheet, or by the end of the PAN', () => {
    const v = buildNoticesView({ ...base, proceedings: [proc('e', 'FGHIJ5678K')], alerts: [] });
    expect(v.clients.map((c) => c.name)).toEqual(['PAN ending 678K', 'Sharma', 'PAN ending 012P']);
    expect(v.clients[0]!.items[0]!.client).toBe('PAN ending 678K');
  });

  it('counts only accounts still in the sheet as not checked', () => {
    const v = buildNoticesView({ ...base, proceedings: [], alerts: [] });
    expect(v.failing.map((c) => c.pan)).toEqual(['FGHIJ5678K']);
  });

  it('says when the morning check has stopped', () => {
    const p = { ...base, proceedings: [], alerts: [] };
    expect(buildNoticesView(p).stale).toBe(false);
    expect(buildNoticesView({ ...p, runs: [run('2026-10-18T01:45:00Z')] }).stale).toBe(true);
    expect(buildNoticesView({ ...p, runs: [run(null, 'crashed')] }).stale).toBe(true);
    expect(buildNoticesView({ ...p, runs: [] }).stale).toBe(true);
  });

  it('lists action before information, newest entry first', () => {
    const v = buildNoticesView({
      ...base,
      alerts: [],
      proceedings: [
        proc('x', 'ABCDE1234F', { tab: 'information', dates: [{ date: '2026-10-01', status: 'Open' }] }),
        proc('y', 'ABCDE1234F', { dates: [{ date: '2026-01-01', status: 'Open' }] }),
        proc('z', 'ABCDE1234F', { dates: [{ date: '2026-03-01', status: 'Open' }, { date: '2026-09-01', status: 'Open' }] }),
      ],
    });
    const sharma = v.clients.find((c) => c.pan === 'ABCDE1234F')!;
    expect(sharma.items.map((i) => i.key)).toEqual(['z', 'y', 'x']);
    expect(sharma.items[0]!.latest?.date).toBe('2026-09-01');
  });
});

describe('dueWords', () => {
  it('reads naturally either side of today', () => {
    expect([dueWords(0), dueWords(1), dueWords(4), dueWords(-1), dueWords(-3)]).toEqual(['Due today', 'Due tomorrow', 'Due in 4 days', 'Due 1 day ago', 'Due 3 days ago']);
  });
});

describe('noticeFacts', () => {
  it('reads DINs and sections once each, and nothing from no text', () => {
    const text = 'Notice u/s 142(1) DIN: ITBA/AST/S/142(1)/2026-27/1081234567(1)\nRef ITBA/AST/S/142(1)/2026-27/1081234567(1) under section 143(2) and u/s 143(1)(a)';
    expect(noticeFacts(text)).toEqual({ dins: ['ITBA/AST/S/142(1)/2026-27/1081234567(1)'], sections: ['142(1)', '143(2)', '143(1)(a)'] });
    expect(noticeFacts(null)).toEqual({ dins: [], sections: [] });
  });
});
