/**
 * Amounts the way people in India actually say them.
 *
 * Somebody filling in what their flat is worth does not type 8500000. They type
 * "85 lakh", or "85L", or "0.85 cr", or "85,00,000" copied off a statement. A
 * box that refuses all of those and wants digits is the first place a person
 * gives up on a form like this, so every money box in Wealth Tracker reads all
 * of them, and says back what it understood in words ("85 lakh") so a slip of
 * a zero is caught while the box still has focus.
 *
 * Never guesses. "85" is eighty-five rupees, not 85 lakh; a unit has to be
 * written to be applied. Anything it cannot read is `null`, and the box says so
 * rather than storing a zero.
 */

const UNITS: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  l: 1e5,
  lac: 1e5,
  lacs: 1e5,
  lakh: 1e5,
  lakhs: 1e5,
  lk: 1e5,
  cr: 1e7,
  crs: 1e7,
  crore: 1e7,
  crores: 1e7,
};

/**
 * Reads an amount. Blank is `undefined` (nothing entered), unreadable is `null`.
 *
 * Accepts a rupee sign or "Rs." / "INR" in front, Indian or Western comma
 * grouping, a decimal point, and one unit word after the number: k, thousand,
 * L, lac, lakh, cr, crore (any case, with or without a space). Negative amounts
 * are refused: a liability is entered on the liabilities side, not as a minus.
 */
export function parseMoney(raw: string): number | null | undefined {
  const text = raw.trim().toLowerCase();
  if (text === '') return undefined;

  const cleaned = text.replace(/^(?:rs\.?|inr|₹)\s*/, '').replace(/,/g, '').replace(/\s+/g, ' ');
  const m = /^(\d+(?:\.\d+)?|\.\d+)\s*([a-z]+)?\.?$/.exec(cleaned);
  if (!m) return null;

  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  if (!m[2]) return round2(n);

  const unit = UNITS[m[2]];
  if (!unit) return null;
  return round2(n * unit);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** "₹85,00,000" — the full figure in Indian grouping, no paise unless there are some. */
export function rupees(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const paise = Math.round(abs * 100) % 100 !== 0;
  return `${sign}₹${abs.toLocaleString('en-IN', {
    minimumFractionDigits: paise ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * The amount said in words a person would use: "85 lakh", "1.2 crore",
 * "45 thousand". Used under a money box as read-back, and in tight places.
 */
export function inWords(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? 'minus ' : '';
  const trim = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  if (abs >= 1e7) return `${sign}${trim(abs / 1e7)} crore`;
  if (abs >= 1e5) return `${sign}${trim(abs / 1e5)} lakh`;
  if (abs >= 1e3) return `${sign}${trim(abs / 1e3)} thousand`;
  return `${sign}${trim(abs)} rupees`;
}

/** "₹85 L", "₹1.2 Cr", "₹45 K": the short form for tiles and bars. */
export function compact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const one = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: n >= 100 ? 0 : n >= 10 ? 1 : 2 });
  if (abs >= 1e7) return `${sign}₹${one(abs / 1e7)} Cr`;
  if (abs >= 1e5) return `${sign}₹${one(abs / 1e5)} L`;
  if (abs >= 1e3) return `${sign}₹${one(abs / 1e3)} K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}
