'use client';

import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Calculator, Check, Inbox, ListChecks, PenLine, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Container, Eyebrow } from '../bits';
import { Reveal } from '../Reveal';
import { clamp, subscribe, usePrefersReducedMotion } from '../scroll';

/**
 * How a piece of work moves through any of the tools, told as one sheet of
 * paper travelling through four doorways while the reader scrolls.
 *
 * Added 17 Oct when the owner asked for the site to be "more beautiful and
 * super cool". It sits where the GST/TDS slider used to, and says the thing that
 * section said only about vouchers, about every tool: it comes in, the figures
 * are worked out, every line is checked, and a person makes the call. The same
 * four beats as the hero's card (home/WorkPanel), so the page makes one argument
 * twice in two shapes rather than two arguments.
 *
 * No figures, no names, no tool. Nothing on the sheet is legible on purpose: it
 * is a drawing of a document, not an example of one, so there is nothing here a
 * reader could hold the product to that it does not do.
 *
 * ── Two layouts ────────────────────────────────────────────────────────────
 *
 * From lg up, the section is several screens tall and its stage is pinned while
 * the reader scrolls through it; the scroll position moves the sheet. Below lg,
 * and for anyone who has asked for less motion, it is a plain list of the four
 * steps, each revealed as it arrives. A pinned scroll story on a phone fights
 * the thumb, and one that moves a large object on its own is exactly what
 * reduced motion is asking us not to do.
 */

type Step = { icon: LucideIcon; title: string; body: string };

const STEPS: readonly Step[] = [
  {
    icon: Inbox,
    title: 'It comes in',
    body: 'Whatever the job runs on goes in, in the shape your team already keeps it. Nobody has to tidy it up for the software first.',
  },
  {
    icon: Calculator,
    title: 'The figures are worked out',
    body: 'The arithmetic follows rules that are written down once, so it comes out the same way every time, for everyone.',
  },
  {
    icon: ListChecks,
    title: 'Every line is checked',
    body: 'What agrees is cleared. What does not is set aside with the reason, where you can see it, rather than quietly dropped.',
  },
  {
    icon: PenLine,
    title: 'You make the call',
    body: 'The decision stays with a person, with the working laid out behind it. That part is never handed to the software.',
  },
];

const LAST = STEPS.length - 1;

/** A two-digit step number, the way the rest of the site numbers lists. */
const nth = (i: number) => String(i + 1).padStart(2, '0');

export function HowItMoves() {
  const reduced = usePrefersReducedMotion();

  return (
    <section
      id="how"
      className="relative border-t border-[var(--m-line)] bg-[var(--m-bg)]"
    >
      {/* The list is always in the page; the pinned stage only takes over from
          lg up, and never under reduced motion. */}
      <div className={reduced ? '' : 'lg:hidden'}>
        <StepList />
      </div>
      {!reduced && (
        <div className="hidden lg:block">
          <PinnedStory />
        </div>
      )}
    </section>
  );
}

function Heading() {
  return (
    <>
      <Eyebrow className="mb-4">How the work moves</Eyebrow>
      <h2 className="m-display s-settle t-h2">
        In at one end.{' '}
        {/* Its own line at every width: left to wrap, the accent breaks after
            "Your" on a phone and in the pinned layout's narrow column. */}
        <br />
        <span className="m-serif m-grad-text">Your call at the other.</span>
      </h2>
    </>
  );
}

/* ── Phones, and reduced motion ─────────────────────────────────────────── */

