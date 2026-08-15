import { describe, expect, it } from 'vitest';
import { readJsonLd, readMetaTags, readPeople } from './schema';
import { fingerprint } from './tech';
import { employeeBand } from './paid';

/**
 * Free enrichment, which is to say: reading what a company already published.
 *
 * The two tests worth having here are the ones about restraint. Malformed
 * JSON-LD is extremely common and must not take the whole enrichment with it;
 * and a team page must not turn a marketing headline into a person, which is a
 * worse outcome than finding nobody at all.
 */

describe('structured data', () => {
  it('finds an Organization inside an @graph', () => {
    const html = `
      <script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[
        {"@type":"WebSite","name":"Acme site"},
        {"@type":"Organization","legalName":"Acme Manufacturing Limited",
         "description":"We make things.","foundingDate":"1998-04-01",
         "address":{"addressLocality":"Pune","addressCountry":"India"},
         "sameAs":["https://twitter.com/acme","https://www.linkedin.com/company/acme"]}
      ]}
      </script>`;

    expect(readJsonLd(html)).toEqual({
      name: 'Acme Manufacturing Limited',
      description: 'We make things.',
      city: 'Pune',
      country: 'India',
      linkedin: 'https://www.linkedin.com/company/acme',
      foundedYear: '1998',
    });
  });

  it('steps over a malformed block and reads the next one', () => {
    const html = `
      <script type="application/ld+json">{ not json at all }</script>
      <script type="application/ld+json">{"@type":"Organization","name":"Second Try Ltd"}</script>`;

    expect(readJsonLd(html).name).toBe('Second Try Ltd');
  });

  it('handles an address given as a list', () => {
    const html = `<script type="application/ld+json">
      {"@type":"Organization","name":"A","address":[{"addressLocality":"Mumbai"}]}</script>`;

    expect(readJsonLd(html).city).toBe('Mumbai');
  });

  it('falls back to OpenGraph and the title, decoding entities', () => {
    const html = `<head><meta property="og:site_name" content="Acme &amp; Co"><title>Ignored</title></head>`;
    expect(readMetaTags(html).name).toBe('Acme & Co');
    expect(readMetaTags('<title>Just a title</title>').name).toBe('Just a title');
  });
});

describe('people on a team page', () => {
  it('accepts a heading and paragraph that name a real role', () => {
    const html = '<h3>Asha Menon</h3><p>Chief Financial Officer</p>';
    expect(readPeople(html)).toEqual([{ name: 'Asha Menon', title: 'Chief Financial Officer' }]);
  });

  it('refuses a marketing headline dressed as a person', () => {
    // Without the job-title filter this returns "500M+ requests served" as
    // somebody's name, which is worse than finding nobody.
    const html = '<h3>500M+ requests served</h3><p>And counting, every month.</p>';
    expect(readPeople(html)).toEqual([]);
  });

  it('does not treat a sentence as a name even when the role below it is real', () => {
    const html = '<h3>Meet the people who run our finance function today.</h3><p>Head of Finance</p>';
    expect(readPeople(html)).toEqual([]);
  });
});

describe('technology fingerprinting', () => {
  it('reads the markup and the headers together', () => {
    const html = '<script src="https://js.hs-scripts.com/1.js"></script><div>wp-content/themes</div>';
    const headers = new Headers({ 'cf-ray': '8abc-BOM' });

    const found = fingerprint(html, headers);
    expect(found).toContain('HubSpot');
    expect(found).toContain('WordPress');
    expect(found).toContain('Cloudflare');
  });

  it('finds nothing in a plain page rather than guessing', () => {
    expect(fingerprint('<html><body>Hello</body></html>')).toEqual([]);
  });
});

describe('headcount', () => {
  it('reports a band rather than a number nobody should trust to the unit', () => {
    expect(employeeBand(7)).toBe('1-10');
    expect(employeeBand(180)).toBe('51-200');
    expect(employeeBand(40_000)).toBe('10K+');
    expect(employeeBand(null)).toBeNull();
    expect(employeeBand(0)).toBeNull();
  });
});
