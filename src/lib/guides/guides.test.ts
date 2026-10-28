import { afterEach, describe, expect, it, vi } from 'vitest';
import { landedCost, rentalYield, type Schedule } from '@/lib/landed/calc';
import { agentBySlug, BRAND } from '@/lib/marketing/content';
import { ALL_GUIDES, blockText, publishedGuides, visibleGuides, type Guide } from '.';
import { BANK_RECONCILIATION, SUPPLIER_RECONCILIATION, VOUCHER_TYPES } from './books';
import { NET_WORTH } from './people';
import { CARPET_AREA, GST_ON_FLATS, PRE_EMI, RENTAL_YIELD, TRUE_COST } from './property';
import { COMPARABLES, EV_EBITDA } from './value';

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

describe('the supplier reconciliation example', () => {
  const table = SUPPLIER_RECONCILIATION.blocks.find((b) => b.t === 'table')!;
  if (table.t !== 'table') throw new Error('no table');
  const rows = table.rows;
  const last = (row: string[]) => amount(row[row.length - 1]);

  it('ties: our balance plus additions less deductions is the supplier’s', () => {
    const adds = rows.filter((r) => r[0].startsWith('Add:')).reduce((s, r) => s + amount(r[1]), 0);
    const less = rows.filter((r) => r[0].startsWith('Less:')).reduce((s, r) => s + amount(r[1]), 0);
    expect(adds).toBe(amount(rows.find((r) => r[0].startsWith('Add:') && r[2])![2]));
    expect(last(rows[0]) + adds - less).toBe(last(rows[rows.length - 1]));
  });

  it('agrees on one balance once each side records what it missed', () => {
    const ours = 198_400 + 38_000 - 4_800;
    const theirs = 262_600 - 25_000 - 6_000;
    expect(ours).toBe(theirs);
    expect(text(SUPPLIER_RECONCILIATION)).toContain(rupees(ours));
  });
});

describe('the EV/EBITDA example', () => {
  const ev = 1_200 + 300 - 60;
  const ebitda = 110 + 40;

  it('works out enterprise value, EBITDA and the multiple', () => {
    const t = text(EV_EBITDA);
    expect(t).toContain(`₹${ev.toLocaleString('en-IN')} crore`);
    expect(t).toContain(`₹${ebitda} crore`);
    expect(t).toContain(`${(ev / ebitda).toFixed(1)}x`);
  });

  it('applies a peer multiple and takes off net debt', () => {
    const t = text(EV_EBITDA);
    const peerEv = 11 * ebitda;
    expect(t).toContain(`₹${peerEv.toLocaleString('en-IN')} crore`);
    expect(t).toContain(`₹${(peerEv - (300 - 60)).toLocaleString('en-IN')} crore`);
  });
});

describe('the pre-EMI example', () => {
  const P = 1_800_000;
  const r = 0.085 / 12;
  const n = 240;
  const emi = (P * r * (1 + r) ** n) / ((1 + r) ** n - 1);

  it('quotes the pre-EMI and what it adds up to', () => {
    const t = text(PRE_EMI);
    expect(t).toContain(rupees(P * r));
    expect(t).toContain(rupees(P * r * 24));
  });

  it('quotes the full EMI and how much of it repays the loan', () => {
    const t = text(PRE_EMI);
    expect(t).toContain(rupees(emi));
    expect(t).toContain(rupees(emi - P * r));
    let balance = P;
    for (let m = 0; m < 24; m++) balance -= emi - balance * r;
    expect(t).toContain(rupees(P - balance));
  });
});

describe('the carpet area example', () => {
  const flats = [
    { super: 1_000, rate: 8_000, carpet: 700 },
    { super: 950, rate: 8_400, carpet: 720 },
  ];

  it('prices each flat and works out the loading and the rate per square foot of carpet', () => {
    const t = text(CARPET_AREA);
    for (const f of flats) {
      const price = f.super * f.rate;
      expect(t).toContain(rupees(price));
      expect(t).toContain(rupees(price / f.carpet));
      expect(t).toContain(`${((f.super / f.carpet - 1) * 100).toFixed(1)}%`);
    }
  });

  it('says how much more space and how much less money the second flat is', () => {
    const t = text(CARPET_AREA);
    expect(t).toContain(`${flats[1].carpet - flats[0].carpet} more square feet`);
    expect(t).toContain(`${rupees(flats[0].super * flats[0].rate - flats[1].super * flats[1].rate)} less`);
  });

  it('converts square metres at the right factor', () => {
    expect(text(CARPET_AREA)).toContain(`${(65 * 10.7639).toFixed(2)} square feet`);
  });
});

