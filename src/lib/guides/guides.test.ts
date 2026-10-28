import { afterEach, describe, expect, it, vi } from 'vitest';
import { landedCost, rentalYield, type Schedule } from '@/lib/landed/calc';
import { agentBySlug, BRAND } from '@/lib/marketing/content';
import { ALL_GUIDES, blockText, publishedGuides, visibleGuides, type Guide } from '.';
import { BANK_RECONCILIATION } from './books';
import { NET_WORTH } from './people';
import { RENTAL_YIELD, TRUE_COST } from './property';
import { COMPARABLES } from './value';

/**
 * A guide is a claim made in public by a firm of chartered accountants, and the
 * worked examples are the part a reader will check. So every figure in them is
 * worked out again here, the property ones by the same engine the tool runs,
 * and a guide that drifts from its own arithmetic fails the build.
 */

const text = (g: Guide) => [g.lead, g.answer, ...g.blocks.flatMap(blockText), ...g.faq.flatMap((f) => [f.q, f.a])].join('\n');
const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const amount = (cell: string) => Number(cell.replace(/[₹,]/g, ''));

describe('the property example, run through the True Property Cost engine', () => {
  let n = 0;
  const pay = (label: string, date: string, amount: number, source: 'self' | 'borrowed') => ({ id: String(++n), label, date, amount, source });
  const schedule: Schedule = {
    ocDate: '2027-03-31',
    rates: { self: 7, borrowed: 8.5 },
    compounding: 'simple',
    areaSqft: 700,
    instalments: [
      pay('Booking', '2024-04-01', 600_000, 'self'),
      pay('Plinth', '2024-10-01', 1_800_000, 'borrowed'),
      pay('10th slab', '2025-07-01', 1_800_000, 'borrowed'),
      pay('Finishing', '2026-04-01', 1_200_000, 'borrowed'),
      pay('Possession', '2027-03-31', 600_000, 'self'),
    ],
    rental: { monthlyRent: 25_000, maintenanceMonthly: 3_000, annualCosts: 8_000, vacancyPct: 8.33 },
  };
  const r = landedCost(schedule);
  const y = rentalYield(schedule, r)!;

  it('quotes every payment’s carrying cost and days as the engine works them out', () => {
    const t = text(TRUE_COST);
    for (const row of r.rows) {
      expect(t).toContain(rupees(row.interest));
      expect(t).toContain(row.days.toLocaleString('en-IN'));
    }
  });

  it('quotes the totals as the engine works them out', () => {
    const t = text(TRUE_COST);
    expect(t).toContain(rupees(r.paid));
    expect(t).toContain(rupees(r.borrowed.interest));
    expect(t).toContain(rupees(r.self.interest));
    expect(t).toContain(rupees(r.landed));
    expect(t).toContain(rupees(r.cash));
    expect(t).toContain(`${r.upliftPct.toFixed(1)}%`);
    expect(t).toContain(rupees(r.perSqft!.paid));
    expect(t).toContain(rupees(r.perSqft!.landed));
  });

  it('quotes the rental yields as the engine works them out', () => {
    const t = text(RENTAL_YIELD);
    expect(t).toContain(rupees(r.landed));
    expect(t).toContain(rupees(y.grossAnnual));
    expect(t).toContain(rupees(y.netAnnual));
    expect(t).toContain(`${y.grossOnPaid.toFixed(2)}%`);
    expect(t).toContain(`${y.grossOnTrue.toFixed(2)}%`);
    expect(t).toContain(`${y.netOnTrue.toFixed(2)}%`);
    expect(t).toContain(`${y.blendedRate.toFixed(1)}%`);
    expect(t).toContain(rupees(y.breakEvenRent));
  });
});

