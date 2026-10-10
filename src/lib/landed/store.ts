'use client';

import { useSyncExternalStore } from 'react';
import type { Compounding, FundSource, Instalment, Rates, Rental, Schedule } from './calc';

/**
 * Saved schedules, kept in this browser.
 *
 * Nothing here goes to a server, for the same reason Ledger Reconciliation reads
 * its ledgers in the browser: a payment plan for somebody's flat, with the loan
 * behind it, is personal, and the arithmetic needs nothing a server has. The
 * cost is that a schedule lives on the device it was typed on, which the screen
 * says in so many words.
 *
 * The rates and the compounding are also remembered on their own, as the
 * defaults for the next schedule: the cost of a firm's own money and of its
 * borrowing are the same whichever flat it is buying.
 */

export type SavedSchedule = Schedule & {
  id: string;
  name: string;
  updatedAt: string;
};

type State = {
  schedules: SavedSchedule[];
  activeId: string | null;
  defaults: { rates: Rates; compounding: Compounding };
};

const KEY = 'tfi:landed-cost:v1';

export const STARTING_DEFAULTS: State['defaults'] = {
  rates: { self: 7, borrowed: 8.5 },
  compounding: 'simple',
};

const EMPTY: State = { schedules: [], activeId: null, defaults: STARTING_DEFAULTS };

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function blankInstalment(source: FundSource = 'self'): Instalment {
  return { id: newId(), label: '', date: '', amount: 0, source };
}

export function blankSchedule(defaults: State['defaults'], name = 'Untitled property'): SavedSchedule {
  return {
    id: newId(),
    name,
    ocDate: '',
    rates: { ...defaults.rates },
    compounding: defaults.compounding,
    instalments: [
      { ...blankInstalment('self'), label: 'Booking amount' },
      blankInstalment('borrowed'),
    ],
    updatedAt: new Date().toISOString(),
  };
}

// ── Reading what is stored, without trusting it ─────────────────────────────

const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const COMPOUNDINGS: Compounding[] = ['simple', 'annual', 'quarterly', 'monthly'];
const compounding = (v: unknown): Compounding =>
  COMPOUNDINGS.includes(v as Compounding) ? (v as Compounding) : 'simple';

const optNum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

function readRental(raw: unknown): Rental | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  return {
    monthlyRent: optNum(o.monthlyRent),
    maintenanceMonthly: optNum(o.maintenanceMonthly),
    annualCosts: optNum(o.annualCosts),
    vacancyPct: optNum(o.vacancyPct),
    marketValue: optNum(o.marketValue),
  };
}

function readSchedule(raw: unknown): SavedSchedule | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const rates = (o.rates ?? {}) as Record<string, unknown>;
  const instalments = Array.isArray(o.instalments) ? o.instalments : [];
  const id = str(o.id);
  if (!id) return null;
  return {
    id,
    name: str(o.name, 'Untitled property'),
    ocDate: str(o.ocDate),
    rates: { self: num(rates.self), borrowed: num(rates.borrowed) },
    compounding: compounding(o.compounding),
    areaSqft: typeof o.areaSqft === 'number' && Number.isFinite(o.areaSqft) ? o.areaSqft : undefined,
    rental: readRental(o.rental),
    instalments: instalments
      .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
      .map((i) => ({
        id: str(i.id) || newId(),
        label: str(i.label),
        date: str(i.date),
        amount: num(i.amount),
        source: i.source === 'borrowed' ? 'borrowed' : 'self',
      })),
    updatedAt: str(o.updatedAt, new Date(0).toISOString()),
  };
}

