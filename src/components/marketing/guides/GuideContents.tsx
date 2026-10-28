'use client';

import { useEffect, useRef, useState } from 'react';
import { clamp, subscribe } from '../scroll';
import { cn } from '@/lib/utils';

/**
 * The contents list, made to follow the reader.
 *
 * A gold marker slides to the section being read, and a ring at the top fills
 * as the article goes by, with the minutes left beside it. Plain anchor links
 * underneath, so without scripting it is an ordinary table of contents.
 */
export function GuideContents({
  sections,
  minutes,
  articleId,
}: {
  sections: { id: string; label: string }[];
  minutes: number;
  articleId: string;
}) {
  const list = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [marker, setMarker] = useState({ y: 0, h: 0 });

  useEffect(() => {
    const read = () => {
      const line = window.innerHeight * 0.3;
      let current = 0;
      sections.forEach((s, i) => {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) current = i;
      });
      setActive(current);

      const article = document.getElementById(articleId);
      if (article) {
        const r = article.getBoundingClientRect();
        setProgress(clamp((line - r.top) / Math.max(1, r.height - line)));
      }
    };
    const stop = subscribe(read);
    read();
    return stop;
  }, [sections, articleId]);

  useEffect(() => {
    const item = list.current?.children[active] as HTMLElement | undefined;
    if (item) setMarker({ y: item.offsetTop, h: item.offsetHeight });
  }, [active]);

  const R = 15;
  const C = 2 * Math.PI * R;
  const left = Math.max(0, Math.ceil(minutes * (1 - progress)));

  return (
    <nav aria-label="Contents" className="m-card rounded-3xl p-5 shadow-[0_24px_44px_-34px_rgb(80_40_20_/_0.55)]">
      <div className="flex items-center gap-3">
        <svg aria-hidden width="38" height="38" viewBox="0 0 38 38" className="-rotate-90">
          <circle cx="19" cy="19" r={R} fill="none" stroke="var(--m-line)" strokeWidth="4" />
          <circle
            className="g-ring"
            cx="19"
            cy="19"
            r={R}
            fill="none"
            stroke="var(--m-gold)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
          />
        </svg>
        <div>
          <p className="m-eyebrow">Contents</p>
          <p className="m-dim-2 t-2 tabular-nums" aria-live="off">
            {progress >= 0.99 ? 'Read to the end' : `${left} min left`}
          </p>
        </div>
      </div>
      <div className="relative mt-4 border-t border-[var(--m-line)] pt-3">
        <span aria-hidden className="g-toc-marker top-0" style={{ '--ty': `${marker.y}px`, '--th': `${marker.h}px` } as React.CSSProperties} />
        <ol ref={list} className="space-y-0.5">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={i === active ? 'location' : undefined}
                className={cn(
                  'block rounded-xl py-1.5 pr-2 pl-4 t-3 transition-colors duration-300',
                  i === active ? 'font-semibold text-[var(--m-ink)]' : 'm-dim hover:text-[var(--m-ink)]',
                )}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
