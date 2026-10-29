import { describe, expect, it } from 'vitest';
import { AGENTS, toolBriefs } from '@/lib/marketing/content';
import { visitorSuggestions } from './visitor-suggestions';

const OPEN = ['true-property-cost', 'wealth-tracker'];
const TOOLS = toolBriefs(AGENTS);

describe('what the public chat offers to ask', () => {
  it('offers the general questions on the home page', () => {
    const s = visitorSuggestions('/', OPEN, TOOLS);
    expect(s.length).toBeGreaterThanOrEqual(3);
    expect(s.length).toBeLessThanOrEqual(4);
  });

  it('asks about the tool on its own page', () => {
    for (const a of AGENTS) {
      const s = visitorSuggestions(`/tools/${a.slug}`, OPEN, TOOLS);
      expect(s[0].question).toContain(a.name);
    }
  });

  it('asks whether an open tool needs an account, and how to get a locked one', () => {
    expect(visitorSuggestions('/tools/wealth-tracker', OPEN, TOOLS)[1].label).toBe('Do I need an account?');
    const locked = AGENTS.find((a) => !OPEN.includes(a.slug));
    if (locked) expect(visitorSuggestions(`/tools/${locked.slug}`, OPEN, TOOLS)[1].label).toBe('How do I get access?');
  });

  it('knows a tool from inside it', () => {
    const wt = AGENTS.find((a) => a.slug === 'wealth-tracker');
    if (wt?.href) expect(visitorSuggestions(wt.href, OPEN, TOOLS)[0].question).toContain('Wealth Tracker');
  });

  it('offers to sum up a guide', () => {
    expect(visitorSuggestions('/guides/anything', OPEN, TOOLS)[0].label).toBe('Sum this guide up');
  });

  it('asks about data on the policies', () => {
    expect(visitorSuggestions('/privacy', OPEN, TOOLS)[1].label).toMatch(/cookies/);
  });

  it('keeps every label short enough for a chip', () => {
    for (const path of ['/', '/privacy', '/guides/x', ...AGENTS.map((a) => `/tools/${a.slug}`)]) {
      for (const s of visitorSuggestions(path, OPEN, TOOLS)) expect(s.label.length).toBeLessThan(40);
    }
  });
});
