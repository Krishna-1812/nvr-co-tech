import { describe, expect, it } from 'vitest';
import { AGENTS } from '@/lib/marketing/content';
import { publishedGuides } from '@/lib/guides';
import { SITE_CORPUS } from './site';
import { VISITOR_INSTRUCTIONS, pageLabel, visitorContext } from './visitor';

/** What the public chat is told, and how the page it is asked from is named. */

describe('the instructions', () => {
  it('end with the whole website', () => {
    expect(VISITOR_INSTRUCTIONS.endsWith(SITE_CORPUS)).toBe(true);
  });

  it('hold it to the website, and to admitting what the site does not say', () => {
    expect(VISITOR_INSTRUCTIONS).toMatch(/must come from the WEBSITE section/);
    expect(VISITOR_INSTRUCTIONS).toMatch(/the site does not say/);
  });

  it('forbid a price, since the site publishes none', () => {
    expect(VISITOR_INSTRUCTIONS).toMatch(/publishes no prices/);
  });

  it('forbid arithmetic in its head', () => {
    expect(VISITOR_INSTRUCTIONS).toMatch(/Never do arithmetic in your head/);
  });

  it('hold their ground against a visitor rewriting them', () => {
    expect(VISITOR_INSTRUCTIONS).toMatch(/ignore these rules/);
  });

  it('ask for links to this site’s pages only', () => {
    expect(VISITOR_INSTRUCTIONS).toMatch(/Never link to another website/);
  });

  it('change nothing from one request to the next', () => {
    // Nothing dated or per-visitor may sit in the cached part.
    expect(VISITOR_INSTRUCTIONS).not.toMatch(/Today/);
  });
});

describe('naming the page', () => {
  it('names the home page', () => {
    expect(pageLabel('/')).toBe('the home page');
  });

  it('names a tool’s page from the roster', () => {
    const a = AGENTS[0];
    expect(pageLabel(`/tools/${a.slug}`)).toContain(a.name);
  });

  it('names a published guide by its title', () => {
    const g = publishedGuides()[0];
    if (g) expect(pageLabel(`/guides/${g.slug}`)).toContain(g.title);
  });

  it('names a tool from inside it', () => {
    const open = AGENTS.find((a) => a.slug === 'wealth-tracker');
    if (open?.href) expect(pageLabel(open.href)).toContain('Wealth Tracker');
  });

  it('ignores a query string and a trailing slash', () => {
    expect(pageLabel('/about/?ref=x#team')).toContain('About');
  });

  it('names nothing it does not recognise', () => {
    expect(pageLabel('/tools/not-a-tool')).toBeNull();
    expect(pageLabel('/somewhere-else')).toBeNull();
    expect(pageLabel('https://evil.example/')).toBeNull();
    expect(pageLabel(42)).toBeNull();
    expect(pageLabel(`/${'a'.repeat(200)}`)).toBeNull();
  });
});

describe('the part that changes', () => {
  it('says where they are and the date', () => {
    const text = visitorContext('/privacy');
    expect(text).toMatch(/privacy policy/);
    expect(text).toMatch(/Today, in India, is \d{4}-\d{2}-\d{2}/);
  });

  it('says so when the page is not known', () => {
    expect(visitorContext('/nope')).toMatch(/not known/);
  });
});
