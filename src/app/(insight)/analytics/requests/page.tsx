import { createClient } from '@/lib/supabase/server';
import { AGENTS } from '@/lib/marketing/content';
import { NUM } from '@/components/analytics/Figures';
import { ScrollTop } from '@/components/analytics/ScrollTop';
import type { AccessRequestRow, FeatureRequestRow } from '@/lib/supabase/types';
import { RequestTable, type Column } from './RequestTable';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Access requests' };
export const dynamic = 'force-dynamic';

/**
 * Who has asked to be let in, and what for.
 *
 * The one screen in this section with no chart, no drawer and no drill-down, and
 * it is server-rendered whole rather than fetching anything. That is a
 * deliberate difference in kind: the other six answer "what is happening", which
 * needs comparison and exploration, and this one answers "who is waiting", which
 * needs a list and a way to search it. Adding a KPI grid and a timeline would
 * dress a queue up as an analysis.
 *
 * It also carries its own voice — a serif title and its own eyebrow rather than
 * the section's standard header. Partly because it reads as a document rather
 * than a dashboard, and partly because it is usually arrived at from a
 * notification rather than from the navigation, so looking distinctly like
 * itself helps somebody know where they have landed.
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

export default async function RequestsPage() {
  const supabase = await createClient();

  const [publicForm, inProduct] = await Promise.all([
    supabase
      .from('access_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('feature_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2_000),
  ]);

  const asks = (publicForm.data ?? []) as AccessRequestRow[];
  const wants = (inProduct.data ?? []) as FeatureRequestRow[];

  const nameOf = new Map(AGENTS.map((agent) => [agent.slug, agent.name]));

  const companies = new Set(
    asks.map((r) => (r.company ?? '').trim().toLowerCase()).filter(Boolean),
  );

  const askColumns: Column<AccessRequestRow>[] = [
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
            className={cn(NUM, 'a-ring block text-[11.5px] underline decoration-dotted underline-offset-2')}
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
      cell: (r) => r.company ?? <span className="text-subtle">&mdash;</span>,
      text: (r) => r.company ?? '',
    },
    {
      header: 'Interest',
      cell: (r) =>
        r.interest ? (
          <span
            style={{
              ['--tone' as string]:
                r.interest === CUSTOM ? 'var(--h-magenta)' : 'var(--h-indigo)',
            }}
            className="tinted inline-flex rounded-full border px-2 py-px text-[10.5px] font-semibold"
          >
            {r.interest}
          </span>
        ) : (
          <span className="text-subtle">&mdash;</span>
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
          <span className="text-subtle">&mdash;</span>
        ),
      text: (r) => r.message ?? '',
    },
  ];

  const wantColumns: Column<FeatureRequestRow>[] = [
    {
      header: 'When',
      className: 'whitespace-nowrap',
      cell: (r) => <span className={cn(NUM, 'text-[11.5px]')}>{stamp(r.created_at)}</span>,
      text: (r) => stamp(r.created_at),
    },
    {
      header: 'Name',
      cell: (r) => r.name ?? <span className="text-subtle">&mdash;</span>,
      text: (r) => r.name ?? '',
    },
    {
      header: 'Work email',
      cell: (r) => (
        <a
          href={`mailto:${r.email}`}
          className={cn(NUM, 'a-ring text-[11.5px] underline decoration-dotted underline-offset-2')}
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
          {nameOf.get(r.feature_slug) ?? r.feature_slug}
        </span>
      ),
      text: (r) => nameOf.get(r.feature_slug) ?? r.feature_slug,
    },
    {
      header: 'Reason',
      className: 'max-w-[22rem]',
      cell: (r) =>
        r.reason ? (
          <span className="text-muted block text-[12px] leading-relaxed text-pretty">{r.reason}</span>
        ) : (
          <span className="text-subtle">No reason given</span>
        ),
      text: (r) => r.reason ?? '',
    },
  ];

  return (
    <div className="space-y-8">
      <ScrollTop />

      <header>
        <span className="text-subtle inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10.5px] font-medium">
          <span
            aria-hidden
            className="size-1.5 animate-[breathe_3s_ease-in-out_infinite] rounded-full bg-[var(--h-indigo)]"
          />
          Inbound
        </span>
        <h1 className="mt-4 text-[2rem] leading-[1.1] tracking-tight text-pretty">
          Access <span className="font-serif italic">requests.</span>
        </h1>
        <p className="text-muted mt-3 max-w-[62ch] text-[14px] leading-relaxed text-pretty">
          Two queues. The first is the form on the public site, which anybody can send. The second is
          somebody already signed in asking for a tool that is not live yet — recorded once per
          person per tool, so asking twice does not make two rows.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Requests" value={asks.length} />
        <Stat
          label="Wanting something custom"
          value={asks.filter((r) => r.interest === CUSTOM).length}
        />
        <Stat label="Organisations" value={companies.size} />
      </section>

      <RequestTable
        title="From the public site"
        description="Newest first. Nothing here is filtered by date."
        rows={asks}
        columns={askColumns}
        haystacks={asks.map((r) =>
          [r.name, r.email, r.company, r.interest, r.message]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
        )}
        filename="access-requests.csv"
        emptyTitle="Nobody has used the form yet"
        emptyBody="The walkthrough form on the contact page writes here. If you were expecting rows and there are none, submit one yourself to confirm the path works end to end."
      />

      <RequestTable
        title="Asked for from inside the product"
        description="One row per person per tool, deduplicated when it is written rather than when it is read."
        rows={wants}
        columns={wantColumns}
        haystacks={wants.map((r) =>
          [r.name, r.email, nameOf.get(r.feature_slug) ?? r.feature_slug, r.reason]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
        )}
        filename="tool-requests.csv"
        emptyTitle="No tool has been asked for"
        emptyBody="A signed-in person can ask for any tool that is not live yet. The moment somebody does, it appears here."
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-[var(--surface-raised)] p-4">
      <p
        className="a-figure text-[1.9rem]"
        style={{
          background:
            'linear-gradient(135deg, var(--text-c) 15%, color-mix(in oklab, var(--h-indigo) 85%, var(--text-c)) 95%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }}
      >
        {value.toLocaleString('en-IN')}
      </p>
      <p className="a-label mt-1.5">{label}</p>
    </div>
  );
}

/** Just the host of a referring URL, or the raw string if it is not one. */
function host(source: string): string {
  try {
    return new URL(source).host.replace(/^www\./, '');
  } catch {
    return source;
  }
}
