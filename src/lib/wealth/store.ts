'use client';

import { useSyncExternalStore } from 'react';
import { blankRecord, readRecord, todayIso, type Item, type Profile, type WealthRecord } from './model';
import { isSealed, newLock, open, seal, type Sealed, type Unlocked } from './lock';

/**
 * A person's wealth record, kept in this browser and nowhere else.
 *
 * ── Why not the database ───────────────────────────────────────────────────
 * Every other record on this platform lives in Postgres. This one does not,
 * deliberately. It is a list of somebody's account numbers, folios, policy
 * numbers, property addresses and the names and birth dates of their family,
 * and none of the arithmetic on it needs a server. Kept in the browser, it is
 * never sent anywhere: not to us, not to a provider, not in a log. The cost is
 * that it lives on one device, which the screen says plainly, and which the
 * backup file and the checks ("never backed up") exist to answer.
 *
 * ── One record per person, not per browser ─────────────────────────────────
 * The key carries the signed-in user's id. True Property Cost uses one key per
 * browser, which is harmless for a payment schedule; for this, two people who
 * share a family laptop and each sign in must never see each other's record.
 *
 * ── Locked records ─────────────────────────────────────────────────────────
 * With a passcode set (lib/wealth/lock), what is stored is ciphertext, and the
 * record is only in memory between unlocking and closing the tab. Writes are
 * then asynchronous (encryption is), so they go through one queue, in order:
 * a slow seal of an older version can never land after a newer one.
 */

export type Status = 'loading' | 'locked' | 'ready' | 'unavailable';

export type WealthState = {
  status: Status;
  record: WealthRecord;
  /** Whether a passcode is set, so the screen can offer to lock or to remove it. */
  hasLock: boolean;
  /** Something went wrong saving; shown until the next good save. */
  saveError: string | null;
};

export type Prefs = { hide: boolean; holder: string };

const KEY = (user: string) => `tfi:wealth:v1:${user}`;
const PREFS = (user: string) => `tfi:wealth:prefs:${user}`;

/** The marker on a backup file, so a restore can tell one of ours from any JSON. */
const BACKUP_APP = 'the-finance-intelligence/wealth-tracker';

type Slot = {
  state: WealthState;
  lock: Unlocked | null;
  /** The sealed blob, while locked, to unlock against. */
  sealed: Sealed | null;
  queue: Promise<void>;
  listeners: Set<() => void>;
  prefs: Prefs;
  started: boolean;
};

const slots = new Map<string, Slot>();

const LOADING: WealthState = { status: 'loading', record: blankRecord(), hasLock: false, saveError: null };

function slot(user: string): Slot {
  let s = slots.get(user);
  if (!s) {
    s = {
      state: LOADING,
      lock: null,
      sealed: null,
      queue: Promise.resolve(),
      listeners: new Set(),
      prefs: { hide: false, holder: '' },
      started: false,
    };
    slots.set(user, s);
  }
  return s;
}

function emit(s: Slot) {
  for (const l of s.listeners) l();
}

function set(s: Slot, patch: Partial<WealthState>) {
  s.state = { ...s.state, ...patch };
  emit(s);
}

/** Reads storage once, the first time anything on the page asks for this user's record. */
export function ensureLoaded(user: string, selfName = '') {
  const s = slot(user);
  if (s.started || typeof window === 'undefined') return;
  s.started = true;

  try {
    const p = JSON.parse(localStorage.getItem(PREFS(user)) ?? '{}') as Partial<Prefs>;
    s.prefs = { hide: p.hide === true, holder: typeof p.holder === 'string' ? p.holder : '' };
  } catch {
    // Unreadable preferences are just the defaults.
  }

  load(user, selfName);

  // Another tab saved: follow it, so two open tabs never write over each other.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY(user)) load(user, selfName, true);
  });
}

