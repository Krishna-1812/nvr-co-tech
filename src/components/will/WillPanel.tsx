'use client';

import type { CSSProperties } from 'react';
import { Figure } from '@/components/app/Figure';
import { todayIso } from '@/lib/wealth/model';
import { checkWill, readiness } from '@/lib/will/checks';
import { useWill } from '@/lib/will/store';

/**
 * Will Maker's figures on the workspace card.
 *
 * Counted in this browser, where the draft is, and only counts: how many people
 * and assets are in it and how many things still need fixing. Never a name, an
 * amount or the title of a check (those carry people's names), because the
 * workspace is a screen people glance at with someone beside them. A locked draft
 * shows nothing until it is opened. Nothing here leaves the browser.
 */
export function WillPanel({ userId }: { userId: string }) {
  const state = useWill(userId);
  const loading = state.status === 'loading';
  const locked = state.status === 'locked';
  const hidden = loading || locked || state.status === 'unavailable';
  const record = state.record;
  const act = hidden ? 0 : readiness(checkWill(record, todayIso())).act;
  const started = !hidden && (record.people.length > 0 || record.assets.length > 0 || record.testator.name.trim() !== '');

  const readings = [
    { label: 'People in the will', value: record.people.length },
    { label: 'Assets listed', value: record.assets.length },
  ];

  const note = loading
    ? 'Reading this browser…'
    : locked
      ? 'Locked with a passcode. Open it to see the draft.'
      : state.status === 'unavailable'
        ? 'This browser will not let Will Maker keep a draft.'
        : !started
          ? 'Not started. A few plain questions, then a will you can print and sign.'
          : act === 0
            ? 'Nothing is holding the draft back. It has not been read by an advocate.'
            : `${act} ${act === 1 ? 'thing needs' : 'things need'} fixing before the will can be final.`;

  return (
    <div data-private>
      <dl className="mt-3.5 grid grid-cols-2 gap-3">
        {readings.map((r, i) => (
          <div key={r.label} className="min-w-0">
            <dd>
              {hidden ? (
                <span className="amount text-subtle text-[1.6rem]">–</span>
              ) : (
                <Figure value={r.value} delay={i * 90} className="text-[1.6rem]" />
              )}
            </dd>
            <dt className="text-muted mt-1.5 text-[10.5px] leading-snug">{r.label}</dt>
          </div>
        ))}
      </dl>
      <p
        style={{ '--tone': act > 0 ? 'var(--status-warn)' : 'var(--status-draft)' } as CSSProperties}
        className="tinted mt-4 flex min-h-[3.5rem] items-center rounded-xl border px-3 py-2 text-[12px] leading-relaxed font-medium text-pretty"
      >
        {note}
      </p>
    </div>
  );
}
