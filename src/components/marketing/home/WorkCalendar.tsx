'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { JOBS, agentBySlug } from '@/lib/marketing/content';
import { cn } from '@/lib/utils';
import { ACCENT, ArrowLink, Container, Eyebrow, StageBadge } from '../bits';
import { Reveal } from '../Reveal';

/**
 * The finance month, and which tool takes each job.
 *
 * This sits high on the page on purpose. Everything below it is Voucher Desk,
 * because Voucher Desk is the one that exists, and a reader who meets the deep
 * dive first comes away thinking we sell one thing. Here the subject is the work
 * rather than the product: eight jobs a finance team already repeats, with our
 * name against the part we take on and a badge saying honestly whether that part
 * is built.
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

/** Day 1 sits at 0% and day 31 at 100%, which is also how the ticks are placed. */
const at = (day: number) => `${((day - 1) / 30) * 100}%`;

export function WorkCalendar() {
  const [active, setActive] = useState(2);
  const job = JOBS[active];
  const agent = agentBySlug(job.agent);
  const accent = agent ? ACCENT[agent.accent] : 'var(--m-indigo)';

  return (
    <section id="work" className="relative border-t border-[var(--m-line)] py-20 sm:py-28">
      <span
        aria-hidden
        className="m-dots pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(70%_60%_at_50%_30%,#000,transparent)]"
      />

      <Container wide className="relative">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="max-w-3xl">
              <Eyebrow className="mb-4">The work</Eyebrow>
              <h2 className="m-display text-[clamp(1.9rem,4.2vw,3.25rem)]">
                Every month, the same jobs.{' '}
                <span className="m-serif m-grad-text">Here is who does what.</span>
              </h2>
              <p className="m-dim mt-5 max-w-2xl text-[15px] leading-relaxed sm:text-base">
                None of this is new work. It is the list your team already gets through between the
                1st and the 31st. What changes is how much of it somebody has to do by hand, and how
                much of it is waiting for you when the date comes round.
              </p>
            </div>
            {/*
              The only way from this page into the roster, now that the grid of
              six product cards two screens below it is gone. It belongs here
              because this is the section that introduces them.
            */}
            <ArrowLink href="/agents" className="mb-2">
              All agents
            </ArrowLink>
          </div>
        </Reveal>

        <Reveal delay={70}>
          <Ruler activeId={job.id} onPick={(id) => setActive(JOBS.findIndex((j) => j.id === id))} />
        </Reveal>

        <Reveal delay={110}>
          <div className="m-card m-ring mt-10 grid overflow-hidden rounded-3xl lg:grid-cols-[0.92fr_1fr]">
            {/* ── The jobs ── */}
            <ul className="divide-y divide-[var(--m-line)]">
              {JOBS.map((j, i) => {
                const a = agentBySlug(j.agent);
                const on = i === active;
                return (
                  <li key={j.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setActive(i)}
                      className={cn(
                        'group flex w-full items-center gap-4 px-5 py-4 text-left transition sm:px-6',
                        on ? 'bg-white/[0.05]' : 'hover:bg-white/[0.025]',
                      )}
                    >
                      {/* Lit only on the active row, so the eye has one place to be. */}
                      <span
                        aria-hidden
                        className="h-8 w-[3px] shrink-0 rounded-full transition-opacity"
                        style={{
                          background: a ? ACCENT[a.accent] : 'var(--m-line-2)',
                          opacity: on ? 1 : 0.22,
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="m-mono m-dim-2 block text-[10px] tracking-[0.14em] uppercase">
                          {j.when}
                        </span>
                        <span
                          className={cn(
                            'mt-1 block text-[13.5px] leading-snug transition-colors',
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
            <div className="relative overflow-hidden border-t border-[var(--m-line)] bg-white/[0.022] p-6 sm:p-8 lg:border-t-0 lg:border-l">
              <span
                aria-hidden
                className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full opacity-[0.18] blur-3xl transition-colors duration-500"
                style={{ background: accent }}
              />

              {/* Keyed on the job so the panel replays its entrance on every pick. */}
              <div key={job.id} className="relative animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)]">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="m-mono rounded-full border px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase"
                    style={{
                      color: accent,
                      borderColor: `color-mix(in oklab, ${accent} 34%, transparent)`,
                      background: `color-mix(in oklab, ${accent} 10%, transparent)`,
                    }}
                  >
                    {job.when}
                  </span>
                  {agent && <StageBadge stage={agent.stage} />}
                </div>

                <h3 className="m-display mt-5 text-[clamp(1.35rem,2.2vw,1.75rem)] leading-tight">
                  {job.title}
                </h3>

                <div className="mt-6 space-y-5">
                  <Block label="How it goes now" body={job.now} />
                  <Block label="What we take on" body={job.ours} accent={accent} />
                </div>

                {agent && (
                  <Link
                    href={`/agents/${agent.slug}`}
                    className="group mt-7 inline-flex items-center gap-2 border-t border-[var(--m-line)] pt-5 text-[13px] font-semibold text-[var(--m-ink)] transition hover:text-[var(--m-cyan)]"
                  >
                    <span className="m-mono m-dim-2 text-[10px] tracking-[0.14em] uppercase">
                      Handled by
                    </span>
                    {agent.name}
                    <ArrowRight
                      className="size-3.5 transition-transform group-hover:translate-x-1"
                      aria-hidden
                    />
                  </Link>
                )}
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
          const agent = agentBySlug(j.agent);
          const accent = agent ? ACCENT[agent.accent] : 'var(--m-indigo)';
          return (
            <button
              key={j.id}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(j.id)}
              className="group absolute bottom-0 flex -translate-x-1/2 flex-col items-center focus-visible:outline-none"
              style={{ left: at(j.day!) }}
            >
              <span
                // Hidden on the narrowest screens, where three captions in
                // 335px of axis would sit on top of each other. The numbered
                // dots still say which date each one is.
                className={cn(
                  'm-mono hidden whitespace-nowrap text-[10px] tracking-[0.12em] uppercase transition-colors sm:block',
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
                  'mt-1.5 grid size-7 place-items-center rounded-full border text-[10px] font-semibold transition-all',
                  on ? 'text-[var(--m-bg)]' : 'm-dim border-[var(--m-line-2)] bg-[var(--m-bg)]',
                )}
                style={
                  on
                    ? {
                        background: accent,
                        borderColor: accent,
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

      <div className="m-mono m-dim-2 mt-1.5 flex justify-between text-[10px] tracking-[0.14em]">
        <span>1st</span>
        <span>31st</span>
      </div>

      <p className="m-dim-2 mt-5 max-w-xl text-[11.5px] leading-relaxed">
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
          'mt-2 text-[13.5px] leading-relaxed',
          accent ? 'text-[var(--m-ink)]' : 'm-dim-2',
        )}
      >
        {body}
      </p>
    </div>
  );
}
