import { createClient } from '@/lib/supabase/server';
import type { IdentityEdgeRow, IdentityNodeRow, PersonMatch, PersonResult } from './types';
import { matchPerson, paidEnrichmentConfigured } from './enrich/paid';

/**
 * Working out who an anonymous visitor is.
 *
 * The honest constraint first, because everything below is shaped by it:
 * resolving a cold, never-seen visitor to a named stranger is not something
 * first-party logic can do. It requires a licensed identity graph or a
 * publisher co-op, and both of those are contracts rather than code. What IS
 * fully buildable in-house — and is genuinely the more valuable half — is this:
 * the moment somebody signs in or fills in a form, everything they read before
 * they did becomes attributable to them, because it was all keyed on a visitor
 * id their browser has been carrying the whole time.
 *
 * The rule that makes the graph trustworthy is the edge kind. A `deterministic`
 * edge is proof — a login, a form submission, a webhook — and only those may
 * merge two identities. A `co_occurrence` edge records that two identifiers
 * were seen together on an address or a device, and is never read by the
 * resolver at all. That is not caution for its own sake: the classic way an
 * identity graph destroys itself is one coincidental shared IP, two people on
 * the same office wifi, silently fusing two unrelated browsing histories into
 * one person who appears to have read everything.
 *
 * Nothing here ever invents a person. No anchor and no provider hit means the
 * visitor stays anonymous, with the reason recorded.
 */

/** Bounded so a growing graph can never turn a dashboard into a full scan. */
const NODE_LIMIT = 20_000;
const EDGE_LIMIT = 40_000;

export type Graph = {
  nodes: Map<number, IdentityNodeRow>;
  /** Undirected adjacency over deterministic edges only. */
  neighbours: Map<number, number[]>;
  byValue: Map<string, number>;
};

const key = (kind: string, value: string) => `${kind}:${value}`;

/**
 * The whole graph, once.
 *
 * A visitor list resolves dozens of people, and doing that with a query per
 * visitor is dozens of round-trips to answer one screen. The graph is small —
 * it holds identifiers, not events — so it is cheaper to read it whole and walk
 * it in memory.
 */
export async function readGraph(): Promise<Graph> {
  const supabase = await createClient();

  const [nodes, edges] = await Promise.all([
    supabase.from('identity_nodes').select('*').order('id').limit(NODE_LIMIT),
    supabase
      .from('identity_edges')
      .select('*')
      .eq('kind', 'deterministic')
      .order('id')
      .limit(EDGE_LIMIT),
  ]);

  const graph: Graph = { nodes: new Map(), neighbours: new Map(), byValue: new Map() };

  for (const node of (nodes.data ?? []) as IdentityNodeRow[]) {
    graph.nodes.set(node.id, node);
    graph.byValue.set(key(node.kind, node.value), node.id);
  }

  const link = (a: number, b: number) => {
    (graph.neighbours.get(a) ?? graph.neighbours.set(a, []).get(a)!).push(b);
  };

  for (const edge of (edges.data ?? []) as IdentityEdgeRow[]) {
    // Both directions. The edge is stored once, from the visitor outwards, but
    // "who else is this person" is a question that has to be answerable from
    // either end.
    link(edge.src_id, edge.dst_id);
    link(edge.dst_id, edge.src_id);
  }

  return graph;
}

/**
 * Every identity-bearing node reachable from a visitor id through proof alone.
 *
 * A breadth-first walk rather than a single hop, because the chain can be
 * longer than one edge: a visitor id proves an email, the same email was later
 * seen against a CRM id, and the CRM id carries the job title. All three belong
 * to one person and only the traversal knows that.
 */
export function clusterFor(graph: Graph, visitorId: string): IdentityNodeRow[] {
  const start = graph.byValue.get(key('visitor_id', visitorId));
  if (start == null) return [];

  const seen = new Set<number>([start]);
  const queue = [start];
  const found: IdentityNodeRow[] = [];

  while (queue.length) {
    const current = queue.shift()!;
    for (const next of graph.neighbours.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);

      const node = graph.nodes.get(next);
      if (node && node.kind !== 'ip' && node.kind !== 'device' && node.kind !== 'visitor_id') {
        found.push(node);
      }
    }
  }

  return found;
}

