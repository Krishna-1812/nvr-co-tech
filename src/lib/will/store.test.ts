import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setPerson } from './edit';
import { exampleWill } from './example';
import { blankPerson, blankWill } from './model';
import { __resetForTests, ensureLoaded, readWillBackup, saved, willActions, willState } from './store';

/*
 * The store runs in the browser; here it is given a stand-in localStorage and
 * window. What is checked is what a person would lose if it were wrong: that a
 * draft is kept per signed-in user, that a locked draft is never written in
 * plain text, that a backup restores to exactly what was saved, and that
 * nothing about a will is ever sent anywhere.
 */

const memory = new Map<string, string>();
let beacons = 0;

beforeEach(() => {
  memory.clear();
  beacons = 0;
  __resetForTests();
  const storage = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  };
  Object.assign(globalThis, {
    localStorage: storage,
    window: { addEventListener: () => {} },
    fetch: () => {
      beacons++;
      return Promise.resolve(new Response('{}'));
    },
  });
  Object.defineProperty(globalThis.navigator, 'sendBeacon', { value: () => ((beacons++, true)), configurable: true });
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).localStorage;
});

describe('will store', () => {
  it('starts blank, named for the person', () => {
    ensureLoaded('u', 'Asha Rao');
    expect(willState('u')).toMatchObject({ status: 'ready', hasLock: false });
    expect(willState('u').record.testator.name).toBe('Asha Rao');
  });

  it('keeps a separate draft for each signed-in person', async () => {
    ensureLoaded('alice', 'Alice');
    ensureLoaded('bob', 'Bob');
    willActions('alice').update((r) => setPerson(r, { ...blankPerson('Son'), name: 'Kabir' }));
    await saved('alice');
    expect(willState('alice').record.people).toHaveLength(1);
    expect(willState('bob').record.people).toHaveLength(0);
    expect(memory.get('tfi:will:v1:alice')).toContain('Kabir');
    expect(memory.has('tfi:will:v1:bob')).toBe(false);
  });

  it('reloads what was saved, after a restart', async () => {
    ensureLoaded('u');
    willActions('u').replace(exampleWill());
    await saved('u');
    __resetForTests();
    ensureLoaded('u');
    expect(willState('u').record).toEqual({ ...exampleWill(), updatedAt: expect.any(String) });
  });

  it('never writes a locked draft in plain text, and unlocks with the passcode only', async () => {
    ensureLoaded('u', 'Asha');
    const a = willActions('u');
    a.replace(exampleWill());
    await a.setPasscode('correct horse');
    a.update((r) => setPerson(r, { ...blankPerson('Friend'), name: 'Zubin Secret' }));
    await saved('u');

    const stored = memory.get('tfi:will:v1:u')!;
    expect(stored).not.toContain('Rohan');
    expect(stored).not.toContain('Zubin');
    expect(JSON.parse(stored).sealed).toBe('aes-gcm-pbkdf2-sha256');

    __resetForTests();
    ensureLoaded('u');
    expect(willState('u').status).toBe('locked');
    expect(willState('u').record.people).toHaveLength(0);
    expect(await willActions('u').unlock('wrong')).toBe(false);
    expect(await willActions('u').unlock('correct horse')).toBe(true);
    expect(willState('u').record.people.map((p) => p.name)).toContain('Zubin Secret');
  });

  it('removes the passcode back to plain text on request', async () => {
    ensureLoaded('u');
    const a = willActions('u');
    a.replace(exampleWill());
    await a.setPasscode('pass phrase here');
    await a.removePasscode();
    expect(memory.get('tfi:will:v1:u')).toContain('Rohan Mehta');
    expect(willState('u').hasLock).toBe(false);
  });

  it('lets a forgotten passcode go, deleting the locked draft with it', async () => {
    ensureLoaded('u');
    const a = willActions('u');
    a.replace(exampleWill());
    await a.setPasscode('lost');
    __resetForTests();
    ensureLoaded('u');
    willActions('u').startOver('New');
    await saved('u');
    expect(willState('u')).toMatchObject({ status: 'ready', hasLock: false });
    expect(memory.get('tfi:will:v1:u')).not.toContain('sealed');
    expect(willState('u').record.people).toHaveLength(0);
  });

  it('leaves unreadable data in storage untouched and says so', () => {
    memory.set('tfi:will:v1:u', '{not json');
    ensureLoaded('u');
    expect(willState('u').saveError).toMatch(/could not be read/);
    expect(memory.get('tfi:will:v1:u')).toBe('{not json');
  });

  it('refuses to change anything while locked', async () => {
    ensureLoaded('u');
    const a = willActions('u');
    await a.setPasscode('pass phrase here');
    __resetForTests();
    ensureLoaded('u');
    willActions('u').update((r) => setPerson(r, { ...blankPerson('Son'), name: 'Nope' }));
    expect(willState('u').record.people).toHaveLength(0);
  });

  it('sends nothing anywhere, at any point', async () => {
    ensureLoaded('u', 'Asha');
    const a = willActions('u');
    a.replace(exampleWill());
    await a.setPasscode('pass phrase here');
    await a.backup();
    await saved('u');
    expect(beacons).toBe(0);
  });
});

describe('backups', () => {
  it('restore to exactly what was saved', async () => {
    ensureLoaded('u');
    willActions('u').replace(exampleWill());
    await saved('u');
    const text = await willActions('u').backup();
    const back = await readWillBackup(text);
    expect(back).toEqual({ ok: true, record: willState('u').record });
  });

  it('are sealed with the passcode when one is set, and need it to read', async () => {
    ensureLoaded('u');
    const a = willActions('u');
    a.replace(exampleWill());
    await a.setPasscode('pass phrase here');
    const text = await a.backup();
    expect(text).not.toContain('Rohan');
    expect(await readWillBackup(text)).toMatchObject({ ok: false, needsPasscode: true });
    expect(await readWillBackup(text, 'nope')).toMatchObject({ ok: false, needsPasscode: true });
    expect(await readWillBackup(text, 'pass phrase here')).toMatchObject({ ok: true });
  });

  it('say what is wrong with a file that is not one of ours', async () => {
    expect(await readWillBackup('nope')).toMatchObject({ ok: false });
    expect(await readWillBackup('{"app":"the-finance-intelligence/wealth-tracker","record":{}}')).toMatchObject({ ok: false, reason: 'That file is not a Will Maker backup.' });
    expect(await readWillBackup(JSON.stringify({ app: 'the-finance-intelligence/will-maker', record: { version: 9 } }))).toMatchObject({ ok: false });
  });

  it('wipe leaves the person’s name and nothing else', async () => {
    ensureLoaded('u');
    willActions('u').replace(exampleWill());
    willActions('u').wipe('Asha');
    expect(willState('u').record).toMatchObject({ ...blankWill('Asha'), updatedAt: expect.any(String) });
  });
});
