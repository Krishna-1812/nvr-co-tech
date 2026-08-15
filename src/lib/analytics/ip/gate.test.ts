import { describe, expect, it } from 'vitest';
import { classify, needsRdap } from './classify';
import { combine, qualifies, MINIMUM_CONFIDENCE } from './confidence';
import { cleanOrgName, guessDomain, isGenericHostname, registrableDomain } from './names';
import { blockSizeOf, pickOrgName } from './rdap';
import type { IpIntel } from '../types';

/**
 * The gate, the scoring and the sanitiser.
 *
 * This is the part of the system worth testing hardest, and the failures it is
 * testing for are all of one kind: a confident, plausible, wrong answer. A bug
 * here does not throw and does not produce an empty screen — it produces
 * "Verizon Wireless visited your pricing page", which reads exactly like a
 * working feature until somebody acts on it.
 *
 * So most of what follows asserts a refusal rather than a result.
 */

const intel = (over: Partial<IpIntel> = {}): IpIntel => ({
  org: null,
  asn: null,
  hostname: null,
  city: null,
  country: null,
  privacy: null,
  asnType: null,
  companyName: null,
  companyDomain: null,
  ...over,
});

describe('the connection-type gate', () => {
  it('refuses to call a broadband provider a business', () => {
    // The single most common false positive there is: a person at home.
    const { type } = classify({
      intel: intel({ org: 'Bharti Airtel Ltd', asnType: 'business' }),
      hostname: null,
      rdap: { org: 'Bharti Airtel Limited', handle: null, blockSize: 1024 },
    });

    expect(type).toBe('isp');
  });

  it('lets our own keyword list overrule the provider calling a carrier a business', () => {
    // ASN metadata goes stale and coarse. An accumulated list of names we have
    // actually been burned by is allowed to win.
    const { type, reasons } = classify({
      intel: intel({ org: 'ACT Fibernet', asnType: 'business' }),
      hostname: null,
      rdap: null,
    });

    expect(type).toBe('isp');
    expect(reasons.join(' ')).toMatch(/internet or transit provider/);
  });

  it('catches a security proxy before anything else, because that mistake is the worst', () => {
    const { type, reasons } = classify({
      intel: intel({ org: 'Zscaler, Inc.', asnType: 'business' }),
      hostname: 'zscaler.net',
      rdap: { org: 'Zscaler Inc', handle: null, blockSize: 256 },
    });

    expect(type).toBe('proxy');
    expect(reasons.join(' ')).toMatch(/egress/);
  });

  it('treats the hyperscalers as hosting under their own names', () => {
    // "Google LLC" on an address almost never means a Google employee. It means
    // somebody's crawler is running on Google Cloud.
    for (const org of ['Google LLC', 'Microsoft Corporation', 'Amazon Technologies Inc']) {
      expect(classify({ intel: intel({ org }), hostname: null, rdap: null }).type).toBe('hosting');
    }
  });

  it('honours an operator exclusion before every other rule', () => {
    const { type } = classify({
      intel: intel({ org: 'Some New Host Ltd', asnType: 'business' }),
      hostname: null,
      rdap: { org: 'Some New Host Ltd', handle: null, blockSize: 256 },
      exclusions: ['some new host'],
    });

    expect(type).toBe('hosting');
  });

  it('honours a provider privacy flag as proxy rather than hosting when it is a VPN', () => {
    expect(
      classify({ intel: intel({ org: 'Anything', privacy: 'vpn' }), hostname: null, rdap: null }).type,
    ).toBe('proxy');
  });

  it('will not use a small block to call a telecom-sounding name a business', () => {
    // Carriers register small per-region sub-blocks under their own name, and
    // those look exactly like a dedicated corporate allocation from the size.
    const { type, reasons } = classify({
      intel: intel({ org: 'Northern Broadband Services' }),
      hostname: null,
      rdap: { org: 'Northern Broadband Services', handle: null, blockSize: 512 },
    });

    expect(type).toBe('unknown');
    expect(reasons.join(' ')).toMatch(/sounds like a carrier without proving one/);
  });

  it('does call a small named block with no carrier markers a business', () => {
    const { type } = classify({
      intel: intel({ org: 'Sundaram Textiles Private Limited' }),
      hostname: null,
      rdap: { org: 'Sundaram Textiles Private Limited', handle: null, blockSize: 256 },
    });

    expect(type).toBe('business');
  });

  it('does not treat a generated carrier hostname as a company naming itself', () => {
    const { type } = classify({
      intel: intel(),
      hostname: '192-0-2-5.dynamic.someprovider.net',
      rdap: { org: null, handle: null, blockSize: 4_194_304 },
    });

    expect(type).toBe('unknown');
  });

  it('says so plainly when nothing came back at all', () => {
    const { type, reasons } = classify({ intel: null, hostname: null, rdap: null });
    expect(type).toBe('unknown');
    expect(reasons[0]).toMatch(/Nothing came back/);
  });

  it('skips the registry only when the answer could not change', () => {
    // The whole reason a dashboard resolving hundreds of addresses finishes.
    expect(needsRdap('isp')).toBe(false);
    expect(needsRdap('hosting')).toBe(false);
    expect(needsRdap('proxy')).toBe(false);
    expect(needsRdap('mobile')).toBe(false);
    expect(needsRdap('business')).toBe(true);
    expect(needsRdap('unknown')).toBe(true);
  });
});

