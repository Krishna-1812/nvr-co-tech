'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { ACCENT_VAR } from '@/lib/solutions';
import { AGENTS } from '@/lib/marketing/content';
import type { Source } from '@/lib/assist/types';

/**
 * What the answer was built from.
 *
 * The reason this is on screen is not transparency in the abstract. The
 * assistant is told to answer about this platform only from documents it was
 * given, and a reader has no way to know whether it obeyed. A short row of the
 * documents it actually had turns that from a promise into something checkable:
 * an answer about approvals whose sources are all about reconciliation is
 * visibly wrong before a word of it is read.
 *
 * Coloured by tool, using the same accent the hub gives that tool, so the
 * association is the one the reader already has.
 */
export function Sources({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
      <span className="a-label mr-0.5 inline-flex items-center gap-1.5">
        <BookOpen className="size-3" aria-hidden />
        Read from
      </span>

      {sources.map((source) => {
        const agent = source.agent ? AGENTS.find((a) => a.slug === source.agent) : undefined;
        const tone = agent ? ACCENT_VAR[agent.accent] : 'var(--text-subtle)';

        const inner = (
          <>
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: tone }}
            />
            {source.title}
          </>
        );

        const className =
          'surface-sunken text-muted inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition';

        // A chip is only a link where there is a page to send somebody to. The
        // rest are documents that exist here and nowhere else, and a link that
        // goes nowhere is worse than no link.
        return source.href ? (
          <Link
            key={source.id}
            href={source.href}
            className={`${className} hover:border-[var(--border-strong)] hover:text-[var(--text-c)]`}
          >
            {inner}
          </Link>
        ) : (
          <span key={source.id} className={className}>
            {inner}
          </span>
        );
      })}
    </div>
  );
}
