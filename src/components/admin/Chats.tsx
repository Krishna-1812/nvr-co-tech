'use client';

import { useMemo, useState, type CSSProperties, type ComponentType, type ReactNode } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  Check,
  ChevronRight,
  Copy,
  Globe,
  LogIn,
  MessageCircle,
  MousePointerClick,
  PenLine,
  Sigma,
  Sparkles,
  Timer,
  UserRound,
  X,
  type LucideProps,
} from 'lucide-react';
import { OUTCOME_LABEL, TOOL_NAMES, viaLabel, type ChatTurn, type Moment, type PersonActivity, type Thread, type Who } from '@/lib/analytics/activity';
import type { Person } from '@/lib/analytics/report';
import { duration } from '@/lib/analytics/report';
import type { AdminAccountRow } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';
import { ChatMarkdown } from '@/components/chat/ChatMarkdown';
import { ChatOwl } from '@/components/chat/ChatOwl';
import { initials, provider } from './PersonDetail';
import { ago, stamp } from './when';

/**
 * The chat, as the Admin screen reads it: who asked what, and what they were
 * told (lib/analytics/activity, migration 0039). Three pieces, used by the
 * Conversations card and the panels behind every card:
 *
 *   ThreadList  one row per chat, newest first
 *   ThreadView  one chat in full, as the reader saw it, with how each answer
 *               was arrived at (the pages, the sums, the time it took)
 *   Timeline    everything one person did, day by day: pages, questions,
 *               fields filled, buttons pressed, work in a tool, sign-ins
 */

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;
const seconds = (ms: number | null) => (ms === null ? null : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);
const unanswered = (t: ChatTurn) => t.outcome !== 'answered' && t.outcome !== 'stopped' && t.outcome !== 'offline';

export function whoName(w: Who): string {
  return w.kind === 'account' ? (w.name ?? w.email ?? 'Account') : `Visitor ${w.tag}`;
}