describe('name sanitisation', () => {
  it('rejects the registry bookkeeping strings that look most like companies', () => {
    for (const junk of ['NS1212-MNT', 'MSFT', 'ZSCALER-WAS1', 'RIPE', 'ORG-ABC1-RIPE', 'hostmaster', 'NET-ACME-1']) {
      expect(cleanOrgName(junk)).toBeNull();
    }
  });

  it('keeps names a person would actually write down', () => {
    expect(cleanOrgName('Acme Manufacturing Limited')).toBe('Acme Manufacturing Limited');
    expect(cleanOrgName('  Cloudflare  ')).toBe('Cloudflare');
    expect(cleanOrgName('"Tata Consultancy Services",')).toBe('Tata Consultancy Services');
  });

  it('does not mistake a company whose name contains a registry acronym', () => {
    // "Stripe" contains "ripe". A word-boundary test is what saves it.
    expect(cleanOrgName('Stripe Payments India')).toBe('Stripe Payments India');
  });

  it('guesses a domain crudely, and refuses when there is nothing left', () => {
    expect(guessDomain('Acme Widgets Private Limited')).toBe('acmewidgets.com');
    expect(guessDomain('The Holdings Group Ltd')).toBeNull();
  });

  it('finds the registrable domain under a multi-part suffix', () => {
    expect(registrableDomain('mail.acme.co.uk')).toBe('acme.co.uk');
    expect(registrableDomain('smtp.example.com')).toBe('example.com');
    expect(registrableDomain('gw.tatasteel.co.in')).toBe('tatasteel.co.in');
    expect(registrableDomain('203.0.113.4')).toBeNull();
  });

  it('knows a generated hostname from a configured one', () => {
    expect(isGenericHostname('mail.acme.com')).toBe(false);
    expect(isGenericHostname('abts-north-static-1.2.3.4.airtelbroadband.in')).toBe(true);
    expect(isGenericHostname('customer-gw.example.net')).toBe(true);
  });
});

describe('reading RDAP', () => {
  const entity = (over: Record<string, unknown>) => ({
    roles: [],
    vcardArray: ['vcard', [['version', {}, 'text', '4.0']]],
    ...over,
  });

  it('picks the registrant over the abuse contact', () => {
    const picked = pickOrgName([
      entity({
        roles: ['abuse'],
        vcardArray: ['vcard', [['fn', {}, 'text', 'Abuse Desk Team']]],
      }),
      entity({
        roles: ['registrant'],
        handle: 'ORG-AM12-RIPE',
        vcardArray: [
          'vcard',
          [
            ['fn', {}, 'text', 'Acme Manufacturing Limited'],
            ['kind', {}, 'text', 'org'],
          ],
        ],
      }),
    ]);

    expect(picked?.name).toBe('Acme Manufacturing Limited');
  });

  it('finds a registrant nested one level down', () => {
    const picked = pickOrgName([
      entity({
        roles: ['technical'],
        vcardArray: ['vcard', [['fn', {}, 'text', 'Technical Contact Desk']]],
        entities: [
          entity({
            roles: ['registrant'],
            vcardArray: [
              'vcard',
              [
                ['fn', {}, 'text', 'Sundaram Textiles Private Limited'],
                ['kind', {}, 'text', 'org'],
              ],
            ],
          }),
        ],
      }),
    ]);

    expect(picked?.name).toBe('Sundaram Textiles Private Limited');
  });

  it('returns nothing rather than a handle when every candidate is bookkeeping', () => {
    const picked = pickOrgName([
      entity({ roles: ['registrant'], vcardArray: ['vcard', [['fn', {}, 'text', 'NS1212-MNT']]] }),
      entity({ roles: ['administrative'], vcardArray: ['vcard', [['fn', {}, 'text', 'RIPE']]] }),
    ]);

    expect(picked).toBeNull();
  });

  it('reads the block size from a CIDR or from the address range', () => {
    expect(blockSizeOf({ cidr0_cidrs: [{ v4prefix: '203.0.113.0', length: 24 }] })).toBe(256);
    expect(blockSizeOf({ startAddress: '203.0.113.0', endAddress: '203.0.113.255' })).toBe(256);
  });

  it('has no opinion on an IPv6 allocation rather than a wrong one', () => {
    // A single small company is routinely given 2^80 addresses in v6, so the
    // v4-calibrated size heuristics would call every one of them sprawling.
    expect(blockSizeOf({ startAddress: '2001:db8::', endAddress: '2001:db8::ffff' })).toBeNull();
  });
});

