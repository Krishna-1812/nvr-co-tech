'use client';

import { useSyncExternalStore } from 'react';
import { readSave, writeSave } from '@/app/actions/saves';

/**
 * Keeping a browser-side tool's work in the signed-in person's account.
 *
 * True Property Cost and Wealth Tracker do everything in the browser and keep
 * their work in localStorage, which is all a visitor without an account gets:
 * the work stays in that browser. Signing in adds a copy in the account
 * (migration 0032, actions/saves.ts), so it is not lost with the browser and
 * follows the person to another device. This module moves that copy, and
 * nothing else: it never parses what it moves, so a Wealth Tracker record
 * locked with a passcode goes up as the ciphertext the browser already holds.
 *
 * ── Which copy wins ────────────────────────────────────────────────────────
 * Each device remembers what it last agreed with the account (the account's
 * time stamp and a fingerprint of the text). On opening the tool:
 *   - only one side has anything: that side is copied to the other;
 *   - this device has not changed since it last agreed: the account's copy is
 *     taken (another device moved on);
 *   - the account has not changed since: this device's copy goes up (it was
 *     changed while the account could not be reached);
 *   - both changed: the account's copy is taken and this device's is kept
 *     beside it under `<key>:before-sync`, so nothing is lost.
 * After that every save in the browser is sent up a moment later. Two devices
 * open at once is last-write-wins; that is said in HANDOFF, not hidden.
 *
 * ── Work done before signing in ────────────────────────────────────────────
 * A visitor's work is kept under a guest key. The first time a signed-in
 * person opens the tool with nothing in their account and nothing of their own
 * on this device, the guest work becomes theirs and goes up: that is what the
 * "Sign in to save" button promises. If their account already has work, the
 * guest copy is left where it is rather than written over either.
 */

export type CloudTool = 'wealth-tracker' | 'true-property-cost';

export type CloudStatus =
  /** No account: kept in this browser only. */
  | 'local'
  | 'checking'
  | 'saving'
  | 'saved'
  /** Signed in, but the account could not be reached; kept in this browser. */
  | 'offline'
  /** Signed in, but account saving is not switched on (0032 not applied). */
  | 'unavailable';

type Meta = { at: string; hash: string };

export type Decision =
  | { do: 'nothing' }
  | { do: 'push'; body: string }
  | { do: 'take'; body: string; stash?: string }
  | { do: 'adopt'; body: string };

