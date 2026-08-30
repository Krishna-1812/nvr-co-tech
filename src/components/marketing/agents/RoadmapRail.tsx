'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AGENTS, STAGE_LABEL } from '@/lib/marketing/content';
import { cn } from '@/lib/utils';
import { ACCENT, Container, Eyebrow } from '../bits';
import { Reveal } from '../Reveal';

/**
 * The roster as a sequence rather than a grid.
 *
 * The grid below answers "what is there". This answers "in what order", which is
 * the question a buyer looking at five unbuilt agents actually has. The rail is
 * solid up to the last shipped agent and dashed after it, which is the same
 * distinction the badges make, drawn once at the scale of the whole roadmap.
 *
 * Selection is by click, not hover. Hover-only disclosure is unreachable by
 * keyboard and unusable on touch, and the panel underneath is the substance.
 */
export function RoadmapRail() {
  const [active, setActive] = useState(0);
  const agent = AGENTS[active];
  // Everything up to and including the last shipped agent is a known quantity.
  const lastShipped = AGENTS.reduce((n, a, i) => (a.stage === 'live' ? i : n), 0);

  return (
    <section className="relative border-t border-[var(--m-line)] py-16 sm:py-20">
      <Container wide>
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>Shipping order</Eyebrow>
              <h2 className="m-display s-settle mt-3 text-[clamp(1.5rem,3vw,2.1rem)]">
                Built one at a time, <span className="m-serif m-dim">in this order.</span>
              </h2>
            </div>
            <p className="m-dim-2 max-w-sm text-[12.5px] leading-relaxed">
              Each one starts when the one before it is properly finished. Pick any of them to see
              what it does.
            </p>
          </div>
        </Reveal>

        {/* ── The rail ── */}
        <Reveal delay={80}>
          <ol className="mt-12 flex flex-col gap-1 md:flex-row md:items-start md:gap-0">
            {AGENTS.map((a, i) => {
              const on = i === active;
              const solid = i <= lastShipped;
              const accent = ACCENT[a.accent];

              return (
                <li key={a.slug} className="relative flex min-w-0 gap-4 md:flex-1 md:flex-col md:gap-0">
                  {/*
                    The connecting line. Drawn per node as a segment behind the
                    dot rather than as one line under the row, so it can change
                    style at the exact point the roadmap becomes speculative.
                  */}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute md:top-[13px] md:right-0 md:left-0 md:h-px',
                      'top-[13px] bottom-0 left-[13px] w-px md:bottom-auto md:w-auto',
                      i === 0 && 'md:left-1/2',
                      /*
                       * Stacked, the segment runs from this dot down to the next
                       * one, so the last node must not have one — it would trail
                       * off the bottom of the rail into nothing. In a row it
                       * still needs its half-segment coming in from the left.
                       */
                      i === AGENTS.length - 1 && 'hidden md:right-1/2 md:block',
                    )}
                    style={{
                      background: solid
                        ? 'var(--m-line-2)'
                        : 'repeating-linear-gradient(to right, var(--m-line-2) 0 4px, transparent 4px 9px)',
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-pressed={on}
                    className="group relative flex min-w-0 flex-1 items-start gap-4 pb-6 text-left md:flex-col md:items-center md:gap-0 md:pb-0 md:text-center"
                  >
                    <span
                      className={cn(
                        'relative grid size-[27px] shrink-0 place-items-center rounded-full border-2 transition-all duration-300',
                        on ? 'scale-110' : 'group-hover:scale-105',
                      )}
                      style={{
                        borderColor: on || solid ? accent : 'var(--m-line-2)',
                        background: on
                          ? accent
                          : solid
                            ? `color-mix(in oklab, ${accent} 22%, transparent)`
                            : 'var(--m-bg)',
                        boxShadow: on ? `0 0 0 6px color-mix(in oklab, ${accent} 16%, transparent)` : undefined,
                      }}
                    >
                      {a.stage === 'live' && (
                        <span
                          aria-hidden
                          className="absolute inset-0 animate-[halo_2.8s_ease-out_infinite] rounded-full border-2 motion-reduce:hidden"
                          style={{ borderColor: accent }}
                        />
                      )}
                      <span className="m-mono text-[9px] font-bold" style={{ color: on ? 'var(--m-bg)' : accent }}>
                        {i + 1}
                      </span>
                    </span>

                    <span className="min-w-0 md:mt-4 md:px-2">
                      <span
                        className={cn(
                          'block truncate text-[13px] font-semibold transition-colors md:whitespace-normal',
                          on ? 'text-[var(--m-ink)]' : 'm-dim group-hover:text-[var(--m-ink)]',
                        )}
                      >
                        {a.name}
                      </span>
                      <span className="m-mono m-dim-2 mt-1 block text-[9.5px] tracking-[0.1em] uppercase">
                        {STAGE_LABEL[a.stage]}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </Reveal>

        {/* ── What the selected one is ── */}
        <Reveal delay={140}>
          <div
            key={agent.slug}
            className="m-card m-ring mt-10 animate-[pop_0.4s_cubic-bezier(0.22,1,0.36,1)] overflow-hidden rounded-2xl md:mt-14"
          >
            <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
              <div>
                <p
                  className="m-mono text-[10px] tracking-[0.14em] uppercase"
                  style={{ color: ACCENT[agent.accent] }}
                >
                  {agent.category}
                </p>
                <h3 className="m-display mt-3 text-[clamp(1.4rem,2.6vw,2rem)]">{agent.name}</h3>
                <p className="m-dim mt-4 text-[14.5px] leading-relaxed">{agent.summary}</p>

                <Link
                  href={`/agents/${agent.slug}`}
                  className="m-mono mt-7 inline-flex items-center gap-2 text-[10px] tracking-[0.14em] uppercase transition-colors hover:text-[var(--m-cyan)]"
                >
                  Read more about it
                  <ArrowRight className="size-3" aria-hidden />
                </Link>
              </div>

              <dl className="grid content-start gap-4 border-t border-[var(--m-line)] pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
                <div>
                  <dt className="m-eyebrow">Takes in</dt>
                  <dd className="m-dim mt-1.5 text-[13px]">{agent.inputs}</dd>
                </div>
                <div>
                  <dt className="m-eyebrow">Gives back</dt>
                  <dd className="m-dim mt-1.5 text-[13px]">{agent.outputs}</dd>
                </div>
              </dl>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
