import type { FundSource, Instalment, Schedule } from './calc';

/**
 * The worked example: one under-construction flat, paid for over three years
 * from own funds and a loan, with a rent once it is let.
 *
 * In its own module, free of the browser store, because two places use it:
 * the tool's "Load example" button (store.ts) and the live demo on the public
 * True Property Cost page, which runs the real calculator on it. Keeping one
 * copy means the page cannot show a different property from the one the tool
 * loads. `id` makes the instalment ids; the store passes its own generator.
 */
export const EXAMPLE_NAME = 'Example: Tower B, 2 BHK';

export function exampleSchedule(id: () => string = counter()): Schedule {
  const pay = (label: string, date: string, amount: number, source: FundSource): Instalment => ({
    id: id(),
    label,
    date,
    amount,
    source,
  });
  return {
    ocDate: '2028-03-31',
    rates: { self: 7, borrowed: 8.5 },
    compounding: 'simple',
    areaSqft: 950,
    instalments: [
      pay('Booking amount', '2025-04-15', 750_000, 'self'),
      pay('Stamp duty and registration', '2025-05-20', 420_000, 'self'),
      pay('On completion of plinth', '2025-10-01', 1_500_000, 'borrowed'),
      pay('On completion of 4th slab', '2026-04-01', 1_200_000, 'borrowed'),
      pay('On completion of 8th slab', '2026-10-01', 1_200_000, 'borrowed'),
      pay('GST on the slab demands', '2026-10-01', 247_500, 'self'),
      pay('On finishing works', '2027-07-01', 900_000, 'self'),
      pay('On possession', '2028-03-31', 500_000, 'self'),
    ],
    rental: { monthlyRent: 32_000, maintenanceMonthly: 3_500, annualCosts: 9_000, vacancyPct: 8.33, marketValue: 8_500_000 },
  };
}

function counter() {
  let n = 0;
  return () => `ex-${++n}`;
}
