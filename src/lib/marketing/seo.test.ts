import { describe, expect, it } from 'vitest';
import { AGENTS, BRAND, SITE_URL, STAGE_LABEL } from './content';
import { absolute, breadcrumbLd, ldJson, serviceLd, siteLd } from './seo';

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
    expect(absolute('/agents')).toBe(`${SITE_URL}/agents`);
  });

  it('leaves the origin itself with its root path', () => {
    expect(absolute('/')).toBe(`${SITE_URL}/`);
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
    // The site says "built by chartered accountants, in Mumbai" and nothing
    // more specific. A streetAddress, a postalCode or a telephone here would be
    // invented, and this is the assertion that keeps somebody from adding one
    // because a validator asked for it.
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
    expect(service.url).toBe(absolute(`/agents/${live.slug}`));
    expect(service.provider).toEqual({ '@id': `${SITE_URL}/#organization` });
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
    { label: 'Agents', href: '/agents' },
    { label: 'Voucher Desk', href: '/agents/voucher-desk' },
  ];

  it('numbers the trail from one, in order', () => {
    const list = byType(breadcrumbLd(trail), 'BreadcrumbList') as {
      itemListElement: { position: number; name: string; item: string }[];
    };
    expect(list.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(list.itemListElement.map((i) => i.name)).toEqual([
      'Home',
      'Agents',
      'Voucher Desk',
    ]);
  });

  it('makes every item absolute', () => {
    const list = byType(breadcrumbLd(trail), 'BreadcrumbList') as {
      itemListElement: { item: string }[];
    };
    expect(list.itemListElement.map((i) => i.item)).toEqual([
      `${SITE_URL}/`,
      `${SITE_URL}/agents`,
      `${SITE_URL}/agents/voucher-desk`,
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
