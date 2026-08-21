import type { Person } from './people';
import { accentFor } from './identity';

/**
 * Activity per tenant, and who inside a tenant is generating it.
 *
 * ── The segmentation, and why it is the useful one ──────────────────────────
 *
 * The design this follows splits a client's portal traffic three ways: our own
 * team, that client's team, and anybody else. It does that because its clients
 * have separate white-labelled portals, and a URL prefix says which portal a
 * page view belongs to.
 *
 * This product has no portals. It has tenants, and a person belongs to exactly
 * one — `accept_invite` refuses anybody who already belongs to an organisation,
 * so a three-way split by domain would put everybody in one bucket and leave the
 * other two permanently empty.
 *
 * What matters commercially is the same question in a different shape, and it is
 * worth stating because it is the whole point of this page: **is this tenant
 * actually being used by the people who bought it, or is the activity ours?** A
 * customer-success figure that quietly includes our own staff logging in to
 * demonstrate or fix something reads as adoption when it is not. So the split is
 * by the analytics allowlist: people on it are us, everybody else in the tenant
 * is them.
 */

export type Segment = 'them' | 'us';

export type TenantSummary = {
  id: string;
  name: string;
  createdAt: string;
  accent: string;
  people: number;
  pageViews: number;
  visits: number;
  runs: number;
  seconds: number;
  firstSeen: string | null;
  lastSeen: string | null;
};

export type TenantDetail = TenantSummary & {
  segments: Record<Segment, Person[]>;
};

const ms = (iso: string): number => new Date(iso).getTime();

/**
 * One entry per organisation, including the ones nobody has touched.
 *
 * Empty tenants are kept deliberately. An organisation that signed up and never
 * came back is the single most actionable row on this page, and dropping it for
 * having no activity would hide exactly the accounts worth a phone call.
 */
export function summariseTenants({
  organizations,
  members,
  people,
}: {
  organizations: { id: string; name: string; created_at: string }[];
  members: { email: string; organization_id: string | null }[];
  people: Person[];
}): TenantSummary[] {
  const orgOf = new Map(
    members
      .filter((m) => m.organization_id)
      .map((m) => [m.email.trim().toLowerCase(), m.organization_id!]),
  );

  const grouped = new Map<string, Person[]>();
  for (const person of people) {
    const org = orgOf.get(person.email);
    if (!org) continue;
    const list = grouped.get(org);
    if (list) list.push(person);
    else grouped.set(org, [person]);
  }

  return organizations
    .map((org): TenantSummary => {
      const theirs = grouped.get(org.id) ?? [];

      const firsts = theirs.map((p) => ms(p.firstSeen)).filter(Number.isFinite);
      const lasts = theirs.map((p) => ms(p.lastSeen)).filter(Number.isFinite);

      return {
        id: org.id,
        name: org.name,
        createdAt: org.created_at,
        // The tenant's own colour, derived from its id so it is the same on the
        // list, on its own page and on any chart that mentions it.
        accent: accentFor(org.id),
        people: theirs.length,
        pageViews: theirs.reduce((n, p) => n + p.pageViews, 0),
        visits: theirs.reduce((n, p) => n + p.visits, 0),
        runs: theirs.reduce((n, p) => n + p.runs, 0),
        seconds: theirs.reduce((n, p) => n + p.seconds, 0),
        firstSeen: firsts.length ? new Date(Math.min(...firsts)).toISOString() : null,
        lastSeen: lasts.length ? new Date(Math.max(...lasts)).toISOString() : null,
      };
    })
    .sort((a, b) => b.pageViews - a.pageViews || a.name.localeCompare(b.name));
}

/** One tenant, with its people split into us and them. */
export function tenantDetail({
  organization,
  members,
  people,
  staffEmails,
}: {
  organization: { id: string; name: string; created_at: string };
  members: { email: string; organization_id: string | null }[];
  people: Person[];
  staffEmails: Iterable<string>;
}): TenantDetail {
  const [summary] = summariseTenants({ organizations: [organization], members, people });

  const staff = new Set([...staffEmails].map((e) => e.trim().toLowerCase()));
  const belongs = new Set(
    members
      .filter((m) => m.organization_id === organization.id)
      .map((m) => m.email.trim().toLowerCase()),
  );

  const theirs = people.filter((p) => belongs.has(p.email));

  return {
    ...summary,
    segments: {
      them: theirs.filter((p) => !staff.has(p.email)),
      us: theirs.filter((p) => staff.has(p.email)),
    },
  };
}

/**
 * Activity by day, split into the two segments.
 *
 * Built from the people rather than from the raw log so that the bars and the
 * figures above them can never disagree — both are the same numbers counted the
 * same way. The trade-off is that a day is attributed from a person's journey
 * events, which are capped, so a very heavy day for a very heavy user could be
 * under-drawn. Worth it: two views of one dataset that contradict each other is
 * the thing that makes a reader stop trusting a page.
 */
export function activityByDay(
  detail: TenantDetail,
  days: number,
  now: number,
): { day: string; them: number; us: number }[] {
  const buckets = new Map<string, { them: number; us: number }>();

  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
    buckets.set(day, { them: 0, us: 0 });
  }

  for (const segment of ['them', 'us'] as const) {
    for (const person of detail.segments[segment]) {
      for (const event of person.journey) {
        const day = event.at.slice(0, 10);
        const bucket = buckets.get(day);
        if (bucket) bucket[segment] += 1;
      }
    }
  }

  return [...buckets.entries()].map(([day, counts]) => ({ day, ...counts }));
}