describe('the bank reconciliation example', () => {
  const table = BANK_RECONCILIATION.blocks.find((b) => b.t === 'table')!;
  if (table.t !== 'table') throw new Error('no table');
  const rows = table.rows;
  const last = (row: string[]) => amount(row[row.length - 1]);

  it('ties: cash book plus additions less deductions is the bank balance', () => {
    const start = last(rows[0]);
    const adds = rows.filter((row) => row[0].startsWith('Add:')).reduce((s, row) => s + amount(row[1]), 0);
    const less = rows.filter((row) => row[0].startsWith('Less:')).reduce((s, row) => s + amount(row[1]), 0);
    expect(adds).toBe(amount(rows.find((row) => row[0].startsWith('Add:') && row[2])![2]));
    expect(less).toBe(amount(rows.find((row) => row[0].startsWith('Less:') && row[2])![2].replace(/[()]/g, '')));
    expect(start + adds - less).toBe(last(rows[rows.length - 1]));
  });

  it('gives the corrected cash book balance the example’s own figures add up to', () => {
    // 1,25,000 + interest 1,240 + NEFT 9,000 − charges 590
    expect(text(BANK_RECONCILIATION)).toContain(rupees(125_000 + 1_240 + 9_000 - 590));
  });
});

describe('the net worth example', () => {
  const [assets, liabilities] = NET_WORTH.blocks.filter((b) => b.t === 'table') as Extract<Guide['blocks'][number], { t: 'table' }>[];
  const sum = (rows: string[][]) => rows.slice(0, -1).reduce((s, row) => s + amount(row[1]), 0);

  it('adds up', () => {
    expect(sum(assets.rows)).toBe(amount(assets.rows.at(-1)![1]));
    expect(sum(liabilities.rows)).toBe(amount(liabilities.rows.at(-1)![1]));
    const net = sum(assets.rows) - sum(liabilities.rows);
    expect(text(NET_WORTH)).toContain(rupees(net));
  });

  it('counts as liquid only the savings, deposits and mutual funds', () => {
    expect(text(NET_WORTH)).toContain(rupees(350_000 + 500_000 + 1_240_000));
  });
});

describe('the comparables example', () => {
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

  it('takes the medians and applies them the right way round', () => {
    const t = text(COMPARABLES);
    const ev = median([9.5, 11.0, 12.5, 14.0, 18.0]);
    const pe = median([18, 20, 22, 25, 30]);
    expect(t).toContain(`${ev}x`);
    expect(t).toContain(`${pe}x`);
    expect(t).toContain(`Enterprise value ₹${ev * 8} crore`);
    expect(t).toContain(`₹${ev * 8 - 15} crore`); // less net debt
    expect(t).toContain(`Equity value ₹${pe * 4.5} crore`); // P/E needs no debt taken off
  });
});

describe('every guide', () => {
  const SUFFIX = ` · ${BRAND.name}`.length;

  it('has a unique slug, and leads to a live tool', () => {
    expect(new Set(ALL_GUIDES.map((g) => g.slug)).size).toBe(ALL_GUIDES.length);
    for (const g of ALL_GUIDES) expect(agentBySlug(g.tool)?.stage, g.slug).toBe('live');
  });

  it('fits a search result', () => {
    for (const g of ALL_GUIDES) {
      expect(g.search.title.length + SUFFIX, g.slug).toBeLessThanOrEqual(76);
      expect(g.search.description.length, g.slug).toBeLessThanOrEqual(160);
    }
  });

  it('answers in a paragraph short enough to be quoted', () => {
    for (const g of ALL_GUIDES) expect(g.answer.split(/\s+/).length, g.slug).toBeLessThanOrEqual(80);
  });

  it('has questions, and sections to list in its contents', () => {
    for (const g of ALL_GUIDES) {
      expect(g.faq.length, g.slug).toBeGreaterThanOrEqual(3);
      expect(g.blocks.filter((b) => b.t === 'h2').length, g.slug).toBeGreaterThanOrEqual(3);
    }
  });

  it('uses no em-dash, like the rest of the copy read by customers', () => {
    for (const g of ALL_GUIDES) expect(text(g), g.slug).not.toContain('—');
  });
});

describe('drafts', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('are never shown on the production deployment', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(visibleGuides().every((g) => g.status === 'published')).toBe(true);
  });

  it('are shown on a preview deployment, for the owner to read', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(visibleGuides().length).toBe(ALL_GUIDES.length);
  });

  it('are never what search engines or assistants are told about', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(publishedGuides().every((g) => g.status === 'published')).toBe(true);
  });
});

describe('the sitemap', () => {
  it('lists every published guide once, and nothing twice', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const urls = sitemap().map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const g of publishedGuides()) expect(urls.filter((u) => u.endsWith(`/guides/${g.slug}`))).toHaveLength(1);
  });
});
