import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * The interlock: the public never sees the tool without BOTH the flag and an
 * advocate's sign-off. `law` is mocked so each combination can be tried.
 */

const SIGNED = { by: 'A. Advocate, Enrolment MH/1/2020, Firm', on: '2026-12-01', packet: 'abc123' };

async function load(signOff: typeof SIGNED | null, env: string) {
  vi.resetModules();
  vi.doMock('./law', async (orig) => {
    const real = await orig<typeof import('./law')>();
    return { ...real, LAW: { ...real.LAW, advocateSignOff: signOff } };
  });
  vi.stubEnv('NEXT_PUBLIC_WILL_MAKER', env);
  return import('./flag');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('./law');
  vi.resetModules();
});

describe('willMakerOpen / willMakerPublic', () => {
  it('is for admins only until there is a sign-off and the flag', async () => {
    const f = await load(null, '');
    expect(f.willMakerOpen(false)).toBe(false);
    expect(f.willMakerOpen(true)).toBe(true);
    expect(f.willMakerPublic()).toBe(false);
  });

  it('is NOT opened by the flag alone: a flag cannot stand in for a lawyer', async () => {
    const f = await load(null, '1');
    expect(f.willMakerPublic()).toBe(false);
    expect(f.willMakerOpen(false)).toBe(false);
  });

  it('is NOT opened by a sign-off alone: launch is a decision taken on the day', async () => {
    const f = await load(SIGNED, '');
    expect(f.willMakerPublic()).toBe(false);
    expect(f.willMakerOpen(false)).toBe(false);
  });

  it('opens to everybody with both, and only for the exact value 1', async () => {
    const on = await load(SIGNED, '1');
    expect(on.willMakerPublic()).toBe(true);
    expect(on.willMakerOpen(false)).toBe(true);
    for (const v of ['0', 'true', 'yes', ' 1']) {
      const f = await load(SIGNED, v);
      expect(f.willMakerPublic(), v).toBe(false);
    }
  });
});
