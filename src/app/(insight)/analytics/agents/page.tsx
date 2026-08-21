import { Card, CardTitle } from '@/components/ui/primitives';
import { PageHeader } from '@/components/PageHeader';
import { BarList } from '@/components/analytics/Charts';
import { KpiCard, KpiRow } from '@/components/analytics/Kpi';
import { number } from '@/components/analytics/Figures';
import { AGENTS } from '@/lib/marketing/content';
import { aliasAgent } from '@/lib/analytics/aliases';
import { renderedAt } from '@/lib/analytics/people';
import { readAllAgentRuns, readProfileDirectory } from '@/lib/analytics/store';
import { readRunCap } from '@/lib/analytics/caps';
import { UsageByUser, type ToolUse, type ToolUser } from './UsageByUser';

export const metadata = { title: 'Tool usage' };
export const dynamic = 'force-dynamic';

/**
 * Runs per person per tool, against the allowance.
 *
 * Lifetime rather than windowed, and there is no date filter on this page for
 * that reason: an allowance that reset whenever somebody changed the date range
 * would not be an allowance. "Seven of your ten" has to count every run ever
 * made, so the page counts all of them and says so.
 *
 * Only live tools appear in the breakdown. Listing the ones that are still being
 * built would pad it with permanent zeroes and make the chart mostly a list of
 * things nobody can use yet — those belong on the requests page, where somebody
 * asking for one is the interesting event.
 */
export default async function AgentUsagePage() {
  const [runs, profiles, cap] = await Promise.all([
    readAllAgentRuns(),
    readProfileDirectory(),
    readRunCap(),
  ]);

  const live = AGENTS.filter((agent) => agent.stage === 'live');
  const nameOf = new Map(AGENTS.map((agent) => [agent.slug, agent.name]));

  const directory = new Map(
    profiles
      .filter((p) => p.email)
      .map((p) => [p.email!.toLowerCase(), { name: p.full_name, photo: p.avatar_url }]),
  );

  // Resolved on the way in as well as out: a run stored under a slug that has
  // since been renamed still counts toward the tool it is now called, rather
  // than starting a second allowance under a name nobody recognises.
  const perTool = new Map<string, number>();
  const perPerson = new Map<string, Map<string, number>>();
  const lastRun = new Map<string, string>();

  for (const run of runs) {
    const slug = aliasAgent(run.feature_slug);
    const email = run.email.toLowerCase();

    perTool.set(slug, (perTool.get(slug) ?? 0) + 1);

    let tools = perPerson.get(email);
    if (!tools) {
      tools = new Map();
      perPerson.set(email, tools);
    }
    tools.set(slug, (tools.get(slug) ?? 0) + 1);

    // Runs arrive newest-first, so the first one seen for somebody is their latest.
    if (!lastRun.has(email)) lastRun.set(email, run.created_at);
  }

  const users: ToolUser[] = [...perPerson.entries()]
    .map(([email, tools]): ToolUser => {
      const list: ToolUse[] = [...tools.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([slug, used]) => ({
          slug,
          name: nameOf.get(slug) ?? slug,
          used,
          cap,
        }));

      return {
        email,
        name: directory.get(email)?.name ?? null,
        photo: directory.get(email)?.photo ?? null,
        total: list.reduce((n, t) => n + t.used, 0),
        lastRun: lastRun.get(email) ?? new Date(0).toISOString(),
        tools: list,
        // Past the allowance on any single tool. Not a total across tools: the
        // allowance is per tool, so exhausting one says nothing about another.
        atCap: list.some((t) => t.used >= t.cap),
      };
    })
    .sort((a, b) => b.total - a.total);

  const byTool = live
    .map((agent) => ({ label: agent.name, count: perTool.get(agent.slug) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tools"
        title="What is being opened, and by whom"
        description="A run is one open of a tool: a reconciliation saved, or a question the assistant answered. This system cannot see inside a session, so a run means the tool was used and nothing more about how."
      />

      <KpiRow>
        <KpiCard
          label="Total opens"
          value={runs.length}
          caption="Every run on file, not just this month"
          accent="var(--h-emerald)"
        />
        <KpiCard
          label="People"
          value={users.length}
          caption="Anyone who has opened at least one tool"
          accent="var(--h-violet)"
        />
        <KpiCard
          label="Past their allowance"
          value={users.filter((u) => u.atCap).length}
          caption="Counted per tool, so one exhausted tool is enough"
          accent="var(--h-rose)"
        />
        <KpiCard
          label="Allowance"
          value={cap}
          caption="Per tool, per account. Fixed configuration, not a setting on this screen."
          accent="var(--h-amber)"
        />
      </KpiRow>

      <Card className="overflow-hidden">
        <CardTitle
          title="By tool"
          description={`Live tools only. The ${number(AGENTS.length - live.length)} still being built are on the requests page.`}
        />
        <BarList
          items={byTool}
          tone="var(--h-emerald)"
          empty="Nothing has been opened yet."
        />
      </Card>

      <UsageByUser users={users} cap={cap} now={renderedAt()} />
    </div>
  );
}
