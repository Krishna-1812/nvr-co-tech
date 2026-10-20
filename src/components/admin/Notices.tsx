'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type CSSProperties } from 'react';
import { Check, FileText, RotateCcw, Sparkles } from 'lucide-react';
import { setNoticeHandled } from '@/app/actions/notices';
import { dueWords, type NoticeItem } from '@/lib/notices/view';
import { cn } from '@/lib/utils';
import { stamp } from './when';

/**
 * The rows of the Tax notices page (/analytics/notices): one proceeding each,
 * with what is new on it, when a response is due, its files, and the one
 * thing an admin does here, marking it handled.
 */

const tone = (v: string) => ({ '--tone': v }) as CSSProperties;

/** Red when due within two days or missed, amber within a week, quiet after. */
function dueTone(dueIn: number) {
  if (dueIn <= 2) return 'var(--status-rejected)';
  if (dueIn <= 7) return 'var(--status-warn)';
  return 'var(--status-draft)';
}

const isoDay = (d: string) => stamp(`${d}T00:00:00+05:30`, false);

function Chip({ children, v }: { children: React.ReactNode; v?: string }) {
  return (
    <span
      style={v ? tone(v) : undefined}
      className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap', v ? 'tinted' : 'surface-sunken text-muted')}
    >
      {children}
    </span>
  );
}

function Handled({ item }: { item: NoticeItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const flip = (handled: boolean) =>
    start(async () => {
      setError(null);
      const res = await setNoticeHandled({ key: item.key, handled });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });

  return (
    <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
      {item.handled ? (
        <>
          <span style={tone('var(--status-approved)')} className="tinted inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold">
            <Check className="size-3.5" aria-hidden /> Handled
          </span>
          <span className="text-subtle text-[11.5px]">
            {stamp(item.handled.at, false)}
            {item.handled.by ? ` · ${item.handled.by}` : ''}
          </span>
          <button type="button" disabled={pending} onClick={() => flip(false)} className="text-subtle inline-flex items-center gap-1 text-[11.5px] font-semibold underline-offset-2 hover:text-[var(--text-c)] hover:underline">
            <RotateCcw className="size-3" aria-hidden /> Undo
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => flip(true)}
          className="surface-sunken inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition hover:border-[var(--border-strong)] disabled:opacity-60"
        >
          <Check className="size-3.5" aria-hidden /> {pending ? 'Saving…' : 'Mark handled'}
        </button>
      )}
      {error && (
        <p role="alert" style={tone('var(--status-rejected)')} className="tinted max-w-[16rem] rounded-lg border px-2 py-1 text-[12px]">
          {error}
        </p>
      )}
    </div>
  );
}

/** The alert without the proceeding's name, which the row already shows as its title. */
function freshWords(item: NoticeItem) {
  const d = item.fresh!.detail;
  if (/^New proceeding:/i.test(d)) return 'New proceeding on the portal';
  const rest = d.startsWith(item.name) ? d.replace(/^[^:]*:\s*/, '') : d;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

export function NoticeRow({ item, urls, showClient = false }: { item: NoticeItem; urls: Record<string, string>; showClient?: boolean }) {
  const years = [item.ay && !/not available/i.test(item.ay) ? `AY ${item.ay}` : null, item.fy && !/not available/i.test(item.fy) ? `FY ${item.fy}` : null].filter(Boolean).join(' · ');
  return (
    <li className={cn('flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6', item.handled && 'opacity-75')}>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="min-w-0">
          {showClient && <p className="text-subtle truncate text-[12px] font-semibold tracking-wide uppercase">{item.client}</p>}
          <p className="text-[15px] leading-snug font-semibold tracking-tight">
            {item.name}
            {years && <span className="text-muted font-normal"> · {years}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {item.dueIn !== null && !item.handled && <Chip v={dueTone(item.dueIn)}>{dueWords(item.dueIn)} · {isoDay(item.due!)}</Chip>}
          {item.dueIn !== null && item.handled && <Chip>Was due {isoDay(item.due!)}</Chip>}
          <Chip v={item.tab === 'action' ? 'var(--color-brand-500)' : undefined}>{item.tab === 'action' ? 'For your action' : 'For information'}</Chip>
          {item.noticeCount !== null && <Chip>{item.noticeCount} notice{item.noticeCount === 1 ? '' : 's'}</Chip>}
          {item.latest && (
            <Chip>
              Latest {isoDay(item.latest.date)}
              {item.latest.status ? ` · ${item.latest.status}` : ''}
            </Chip>
          )}
          {item.markedNew && !item.fresh && <Chip v="var(--h-cyan)">New on the portal</Chip>}
        </div>
        {item.fresh && (
          <p style={tone('var(--status-warn)')} className="tinted flex items-start gap-1.5 rounded-xl border px-3 py-2 text-[13px]">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {freshWords(item)} <span className="opacity-75">· found {stamp(item.fresh.at)}</span>
            </span>
          </p>
        )}
        {item.handled?.note && <p className="text-muted text-[13px]">Note: {item.handled.note}</p>}
        {item.docs.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {item.docs.map((d) =>
              urls[d.path] ? (
                <li key={d.id}>
                  <a
                    href={urls[d.path]}
                    target="_blank"
                    rel="noreferrer"
                    className="surface-sunken inline-flex max-w-[18rem] items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12.5px] font-medium transition hover:border-[var(--border-strong)]"
                  >
                    <FileText className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{d.name}</span>
                  </a>
                </li>
              ) : (
                <li key={d.id} className="text-subtle inline-flex max-w-[18rem] items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1 text-[12.5px]" title="The file could not be opened from here">
                  <FileText className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{d.name}</span>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
      <Handled item={item} />
    </li>
  );
}

export function NoticeList({ items, urls, showClient = false, empty }: { items: NoticeItem[]; urls: Record<string, string>; showClient?: boolean; empty: string }) {
  if (!items.length) return <p className="text-subtle px-6 py-10 text-center text-sm text-pretty">{empty}</p>;
  return (
    <ul className="divide-y">
      {items.map((i) => (
        <NoticeRow key={i.key} item={i} urls={urls} showClient={showClient} />
      ))}
    </ul>
  );
}
