import { describe, expect, it } from 'vitest';
import { AGENTS, BRAND, CANONICAL_URL, HOME_FAQ, HOME_SEARCH, LIVE_AGENTS, STAGE_LABEL } from './content';
import { OPEN_TOOLS } from '@/lib/access';
import { ALL_GUIDES } from '@/lib/guides';
import { TITLE_FITS, absolute, breadcrumbLd, collectionLd, ldJson, pageMeta, serviceLd, siteLd } from './seo';

/**
 * Structured data is a set of claims made to a machine that will never read the
 * page around it to check them. Nothing here tests that the JSON is pretty; it
 * tests the three ways this file could quietly start lying:
 *
 *   - a relative URL, which makes an @id ambiguous and a breadcrumb point at
 *     nothing;
 *   - a claim about the business that nobody in this repository ever wrote
 *     down; and
 *   - a Service for a tool that does not exist.
 */

/*
 * The builders type their nodes as plain `object`, which is right for them —
 * schema.org shapes have nothing useful in common — and awkward for a test that
 * wants to look inside one. Narrowing happens here, once.
 */
type Graph = { '@context': string; '@graph': object[] };
type Node = Record<string, unknown>;

const nodes = (graph: Graph): Node[] => graph['@graph'] as Node[];
const byType = (graph: Graph, type: string): Node =>
  nodes(graph).find((n) => n['@type'] === type) ?? {};

describe('absolute', () => {
  it('resolves a path against the production origin', () => {
    expect(absolute('/tools')).toBe(`${CANONICAL_URL}/tools`);
  });

  it('leaves the origin itself with its root path', () => {
    expect(absolute('/')).toBe(`${CANONICAL_URL}/`);
  });
});

describe('ldJson', () => {
  it('escapes the one character that could close the script tag', () => {
    // A description containing this would otherwise end the <script> early and
    // spill the rest of the JSON into the page as markup.
    const out = ldJson({ name: '</script><img src=x onerror=alert(1)>' });
    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003c');
    // Still valid JSON, and still the same string once parsed.
    expect(JSON.parse(out).name).toBe('</script><img src=x onerror=alert(1)>');
  });
});

