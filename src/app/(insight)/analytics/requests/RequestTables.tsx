'use client';

import { AGENTS } from '@/lib/marketing/content';
import { NUM } from '@/components/analytics/Figures';
import type { AccessRequestRow, FeatureRequestRow } from '@/lib/supabase/types';
import { RequestTable, type Column } from './RequestTable';
import { cn } from '@/lib/utils';

/**
 * The two queues, and the only place that says how a row is drawn.
 *
 * These column sets used to live in the page, which is a server component, and a
 * `cell` that returns JSX is a function — so handing them to `RequestTable`
 * ("use client") meant passing functions across the server/client boundary. That
 * is not allowed, and the screen died in its error boundary: "Something went
 * wrong. Reference: …", with both queues unreachable on every device.
 *
 * Nothing here needs the server. The page still does the querying and hands over
 * plain rows; how those rows look is decided on the side of the boundary that is
 * allowed to hold a function.
 */

const CUSTOM = 'Build something custom';

const stamp = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });

/** Just the host of a referring URL, or the raw string if it is not one. */
function host(source: string): string {
  try {
    return new URL(source).host.replace(/^www\./, '');
  } catch {
    return source;
  }
}

const Dash = () => <span className="text-subtle">&mdash;</span>;

export function AccessRequestsTable({ rows }: { rows: AccessRequestRow[] }) {
  const columns: Column<AccessRequestRow>[] = [
    {
      header: 'When',
      className: 'whitespace-nowrap',
      cell: (r) => (
        <span className="block leading-tight">
          <span className={cn(NUM, 'block text-[11.5px]')}>{stamp(r.created_at)}</span>
          {r.source && (
            <span className="text-subtle block max-w-[12rem] truncate text-[10px]" title={r.source}>
              via {host(r.source)}
            </span>
          )}
        </span>
      ),
      text: (r) => stamp(r.created_at),
    },
    { header: 'Name', cell: (r) => r.name, text: (r) => r.name },
    {
      header: 'Work email',
      cell: (r) => (
        <span className="block leading-tight">
          <a
            href={`mailto:${r.email}`}
            className={cn(
              NUM,
              'a-ring block text-[11.5px] underline decoration-dotted underline-offset-2',
            )}
          >
            {r.email}
          </a>
          {r.ip && <span className={cn(NUM, 'text-subtle block text-[10px]')}>{r.ip}</span>}
        </span>
      ),
      text: (r) => r.email,
    },
    {
      header: 'Organisation',
      cell: (r) => r.company ?? <Dash />,
      text: (r) => r.company ?? '',
    },
    {
      header: 'Interest',
      cell: (r) =>
        r.interest ? (
          <span
            style={{
              ['--tone' as string]: r.interest === CUSTOM ? 'var(--h-magenta)' : 'var(--h-indigo)',
            }}
            className="tinted inline-flex rounded-full border px-2 py-px text-[10.5px] font-semibold"
          >
            {r.interest}
          </span>
        ) : (
          <Dash />
        ),
      text: (r) => r.interest ?? '',
    },
    {
      header: 'Message',
      className: 'max-w-[22rem]',
      cell: (r) =>
        r.message ? (
          <span className="text-muted block text-[12px] leading-relaxed text-pretty">
            {r.message}
          </span>
        ) : (
          <Dash />
        ),
      text: (r) => r.message ?? '',
    },
  ];

  return (
    <RequestTable
      title="From the public site"
      description="Newest first. Nothing here is filtered by date."
      rows={rows}
      columns={columns}
      haystacks={rows.map((r) =>
        [r.name, r.email, r.company, r.interest, r.message]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      )}
      filename="access-requests.csv"
      emptyTitle="Nobody has used the form yet"
      emptyBody="The walkthrough form on the contact page writes here. If you were expecting rows and there are none, submit one yourself to confirm the path works end to end."
    />
  );
}

export function FeatureRequestsTable({ rows }: { rows: FeatureRequestRow[] }) {
  const nameOf = new Map(AGENTS.map((agent) => [agent.slug, agent.name]));
  const toolName = (slug: string) => nameOf.get(slug) ?? slug;

  const columns: Column<FeatureRequestRow>[] = [
    {
      header: 'When',
      className: 'whitespace-nowrap',
      cell: (r) => <span className={cn(NUM, 'text-[11.5px]')}>{stamp(r.created_at)}</span>,
      text: (r) => stamp(r.created_at),
    },
    {
      header: 'Name',
      cell: (r) => r.name ?? <Dash />,
      text: (r) => r.name ?? '',
    },
    {
      header: 'Work email',
      cell: (r) => (
        <a
          href={`mailto:${r.email}`}
          className={cn(
            NUM,
            'a-ring text-[11.5px] underline decoration-dotted underline-offset-2',
          )}
        >
          {r.email}
        </a>
      ),
      text: (r) => r.email,
    },
    {
      header: 'Tool asked for',
      cell: (r) => (
        <span
          style={{ ['--tone' as string]: 'var(--h-violet)' }}
          className="tinted inline-flex rounded-full border px-2 py-px text-[10.5px] font-semibold"
        >
          {toolName(r.feature_slug)}
        </span>
      ),
      text: (r) => toolName(r.feature_slug),
    },
    {
      header: 'Reason',
      className: 'max-w-[22rem]',
      cell: (r) =>
        r.reason ? (
          <span className="text-muted block text-[12px] leading-relaxed text-pretty">
            {r.reason}
          </span>
        ) : (
          <span className="text-subtle">No reason given</span>
        ),
      text: (r) => r.reason ?? '',
    },
  ];

  return (
    <RequestTable
      title="Asked for from inside the product"
      description="One row per person per tool, deduplicated when it is written rather than when it is read."
      rows={rows}
      columns={columns}
      haystacks={rows.map((r) =>
        [r.name, r.email, toolName(r.feature_slug), r.reason]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      )}
      filename="tool-requests.csv"
      emptyTitle="No tool has been asked for"
      emptyBody="A signed-in person can ask for any tool that is not live yet. The moment somebody does, it appears here."
    />
  );
}
