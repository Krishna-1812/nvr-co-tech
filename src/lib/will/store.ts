'use client';

import { useSyncExternalStore } from 'react';
import { savedLocally } from '@/lib/cloud/sync';
import { todayIso } from '../wealth/model';
import { isSealed, newLock, open, openWithLock, seal, type Sealed, type Unlocked } from '../wealth/lock';
import { blankWill, readWill, type WillRecord } from './model';

/**
 * A person's will record, kept in this browser.
 *
 * ── Where it lives ─────────────────────────────────────────────────────────
 * In `localStorage`, under a key that carries the signed-in user's id (or
 * `guest`), so two people sharing a laptop never see each other's draft. It
 * never leaves the browser: unlike Wealth Tracker there is **no copy in the
 * account and none in the Admin screen's analytics** (Wealth's store forwards
 * its text to both). A will and the list of what a person owns is the most
 * sensitive thing this site could be asked to hold, and "kept only in this
 * browser, plus the backup file you download" is a sentence we can say and
 * mean. An encrypted account copy is Phase 4, decided on its own (see
 * docs/will-maker/02-plan.md).
 *
 * ── Locked records ─────────────────────────────────────────────────────────
 * The optional passcode is Wealth Tracker's (lib/wealth/lock): AES-GCM, key
 * from PBKDF2. Sealing is asynchronous, so every write goes through one queue,
 * in order: a slow seal of an older draft can never land after a newer one.
 * A forgotten passcode cannot be recovered; the lock screen says so.
 *
 * What is stored is exactly the `WillRecord`, nothing derived. The document is
 * built from it on demand, so a correction to a clause reaches every draft.
 */

export type Status = 'loading' | 'locked' | 'ready' | 'unavailable';

export type WillState = {
  status: Status;
  record: WillRecord;
  hasLock: boolean;
  /** Something went wrong saving; shown until the next good save. */
  saveError: string | null;
};

const KEY = (user: string) => `tfi:will:v1:${user}`;

/** The marker on a backup file, so a restore can tell one of ours from any JSON. */
const BACKUP_APP = 'the-finance-intelligence/will-maker';

const UNREADABLE = 'The saved draft could not be read. Restore from a backup if you have one.';

type Slot = {
  state: WillState;
  lock: Unlocked | null;
  sealed: Sealed | null;
  queue: Promise<void>;
  listeners: Set<() => void>;
  started: boolean;
  selfName: string;
};

const slots = new Map<string, Slot>();
const LOADING: WillState = { status: 'loading', record: blankWill(), hasLock: false, saveError: null };

function slot(user: string): Slot {
  let s = slots.get(user);
  if (!s) {
    s = { state: LOADING, lock: null, sealed: null, queue: Promise.resolve(), listeners: new Set(), started: false, selfName: '' };
    slots.set(user, s);
  }
  return s;
}

function set(s: Slot, patch: Partial<WillState>) {
  s.state = { ...s.state, ...patch };
  for (const l of s.listeners) l();
}

/** Reads storage once, the first time anything on the page asks for this user's draft. */
export function ensureLoaded(user: string, selfName = '') {
  const s = slot(user);
  if (s.started || typeof window === 'undefined') return;
  s.started = true;
  s.selfName = selfName;
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
    set(s, { status: 'ready', record: blankWill(selfName), hasLock: false });
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Something unreadable under our key. Leave it untouched (it may be
    // recoverable by hand) and start the screen empty rather than broken.
    set(s, { status: 'ready', record: blankWill(selfName), hasLock: false, saveError: UNREADABLE });
    return;
  }
  if (isSealed(parsed)) {
    s.sealed = parsed;
    // Another tab re-sealed with the same passcode: the key we hold still opens it.
    if (fromOtherTab && s.lock) {
      const lock = s.lock;
      void openWithLock(parsed, lock).then((plain) => {
        const record = plain ? readWill(JSON.parse(plain)) : null;
        if (record) set(s, { status: 'ready', record, hasLock: true });
        else {
          s.lock = null;
          set(s, { status: 'locked', hasLock: true, record: blankWill() });
        }
      });
      return;
    }
    s.lock = null;
    set(s, { status: 'locked', hasLock: true, record: blankWill() });
    return;
  }
  const record = readWill(parsed);
  set(s, {
    status: 'ready',
    record: record ?? blankWill(selfName),
    hasLock: false,
    saveError: record ? null : UNREADABLE,
  });
}

/** Writes the record as it now stands, in order behind any write still running. */
function persist(user: string) {
  const s = slot(user);
  const record = s.state.record;
  const lock = s.lock;
  s.queue = s.queue.then(async () => {
    try {
      const text = JSON.stringify(record);
      localStorage.setItem(KEY(user), lock ? JSON.stringify(await seal(text, lock)) : text);
      // For a signed-in person only, and only ever the sealed text: lib/cloud
      // refuses anything readable for this tool (`accept`, in WillSave).
      savedLocally('will-maker', KEY(user));
      if (s.state.saveError) set(s, { saveError: null });
    } catch (e) {
      const full = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
      set(s, {
        saveError: full
          ? 'This browser has run out of space for the draft. Download a backup now, so nothing is lost.'
          : 'The last change could not be saved in this browser. Download a backup so nothing is lost.',
      });
    }
  });
}

function change(user: string, fn: (r: WillRecord) => WillRecord) {
  const s = slot(user);
  if (s.state.status !== 'ready') return;
  set(s, { record: { ...fn(s.state.record), updatedAt: new Date().toISOString() } });
  persist(user);
}

// ── What the screen calls ──────────────────────────────────────────────────

