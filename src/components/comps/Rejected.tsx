import type { Rejection } from '@/lib/comps/types';

/**
 * The companies that did not make the set, and why.
 *
 * This is not a debug panel. It is the half of a peer set a reviewer actually
 * challenges: "we looked at eleven, used seven, and here are the four with the
 * reason" is a far stronger answer than a list of seven, and it is the difference
 * between a screen output and a recorded judgement.
 *
 * `peer_set_members.excluded_reason` is NOT NULL for the same purpose, so what is
 * on screen here is what gets saved rather than a nicety the interface adds.
 *
 * Grouped by reason rather than listed by company, because on a real industry the
 * same reason accounts for most of them — twenty companies above the size band is
 * one finding about the peer set, not twenty findings.
 *
 * Renders bare (no Card of its own): it sits inside the detail tabs, whose card
 * already provides the surface. The caller decides whether to show the tab at all
 * when nothing was rejected.
 */
export function Rejected({ rejected }: { rejected: Rejection[] }) {
  const groups = new Map<string, string[]>();
  for (const { reason, candidate } of rejected) {
    const names = groups.get(reason) ?? [];
    names.push(candidate.name);
    groups.set(reason, names);
  }

  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="px-5 py-5">
      <p className="text-muted mb-4 text-sm">
        The screen looked at these and ruled them out. The reason is what a reviewer will ask for.
      </p>
      <dl className="space-y-4">
        {ordered.map(([reason, names]) => (
          <div key={reason} className="border-b pb-4 last:border-0 last:pb-0">
            <dt className="flex items-baseline gap-2 text-sm font-medium">
              <span className="surface-sunken text-subtle rounded-full border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
                {names.length}
              </span>
              {reason}
            </dt>
            <dd className="text-muted mt-1.5 text-sm leading-relaxed">
              {names.sort((a, b) => a.localeCompare(b)).join(' · ')}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
