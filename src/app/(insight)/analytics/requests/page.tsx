import { createClient } from '@/lib/supabase/server';
import { ScrollTop } from '@/components/analytics/ScrollTop';
import type { AccessRequestRow, FeatureRequestRow } from '@/lib/supabase/types';
import { AccessRequestsTable, FeatureRequestsTable } from './RequestTables';

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

  const companies = new Set(
    asks.map((r) => (r.company ?? '').trim().toLowerCase()).filter(Boolean),
  );

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

      <AccessRequestsTable rows={asks} />
      <FeatureRequestsTable rows={wants} />
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

