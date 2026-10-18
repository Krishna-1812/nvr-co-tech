import { describe, expect, it } from 'vitest';
import { decide, fingerprint } from './sync';

const server = (body: string, updatedAt = 't1') => ({ body, updatedAt });
const meta = (body: string, at = 't1') => ({ at, hash: fingerprint(body) });

describe('decide', () => {
  it('copies whichever side has work to the side that has none', () => {
    expect(decide({ local: 'A', server: null, meta: null, guest: null })).toEqual({ do: 'push', body: 'A' });
    expect(decide({ local: null, server: server('S'), meta: null, guest: null })).toEqual({ do: 'take', body: 'S' });
    expect(decide({ local: null, server: null, meta: null, guest: null })).toEqual({ do: 'nothing' });
  });

  it("makes a visitor's work the account's when the account has none", () => {
    expect(decide({ local: null, server: null, meta: null, guest: 'G' })).toEqual({ do: 'adopt', body: 'G' });
    // An account with work keeps it; the guest copy is not written over it.
    expect(decide({ local: null, server: server('S'), meta: null, guest: 'G' })).toEqual({ do: 'take', body: 'S' });
  });

  it('does not count a blank starting state as work', () => {
    const isEmpty = (b: string) => b === 'blank';
    expect(decide({ local: 'blank', server: null, meta: null, guest: 'G', isEmpty })).toEqual({ do: 'adopt', body: 'G' });
    expect(decide({ local: 'blank', server: server('S'), meta: null, guest: null, isEmpty })).toEqual({ do: 'take', body: 'S' });
    expect(decide({ local: 'blank', server: null, meta: null, guest: 'blank', isEmpty })).toEqual({ do: 'nothing' });
  });

  it('takes the account copy when only another device moved on', () => {
    expect(decide({ local: 'old', server: server('new', 't2'), meta: meta('old', 't1'), guest: null })).toEqual({ do: 'take', body: 'new' });
  });

  it('sends this device up when only this device moved on', () => {
    expect(decide({ local: 'edited', server: server('old', 't1'), meta: meta('old', 't1'), guest: null })).toEqual({ do: 'push', body: 'edited' });
  });

  it('keeps both when both moved on: the account wins, this device is set aside', () => {
    expect(decide({ local: 'mine', server: server('theirs', 't2'), meta: meta('base', 't1'), guest: null })).toEqual({
      do: 'take',
      body: 'theirs',
      stash: 'mine',
    });
  });

  it('does nothing when the two already agree', () => {
    expect(decide({ local: 'X', server: server('X'), meta: null, guest: 'G' })).toEqual({ do: 'nothing' });
  });
});
