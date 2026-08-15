import type { ConnectionType, IpIntel, RdapInfo } from '../types';
import {
  EDUCATION_WORDS,
  GOVERNMENT_WORDS,
  HOSTING_BRANDS,
  ISP_BRANDS,
  MOBILE_BRANDS,
  PROXY_BRANDS,
  TELECOM_WORDS,
  hits,
} from './lists';
import { isGenericHostname, registrableDomain } from './names';

/**
 * The hard gate.
 *
 * Everything else in the de-anonymisation engine is about finding a name. This
 * file is about refusing to show one, and it is the more important half. A
 * system that identifies too few visitors is working as designed and everybody
 * can live with it. A system that reports "Verizon Wireless" and "Zscaler, Inc."
 * as accounts that visited your pricing page has told a salesperson something
 * false about a real person, and it only gets to do that once before nobody
 * opens the dashboard again.
 *
 * So: only `business`, `education` and `government` may ever surface a company
 * name. Everything else is not-identifiable outright, no matter how confident
 * the underlying evidence looked.
 *
 * The order of the checks below is load-bearing and is followed exactly. Two
 * parts of it are worth explaining because they look wrong until they don't:
 *
 *   * Our own keyword lists are consulted BEFORE the provider's classification.
 *     ASN metadata goes stale and is coarse; a regional carrier that has been
 *     labelled `business` upstream would otherwise sail straight through. An
 *     accumulated list of names we have actually been burned by is allowed to
 *     overrule a data vendor.
 *
 *   * A small address block is normally a good sign — it suggests one dedicated
 *     tenant — but only once the name has been ruled telecom-ish, because
 *     carriers register small per-city sub-blocks under their own name and
 *     those look identical to a corporate allocation from the size alone.
 */

export type ClassifyInput = {
  intel: IpIntel | null;
  hostname: string | null;
  /** Null on the cheap first pass; see `needsRdap` below. */
  rdap: RdapInfo | null;
  /** Operator-configured substrings, always treated as hosting. */
  exclusions?: string[];
};

export type Classification = { type: ConnectionType; reasons: string[] };

/** A /16. Anything at or below this is small enough to be one tenant's. */
export const DEDICATED_BLOCK = 65_536;

export function classify({
  intel,
  hostname,
  rdap,
  exclusions = [],
}: ClassifyInput): Classification {
  const reasons: string[] = [];

  // Everything the name-matching runs against, in one string. The hostname is
  // included because a PTR record naming the vendor — zscaler.net, amazonaws.com
  // — is often the clearest evidence on offer.
  const parts = [intel?.org, intel?.companyName, hostname, rdap?.org].filter(Boolean) as string[];
  const text = parts.join(' ');

  const anySignal = parts.length > 0;
  if (!anySignal) {
    return { type: 'unknown', reasons: ['Nothing came back for this address at all.'] };
  }

  // ── 1. The operator's own exclusions win over everything ─────────────────
  const excluded = hits(text, exclusions);
  if (excluded) {
    return {
      type: 'hosting',
      reasons: [`Matched "${excluded}" on the operator exclusion list.`],
    };
  }

  // ── 2. An explicit infrastructure flag from a paid provider tier ─────────
  if (intel?.privacy) {
    return {
      type: intel.privacy === 'hosting' ? 'hosting' : 'proxy',
      reasons: [`The IP-intelligence provider flags this address as ${intel.privacy}.`],
    };
  }

  // ── 3. Our own keywords, in order of how expensive the mistake would be ──
  const proxy = hits(text, PROXY_BRANDS);
  if (proxy) {
    return {
      type: 'proxy',
      reasons: [
        `"${proxy}" is a security proxy or VPN vendor. Its customers' employees all `
        + 'egress from its addresses, so the name here is the vendor, not the visitor.',
      ],
    };
  }

  const education = hits(text, EDUCATION_WORDS);
  if (education) {
    return { type: 'education', reasons: [`"${education}" reads as an educational institution.`] };
  }

  const government = hits(text, GOVERNMENT_WORDS);
  if (government) {
    return { type: 'government', reasons: [`"${government}" reads as a government body.`] };
  }

  const mobile = hits(text, MOBILE_BRANDS);
  if (mobile) {
    return { type: 'mobile', reasons: [`"${mobile}" is a mobile carrier.`] };
  }

  const hosting = hits(text, HOSTING_BRANDS);
  if (hosting) {
    return {
      type: 'hosting',
      reasons: [`"${hosting}" is a hosting or cloud provider. Its address space is tenant traffic.`],
    };
  }

  const isp = hits(text, ISP_BRANDS);
  if (isp) {
    return { type: 'isp', reasons: [`"${isp}" is an internet or transit provider.`] };
  }

  // ── 4. Only now, the provider's own coarse classification ────────────────
  if (intel?.asnType) {
    reasons.push(`The IP-intelligence provider classifies this ASN as ${intel.asnType}.`);
    if (intel.asnType === 'isp') return { type: 'isp', reasons };
    if (intel.asnType === 'hosting') return { type: 'hosting', reasons };
    if (intel.asnType === 'education') return { type: 'education', reasons };
    if (intel.asnType === 'government') return { type: 'government', reasons };
    if (intel.asnType === 'business') return { type: 'business', reasons };
  }

  // ── 5. The netblock-size fallback ────────────────────────────────────────
  const telecomish = hits(text, TELECOM_WORDS);
  if (telecomish) {
    return {
      type: 'unknown',
      reasons: [
        `The name contains "${telecomish}", which sounds like a carrier without proving `
        + 'one. Carriers register small blocks under their own name, so the block size '
        + 'is not allowed to call this a business.',
      ],
    };
  }

  if (rdap?.blockSize != null && rdap.blockSize <= DEDICATED_BLOCK) {
    return {
      type: 'business',
      reasons: [
        `The registry allocated ${rdap.blockSize.toLocaleString('en-IN')} addresses to `
        + 'a named organisation with no carrier or hosting markers, which is the shape '
        + 'of one company’s own range.',
      ],
    };
  }

  // A real PTR record pointing at a real domain, with nothing suggesting
  // infrastructure. Generated carrier hostnames are excluded here because they
  // are the single most common way this branch goes wrong.
  const named = registrableDomain(hostname) ?? intel?.companyDomain ?? null;
  if (named && !isGenericHostname(hostname ?? named)) {
    return {
      type: 'business',
      reasons: [`The address names ${named} with no carrier or hosting markers against it.`],
    };
  }

  return {
    type: 'unknown',
    reasons: [
      ...reasons,
      'There was a signal, but nothing in it distinguishes a company from an access provider.',
    ],
  };
}

/**
 * Whether the registry lookup is worth making.
 *
 * RDAP is a network round-trip that can take a second or more, and the only
 * thing it contributes to the classification is the block size used in step 5.
 * If a first pass over the provider data and the hostname alone has already
 * landed on infrastructure — which is where the large majority of consumer and
 * cloud traffic lands — the answer cannot change, so the call is skipped.
 *
 * On a dashboard resolving a few hundred unique addresses this is the whole
 * difference between a page that appears and a page that is still thinking.
 */
export function needsRdap(preliminary: ConnectionType): boolean {
  return !['isp', 'mobile', 'hosting', 'proxy'].includes(preliminary);
}