/** A short fingerprint, to tell "unchanged" from "changed" without keeping a second copy. */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(36)}.${text.length}`;
}

/** The rules above, with no storage and no network, so they can be tested as rules. */
export function decide({
  local,
  server,
  meta,
  guest,
  isEmpty = () => false,
}: {
  local: string | null;
  server: { body: string; updatedAt: string } | null;
  meta: Meta | null;
  guest: string | null;
  /**
   * Whether stored text holds no work yet: a tool may write a blank starting
   * state the moment it opens, and that must not count as work that wins.
   */
  isEmpty?: (body: string) => boolean;
}): Decision {
  const mine = local && !isEmpty(local) ? local : null;
  const theirs = guest && !isEmpty(guest) ? guest : null;
  if (!server) {
    if (mine) return { do: 'push', body: mine };
    if (theirs) return { do: 'adopt', body: theirs };
    return { do: 'nothing' };
  }
  if (local === server.body) return { do: 'nothing' };
  if (!mine) return { do: 'take', body: server.body };
  if (meta && meta.hash === fingerprint(mine)) return { do: 'take', body: server.body };
  if (meta && meta.at === server.updatedAt) return { do: 'push', body: mine };
  return { do: 'take', body: server.body, stash: mine };
}

type Binding = {
  tool: CloudTool;
  key: string;
  guestKey: string;
  /** Called after this module has written the account's copy into storage. */
  reload: () => void;
  /** See `decide`. */
  isEmpty?: (body: string) => boolean;
};

type Entry = {
  status: CloudStatus;
  binding: Binding | null;
  started: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: Promise<void>;
  listeners: Set<() => void>;
};

const entries = new Map<CloudTool, Entry>();

function entry(tool: CloudTool): Entry {
  let e = entries.get(tool);
  if (!e) {
    e = { status: 'local', binding: null, started: false, timer: null, inFlight: Promise.resolve(), listeners: new Set() };
    entries.set(tool, e);
  }
  return e;
}

function setStatus(e: Entry, status: CloudStatus) {
  if (e.status === status) return;
  e.status = status;
  for (const l of e.listeners) l();
}

const metaKey = (key: string) => `${key}:synced`;

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function put(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked or full: the tool itself already says so.
  }
}

function readMeta(key: string): Meta | null {
  try {
    const m = JSON.parse(get(metaKey(key)) ?? 'null') as Meta | null;
    return m && typeof m.at === 'string' && typeof m.hash === 'string' ? m : null;
  } catch {
    return null;
  }
}

/**
 * Starts keeping a tool in step with the account, once per page load. Safe to
 * call from every component that shows the tool; only the first call acts.
 */
export function startSync(binding: Binding) {
  if (typeof window === 'undefined') return;
  const e = entry(binding.tool);
  e.binding = binding;
  if (e.started) return;
  e.started = true;
  setStatus(e, 'checking');

  e.inFlight = (async () => {
    const res = await readSave(binding.tool).catch(() => ({ ok: false as const, error: 'offline' }));
    const local = get(binding.key);
    const guest = get(binding.guestKey);

    const empty = binding.isEmpty ?? (() => false);

    if (!res.ok) {
      // Account saving is not available; still let guest work become this
      // person's on this device, which is half of what signing in promised.
      if ((!local || empty(local)) && guest && !empty(guest)) {
        put(binding.key, guest);
        put(binding.guestKey, null);
        binding.reload();
      }
      setStatus(e, 'missing' in res && res.missing ? 'unavailable' : 'offline');
      return;
    }

    const d = decide({ local, server: res.data, meta: readMeta(binding.key), guest, isEmpty: empty });
    if (d.do === 'take') {
      if (d.stash) put(`${binding.key}:before-sync`, d.stash);
      put(binding.key, d.body);
      put(metaKey(binding.key), JSON.stringify({ at: res.data!.updatedAt, hash: fingerprint(d.body) }));
      binding.reload();
      setStatus(e, 'saved');
    } else if (d.do === 'adopt') {
      put(binding.key, d.body);
      put(binding.guestKey, null);
      binding.reload();
      await push(e, d.body);
    } else if (d.do === 'push') {
      await push(e, d.body);
    } else {
      if (res.data && local) put(metaKey(binding.key), JSON.stringify({ at: res.data.updatedAt, hash: fingerprint(local) }));
      setStatus(e, 'saved');
    }
  })();
}

async function push(e: Entry, body: string) {
  const b = e.binding;
  if (!b) return;
  setStatus(e, 'saving');
  const res = await writeSave(b.tool, body).catch(() => ({ ok: false as const, error: 'offline' }));
  if (res.ok) {
    put(metaKey(b.key), JSON.stringify({ at: res.data.updatedAt, hash: fingerprint(body) }));
    // A newer save may have queued while this one was out; it will report.
    if (!e.timer) setStatus(e, 'saved');
  } else {
    setStatus(e, 'missing' in res && res.missing ? 'unavailable' : 'offline');
  }
}

/**
 * Tells this module that a tool has just written to `key`. Sends it to the
 * account shortly after, once typing has paused. Does nothing for a visitor,
 * or for a key that is not the bound one (the guest key, for instance).
 */
export function savedLocally(tool: CloudTool, key: string) {
  const e = entries.get(tool);
  if (!e?.started || !e.binding || e.binding.key !== key || e.status === 'unavailable') return;
  if (e.timer) clearTimeout(e.timer);
  setStatus(e, 'saving');
  e.timer = setTimeout(() => {
    e.timer = null;
    e.inFlight = e.inFlight.then(() => {
      const body = get(key);
      return body === null ? undefined : push(e, body);
    });
  }, 1200);
}

const noop = () => () => {};

/** Where this tool's work is being kept, right now, for the status line. */
export function useCloudStatus(tool: CloudTool): CloudStatus {
  const e = entry(tool);
  return useSyncExternalStore(
    typeof window === 'undefined'
      ? noop
      : (l) => {
          e.listeners.add(l);
          return () => e.listeners.delete(l);
        },
    () => e.status,
    () => 'local',
  );
}

/** Test-only. */
export function __resetCloudForTests() {
  entries.clear();
}