function StepList() {
  return (
    <Container wide className="py-20 sm:py-28">
      <Reveal className="max-w-3xl">
        <Heading />
      </Reveal>

      <ol className="mt-12 grid gap-4 sm:grid-cols-2">
        {STEPS.map((step, i) => (
          <Reveal as="li" key={step.title} delay={i * 70}>
            <div className="m-card m-ring flex h-full gap-5 rounded-3xl p-5 shadow-[var(--m-shadow)] sm:p-6">
              <Doorway icon={step.icon} lit waiting={i === LAST} className="h-24 w-[4.25rem] shrink-0" />
              <div className="min-w-0">
                <p className="m-mono m-dim-2 t-1 t-caps uppercase">Step {nth(i)}</p>
                <h3 className="m-display mt-2 t-6">{step.title}</h3>
                <p className="m-dim mt-2 t-3">{step.body}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </ol>
    </Container>
  );
}

/* ── lg and up: the pinned story ────────────────────────────────────────── */

/**
 * Where the sheet stands for a given scroll position, 0 at the first doorway
 * and 1 at the last.
 *
 * Not linear. Each leg of the journey starts with a dwell, a stretch of scroll
 * in which the sheet stays at the doorway it has just reached, so the reader
 * has time to read that step before the next one begins. Then it travels, eased
 * at both ends so it leaves and arrives rather than sliding past.
 */
function journey(raw: number): { pos: number; travel: number } {
  const legs = raw * LAST;
  const leg = Math.min(Math.floor(legs), LAST);
  if (leg >= LAST) return { pos: 1, travel: 0 };
  const within = legs - leg;
  const DWELL = 0.42;
  const t = clamp((within - DWELL) / (1 - DWELL));
  const eased = t * t * (3 - 2 * t);
  return { pos: (leg + eased) / LAST, travel: eased };
}

function PinnedStory() {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [reached, setReached] = useState(0);

  useEffect(() => {
    const el = host.current;
    const st = stage.current;
    if (!el || !st) return;

    const read = () => {
      const rect = el.getBoundingClientRect();
      const run = rect.height - window.innerHeight;
      const raw = run > 0 ? clamp(-rect.top / run) : 0;
      const { pos, travel } = journey(raw);
      // Written as custom properties, so the per-frame work is one style write
      // and the browser does the rest; React only hears about whole steps.
      st.style.setProperty('--pos', pos.toFixed(4));
      // The sheet lifts off and tilts while it is between doorways, and sits
      // flat when it has arrived.
      const arc = Math.sin(travel * Math.PI);
      st.style.setProperty('--lift', `${(-arc * 26).toFixed(2)}px`);
      st.style.setProperty('--tip', `${(arc * 5).toFixed(2)}deg`);
      setReached(Math.min(LAST, Math.floor(pos * LAST + 0.001)));
    };

    const stop = subscribe(read);
    read();
    return stop;
  }, []);

  return (
    <div ref={host} className="relative h-[400vh]">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <span
          aria-hidden
          className="m-dots pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(60%_55%_at_70%_55%,#000,transparent)]"
        />

        <Container wide className="relative grid w-full grid-cols-[0.82fr_1.18fr] items-center gap-14 xl:gap-20">
          {/* ── The words ── */}
          <div>
            <Heading />

            {/* All four steps are in the document, in order, for anyone not
                looking at the picture; only the one the sheet has reached is
                shown. */}
            <ol className="relative mt-10 grid">
              {STEPS.map((step, i) => {
                const on = i === reached;
                return (
                  <li
                    key={step.title}
                    aria-current={on ? 'step' : undefined}
                    className={cn(
                      '[grid-area:1/1] transition-[opacity,translate] duration-500 ease-out',
                      on ? 'translate-y-0 opacity-100' : i < reached ? '-translate-y-3 opacity-0' : 'translate-y-3 opacity-0',
                    )}
                  >
                    <p className="flex items-baseline gap-4">
                      <span className="m-display t-h1 leading-none text-[var(--m-gold)]">{nth(i)}</span>
                      <span className="m-mono m-dim-2 t-1 t-caps uppercase">of {nth(LAST)}</span>
                    </p>
                    <h3 className="m-display mt-4 t-h4">{step.title}</h3>
                    <p className="m-dim mt-3 max-w-md t-4">{step.body}</p>
                  </li>
                );
              })}
            </ol>

            {/* Where you are in the four. */}
            <div aria-hidden className="mt-10 flex max-w-md gap-2">
              {STEPS.map((step, i) => (
                <span
                  key={step.title}
                  className="h-1 flex-1 rounded-full transition-colors duration-500"
                  style={{ background: i <= reached ? 'var(--m-gold)' : 'var(--m-line)' }}
                />
              ))}
            </div>
          </div>

          {/* ── The picture ── */}
          <div
            ref={stage}
            aria-hidden
            className="m-card m-ring relative h-[min(37rem,76svh)] min-h-[33rem] overflow-hidden rounded-[2rem] shadow-[var(--m-shadow)]"
            style={{ '--pos': 0, '--lift': '0px', '--tip': '0deg' } as React.CSSProperties}
          >
            {/* A sun coming up behind the doorways as the work gets done: under
                the ground at the start, clear of it by the end. Faint, so it is
                weather rather than a second subject, and the sheet passes in
                front of it. */}
            <span
              className="absolute left-1/2 size-72 -translate-x-1/2 rounded-full bg-[var(--m-sun)] opacity-25"
              style={{ top: 'calc(66% - var(--pos) * 46%)' }}
            />

            {/* The ground the doorways stand on. */}
            <span className="absolute inset-x-0 bottom-0 h-[22%] bg-[var(--m-bg-2)]" />

            {/* Everything that sits on the path, inset from the stage's sides
                so the sheet clears them at the first and last doorway. */}
            <div className="absolute inset-y-0 inset-x-[7%]">
              {/* The path between the first doorway and the last, filling behind
                  the sheet as it goes. */}
              <span className="absolute bottom-[22%] left-[12.5%] h-px w-[75%] -translate-y-px border-t border-dashed border-[var(--m-line-2)]" />
              <span
                className="absolute bottom-[22%] left-[12.5%] h-[2px] w-[75%] origin-left -translate-y-px bg-[var(--m-gold)]"
                style={{ transform: 'scaleX(var(--pos))' }}
              />

              <div className="absolute inset-x-0 bottom-[22%] grid grid-cols-4">
                {STEPS.map((step, i) => (
                  <div key={step.title} className="flex flex-col items-center">
                    <Doorway
                      icon={step.icon}
                      lit={i <= reached}
                      waiting={i === LAST && reached === LAST}
                      className="h-[9.5rem] w-[6.25rem] xl:h-[11rem] xl:w-[7.25rem]"
                    />
                  </div>
                ))}
              </div>

              <div className="absolute inset-x-0 bottom-[6%] grid grid-cols-4">
                {STEPS.map((step, i) => (
                  <p
                    key={step.title}
                    className={cn(
                      'px-2 text-center t-2 font-medium transition-colors duration-500',
                      i <= reached ? 'text-[var(--m-ink)]' : 'm-dim-2',
                    )}
                  >
                    {step.title}
                  </p>
                ))}
              </div>

              {/* The sheet's shadow on the path, which stays put while the sheet
                  lifts, so the lift reads as height. */}
              <span
                className="absolute bottom-[calc(22%+0.1rem)] h-2 w-20 -translate-x-1/2 rounded-[50%] bg-[var(--m-ink)] opacity-[0.12] blur-[3px]"
                style={{ left: 'calc(12.5% + var(--pos) * 75%)' }}
              />

              {/* The sheet. */}
              <div
                className="absolute bottom-[calc(22%+10.75rem)] xl:bottom-[calc(22%+12.25rem)]"
                style={{
                  left: 'calc(12.5% + var(--pos) * 75%)',
                  transform: 'translate(-50%, var(--lift)) rotate(var(--tip))',
                }}
              >
                <Sheet stage={reached} />
              </div>
            </div>
          </div>
        </Container>
      </div>
    </div>
  );
}

/* ── The drawings ───────────────────────────────────────────────────────── */

/**
 * One doorway. Unlit it is sand with the step's mark in it; lit, the sky goes
 * dark, the sun comes up behind the mark, and the mark turns to bone. The last
 * one, once reached, keeps a small amber light breathing in its corner: the
 * same "waiting on you" signal as the hero's card.
 */
function Doorway({
  icon: Icon,
  lit,
  waiting = false,
  className,
}: {
  icon: LucideIcon;
  lit: boolean;
  waiting?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'm-arch relative grid place-items-center overflow-hidden border transition-colors duration-700',
        lit ? 'border-[var(--m-ink)] bg-[var(--m-ink)]' : 'border-[var(--m-line-2)] bg-[var(--m-bg-3)]',
        className,
      )}
    >
      <span
        className={cn(
          'absolute top-[24%] left-1/2 aspect-square w-[62%] -translate-x-1/2 rounded-full bg-[var(--m-sun)] transition-[opacity,translate] duration-700 ease-out',
          lit ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
        )}
      />
      <Icon
        className={cn(
          'relative mt-[18%] size-[34%] transition-colors duration-700',
          lit ? 'text-[var(--m-ink)]' : 'text-[var(--m-dim-2)]',
        )}
        strokeWidth={1.75}
      />
      {waiting && (
        <span className="absolute right-[18%] bottom-[12%] size-1.5 animate-[breathe_4.5s_ease-in-out_infinite] rounded-full bg-[var(--m-amber)]" />
      )}
    </span>
  );
}

/**
 * The sheet of work. It gathers marks as it travels: lines when it has been
 * read in, a total bar once the figures are worked out, ticks and one line set
 * aside once it is checked, and a dashed place for a signature at the end.
 */
function Sheet({ stage }: { stage: number }) {
  const worked = stage >= 1;
  const checked = stage >= 2;
  const yours = stage >= 3;

  return (
    <div className="m-card m-ring w-[10.5rem] rounded-xl p-3.5 shadow-[var(--m-shadow)] xl:w-[11.5rem]">
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-[var(--m-gold)]" />
        <span className="h-1.5 w-12 rounded-full bg-[var(--m-line-2)]" />
      </div>

      <ul className="mt-3 space-y-2">
        {[0.92, 0.7, 0.84, 0.6].map((w, i) => {
          const aside = checked && i === 2;
          return (
            <li key={i} className="flex items-center gap-1.5">
              <span
                className={cn(
                  'grid size-3 shrink-0 place-items-center rounded-full transition-[opacity,scale] duration-500',
                  checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
                  aside ? 'bg-[var(--m-wait-wash)] ring-1 ring-[var(--m-wait-line)]' : 'bg-[color-mix(in_oklab,var(--m-emerald)_18%,transparent)]',
                )}
                style={{ transitionDelay: checked ? `${i * 90}ms` : '0ms' }}
              >
                {!aside && <Check className="size-2 text-[var(--m-emerald)]" strokeWidth={3} />}
              </span>
              <span
                className="h-1.5 rounded-full transition-colors duration-500"
                style={{
                  width: `${w * 100}%`,
                  background: aside ? 'var(--m-wait-line)' : 'var(--m-line-2)',
                }}
              />
            </li>
          );
        })}
      </ul>

      {/* The worked-out total: a bar where a figure would go. */}
      <div className="mt-3 flex items-center justify-between border-t border-[var(--m-line)] pt-2.5">
        <span className="h-1.5 w-8 rounded-full bg-[var(--m-line-2)]" />
        <span
          className={cn(
            'h-2.5 origin-right rounded-full bg-[var(--m-ink)] transition-[scale] duration-700 ease-out',
            worked ? 'scale-x-100' : 'scale-x-0',
          )}
          style={{ width: '45%' }}
        />
      </div>

      {/* Where the person signs. */}
      <div
        className={cn(
          'mt-3 flex h-7 items-center justify-center gap-1.5 rounded-md border border-dashed transition-colors duration-500',
          yours ? 'border-[var(--m-wait-line)] bg-[var(--m-wait-wash)]' : 'border-[var(--m-line)]',
        )}
      >
        <PenLine
          className={cn('size-3 transition-colors duration-500', yours ? 'text-[var(--m-wait)]' : 'text-[var(--m-line-2)]')}
        />
        <span
          className={cn(
            'm-mono t-1 t-caps uppercase transition-opacity duration-500',
            yours ? 'text-[var(--m-wait)] opacity-100' : 'opacity-0',
          )}
        >
          Your call
        </span>
      </div>
    </div>
  );
}
