import { Landmark, Wallet } from 'lucide-react';
import type { FundSource } from '@/lib/landed/calc';

/** The three series colours. See --lc-* in globals.css for how they were chosen. */
export const TONE = {
  self: 'var(--lc-own)',
  borrowed: 'var(--lc-borrow)',
  carry: 'var(--lc-carry)',
} as const;

export const SOURCE_TONE: Record<FundSource, string> = { self: TONE.self, borrowed: TONE.borrowed };
export const SOURCE_ICON = { self: Wallet, borrowed: Landmark } as const;

const DAY_MS = 86_400_000;

/** 1 Mar 2027, read in UTC so the calendar date is the one that was typed. */
export function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))));
}

/** Mar 2027, for axis ticks. */
export function monthYear(day: number): string {
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(day * DAY_MS),
  );
}

export const pct = (x: number) => `${x.toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;

/**
 * Rupees the way an Indian reader sizes them: ₹40.85 L, ₹1.24 Cr, ₹85,000.
 * For axes, chips and the headline's companions; the exact figure, to the
 * paisa, is always one hover or one table row away.
 */
export function compactINR(amount: number): string {
  const v = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: n >= 100 ? 0 : 2 });
  if (v >= 1e7) return `${sign}₹${fmt(v / 1e7)} Cr`;
  if (v >= 1e5) return `${sign}₹${fmt(v / 1e5)} L`;
  return `${sign}₹${Math.round(v).toLocaleString('en-IN')}`;
}

/**
 * How far possession is from today, in words: "in 1 yr 5 mo", "4 mo ago",
 * "today". Counted in calendar months so it reads the way a buyer counts it.
 */
export function untilOc(ocIso: string, todayIso: string): { phrase: string; past: boolean } | null {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayIso);
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ocIso);
  if (!a || !b) return null;
  if (ocIso === todayIso) return { phrase: 'today', past: false };
  const past = ocIso < todayIso;
  const [from, to] = past ? [b, a] : [a, b];
  let months = (Number(to[1]) - Number(from[1])) * 12 + (Number(to[2]) - Number(from[2]));
  if (Number(to[3]) < Number(from[3])) months -= 1;
  if (months < 1) {
    const days = Math.round(
      Math.abs(Date.UTC(+b[1], +b[2] - 1, +b[3]) - Date.UTC(+a[1], +a[2] - 1, +a[3])) / DAY_MS,
    );
    const d = `${days} day${days === 1 ? '' : 's'}`;
    return { phrase: past ? `${d} ago` : `in ${d}`, past };
  }
  const y = Math.floor(months / 12);
  const m = months % 12;
  const span = [y ? `${y} yr` : '', m ? `${m} mo` : ''].filter(Boolean).join(' ');
  return { phrase: past ? `${span} ago` : `in ${span}`, past };
}

/** Today as an ISO date in the reader's own time zone. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
