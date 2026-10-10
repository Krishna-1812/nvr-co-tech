'use client';

import type { CSSProperties } from 'react';
import { Figure } from '@/components/app/Figure';
import { formatINRShort } from '@/lib/recon/amount';
import { landedCost } from '@/lib/landed/calc';
import { useLandedStore } from '@/lib/landed/store';

/**
 * Landed Cost's figures on the workspace card.
 *
 * The other cards are read from the database on the server. This tool keeps
 * nothing there, so its figures are counted here, in the browser that holds
 * the schedules, and they describe this device only, which the note says.
 * Before hydration it shows dashes rather than a zero it has not counted.
 */
export function LandedPanel() {
  const state = useLandedStore();
  const schedules = state?.schedules ?? [];
  const latest = [...schedules].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const result = latest ? landedCost(latest) : null;
  const counted = schedules.filter((s) => s.instalments.some((i) => i.amount > 0 && i.date));

  const readings = [
    { label: 'Properties on this device', value: counted.length },
    {
      label: 'Payments entered',
      value: counted.reduce((n, s) => n + landedCost(s).rows.length, 0),
    },
  ];

  const note =
    state === null
      ? 'Reading this browser…'
      : result && result.paid > 0 && latest.ocDate
        ? `${latest.name.trim() || 'Untitled property'}: ${formatINRShort(result.landed)} at possession, ${formatINRShort(result.interest)} of it the cost of funds.`
        : 'Nothing saved on this device yet. Enter a payment schedule to see what it costs by possession.';

  return (
    <>
      <dl className="mt-3.5 grid grid-cols-2 gap-3">
        {readings.map((r, i) => (
          <div key={r.label} className="min-w-0">
            <dd>
              {state === null ? (
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
        style={{ '--tone': 'var(--status-draft)' } as CSSProperties}
        className="tinted mt-4 flex min-h-[3.5rem] items-center rounded-xl border px-3 py-2 text-[12px] leading-relaxed font-medium text-pretty"
      >
        {note}
      </p>
    </>
  );
}
