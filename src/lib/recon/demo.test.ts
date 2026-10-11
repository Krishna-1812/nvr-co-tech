import { describe, expect, it } from 'vitest';
import { runReconDemo } from './demo';

/*
 * The public page draws its lines and states its answer from this, so these
 * pin down that what it shows is what the engine says about the sample files.
 */
describe('the public reconciliation demo', () => {
  const demo = runReconDemo();

  it('reads both sample ledgers in full', () => {
    expect(demo.books.transactions).toHaveLength(6);
    expect(demo.bank.transactions).toHaveLength(6);
  });

  it('ties out, as the tool does on the same files', () => {
    expect(demo.result.statement.status).toBe('RECONCILED');
    expect(Math.abs(demo.result.statement.variance)).toBeLessThan(0.01);
  });

  it('pairs every line exactly once, and agrees with the statement on what matched', () => {
    const a = demo.pairs.map((p) => p.a).filter((i) => i !== null);
    const b = demo.pairs.map((p) => p.b).filter((i) => i !== null);
    expect(new Set(a).size).toBe(a.length);
    expect(new Set(b).size).toBe(b.length);
    const matched = demo.pairs.filter((p) => p.category === 'MATCHED').length;
    expect(matched).toBe(demo.result.counts.MATCHED);
  });

  it('leaves the two lines only one side has, and says which side', () => {
    const oneSided = demo.pairs.filter((p) => p.a === null || p.b === null);
    expect(oneSided).toHaveLength(2);
    expect(demo.result.statement.lines).toHaveLength(2);
  });
});
