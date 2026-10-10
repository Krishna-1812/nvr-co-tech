'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { AlertTriangle, ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValidationIssue } from '@/lib/recon/types';

/**
 * What is wrong with the files.
 *
 * Split into two lists because the two kinds of problem need different things
 * from the reader. An error means the run cannot proceed and the file has to be
 * fixed, so it is stated in full. A warning means the answer will be slightly
 * off in a way worth knowing about, and there can be forty of them on a messy
 * export — so those are collapsed to a count and the first few, with the rest
 * one click away.
 *
 * Nothing here is dismissible. A warning you can wave away is a warning that
 * ends up on a signed reconciliation.
 */
export function Issues({ issues }: { issues: ValidationIssue[] }) {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  if (issues.length === 0) return null;

  return (
    <div className="space-y-3">
      {errors.length > 0 && (
        <Panel
          tone="var(--status-rejected)"
          icon={<AlertTriangle className="size-4" aria-hidden />}
          title={
            errors.length === 1
              ? 'One problem has to be fixed before this can run'
              : `${errors.length} problems have to be fixed before this can run`
          }
          items={errors}
          initiallyShown={errors.length}
        />
      )}

      {warnings.length > 0 && (
        <Panel
          tone="var(--status-warn)"
          icon={<Info className="size-4" aria-hidden />}
          title={
            warnings.length === 1
              ? 'One thing worth knowing. You can still run this.'
              : `${warnings.length} things worth knowing. You can still run this.`
          }
          items={warnings}
          initiallyShown={4}
        />
      )}
    </div>
  );
}

function Panel({
  tone,
  icon,
  title,
  items,
  initiallyShown,
}: {
  tone: string;
  icon: React.ReactNode;
  title: string;
  items: ValidationIssue[];
  initiallyShown: number;
}) {
  const [open, setOpen] = useState(false);
  const hidden = items.length - initiallyShown;
  const shown = open ? items : items.slice(0, initiallyShown);

  return (
    <div
      style={{ '--tone': tone } as CSSProperties}
      className="tinted a-inner animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-3xl border px-5 py-4 sm:px-6"
    >
      <p className="flex items-center gap-3 text-sm font-semibold">
        {/* The panel tile, in the issue's own colour. */}
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-xl border border-[color-mix(in_oklab,var(--tone)_35%,var(--border-c))] bg-[var(--surface-raised)]"
        >
          {icon}
        </span>
        <span className="text-pretty">{title}</span>
      </p>

      <ul className="mt-3 space-y-1.5 pl-12">
        {shown.map((issue, i) => (
          <li
            key={i}
            className="list-disc text-[13px] leading-relaxed text-pretty opacity-90 marker:opacity-50"
          >
            {issue.message}
          </li>
        ))}
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2.5 ml-12 inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
        >
          {open ? 'Show fewer' : `Show ${hidden} more`}
          <ChevronDown
            className={cn('size-3.5 transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </button>
      )}
    </div>
  );
}
