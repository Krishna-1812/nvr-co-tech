import { describe, expect, it } from 'vitest';
import { previewCompany, previewResolution } from './resolutions';
import { MINIMUM_CONFIDENCE, OBSERVED, qualifies } from '@/lib/analytics/ip/confidence';
import { IDENTIFIABLE } from '@/lib/analytics/types';

/**
 * The stand-in has to obey the rule the real engine obeys.
 *
 * It did not. One sample named "Northgate Logistics" from two methods that are
 * both `guessDomain()` applied to an organisation name, and carried the
 * "Corroborated: two independent methods agree" line that was deleted when the
 * gate stopped accepting that pair. Preview mode therefore demonstrated, on the
 * screen built to show whether we invent company names, that we still did.
 *
 * Fixtures drift because nothing checks them. This checks them: every address
 * preview can produce goes through the real `qualifies()`, so a sample can never
 * again claim an identification the shipped gate would refuse.
 */

/** Every distinct resolution the octet-keyed generator can return. */
const ALL = Array.from({ length: 256 }, (_, n) => previewResolution(`203.0.113.${n}`));

describe('preview resolutions', () => {
  it('produces both identified and refused addresses', () => {
    expect(ALL.some((r) => r.identified)).toBe(true);
    expect(ALL.some((r) => !r.identified)).toBe(true);
  });

  it('never identifies anything the real gate would refuse', () => {
    for (const r of ALL.filter((x) => x.identified)) {
      const verdict = qualifies({ confidence: r.confidence, methods: r.methods });
      expect(verdict.ok, `${r.companyName}: ${verdict.reason}`).toBe(true);
    }
  });

  /*
   * The specific fabrication the gate was rewritten to stop: a domain that was
   * only ever built out of an organisation name, however many times that
   * derivation agrees with itself.
   */
  it('names a company only when something read a domain off the address', () => {
    for (const r of ALL.filter((x) => x.identified)) {
      expect(
        r.methods.some((m) => OBSERVED.includes(m)),
        `${r.companyName} was named from ${JSON.stringify(r.methods)}`,
      ).toBe(true);
    }
  });

  it('clears the confidence floor on everything it identifies', () => {
    for (const r of ALL.filter((x) => x.identified)) {
      expect(r.confidence, r.companyName ?? '').toBeGreaterThanOrEqual(MINIMUM_CONFIDENCE);
    }
  });

  it('only ever identifies a connection type that may be shown as an organisation', () => {
    for (const r of ALL.filter((x) => x.identified)) {
      expect(IDENTIFIABLE).toContain(r.connectionType);
    }
  });

  it('leaves a refused address with no name, no domain and no confidence', () => {
    for (const r of ALL.filter((x) => !x.identified)) {
      expect(r.companyName).toBeNull();
      expect(r.domain).toBeNull();
      expect(r.confidence).toBe(0);
      expect(r.methods).toEqual([]);
    }
  });

  /*
   * The most interesting row in the set, and the one the screens had never been
   * able to show: everything about the address says a company, and we still
   * decline to name it.
   */
  it('includes a business address it refuses to name', () => {
    const business = ALL.filter((r) => !r.identified && r.connectionType === 'business');
    expect(business.length).toBeGreaterThan(0);
    for (const r of business) {
      // The organisation name stays where it was observed, in the ASN column.
      expect(r.asnOrg).toBeTruthy();
      expect(r.companyName).toBeNull();
      expect(r.blockSize).toBeTruthy();
      expect(r.reasons.join(' ')).toMatch(/built a domain out of an organisation name/);
    }
  });

  it('gives every refusal a reason to show', () => {
    for (const r of ALL.filter((x) => !x.identified)) {
      expect(r.reasons.length, r.asnOrg ?? '').toBeGreaterThan(0);
    }
  });

  it('has firmographics for every domain it resolves, and none for anything else', () => {
    for (const r of ALL.filter((x) => x.identified)) {
      expect(previewCompany(r.domain!), r.domain ?? '').not.toBeNull();
    }
    expect(previewCompany('northgate.example')).toBeNull();
    expect(previewCompany('nobody.example')).toBeNull();
  });
});
