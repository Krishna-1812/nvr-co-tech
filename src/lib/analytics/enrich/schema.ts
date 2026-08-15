/**
 * Reading what a company says about itself in its own markup.
 *
 * Two sources, in order of how much the company meant them. JSON-LD is
 * structured data a company published deliberately for machines to read, which
 * makes it both the most accurate and the most consented-to source of
 * firmographics there is. OpenGraph and the plain meta description are the
 * fallback: less precise, but present on nearly every site.
 *
 * A regex over HTML rather than a parser, and worth saying why: the whole of
 * this file's job is to find `<script type="application/ld+json">` blocks and
 * three meta tags. Pulling in a DOM implementation to do that would add a large
 * dependency to a code path that runs against arbitrary, frequently malformed
 * third-party markup — where a strict parser's failure mode is throwing, and a
 * regex's is finding nothing.
 */

export type SiteFacts = {
  name: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  linkedin: string | null;
  foundedYear: string | null;
};

const EMPTY: SiteFacts = {
  name: null,
  description: null,
  city: null,
  country: null,
  linkedin: null,
  foundedYear: null,
};

const clean = (value: unknown, limit = 400): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, limit) : null;
};

type Node = Record<string, unknown>;

const typeOf = (node: Node): string[] => {
  const t = node['@type'];
  if (typeof t === 'string') return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string');
  return [];
};

/**
 * An Organization node, wherever it is hiding.
 *
 * It may be the whole document, an entry in an `@graph` array, or one of
 * several top-level objects. `LocalBusiness` and `Corporation` are accepted
 * alongside `Organization` because schema.org treats them as subtypes and
 * plenty of sites use them instead.
 */
function findOrganisation(value: unknown, depth = 0): Node | null {
  if (depth > 3 || !value) return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findOrganisation(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof value !== 'object') return null;
  const node = value as Node;

  if (typeOf(node).some((t) => /organization|corporation|localbusiness/i.test(t))) return node;

  return findOrganisation(node['@graph'], depth + 1);
}

/** An address, which schema.org allows to be either one object or a list. */
function readAddress(address: unknown): { city: string | null; country: string | null } {
  const first = Array.isArray(address) ? address[0] : address;
  if (!first || typeof first !== 'object') return { city: null, country: null };

  const node = first as Node;
  const country = node.addressCountry;

  return {
    city: clean(node.addressLocality, 120),
    country: clean(
      typeof country === 'object' && country ? (country as Node).name : country,
      120,
    ),
  };
}

export function readJsonLd(html: string): SiteFacts {
  const blocks = [
    ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];

  for (const [, body] of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body.trim());
    } catch {
      // Malformed JSON-LD is extremely common. Skip it and try the next block.
      continue;
    }

    const org = findOrganisation(parsed);
    if (!org) continue;

    const { city, country } = readAddress(org.address);
    const sameAs = Array.isArray(org.sameAs) ? org.sameAs : [];

    return {
      name: clean(org.legalName, 200) ?? clean(org.name, 200),
      description: clean(org.description),
      city,
      country,
      linkedin:
        sameAs.find((u): u is string => typeof u === 'string' && u.includes('linkedin.com')) ?? null,
      // Only the year. A full ISO date is more precision than anybody reads.
      foundedYear: clean(org.foundingDate, 4),
    };
  }

  return EMPTY;
}

const meta = (html: string, pattern: RegExp): string | null => {
  const match = html.match(pattern);
  return match ? clean(decodeEntities(match[1] ?? '')) : null;
};

/** Enough of them to read a title without pulling in a decoder. */
function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export function readMetaTags(html: string): { name: string | null; description: string | null } {
  const head = html.slice(0, 200_000);

  return {
    name:
      meta(head, /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
      ?? meta(head, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description:
      meta(head, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
      ?? meta(head, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i),
  };
}

/**
 * People named on a company's own team page.
 *
 * The filter is the whole method. Without insisting that the second half of a
 * heading-and-paragraph pair actually contains a job title, this returns things
 * like "500M+ requests served" as a person's name and "What's new" as their
 * role — which is worse than finding nobody, because it is confidently wrong on
 * a screen where everything else is true.
 *
 * LinkedIn is never touched, for any purpose. This reads a company's own /about
 * or /team page or it reads nothing.
 */
const TITLE_WORDS =
  /\b(ceo|cto|coo|cfo|cmo|cio|cpo|chief|president|vp|vice president|director|head of|manager|founder|co-founder|partner|principal|lead|owner|chairman|chairperson|managing)\b/i;

export function readPeople(html: string): { name: string; title: string }[] {
  const pairs = [
    ...html.matchAll(/<h[2-5][^>]*>([\s\S]{2,80}?)<\/h[2-5]>\s*(?:<[^>]+>\s*)?<p[^>]*>([\s\S]{2,120}?)<\/p>/gi),
  ];

  const people: { name: string; title: string }[] = [];
  const seen = new Set<string>();

  for (const [, rawName, rawTitle] of pairs) {
    const name = clean(decodeEntities(strip(rawName)), 80);
    const title = clean(decodeEntities(strip(rawTitle)), 120);
    if (!name || !title || !TITLE_WORDS.test(title)) continue;
    // A person's name is two or three words, not a sentence.
    if (name.split(' ').length > 4 || /[.!?]/.test(name)) continue;
    if (seen.has(name.toLowerCase())) continue;

    seen.add(name.toLowerCase());
    people.push({ name, title });
    if (people.length >= 8) break;
  }

  return people;
}

const strip = (html: string) => html.replace(/<[^>]*>/g, ' ');
