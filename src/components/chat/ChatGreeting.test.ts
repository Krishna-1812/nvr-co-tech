import { describe, expect, it } from 'vitest';
import { AGENTS, toolBriefs } from '@/lib/marketing/content';
import { greetingFor, partOf } from './ChatGreeting';

const tools = toolBriefs();
const open = AGENTS.filter((a) => a.stage === 'live').map((a) => a.slug);
const labels = (path: string) => greetingFor(path, open, tools).picks.map((p) => p.label);

describe('the hello', () => {
  it('greets by the hour on the reader’s clock', () => {
    expect([4, 5, 11, 12, 16, 17, 20, 21, 0].map(partOf)).toEqual([
      'night',
      'morning',
      'morning',
      'afternoon',
      'afternoon',
      'evening',
      'evening',
      'night',
      'night',
    ]);
  });

  it('offers four ways in on every page, none of them the page itself', () => {
    const paths = ['/', '/tools', '/guides', '/calculators', '/contact', '/about', ...tools.map((t) => `/tools/${t.slug}`)];
    for (const path of paths) {
      const { picks } = greetingFor(path, open, tools);
      expect(picks, path).toHaveLength(4);
      expect(new Set(picks.map((p) => p.label)).size, path).toBe(4);
      expect(picks.some((p) => 'href' in p && p.href === path), path).toBe(false);
    }
  });

  it('names no single tool on the home page', () => {
    const { line, picks } = greetingFor('/', open, tools);
    const words = [line, ...picks.map((p) => p.label), ...picks.map((p) => ('ask' in p ? p.ask : ''))].join(' ');
    for (const t of tools) expect(words).not.toContain(t.name);
  });

  it('follows the page: a tool, a guide, a calculator', () => {
    const tool = tools[0];
    expect(greetingFor(`/tools/${tool.slug}`, open, tools).line).toContain(tool.name);
    expect(greetingFor(`/tools/${tool.slug}`, open, tools).picks[0]).toMatchObject({ ask: expect.stringContaining(tool.name) });
    expect(labels('/guides/anything')).toContain('Sum this guide up');
    expect(labels('/calculators/rental-yield')).toContain('Explain this calculator');
  });
});