function load(user: string, selfName: string, fromOtherTab = false) {
  const s = slot(user);
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY(user));
  } catch {
    set(s, { status: 'unavailable' });
    return;
  }
  if (!raw) {
    set(s, { status: 'ready', record: blankRecord(selfName), hasLock: false });
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Something unreadable under our key. Keep it untouched (it may be
    // recoverable by hand) and start the screen empty rather than broken.
    set(s, { status: 'ready', record: blankRecord(selfName), hasLock: false, saveError: 'The saved record could not be read. Restore from a backup if you have one.' });
    return;
  }
  if (isSealed(parsed)) {
    s.sealed = parsed;
    // Another tab re-sealed with the same passcode: the key we hold still opens it.
    if (fromOtherTab && s.lock) {
      const lock = s.lock;
      crypto.subtle
        .decrypt({ name: 'AES-GCM', iv: b64(parsed.iv) }, lock.key, b64(parsed.data))
        .then((buf) => {
          const record = readRecord(JSON.parse(new TextDecoder().decode(buf)));
          if (record) set(s, { status: 'ready', record, hasLock: true });
        })
        .catch(() => {
          s.lock = null;
          set(s, { status: 'locked', hasLock: true });
        });
      return;
    }
    s.lock = null;
    set(s, { status: 'locked', hasLock: true, record: blankRecord(selfName) });
    return;
  }
  const record = readRecord(parsed);
  set(s, {
    status: 'ready',
    record: record ?? blankRecord(selfName),
    hasLock: false,
    saveError: record ? null : 'The saved record could not be read. Restore from a backup if you have one.',
  });
}

function b64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Writes the record as it now stands, in order behind any write still running. */
function persist(user: string) {
  const s = slot(user);
  const record = s.state.record;
  const lock = s.lock;
  s.queue = s.queue.then(async () => {
    try {
      const text = JSON.stringify(record);
      const out = lock ? JSON.stringify(await seal(text, lock)) : text;
      localStorage.setItem(KEY(user), out);
      if (s.state.saveError) set(s, { saveError: null });
    } catch (e) {
      const full = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
      set(s, {
        saveError: full
          ? 'This browser has run out of space for the record. Download a backup now, so nothing is lost.'
          : 'The last change could not be saved in this browser. Download a backup so nothing is lost.',
      });
    }
  });
}

function change(user: string, fn: (r: WealthRecord) => WealthRecord) {
  const s = slot(user);
  if (s.state.status !== 'ready') return;
  set(s, { record: { ...fn(s.state.record), updatedAt: new Date().toISOString() } });
  persist(user);
}

// ── What the screen calls ──────────────────────────────────────────────────

export function wealthActions(user: string) {
  return {
    saveItem(item: Item) {
      change(user, (r) => {
        const next = { ...item, updatedAt: new Date().toISOString() };
        const at = r.items.findIndex((i) => i.id === item.id);
        const items = at >= 0 ? r.items.map((i, k) => (k === at ? next : i)) : [...r.items, next];
        return { ...r, items };
      });
    },
    deleteItem(id: string) {
      change(user, (r) => ({ ...r, items: r.items.filter((i) => i.id !== id) }));
    },
    setProfile(profile: Profile) {
      change(user, (r) => {
        // A member removed from the household takes nothing with them: their
        // entries are kept and the checks ask who holds them now.
        return { ...r, profile };
      });
    },
    /** Replaces the whole record, as a restore does. Keeps this device's lock. */
    replace(record: WealthRecord) {
      change(user, () => record);
    },
    /** Empties the record on this device. The lock, if any, stays. */
    wipe(selfName: string) {
      change(user, () => blankRecord(selfName));
    },

    async unlock(passcode: string): Promise<boolean> {
      const s = slot(user);
      if (!s.sealed) return false;
      const opened = await open(s.sealed, passcode);
      if (!opened) return false;
      const record = readRecord(JSON.parse(opened.plain));
      if (!record) return false;
      s.lock = opened.lock;
      set(s, { status: 'ready', record, hasLock: true });
      return true;
    },
    /** Sets a passcode, or changes it. The record is re-sealed at once. */
    async setPasscode(passcode: string) {
      const s = slot(user);
      s.lock = await newLock(passcode);
      set(s, { hasLock: true });
      persist(user);
      await s.queue;
    },
    /** Removes the passcode: the record is stored as plain text again. */
    async removePasscode() {
      const s = slot(user);
      s.lock = null;
      s.sealed = null;
      set(s, { hasLock: false });
      persist(user);
      await s.queue;
    },
    /**
     * The way out of a forgotten passcode: the locked record and its passcode
     * are deleted together, and an empty record takes their place.
     */
    startOver(selfName: string) {
      const s = slot(user);
      s.lock = null;
      s.sealed = null;
      set(s, { status: 'ready', record: blankRecord(selfName), hasLock: false, saveError: null });
      persist(user);
    },
    /** Forgets the key and hides the record until the passcode is entered again. */
    async lockNow() {
      const s = slot(user);
      if (!s.lock) return;
      await s.queue;
      try {
        const raw = localStorage.getItem(KEY(user));
        const parsed = raw ? JSON.parse(raw) : null;
        if (isSealed(parsed)) s.sealed = parsed;
      } catch {
        // Fall through with whatever was sealed last.
      }
      s.lock = null;
      set(s, { status: 'locked', record: blankRecord() });
    },

    /**
     * The backup file's text. Sealed with the passcode when one is set, so a
     * backup is never less protected than the record it came from. Marks the
     * record as backed up today.
     */
    async backup(): Promise<string> {
      const s = slot(user);
      const now = new Date().toISOString();
      change(user, (r) => ({ ...r, lastBackupAt: now }));
      const text = JSON.stringify(s.state.record);
      const body = s.lock ? { app: BACKUP_APP, sealed: await seal(text, s.lock) } : { app: BACKUP_APP, record: s.state.record };
      return JSON.stringify(body, null, 2);
    },

    setPrefs(patch: Partial<Prefs>) {
      const s = slot(user);
      s.prefs = { ...s.prefs, ...patch };
      try {
        localStorage.setItem(PREFS(user), JSON.stringify(s.prefs));
      } catch {
        // A preference that does not stick is not worth an error.
      }
      emit(s);
    },
  };
}

