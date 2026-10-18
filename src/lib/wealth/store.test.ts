import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { blankItem } from './model';
import { __resetForTests, ensureLoaded, readBackup, saved, wealthActions, wealthState } from './store';

/*
 * The store runs in the browser; here it is given a stand-in localStorage and
 * window. What is checked is what a person would lose if it were wrong: that a
 * record is kept per signed-in user, that a locked record is never written in
 * plain text, and that a backup restores to exactly what was saved.
 */

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  __resetForTests();
  const storage = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  };
  Object.assign(globalThis, { localStorage: storage, window: { addEventListener: () => {} } });
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).localStorage;
});

describe('wealth store', () => {
  it('keeps a separate record for each signed-in person', async () => {
    ensureLoaded('alice', 'Alice');
    ensureLoaded('bob', 'Bob');
    wealthActions('alice').saveItem({ ...blankItem('bank'), value: 100 });
    await saved('alice');
    expect(wealthState('alice').record.items).toHaveLength(1);
    expect(wealthState('bob').record.items).toHaveLength(0);
    expect(memory.get('tfi:wealth:v1:alice')).toContain('"value":100');
    expect(memory.has('tfi:wealth:v1:bob')).toBe(false);
  });

  it('never writes a locked record in plain text, and unlocks with the passcode only', async () => {
    ensureLoaded('u', 'Asha');
    const a = wealthActions('u');
    a.saveItem({ ...blankItem('bank'), fields: { account: '12345678901' }, value: 5 });
    await a.setPasscode('correct horse');
    a.saveItem({ ...blankItem('demat'), value: 7 });
    await saved('u');

    const stored = memory.get('tfi:wealth:v1:u')!;
    expect(stored).not.toContain('12345678901');
    expect(stored).toContain('aes-gcm-pbkdf2-sha256');

    await a.lockNow();
    expect(wealthState('u').status).toBe('locked');
    expect(wealthState('u').record.items).toHaveLength(0);

    expect(await a.unlock('wrong horse')).toBe(false);
    expect(await a.unlock('correct horse')).toBe(true);
    expect(wealthState('u').record.items.map((i) => i.value)).toEqual([5, 7]);

    // A fresh page load sees a locked record.
    __resetForTests();
    ensureLoaded('u');
    expect(wealthState('u').status).toBe('locked');
  }, 30_000);

  it('removes the passcode and goes back to plain storage', async () => {
    ensureLoaded('u');
    const a = wealthActions('u');
    a.saveItem({ ...blankItem('bank'), value: 1 });
    await a.setPasscode('a passcode here');
    await a.removePasscode();
    expect(memory.get('tfi:wealth:v1:u')).toContain('"value":1');
    expect(wealthState('u').hasLock).toBe(false);
  }, 30_000);

  it('backs up and restores exactly, plain or locked', async () => {
    ensureLoaded('u', 'Asha');
    const a = wealthActions('u');
    a.saveItem({ ...blankItem('property'), value: 9_000_000, fields: { address: 'Flat 4B' } });
    const plain = await a.backup();
    expect(wealthState('u').record.lastBackupAt).not.toBeNull();
    const back = await readBackup(plain);
    expect(back.ok && back.record.items[0].fields.address).toBe('Flat 4B');

    await a.setPasscode('backup passcode');
    const sealed = await a.backup();
    expect(sealed).not.toContain('Flat 4B');
    expect(await readBackup(sealed)).toMatchObject({ ok: false, needsPasscode: true });
    expect(await readBackup(sealed, 'nope nope nope')).toMatchObject({ ok: false, needsPasscode: true });
    const opened = await readBackup(sealed, 'backup passcode');
    expect(opened.ok && opened.record.items[0].value).toBe(9_000_000);
  }, 30_000);

  it('refuses a file that is not one of its backups', async () => {
    expect(await readBackup('not json')).toMatchObject({ ok: false });
    expect(await readBackup('{"version":1,"items":[]}')).toMatchObject({
      ok: false,
      reason: 'That file is not a Wealth Tracker backup.',
    });
  });

  it('keeps an unreadable saved record untouched and starts empty', () => {
    memory.set('tfi:wealth:v1:u', '{broken');
    ensureLoaded('u');
    expect(wealthState('u').status).toBe('ready');
    expect(wealthState('u').saveError).toMatch(/could not be read/);
    expect(memory.get('tfi:wealth:v1:u')).toBe('{broken');
  });
});
