import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostgrestError } from '@supabase/supabase-js';

/**
 * The module remembers whether the column exists, so each test needs its own copy
 * of it. resetModules + a dynamic import gives one, which is better than exporting
 * a reset function that only tests would ever call.
 */
async function fresh() {
  vi.resetModules();
  return import('./columns');
}

/** What PostgREST actually returns for a select naming a column that is not there. */
const MISSING_AVATAR = {
  code: '42703',
  message: 'column profiles_1.avatar_url does not exist',
  details: '',
  hint: '',
} as unknown as PostgrestError;

const BLIP = {
  code: '08006',
  message: 'connection failure',
  details: '',
  hint: '',
} as unknown as PostgrestError;

/**
 * Stands in for a supabase query builder: records the select string it was built
 * with, and answers with whatever the given database would.
 */
function runner(errorFor: (cols: string) => PostgrestError | null) {
  const calls: string[] = [];
  return {
    calls,
    build: (cols: string) => () => {
      calls.push(cols);
      const error = errorFor(cols);
      return Promise.resolve({ data: error ? null : [{ id: '1' }], error });
    },
  };
}

/** A database on which 0006 has not been applied yet. */
const before = (cols: string) => (cols.includes('avatar_url') ? MISSING_AVATAR : null);

describe('withAvatar', () => {
  it('asks for the column', async () => {
    const { withAvatar, personCols } = await fresh();
    expect(withAvatar('id, email')).toBe('id, email, avatar_url');
    expect(personCols()).toBe('full_name, email, avatar_url');
  });
});

describe('tolerateMissingColumns', () => {
  beforeEach(() => vi.resetModules());

  it('retries without the column and succeeds', async () => {
    const { tolerateMissingColumns, personCols } = await fresh();
    const q = runner(before);

    const result = await tolerateMissingColumns(() => q.build(personCols())());

    // Asked with the column, then asked again without it.
    expect(q.calls).toEqual(['full_name, email, avatar_url', 'full_name, email']);
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ id: '1' }]);
  });

  it('stops asking for it after that, so one process pays once', async () => {
    const { tolerateMissingColumns, personCols, withAvatar } = await fresh();
    const q = runner(before);

    await tolerateMissingColumns(() => q.build(personCols())());
    expect(personCols()).toBe('full_name, email');
    expect(withAvatar('id, role')).toBe('id, role');

    const second = await tolerateMissingColumns(() => q.build(personCols())());
    expect(second.error).toBeNull();
    // Two queries total: the failed one, its retry, and then a single clean query.
    expect(q.calls).toHaveLength(3);
    expect(q.calls[2]).toBe('full_name, email');
  });

  it('leaves the column alone on a healthy database', async () => {
    const { tolerateMissingColumns, personCols } = await fresh();
    const q = runner(() => null);

    const result = await tolerateMissingColumns(() => q.build(personCols())());

    expect(q.calls).toEqual(['full_name, email, avatar_url']);
    expect(result.error).toBeNull();
  });

  it('passes any other error back without forgetting the column', async () => {
    // A dropped connection must not cost this process its faces until it restarts.
    const { tolerateMissingColumns, personCols } = await fresh();
    const q = runner(() => BLIP);

    const result = await tolerateMissingColumns(() => q.build(personCols())());

    expect(q.calls).toHaveLength(1);
    expect(result.error).toBe(BLIP);
    expect(personCols()).toBe('full_name, email, avatar_url');
  });

  it('only reacts to 42703 about avatar_url', async () => {
    const { tolerateMissingColumns, personCols } = await fresh();
    const other = {
      code: '42703',
      message: 'column vouchers.grand_totl does not exist',
      details: '',
      hint: '',
    } as unknown as PostgrestError;
    const q = runner(() => other);

    await tolerateMissingColumns(() => q.build(personCols())());

    // A typo in a different column is a bug to fix, not a schema to work around.
    expect(q.calls).toHaveLength(1);
    expect(personCols()).toBe('full_name, email, avatar_url');
  });
});
