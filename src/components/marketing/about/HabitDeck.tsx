'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Reveal } from '../Reveal';
import { clamp, subscribe, usePrefersReducedMotion } from '../scroll';

/**
 * The four habits on /about, dealt as a deck.
 *
 * Each card is sticky a little lower than the one before, so as the reader
 * scrolls the next card slides up over the last and they stack, with an edge of
 * each still showing above the one on top. The card being covered shrinks back
 * a few percent and dims as it goes under, which is what makes the stack read
 * as depth rather than as cards overlapping by accident.
 *
 * One column, because a deck is one pile. Under reduced motion it is the two-
 * by-two grid it used to be: a stack that moves under the reader's scroll is
 * exactly the kind of motion that setting asks us to leave out.
 *
 * Added 17 Oct, when the owner asked for the About page to move.
 */
export function HabitDeck({ habits }: { habits: readonly { title: string; body: string }[] }) {
  const reduced = usePrefersReducedMotion();
  const deck = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const ul = deck.current;
    if (!ul || reduced) return;
    const cards = Array.from(ul.querySelectorAll<HTMLElement>('[data-card]'));

    const read = () => {
      const boxes = cards.map((c) => c.getBoundingClientRect());
      for (let i = 0; i < cards.length - 1; i++) {
        // How far the next card has come up over this one: 0 while it is a
        // card's height or more below, 1 when it sits on top.
        const t = clamp(1 - (boxes[i + 1].top - boxes[i].top) / boxes[i].height);
        cards[i].style.setProperty('--under', t.toFixed(4));
      }
    };

    const stop = subscribe(read);
    read();
    return () => {
      stop();
      cards.forEach((c) => c.style.removeProperty('--under'));
    };
  }, [reduced]);

  if (reduced) {
    return (
      <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {habits.map((item, i) => (
          <Reveal as="li" key={item.title} delay={i * 70} className="h-full">
            <Card index={i} {...item} />
          </Reveal>
        ))}
      </ul>
    );
  }

  return (
    <ul ref={deck} className="mx-auto mt-12 grid max-w-4xl gap-6 pb-6">
      {habits.map((item, i) => (
        <li
          key={item.title}
          className="sticky"
          // Below the site header, and each card a step lower than the last so
          // the ones beneath keep an edge showing.
          style={{ top: `calc(6.5rem + ${i} * 1.1rem)` }}
        >
          <div
            data-card
            className="origin-top"
            style={{
              transform: 'scale(calc(1 - var(--under, 0) * 0.06))',
            }}
          >
            <Card index={i} {...item} deck />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Card({ index, title, body, deck = false }: { index: number; title: string; body: string; deck?: boolean }) {
  return (
    <div
      className={cn(
        'm-card relative flex h-full overflow-hidden rounded-3xl',
        deck
          ? 'm-ring min-h-[15rem] flex-col gap-6 p-7 shadow-[var(--m-shadow)] sm:flex-row sm:items-start sm:gap-10 sm:p-10'
          : 'flex-col p-6 sm:p-8',
      )}
    >
      {deck ? (
        <span
          aria-hidden
          data-n={String(index + 1).padStart(2, '0')}
          className="m-n m-display shrink-0 t-h1 leading-none text-[var(--m-gold)] tabular-nums"
        />
      ) : (
        <span
          aria-hidden
          data-n={index + 1}
          className="m-n m-arch m-mono mb-5 grid h-10 w-8 place-items-center bg-[var(--m-gold)] pt-1 t-2 font-bold text-[var(--m-on-grad)] tabular-nums"
        />
      )}
      <div className="min-w-0">
        <h3 className={cn('m-display', deck ? 't-h4' : 't-5')}>{title}</h3>
        <p className={cn('m-dim mt-3', deck ? 't-4' : 't-3')}>{body}</p>
      </div>

      {/* The shade a covered card takes as the next one comes over it. */}
      {deck && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[var(--m-ink)]"
          style={{ opacity: 'calc(var(--under, 0) * 0.08)' }}
        />
      )}
    </div>
  );
}
