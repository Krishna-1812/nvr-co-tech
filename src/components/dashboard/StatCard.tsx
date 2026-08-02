import Link from 'next/link';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * One headline number. `urgent` is not decoration — it marks the cards that
 * represent work sitting on this person, so the eye lands there first.
 *
 * The number is the largest thing in the card and the label is the smallest.
 * On a dashboard of four cards that ordering is the whole design: you read four
 * figures, then go back for the words.
 */
export function StatCard({
  label,
  value,
  hint,
  href,
  icon: Icon,
  urgent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  href: string;
  icon: LucideIcon;
  urgent?: boolean;
}) {
  return (
    <Link href={href} className="group block rounded-xl">
      <div
        className={cn(
          'hover-lift surface-lit relative flex h-full flex-col overflow-hidden rounded-xl p-4',
          urgent && 'border-brand-300 dark:border-brand-700',
        )}
      >
        {urgent && <span aria-hidden className="gradient-brand absolute inset-x-0 top-0 h-0.5" />}

        <div className="flex items-start justify-between gap-2">
          <span className="text-muted text-[11px] font-semibold tracking-[0.06em] uppercase">
            {label}
          </span>
          <span
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-lg transition',
              urgent
                ? 'gradient-brand text-white'
                : 'surface-sunken text-subtle group-hover:text-[var(--text-c)]',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </span>
        </div>

        {/*
          The Approved value card carries a full rupee figure, which is far
          longer than the counts beside it. The size steps back down once the
          grid goes to four columns so it cannot wrap mid-number.
        */}
        <p className="amount mt-3 text-2xl font-bold sm:text-3xl lg:text-[1.75rem]">{value}</p>

        <div className="mt-auto flex items-center gap-1 pt-1.5">
          <span className="text-subtle text-xs">{hint}</span>
          <ArrowUpRight
            className="text-subtle size-3 shrink-0 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
            aria-hidden
          />
        </div>
      </div>
    </Link>
  );
}
