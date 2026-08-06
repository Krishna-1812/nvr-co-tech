import { describe, expect, it } from 'vitest';
import { classifyAmountDifference, normaliseParticular, normaliseReference } from './text';

describe('normaliseParticular', () => {
  it('ignores casing and spacing, and nothing else', () => {
    expect(normaliseParticular('Cheque  Payment ')).toBe('cheque payment');
    expect(normaliseParticular('cheque payment')).toBe('cheque payment');
  });

  it('is empty for nothing', () => {
    expect(normaliseParticular(null)).toBe('');
  });
});

describe('normaliseReference', () => {
  it('reduces a cheque number to what identifies it', () => {
    expect(normaliseReference('CHQ #000123')).toBe('chq123');
    expect(normaliseReference('chq-123')).toBe('chq123');
    expect(normaliseReference('000123')).toBe('123');
    expect(normaliseReference('123')).toBe('123');
  });

  it('leaves a blank reference blank, so blanks never match each other', () => {
    expect(normaliseReference('')).toBe('');
    expect(normaliseReference(null)).toBe('');
    expect(normaliseReference('  -  ')).toBe('');
  });
});

describe('classifyAmountDifference', () => {
  it('says nothing when they agree', () => {
    expect(classifyAmountDifference(5000, 5000)).toBe('None');
  });

  it('names a sub-rupee gap as rounding', () => {
    expect(classifyAmountDifference(5000.4, 5000)).toBe('Rounding');
  });

  it('names a power of ten as a misplaced decimal point', () => {
    expect(classifyAmountDifference(100, 1000)).toBe('Decimal');
    expect(classifyAmountDifference(5000, 50)).toBe('Decimal');
  });

  it('names a whole multiple as a proportion', () => {
    expect(classifyAmountDifference(1000, 3000)).toBe('Proportion');
  });

  it('gives up honestly on anything else', () => {
    expect(classifyAmountDifference(5000, 4500)).toBe('Other');
  });
});
