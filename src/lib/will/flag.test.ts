import { afterEach, describe, expect, it, vi } from 'vitest';
import { willMakerOpen } from './flag';

afterEach(() => vi.unstubAllEnvs());

describe('willMakerOpen', () => {
  it('is closed to everybody but admins until the flag is on', () => {
    vi.stubEnv('NEXT_PUBLIC_WILL_MAKER', '');
    expect(willMakerOpen(false)).toBe(false);
    expect(willMakerOpen(true)).toBe(true);
  });

  it('opens to everybody only for the exact value 1', () => {
    vi.stubEnv('NEXT_PUBLIC_WILL_MAKER', '1');
    expect(willMakerOpen(false)).toBe(true);
    for (const v of ['0', 'true', 'yes', ' 1']) {
      vi.stubEnv('NEXT_PUBLIC_WILL_MAKER', v);
      expect(willMakerOpen(false), v).toBe(false);
    }
  });
});
