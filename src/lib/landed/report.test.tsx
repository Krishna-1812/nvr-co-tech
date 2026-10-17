import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { TruePropertyCostDocument } from './report';
import { exampleSchedule, EXAMPLE_NAME } from './example';

/*
 * The report is checked the way a reader checks it: by what can be read off
 * the page. The figures themselves come from landedCost() and rentalYield(),
 * tested on their own; what is tested here is that every one of them, and
 * every word the screen shows beside them, actually made it onto the paper.
 *
 * The text is read with pdf.js, through the document's own character maps, so
 * a glyph the font could not draw (a ₹ that printed as a box, a Hindi label
 * that printed as "A?") fails the test instead of passing as bytes.
 */
const schedule = {
  name: 'Skyline Towers, B-1204',
  ocDate: '2027-03-31',
  rates: { self: 7, borrowed: 8.5 },
  compounding: 'simple' as const,
  areaSqft: 1000,
  instalments: [
    { id: 'a', label: 'Booking amount', date: '2024-04-01', amount: 1_000_000, source: 'self' as const },
    { id: 'b', label: '', date: '2025-01-15', amount: 2_000_000, source: 'borrowed' as const },
  ],
  rental: { monthlyRent: 25_000, maintenanceMonthly: 3000, vacancyPct: 8.33 },
};

/** Every string pdf.js reads off every page, joined with spaces. */
async function pageText(pdf: Buffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: false }).promise;
  const out: string[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    for (const item of content.items) if ('str' in item) out.push(item.str);
  }
  // Collapse the spacing pdf.js reports between runs, so a phrase is found
  // whether or not the layout broke it into pieces.
  return out.join(' ').replace(/\s+/g, ' ');
}

const render = (s: Parameters<typeof TruePropertyCostDocument>[0]['schedule']) =>
  renderToBuffer(<TruePropertyCostDocument schedule={s} preparedOn="10/10/2026" />);

describe('TruePropertyCostDocument', { timeout: 30_000 }, () => {
  it('renders a real PDF', async () => {
    const buf = await render(schedule);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(3000);
  });

  it('prints the answer, the split, the method, the yield and every payment', async () => {
    const text = await pageText(await render(schedule));
    for (const words of [
      'Skyline Towers, B-1204',
      'TRUE COST AT POSSESSION',
      // 30L + 2,09,808.22 + 3,74,931.51, with the rupee sign drawn
      '₹35,84,739.73',
      'Own funds ₹10,00,000.00',
      'Borrowed funds ₹20,00,000.00',
      'CASH COST',
      'Money tied up, over time',
      'Rental yield',
      'NET YIELD ON TRUE COST',
      'GROSS YIELD ON TRUE COST',
      'How it is worked out',
      'Amount × rate a year × days to possession ÷ 365',
      'Compounding, when chosen, applies the same days and rate yearly, quarterly or monthly.',
      'Cash cost',
      'NOT MODELLED',
      'Booking amount',
      'Payment 2',
      'All amounts in Indian rupees (₹)',
    ]) {
      expect(text).toContain(words);
    }
  });

  it('prints what was entered, including every rent input', async () => {
    const text = await pageText(await render(schedule));
    for (const words of [
      'What was entered',
      'Carpet area 1,000 sq ft',
      'Cost of own funds 7% a year',
      'Cost of borrowed funds 8.5% a year',
      'Payments entered 2, all counted',
      'Expected rent a month ₹25,000.00',
      'Maintenance a month ₹3,000.00',
      'Vacancy 8.33% of the year',
      'Market value today Not entered',
    ]) {
      expect(text).toContain(words);
    }
  });

  it("prints the screen's verdict on the rent, in the screen's words", async () => {
    const text = await pageText(await render({ ...exampleSchedule(), name: EXAMPLE_NAME }));
    expect(text).toContain(
      'The rent falls 3.96% a year short of what the money costs. It pays only if the property gains in value.',
    );
    expect(text).toContain('₹59,772.65 / month');
  });

  it('prints what a late possession would cost', async () => {
    const text = await pageText(await render({ ...exampleSchedule(), name: EXAMPLE_NAME }));
    expect(text).toContain('If possession slips');
    // Three years late on the worked example: the figures the public demo shows.
    expect(text).toContain('36 months 31/03/2031 +15,86,175.00');
    expect(text).toContain('92,92,106.98');
  });

  it('names every payment it could not count, and why, instead of dropping it', async () => {
    const text = await pageText(
      await render({
        ...schedule,
        instalments: [
          ...schedule.instalments,
          { id: 'c', label: 'Parking', date: '', amount: 300_000, source: 'self' as const },
          { id: 'd', label: 'Club membership', date: '2025-06-01', amount: 0, source: 'self' as const },
        ],
      }),
    );
    expect(text).toContain('2 PAYMENTS ARE NOT COUNTED IN ANY FIGURE');
    expect(text).toContain('Parking has no date.');
    expect(text).toContain('Club membership needs an amount above zero.');
    expect(text).toContain('Payments entered 4, 2 counted');
    expect(text).toContain('Not in this table: Parking, Club membership.');
  });

  it('prints the rupee sign and Indian scripts typed into a label', async () => {
    const text = await pageText(
      await render({
        ...schedule,
        instalments: [{ ...schedule.instalments[0], label: 'Booking – ₹5 lakh token (बुकिंग)' }, schedule.instalments[1]],
      }),
    );
    expect(text).toContain('Booking – ₹5 lakh token');
    // A Devanagari word is stored in visual order (the i-matra before its
    // consonant), so the letters are checked rather than the string.
    for (const ch of 'बुकिंग') expect(text).toContain(ch);
  });

  it('leaves the yield out when no rent is entered', async () => {
    const text = await pageText(await render({ ...schedule, rental: undefined }));
    expect(text).not.toContain('Rental yield');
    expect(text).toContain('TRUE COST AT POSSESSION');
  });
});
