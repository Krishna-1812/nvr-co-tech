import { createHash } from 'node:crypto';
import { ANTHROPIC_BASE_URL, MODEL, apiKey } from '@/lib/assist/config';
import { createClient } from '@/lib/supabase/server';
import { logServerError } from '@/lib/errors/server';
import type { Person } from './people';

/**
 * The two model-written things on the customer usage screen: a short read of a
 * person, and an ordering of people by who looks worth talking to.
 *
 * Written against the messages endpoint with `fetch`, reusing the assistant's
 * own key, base URL and model constants rather than introducing a second
 * configuration. The assistant's transport itself is not reused: it is a
 * streaming generator with a tool loop, built for a conversation, and neither of
 * these is one.
 *
 * ── What the model is allowed to see ────────────────────────────────────────
 *
 * A whitelist, built by hand, of facts already on the screen. No row objects, no
 * page URLs, no message bodies, nothing from the voucher tables. This is not
 * only a privacy position: a prompt assembled by spreading a database row grows
 * new fields silently the next time somebody adds a column, and nobody reviews
 * that. Listing the fields means adding one is a decision.
 *
 * Bump PROMPT_VERSION when the instructions below change. It is part of the
 * cache key, so raising it invalidates every stored summary at once — which is
 * the point: an improved prompt should not leave last week's worse answers on
 * screen for a week.
 */

const PROMPT_VERSION = 1;

export const aiConfigured = (): boolean => apiKey() !== null;

/**
 * The subset of a person the model is ever shown.
 *
 * A named type rather than `Person`, because it is also the shape the browser
 * sends back when it asks for a summary — and a payload typed as the whole
 * person would invite fields into the prompt that were never reviewed for it.
 */
export type PersonFacts = Pick<
  Person,
  | 'email'
  | 'company'
  | 'visits'
  | 'pageViews'
  | 'seconds'
  | 'features'
  | 'runs'
  | 'preSignupPages'
  | 'firstSeen'
  | 'lastSeen'
>;

export type Read = {
  headline: string;
  summary: string;
  intent: 'high' | 'medium' | 'low';
};

/** Exactly what goes to the provider. Nothing reaches it that is not on this list. */
function factsFor(person: PersonFacts, days: number): Record<string, unknown> {
  return {
    company: person.company ?? 'unknown, personal email address',
    visits: person.visits,
    page_views: person.pageViews,
    minutes_on_screen: Math.round(person.seconds / 60),
    tools_used: person.features,
    tool_opens: person.runs,
    pages_read_before_signing_up: person.preSignupPages,
    first_arrived: person.firstSeen.slice(0, 10),
    last_active: person.lastSeen.slice(0, 10),
    window_days: days,
  };
}

/** The cache key: the facts, and the instructions that will shape them. */
export function factHash(person: PersonFacts, days: number): string {
  return createHash('sha256')
    .update(JSON.stringify({ v: PROMPT_VERSION, m: MODEL, f: factsFor(person, days) }))
    .digest('hex')
    .slice(0, 40);
}

const SYSTEM = [
  'You read usage data about one person who uses a finance product, and say what it suggests.',
  '',
  'Rules, all of them absolute:',
  '- Interpret. Do not restate the numbers; the reader can already see them.',
  '- Stay inside the facts given. Invent nothing — no job titles, no company details, no motives you were not told.',
  '- Never suggest an action. Do not say to reach out, follow up, or book anything. The reader decides that.',
  '- If the facts are thin, say so plainly and pick a low intent. Thin data is a finding, not a reason to guess.',
  '',
  'Reply as JSON only, no prose around it:',
  '{"headline": "under 60 characters", "summary": "two sentences", "intent": "high" | "medium" | "low"}',
].join('\n');

/**
 * One call, no streaming, no tools.
 *
 * Returns null rather than throwing on every failure path — an unconfigured key,
 * a refusal, a timeout, a reply that is not the JSON it was asked for. The
 * calling screen renders a specific explanation for the absence, which is more
 * use than an error boundary swallowing the whole table.
 */
