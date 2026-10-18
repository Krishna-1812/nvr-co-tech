'use client';

import type { CSSProperties } from 'react';
import { Figure } from '@/components/app/Figure';
import { summarise } from '@/lib/wealth/calc';
import { checks } from '@/lib/wealth/checks';
import { todayIso } from '@/lib/wealth/model';
import { useWealth } from '@/lib/wealth/store';

/**
 * Wealth Tracker's figures on the workspace card.
 *
 * Counted in this browser, where the record is, for this person only. It shows
 * how much is in the record and what needs attention, never the net worth: the
 * workspace is a screen people glance at with someone beside them, and a
 * figure like that belongs behind one more click. A locked record shows
 * nothing at all until it is opened.
 */
export function WealthPanel({ userId }: { userId: string }) {
  const { state } = useWealth(userId);
  const loading = state.status === 'loading';
  const locked = state.status === 'locked';
  const record = state.record;
  const sum = summarise(record);
  const open = loading || locked ? [] : checks(record, todayIso()).filter((f) => f.severity !== 'note');

  const readings = [
    { label: 'Entries on this device', value: record.items.length },
    { label: 'With a nominee', value: sum.nominees.yes },
  ];

  const note = loading
    ? 'Reading this browser…'
    : locked
      ? 'Locked with a passcode. Open it to see the record.'
      : record.items.length === 0
        ? 'Nothing recorded yet. Tick what you have and you are taken through each one.'
        : open.length === 0
          ? 'Nothing needs attention. Back up now and then.'
          : `${open.length} ${open.length === 1 ? 'thing needs' : 'things need'} attention, starting with: ${open[0].title}.`;

  return (
    <>
      <dl className="mt-3.5 grid grid-cols-2 gap-3">
        {readings.map((r, i) => (
          <div key={r.label} className="min-w-0">
            <dd>
              {loading || locked ? (
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
        style={{ '--tone': open.length > 0 ? 'var(--status-warn)' : 'var(--status-draft)' } as CSSProperties}
        className="tinted mt-4 flex min-h-[3.5rem] items-center rounded-xl border px-3 py-2 text-[12px] leading-relaxed font-medium text-pretty"
      >
        {note}
      </p>
    </>
  );
}
