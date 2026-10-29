import { describe, expect, it } from 'vitest';
import { AGENTS, BRAND } from './content';
import { publishedGuides } from '@/lib/guides';
import { CALCULATORS } from '@/lib/calculators';
import { markdownFor, markdownPages } from './markdown';

describe('the Markdown copies of the public pages', () => {
  it('exist for the home page, every tool, every published guide, every calculator and the glossary', () => {
    const pages = markdownPages();
    expect(pages).toContain('/');
    for (const a of AGENTS) expect(pages).toContain(`/tools/${a.slug}`);
    for (const g of publishedGuides()) expect(pages).toContain(`/guides/${g.slug}`);
    for (const c of CALCULATORS) expect(pages).toContain(`/calculators/${c.slug}`);
    expect(pages).toEqual(expect.arrayContaining(['/tools', '/guides', '/calculators', '/glossary']));
  });

  it('start with the page’s heading and end by naming the page they copy', () => {
    for (const p of markdownPages()) {
      const md = markdownFor(p)!;
      expect(md, p).toMatch(/^# \S/);
      expect(md, p).toContain(`Source: https://www.thefinanceintelligence.com${p === '/' ? '/' : p}`);
      expect(md, p).toContain(BRAND.definition);
    }
  });

  it('carry the guide’s short answer, its tables and its questions', () => {
    const g = publishedGuides()[0];
    const md = markdownFor(`/guides/${g.slug}`)!;
    expect(md).toContain(g.answer);
    for (const f of g.faq) expect(md).toContain(`### ${f.q}`);
    const table = g.blocks.find((b) => b.t === 'table');
    if (table && table.t === 'table') expect(md).toContain(`| ${table.head.map((h) => h || ' ').join(' | ')} |`);
  });

  it('carry a calculator’s worked example, worked out', () => {
    const md = markdownFor('/calculators/pre-emi')!;
    expect(md).toContain('₹12,750');
    expect(md).toContain('₹15,621');
  });

  it('answer nothing for a page that has no copy, or a draft', () => {
    for (const p of ['/privacy', '/about', '/hub', '/tools/nope', '/guides/nope', '/calculators/nope']) expect(markdownFor(p), p).toBeNull();
  });
});
