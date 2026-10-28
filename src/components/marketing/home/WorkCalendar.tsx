'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { JOBS } from '@/lib/marketing/content';
import { cn } from '@/lib/utils';
import { ArrowLink, Container, Eyebrow } from '../bits';
import { Reveal } from '../Reveal';
import { ScrollWords } from '../play/ScrollWords';
import { Roost } from '@/components/brand/Owl';

/**
 * The finance month: eight jobs a finance team repeats, and their dates.
 *
 * About the work, not about us. Until 18 Oct each job carried the tool that
 * takes it on, a badge saying whether that tool was built, and a "Handled by"
 * link; with the month opening on TDS, the section read as a page about one
 * tool. The owner asked for it to be generic, so each job now says how it
 * usually goes and what it looks like done well, as good practice anyone would
 * recognise, and names nothing we sell. One colour for every job, for the same
 * reason: the tools' own colours were the last trace of the roster here.
 *
 * The ruler carries only the three statutory dates we are certain of for a
 * monthly filer. See the note on JOBS for why, and the footnote under the ruler
 * for what a reader on a different filing frequency should take from it.
 */

/** Short captions for the ruler. Presentation only, so they live here. */
const MARK: Record<string, string> = {
  'tds-deposit': 'TDS deposit',
  'gst-match': '2B available',
  'gst-claim': 'GSTR-3B',
};

const DATED = JOBS.filter((j) => j.day !== undefined);

/** The site's accent, for every job alike; see the note above. */
const ACCENT = 'var(--m-gold)';

/** Day 1 sits at 0% and day 31 at 100%, which is also how the ticks are placed. */
const at = (day: number) => `${((day - 1) / 30) * 100}%`;