export async function readPerson(person: PersonFacts, days: number): Promise<Read | null> {
  const key = apiKey();
  if (!key) return null;

  try {
    const response = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: JSON.stringify(factsFor(person, days)),
          },
        ],
      }),
      // Shorter than the assistant's ninety seconds: this one is blocking a
      // panel somebody is already looking at, and a slow answer is worse than a
      // stated absence.
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      await logServerError({
        route: '/lib/analytics/ai',
        message: `Summary refused (${response.status})`,
      });
      return null;
    }

    const body = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = body.content?.find((part) => part.type === 'text')?.text ?? '';

    // The model was told to answer in JSON and usually does, but a stray
    // sentence either side is the common failure and is worth surviving.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;

    const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<Read>;
    if (!parsed.headline || !parsed.summary) return null;

    return {
      headline: String(parsed.headline).slice(0, 120),
      summary: String(parsed.summary).slice(0, 600),
      intent:
        parsed.intent === 'high' || parsed.intent === 'medium' || parsed.intent === 'low'
          ? parsed.intent
          : 'low',
    };
  } catch (error) {
    await logServerError({
      route: '/lib/analytics/ai',
      message: error instanceof Error ? error.message : 'Unknown error writing a summary',
    });
    return null;
  }
}

/** The stored read for this exact set of facts, if there is one. */
export async function cachedRead(hash: string): Promise<Read | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('ai_summaries')
    .select('headline, summary, intent')
    .eq('fact_hash', hash)
    .maybeSingle();

  return data ? { headline: data.headline, summary: data.summary, intent: data.intent as Read['intent'] } : null;
}

export async function storeRead(hash: string, subject: string, read: Read): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc('cache_ai_summary', {
      p_hash: hash,
      p_subject: subject,
      p_headline: read.headline,
      p_summary: read.summary,
      p_intent: read.intent,
      p_model: MODEL,
    });
  } catch {
    // A summary that was generated but not stored is a wasted call, not a
    // failure worth showing anybody. It will be generated again next time.
  }
}

/**
 * Cache first, then generate.
 *
 * The two-step is here rather than in the route so the ordering cannot be got
 * wrong by a second caller: read, and only pay for a call on a miss.
 */
export async function readPersonCached(person: PersonFacts, days: number): Promise<Read | null> {
  const hash = factHash(person, days);

  const hit = await cachedRead(hash);
  if (hit) return hit;

  const fresh = await readPerson(person, days);
  if (fresh) await storeRead(hash, person.email, fresh);
  return fresh;
}

/* ── Ordering people ──────────────────────────────────────────────────────── */

const SORT_SYSTEM = [
  'You are given a list of people using a finance product, with usage figures for each.',
  'Return them ordered by who looks most worth a conversation.',
  '',
  'Weigh the signals in this order, strongest first:',
  '1. Opening tools, and how recently — this is the strongest signal by a distance.',
  '2. Recent activity over old activity.',
  '3. Depth: time spent and pages read, rather than a single glance.',
  '4. Coming back repeatedly rather than once.',
  '5. A real company domain over a personal email address.',
  '',
  'Reply as JSON only: {"order": ["email", "email", ...]}',
  'Every address given must appear exactly once. Add nothing.',
].join('\n');

/**
 * Returns addresses in the model's order, or null.
 *
 * The caller reorders what it already has rather than rendering what comes back,
 * and anything unrecognised is dropped — so a hallucinated address cannot put a
 * person on screen who is not in the data.
 */
export async function orderPeople(people: PersonFacts[]): Promise<string[] | null> {
  const key = apiKey();
  if (!key || people.length === 0) return null;

  const compact = people.slice(0, 200).map((p) => ({
    email: p.email,
    company: p.company,
    visits: p.visits,
    views: p.pageViews,
    minutes: Math.round(p.seconds / 60),
    runs: p.runs,
    tools: p.features.length,
    last_active: p.lastSeen.slice(0, 10),
    linked: p.preSignupPages > 0,
  }));

  try {
    const response = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4_000,
        system: SORT_SYSTEM,
        messages: [{ role: 'user', content: JSON.stringify(compact) }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) return null;

    const body = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = body.content?.find((part) => part.type === 'text')?.text ?? '';
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;

    const parsed = JSON.parse(text.slice(start, end + 1)) as { order?: unknown };
    if (!Array.isArray(parsed.order)) return null;

    const known = new Set(people.map((p) => p.email));
    const seen = new Set<string>();
    const order: string[] = [];

    for (const raw of parsed.order) {
      const email = String(raw).trim().toLowerCase();
      if (known.has(email) && !seen.has(email)) {
        seen.add(email);
        order.push(email);
      }
    }

    // Anybody the model left out keeps their existing relative position at the
    // end, so a partial answer degrades into a partial reorder rather than
    // silently dropping people off the table.
    for (const person of people) {
      if (!seen.has(person.email)) order.push(person.email);
    }

    return order;
  } catch {
    return null;
  }
}
