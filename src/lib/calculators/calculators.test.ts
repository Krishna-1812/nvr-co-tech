import { describe, expect, it } from 'vitest';
import { AGENTS } from '@/lib/marketing/content';
import { TITLE_FITS } from '@/lib/marketing/seo';
import { publishedGuides } from '@/lib/guides';
import { TERMS } from '@/lib/guides/glossary';
import { CALCULATORS, calculatorForGuide, workedExample, type Calculator } from '.';
import { FIELDS, defaults, run } from './fields';
import { carpetArea, evEbitda, gstOnFlat, inr, pct, preEmi, rentalYield, SQFT_PER_SQM } from './math';

const text = (c: Calculator) =>
  [
    c.name,
    c.search.title,
    c.search.description,
    c.lead,
    c.answer,
    ...c.formulas,
    ...c.blocks.flatMap((b) => ('text' in b ? [b.text] : 'items' in b ? b.items : [])),
    ...c.faq.flatMap((f) => [f.q, f.a]),
    ...FIELDS[c.kind].flatMap((f) => [f.label, f.hint ?? '']),
  ].join('\n');

describe('the calculators, as content', () => {
  it('have unique slugs, one per kind', () => {
    expect(new Set(CALCULATORS.map((c) => c.slug)).size).toBe(CALCULATORS.length);
    expect(new Set(CALCULATORS.map((c) => c.kind)).size).toBe(CALCULATORS.length);
  });

  it('each lead to a published guide, a live tool and real glossary terms', () => {
    const guides = new Set(publishedGuides().map((g) => g.slug));
    const live = new Set(AGENTS.filter((a) => a.stage === 'live').map((a) => a.slug));
    const terms = new Set(TERMS.map((t) => t.id));
    for (const c of CALCULATORS) {
      expect(guides.has(c.guide), c.slug).toBe(true);
      expect(live.has(c.tool), c.slug).toBe(true);
      for (const t of c.terms) expect(terms.has(t), `${c.slug}: ${t}`).toBe(true);
      expect(calculatorForGuide(c.guide)?.slug).toBe(c.slug);
    }
  });

  it('fit a results page: the title with the brand, the description in 160 characters', () => {
    for (const c of CALCULATORS) {
      expect(`${c.search.title} · The Finance Intelligence`.length, c.slug).toBeLessThanOrEqual(TITLE_FITS + 14);
      expect(c.search.title.length, c.slug).toBeLessThanOrEqual(49);
      expect(c.search.description.length, c.slug).toBeLessThanOrEqual(160);
      expect(c.answer.split(/\s+/).length, c.slug).toBeLessThanOrEqual(60);
    }
  });

  it('uses no em-dash, like the rest of the copy read by customers', () => {
    for (const c of CALCULATORS) expect(text(c), c.slug).not.toContain('—');
  });

  it('opens every calculator on a worked example with a figure to show', () => {
    for (const c of CALCULATORS) {
      const r = workedExample(c);
      expect(r.lines.length, c.slug).toBeGreaterThan(2);
      expect(r.lines.some((l) => l.strong), c.slug).toBe(true);
      for (const l of r.lines) expect(l.value, `${c.slug}: ${l.label}`).not.toBe('—');
    }
  });
});

