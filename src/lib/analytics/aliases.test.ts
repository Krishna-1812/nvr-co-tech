import { describe, expect, it } from 'vitest';
import { aliasCta, aliasPage } from './aliases';

describe('aliasPage', () => {
  it('folds the old /agents addresses into /tools, so one page keeps one history', () => {
    expect(aliasPage('/agents')).toBe('/tools');
    expect(aliasPage('/agents/voucher-desk')).toBe('/tools/voucher-desk');
    expect(aliasPage('/agents?utm_source=x')).toBe('/tools?utm_source=x');
  });

  it('leaves everything else alone, including paths that only start with the same letters', () => {
    expect(aliasPage('/tools/voucher-desk')).toBe('/tools/voucher-desk');
    expect(aliasPage('/agentsx')).toBe('/agentsx');
    expect(aliasPage('/about')).toBe('/about');
    expect(aliasPage('Voucher Desk · The Finance Intelligence')).toBe('Voucher Desk · The Finance Intelligence');
  });
});

describe('aliasCta', () => {
  it("counts the tools index's demo button under one name across the rename", () => {
    expect(aliasCta('lead:Agent index')).toBe('lead:Tool index');
  });
});
