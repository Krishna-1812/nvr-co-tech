import type { Metadata } from 'next';
import { BRAND, CANONICAL_URL, CONTACT, PROFILES, type Agent } from './content';

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
  return new URL(path, CANONICAL_URL).toString();
}

/**
 * Everything a public page says about itself in its head, from one call.
 *
 * Each page used to set a title, a description and a canonical, and inherit the
 * rest from the root layout, which meant every page's link preview was the home
 * page's: its title, its description and `og:url` pointing at /. A link to a
 * tool shared on WhatsApp or LinkedIn showed up as the home page, and a crawler
 * that reads `og:url` was told the same. Next replaces `openGraph` as a whole
 * rather than merging it, so a page that sets any of it has to set all of it,
 * and this is where that happens. The share image still comes from the nearest
 * opengraph-image file, which outranks anything set here.
 *
 * `absoluteTitle` is for a title that already carries the brand (the home page),
 * which would otherwise get it twice from the root layout's template.
 */
export function pageMeta({
  title,
  description,
  path,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
}): Metadata {
  const shown = absoluteTitle ? title : `${title} · ${BRAND.name}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: BRAND.name,
      locale: 'en_IN',
      title: shown,
      description,
      url: path,
    },
    twitter: { card: 'summary_large_image', title: shown, description },
  };
}

/*
 * Stable @id values, so the nodes below can point at each other instead of
 * repeating themselves. A consumer that meets the Organization on the home page
 * and again as a breadcrumb's publisher should understand those as one entity,
 * and an @id is the only thing that tells it so.
 */
const ORG_ID = `${CANONICAL_URL}/#organization`;
const SITE_ID = `${CANONICAL_URL}/#website`;
const PLACE_ID = `${CANONICAL_URL}/#business`;

/**
 * Where the business is.
 *
 * Locality and region only, and that is the whole of what this repository knows
 * about where anybody sits. A `streetAddress` and a `telephone` are what Google
 * actually wants here, and both would have to be invented, which is not a trade
 * worth making for a rich result.
 *
 * ── Read this before changing it ────────────────────────────────────────────
 *
 * This is now the only place on the site that states a location. The pages used
 * to say it in four: the footer's "built by chartered accountants, in Mumbai",
 * the contact page's "Built by" and "Hosting" rows, and the about page's
 * "1 place your data sits — Mumbai, ap-south-1". All four were removed, and
 * keeping this node as it is was a deliberate call rather than an oversight.
 *
 * The trade being made: markup that asserts a location no reader sees is the
 * kind of mismatch Google says can get structured data ignored. Against that,
 * the locality is true, and it is the only thing here that could earn a local
 * result at all. If that ever looks like the wrong side of the trade, the fix
 * is to drop `address` from localBusiness — or the node with it — and not to
 * put a street and a telephone in to make it look more convincing.
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
    ...(PROFILES.length > 0 ? { sameAs: [...PROFILES] } : {}),
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
      '@id': absolute(`/tools/${agent.slug}#service`),
      name: agent.name,
      serviceType: agent.category,
      description: agent.summary,
      url: absolute(`/tools/${agent.slug}`),
      provider: { '@id': ORG_ID },
      areaServed: { '@type': 'Country', name: 'India' },
      audience: { '@type': 'BusinessAudience', name: 'Finance and accounts teams' },
    },
    /*
     * The same tool as the thing you open. Every live tool is a page in a
     * browser, so `WebApplication` is the plain truth, and it is the type
     * assistants and search engines use to answer "is there a tool that…".
     * No `offers`: there is no published price, and a made-up one is the kind
     * of claim this file exists to refuse.
     */
    {
      '@type': 'WebApplication',
      '@id': absolute(`/tools/${agent.slug}#app`),
      name: agent.name,
      description: agent.search.description,
      url: absolute(`/tools/${agent.slug}`),
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Any (runs in a web browser)',
      browserRequirements: 'Requires JavaScript',
      inLanguage: 'en-IN',
      featureList: agent.does,
      publisher: { '@id': ORG_ID },
    },
  ]);
}

/**
 * A tool's plain questions and answers, for the ones that have them.
 *
 * Only what is written on the page, word for word: structured data that says
 * more than the page does is the thing search engines penalise, and here it
 * would also be legal advice nobody reviewed.
 */
export function faqLd(faq: readonly { q: string; a: string }[]) {
  return graph([
    {
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ]);
}

/**
 * A guide, as an article the firm published.
 *
 * The author is the organisation, not a named person: no person's name is in
 * this repository to put there, and a made-up byline is exactly the kind of
 * claim this file refuses. `about` points at the tool the guide leads to, so a
 * reader of the data can tell what the article is in service of.
 */
export function articleLd(guide: {
  slug: string;
  title: string;
  search: { description: string };
  updated: string;
  tool: string;
}) {
  const url = absolute(`/guides/${guide.slug}`);
  return graph([
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: guide.title,
      description: guide.search.description,
      url,
      mainEntityOfPage: url,
      dateModified: guide.updated,
      inLanguage: 'en-IN',
      // Named in full, not only by @id: the Organization node itself is only on
      // the home page, and a reader of this page alone should not have to go
      // there to learn who wrote it.
      author: { '@type': 'Organization', '@id': ORG_ID, name: BRAND.name, url: absolute('/') },
      publisher: {
        '@type': 'Organization',
        '@id': ORG_ID,
        name: BRAND.name,
        url: absolute('/'),
        logo: { '@type': 'ImageObject', url: absolute('/brand/icon-512.png') },
      },
      about: { '@id': absolute(`/tools/${guide.tool}#service`) },
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
