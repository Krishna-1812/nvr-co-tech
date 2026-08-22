import { describe, expect, it } from 'vitest';
import { INGEST_ORDER, minimumGapMs, sourceById, SOURCES } from './index';

describe('the registry', () => {
  it('has an entry per adapter, with its id matching its key', () => {
    for (const [key, adapter] of Object.entries(SOURCES)) {
      expect(adapter.id).toBe(key);
      expect(adapter.label.length).toBeGreaterThan(0);
    }
  });

  it('returns null for BSE, which is deliberately not built', () => {
    expect(sourceById('bse')).toBeNull();
  });
});

describe('INGEST_ORDER', () => {
  it('puts master data before the exchange, which is not cosmetic', () => {
    /*
     * upsert_company lets a later non-'unknown' listing status overwrite an
     * earlier one, and the MCA's CIN only records what was true when the number
     * was allotted. Reversed, a bulk MCA pass relabels every listed company in
     * the registry as unlisted, and nothing looks wrong until a peer set comes
     * back empty.
     */
    expect(INGEST_ORDER.indexOf('mca_master')).toBeLessThan(INGEST_ORDER.indexOf('nse'));
  });

  it('covers every built adapter', () => {
    expect([...INGEST_ORDER].sort()).toEqual(Object.keys(SOURCES).sort());
  });
});

describe('minimumGapMs', () => {
  it('turns a rate into a gap', () => {
    expect(minimumGapMs(SOURCES.sec_edgar)).toBe(200); // 5/s — two requests per company now
    expect(minimumGapMs(SOURCES.nse)).toBe(334); //         3/s, rounded up
  });

  it('rounds up rather than down, so the ceiling is never exceeded', () => {
    // 334ms not 333ms. Three requests a second is a limit, not a target, and
    // over it the address gets blocked with no support desk to call.
    expect(minimumGapMs({ id: 'nse', label: 'x', politeness: { requestsPerSecond: 3 } })).toBe(334);
  });

  it('does not divide by zero when a rate is nonsense', () => {
    expect(minimumGapMs({ id: 'nse', label: 'x', politeness: { requestsPerSecond: 0 } })).toBe(10_000);
  });
});

describe('politeness', () => {
  it('paces at half the stated EDGAR ceiling, because each company now costs two requests', () => {
    expect(SOURCES.sec_edgar.politeness.requestsPerSecond).toBe(5);
    expect(SOURCES.sec_edgar.politeness.userAgent).toContain('@');
  });

  it('records that NSE needs a session', () => {
    expect(SOURCES.nse.politeness.needsSession).toBe(true);
  });
});