export type WealthActions = ReturnType<typeof wealthActions>;

/**
 * Reads a backup file. Says what is wrong in words when it is not one of ours,
 * and asks for the passcode when it is sealed.
 */
export async function readBackup(
  text: string,
  passcode?: string,
): Promise<{ ok: true; record: WealthRecord } | { ok: false; needsPasscode?: boolean; reason: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'That file is not a Wealth Tracker backup: it is not readable as one.' };
  }
  const o = (parsed ?? {}) as Record<string, unknown>;
  if (o.app !== BACKUP_APP) {
    return { ok: false, reason: 'That file is not a Wealth Tracker backup.' };
  }
  if (isSealed(o.sealed)) {
    if (!passcode) return { ok: false, needsPasscode: true, reason: 'This backup is locked. Enter the passcode it was made with.' };
    const opened = await open(o.sealed, passcode);
    if (!opened) return { ok: false, needsPasscode: true, reason: 'That passcode does not open this backup.' };
    const record = readRecord(JSON.parse(opened.plain));
    return record ? { ok: true, record } : { ok: false, reason: 'The backup opened, but what is inside could not be read.' };
  }
  const record = readRecord(o.record);
  return record ? { ok: true, record } : { ok: false, reason: 'The backup could not be read. It may have been edited by hand.' };
}

export function backupFileName(today = todayIso()): string {
  return `wealth-record-backup-${today}.json`;
}

const noop = () => () => {};

/**
 * The record for the signed-in user, kept in step with storage. Renders the
 * loading state on the server and on first paint, then whatever is stored.
 */
export function useWealth(user: string, selfName = ''): { state: WealthState; prefs: Prefs } {
  const s = slot(user);
  const state = useSyncExternalStore(
    typeof window === 'undefined'
      ? noop
      : (l) => {
          ensureLoaded(user, selfName);
          s.listeners.add(l);
          return () => s.listeners.delete(l);
        },
    () => s.state,
    () => LOADING,
  );
  const prefs = useSyncExternalStore(
    typeof window === 'undefined'
      ? noop
      : (l) => {
          s.listeners.add(l);
          return () => s.listeners.delete(l);
        },
    () => s.prefs,
    () => DEFAULT_PREFS,
  );
  return { state, prefs };
}

const DEFAULT_PREFS: Prefs = { hide: false, holder: '' };

/** The record as it stands, outside React (tests, and code that runs on an event). */
export function wealthState(user: string): WealthState {
  return slot(user).state;
}

/** Waits for every queued write to land. */
export function saved(user: string): Promise<void> {
  return slot(user).queue;
}

/** Test-only: forget every loaded record, so each test starts from storage. */
export function __resetForTests() {
  slots.clear();
}