export function WorkCalendar() {
  const [active, setActive] = useState(2);
  const job = JOBS[active];

  return (
    <section id="work" className="relative border-t border-[var(--m-line)] bg-[var(--m-bg-2)] py-20 sm:py-28">
      <span
        aria-hidden
        className="m-dots pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(70%_60%_at_50%_30%,#000,transparent)]"
      />

      <Roost seed="calendar-belfry" band="top-left" />
      <Roost seed="calendar-ledge" band="bottom-right" />

      <Container wide className="relative">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="max-w-3xl">
              <Eyebrow className="mb-4">The work</Eyebrow>
              <h2 className="m-display s-settle t-h2">
                Every month, the same jobs.{' '}
                <span className="m-serif m-grad-text">On the same dates.</span>
              </h2>
              {/* Read into ink as it scrolls past; see play/ScrollWords. */}
              <ScrollWords
                className="mt-5 max-w-2xl t-4 text-[var(--m-ink)] sm:t-5"
                text="None of this is new work. It is the list every finance team gets through between the 1st and the 31st, whatever the size of the business. Pick a job to see how it usually goes, and what it looks like done well."
              />
            </div>
            {/*
              The one way from this section to the roster, kept as a plain
              link: the section itself no longer names a tool.
            */}
            <ArrowLink href="/tools" className="mb-2">
              All tools
            </ArrowLink>
          </div>
        </Reveal>

        <Reveal delay={70}>
          <Ruler activeId={job.id} onPick={(id) => setActive(JOBS.findIndex((j) => j.id === id))} />
        </Reveal>

        <Reveal delay={110}>
          <div className="m-card m-ring mt-10 grid overflow-hidden rounded-3xl lg:grid-cols-[0.92fr_1fr] shadow-[var(--m-shadow)]">
            {/* ── The jobs ── */}
            <ul className="divide-y divide-[var(--m-line)]">
              {JOBS.map((j, i) => {
                const on = i === active;
                return (
                  <li key={j.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setActive(i)}
                      className={cn(
                        'group flex w-full items-center gap-4 px-5 py-4 text-left transition sm:px-6',
                        on ? 'bg-[var(--m-bg)]' : 'hover:bg-[var(--m-bg)]/60',
                      )}
                    >
                      {/* Lit only on the active row, so the eye has one place to be. */}
                      <span
                        aria-hidden
                        className="h-8 w-[3px] shrink-0 rounded-full transition-opacity"
                        style={{
                          background: ACCENT,
                          opacity: on ? 1 : 0.22,
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="m-mono m-dim-2 block t-1 t-caps uppercase">
                          {j.when}
                        </span>
                        <span
                          className={cn(
                            'mt-1 block t-3 transition-colors',
                            on ? 'font-semibold text-[var(--m-ink)]' : 'm-dim',
                          )}
                        >
                          {j.title}
                        </span>
                      </span>
                      <ArrowRight
                        aria-hidden
                        className={cn(
                          'size-3.5 shrink-0 transition-all',
                          on
                            ? 'translate-x-0 text-[var(--m-ink)] opacity-100'
                            : '-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-40',
                        )}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* ── What happens to it ── */}
            <div className="relative overflow-hidden border-t border-[var(--m-line)] bg-[var(--m-bg)] p-6 sm:p-8 lg:border-t-0 lg:border-l">
              {/* A doorway with the sun in it, standing in the panel's corner. */}
              <span
                aria-hidden
                className="m-arch pointer-events-none absolute -top-6 right-8 h-36 w-24 bg-[var(--m-sun)] opacity-[0.22]"
              />

              {/* Keyed on the job so the panel replays its entrance on every pick. */}
              <div key={job.id} className="relative animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)]">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="m-mono rounded-full border px-2.5 py-1 t-1 t-caps uppercase"
                    style={{
                      color: ACCENT,
                      borderColor: `color-mix(in oklab, ${ACCENT} 34%, transparent)`,
                      background: `color-mix(in oklab, ${ACCENT} 10%, transparent)`,
                    }}
                  >
                    {job.when}
                  </span>
                </div>

                <h3 className="m-display mt-5 pr-16 t-h5 sm:pr-28">
                  {job.title}
                </h3>

                <div className="mt-6 space-y-5">
                  <Block label="How it usually goes" body={job.now} />
                  <Block label="What good looks like" body={job.good} accent={ACCENT} />
                </div>

              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

/**
 * The month as an axis, with the three dates that do not move.
 *
 * Thirty-one ticks rather than a plain rule, because a bare line with three dots
 * on it does not read as a month. Only the dated jobs are markers; the ones that
 * run all month or land at a month, quarter or year end are in the list instead,
 * where they are not pretending to have a date.
 */
function Ruler({ activeId, onPick }: { activeId: string; onPick: (id: string) => void }) {
  return (
    <div className="mt-12">
      {/* Shorter where the captions are hidden, so their absence is not a gap. */}
      <div className="relative h-[4.75rem] sm:h-24">
        {DATED.map((j) => {
          const on = j.id === activeId;
          const accent = ACCENT;
          return (
            <button
              key={j.id}
              type="button"
              aria-pressed={on}
              // The caption is hidden on a phone and the day is drawn aria-hidden,
              // so the button carries its own name.
              aria-label={`${MARK[j.id]}, on the ${j.day}th`}
              onClick={() => onPick(j.id)}
              className="group absolute bottom-0 flex -translate-x-1/2 flex-col items-center focus-visible:outline-none"
              style={{ left: at(j.day!) }}
            >
              <span
                // Hidden on the narrowest screens, where three captions in
                // 335px of axis would sit on top of each other. The numbered
                // dots still say which date each one is.
                className={cn(
                  'm-mono hidden whitespace-nowrap t-1 t-caps uppercase transition-colors sm:block',
                  on ? 'text-[var(--m-ink)]' : 'm-dim-2 group-hover:text-[var(--m-ink)]',
                )}
              >
                {MARK[j.id]}
              </span>
              <span
                aria-hidden
                className="mt-2 w-px transition-opacity"
                style={{
                  background: `linear-gradient(to bottom, transparent, ${accent})`,
                  opacity: on ? 1 : 0.35,
                  height: '2.6rem',
                }}
              />
              <span
                aria-hidden
                className={cn(
                  'mt-1.5 grid size-7 place-items-center rounded-full border t-1 font-semibold transition-all',
                  // The button drops the browser's outline, so the dot shows focus.
                  'group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-[var(--m-ink)]',
                  on ? undefined : 'm-dim border-[var(--m-line-2)] bg-[var(--m-bg)]',
                )}
                style={
                  on
                    ? {
                        background: accent,
                        borderColor: accent,
                        color: 'var(--m-on-grad)',
                        boxShadow: `0 0 0 6px color-mix(in oklab, ${accent} 14%, transparent)`,
                      }
                    : undefined
                }
              >
                {j.day}
              </span>
            </button>
          );
        })}
      </div>

      {/* The axis itself, with a tick per day. */}
      <div className="relative h-3">
        <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-[var(--m-line-2)]" />
        {Array.from({ length: 31 }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              'absolute top-0 w-px -translate-x-1/2 bg-[var(--m-line-2)]',
              i % 5 === 0 ? 'h-2' : 'h-1',
            )}
            style={{ left: at(i + 1) }}
          />
        ))}
      </div>

      <div className="m-mono m-dim-2 mt-1.5 flex justify-between t-1 t-caps">
        <span>1st</span>
        <span>31st</span>
      </div>

      <p className="m-dim-2 mt-5 max-w-xl t-2">
        Those are the usual dates for a monthly filer. If you are on QRMP, or a date gets pushed
        back, yours will be different. The jobs without a date are the ones that run all month or
        land at a month, quarter or year end.
      </p>
    </div>
  );
}

function Block({ label, body, accent }: { label: string; body: string; accent?: string }) {
  return (
    <div
      className={cn('pl-4', accent ? 'border-l' : 'border-l border-[var(--m-line-2)]')}
      style={accent ? { borderColor: `color-mix(in oklab, ${accent} 45%, transparent)` } : undefined}
    >
      <p className="m-eyebrow" style={accent ? { color: accent } : undefined}>
        {label}
      </p>
      <p
        className={cn(
          'mt-2 t-3',
          accent ? 'text-[var(--m-ink)]' : 'm-dim-2',
        )}
      >
        {body}
      </p>
    </div>
  );
}
