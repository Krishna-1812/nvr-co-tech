import { describe, expect, it } from 'vitest';
import { landedCost, problems } from './calc';
import { exampleSchedule } from './example';

/*
 * The worked example is what the public page's demo runs and what the tool's
 * "Load example" opens, so it has to be a schedule the calculator accepts.
 */
describe('the worked example', () => {
  it('is a complete schedule with nothing for the calculator to object to', () => {
    expect(problems(exampleSchedule())).toEqual([]);
  });

  it('costs more by possession than was paid, and is paid in full', () => {
    const r = landedCost(exampleSchedule());
    expect(r.paid).toBe(6_717_500);
    expect(r.landed).toBeGreaterThan(r.paid);
  });

  it('gives each payment its own id', () => {
    const ids = exampleSchedule().instalments.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
