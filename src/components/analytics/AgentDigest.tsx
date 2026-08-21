import { Card, CardTitle } from '@/components/ui/primitives';
import { number, NUM } from '@/components/analytics/Figures';
import { Avatar } from '@/components/analytics/People';
import { AGENTS } from '@/lib/marketing/content';
import { aliasAgent } from '@/lib/analytics/aliases';
import { accentFor, displayName } from '@/lib/analytics/identity';
import type { RunEvent } from '@/lib/analytics/people';
import { cn } from '@/lib/utils';

/**
 * Tool usage, summarised at the foot of the members page.
 *
 * The reason it is here and not only on its own screen: the question "is anybody
 * signing up" and the question "does anybody who signed up actually use it" are
 * the same conversation, and having to navigate between two pages to hold both
 * halves of it in your head is exactly how a dashboard fails to answer anything.
 *
 * Deliberately a digest and not a copy. Four figures, the tools ranked, eight
 * people at most, and a link to the full screen. Reproducing that page here would
 * mean two implementations of the same numbers, which eventually disagree.
 *
 * Server-rendered from data the page already has, rather than fetched separately.
 * The design this follows makes a second request to another page's endpoint for
 * this block, because it had no way to share a query between two views; there is
 * nothing to gain from repeating that here.
 */
export function AgentDigest({
  runs,
  cap,
  directory,
}: {
  runs: RunEvent[];
  cap: number;
  directory: Map<string, { name: string | null; photo: string | null }>;
}) {
  const nameOf = new Map(AGENTS.map((agent) => [agent.slug, agent.name]));
  const live = AGENTS.filter((agent) => agent.stage === 'live');

  const perTool = new Map<string, number>();
  const perPerson = new Map<string, Map<string, number>>();

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
  }

  const busiest = Math.max(1, ...perTool.values());

  const atCap = [...perPerson.values()].filter((tools) =>
    [...tools.values()].some((used) => used >= cap),
  ).length;

  const top = [...perPerson.entries()]
    .map(([email, tools]) => ({
      email,
      tools: [...tools.entries()].sort((a, b) => b[1] - a[1]),
      total: [...tools.values()].reduce((n, v) => n + v, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  return (
    <Card className="overflow-hidden">
      <CardTitle
        title="What they do once they are in"
        description={
          'Tool opens for whichever half of the roster is showing above. This used to be a summary '
          + 'with a link to a screen of its own; that screen reported an allowance against a cap '
          + 'nobody enforces, in a product with no billing, so it is gone and this is now the whole '
          + 'breakdown.'
        }
      />

      <div className="grid grid-cols-2 divide-x divide-y border-b sm:grid-cols-4 sm:divide-y-0">
        <Tile label="Tool opens" value={number(runs.length)} />
        <Tile label="People" value={number(perPerson.size)} />
        <Tile label="Past allowance" value={number(atCap)} tone="var(--h-rose)" />
        <Tile label="Allowance" value={number(cap)} />
      </div>

      {runs.length === 0 ? (
        <p className="text-subtle px-5 py-8 text-center text-[12.5px]">
          Nobody has opened a tool yet. A run is recorded when a reconciliation is saved or the
          assistant answers something, so this stays empty until real work happens.
        </p>
      ) : (
        <>
          <ul className="grid gap-2 border-b px-5 py-4 sm:grid-cols-2">
            {live.map((agent) => {
              const used = perTool.get(agent.slug) ?? 0;

              return (
                <li key={agent.slug} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: accentFor(agent.slug) }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[12.5px] font-medium">{agent.name}</span>
                      <span className={cn(NUM, 'shrink-0 text-[11.5px] font-semibold')}>
                        {number(used)}
                      </span>
                    </span>
                    <span className="a-track mt-1 block h-1 overflow-hidden rounded-full">
                      <span
                        className="a-fill block h-full rounded-full"
                        style={{
                          width: `${(used / busiest) * 100}%`,
                          background: accentFor(agent.slug),
                        }}
                      />
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>

          <ul className="divide-y">
            {top.map((person) => (
              <li key={person.email} className="flex items-center gap-3 px-5 py-2.5">
                <Avatar
                  email={person.email}
                  name={directory.get(person.email)?.name}
                  photo={directory.get(person.email)?.photo}
                  size={28}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium">
                    {displayName(directory.get(person.email)?.name, person.email)}
                  </span>
                  <span className={cn(NUM, 'text-subtle block truncate text-[10.5px]')}>
                    {person.email}
                  </span>
                </span>
                <span className="hidden flex-wrap justify-end gap-1 sm:flex">
                  {person.tools.map(([slug, used]) => (
                    <span
                      key={slug}
                      title={nameOf.get(slug) ?? slug}
                      style={{
                        ['--tone' as string]: used >= cap ? 'var(--h-rose)' : 'var(--h-cyan)',
                      }}
                      className="tinted inline-flex rounded-full border px-1.5 py-px text-[10px] font-semibold"
                    >
                      {(nameOf.get(slug) ?? slug).split(' ')[0]} {used}/{cap}
                    </span>
                  ))}
                </span>
                <span className={cn(NUM, 'w-8 shrink-0 text-right text-[12px] font-semibold')}>
                  {number(person.total)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-5 py-3.5">
      <p className={cn(NUM, 'text-[1.15rem] font-semibold')} style={tone ? { color: tone } : undefined}>
        {value}
      </p>
      <p className="a-label mt-0.5">{label}</p>
    </div>
  );
}
