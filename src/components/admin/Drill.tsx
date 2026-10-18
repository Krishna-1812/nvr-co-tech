'use client';

import { createContext, useContext, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronRight, Hand, KeyRound, Laptop, Mail, MonitorSmartphone, Smartphone, Tablet, UserRound } from 'lucide-react';
import type { Person, Report, Request } from '@/lib/analytics/report';
import { duration, istDay } from '@/lib/analytics/report';
import type { AdminAccountRow } from '@/lib/supabase/types';
import { isAdminEmail } from '@/lib/access';
import { cn } from '@/lib/utils';
import { CenterPanel } from '@/components/ui/Drawer';
import { PersonDetail, initials, provider } from './PersonDetail';
import { ago, stamp } from './when';

/**
 * Every card on the Admin screen opens to what is behind it.
 *
 * A figure opens to the people it counts, a bar to the people of that day, a
 * row in a list to the people it lists, a request to the request and the
 * person, an account to its sign-ins and activity. Every person shown opens
 * to their own record, and Back walks up the same path. All of it is worked
 * out here from the report the page already read, so opening a card costs no
 * request.
 */

export type Focus =
  | { t: 'people'; which: 'all' | 'account' | 'visitor' | 'returning' | 'live' }
  | { t: 'time' }
  | { t: 'views' }
  | { t: 'requests' }
  | { t: 'accounts'; which: 'all' | 'new' }
  | { t: 'day'; day: string }
  | { t: 'page'; path: string }
  | { t: 'source'; label: string }
  | { t: 'country'; label: string }
  | { t: 'device'; label: string }
  | { t: 'breakdown'; by: 'source' | 'country' | 'device' }
  | { t: 'person'; key: string }
  | { t: 'request'; id: string }
  | { t: 'account'; id: string };

type Ctx = { open: (f: Focus) => void };
const DrillContext = createContext<Ctx>({ open: () => {} });
export const useDrill = () => useContext(DrillContext);

export function DrillProvider({
  report,
  accounts,
  since,
  now,
  children,
}: {
  report: Report;
  accounts: AdminAccountRow[];
  since: string | null;
  now: number;
  children: ReactNode;
}) {
  const [stack, setStack] = useState<Focus[]>([]);
  const ctx = useMemo(() => ({ open: (f: Focus) => setStack([f]) }), []);
  const top = stack.at(-1) ?? null;
  const go = (f: Focus) => setStack((s) => [...s, f]);
  const back = () => setStack((s) => s.slice(0, -1));

  const view = top ? render(top, { report, accounts, since, now, go }) : null;

  return (
    <DrillContext.Provider value={ctx}>
      {children}
      <CenterPanel
        open={!!top}
        onClose={() => setStack([])}
        size="lg"
        title={view?.title ?? ''}
        header={
          view ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {stack.length > 1 && (
                <button
                  type="button"
                  onClick={back}
                  className="surface-sunken inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition hover:text-[var(--text-c)]"
                >
                  <ArrowLeft className="size-3.5" aria-hidden /> Back
                </button>
              )}
              {view.chips.map((c) => (
                <span key={c} className="surface-sunken text-muted rounded-full border px-2.5 py-1 text-[12px]">
                  {c}
                </span>
              ))}
            </div>
          ) : null
        }
      >
        {view && <div key={stack.length} className="animate-[rise_0.35s_cubic-bezier(0.22,1,0.36,1)_backwards]">{view.body}</div>}
      </CenterPanel>
    </DrillContext.Provider>
  );
}

/** Wraps a card so the whole of it opens its details. */
export function Drill({ focus, label, className, children }: { focus: Focus; label: string; className?: string; children: ReactNode }) {
  const { open } = useDrill();
  return (
    <button
      type="button"
      onClick={() => open(focus)}
      aria-label={label}
      title={label}
      className={cn(
        'group/drill relative block w-full min-w-0 cursor-pointer text-left transition duration-200',
        'hover:-translate-y-0.5 hover:brightness-[1.03] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] focus-visible:outline-none',
        className,
      )}
    >
      {children}
      <ArrowUpRight
        aria-hidden
        className="pointer-events-none absolute top-2.5 right-2.5 size-3.5 opacity-0 transition duration-200 group-hover/drill:opacity-60 group-focus-visible/drill:opacity-60"
      />
    </button>
  );
}

