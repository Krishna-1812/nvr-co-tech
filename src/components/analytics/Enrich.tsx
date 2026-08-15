'use client';

import { useState, useTransition } from 'react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { enrichAccount } from '@/app/actions/analytics';
import type { PaidFirmographics } from '@/lib/analytics/types';
import { Button } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { NUM, Pill } from './Figures';

/**
 * The button that spends money.
 *
 * It says so before it is pressed and it says what it cost afterwards, which is
 * the whole of the interface design here. A control that quietly draws down a
 * shared budget is a control people stop trusting the moment they find out, and
 * the finding-out usually happens on an invoice.
 *
 * Nothing about this is automatic. It is not fetched on render, it is not
 * prefetched on hover, and it is not called for a list of companies. One click,
 * one company.
 */
export function Enrich({ domain, name }: { domain: string; name: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<PaidFirmographics | null>(null);
  const [done, setDone] = useState(false);

  return (
    <div className="space-y-3">
      {!done && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            loading={pending}
            onClick={() =>
              start(async () => {
                const outcome = await enrichAccount(domain);
                if (!outcome.ok) {
                  toast.error(outcome.message);
                  return;
                }
                setResult(outcome.data);
                setDone(true);
                toast.success(outcome.message);
              })
            }
          >
            <Sparkles className="size-3.5" aria-hidden />
            Enrich further
          </Button>
          <span className="text-subtle text-[11.5px]">
            Buys headcount, revenue and who to talk to at {name}. Costs one credit, unless it was
            bought in the last week.
          </span>
        </div>
      )}

      {done && !result && (
        <p className="text-subtle text-[12px]">
          The provider had nothing on this company. That is a common and honest answer for a
          privately held business.
        </p>
      )}

      {result && <Bought data={result} />}
    </div>
  );
}

function Bought({ data }: { data: PaidFirmographics }) {
  return (
    <div className="surface-sunken animate-[rise_0.4s_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        {data.employeeBand && <Pill tone="var(--h-indigo)">{data.employeeBand} people</Pill>}
        {data.revenue != null && (
          <Pill tone="var(--h-emerald)">
            <span className={NUM}>
              {new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'USD',
                notation: 'compact',
                maximumFractionDigits: 1,
              }).format(data.revenue)}
            </span>
          </Pill>
        )}
        {data.industry && <Pill tone="var(--h-cyan)">{data.industry}</Pill>}
      </div>

      {data.committee.length > 0 && (
        <>
          <p className="a-label text-subtle mt-4">Who to talk to</p>
          <ul className="mt-2 divide-y">
            {data.committee.map((person) => (
              <li key={person.name} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{person.name}</span>
                  <span className="text-subtle block truncate text-[11.5px]">{person.title}</span>
                </span>
                {person.linkedin && (
                  <a
                    href={person.linkedin}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={cn('text-brand-600 dark:text-brand-300 shrink-0 text-[11.5px] font-semibold hover:underline')}
                  >
                    Profile
                  </a>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