describe('the GST example', () => {
  // The definition's two tests: carpet area against the limit for where the
  // flat is, and the price against ₹45 lakh.
  const affordable = (carpetSqm: number, metro: boolean, price: number) => carpetSqm <= (metro ? 60 : 90) && price <= 4_500_000;
  const flats = [
    { where: 'Pune', metro: false, carpet: 75, price: 6_000_000 },
    { where: 'Pune', metro: false, carpet: 85, price: 4_000_000 },
    { where: 'Thane', metro: true, carpet: 62, price: 4_000_000 },
  ];
  const table = GST_ON_FLATS.blocks.find((b) => b.t === 'table' && b.head.includes('GST')) as Extract<Guide['blocks'][number], { t: 'table' }>;

  it('applies the right rate to each flat and quotes what it comes to', () => {
    flats.forEach((f, i) => {
      const rate = affordable(f.carpet, f.metro, f.price) ? 0.01 : 0.05;
      const row = table.rows[i];
      expect(row[0]).toBe(f.where);
      expect(row[3]).toBe(`${rate * 100}%`);
      expect(amount(row[4])).toBe(Math.round(f.price * rate));
    });
  });

  it('quotes the extra GST the two square metres cost', () => {
    expect(text(GST_ON_FLATS)).toContain(rupees(4_000_000 * 0.05 - 4_000_000 * 0.01));
  });
});

describe('the week of vouchers', () => {
  it('ends the bank and petty cash where the guide says', () => {
    const t = text(VOUCHER_TYPES);
    expect(t).toContain(rupees(100_000 - 25_000 + 59_000 - 10_000));
    expect(t).toContain(rupees(2_000 + 10_000 - 1_200));
  });

  it('puts the GST on the credit sale at 18%', () => {
    const sale = VOUCHER_TYPES.blocks.find((b) => b.t === 'table') as Extract<Guide['blocks'][number], { t: 'table' }>;
    expect(amount(sale.rows.at(-1)!.at(-1)!)).toBe(100_000 * 1.18);
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

  it('cites its sources as full https addresses, each with who publishes it, once', () => {
    for (const g of ALL_GUIDES) {
      const urls = (g.sources ?? []).map((s) => s.url);
      expect(new Set(urls).size, g.slug).toBe(urls.length);
      for (const s of g.sources ?? []) {
        expect(s.url, g.slug).toMatch(/^https:\/\/[^\s]+$/);
        expect(s.name.length, g.slug).toBeGreaterThan(5);
        expect(s.publisher.length, g.slug).toBeGreaterThan(3);
      }
    }
  });

  it('names the current Income-tax Act wherever it names a 1961 section', () => {
    // From tax year 2026-27 the 1961 Act's sections are history; a guide that
    // still cites one has to say which Act now holds the rule.
    for (const g of ALL_GUIDES) {
      const text = JSON.stringify(g);
      if (/section 24\(b\)/.test(text)) expect(text, g.slug).toMatch(/Income-tax Act, 2025/);
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

describe('each guide’s headline figure', () => {
  it('is quoted from the guide itself', () => {
    for (const g of ALL_GUIDES) expect(text(g), g.slug).toContain(g.figure.value);
  });
});

describe('the glossary', () => {
  it('defines each term once, under an anchor of its own', async () => {
    const { TERMS } = await import('./glossary');
    expect(new Set(TERMS.map((t) => t.id)).size).toBe(TERMS.length);
    expect(new Set(TERMS.map((t) => t.term.toLowerCase())).size).toBe(TERMS.length);
    for (const t of TERMS) expect(t.id, t.term).toMatch(/^[a-z0-9-]+$/);
  });

  it('links each term to a guide that exists', async () => {
    const { TERMS } = await import('./glossary');
    const slugs = new Set(ALL_GUIDES.map((g) => g.slug));
    for (const t of TERMS) if (t.guide) expect(slugs.has(t.guide), t.id).toBe(true);
  });

  it('keeps every definition short enough to quote, in the house style', async () => {
    const { TERMS } = await import('./glossary');
    for (const t of TERMS) {
      expect(t.definition.split(/\s+/).length, t.id).toBeLessThanOrEqual(60);
      expect(t.definition, t.id).not.toMatch(/—/);
    }
  });

  it('points only at published guides', async () => {
    const { glossary } = await import('./glossary');
    const published = new Set(publishedGuides().map((g) => `/guides/${g.slug}`));
    for (const t of glossary()) if (t.href) expect(published.has(t.href), t.id).toBe(true);
  });
});
