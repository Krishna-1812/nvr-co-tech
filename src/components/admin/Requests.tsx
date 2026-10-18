'use client';

import type { CSSProperties } from 'react';
import { Hand, KeyRound, Mail } from 'lucide-react';
import type { Request } from '@/lib/analytics/report';
import { stamp } from './when';
import { useDrill } from './Drill';

/**
 * Every ask, newest first: "Request access" from a locked tool or the contact
 * page, and "I want this" on a roadmap tool. Each links to the person it came
 * from when the browser or the address is known to the panel.
 */
export function Requests({ requests }: { requests: Request[] }) {
  const { open } = useDrill();
  if (requests.length === 0) {
    return <p className="text-subtle px-6 py-12 text-center text-sm">No requests in this period.</p>;
  }
  return (
    <ul className="grid gap-3 p-5 sm:p-6 md:grid-cols-2">
      {requests.map((r) => {
        const Icon = r.kind === 'access' ? KeyRound : Hand;
        const tone = r.kind === 'access' ? 'var(--status-warn)' : 'var(--status-pending)';
        return (
          <li
            key={r.id}
            className="surface-sunken a-inner group relative flex min-w-0 flex-col rounded-2xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)]"
          >
            {/* The whole card opens the request; the two links sit above this. */}
            <button
              type="button"
              onClick={() => open({ t: 'request', id: r.id })}
              aria-label={`Open the request: ${r.what}`}
              className="absolute inset-0 z-[1] cursor-pointer rounded-2xl focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
            />
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                style={{ '--tone': tone } as CSSProperties}
                className="tinted grid size-9 shrink-0 place-items-center rounded-xl border"
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold tracking-tight">{r.what}</p>
                <p className="text-muted mt-0.5 truncate text-[12.5px]">
                  {[r.name, r.company].filter(Boolean).join(' · ') || 'No name given'}
                </p>
              </div>
              <span className="text-subtle shrink-0 text-[11.5px]">{stamp(r.at)}</span>
            </div>
            {r.message && <p className="mt-3 line-clamp-4 text-[13px] leading-relaxed text-pretty whitespace-pre-line">{r.message}</p>}
            <div className="relative z-[2] mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[12.5px] font-semibold">
              <a href={`mailto:${r.email}`} className="inline-flex min-w-0 items-center gap-1.5 hover:underline">
                <Mail className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{r.email}</span>
              </a>
              {r.personKey && (
                <button
                  type="button"
                  onClick={() => open({ t: 'person', key: r.personKey! })}
                  className="text-muted hover:text-[var(--text-c)] hover:underline"
                >
                  See their visits
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