function read(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const schedules = (Array.isArray(parsed.schedules) ? parsed.schedules : [])
      .map(readSchedule)
      .filter((s): s is SavedSchedule => s !== null);
    const d = (parsed.defaults ?? {}) as Record<string, unknown>;
    const dr = (d.rates ?? {}) as Record<string, unknown>;
    const activeId = typeof parsed.activeId === 'string' ? parsed.activeId : null;
    return {
      schedules,
      activeId: schedules.some((s) => s.id === activeId) ? activeId : (schedules[0]?.id ?? null),
      defaults: {
        rates: {
          self: num(dr.self, STARTING_DEFAULTS.rates.self),
          borrowed: num(dr.borrowed, STARTING_DEFAULTS.rates.borrowed),
        },
        compounding: compounding(d.compounding),
      },
    };
  } catch {
    // Private windows and blocked storage throw; an unreadable entry is treated
    // as no entry rather than taking the screen down.
    return EMPTY;
  }
}

/**
 * "Property 3", numbered past the highest one already in use. Counting the list
 * instead gave a second "Property 2" after the first one was deleted.
 */
function nextName(schedules: SavedSchedule[]): string {
  const taken = schedules
    .map((s) => /^Property (\d+)$/.exec(s.name.trim())?.[1])
    .filter(Boolean)
    .map(Number);
  return `Property ${Math.max(schedules.length, ...taken) + 1}`;
}

// ── The store ───────────────────────────────────────────────────────────────

let cache: State | null = null;
const listeners = new Set<() => void>();

function snapshot(): State {
  if (cache === null) cache = read();
  return cache;
}

function write(next: State) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the schedule still works for this visit.
  }
  listeners.forEach((l) => l());
}

function onStorage(e: StorageEvent) {
  if (e.key !== KEY) return;
  cache = null;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

/** Everything saved, or null on the server and before hydration. */
export function useLandedStore(): State | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

export const landedStore = {
  /** Save a schedule, and remember its rates as the defaults for the next one. */
  save(schedule: SavedSchedule) {
    const state = snapshot();
    const stamped = { ...schedule, updatedAt: new Date().toISOString() };
    const exists = state.schedules.some((s) => s.id === schedule.id);
    write({
      schedules: exists
        ? state.schedules.map((s) => (s.id === schedule.id ? stamped : s))
        : [stamped, ...state.schedules],
      activeId: schedule.id,
      defaults: { rates: { ...schedule.rates }, compounding: schedule.compounding },
    });
  },
  open(id: string) {
    const state = snapshot();
    if (state.schedules.some((s) => s.id === id)) write({ ...state, activeId: id });
  },
  /** Start a new schedule from the remembered rates and make it the open one. */
  create(): SavedSchedule {
    const state = snapshot();
    const fresh = blankSchedule(state.defaults, nextName(state.schedules));
    write({ ...state, schedules: [fresh, ...state.schedules], activeId: fresh.id });
    return fresh;
  },
  /**
   * Add a worked example and open it.
   *
   * Named as an example so it can never be mistaken for somebody's own flat,
   * and added beside what is saved rather than over it. The figures are a
   * plausible two-bedroom on a construction-linked plan, with stamp duty and
   * GST entered as dated payments the way the screen suggests, and a rent.
   */
  createExample(): SavedSchedule {
    const state = snapshot();
    const pay = (label: string, date: string, amount: number, source: FundSource): Instalment => ({
      id: newId(),
      label,
      date,
      amount,
      source,
    });
    const example: SavedSchedule = {
      id: newId(),
      name: 'Example: Tower B, 2 BHK',
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
      updatedAt: new Date().toISOString(),
    };
    write({ ...state, schedules: [example, ...state.schedules], activeId: example.id });
    return example;
  },
  /**
   * Start a first schedule, but only if there is still none.
   *
   * Checked against the store rather than against the caller's render, because
   * an effect can run twice on one render (React does exactly that in
   * development) and both runs would see the same empty list.
   */
  ensureOne() {
    if (snapshot().schedules.length === 0) this.create();
  },
  remove(id: string) {
    const state = snapshot();
    const schedules = state.schedules.filter((s) => s.id !== id);
    write({
      ...state,
      schedules,
      activeId: state.activeId === id ? (schedules[0]?.id ?? null) : state.activeId,
    });
  },
};
