import { afterEach, describe, expect, it, vi } from 'vitest';

const UUID = '3f2b8c1e-5d4a-4e6f-9a1b-2c3d4e5f6a7b';

describe('recordId', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('accepts only a UUID outside preview mode', async () => {
    const { recordId } = await import('./ids');
    expect(recordId.safeParse(UUID).success).toBe(true);
    expect(recordId.safeParse('v-06').success).toBe(false);
  });

  it('accepts the sample ids in preview mode, where no database issues UUIDs', async () => {
    vi.stubEnv('NEXT_PUBLIC_PREVIEW_MODE', '1');
    vi.stubEnv('NODE_ENV', 'development');
    const { recordId } = await import('./ids');
    expect(recordId.safeParse('v-06').success).toBe(true);
    expect(recordId.safeParse('').success).toBe(false);
  });

  it('is strict in a production build even with the preview switch on', async () => {
    vi.stubEnv('NEXT_PUBLIC_PREVIEW_MODE', '1');
    vi.stubEnv('NODE_ENV', 'production');
    const { recordId } = await import('./ids');
    expect(recordId.safeParse('v-06').success).toBe(false);
  });
});
