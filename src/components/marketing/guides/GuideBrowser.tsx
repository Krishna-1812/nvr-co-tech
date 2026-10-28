'use client';

import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Spotlight, Tilt } from '../motion';
import { Odometer } from '../play/Odometer';
import type { GuideCard } from './summary';

/**
 * The guides, filterable by the kind of work they belong to.
 *
 * A pill slides under the chosen topic, and the grid deals its cards back in
 * each time the choice changes. The first card shown is the lead one and takes
 * two columns. Every card is a plain link in the server-rendered HTML, so the
 * filter is an aid to browsing rather than a gate in front of the content.
 */
export function GuideBrowser({ cards }: { cards: GuideCard[] }) {
  const topics = ['All', ...Array.from(new Set(cards.map((c) => c.topic)))];
  const [topic, setTopic] = useState('All');
  const shown = topic === 'All' ? cards : cards.filter((c) => c.topic === topic);

  const bar = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ x: 0, w: 0 });

  useLayoutEffect(() => {
    const place = () => {
      const el = bar.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [topic]);

  return (
    <div>
      <div className="-mx-5 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0">
        <div ref={bar} role="group" aria-label="Filter guides by topic" className="g-chips inline-flex gap-1 rounded-full border border-[var(--m-line)] bg-[var(--m-card)] p-1.5">
          <span aria-hidden className="g-chip-pill" style={{ '--px': `${pill.x - 6}px`, '--pw': `${pill.w}px`, top: 6, height: 'calc(100% - 12px)', left: 6 } as React.CSSProperties} />
          {topics.map((t) => {
            const count = t === 'All' ? cards.length : cards.filter((c) => c.topic === t).length;
            const on = t === topic;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => setTopic(t)}
                className={cn(
                  'relative z-10 whitespace-nowrap rounded-full px-4 py-2 t-3 font-medium transition-colors duration-300',
                  on ? 'text-[var(--m-on-grad)]' : 'text-[var(--m-dim)] hover:text-[var(--m-ink)]',
                )}
              >
                {t}{' '}
                <span className={cn('ml-1.5 tabular-nums', on ? 'opacity-70' : 'opacity-50')}>{count}</span>
                {/* For the bare HTML: the chips are a flex row. */}{' '}
              </button>
            );
          })}
        </div>
      </div>

      {/* Keyed on the topic, so a new choice remounts the grid and deals it again. */}
      <ul key={topic} className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {shown.map((c, i) => (
          <li
            key={c.slug}
            className={cn('g-card-in', i === 0 && 'md:col-span-2')}
            style={{ '--d': `${i * 70}ms` } as React.CSSProperties}
          >
            <Card card={c} lead={i === 0} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Card({ card: c, lead }: { card: GuideCard; lead: boolean }) {
  return (
    <Tilt max={lead ? 3 : 5} className="h-full">
      <Spotlight color={c.color} className="h-full rounded-[1.75rem]">
        <Link
          href={`/guides/${c.slug}`}
          className={cn(
            'g-card m-card flex h-full flex-col overflow-hidden rounded-[1.75rem] p-6 sm:p-7',
            lead && 'lg:p-9',
          )}
        >
          <div className={cn('flex min-w-0 flex-1 flex-col', lead && 'lg:justify-between')}>
            <div className="flex items-center justify-between gap-4">
              <span className="m-eyebrow" style={{ color: c.colorText }}>
                {c.n} · {c.topic}
              </span>
              <span aria-hidden className="g-door m-arch relative h-11 w-9 shrink-0 overflow-hidden" style={{ background: c.color }}>
                <span className="g-door-sun absolute inset-x-1.5 bottom-1 aspect-square rounded-full bg-[var(--m-sun)]" />
              </span>
            </div>

            <div className={cn('mt-6', lead && 'lg:mt-10')}>
              <p className={cn('m-display tabular-nums', lead ? 't-h1' : 't-h2')} style={{ color: c.colorText }}>
                <Odometer value={c.figure.value} />
              </p>
              <p className="m-dim-2 mt-2 t-2">{c.figure.label}</p>
            </div>

            <h3 className={cn('m-display mt-6 text-[var(--m-ink)]', lead ? 't-h3' : 't-5')}>{c.title}</h3>
            <p className="m-dim-2 mt-3 t-3">{c.lead}</p>

            <div className="mt-auto flex items-center justify-between gap-4 pt-7">
              <span className="m-dim-2 inline-flex items-center gap-1.5 t-2">
                <Clock className="size-3.5" aria-hidden />
                {c.minutes} min · with {c.tool}
              </span>{' '}
              <span className="inline-flex items-center gap-1.5 t-3 font-semibold text-[var(--m-ink)]">
                Read
                <ArrowRight className="g-arrow size-4" aria-hidden />
              </span>
            </div>
          </div>
          <span aria-hidden className="g-foot-line absolute inset-x-0 bottom-0 h-1" style={{ background: c.color }} />
        </Link>
      </Spotlight>
    </Tilt>
  );
}
