import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/primitives';
import { count } from '@/lib/comps/format';
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
 */
export function Rejected({ rejected }: { rejected: Rejection[] }) {
  if (rejected.length === 0) return null;

  const groups = new Map<string, string[]>();
  for (const { reason, candidate } of rejected) {
    const names = groups.get(reason) ?? [];
    names.push(candidate.name);
    groups.set(reason, names);
  }

  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <Card>
      <CardHeader>
        <CardTitle
          title="Considered and not used"
          description={`${count(rejected.length, 'company', 'companies')} the screen looked at and ruled out. The reason is what a reviewer will ask for.`}
        />
      </CardHeader>
      <CardBody>
        <dl className="space-y-4">
          {ordered.map(([reason, names]) => (
            <div key={reason} className="border-b pb-4 last:border-0 last:pb-0">
              <dt className="text-sm font-medium">{reason}</dt>
              <dd className="text-muted mt-1 text-sm leading-relaxed">
                {names.sort((a, b) => a.localeCompare(b)).join(' · ')}
              </dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}