// ── What each focus shows ───────────────────────────────────────────────────

type Env = { report: Report; accounts: AdminAccountRow[]; since: string | null; now: number; go: (f: Focus) => void };
type View = { title: string; chips: string[]; body: ReactNode };

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;

function render(f: Focus, env: Env): View {
  const { report, go, now } = env;
  const people = report.people;
  const sum = (list: Person[]) => list.reduce((t, p) => t + p.seconds, 0);
  const crowd = (list: Person[], title: string, metric: (p: Person) => ReactNode = (p) => duration(p.seconds), extra: string[] = []): View => ({
    title,
    chips: [plural(list.length, 'person', 'people'), `${duration(sum(list))} in all`, ...extra],
    body: <PeopleList people={list} metric={metric} now={now} onOpen={(k) => go({ t: 'person', key: k })} />,
  });

  switch (f.t) {
    case 'people': {
      const list =
        f.which === 'all'
          ? people
          : f.which === 'live'
            ? people.filter((p) => now - Date.parse(p.lastSeen) < 5 * 60_000)
            : f.which === 'returning'
              ? people.filter((p) => p.returning)
              : people.filter((p) => p.kind === f.which);
      const title = { all: 'Everybody who came', live: 'Here now', returning: 'People who came back', account: 'Signed-in people', visitor: 'People without an account' }[f.which];
      return crowd(list, title, (p) => (f.which === 'returning' ? plural(p.visits, 'visit') : duration(p.seconds)));
    }
    case 'time': {
      const list = [...people].sort((a, b) => b.seconds - a.seconds);
      const max = Math.max(1, ...list.map((p) => p.seconds));
      return crowd(list, 'Time spent, person by person', (p) => <Meter value={p.seconds} max={max} label={duration(p.seconds)} />, [
        `${duration(list.length ? Math.round(sum(list) / list.length) : 0)} each on average`,
      ]);
    }
    case 'views': {
      const pages = new Map<string, { views: number; seconds: number; people: Set<string> }>();
      for (const p of people) for (const j of p.journey) {
        const c = pages.get(j.path) ?? { views: 0, seconds: 0, people: new Set() };
        c.views += 1;
        c.seconds += j.seconds;
        c.people.add(p.key);
        pages.set(j.path, c);
      }
      const list = [...pages.entries()].sort((a, b) => b[1].views - a[1].views || b[1].seconds - a[1].seconds);
      const max = Math.max(1, ...list.map(([, c]) => c.views));
      return {
        title: 'Every page opened',
        chips: [plural(report.totals.views, 'page view'), plural(list.length, 'different page')],
        body: (
          <ul className="space-y-1.5">
            {list.map(([path, c]) => (
              <li key={path}>
                <Row onClick={() => go({ t: 'page', path })}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{path}</span>
                    <span className="text-subtle block text-[12px]">
                      {plural(c.people.size, 'person', 'people')} · {duration(c.seconds)} in all
                    </span>
                  </span>
                  <Meter value={c.views} max={max} label={plural(c.views, 'view')} />
                </Row>
              </li>
            ))}
          </ul>
        ),
      };
    }
    case 'day': {
      const list: Person[] = [];
      const time = new Map<string, number>();
      for (const p of people) {
        const that = p.journey.filter((j) => istDay(j.at) === f.day);
        if (that.length) {
          list.push(p);
          time.set(p.key, that.reduce((t, j) => t + j.seconds, 0));
        }
      }
      const label = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${f.day}T00:00:00Z`));
      return {
        title: label,
        chips: [plural(list.length, 'person', 'people'), `${list.filter((p) => p.kind === 'account').length} signed in`, `${duration([...time.values()].reduce((a, b) => a + b, 0))} that day`],
        body: list.length ? (
          <PeopleList people={list} metric={(p) => duration(time.get(p.key) ?? 0)} now={now} onOpen={(k) => go({ t: 'person', key: k })} />
        ) : (
          <Empty>Nobody came that day.</Empty>
        ),
      };
    }
    case 'page': {
      const list = people.filter((p) => p.journey.some((j) => j.path === f.path));
      const on = (p: Person) => p.journey.filter((j) => j.path === f.path);
      const views = list.reduce((t, p) => t + on(p).length, 0);
      const secs = list.reduce((t, p) => t + on(p).reduce((s, j) => s + j.seconds, 0), 0);
      const title = list.flatMap(on).find((j) => j.title)?.title;
      return {
        title: f.path,
        chips: [plural(list.length, 'person', 'people'), plural(views, 'view'), `${duration(secs)} on this page`, ...(title ? [title] : [])],
        body: (
          <PeopleList
            people={list}
            metric={(p) => `${plural(on(p).length, 'view')} · ${duration(on(p).reduce((s, j) => s + j.seconds, 0))}`}
            now={now}
            onOpen={(k) => go({ t: 'person', key: k })}
          />
        ),
      };
    }
    case 'source':
      return crowd(people.filter((p) => p.source === f.label), `Came from ${f.label}`);
    case 'country':
      return crowd(people.filter((p) => (p.country ?? 'Unknown') === f.label), f.label === 'Unknown' ? 'Country not known' : `From ${countryName(f.label)}`);
    case 'device':
      return crowd(people.filter((p) => (p.device ?? 'Unknown') === f.label), `On ${f.label.toLowerCase()}`);
    case 'breakdown': {
      const keyOf = (p: Person) => (f.by === 'source' ? p.source : f.by === 'country' ? (p.country ?? 'Unknown') : (p.device ?? 'Unknown'));
      const groups = new Map<string, Person[]>();
      for (const p of people) groups.set(keyOf(p), [...(groups.get(keyOf(p)) ?? []), p]);
      const list = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
      const max = Math.max(1, ...list.map(([, g]) => g.length));
      const name = (k: string) => (f.by === 'country' && k !== 'Unknown' ? countryName(k) : k);
      return {
        title: { source: 'Where everybody came from', country: 'Every country', device: 'Every kind of device' }[f.by],
        chips: [plural(people.length, 'person', 'people'), plural(list.length, f.by === 'country' ? 'country' : f.by, f.by === 'country' ? 'countries' : `${f.by}s`)],
        body: list.length ? (
          <ul className="space-y-1.5">
            {list.map(([k, g]) => (
              <li key={k}>
                <Row onClick={() => go({ t: f.by, label: k })}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{name(k)}</span>
                    <span className="text-subtle block text-[12px]">
                      {g.filter((p) => p.kind === 'account').length} signed in · {duration(sum(g))} in all
                    </span>
                  </span>
                  <Meter value={g.length} max={max} label={String(g.length)} />
                </Row>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nobody yet.</Empty>
        ),
      };
    }
    case 'requests':
      return {
        title: 'Every request',
        chips: [plural(report.requests.length, 'request'), `${report.requests.filter((r) => r.kind === 'access').length} for access`],
        body: report.requests.length ? (
          <ul className="space-y-2">
            {report.requests.map((r) => (
              <li key={r.id}>
                <RequestRow request={r} onOpen={() => go({ t: 'request', id: r.id })} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No requests in this period.</Empty>
        ),
      };
    case 'request': {
      const r = report.requests.find((x) => x.id === f.id);
      if (!r) return { title: 'Request', chips: [], body: <Empty>This request is not in the period shown.</Empty> };
      const person = r.personKey ? people.find((p) => p.key === r.personKey) : undefined;
      return {
        title: r.what,
        chips: [r.kind === 'access' ? 'Access request' : 'Roadmap ask', stamp(r.at)],
        body: (
          <div className="space-y-5">
            <dl className="grid gap-2.5 sm:grid-cols-2">
              <Box label="Name" value={r.name ?? 'Not given'} />
              <Box label="Email" value={r.email} />
              <Box label="Organisation" value={r.company ?? 'Not given'} />
              <Box label="Asked" value={stamp(r.at)} />
            </dl>
            <div className="surface-sunken rounded-2xl border p-4">
              <p className="a-label">Message</p>
              <p className="mt-2 text-[14px] leading-relaxed whitespace-pre-line">{r.message || 'No message.'}</p>
            </div>
            <a
              href={`mailto:${r.email}?subject=${encodeURIComponent(`Re: ${r.what}`)}`}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--action)] px-4 py-2 text-[13px] font-semibold text-[var(--on-action)] shadow-[var(--elev-brand)]"
            >
              <Mail className="size-4" aria-hidden /> Reply by email
            </a>
            {person && (
              <div>
                <p className="a-label mb-2">Who asked</p>
                <PeopleList people={[person]} metric={(p) => duration(p.seconds)} now={now} onOpen={(k) => go({ t: 'person', key: k })} />
              </div>
            )}
          </div>
        ),
      };
    }
    case 'accounts': {
      const list = f.which === 'new' ? env.accounts.filter((a) => env.since === null || a.created_at >= env.since) : env.accounts;
      return {
        title: f.which === 'new' ? 'New accounts' : 'Every account',
        chips: [plural(list.length, 'account'), `${list.filter((a) => people.some((p) => p.key === `u:${a.id}`)).length} active in this period`],
        body: list.length ? (
          <ul className="space-y-1.5">
            {list.map((a) => (
              <li key={a.id}>
                <Row onClick={() => go({ t: 'account', id: a.id })}>
                  <Avatar account name={a.full_name ?? a.email ?? '?'} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{a.full_name ?? a.email}</span>
                    <span className="text-subtle block truncate text-[12px]">
                      {a.email} · joined {stamp(a.created_at, false)}
                    </span>
                  </span>
                  <span className="text-muted shrink-0 text-[12px]">{a.last_sign_in_at ? `Signed in ${ago(a.last_sign_in_at, now)}` : 'Never signed in'}</span>
                </Row>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No accounts were made in this period.</Empty>
        ),
      };
    }
    case 'account': {
      const p = people.find((x) => x.key === `u:${f.id}`);
      if (p) return render({ t: 'person', key: p.key }, env);
      const a = env.accounts.find((x) => x.id === f.id);
      if (!a) return { title: 'Account', chips: [], body: <Empty>Not found.</Empty> };
      return {
        title: a.full_name ?? a.email ?? 'Account',
        chips: [isAdminEmail(a.email) ? 'Admin' : 'Account', 'No visits in this period'],
        body: (
          <dl className="grid gap-2.5 sm:grid-cols-2">
            <Box label="Email" value={a.email ?? 'Unknown'} />
            <Box label="Signs in with" value={a.provider ? provider(a.provider) : 'Unknown'} />
            <Box label="Account created" value={stamp(a.created_at)} />
            <Box label="Last sign-in" value={a.last_sign_in_at ? stamp(a.last_sign_in_at) : 'Never'} />
          </dl>
        ),
      };
    }
    case 'person': {
      const p = people.find((x) => x.key === f.key);
      if (!p) return { title: 'Person', chips: [], body: <Empty>Not in the period shown.</Empty> };
      const asks = report.requests.filter((r) => r.personKey === p.key);
      const live = now - Date.parse(p.lastSeen) < 5 * 60_000;
      return {
        title: p.kind === 'account' ? (p.name ?? p.email ?? 'Account') : `Visitor ${p.tag}`,
        chips: [
          p.kind === 'account' ? 'Signed in' : 'No account',
          ...(p.kind === 'account' && p.name && p.email ? [p.email] : []),
          ...(p.kind === 'account' && isAdminEmail(p.email) ? ['Admin'] : []),
          live ? 'Here now' : `Last seen ${ago(p.lastSeen, now)}`,
        ],
        body: (
          <div className="space-y-6">
            <PersonDetail person={p} onPage={(path) => go({ t: 'page', path })} />
            {asks.length > 0 && (
              <div>
                <p className="a-label mb-2">Their requests</p>
                <ul className="space-y-2">
                  {asks.map((r) => (
                    <li key={r.id}>
                      <RequestRow request={r} onOpen={() => go({ t: 'request', id: r.id })} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ),
      };
    }
  }
}

// ── Pieces ──────────────────────────────────────────────────────────────────

const DEVICE_ICON = { Mobile: Smartphone, Tablet, Desktop: Laptop } as Record<string, typeof Laptop>;

function PeopleList({ people, metric, now, onOpen }: { people: Person[]; metric: (p: Person) => ReactNode; now: number; onOpen: (key: string) => void }) {
  if (people.length === 0) return <Empty>Nobody here in this period.</Empty>;
  return (
    <ul className="space-y-1.5">
      {people.map((p) => {
        const Device = DEVICE_ICON[p.device ?? ''] ?? MonitorSmartphone;
        const live = now - Date.parse(p.lastSeen) < 5 * 60_000;
        return (
          <li key={p.key}>
            <Row onClick={() => onOpen(p.key)}>
              <Avatar account={p.kind === 'account'} name={p.name ?? p.email ?? ''} live={live} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{p.kind === 'account' ? (p.name ?? p.email) : `Visitor ${p.tag}`}</span>
                <span className="text-subtle flex min-w-0 items-center gap-1.5 text-[12px]">
                  <Device className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">{[p.place, p.source !== 'Direct' ? `from ${p.source}` : null, live ? 'here now' : ago(p.lastSeen, now)].filter(Boolean).join(' · ')}</span>
                </span>
              </span>
              <span className="shrink-0 text-right text-[12.5px] font-semibold tabular-nums">{metric(p)}</span>
            </Row>
          </li>
        );
      })}
    </ul>
  );
}

function RequestRow({ request: r, onOpen }: { request: Request; onOpen: () => void }) {
  const Icon = r.kind === 'access' ? KeyRound : Hand;
  return (
    <Row onClick={onOpen}>
      <span
        aria-hidden
        style={{ '--tone': r.kind === 'access' ? 'var(--status-warn)' : 'var(--status-pending)' } as CSSProperties}
        className="tinted grid size-9 shrink-0 place-items-center rounded-xl border"
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold">{r.what}</span>
        <span className="text-subtle block truncate text-[12px]">{[r.name, r.email].filter(Boolean).join(' · ')}</span>
      </span>
      <span className="text-subtle shrink-0 text-[12px]">{stamp(r.at, false)}</span>
    </Row>
  );
}

function Row({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="surface-sunken group flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition hover:border-[var(--border-strong)] hover:bg-[color-mix(in_oklab,var(--surface-sunken)_70%,var(--surface-raised))]"
    >
      {children}
      <ChevronRight className="text-subtle size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </button>
  );
}

function Avatar({ account, name, live = false }: { account: boolean; name: string; live?: boolean }) {
  return (
    <span
      aria-hidden
      style={{ '--tone': 'var(--color-brand-500)' } as CSSProperties}
      className={cn('relative grid size-9 shrink-0 place-items-center rounded-xl border text-[11px] font-bold', account ? 'tinted' : 'surface text-muted')}
    >
      {account ? initials(name || '?') : <UserRound className="size-4" />}
      {live && <span className="a-blip absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[var(--surface-raised)] bg-[var(--status-approved)]" />}
    </span>
  );
}

function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <span className="flex w-24 shrink-0 items-center gap-2 sm:w-36">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-raised)]">
        <span className="block h-full rounded-full bg-[var(--color-brand-500)]" style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
      </span>
      <span className="w-14 text-right text-[12px] font-semibold tabular-nums">{label}</span>
    </span>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-sunken min-w-0 rounded-xl border px-3 py-2">
      <dt className="a-label">{label}</dt>
      <dd className="mt-1 truncate text-[13.5px] font-medium" title={value}>
        {value}
      </dd>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-subtle py-10 text-center text-sm">{children}</p>;
}

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}
