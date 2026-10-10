import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { TruePropertyCostDocument } from './report';

/*
 * The report is checked the way the voucher PDF is: that it renders, and that
 * what a reader sees on the page is the right words and figures. The figures
 * themselves come from landedCost() and rentalYield(), tested on their own.
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

/** The text drawn on the pages, decoded from react-pdf's hex glyph strings. */
function visibleText(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  let content = '';
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      content += zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
    } catch {
      // Not a compressed text stream.
    }
  }
  let text = '';
  for (const block of content.matchAll(/BT([\s\S]*?)ET/g)) {
    for (const str of block[1].matchAll(/<([0-9A-Fa-f]+)>|\(((?:[^()\\]|\\.)*)\)/g)) {
      if (str[1]) for (let i = 0; i < str[1].length; i += 2) text += String.fromCharCode(parseInt(str[1].slice(i, i + 2), 16));
      else if (str[2] !== undefined) text += str[2];
    }
    text += ' ';
  }
  return text;
}

describe('TruePropertyCostDocument', { timeout: 20_000 }, () => {
  it('renders a real PDF', async () => {
    const buf = await renderToBuffer(<TruePropertyCostDocument schedule={schedule} preparedOn="10/10/2026" />);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(3000);
  });

  it('prints the answer, the method, the yield and every payment', async () => {
    const text = visibleText(await renderToBuffer(<TruePropertyCostDocument schedule={schedule} preparedOn="10/10/2026" />));
    for (const words of [
      'Skyline Towers, B-1204',
      'TRUE COST AT POSSESSION',
      // 30L + 2,09,808.22 + 3,74,931.51
      '35,84,739.73',
      'CASH COST',
      'Rental yield',
      'NET YIELD ON TRUE COST',
      'How it is worked out',
      'Not modelled',
      'Booking amount',
      'Payment 2',
      'All amounts in Indian rupees',
    ]) {
      expect(text).toContain(words);
    }
  });

  it('leaves the yield out when no rent is entered', async () => {
    const text = visibleText(
      await renderToBuffer(<TruePropertyCostDocument schedule={{ ...schedule, rental: undefined }} preparedOn="10/10/2026" />),
    );
    expect(text).not.toContain('Rental yield');
    expect(text).toContain('TRUE COST AT POSSESSION');
  });
});