export function Face({ who, size = 'md' }: { who: Pick<Who, 'kind' | 'name' | 'email' | 'avatar'>; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'size-12 rounded-2xl text-[13px]' : 'size-9 rounded-xl text-[11px]';
  if (who.avatar)
    // A profile photo from the sign-in provider; nothing to optimise through Next for a 36px avatar.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={who.avatar} alt="" className={cn(box, 'shrink-0 border object-cover')} referrerPolicy="no-referrer" />;
  return (
    <span
      aria-hidden
      style={{ '--tone': 'var(--color-brand-500)' } as CSSProperties}
      className={cn('grid shrink-0 place-items-center border font-bold', box, who.kind === 'account' ? 'tinted' : 'surface text-muted')}
    >
      {who.kind === 'account' ? initials(who.name ?? who.email ?? '?') : <UserRound className="size-4" />}
    </span>
  );
}

// ── The list ────────────────────────────────────────────────────────────────

export function ThreadList({ threads, now, onOpen, empty = 'Nobody has asked the chat anything in this period.' }: { threads: Thread[]; now: number; onOpen: (key: string) => void; empty?: string }) {
  if (!threads.length) return <p className="text-subtle py-10 text-center text-sm">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {threads.map((t) => (
        <li key={t.key}>
          <button
            type="button"
            onClick={() => onOpen(t.key)}
            className="surface-sunken group flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition hover:border-[var(--border-strong)] hover:bg-[color-mix(in_oklab,var(--surface-sunken)_70%,var(--surface-raised))]"
          >
            <Face who={t.who} />
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[13px] font-semibold">{whoName(t.who)}</span>
                {t.mode === 'member' && <Tag tone="var(--h-cyan)">Workspace</Tag>}
                {t.unanswered > 0 && <Tag tone="var(--status-warn)">{plural(t.unanswered, 'unanswered', 'unanswered')}</Tag>}
              </span>
              <span className="mt-1 line-clamp-2 block text-[13.5px] leading-snug text-[var(--text-c)]">“{t.turns[0]?.question}”</span>
              <span className="text-subtle mt-1 block truncate text-[12px]">
                {[plural(t.turns.length, 'question'), t.path, ago(t.lastAt, now)].filter(Boolean).join(' · ')}
              </span>
            </span>
            <ChevronRight className="text-subtle mt-2 size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

// ── One chat, in full ───────────────────────────────────────────────────────

export function ThreadView({ thread: t, onPerson, onPage }: { thread: Thread; onPerson?: () => void; onPage?: (path: string) => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const text = t.turns
      .map((x) => `${stamp(x.at)}\nQ: ${x.question}\nA: ${x.answer ?? `(${OUTCOME_LABEL[x.outcome]}${x.error ? `: ${x.error}` : ''})`}`)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(`${whoName(t.who)}${t.who.email ? ` <${t.who.email}>` : ''}\n\n${text}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard refused.
    }
  };

  return (
    <div className="space-y-5">
      <div className="surface-sunken flex flex-wrap items-center gap-3 rounded-2xl border p-3">
        <Face who={t.who} size="lg" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{whoName(t.who)}</span>
          <span className="text-subtle block truncate text-[12.5px]">
            {[t.who.kind === 'account' ? t.who.email : 'No account yet: known by the ID in their browser', `started ${stamp(t.startedAt)}`].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="flex gap-1.5">
          <button type="button" onClick={copy} className="surface inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition hover:border-[var(--border-strong)]">
            {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
            {copied ? 'Copied' : 'Copy chat'}
          </button>
          {onPerson && (
            <button
              type="button"
              onClick={onPerson}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--action)] px-3 py-1.5 text-[12px] font-semibold text-[var(--on-action)] shadow-[var(--elev-brand)]"
            >
              Everything they did <ChevronRight className="size-3.5" aria-hidden />
            </button>
          )}
        </span>
      </div>

      {/* The answers keep the chat's own look (its --c-* tokens, following the app's theme). */}
      <ol className="chat space-y-6" data-chat-skin="app" data-placement="app">
        {t.turns.map((x) => (
          <li key={x.id} className="space-y-2.5">
            <p className="text-subtle flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[11.5px]">
              <span>{stamp(x.at)}</span>
              <span aria-hidden>·</span>
              <span>{viaLabel(x.via)}</span>
              {x.path && (
                <>
                  <span aria-hidden>·</span>
                  {onPage ? (
                    <button type="button" onClick={() => onPage(x.path!)} className="underline decoration-dotted underline-offset-2 hover:text-[var(--text-c)]">
                      {x.path}
                    </button>
                  ) : (
                    <span>{x.path}</span>
                  )}
                </>
              )}
            </p>

            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-[1.25rem] rounded-br-md bg-[var(--c-user)] px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-line text-[var(--c-on-user)]">{x.question}</p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 size-8 shrink-0" aria-hidden>
                <ChatOwl />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                {x.answer ? (
                  <div className="chat-answer max-w-[92%] space-y-2.5 rounded-[1.25rem] rounded-tl-md border border-[var(--c-line)] bg-[var(--c-bg-2)] px-4 py-3 text-[14px] leading-relaxed">
                    <ChatMarkdown source={x.answer} />
                  </div>
                ) : null}
                {x.outcome !== 'answered' && (
                  <p
                    style={{ '--tone': unanswered(x) ? 'var(--status-warn)' : 'var(--status-draft)' } as CSSProperties}
                    className="tinted inline-flex max-w-full items-start gap-1.5 rounded-xl border px-3 py-1.5 text-[12.5px]"
                  >
                    {unanswered(x) ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : <X className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
                    <span>
                      <strong className="font-semibold">{OUTCOME_LABEL[x.outcome]}</strong>
                      {x.error ? ` · ${x.error}` : x.outcome === 'stopped' ? ' · they stopped it, or left, before it finished' : ''}
                    </span>
                  </p>
                )}

                {(x.sources.length > 0 || x.tools.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {x.tools.map((c, i) => (
                      <span key={`t${i}`} className="surface text-muted inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px]" title={JSON.stringify(c.args ?? {})}>
                        <Sigma className="size-3" aria-hidden />
                        {c.label}: {c.summary}
                        {c.ok ? <Check className="size-3 text-[var(--status-approved)]" aria-hidden /> : <X className="size-3 text-[var(--status-warn)]" aria-hidden />}
                      </span>
                    ))}
                    {x.sources.map((s) =>
                      s.href ? (
                        <a key={s.id} href={s.href} target="_blank" rel="noreferrer" className="surface text-muted inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] transition hover:text-[var(--text-c)]">
                          <BookOpen className="size-3" aria-hidden />
                          {s.title}
                        </a>
                      ) : (
                        <span key={s.id} className="surface text-muted inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px]">
                          <BookOpen className="size-3" aria-hidden />
                          {s.title}
                        </span>
                      ),
                    )}
                  </div>
                )}

                <p className="text-subtle flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
                  {x.firstMs !== null && (
                    <span className="inline-flex items-center gap-1">
                      <Timer className="size-3" aria-hidden /> First word {seconds(x.firstMs)}
                    </span>
                  )}
                  {x.totalMs !== null && x.totalMs > 0 && <span>Whole answer {seconds(x.totalMs)}</span>}
                  {x.answer && <span>{plural(x.answer.trim().split(/\s+/).length, 'word')}</span>}
                  {x.model && <span>{x.model}</span>}
                  <span>{x.mode === 'member' ? 'Workspace assistant' : 'Public chat'}</span>
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Everything one person did ───────────────────────────────────────────────

type Entry = Moment | { t: 'view'; at: string; path: string; title: string | null; seconds: number } | { t: 'joined'; at: string } | { t: 'signin'; at: string; provider: string | null };
type Filter = 'all' | 'chat' | 'field' | 'click' | 'view' | 'tool';

const KIND: Record<Entry['t'], { icon: ComponentType<LucideProps>; tone: string }> = {
  view: { icon: Globe, tone: 'var(--color-brand-500)' },
  chat: { icon: MessageCircle, tone: 'var(--h-cyan)' },
  field: { icon: PenLine, tone: 'var(--status-warn)' },
  click: { icon: MousePointerClick, tone: 'var(--status-draft)' },
  tool: { icon: Briefcase, tone: 'var(--status-approved)' },
  joined: { icon: Sparkles, tone: 'var(--status-pending)' },
  signin: { icon: LogIn, tone: 'var(--status-pending)' },
};

const dayOf = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
const timeOf = (iso: string) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

export function Timeline({
  person: p,
  activity,
  account,
  onThread,
  onPage,
}: {
  person: Person;
  activity?: PersonActivity;
  account?: AdminAccountRow;
  onThread?: (key: string) => void;
  onPage?: (path: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(80);

  const all = useMemo<Entry[]>(() => {
    const list: Entry[] = [
      ...p.journey.map((j) => ({ t: 'view' as const, at: j.at, path: j.path, title: j.title, seconds: j.seconds })),
      ...(activity?.moments ?? []),
      ...(account?.created_at ? [{ t: 'joined' as const, at: account.created_at }] : []),
      ...(account?.last_sign_in_at ? [{ t: 'signin' as const, at: account.last_sign_in_at, provider: account.provider }] : []),
    ];
    return list.sort((a, b) => b.at.localeCompare(a.at));
  }, [p.journey, activity, account]);

  const count = (f: Filter) => (f === 'all' ? all.length : all.filter((e) => e.t === f).length);
  const tabs: [Filter, string][] = (
    [
      ['all', 'Everything'],
      ['chat', 'Questions'],
      ['field', 'Typed in'],
      ['click', 'Pressed'],
      ['tool', 'Tool work'],
      ['view', 'Pages'],
    ] as [Filter, string][]
  ).filter(([f]) => f === 'all' || count(f) > 0);

  const list = (filter === 'all' ? all : all.filter((e) => e.t === filter)).slice(0, shown);
  const total = filter === 'all' ? all.length : count(filter);

  // A heading wherever the day changes.
  const rows = list.map((e, i) => ({ e, day: dayOf(e.at), head: i === 0 || dayOf(list[i - 1].at) !== dayOf(e.at) }));
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="What to show">
        {tabs.map(([f, label]) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => {
              setFilter(f);
              setShown(80);
            }}
            className={cn(
              'rounded-full border px-3 py-1 text-[12px] font-semibold transition',
              filter === f ? 'border-transparent bg-[var(--action)] text-[var(--on-action)] shadow-[var(--elev-brand)]' : 'surface-sunken text-muted hover:text-[var(--text-c)]',
            )}
          >
            {label} <span className="opacity-70 tabular-nums">{count(f)}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="text-subtle py-8 text-center text-sm">Nothing here in this period.</p>
      ) : (
        <ol className="relative mt-4">
          {rows.map(({ e, day, head }, i) => (
            <li key={`${e.t}-${e.at}-${i}`}>
              {head && <p className="a-label sticky top-0 z-[1] bg-[var(--surface-raised)] py-2">{day}</p>}
              <Item entry={e} onThread={onThread} onPage={onPage} />
            </li>
          ))}
        </ol>
      )}
      {total > shown && (
        <button type="button" onClick={() => setShown((n) => n + 120)} className="surface-sunken mt-3 w-full rounded-xl border py-2 text-[12.5px] font-semibold">
          Show more ({total - shown} left)
        </button>
      )}
    </div>
  );
}

function Item({ entry: e, onThread, onPage }: { entry: Entry; onThread?: (key: string) => void; onPage?: (path: string) => void }) {
  const { icon: Icon, tone } = KIND[e.t];
  let body: ReactNode;
  let action: (() => void) | undefined;

  switch (e.t) {
    case 'view':
      body = (
        <>
          <span className="text-muted">Opened</span> <span className="font-medium">{e.path}</span>
          {e.title && <span className="text-subtle block truncate text-[12px]">{e.title}</span>}
        </>
      );
      if (onPage) action = () => onPage(e.path);
      break;
    case 'chat':
      body = (
        <>
          <span className="text-muted">Asked</span> <span className="font-medium">“{e.question}”</span>
          <span className="text-subtle block truncate text-[12px]">
            {[e.outcome !== 'answered' ? OUTCOME_LABEL[e.outcome] : 'Answered', e.path].filter(Boolean).join(' · ')}
          </span>
        </>
      );
      if (onThread) action = () => onThread(e.thread);
      break;
    case 'field':
      body = (
        <>
          <span className="text-muted">Typed in</span> <span className="font-medium">{e.label ?? 'a field'}</span>
          {e.value && <span className="surface mt-1 block max-w-full rounded-lg border px-2 py-1 text-[12.5px] break-words whitespace-pre-line">{e.value}</span>}
          <span className="text-subtle block truncate text-[12px]">{e.path}</span>
        </>
      );
      break;
    case 'click':
      body = (
        <>
          <span className="text-muted">Pressed</span> <span className="font-medium">{e.label ?? 'a button'}</span>
          <span className="text-subtle block truncate text-[12px]">{[e.value ? `→ ${e.value}` : null, e.path].filter(Boolean).join(' · ')}</span>
        </>
      );
      break;
    case 'tool':
      body = e.first ? (
        <>
          <span className="text-muted">Started work in</span> <span className="font-medium">{TOOL_NAMES[e.tool]}</span>
        </>
      ) : (
        <>
          <span className="text-muted">Last saved</span> <span className="font-medium">{TOOL_NAMES[e.tool]}</span>
          <span className="text-subtle block text-[12px]">
            {plural(e.saves, 'save')}
            {e.sealed ? ' · locked with their passcode, so not readable here' : ''}
          </span>
        </>
      );
      break;
    case 'joined':
      body = <span className="font-medium">Created their account</span>;
      break;
    case 'signin':
      body = (
        <>
          <span className="font-medium">Last signed in</span>
          {e.provider && <span className="text-subtle block text-[12px]">with {provider(e.provider)}</span>}
        </>
      );
      break;
  }

  const inner = (
    <>
      <span aria-hidden style={{ '--tone': tone } as CSSProperties} className="tinted relative z-[1] mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 text-[13px] leading-snug">{body}</span>
      <span className="text-subtle shrink-0 pt-1 text-[11.5px] tabular-nums">
        {e.t === 'view' && e.seconds > 0 ? `${duration(e.seconds)} · ` : ''}
        {timeOf(e.at)}
      </span>
    </>
  );

  // The thread down the left joins one moment to the next.
  const cls = 'relative flex w-full items-start gap-3 rounded-xl px-1.5 py-2 text-left before:absolute before:top-0 before:bottom-0 before:left-[19px] before:w-px before:bg-[var(--border-c)]';
  return action ? (
    <button type="button" onClick={action} className={cn(cls, 'transition hover:bg-[var(--surface-sunken)]')}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** A small coloured label. */
function Tag({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span style={{ '--tone': tone } as CSSProperties} className="tinted shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold">
      {children}
    </span>
  );
}
