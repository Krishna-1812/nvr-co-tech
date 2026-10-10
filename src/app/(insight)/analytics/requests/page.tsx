import { createClient } from '@/lib/supabase/server';
import { ScrollTop } from '@/components/analytics/ScrollTop';
import { SummaryStrip } from '@/components/analytics/Strip';
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

  const custom = asks.filter((r) => r.interest === CUSTOM).length;

  return (
    <div className="space-y-6">
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

      <SummaryStrip
        cells={[
          {
            label: 'Requests',
            value: asks.length.toLocaleString('en-IN'),
            note: 'Sent from the form on the public site',
            strong: asks.length > 0,
          },
          {
            label: 'Wanting something custom',
            value: custom.toLocaleString('en-IN'),
            note: asks.length ? `${Math.round((custom / asks.length) * 100)}% of the requests` : 'None yet',
            tone: 'var(--h-magenta)',
          },
          {
            label: 'Organisations',
            value: companies.size.toLocaleString('en-IN'),
            note: 'Distinct names, as typed',
            tone: 'var(--h-indigo)',
          },
          {
            label: 'Tools asked for',
            value: wants.length.toLocaleString('en-IN'),
            note: 'From people already signed in',
            tone: 'var(--h-violet)',
          },
        ]}
      />

      <AccessRequestsTable rows={asks} />
      <FeatureRequestsTable rows={wants} />
    </div>
  );
}