describe('siteLd', () => {
  const graph = siteLd();

  it('describes the organisation, the business and the site', () => {
    expect(nodes(graph).map((n) => n['@type'])).toEqual([
      'Organization',
      'ProfessionalService',
      'WebSite',
    ]);
  });

  it('gives every node an absolute id', () => {
    for (const node of nodes(graph)) {
      expect(String(node['@id'])).toMatch(/^https:\/\//);
    }
  });

  it('resolves every reference it makes to a node it also defines', () => {
    // A dangling @id is the commonest way a @graph becomes three unrelated
    // fragments rather than one description of one company.
    const defined = new Set(nodes(graph).map((n) => n['@id']));
    const dangling: string[] = [];
    JSON.parse(JSON.stringify(graph), (key, value) => {
      if (key === '@id' && typeof value === 'string' && !defined.has(value)) dangling.push(value);
      return value;
    });
    expect(dangling).toEqual([]);
  });

  it('claims a location only as far as the site itself does', () => {
    // A streetAddress, a postalCode or a telephone here would be invented, and
    // this is the assertion that keeps somebody from adding one because a
    // validator asked for it.
    //
    // This used to cite the visible copy that made the same claim — the footer's
    // "built by chartered accountants, in Mumbai", then the contact page's
    // "Built by" row after the footer line went. Both are gone now, and so is
    // the about page's "Mumbai, ap-south-1". The locality survives only here, by
    // decision; see the note on ADDRESS in seo.ts for the trade that was made.
    //
    // Which makes this test more load-bearing than it was, not less: there is no
    // longer a page to check the markup against, so what the markup may claim is
    // whatever this says it may claim.
    const business = byType(graph, 'ProfessionalService') as Record<string, unknown>;
    expect(business.address).toEqual({
      '@type': 'PostalAddress',
      addressLocality: 'Mumbai',
      addressRegion: 'MH',
      addressCountry: 'IN',
    });
  });

  it('names the brand rather than a hard-coded string', () => {
    expect(byType(graph, 'Organization')).toMatchObject({ name: BRAND.name });
    expect(byType(graph, 'WebSite')).toMatchObject({ name: BRAND.name });
  });

  it('carries no empty values', () => {
    // An empty string is worse than an absent property: it asserts the field
    // and then says nothing, which is what a consumer reports as a broken
    // record rather than an incomplete one.
    const walk = (v: unknown): void => {
      if (typeof v === 'string') expect(v.length).toBeGreaterThan(0);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
      else expect(v).not.toBeUndefined();
    };
    walk(graph);
  });
});

describe('serviceLd', () => {
  const live = AGENTS.find((a) => a.stage === 'live')!;

  it('points the service at its own page and at the organisation', () => {
    const service = byType(serviceLd(live), 'Service') as Record<string, unknown>;
    expect(service.url).toBe(absolute(`/tools/${live.slug}`));
    expect(service.provider).toEqual({ '@id': `${CANONICAL_URL}/#organization` });
  });

  it('describes the agent in the words the roster uses', () => {
    const service = byType(serviceLd(live), 'Service') as Record<string, unknown>;
    expect(service.name).toBe(live.name);
    expect(service.description).toBe(live.summary);
    expect(service.serviceType).toBe(live.category);
  });
});

describe('breadcrumbLd', () => {
  const trail = [
    { label: 'Home', href: '/' },
    { label: 'Tools', href: '/tools' },
    { label: 'Voucher Desk', href: '/tools/voucher-desk' },
  ];

  it('numbers the trail from one, in order', () => {
    const list = byType(breadcrumbLd(trail), 'BreadcrumbList') as {
      itemListElement: { position: number; name: string; item: string }[];
    };
    expect(list.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(list.itemListElement.map((i) => i.name)).toEqual([
      'Home',
      'Tools',
      'Voucher Desk',
    ]);
  });

  it('makes every item absolute', () => {
    const list = byType(breadcrumbLd(trail), 'BreadcrumbList') as {
      itemListElement: { item: string }[];
    };
    expect(list.itemListElement.map((i) => i.item)).toEqual([
      `${CANONICAL_URL}/`,
      `${CANONICAL_URL}/tools`,
      `${CANONICAL_URL}/tools/voucher-desk`,
    ]);
  });

  it('survives a single-item trail', () => {
    const list = byType(breadcrumbLd([{ label: 'Home', href: '/' }]), 'BreadcrumbList') as {
      itemListElement: unknown[];
    };
    expect(list.itemListElement).toHaveLength(1);
  });
});

describe('the roster, as machines see it', () => {
  it('has a stage label for every agent, so no card can go out unlabelled', () => {
    // The agent social card leads with this, and six of the eight are not
    // built. A missing label there reads as a product you can buy today.
    for (const agent of AGENTS) {
      expect(STAGE_LABEL[agent.stage]).toBeTruthy();
    }
  });
});

describe('the canonical origin', () => {
  it('is the host that answers, not the one that redirects to it', () => {
    // The bare domain answers with a permanent redirect to www. A canonical
    // naming it tells Google every page lives somewhere that sends it away.
    expect(CANONICAL_URL).toBe('https://www.thefinanceintelligence.com');
  });
});

describe('how each tool is named in a search result', () => {
  // The root layout adds " · The Finance Intelligence" (27 characters), and a
  // result shows about sixty before it cuts the title off.
  const SUFFIX = ` · ${BRAND.name}`.length;

  it('gives every tool a search title that still fits with the site name after it', () => {
    for (const a of AGENTS) {
      expect(a.search.title.length + SUFFIX, a.slug).toBeLessThanOrEqual(76);
      expect(a.search.title.length, a.slug).toBeLessThanOrEqual(49);
    }
  });

  it('keeps every description inside what a result shows', () => {
    for (const a of AGENTS) expect(a.search.description.length, a.slug).toBeLessThanOrEqual(160);
    expect(HOME_SEARCH.description.length).toBeLessThanOrEqual(160);
  });

  it('says in the result itself when a tool is not built', () => {
    // Someone who searches "GSTR-2B reconciliation" and lands on a plan has
    // been misled unless the result told them first.
    for (const a of AGENTS.filter((x) => x.stage !== 'live')) {
      expect(a.search.title, a.slug).toMatch(/\(Planned\)$/);
      expect(a.search.description, a.slug).toMatch(/^Planned: /);
    }
    for (const a of AGENTS.filter((x) => x.stage === 'live')) {
      expect(a.search.title, a.slug).not.toMatch(/Planned/);
    }
  });

  it('gives every live tool questions to answer, and no tool that is not built any', () => {
    for (const a of AGENTS.filter((x) => x.stage === 'live')) expect(a.faq?.length ?? 0, a.slug).toBeGreaterThanOrEqual(3);
    for (const a of AGENTS.filter((x) => x.stage !== 'live')) expect(a.faq, a.slug).toBeUndefined();
  });
});

describe('pageMeta', () => {
  const meta = pageMeta({ title: 'Tools', description: 'Every tool.', path: '/tools' });

  it('points the link preview at the page, not the home page', () => {
    // Every page used to inherit the root layout's og:url of "/", so a shared
    // link to a tool previewed as the home page.
    expect(meta.openGraph).toMatchObject({ url: '/tools', title: `Tools · ${BRAND.name}`, description: 'Every tool.' });
    expect(meta.twitter).toMatchObject({ title: `Tools · ${BRAND.name}`, description: 'Every tool.' });
    expect(meta.alternates).toEqual({ canonical: '/tools' });
  });

  it('does not add the brand twice to a title that already has it', () => {
    const home = pageMeta({ title: HOME_SEARCH.title, description: HOME_SEARCH.description, path: '/', absoluteTitle: true });
    expect(home.title).toEqual({ absolute: HOME_SEARCH.title });
    expect(home.openGraph).toMatchObject({ title: HOME_SEARCH.title });
  });
});

describe('the web application node', () => {
  const live = AGENTS.find((a) => a.stage === 'live')!;
  const app = byType(serviceLd(live), 'WebApplication') as Record<string, unknown>;

  it('describes the live tool as something opened in a browser, with what it does', () => {
    expect(app.url).toBe(absolute(`/tools/${live.slug}`));
    expect(app.applicationCategory).toBe('FinanceApplication');
    expect(app.featureList).toEqual(live.does);
  });

  it('states no price, because there is none published', () => {
    expect(app).not.toHaveProperty('offers');
  });
});

describe('titles as a results page shows them', () => {
  const shown = (title: string) => {
    const t = pageMeta({ title, description: 'x', path: '/x' }).title;
    return typeof t === 'string' ? `${t} · ${BRAND.name}` : (t as { absolute: string }).absolute;
  };

  it('keeps the brand on a title that fits with it', () => {
    expect(pageMeta({ title: 'Tools', description: 'x', path: '/x' }).title).toBe('Tools');
  });

  it('drops the brand rather than let it be cut off mid-name', () => {
    const long = 'Payment Voucher Software with Approvals';
    expect(pageMeta({ title: long, description: 'x', path: '/x' }).title).toEqual({ absolute: long });
  });

  it('fits every tool and guide title in what a result shows', () => {
    for (const a of AGENTS) expect(shown(a.search.title).length, a.slug).toBeLessThanOrEqual(TITLE_FITS);
    for (const g of ALL_GUIDES) expect(shown(g.search.title).length, g.slug).toBeLessThanOrEqual(TITLE_FITS);
  });
});

describe('the home page questions', () => {
  it('name every live tool and no other', () => {
    const answer = HOME_FAQ[0].a;
    for (const a of LIVE_AGENTS) expect(answer).toContain(a.name);
    for (const a of AGENTS.filter((x) => x.stage !== 'live')) expect(answer).not.toContain(a.name);
  });

  it('call free only the tools that are open to anybody', () => {
    const free = HOME_FAQ.find((f) => /free/i.test(f.q))!.a;
    for (const a of LIVE_AGENTS) {
      if (OPEN_TOOLS.includes(a.slug)) expect(free, a.slug).toContain(a.name);
      else expect(free, a.slug).not.toContain(a.name);
    }
  });
});

describe('collectionLd', () => {
  const ld = collectionLd({
    path: '/tools',
    name: 'Tools',
    description: 'All of them.',
    items: [
      { name: 'A', path: '/tools/a' },
      { name: 'B', path: '/tools/b' },
    ],
  });
  const page = byType(ld, 'CollectionPage');

  it('lists the items in order, numbered from one, with absolute links', () => {
    const list = page.mainEntity as { numberOfItems: number; itemListElement: { position: number; url: string }[] };
    expect(list.numberOfItems).toBe(2);
    expect(list.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(list.itemListElement[1].url).toBe(absolute('/tools/b'));
  });
});

describe('free, said of the open tools only', () => {
  it('marks a tool free only when anybody can open it', () => {
    for (const a of AGENTS.filter((x) => x.stage === 'live')) {
      const app = byType(serviceLd(a), 'WebApplication');
      if (OPEN_TOOLS.includes(a.slug)) expect(app.isAccessibleForFree, a.slug).toBe(true);
      else expect(app, a.slug).not.toHaveProperty('isAccessibleForFree');
    }
  });
});
