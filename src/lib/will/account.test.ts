import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * What is checked is the promise that matters: a will never reaches the account
 * unless it is locked, and a deleted or unlocked draft does not leave a copy
 * behind to come back.
 */

const writeSave = vi.fn();
const readSave = vi.fn();
const clearSave = vi.fn();
vi.mock('@/app/actions/saves', () => ({
  readSave: (...a: unknown[]) => readSave(...a),
  writeSave: (...a: unknown[]) => writeSave(...a),
  clearSave: (...a: unknown[]) => clearSave(...a),
}));

import { __resetCloudForTests, savedLocally, startSync } from '@/lib/cloud/sync';
import { forgetAccountCopy } from './account';
import { exampleWill } from './example';
import { __resetForTests, ensureLoaded, saved, willActions, willIsEmpty, willIsSealed, willKey } from './store';
import { blankWill } from './model';

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  __resetForTests();
  __resetCloudForTests();
  writeSave.mockReset().mockResolvedValue({ ok: true, data: { updatedAt: 't1' } });
  readSave.mockReset().mockResolvedValue({ ok: true, data: null });
  clearSave.mockReset().mockResolvedValue({ ok: true, data: undefined });
  vi.useFakeTimers({ shouldAdvanceTime: true });
  Object.assign(globalThis, {
    localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => void memory.set(k, v), removeItem: (k: string) => void memory.delete(k) },
    window: { addEventListener: () => {} },
  });
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).localStorage;
});

const bind = () =>
  startSync({ tool: 'will-maker', key: willKey('u'), guestKey: willKey('guest'), reload: () => {}, isEmpty: willIsEmpty, accept: willIsSealed });

/** Lets the startup read finish and any debounced push fire. */
const settle = async () => {
  await vi.advanceTimersByTimeAsync(2000);
  await Promise.resolve();
};

describe('a will in the account', () => {
  it('is never sent while it is not locked', async () => {
    ensureLoaded('u', 'Asha');
    willActions('u').replace(exampleWill());
    await saved('u');
    bind();
    await settle();
    savedLocally('will-maker', willKey('u'));
    await settle();
    expect(writeSave).not.toHaveBeenCalled();
  });

  it('is sent once it is locked, and what is sent is ciphertext', async () => {
    ensureLoaded('u', 'Asha');
    const a = willActions('u');
    a.replace(exampleWill());
    await a.setPasscode('correct horse battery');
    await saved('u');
    bind();
    await settle();
    a.update((r) => ({ ...r, extras: { ...r.extras, pets: 'A secret parrot' } }));
    await saved('u');
    await settle();
    expect(writeSave).toHaveBeenCalled();
    for (const [tool, body] of writeSave.mock.calls) {
      expect(tool).toBe('will-maker');
      expect(body).not.toContain('Rohan');
      expect(body).not.toContain('parrot');
      expect(JSON.parse(body).sealed).toBe('aes-gcm-pbkdf2-sha256');
    }
  });

  it('stops being sent the moment the passcode is removed', async () => {
    ensureLoaded('u');
    const a = willActions('u');
    a.replace(exampleWill());
    await a.setPasscode('correct horse battery');
    bind();
    await settle();
    writeSave.mockClear();
    await a.removePasscode();
    await settle();
    expect(writeSave).not.toHaveBeenCalled();
  });

  it('does not take a visitor’s unlocked draft into the account', async () => {
    memory.set(willKey('guest'), JSON.stringify(exampleWill()));
    ensureLoaded('u');
    bind();
    await settle();
    expect(writeSave).not.toHaveBeenCalled();
  });

  it('is recognised as empty only when nothing has been entered beyond a name', () => {
    expect(willIsEmpty(JSON.stringify(blankWill('Asha')))).toBe(true);
    expect(willIsEmpty(JSON.stringify(exampleWill()))).toBe(false);
    expect(willIsEmpty('not json')).toBe(false);
  });
});

describe('forgetAccountCopy', () => {
  it('asks for the copy to be removed, and says whether it was', async () => {
    expect(await forgetAccountCopy()).toBe(true);
    expect(clearSave).toHaveBeenCalledWith('will-maker');
  });

  it('never throws, even when the account cannot be reached', async () => {
    clearSave.mockRejectedValue(new Error('offline'));
    expect(await forgetAccountCopy()).toBe(false);
    clearSave.mockResolvedValue({ ok: false, error: 'Sign in to save to your account.' });
    expect(await forgetAccountCopy()).toBe(false);
  });
});