export function willActions(user: string) {
  return {
    /** Applies a change from lib/will/edit (or any function from a record to a record). */
    update(fn: (r: WillRecord) => WillRecord) {
      change(user, fn);
    },
    /** Replaces the whole record, as a restore does. Keeps this device's lock. */
    replace(record: WillRecord) {
      change(user, () => record);
    },
    /** Empties the draft on this device. The lock, if any, stays. */
    wipe(selfName: string) {
      change(user, () => blankWill(selfName));
    },

    async unlock(passcode: string): Promise<boolean> {
      const s = slot(user);
      if (!s.sealed) return false;
      const opened = await open(s.sealed, passcode);
      if (!opened) return false;
      const record = readWill(JSON.parse(opened.plain));
      if (!record) return false;
      s.lock = opened.lock;
      set(s, { status: 'ready', record, hasLock: true });
      return true;
    },
    /** Sets a passcode, or changes it. The draft is re-sealed at once. */
    async setPasscode(passcode: string) {
      const s = slot(user);
      s.lock = await newLock(passcode);
      set(s, { hasLock: true });
      persist(user);
      await s.queue;
    },
    /** Removes the passcode: the draft is stored as plain text again. */
    async removePasscode() {
      const s = slot(user);
      s.lock = null;
      s.sealed = null;
      set(s, { hasLock: false });
      persist(user);
      await s.queue;
    },
    /** The way out of a forgotten passcode: the locked draft and its passcode are deleted together. */
    startOver(selfName: string) {
      const s = slot(user);
      s.lock = null;
      s.sealed = null;
      set(s, { status: 'ready', record: blankWill(selfName), hasLock: false, saveError: null });
      persist(user);
    },
    /** Forgets the key and hides the draft until the passcode is entered again. */
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
      set(s, { status: 'locked', record: blankWill() });
    },

    /**
     * The backup file's text. Sealed with the passcode when one is set, so a
     * backup is never less protected than the draft it came from.
     */
    async backup(): Promise<string> {
      const s = slot(user);
      const text = JSON.stringify(s.state.record);
      const body = s.lock ? { app: BACKUP_APP, sealed: await seal(text, s.lock) } : { app: BACKUP_APP, record: s.state.record };
      return JSON.stringify(body, null, 2);
    },
  };
}

export type WillActions = ReturnType<typeof willActions>;

/**
 * Reads a backup file. Says what is wrong in words when it is not one of ours,
 * and asks for the passcode when it is sealed.
 */
export async function readWillBackup(
  text: string,
  passcode?: string,
): Promise<{ ok: true; record: WillRecord } | { ok: false; needsPasscode?: boolean; reason: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'That file is not a Will Maker backup: it is not readable as one.' };
  }
  const o = (parsed ?? {}) as Record<string, unknown>;
  if (o.app !== BACKUP_APP) return { ok: false, reason: 'That file is not a Will Maker backup.' };
  if (isSealed(o.sealed)) {
    if (!passcode) return { ok: false, needsPasscode: true, reason: 'This backup is locked. Enter the passcode it was made with.' };
    const opened = await open(o.sealed, passcode);
    if (!opened) return { ok: false, needsPasscode: true, reason: 'That passcode does not open this backup.' };
    const record = readWill(JSON.parse(opened.plain));
    return record ? { ok: true, record } : { ok: false, reason: 'The backup opened, but what is inside could not be read.' };
  }
  const record = readWill(o.record);
  return record ? { ok: true, record } : { ok: false, reason: 'The backup could not be read. It may have been edited by hand.' };
}

export const willBackupFileName = (today = todayIso()) => `will-draft-backup-${today}.json`;

const noop = () => () => {};

/**
 * The draft for the signed-in user, kept in step with storage. Renders the
 * loading state on the server and on first paint, then whatever is stored.
 */
export function useWill(user: string, selfName = ''): WillState {
  const s = slot(user);
  return useSyncExternalStore(
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
}

/** The storage key for this person's draft (`guest` for a visitor), for lib/cloud. */
export const willKey = KEY;

/**
 * Stored text with nothing in it yet: no people, assets, gifts or answers
 * beyond a name. A locked draft is never empty, as there is no telling what is
 * inside. For lib/cloud, which must not take a blank starting state for work.
 */
export function willIsEmpty(body: string): boolean {
  try {
    const parsed = JSON.parse(body);
    if (isSealed(parsed)) return false;
    const r = readWill(parsed);
    return (
      !!r &&
      r.people.length === 0 &&
      r.assets.length === 0 &&
      r.gifts.length === 0 &&
      r.residue.length === 0 &&
      !r.testator.dob &&
      !r.testator.address &&
      !r.testator.religion
    );
  } catch {
    return false;
  }
}

/** Whether stored text is a locked draft: the only kind that may leave the browser. */
export function willIsSealed(body: string): boolean {
  try {
    return isSealed(JSON.parse(body));
  } catch {
    return false;
  }
}

/**
 * Reads storage again, after lib/cloud has written the account's copy into it.
 * A draft locked with the passcode already entered stays open.
 */
export function reloadWill(user: string) {
  const s = slot(user);
  if (!s.started) return;
  load(user, s.selfName, true);
}

/** The draft as it stands, outside React (tests, and code that runs on an event). */
export function willState(user: string): WillState {
  return slot(user).state;
}

/** Waits for every queued write to land. */
export function saved(user: string): Promise<void> {
  return slot(user).queue;
}

/** Test-only: forget every loaded draft, so each test starts from storage. */
export function __resetForTests() {
  slots.clear();
}
