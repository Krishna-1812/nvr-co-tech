import { describe, expect, it } from 'vitest';
import { acceptsBody } from './guard';

const SEALED = JSON.stringify({ sealed: 'aes-gcm-pbkdf2-sha256', iterations: 310000, salt: 's', iv: 'i', data: 'd' });

describe('acceptsBody', () => {
  it('stores the other tools’ text as it is', () => {
    expect(acceptsBody('wealth-tracker', '{"version":1}')).toBe(true);
    expect(acceptsBody('true-property-cost', 'anything')).toBe(true);
  });

  it('stores a will only as a sealed blob', () => {
    expect(acceptsBody('will-maker', SEALED)).toBe(true);
  });

  it('refuses a will that is readable, however it is dressed', () => {
    const plain = JSON.stringify({ version: 1, testator: { name: 'Rohan' }, people: [], assets: [] });
    expect(acceptsBody('will-maker', plain)).toBe(false);
    expect(acceptsBody('will-maker', '')).toBe(false);
    expect(acceptsBody('will-maker', 'not json')).toBe(false);
    // A readable will with a "sealed" key bolted on is not a sealed blob.
    expect(acceptsBody('will-maker', JSON.stringify({ sealed: 'aes-gcm-pbkdf2-sha256', version: 1, people: [] }))).toBe(false);
    expect(acceptsBody('will-maker', JSON.stringify({ sealed: 'none', iterations: 1, salt: 's', iv: 'i', data: 'd' }))).toBe(false);
    expect(acceptsBody('will-maker', 'null')).toBe(false);
    expect(acceptsBody('will-maker', '[]')).toBe(false);
  });
});