describe('the arithmetic, against each guide’s worked example', () => {
  it('rental yield (rental-yield-on-property)', () => {
    const base = { monthlyRent: 25_000, maintenanceMonthly: 3_000, otherCostsYearly: 8_000, emptyMonths: 1, moneyRatePct: 8.2 };
    expect(pct(rentalYield({ ...base, cost: 60_00_000 }).grossYield)).toBe('5.00%');
    const onTrue = rentalYield({ ...base, cost: 68_76_912 });
    expect(pct(onTrue.grossYield)).toBe('4.36%');
    expect(pct(onTrue.netYield)).toBe('3.36%');
    // The guide's engine takes one month empty as 8.33%; a whole month moves
    // the break-even rent by a couple of rupees, not more.
    expect(Math.abs(onTrue.breakEvenRent - 55_262)).toBeLessThan(5);
  });

  it('carpet area and loading (carpet-area-vs-built-up-vs-super-built-up)', () => {
    const a = carpetArea({ superArea: 1_000, carpetArea: 700, rate: 8_000 });
    expect(inr(a.price)).toBe('₹80,00,000');
    expect(pct(a.loadingOnCarpet, 1)).toBe('42.9%');
    expect(inr(a.perCarpetSqft)).toBe('₹11,429');
    const b = carpetArea({ superArea: 950, carpetArea: 720, rate: 8_400 });
    expect(inr(b.price)).toBe('₹79,80,000');
    expect(pct(b.loadingOnCarpet, 1)).toBe('31.9%');
    expect(inr(b.perCarpetSqft)).toBe('₹11,083');
    expect((65 * SQFT_PER_SQM).toFixed(2)).toBe('699.65');
  });

  it('GST on a flat (gst-on-under-construction-flat)', () => {
    const pune = gstOnFlat({ price: 60_00_000, carpetSqm: 75, metro: false, completed: false });
    expect([pune.ratePct, inr(pune.gst)]).toEqual([5, '₹3,00,000']);
    const small = gstOnFlat({ price: 40_00_000, carpetSqm: 85, metro: false, completed: false });
    expect([small.ratePct, inr(small.gst)]).toEqual([1, '₹40,000']);
    const thane = gstOnFlat({ price: 40_00_000, carpetSqm: 62, metro: true, completed: false });
    expect([thane.ratePct, inr(thane.gst)]).toEqual([5, '₹2,00,000']);
    expect(gstOnFlat({ price: 40_00_000, carpetSqm: 62, metro: true, completed: true }).gst).toBe(0);
    // The limits are inclusive: exactly ₹45 lakh and exactly 60 sq m are affordable.
    expect(gstOnFlat({ price: 45_00_000, carpetSqm: 60, metro: true, completed: false }).ratePct).toBe(1);
  });

  it('pre-EMI and full EMI (pre-emi-vs-full-emi-under-construction)', () => {
    const r = preEmi({ disbursed: 18_00_000, ratePct: 8.5, months: 24, tenureYears: 20 });
    expect(inr(r.preEmi)).toBe('₹12,750');
    expect(inr(r.preEmiTotal)).toBe('₹3,06,000');
    expect(inr(r.fullEmi)).toBe('₹15,621');
    expect(inr(r.firstRepaid)).toBe('₹2,871');
    expect(Math.abs(r.repaidByPossession - 74_815)).toBeLessThan(10);
  });

  it('EV/EBITDA (ev-ebitda-multiple-explained)', () => {
    const r = evEbitda({ marketCap: 1_200, debt: 300, cash: 60, ebit: 110, depreciation: 40, peerMultiple: 11 });
    expect([r.ev, r.ebitda, r.multiple.toFixed(1)]).toEqual([1_440, 150, '9.6']);
    expect([r.impliedEv, r.impliedEquity]).toEqual([1_650, 1_410]);
  });
});

describe('the calculators, as a reader uses them', () => {
  it('formats rupees in Indian digit grouping', () => {
    expect(inr(300000)).toBe('₹3,00,000');
    expect(inr(-12590)).toBe('−₹12,590');
  });

  it('asks for what is missing rather than showing nonsense', () => {
    for (const c of CALCULATORS) {
      const blank = Object.fromEntries(FIELDS[c.kind].map((f) => [f.id, f.kind === 'number' ? NaN : false]));
      const r = run(c.kind, blank);
      expect(r.lines, c.slug).toEqual([]);
      expect(r.note, c.slug).toBeTruthy();
    }
  });

  it('refuses a carpet area larger than the super built-up area', () => {
    const r = run('carpet-area', { ...defaults('carpet-area'), carpetArea: 1_200 });
    expect(r.lines).toEqual([]);
    expect(r.note).toMatch(/cannot be larger/);
  });

  it('leaves out the break-even rent and the valuation when their rate is 0', () => {
    const y = run('rental-yield', { ...defaults('rental-yield'), moneyRatePct: 0 });
    expect(y.lines.some((l) => /cover the money/.test(l.label))).toBe(false);
    const v = run('ev-ebitda', { ...defaults('ev-ebitda'), peerMultiple: 0 });
    expect(v.lines.some((l) => /Value of the shares/.test(l.label))).toBe(false);
  });
});
