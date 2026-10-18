'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowRight, CalendarClock, ChevronRight, CircleAlert, Plus, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { Button, Card, CardTitle, EmptyState } from '@/components/ui/primitives';
import { GROUPS, HEADS, head, type HeadId, type Side } from '@/lib/wealth/heads';
import { counted, isLiquid, takesNominee, type Summary } from '@/lib/wealth/calc';
import { daysUntil, type Area, type Finding } from '@/lib/wealth/checks';
import { itemName, mask, memberName, SELF, type Item, type WealthRecord } from '@/lib/wealth/model';
import { compact, rupees } from '@/lib/wealth/money';
import { cn } from '@/lib/utils';
import { Amount, HeadTile, HIDDEN, SEVERITY_LABEL, SEVERITY_TONE, Tag, headTone } from './shared';

export type OpenItem = (id: string, area?: Area) => void;

// ── Overview ────────────────────────────────────────────────────────────────

export function Overview({
  items,
  summary,
  findings,
  hide,
  today,
  onOpen,
  onTab,
  onAdd,
}: {
  items: Item[];
  summary: Summary;
  findings: Finding[];
  hide: boolean;
  today: string;
  onOpen: OpenItem;
  onTab: (tab: Tab) => void;
  onAdd: (side: Side) => void;
}) {
  const upcoming = useMemo(() => upcomingDates(items, today), [items, today]);
  const urgent = findings.filter((f) => f.severity !== 'note').slice(0, 5);
  const n = summary.nominees;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <Card>
          <CardTitle
            icon={<Sparkles className="size-4" />}
            title="Where it is"
            description="By class, at your share. Click a class to see what is in it."
          />
          <div className="space-y-5 px-5 py-5 sm:px-6">
            {summary.groups.length === 0 && <p className="text-muted text-sm">Add a value to an entry to see where your money is.</p>}
            {(['asset', 'liability'] as const).map((side) => {
              const groups = summary.groups.filter((g) => GROUPS[g.id].side === side);
              const of = side === 'asset' ? summary.assets : summary.liabilities;
              if (groups.length === 0) return null;
              return (
                <div key={side}>
                  <p className="a-label mb-2.5">{side === 'asset' ? 'You own' : 'You owe'}</p>
                  <ul className="space-y-2.5">
                    {groups
                      .slice()
                      .sort((a, b) => b.total - a.total)
                      .map((g) => (
                        <li key={g.id}>
                          <button type="button" onClick={() => onTab(side === 'asset' ? 'own' : 'owe')} className="group w-full text-left">
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                              <span className="font-medium group-hover:underline">{GROUPS[g.id].name}</span>
                              <span className="tabular-nums">
                                {hide ? HIDDEN : compact(g.total)}
                                <span className="text-subtle ml-2 text-xs">{Math.round((g.total / of) * 100)}%</span>
                              </span>
                            </div>
                            <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                              <span className="block h-full rounded-full" style={{ width: `${(g.total / of) * 100}%`, background: GROUPS[g.id].tone }} />
                            </div>
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <Figure
            label="Nominees"
            value={n.applicable === 0 ? '—' : `${n.yes} of ${n.applicable}`}
            note={
              n.applicable === 0
                ? 'Nothing here takes a nominee yet.'
                : n.yes === n.applicable
                  ? 'Every account that takes a nominee has one.'
                  : `${n.applicable - n.yes} still to confirm or add.`
            }
            tone={n.applicable > 0 && n.yes === n.applicable ? 'var(--status-approved)' : 'var(--status-warn)'}
            onClick={() => onTab('nominees')}
          />
          <Figure
            label="Owed, as a share of what you own"
            value={summary.debtToAssets === null ? '—' : `${summary.debtToAssets.toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`}
            note={summary.liabilities > 0 ? `${hide ? HIDDEN : compact(summary.secured)} secured, ${hide ? HIDDEN : compact(summary.unsecured)} not.` : 'Nothing owed in the record.'}
          />
          <Figure
            label="EMIs a month"
            value={hide ? HIDDEN : summary.monthlyEmi > 0 ? rupees(Math.round(summary.monthlyEmi)) : '—'}
            note={summary.monthlyEmi > 0 ? 'From the EMIs entered on your loans, at your share.' : 'Enter the EMI on a loan to see this.'}
          />
          <Figure
            label="Liquid money would last"
            value={summary.monthsCovered === null ? '—' : `${summary.monthsCovered.toLocaleString('en-IN')} months`}
            note={
              summary.monthsCovered === null
                ? 'Add your monthly spending under Household to see this.'
                : `Liquid assets of ${hide ? HIDDEN : compact(summary.liquid)} against your monthly spending.`
            }
            onClick={summary.monthsCovered === null ? () => onTab('household') : undefined}
          />
        </div>
      </div>

      <div className="space-y-5">
        <Card>
          <CardTitle
            icon={<CircleAlert className="size-4" />}
            title="Needs attention"
            description={urgent.length === 0 ? 'Nothing to act on or review.' : `The ${urgent.length === 1 ? 'one thing' : `${urgent.length} things`} that matter most first.`}
            action={
              findings.length > 0 ? (
                <Button size="sm" variant="ghost" onClick={() => onTab('checks')}>
                  All checks
                  <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              ) : undefined
            }
          />
          {urgent.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-5 text-sm sm:px-6">
              <ShieldCheck className="size-5 text-[var(--status-approved)]" aria-hidden />
              <p className="text-muted">Every entry has what it needs. Keep values up to date and back up now and then.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {urgent.map((f) => (
                <FindingRow key={f.id} f={f} onOpen={onOpen} onTab={onTab} compact />
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle icon={<CalendarClock className="size-4" />} title="Coming up" description="Maturities, premiums, renewals and repayments in the next 90 days." />
          {upcoming.length === 0 ? (
            <p className="text-muted px-5 py-5 text-sm sm:px-6">Nothing in the next 90 days.</p>
          ) : (
            <ul className="divide-y">
              {upcoming.slice(0, 6).map((u) => (
                <li key={`${u.item.id}-${u.key}`}>
                  <button type="button" onClick={() => onOpen(u.item.id, 'details')} className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-[var(--surface-sunken)] sm:px-6">
                    <span className="surface-sunken grid w-12 shrink-0 place-items-center rounded-xl border py-1.5 text-center leading-none">
                      <span className="text-[15px] font-semibold tabular-nums">{u.date.slice(8)}</span>
                      <span className="text-subtle mt-0.5 text-[10px] uppercase">{new Date(`${u.date}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' })}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{itemName(u.item)}</span>
                      <span className="text-muted text-[12.5px]">
                        {u.verb} {u.days === 0 ? 'today' : `in ${u.days} day${u.days === 1 ? '' : 's'}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {items.length < 3 && (
          <div className="surface-sunken rounded-3xl border p-5 text-sm">
            <p className="font-semibold">Keep going</p>
            <p className="text-muted mt-1">
              Most households have a few things people forget: a PF account from an old job, a policy taken years ago,
              gold in a locker. Add them as they come to mind.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onAdd('asset')}>
                <Plus className="size-3.5" aria-hidden />
                Something you own
              </Button>
              <Button size="sm" onClick={() => onAdd('liability')}>
                <Plus className="size-3.5" aria-hidden />
                Something you owe
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  note,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  note: string;
  tone?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <p className="a-label flex items-center gap-1.5">
        {tone && <span aria-hidden className="size-2 rounded-full" style={{ background: tone }} />}
        {label}
      </p>
      <p className="mt-1.5 text-[1.35rem] font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="text-muted mt-0.5 text-[12.5px] leading-snug">{note}</p>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="surface-lit a-ring hover-lift rounded-3xl px-5 py-4 text-left">
      {inner}
    </button>
  ) : (
    <div className="surface-lit a-ring rounded-3xl px-5 py-4">{inner}</div>
  );
}

function upcomingDates(items: Item[], today: string) {
  const out: { item: Item; key: string; verb: string; date: string; days: number }[] = [];
  for (const item of items) {
    for (const w of head(item.head).watch ?? []) {
      const date = item.fields[w.key];
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (w.when && !w.when(item.fields, item.kind))) continue;
      const days = daysUntil(today, date);
      if (days >= 0 && days <= 90) out.push({ item, key: w.key, verb: w.verb, date, days });
    }
  }
  return out.sort((a, b) => a.days - b.days);
}

// ── What you own / what you owe ─────────────────────────────────────────────

export type Tab = 'overview' | 'own' | 'owe' | 'nominees' | 'checks' | 'household';

export function ItemsPanel({
  side,
  record,
  items,
  findings,
  hide,
  onOpen,
  onAdd,
}: {
  side: Side;
  record: WealthRecord;
  items: Item[];
  findings: Finding[];
  hide: boolean;
  onOpen: OpenItem;
  onAdd: (side: Side, head?: HeadId) => void;
}) {
  const heads = HEADS.filter((h) => h.side === side);
  const used = heads.filter((h) => items.some((i) => i.head === h.id));
  const unused = heads.filter((h) => !items.some((i) => i.head === h.id));
  const worst = useMemo(() => worstByItem(findings), [findings]);

  if (used.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Plus className="size-6" />}
          title={side === 'asset' ? 'Nothing you own is recorded yet' : 'Nothing you owe is recorded yet'}
          description={side === 'asset' ? 'Start with a bank account. It takes a minute.' : 'Loans and credit cards go here. If you owe nothing, there is nothing to add.'}
          action={
            <Button variant="primary" onClick={() => onAdd(side)}>
              <Plus className="size-4" aria-hidden />
              {side === 'asset' ? 'Add something you own' : 'Add something you owe'}
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {used.map((h) => {
        const list = items.filter((i) => i.head === h.id);
        const total = list.reduce((s, i) => s + counted(i), 0);
        return (
          <Card key={h.id}>
            <div className="flex items-center gap-3 border-b px-5 py-4 sm:px-6">
              <HeadTile id={h.id} />
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold tracking-tight">{h.name}</h2>
                <p className="text-muted text-[12.5px]">
                  {list.length} {list.length === 1 ? 'entry' : 'entries'}
                  {h.counts(h.kinds[0]) || list.some((i) => h.counts(i.kind)) ? (
                    <>
                      {' · '}
                      <Amount value={total} hide={hide} />
                    </>
                  ) : null}
                </p>
              </div>
              <Button size="sm" onClick={() => onAdd(side, h.id)} aria-label={`Add another: ${h.one}`}>
                <Plus className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">Add</span>
              </Button>
            </div>
            <ul className="divide-y">
              {list.map((item) => (
                <ItemRow key={item.id} item={item} record={record} hide={hide} worst={worst.get(item.id)} onOpen={onOpen} />
              ))}
            </ul>
          </Card>
        );
      })}

      {unused.length > 0 && (
        <div className="rounded-3xl border border-dashed p-5">
          <p className="text-sm font-semibold">{side === 'asset' ? 'Anything else you own?' : 'Anything else you owe?'}</p>
          <p className="text-muted mt-0.5 text-[12.5px]">
            {side === 'asset' ? 'The ones people most often forget are old PF accounts, policies and gold in a locker.' : 'Include cards you clear every month: they are still worth listing.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {unused.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => onAdd(side, h.id)}
                className="text-muted inline-flex items-center gap-2 rounded-full border bg-[var(--surface-raised)] py-1 pr-3 pl-1 text-[12.5px] font-medium transition hover:text-[var(--text-c)] hover:shadow-[var(--elev-1)]"
              >
                <HeadTile id={h.id} size="sm" />
                {h.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function worstByItem(findings: Finding[]) {
  const map = new Map<string, { severity: Finding['severity']; count: number }>();
  for (const f of findings) {
    if (!f.itemId) continue;
    const cur = map.get(f.itemId);
    if (!cur) map.set(f.itemId, { severity: f.severity, count: 1 });
    else map.set(f.itemId, { severity: cur.severity, count: cur.count + 1 });
  }
  return map;
}

function ItemRow({
  item,
  record,
  hide,
  worst,
  onOpen,
}: {
  item: Item;
  record: WealthRecord;
  hide: boolean;
  worst?: { severity: Finding['severity']; count: number };
  onOpen: OpenItem;
}) {
  const spec = head(item.head);
  const who = (item.fields[spec.who] ?? '').trim();
  const number = spec.number ? (item.fields[spec.number] ?? '') : '';
  const name = itemName(item);
  const sub = [
    // The type, unless the name already says it ("SBI · Savings account").
    spec.kinds.length > 1 && !name.toLowerCase().includes(item.kind.toLowerCase()) ? item.kind : '',
    who && !name.includes(who) ? who : '',
    number ? (spec.id === 'credit_card' ? `ending ${number}` : mask(number)) : '',
    item.holder !== SELF ? memberName(record.profile, item.holder) : '',
  ].filter(Boolean);
  const amount = counted(item);
  const counts = spec.counts(item.kind);

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item.id)}
        className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-[var(--surface-sunken)] sm:px-6"
      >
        <span aria-hidden className="h-9 w-[3px] shrink-0 rounded-full" style={{ background: headTone(item.head), opacity: 0.6 }} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold">{itemName(item)}</span>
            {worst && (
              <Tag tone={SEVERITY_TONE[worst.severity]}>
                {worst.count === 1 ? SEVERITY_LABEL[worst.severity] : `${worst.count} checks`}
              </Tag>
            )}
            {isLiquid(item) && counts && <span className="text-subtle text-[11px]">Liquid</span>}
          </span>
          {sub.length > 0 && <span className="text-muted mt-0.5 block truncate text-[12.5px]">{sub.join(' · ')}</span>}
        </span>
        <span className="shrink-0 text-right">
          {!counts ? (
            <span className="text-subtle block text-[12.5px]">
              Cover {item.fields.cover ? (hide ? HIDDEN : compact(Number(item.fields.cover) || 0)) : ''}
              <span className="block text-[11px]">Not in net worth</span>
            </span>
          ) : item.value === null ? (
            <span className="text-subtle text-[12.5px] italic">No value yet</span>
          ) : (
            <>
              <Amount value={amount} hide={hide} className={cn('block text-sm font-semibold', spec.side === 'liability' && 'text-[var(--status-rejected)]')} />
              {item.share !== 100 && (
                <span className="text-subtle block text-[11px]">
                  {item.share}% of {hide ? HIDDEN : compact(item.value)}
                </span>
              )}
            </>
          )}
        </span>
        <ChevronRight className="text-subtle size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>
    </li>
  );
}

// ── Nominees ────────────────────────────────────────────────────────────────

export function NomineesPanel({
  record,
  items,
  onOpen,
  onTab,
}: {
  record: WealthRecord;
  items: Item[];
  onOpen: OpenItem;
  onTab: (t: Tab) => void;
}) {
  const [gapsOnly, setGapsOnly] = useState(false);
  const applicable = items.filter(takesNominee);
  const gaps = applicable.filter((i) => i.nominee.status !== 'yes' || !i.nominee.people.some((p) => p.name.trim()));
  const shown = gapsOnly ? gaps : applicable;
  const passByWill = items.filter((i) => !takesNominee(i) && head(i.head).side === 'asset');

  if (applicable.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<UserRound className="size-6" />}
          title="Nothing here takes a nominee yet"
          description="Bank accounts, deposits, demat accounts, mutual funds, PF, PPF, NPS and insurance all do. Add one and its nominee shows here."
        />
      </Card>
    );
  }

  const label = (i: Item) =>
    i.nominee.status === 'yes'
      ? i.nominee.people.some((p) => p.name.trim())
        ? null
        : { tone: 'var(--status-warn)', text: 'Name missing' }
      : i.nominee.status === 'no'
        ? { tone: 'var(--status-rejected)', text: 'No nominee' }
        : i.nominee.status === 'unsure'
          ? { tone: 'var(--status-warn)', text: 'Not sure' }
          : { tone: 'var(--status-draft)', text: 'Not answered' };

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle
          icon={<UserRound className="size-4" />}
          title="Who is nominated where"
          description={`${applicable.length - gaps.length} of ${applicable.length} accounts have a named nominee.`}
          action={
            <label className="text-muted flex cursor-pointer items-center gap-2 text-[12.5px]">
              <input type="checkbox" checked={gapsOnly} onChange={(e) => setGapsOnly(e.target.checked)} className="accent-[var(--accent)]" />
              Only the gaps
            </label>
          }
        />
        {shown.length === 0 ? (
          <p className="text-muted flex items-center gap-2 px-5 py-5 text-sm sm:px-6">
            <ShieldCheck className="size-5 text-[var(--status-approved)]" aria-hidden />
            No gaps. Every account that takes a nominee has a named one.
          </p>
        ) : (
          <ul className="divide-y">
            {shown.map((i) => {
              const l = label(i);
              const people = i.nominee.status === 'yes' ? i.nominee.people.filter((p) => p.name.trim()) : [];
              return (
                <li key={i.id}>
                  <button type="button" onClick={() => onOpen(i.id, 'nominee')} className="flex w-full flex-col gap-2 px-5 py-3.5 text-left transition hover:bg-[var(--surface-sunken)] sm:flex-row sm:items-center sm:gap-4 sm:px-6">
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <HeadTile id={i.head} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{itemName(i)}</span>
                        <span className="text-muted block text-[12px]">Held by {memberName(record.profile, i.holder)}</span>
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 pl-10 sm:justify-end sm:pl-0">
                      {l && <Tag tone={l.tone}>{l.text}</Tag>}
                      {people.map((p) => (
                        <span key={p.id} className="surface-sunken rounded-full border px-2.5 py-0.5 text-[12px]">
                          {p.name.trim()}
                          {p.relation && <span className="text-subtle"> · {p.relation.toLowerCase()}</span>}
                          {i.nominee.people.length > 1 && p.share && <span className="text-subtle"> · {p.share.replace('%', '')}%</span>}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {passByWill.length > 0 && (
        <div className="surface-sunken rounded-3xl border p-5 text-sm">
          <p className="font-semibold">These pass by your will, not by a nominee</p>
          <p className="text-muted mt-1">
            {passByWill.slice(0, 6).map(itemName).join(', ')}
            {passByWill.length > 6 ? ` and ${passByWill.length - 6} more` : ''}. Property, vehicles, jewellery at home
            and business interests have no nominee to name. A will is what decides who they go to.
          </p>
          <Button size="sm" className="mt-3" onClick={() => onTab('household')}>
            {record.profile.will === 'yes' ? 'Will details' : 'Record whether there is a will'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Checks ──────────────────────────────────────────────────────────────────

export function ChecksPanel({ findings, onOpen, onTab }: { findings: Finding[]; onOpen: OpenItem; onTab: (t: Tab) => void }) {
  if (findings.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<ShieldCheck className="size-6" />}
          title="Nothing to check"
          description="Every entry has a value and, where it takes one, a nominee. Dates coming up will show here as they get close."
        />
      </Card>
    );
  }
  return (
    <div className="space-y-5">
      {(['act', 'review', 'note'] as const).map((sev) => {
        const list = findings.filter((f) => f.severity === sev);
        if (list.length === 0) return null;
        return (
          <Card key={sev}>
            <div className="flex items-center gap-2.5 border-b px-5 py-3.5 sm:px-6" style={{ '--tone': SEVERITY_TONE[sev] } as CSSProperties}>
              <span aria-hidden className="size-2.5 rounded-full bg-[var(--tone)]" />
              <h2 className="font-semibold tracking-tight">{SEVERITY_LABEL[sev]}</h2>
              <span className="text-subtle text-sm tabular-nums">{list.length}</span>
            </div>
            <ul className="divide-y">
              {list.map((f) => (
                <FindingRow key={f.id} f={f} onOpen={onOpen} onTab={onTab} />
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

function FindingRow({ f, onOpen, onTab, compact: tight = false }: { f: Finding; onOpen: OpenItem; onTab: (t: Tab) => void; compact?: boolean }) {
  const go = () => (f.itemId ? onOpen(f.itemId, f.area) : onTab('household'));
  return (
    <li className={cn('flex items-start gap-3 px-5 sm:px-6', tight ? 'py-3' : 'py-4')}>
      <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: SEVERITY_TONE[f.severity] }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-pretty">{f.title}</p>
        {!tight && <p className="text-muted mt-1 text-[13px] leading-relaxed text-pretty">{f.detail}</p>}
      </div>
      <Button size="sm" onClick={go} className="shrink-0">
        {f.profile === 'backup' ? 'Back up' : 'Open'}
      </Button>
    </li>
  );
}
