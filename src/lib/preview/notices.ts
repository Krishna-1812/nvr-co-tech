/**
 * Tax notices (0037) for preview mode.
 *
 * Seeded rather than empty, like the Valuation Desk registry: these rows come
 * from the morning check on a server, so nothing a preview reader does could
 * fill them. Every client, PAN and reference here is invented; dates are set
 * relative to today so the page always shows something new, something due
 * and an account that could not be read.
 */

const DAY = 86_400_000;
const at = (days: number, hour = 7) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10) + `T0${hour}:00:00+05:30`;
const day = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
const iso = (s: string) => new Date(s).toISOString();

export function noticeFixtures() {
  const accounts = [
    { pan: 'AAAPZ1111A', name: 'Sample Traders LLP', status: 'ok', ok: true },
    { pan: 'BBBPY2222B', name: 'R. Sample (HUF)', status: 'ok', ok: true },
    { pan: 'CCCPX3333C', name: 'Example Exports', status: 'otp', ok: false },
  ].map((a) => ({
    pan: a.pan,
    name: a.name,
    notify: [],
    status: a.status,
    message: a.ok ? null : 'This account needs an OTP to log in, so it cannot be checked unattended',
    last_checked_at: iso(at(0)),
    last_ok_at: a.ok ? iso(at(0)) : iso(at(-9)),
    first_ok_at: iso(at(-30)),
    action_count: null,
    information_count: null,
    in_sheet: true,
    updated_at: iso(at(0)),
  }));

  const proc = (key: string, pan: string, over: Record<string, unknown>) => ({
    key, pan, tab: 'action', act: 'Income Tax Act 1961', assessee: null, marked_new: false, due_on: null, notice_text: null,
    first_seen_at: iso(at(-30)), last_seen_at: iso(at(0)), last_change_at: null, gone_at: null, handled_at: null, handled_by: null, handled_note: null,
    ...over,
  });
  const proceedings = [
    proc('pv-1', 'AAAPZ1111A', { name: 'Issue Letter', ay: '2024-25', fy: '2023-24', notice_count: 2, due_on: day(4), last_change_at: iso(at(-1)), dates: [{ date: day(-1), status: 'Open' }, { date: day(-60), status: 'Open' }] }),
    proc('pv-2', 'AAAPZ1111A', { name: 'Faceless Assessment', ay: '2023-24', fy: '2022-23', notice_count: 3, due_on: day(19), dates: [{ date: day(-20), status: 'Open' }] }),
    proc('pv-3', 'AAAPZ1111A', { tab: 'information', name: 'Intimation u/s 143(1)', ay: '2025-26', fy: '2024-25', notice_count: 1, dates: [{ date: day(-70), status: 'Closed' }] }),
    proc('pv-4', 'BBBPY2222B', { name: 'Adjustment u/s 143(1)(a)', ay: '2025-26', fy: '2024-25', notice_count: 1, due_on: day(1), marked_new: true, dates: [{ date: day(-29), status: 'Open' }] }),
    proc('pv-5', 'BBBPY2222B', { tab: 'information', name: 'Issue Letter', ay: 'Not Available', fy: 'Not Available', notice_count: 1, due_on: day(-40), handled_at: iso(at(-35, 5)), handled_by: 'team@thefinanceintelligence.com', handled_note: 'Replied on the portal', dates: [{ date: day(-50), status: 'Open' }] }),
    proc('pv-6', 'CCCPX3333C', { name: 'Issue Letter', ay: '2022-23', fy: '2021-22', notice_count: 1, dates: [{ date: day(-120), status: 'Open' }] }),
  ];

  const documents = [
    { id: 1, proceeding_key: 'pv-1', pan: 'AAAPZ1111A', label: 'Notice u/s 142(1)', file_name: 'notice-142-1.pdf', storage_path: 'preview/pv-1/a.pdf', size_bytes: 120_000, sha256: 'a', first_seen_at: iso(at(-1)) },
    { id: 2, proceeding_key: 'pv-1', pan: 'AAAPZ1111A', label: 'Notice u/s 148', file_name: 'notice-148.pdf', storage_path: 'preview/pv-1/b.pdf', size_bytes: 98_000, sha256: 'b', first_seen_at: iso(at(-30)) },
    { id: 3, proceeding_key: 'pv-4', pan: 'BBBPY2222B', label: 'Intimation of adjustment', file_name: 'adjustment.pdf', storage_path: 'preview/pv-4/c.pdf', size_bytes: 64_000, sha256: 'c', first_seen_at: iso(at(-29)) },
  ];

  const alerts = [
    { id: 1, run_id: 2, pan: 'AAAPZ1111A', proceeding_key: 'pv-1', kind: 'more-notices', detail: 'Issue Letter, AY 2024-25: notices went from 1 to 2', at: iso(at(-1)), emailed_at: iso(at(-1)) },
  ];

  const run = (id: number, days: number, over: Record<string, unknown> = {}) => ({
    id, started_at: iso(at(days)), finished_at: new Date(Date.parse(at(days)) + 6 * 60_000).toISOString(), host: 'preview', accounts: 3, ok: 2, failed: 1, alerts: 0, emailed: true, status: 'done', note: null, ...over,
  });
  const runs = [run(3, 0), run(2, -1, { alerts: 1 }), run(1, -2, { emailed: false })];

  return { accounts, proceedings, documents, alerts, runs, checks: [] as Record<string, unknown>[] };
}
