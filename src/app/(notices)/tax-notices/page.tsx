import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { BellRing, CheckCircle2, CircleAlert, Clock, History, LogIn, Mail, ScrollText, Sheet, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { istToday } from '@/lib/fiscal';
import { buildNoticesView, STATUS_WORDS } from '@/lib/notices/view';
import type { ItdAccountRow, ItdAlertRow, ItdDocumentRow, ItdProceedingRow, ItdRunRow } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardTitle } from '@/components/ui/primitives';
import { HeroChip, HeroStat, ToolHero } from '@/components/ui/ToolHero';
import { ArchScene, SealFigure } from '@/components/ui/Scene';
import { ClientBook, NoticeList } from '@/components/admin/Notices';
import { ago, stamp } from '@/components/admin/when';

export const metadata: Metadata = { title: 'Tax Notice Watch' };

/**
 * Tax Notice Watch: what the morning check found in each client's e-Proceedings on
 * the Income Tax e-Filing portal (migration 0037, workers/itd-notices).
 *
 * The owner asked for this (20 Oct 2026) because notices that go unseen turn
 * into penalties. So the page opens on what needs a look (new in the last
 * fortnight, or a response due within a week) and on any account the check
 * could not get into, because a client nobody can see is the dangerous one.
 * Everything else is below, client by client.
 *
 * It began as a page of the Admin screen and moved to a tool of its own the
 * same day, at the owner's request, so it opens from the hub like the others.
 *
 * The files are in a private bucket; each link is a signed address that lasts
 * an hour, made for the admin reading the page.
 */

const tone = (v: string) => ({ '--tone': v }) as CSSProperties;
const DAY = 86_400_000;

