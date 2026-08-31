import { BRAND, CONTACT, SITE_URL, type Agent } from './content';

/**
 * What a machine reads about this site.
 *
 * The pages already say who we are in prose. This says the same thing in the
 * one vocabulary a search engine, an assistant or a link preview can act on
 * rather than guess at: which pages are the same page, what the business is,
 * where a page sits in the site, and which of the tools on offer actually
 * exist.
 *
 * ── The one rule this file is built around ──────────────────────────────────
 *
 * Structured data is a claim made to a machine that will never read the page
 * around it to check. That makes it the easiest place on a website to lie by
 * accident, and the hardest place for anyone to notice. So everything here is
 * derived from `content.ts` — the same file the pages themselves render from —
 * and nothing is written down twice. If the roster changes, this changes with
 * it. If a fact is not in `content.ts`, it does not get asserted here, however
 * much a validator would like to see the field filled in.
 *
 * The visible consequence is `serviceLd`, which only describes agents that are
 * `live`. Emitting a Service for something on the roadmap would be telling
 * Google we sell a thing you cannot buy.
 */

/** A path on this site, as the absolute URL structured data has to use. */
export function absolute(path: string): string {
  return new URL(path, SITE_URL).toString();
}

/*
 * Stable @id values, so the nodes below can point at each other instead of
 * repeating themselves. A consumer that meets the Organization on the home page
 * and again as a breadcrumb's publisher should understand those as one entity,
 * and an @id is the only thing that tells it so.
 */
const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;
const PLACE_ID = `${SITE_URL}/#business`;

/**
 * Where the business is.
 *
 * Locality and region only. The site says "built by chartered accountants, in
 * Mumbai" and puts the data in ap-south-1, and that is the whole of what this
 * repository knows about where anybody sits. A `streetAddress` and a
 * `telephone` are what Google actually wants here, and both would have to be
 * invented, which is not a trade worth making for a rich result.
 */
const ADDRESS = {
  '@type': 'PostalAddress',
  addressLocality: 'Mumbai',
  addressRegion: 'MH',
  addressCountry: 'IN',
} as const;

/** The firm, as an entity rather than as a home page. */
function organization() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: BRAND.name,
    url: absolute('/'),
    description: BRAND.blurb,
    slogan: BRAND.tagline,
    email: CONTACT.email,
    address: ADDRESS,
    areaServed: { '@type': 'Country', name: 'India' },
    logo: {
      '@type': 'ImageObject',
      url: absolute('/brand/icon-512.png'),
      width: 512,
      height: 512,
      caption: `${BRAND.name} logo`,
    },
  };
}

/**
 * The same firm again, as somewhere that exists in a place.
 *
 * `ProfessionalService` rather than the bare `LocalBusiness` it descends from:
 * both are local-business schema, and the subtype is the one that says what
 * kind. A generic LocalBusiness is the type you pick when you have not decided
 * what the business does.
 *
 * It is a separate node from the Organization, not a merged one, because they
 * answer different questions — "who publishes this site" and "who is this
 * business" — and `parentOrganization` is what ties them together.
 */
function localBusiness() {
  return {
    '@type': 'ProfessionalService',
    '@id': PLACE_ID,
    name: BRAND.name,
    url: absolute('/'),
    description: BRAND.blurb,
    email: CONTACT.email,
    address: ADDRESS,
    areaServed: { '@type': 'Country', name: 'India' },
    parentOrganization: { '@id': ORG_ID },
    knowsAbout: [
      'Payment vouchers and approvals',
      'Bank reconciliation',
      'Goods and Services Tax',
      'Tax deducted at source',
      'Statutory audit support',
    ],
  };
}

/** The site itself, so a search engine has something to hang the name on. */
function website() {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    name: BRAND.name,
    url: absolute('/'),
    description: BRAND.blurb,
    inLanguage: 'en-IN',
    publisher: { '@id': ORG_ID },
  };
}

/**
 * One tool, as something a person can actually be sold.
 *
 * Live agents only — see the note at the top of this file. `AGENTS` is the
 * source, so an agent shipping is the only edit needed to have it described
 * here, and an agent slipping is the only edit needed to take it back out.
 */
export function serviceLd(agent: Agent) {
  return graph([
    {
      '@type': 'Service',
      '@id': absolute(`/agents/${agent.slug}#service`),
      name: agent.name,
      serviceType: agent.category,
      description: agent.summary,
      url: absolute(`/agents/${agent.slug}`),
      provider: { '@id': ORG_ID },
      areaServed: { '@type': 'Country', name: 'India' },
      audience: { '@type': 'BusinessAudience', name: 'Finance and accounts teams' },
    },
  ]);
}

/** The home page's claim about who is behind all of this. */
export function siteLd() {
  return graph([organization(), localBusiness(), website()]);
}

export type Crumb = { label: string; href: string };

/**
 * The trail, in the order a reader would walk it, ending on the current page.
 *
 * Positions are 1-based because schema.org says so, and are derived from the
 * array rather than written down, so a trail cannot be numbered wrongly.
 */
export function breadcrumbLd(trail: readonly Crumb[]) {
  return graph([
    {
      '@type': 'BreadcrumbList',
      itemListElement: trail.map((crumb, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: crumb.label,
        item: absolute(crumb.href),
      })),
    },
  ]);
}

/** Wrap nodes in the envelope every consumer expects. */
function graph(nodes: object[]) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

/**
 * Serialise for a <script> tag.
 *
 * The escaping is not decoration. JSON is allowed to contain the four
 * characters that close a script element, and a browser closes the script the
 * moment it sees them regardless of the quoting around it — which turns a
 * product description into markup. None of the strings in `content.ts` contain
 * a `<` today; this is here so that the day one does, it stays data.
 */
export function ldJson(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
