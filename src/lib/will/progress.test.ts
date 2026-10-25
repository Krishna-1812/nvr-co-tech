import { describe, expect, it } from 'vitest';
import { exampleWill } from './example';
import { blankPerson, blankWill } from './model';
import { isBlank } from './progress';

describe('isBlank', () => {
  it('is true for a new draft, even with the account name filled in', () => {
    expect(isBlank(blankWill())).toBe(true);
    expect(isBlank(blankWill('Rohan Mehta'))).toBe(true);
  });

  it('is false as soon as the person has told us something', () => {
    const w = (patch: (r: ReturnType<typeof blankWill>) => void) => {
      const r = blankWill('Rohan');
      patch(r);
      return r;
    };
    expect(isBlank(w((r) => (r.testator.dob = '1980-01-01')))).toBe(false);
    expect(isBlank(w((r) => (r.testator.religion = 'Hindu')))).toBe(false);
    expect(isBlank(w((r) => (r.testator.address = '1 Lane')))).toBe(false);
    expect(isBlank(w((r) => (r.testator.soundMind = true)))).toBe(false);
    expect(isBlank(w((r) => r.people.push(blankPerson('Son'))))).toBe(false);
    expect(isBlank(exampleWill())).toBe(false);
  });
});
