'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Agent } from '@/lib/marketing/content';
import { ACCENT, ON_ACCENT, StageBadge } from '../bits';
import { Reveal } from '../Reveal';
import { clamp, reducedMotion, subscribe } from '../scroll';

/**
 * The roster on /about, in build order, read down a spine.
 *
 * A line runs down the left of the list and fills in terracotta as the reader
 * scrolls through it. Each tool's number sits on the line, and lights up in
 * that tool's own colour the moment the fill reaches it, so the list reads as a
 * sequence being walked rather than a table being scanned — which is the point
 * the section heading makes ("One that works, then the next one").
 *
 * The fill is measured against a line 60% of the way down the window, the
 * height a reader's eye actually rests at, not the top or bottom edge.
 *
 * Under reduced motion the spine is drawn full and every number lit from the
 * start: the picture without the movement. Added 17 Oct, when the owner asked
 * for the About page to move as the home page does.
 */
export function RoadmapList({ agents }: { agents: readonly Agent[] }) {
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const ol = list.current;
    if (!ol) return;
    const rows = Array.from(ol.querySelectorAll<HTMLElement>('[data-row]'));

    if (reducedMotion()) {
      ol.style.setProperty('--fill', '1');
      rows.forEach((r) => (r.dataset.on = ''));
      return;
    }
    // Rows wait, dimmed, for the spine only once this has run: without
    // scripting the list is simply shown (see .m-road in globals.css).
    ol.dataset.armed = '';

    const read = () => {
      const eye = window.innerHeight * 0.6;
      const box = ol.getBoundingClientRect();
      ol.style.setProperty('--fill', clamp((eye - box.top) / box.height).toFixed(4));
      for (const row of rows) {
        const r = row.getBoundingClientRect();
        if (r.top + r.height / 2 < eye) row.dataset.on = '';
        else delete row.dataset.on;
      }
    };

    const stop = subscribe(read);
    read();
    return stop;
  }, []);

  return (
    <ol
      ref={list}
      className="m-road relative mt-12 border-t border-[var(--m-line)]"
      style={{ '--fill': 0 } as React.CSSProperties}
    >
      {/* The spine: a hairline, and the fill drawn down it. Centred on the
          number pills, which are 2rem wide. */}
      <span aria-hidden className="absolute top-0 bottom-0 left-4 w-px -translate-x-1/2 bg-[var(--m-line)]" />
      <span
        aria-hidden
        className="absolute top-0 bottom-0 left-4 w-[2px] origin-top -translate-x-1/2 bg-[var(--m-gold)]"
        style={{ transform: 'scaleY(var(--fill))' }}
      />

      {agents.map((agent, i) => (
        <Reveal as="li" key={agent.slug} delay={i * 45} className="border-b border-[var(--m-line)]">
          <div
            data-row
            className="m-road-row relative"
            style={
              {
                '--row-accent': ACCENT[agent.accent],
                '--row-on': ON_ACCENT[agent.accent],
              } as React.CSSProperties
            }
          >
            <span
              aria-hidden
              className="m-road-num m-mono absolute top-6 left-0 grid size-8 place-items-center rounded-full border t-1 font-semibold tabular-nums"
            >
              {String(i + 1).padStart(2, '0')}
            </span>

            <Link
              href={`/tools/${agent.slug}`}
              className="group flex flex-col gap-3 py-6 pl-14 sm:flex-row sm:items-center sm:gap-6"
            >
              <span className="min-w-0 flex-1">
                <span className="m-display block t-5 transition-colors group-hover:text-[var(--m-cyan)]">
                  {agent.name}
                </span>
                <span className="m-dim-2 mt-1 block t-3">{agent.category}</span>
              </span>

              <span className="m-dim hidden max-w-md flex-1 t-3 lg:block">{agent.summary}</span>

              <span className="flex shrink-0 items-center gap-4">
                <StageBadge stage={agent.stage} />
                <ArrowRight aria-hidden className="m-dim-2 size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </div>
        </Reveal>
      ))}
    </ol>
  );
}