const attr = (node: IdentityNodeRow, name: string): string | null => {
  const value = node.attrs?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

/**
 * The first-party answer, from the graph alone.
 *
 * When somebody identified themselves more than once with slightly different
 * details — a form that asked for a name, a login that did not — the most
 * recently seen node wins. Later is not always more complete, but it is always
 * more current, and picking by recency is at least a rule somebody can predict.
 */
export function resolveFromGraph(graph: Graph, visitorId: string): PersonResult {
  const cluster = clusterFor(graph, visitorId);
  if (cluster.length === 0) {
    return { resolved: false, reason: 'No deterministic anchor: this visitor has never identified themselves.' };
  }

  const survivor = [...cluster].sort((a, b) => b.last_seen.localeCompare(a.last_seen))[0];
  const email = cluster.find((n) => n.kind === 'email')?.value ?? null;

  return {
    resolved: true,
    person: {
      fullName: attr(survivor, 'full_name'),
      email,
      title: attr(survivor, 'title'),
      company: attr(survivor, 'company'),
      linkedin: null,
      confidence: 1,
      method: 'first_party',
    },
  };
}

/**
 * The whole waterfall, stopping at the first hit.
 *
 * Step one is free, certain, and covers everybody who has ever interacted with
 * us. Steps two and three cost money or need a contract, and both are off
 * unless somebody has deliberately switched them on.
 */
export async function resolvePerson(
  graph: Graph,
  visitorId: string,
  { allowPaid = false }: { allowPaid?: boolean } = {},
): Promise<PersonResult> {
  const firstParty = resolveFromGraph(graph, visitorId);

  if (firstParty.resolved) {
    /*
     * A thin record — an email and nothing else — is the one place a credit is
     * worth spending automatically, and only because it is bounded: a
     * deterministic match is high-value and rare compared to raw anonymous
     * traffic, so this cannot run away. It is still behind a flag that is off
     * by default.
     */
    const thin = !firstParty.person.fullName && Boolean(firstParty.person.email);
    if (thin && allowPaid && paidEnrichmentConfigured()) {
      const better = await matchPerson({ email: firstParty.person.email });
      if (better) return { resolved: true, person: { ...better, ...firstParty.person, ...clean(better) } };
    }
    return firstParty;
  }

  const external = await fromCoopFeed(graph, visitorId);
  if (external) return { resolved: true, person: external };

  return firstParty;
}

/** Only the fields the provider actually filled in, so nothing certain is lost. */
function clean(match: PersonMatch): Partial<PersonMatch> {
  return Object.fromEntries(
    Object.entries(match).filter(([, v]) => v !== null && v !== ''),
  ) as Partial<PersonMatch>;
}

type CoopRow = {
  hashed_email?: string;
  full_name?: string;
  email?: string;
  title?: string;
  company?: string;
  linkedin_url?: string;
};

let coopCache: Map<string, CoopRow> | null = null;

/**
 * The plug point for a licensed graph or a data-sharing co-op.
 *
 * Ships as a file reader rather than as an integration, and that is the point:
 * a real co-op feed and a real licensed graph both arrive as exactly this shape
 * — hashed email on the left, an identity on the right — so dropping the file
 * in lights up cold resolution with no code change at all. The interface exists
 * so that signing a contract later is a procurement decision rather than an
 * engineering project.
 *
 * With no file configured this returns nothing, every time, quietly. That is
 * the current state and it is the correct one.
 */
async function fromCoopFeed(graph: Graph, visitorId: string): Promise<PersonMatch | null> {
  const path = process.env.ANALYTICS_COOP_FILE;
  if (!path) return null;

  try {
    if (!coopCache) {
      const { readFile } = await import('node:fs/promises');
      const parsed = JSON.parse(await readFile(path, 'utf8')) as CoopRow[];
      coopCache = new Map(
        parsed
          .filter((r) => r.hashed_email)
          .map((r) => [r.hashed_email!.toLowerCase(), r] as const),
      );
    }

    // A hashed email is only reachable if the visitor has one recorded, which
    // in practice means a hashed feed was ingested for them earlier.
    const hashed = clusterFor(graph, visitorId).find((n) => n.kind === 'email_sha256');
    if (!hashed) return null;

    const row = coopCache.get(hashed.value.toLowerCase());
    if (!row?.full_name) return null;

    return {
      fullName: row.full_name,
      email: row.email ?? null,
      title: row.title ?? null,
      company: row.company ?? null,
      linkedin: row.linkedin_url ?? null,
      // Somebody else's inference. Never 1.0, which is reserved for proof.
      confidence: 0.8,
      method: 'coop',
    };
  } catch {
    return null;
  }
}

/** The hash a co-op feed is keyed by. Lower-cased and trimmed first, always. */
export async function hashEmail(email: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}
