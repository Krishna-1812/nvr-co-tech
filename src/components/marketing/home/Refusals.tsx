'use client';

import { useState } from 'react';
import { CornerDownRight, Database, ShieldX, TriangleAlert } from 'lucide-react';
import { REFUSALS } from '@/lib/marketing/content';
import { cn } from '@/lib/utils';
import { Container, Eyebrow } from '../bits';
import { Reveal } from '../Reveal';

/**
 * Three things the database will not let you do, and the message it returns.
 *
 * Everything else on this page describes enforcement. This section shows it: pick
 * an attempt and read the exact string Postgres raises, with the function and
 * migration file it comes from. Every one of those strings is copied verbatim
 * from supabase/migrations — see the note on REFUSALS in the content module.
 *
 * Interactive rather than a list of three because a reader who chooses the
 * attempt has to think about it for a moment first, and that moment is the
 * difference between reading a claim and testing one.
 */
export function Refusals() {
  const [active, setActive] = useState(0);
  const current = REFUSALS[active];

  return (
    <section className="relative border-t border-[var(--m-line)] py-20 sm:py-28">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(80% 60% at 50% 0%, color-mix(in oklab, var(--m-rose) 9%, transparent), transparent)',
        }}
      />

      <Container className="relative">
        <Reveal>
          <Eyebrow className="mb-4">See for yourself</Eyebrow>
          <h2 className="m-display max-w-3xl text-[clamp(1.9rem,4.2vw,3.25rem)]">
            Try to break it. <span className="m-serif m-grad-text">Read what it says.</span>
          </h2>
          <p className="m-dim mt-5 max-w-2xl text-[15px] leading-relaxed sm:text-base">
            Rules written in a document are a promise. Rules written into the database are a refusal.
            Pick something you should not be able to do, and see what comes back.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          {/* ── The three attempts ── */}
          <Reveal>
            <div
              role="tablist"
              aria-label="Things the database refuses"
              className="flex flex-col gap-3"
            >
              {REFUSALS.map((r, i) => {
                const on = i === active;
                return (
                  <button
                    key={r.id}
                    role="tab"
                    type="button"
                    aria-selected={on}
                    onClick={() => setActive(i)}
                    className={cn(
                      'group flex items-start gap-3.5 rounded-2xl border px-4 py-4 text-left transition-all duration-300',
                      on
                        ? 'border-[color-mix(in_oklab,var(--m-rose)_38%,transparent)] bg-[color-mix(in_oklab,var(--m-rose)_9%,transparent)]'
                        : 'border-[var(--m-line)] bg-white/[0.02] hover:border-[var(--m-line-2)] hover:bg-white/[0.04]',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-px grid size-7 shrink-0 place-items-center rounded-lg border transition-colors',
                        on
                          ? 'border-transparent bg-[color-mix(in_oklab,var(--m-rose)_22%,transparent)] text-[var(--m-rose)]'
                          : 'm-dim-2 border-[var(--m-line)]',
                      )}
                    >
                      <ShieldX className="size-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          'block text-[14px] font-semibold transition-colors',
                          on ? 'text-[var(--m-ink)]' : 'm-dim group-hover:text-[var(--m-ink)]',
                        )}
                      >
                        {r.attempt}
                      </span>
                      <span className="m-mono m-dim-2 mt-1.5 block text-[10px] tracking-[0.08em]">
                        {r.where}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Reveal>

          {/* ── What comes back ── */}
          <Reveal delay={90}>
            {/*
              Keyed on the selection so the whole console replays its entrance.
              The point of the section is the answer arriving, and reconciling
              the text in place would make it change with no motion at all.
            */}
            <div
              key={current.id}
              className="m-ring animate-[pop_0.4s_cubic-bezier(0.22,1,0.36,1)] overflow-hidden rounded-2xl"
              style={{ background: 'oklch(0.105 0.014 268)' }}
            >
              <div className="flex items-center gap-2.5 border-b border-[var(--m-line)] px-4 py-3">
                <Database className="size-3.5 text-[var(--m-dim-2)]" aria-hidden />
                <span className="m-mono m-dim-2 text-[10px] tracking-[0.14em] uppercase">
                  postgres response
                </span>
                <span className="ml-auto flex gap-1.5" aria-hidden>
                  {['var(--m-rose)', 'var(--m-amber)', 'var(--m-emerald)'].map((c) => (
                    <span key={c} className="size-2 rounded-full opacity-45" style={{ background: c }} />
                  ))}
                </span>
              </div>

              <div className="px-5 py-5">
                <p className="m-mono m-dim-2 flex items-start gap-2 text-[11.5px] leading-relaxed">
                  <CornerDownRight className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span className="break-all">{current.call}</span>
                </p>

                <div className="mt-4 flex items-start gap-3 rounded-xl border border-[color-mix(in_oklab,var(--m-rose)_34%,transparent)] bg-[color-mix(in_oklab,var(--m-rose)_10%,transparent)] px-4 py-3.5">
                  <TriangleAlert
                    className="mt-0.5 size-4 shrink-0 text-[var(--m-rose)]"
                    aria-hidden
                  />
                  <p className="m-mono text-[12.5px] leading-relaxed text-[color-mix(in_oklab,var(--m-rose)_66%,white)]">
                    ERROR: {current.error}
                  </p>
                </div>

                <p className="m-dim mt-5 text-[13.5px] leading-relaxed">{current.why}</p>

                {/* How far the rule actually reaches, stated per rule. Two of
                    these are functions and one is a trigger, and those are not
                    the same guarantee. */}
                <p className="m-dim-2 mt-5 border-t border-[var(--m-line)] pt-4 text-[11px] leading-relaxed">
                  {current.holds}
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
