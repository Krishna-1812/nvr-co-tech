'use client';

import { useEffect, useRef, useState } from 'react';
import { Letters } from '@/components/marketing/play/Letters';
import { Springy } from '@/components/marketing/play/Springy';

/**
 * The heading over each group of cards on the workspace: a count in a tile,
 * the group's name, a rule and a line of small print.
 *
 * It plays when it is scrolled to rather than at load, because the second one
 * sits well below the fold: the count pops on a spring, the name's letters
 * rise one after another and then lean towards the pointer like the hero's,
 * and the rule draws itself out to the small print.
 *
 * The server's HTML is the finished heading. Only once this has mounted does
 * it hide the pieces that are about to play (`data-w="armed"`), so with
 * scripting off or under reduced motion nothing is ever hidden. Shared by the
 * admin's workspace and the open one, which had each kept a copy.
 */
export function SectionHead({ id, count, title, note }: { id: string; count: number; title: string; note: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [risen, setRisen] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.dataset.w = 'armed';
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        el.dataset.w = 'in';
        setRisen(true);
        io.disconnect();
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={host} className="w-head flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 items-center gap-3">
        <span className="w-count surface-sunken a-inner grid h-9 min-w-9 place-items-center rounded-xl border px-2 text-[15px] font-semibold tracking-tight tabular-nums">
          {count}
        </span>
        <Springy as="h2" id={id} armed={risen} delay={1100} className="m-display text-[1.45rem] leading-tight">
          <Letters text={title} />
        </Springy>
      </div>
      <span
        aria-hidden
        className="w-rule mb-2 hidden h-px min-w-10 flex-1 bg-[linear-gradient(90deg,var(--border-strong),transparent)] sm:block"
      />
      <p className="text-subtle text-[12px] text-pretty">{note}</p>
    </div>
  );
}
