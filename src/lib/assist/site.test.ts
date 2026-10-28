import { describe, expect, it } from 'vitest';
import { ALL_GUIDES, publishedGuides } from '@/lib/guides';
import { AGENTS, CONTACT, HOME_FAQ, WALKTHROUGH_STEPS } from '@/lib/marketing/content';
import { PRIVACY_CLAUSES, TERMS_CLAUSES } from '@/lib/marketing/legal';
import { DOCS } from './knowledge';
import { PUBLIC_DOCS, SITE_CORPUS, SITE_DOCS, SITE_INDEX } from './site';

/**
 * The website, as the chat is given it. What matters is that it is the
 * website's own words, all of them, and nothing the website does not publish.
 */

const top = (q: string) => SITE_INDEX.retrieve(q)[0]?.doc.id;

describe('what the chat knows', () => {
  it('carries every one of the assistant’s own documents', () => {
    for (const doc of DOCS) expect(SITE_DOCS).toContain(doc);
  });

  it('carries the home page’s questions word for word', () => {
    for (const f of HOME_FAQ) expect(SITE_CORPUS).toContain(f.a);
  });

  it('carries the privacy policy and the terms in their own words', () => {
    for (const c of [...PRIVACY_CLAUSES, ...TERMS_CLAUSES]) {
      for (const body of Array.isArray(c.body) ? c.body : [c.body]) expect(SITE_CORPUS).toContain(body);
    }
  });

  it('carries what happens after a walkthrough is booked, and the address', () => {
    for (const s of WALKTHROUGH_STEPS) expect(SITE_CORPUS).toContain(s.d);
    expect(SITE_CORPUS).toContain(CONTACT.email);
  });

  it('carries every published guide, with its answer', () => {
    for (const g of publishedGuides()) {
      expect(SITE_CORPUS).toContain(g.answer);
      expect(SITE_CORPUS).toContain(`/guides/${g.slug}`);
    }
  });

  it('carries no draft guide', () => {
    for (const g of ALL_GUIDES.filter((x) => x.status !== 'published')) {
      expect(SITE_CORPUS).not.toContain(`/guides/${g.slug}`);
    }
  });

  it('names a tool only if it is on the roster', () => {
    const slugs = new Set(AGENTS.map((a) => a.slug));
    for (const match of SITE_CORPUS.matchAll(/\/tools\/([a-z0-9-]+)/g)) {
      expect(slugs.has(match[1]), match[0]).toBe(true);
    }
  });

  it('links only to paths on this site', () => {
    for (const doc of PUBLIC_DOCS) if (doc.href) expect(doc.href).toMatch(/^\/(?!\/)/);
    expect(SITE_CORPUS).not.toMatch(/https?:\/\/(?!www\.)/);
  });

  it('has a document id only once', () => {
    const ids = SITE_DOCS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is small enough to send whole on every question', () => {
    // About four characters to a token; this keeps it well under 40,000 tokens.
    expect(SITE_CORPUS.length).toBeLessThan(160_000);
  });
});

describe('finding the page behind an answer', () => {
  it('finds the policy for a question about cookies', () => {
    expect(top('do you use cookies')).toBe('site-privacy-policy');
  });

  it('finds the contact page for somebody who wants a demo', () => {
    expect(top('can I book a demo walkthrough')).toBe('site-contact');
  });

  it('finds the account page for a question about signing up', () => {
    expect(top('how do I sign up with google')).toBe('site-account');
  });

  it('finds a guide by its subject', () => {
    const rental = publishedGuides().find((g) => g.slug === 'rental-yield-on-property');
    if (rental) expect(SITE_INDEX.retrieve('rental yield guide').map((h) => h.doc.id)).toContain('guide-rental-yield-on-property');
  });
});
