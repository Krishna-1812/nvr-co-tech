import { describe, expect, it } from 'vitest';
import { SKY_SCRIPT, skyAt } from './sky';

/** An instant given as a wall-clock time in India. */
const ist = (hh: number, mm = 0) => new Date(Date.UTC(2026, 9, 11, hh, mm) - 5.5 * 3_600_000);

describe('the sky over India', () => {
  it('names the time of day by IST, whatever the machine clock is in', () => {
    expect(skyAt(ist(6, 30)).sky).toBe('dawn');
    expect(skyAt(ist(12)).sky).toBe('day');
    expect(skyAt(ist(17, 45)).sky).toBe('dusk');
    expect(skyAt(ist(22)).sky).toBe('night');
    expect(skyAt(ist(3)).sky).toBe('night');
  });

  it('puts the sun highest at midday and lowest at the horizon', () => {
    const noon = parseInt(skyAt(ist(12, 15)).dy, 10);
    const morning = parseInt(skyAt(ist(7)).dy, 10);
    expect(noon).toBeLessThan(5);
    expect(morning).toBeGreaterThan(noon);
    expect(parseInt(skyAt(ist(18, 29)).dy, 10)).toBeGreaterThan(30);
  });

  it('carries the same function into the head script', () => {
    expect(SKY_SCRIPT).toContain('5.5');
    // The script must run on its own, with nothing from the module around it.
    const root = { setAttribute: () => {}, style: { setProperty: () => {} } };
    expect(() => new Function('document', SKY_SCRIPT)({ documentElement: root })).not.toThrow();
  });
});