describe('confidence and the tiered-trust policy', () => {
  it('combines agreeing signals higher than either alone, without summing past 1', () => {
    const one = combine([{ method: 'rdap_registrant', domain: 'acme.com' }], {
      blockSize: null,
      connectionType: 'business',
    });
    const both = combine(
      [
        { method: 'rdap_registrant', domain: 'acme.com' },
        { method: 'org_name_guess', domain: 'acme.com' },
      ],
      { blockSize: null, connectionType: 'business' },
    );

    expect(one?.confidence).toBeCloseTo(0.55, 2);
    // 1 - (0.45 × 0.5) = 0.775, plus the 0.05 corroboration bonus.
    expect(both?.confidence).toBeCloseTo(0.825, 2);
    expect(both!.confidence).toBeLessThanOrEqual(1);
  });

  it('marks confidence down on a sprawling block however good the name looks', () => {
    const small = combine([{ method: 'reverse_dns', domain: 'acme.com' }], {
      blockSize: 1024,
      connectionType: 'business',
    });
    const huge = combine([{ method: 'reverse_dns', domain: 'acme.com' }], {
      blockSize: 4_194_304,
      connectionType: 'business',
    });

    expect(small!.confidence).toBeGreaterThan(huge!.confidence);
  });

  it('caps an institution below a confident domain claim', () => {
    const result = combine(
      [
        { method: 'reverse_dns', domain: 'iitb.ac.in' },
        { method: 'rdap_registrant', domain: 'iitb.ac.in' },
      ],
      { blockSize: 1024, connectionType: 'education' },
    );

    expect(result!.confidence).toBe(0.85);
  });

  it('picks the domain with the most behind it when the signals disagree', () => {
    const result = combine(
      [
        { method: 'org_name_guess', domain: 'wrongguess.com' },
        { method: 'reverse_dns', domain: 'acme.com' },
      ],
      { blockSize: null, connectionType: 'business' },
    );

    expect(result?.domain).toBe('acme.com');
  });

  it('refuses a lone guessed domain on a block that is not demonstrably dedicated', () => {
    // The case the whole policy exists for. It clears no tier, so it is refused
    // whatever the arithmetic said.
    const verdict = qualifies({
      confidence: 0.75,
      methods: ['org_name_guess'],
      registrantIsClean: false,
      blockSize: 4_194_304,
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/not enough to name a company/);
  });

  it('accepts a domain that came from the address itself, on its own', () => {
    expect(
      qualifies({
        confidence: 0.8,
        methods: ['reverse_dns'],
        registrantIsClean: false,
        blockSize: null,
      }).ok,
    ).toBe(true);
  });

  it('accepts two independent methods agreeing', () => {
    expect(
      qualifies({
        confidence: 0.7,
        methods: ['rdap_registrant', 'org_name_guess'],
        registrantIsClean: false,
        blockSize: null,
      }).ok,
    ).toBe(true);
  });

  it('accepts a clean registrant on a small block, and identifies off the name', () => {
    const verdict = qualifies({
      confidence: 0.6,
      methods: ['org_name_guess'],
      registrantIsClean: true,
      blockSize: 4_096,
    });

    expect(verdict.ok).toBe(true);
    expect(verdict.reason).toMatch(/Registrant-backed/);
  });

  it('refuses everything below the floor, however it was arrived at', () => {
    expect(
      qualifies({
        confidence: MINIMUM_CONFIDENCE - 0.01,
        methods: ['reverse_dns', 'rdap_registrant'],
        registrantIsClean: true,
        blockSize: 256,
      }).ok,
    ).toBe(false);
  });
});