export default async function NoticesPage() {
  const supabase = await createClient();
  const now = readClock();
  const since = new Date(now - 14 * DAY).toISOString();
  const [accounts, proceedings, documents, alerts, runs, shots] = await Promise.all([
    supabase.from('itd_accounts').select('*').order('name'),
    supabase.from('itd_proceedings').select('*').is('gone_at', null).limit(5000),
    supabase.from('itd_documents').select('*').order('first_seen_at', { ascending: false }).limit(5000),
    supabase.from('itd_alerts').select('*').gte('at', since).order('at', { ascending: false }).limit(1000),
    supabase.from('itd_runs').select('*').order('started_at', { ascending: false }).limit(10),
    supabase.from('itd_checks').select('pan, shot_path, at').not('shot_path', 'is', null).gte('at', new Date(now - 3 * DAY).toISOString()).order('at', { ascending: false }).limit(300),
  ]);

  if (accounts.error) {
    const missing = /itd_accounts|does not exist|PGRST205|42P01|schema cache/i.test(`${accounts.error.code} ${accounts.error.message}`);
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Header />
        <p style={tone('var(--status-warn)')} className="tinted rounded-2xl border px-4 py-3 text-sm">
          {missing
            ? 'This page needs migration 0037. Run it in the Supabase SQL editor, then set up the morning check (workers/itd-notices/README.md).'
            : `The notices could not be read: ${accounts.error.message}`}
        </p>
      </div>
    );
  }

  const view = buildNoticesView({
    accounts: (accounts.data ?? []) as ItdAccountRow[],
    proceedings: (proceedings.data ?? []) as ItdProceedingRow[],
    documents: (documents.data ?? []) as ItdDocumentRow[],
    alerts: (alerts.data ?? []) as ItdAlertRow[],
    runs: (runs.data ?? []) as ItdRunRow[],
    today: istToday(),
    now,
  });

  // One signed address per file and per failure screenshot shown, in one call.
  const shotBy = new Map<string, string>();
  for (const s of shots.data ?? []) if (s.shot_path && !shotBy.has(s.pan)) shotBy.set(s.pan, s.shot_path);
  const paths = [...new Set([...view.clients.flatMap((c) => c.items.flatMap((i) => i.docs.map((d) => d.path))), ...view.failing.map((f) => shotBy.get(f.pan)).filter((p): p is string => !!p)])];
  const urls: Record<string, string> = {};
  if (paths.length) {
    const signed = await supabase.storage.from('itd-notices').createSignedUrls(paths, 3600).catch(() => null);
    for (const s of signed?.data ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
  }

  const total = view.clients.filter((c) => c.inSheet).length;
  const last = view.lastRun;

  if (!total && !last) return <Waiting />;

  const lastAt = last ? (last.finished_at ?? last.started_at) : null;
  const look = view.attention.length;

  return (
    <div className="space-y-6">
      <ToolHero
        id="notices-hero"
        label={`Tax Notice Watch${lastAt ? ` · checked ${stamp(lastAt)}` : ''}`}
        pill={
          view.stale
            ? { text: 'Morning check not running', tone: 'var(--status-rejected)' }
            : { text: `${last?.ok ?? 0} of ${last?.accounts ?? 0} read ${lastAt ? ago(lastAt, now) : ''}`.trim(), tone: 'var(--status-approved)', live: true }
        }
        variant="figure"
        title={String(look)}
        sub={
          <>
            {look === 1 ? 'proceeding needs' : 'proceedings need'} a look: new in the last fortnight, or a response due within a week.{' '}
            <strong className="text-[var(--text-c)]">
              {total} client account{total === 1 ? '' : 's'}
            </strong>{' '}
            in the sheet, checked every morning.
          </>
        }
        glow="var(--h-rose)"
        scene={
          <ArchScene
            motif="sundial"
            className="h-full min-h-[18rem]"
            seal={<SealFigure value={view.tiles.due} note={view.tiles.due === 1 ? 'response due this week' : 'responses due this week'} />}
          />
        }
      >
        <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <HeroStat strong className="h-full" label="New this week" value={view.tiles.fresh} note="Proceedings with something new" />
          <HeroStat className="h-full" label="Due in 7 days" tone="var(--status-warn)" value={view.tiles.due} note="Responses not marked handled" />
          <HeroStat className="h-full" label="Not checked" tone="var(--status-rejected)" value={view.tiles.notChecked} note={`Of ${total} account${total === 1 ? '' : 's'} in the sheet`} />
          <HeroStat className="h-full" label="For your action" tone="var(--color-brand-500)" value={view.tiles.forAction} note="Open on the portal's action tab" />
        </div>
      </ToolHero>

      {view.stale && (
        <p role="status" style={tone('var(--status-rejected)')} className="tinted flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            The morning check has not finished a run {lastAt ? `since ${stamp(lastAt)}` : 'yet'}
            {last?.status === 'crashed' && last.note ? ` (it stopped with: ${last.note})` : ''}. Until it runs, nothing new is being found.
          </span>
        </p>
      )}

      <Card className="overflow-hidden">
        <CardTitle icon={<BellRing className="size-4" />} title="Needs a look" description="New in the last fortnight, or a response due within a week. Mark each one handled once it is dealt with." />
        <NoticeList items={view.attention} urls={urls} showClient empty="Nothing new or due. The morning check emails the team as soon as that changes." />
      </Card>

      {view.failing.length > 0 && (
        <Card className="overflow-hidden">
          <CardTitle icon={<CircleAlert className="size-4" />} title="Not checked" description="These accounts could not be read, so a new notice on them would be missed. Each needs someone to act." />
          <ul className="divide-y">
            {view.failing.map((c) => (
              <li key={c.pan} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="text-subtle font-mono text-[12px]">{c.pan}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <span style={tone('var(--status-rejected)')} className="tinted rounded-full border px-2.5 py-1 text-[12px] font-semibold">
                    {STATUS_WORDS[c.status ?? 'error'] ?? c.message ?? 'Not checked'}
                  </span>
                  <span className="text-subtle text-[12px]">{c.lastOk ? `last read ${ago(c.lastOk, now)}` : 'never read'}</span>
                  {shotBy.get(c.pan) && urls[shotBy.get(c.pan)!] && (
                    <a href={urls[shotBy.get(c.pan)!]} target="_blank" rel="noreferrer" className="text-[12px] font-semibold underline underline-offset-2">
                      What the portal showed
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardTitle icon={<Users className="size-4" />} title="Every client" description="All proceedings on each account, action tab first, newest first. Files open from the private store." />
        <ClientBook clients={view.clients} urls={urls} now={now} />
      </Card>

      {(runs.data ?? []).length > 0 && (
        <Card className="overflow-hidden">
          <CardTitle icon={<History className="size-4" />} title="Recent checks" description="Each morning's run: how many accounts were read, what was new, and whether the team was emailed." />
          <ul className="divide-y sm:hidden">
            {((runs.data ?? []) as ItdRunRow[]).map((r) => (
              <li key={r.id} className="space-y-1.5 px-5 py-3">
                <p className="flex items-baseline justify-between gap-3 text-[13.5px]">
                  <span className="font-semibold">{stamp(r.started_at)}</span>
                  <span className="text-muted text-[12px]">{took(r)}</span>
                </p>
                <p className="text-muted flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] tabular-nums">
                  <span>{r.ok} read</span>
                  <span className={cn(r.failed && 'font-semibold text-[var(--text-c)]')}>{r.failed} not checked</span>
                  <span className={cn(r.alerts && 'font-semibold text-[var(--text-c)]')}>{r.alerts} new</span>
                  <span>{emailWords(r)}</span>
                </p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[36rem] text-left text-[13px]">
              <thead className="surface-sunken">
                <tr className="a-label">
                  <th className="px-5 py-2.5 font-medium sm:px-6">Started</th>
                  <th className="px-3 py-2.5 font-medium">Took</th>
                  <th className="px-3 py-2.5 text-right font-medium">Read</th>
                  <th className="px-3 py-2.5 text-right font-medium">Not checked</th>
                  <th className="px-3 py-2.5 text-right font-medium">New</th>
                  <th className="px-5 py-2.5 font-medium sm:px-6">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {((runs.data ?? []) as ItdRunRow[]).map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-2.5 whitespace-nowrap sm:px-6">{stamp(r.started_at)}</td>
                    <td className="text-muted px-3 py-2.5 whitespace-nowrap">
                      {took(r)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.ok}</td>
                    <td className={cn('px-3 py-2.5 text-right tabular-nums', r.failed && 'font-semibold')}>{r.failed}</td>
                    <td className={cn('px-3 py-2.5 text-right tabular-nums', r.alerts && 'font-semibold')}>{r.alerts}</td>
                    <td className="text-muted px-5 py-2.5 sm:px-6">{emailWords(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * Before the first morning check: the arch and the promise, then the four
 * things the check does, so the page is worth opening on day one. Every state
 * shown is one the page knows (the tables answered, no run has been recorded);
 * nothing here pretends the check has run.
 */
function Waiting() {
  const steps = [
    { icon: Sheet, title: 'Reads the sheet', body: 'The accounts to check come from the firm’s Google Sheet: login, password, client name and who to tell.' },
    { icon: LogIn, title: 'Logs in, one by one', body: 'Each account is opened on the e-Filing portal in turn. An OTP or CAPTCHA is reported, never forced.' },
    { icon: ScrollText, title: 'Reads e-Proceedings', body: 'Both tabs of Pending Actions → e-Proceedings. New notices are opened and their files kept.' },
    { icon: Mail, title: 'Tells the team', body: 'An email the morning a notice arrives, with the files and the response date, and the list here.' },
  ];
  return (
    <div className="space-y-6">
      <ToolHero
        id="notices-hero"
        label="Tax Notice Watch"
        pill={{ text: 'Waiting for the first morning check', tone: 'var(--status-warn)' }}
        title="Every client’s notices, read each morning"
        mark="each morning"
        sub="Once the morning check runs, each client appears here with their proceedings, the notice files and when a response is due. What needs a look comes first."
        glow="var(--h-rose)"
        scene={<ArchScene motif="sundial" className="h-full min-h-[18rem]" />}
      >
        <div className="mt-6 flex flex-wrap gap-2">
          <HeroChip icon={CheckCircle2}>Database ready</HeroChip>
          <HeroChip icon={Clock}>No check has run yet</HeroChip>
        </div>
      </ToolHero>

      <Card className="overflow-hidden">
        <CardTitle icon={<ScrollText className="size-4" />} title="What the morning check does" description="Unattended, every morning, for every account in the sheet." />
        <ol className="grid gap-px border-t bg-[var(--border-c)] sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="bg-[var(--surface-raised)] px-5 py-5 sm:px-6">
              <span style={tone('var(--h-rose)')} className="tinted inline-grid size-9 place-items-center rounded-xl border">
                <s.icon className="size-4" aria-hidden />
              </span>
              <p className="text-subtle mt-3 text-[11.5px] font-semibold tracking-wide uppercase tabular-nums">Step {i + 1}</p>
              <p className="mt-0.5 font-semibold">{s.title}</p>
              <p className="text-muted mt-1 text-[13px] leading-relaxed text-pretty">{s.body}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function Header() {
  return (
    <PageHeader
      eyebrow="Tax Notice Watch"
      title="Tax notices"
      description="What the morning check finds in each client's e-Proceedings on the Income Tax portal: new notices, what is due, and the files."
    />
  );
}

function took(r: ItdRunRow) {
  if (r.status === 'running') return 'Running';
  if (r.status === 'crashed') return 'Stopped';
  if (!r.finished_at) return '—';
  const m = Math.round((Date.parse(r.finished_at) - Date.parse(r.started_at)) / 60_000);
  return m < 1 ? 'under a minute' : `${m} min`;
}

function emailWords(r: ItdRunRow) {
  return r.emailed ? 'Email sent' : r.status === 'done' ? 'Nothing to email' : '—';
}

function readClock(): number {
  return Date.now();
}

