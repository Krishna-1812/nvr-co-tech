import { IDENTIFIABLE, type DomainVote, type IpIntel, type RdapInfo, type Resolution } from '../types';
import { classify, needsRdap } from './classify';
import { combine, qualifies } from './confidence';
import { operatorExclusions } from './lists';
import { cleanOrgName, guessDomain, isCleanOrgName, isGenericHostname, registrableDomain } from './names';
import { fetchRdap } from './rdap';
import { fetchIntel, isPrivateIp, reverseDns } from './network';

/**
 * resolveIp — the one public entry point of the de-anonymisation engine.
 *
 * Everything the other files in this directory do is arranged by this one
 * function, in this order:
 *
 *   1. Gather up to three independent pieces of evidence, each best-effort and
 *      time-boxed, none of which is allowed to throw.
 *   2. Classify the connection type, which decides whether a name may be shown
 *      at all. This is the gate, and it is checked before anything else.
 *   3. Combine whatever domain candidates the evidence produced into one
 *      confidence figure.
 *   4. Apply the tiered-trust policy, which asks not just how confident we are
 *      but what kind of evidence that confidence is made of.
 *
 * Every step appends to `reasons`, so the answer can always explain itself.
 * That is not politeness: the first question anybody asks of a resolution is
 * "why does it think that", and a system that cannot answer gets trusted either
 * completely or not at all.
 */

/**
 * Bumped whenever the logic above changes shape.
 *
 * Cached resolutions carry the version that produced them, so improving the
 * classification does not mean serving last month's wrong answer until the TTL
 * runs out — every stored row simply re-resolves once, on demand.
 */
export const RESOLVER_VERSION = 1;

/** A week. Address assignments move, but not quickly. */
export const RESOLUTION_TTL_SECONDS = 7 * 24 * 60 * 60;

const unidentified = (ip: string, connectionType: Resolution['connectionType'], reasons: string[]): Resolution => ({
  ip,
  identified: false,
  connectionType,
  companyName: null,
  domain: null,
  confidence: 0,
  methods: [],
  reasons,
  city: null,
  country: null,
  asn: null,
  asnOrg: null,
  hostname: null,
  blockSize: null,
});

export async function resolveIp(ip: string): Promise<Resolution> {
  if (!ip || isPrivateIp(ip)) {
    return unidentified(ip, 'unknown', ['A private or loopback address. Nobody to look up.']);
  }

  // Two independent lookups with nothing to say to each other, so they run at
  // the same time. RDAP deliberately does not join them — see below.
  const [intel, hostname] = await Promise.all([fetchIntel(ip), reverseDns(ip)]);

  const exclusions = operatorExclusions();

  /*
   * The cheap pass first.
   *
   * RDAP's only contribution to the classification is the block size, and block
   * size only matters for the very last fallback rule. If the provider data and
   * the hostname alone already say this is a carrier, a phone network, a cloud
   * or a VPN — which is where most consumer and most automated traffic lands —
   * then the registry cannot change the answer and there is no reason to wait
   * for it. Across a few hundred addresses this is the difference between a
   * dashboard that opens and one that hangs.
   */
  const preliminary = classify({ intel, hostname, rdap: null, exclusions });

  let rdap: RdapInfo | null = null;
  let verdict = preliminary;

  if (needsRdap(preliminary.type)) {
    rdap = await fetchRdap(ip);
    verdict = classify({ intel, hostname, rdap, exclusions });
  } else {
    verdict.reasons.push('The registry was not consulted: it could not have changed this.');
  }

  const reasons = [...verdict.reasons];

  // ── The gate ───────────────────────────────────────────────────────────────
  // Checked before any name is assembled, so there is no path where a name is
  // built and then relied upon not to leak.
  if (!IDENTIFIABLE.includes(verdict.type)) {
    return {
      ...unidentified(ip, verdict.type, reasons),
      city: intel?.city ?? null,
      country: intel?.country ?? null,
      asn: intel?.asn ?? null,
      asnOrg: intel?.org ?? null,
      hostname,
      blockSize: rdap?.blockSize ?? null,
    };
  }

  const votes = collectVotes({ intel, hostname, rdap });
  const combined = combine(votes, { blockSize: rdap?.blockSize ?? null, connectionType: verdict.type });

  if (!combined) {
    return {
      ...unidentified(ip, verdict.type, [
        ...reasons,
        'This looks like an organisation, but nothing produced a usable domain for it.',
      ]),
      city: intel?.city ?? null,
      country: intel?.country ?? null,
      asn: intel?.asn ?? null,
      asnOrg: intel?.org ?? null,
      hostname,
      blockSize: rdap?.blockSize ?? null,
    };
  }

  reasons.push(...combined.reasons);

  const gate = qualifies({
    confidence: combined.confidence,
    methods: combined.methods,
    registrantIsClean: isCleanOrgName(rdap?.org),
    blockSize: rdap?.blockSize ?? null,
  });
  reasons.push(gate.reason);

  /*
   * The name shown, in order of how directly it was observed.
   *
   * A provider naming the company outright beats the registrant, which beats
   * anything reconstructed from a hostname — and if none of them survives
   * sanitisation, the domain itself is shown rather than a fabricated name.
   */
  const companyName =
    cleanOrgName(intel?.companyName)
    ?? cleanOrgName(rdap?.org)
    ?? cleanOrgName(intel?.org)
    ?? null;

  return {
    ip,
    identified: gate.ok,
    connectionType: verdict.type,
    companyName: gate.ok ? companyName : null,
    domain: gate.ok ? combined.domain : null,
    confidence: combined.confidence,
    methods: combined.methods,
    reasons,
    city: intel?.city ?? null,
    country: intel?.country ?? null,
    asn: intel?.asn ?? null,
    asnOrg: intel?.org ?? null,
    hostname,
    blockSize: rdap?.blockSize ?? null,
  };
}

/**
 * Every domain candidate the evidence produced, tagged with where it came from.
 *
 * A method may vote once. Two methods landing on the same domain is what the
 * corroboration bonus downstream is for, and it only means something if the two
 * really were independent — which is why the guessed domain is derived from the
 * ASN organisation name rather than from anything the other votes touched.
 */
function collectVotes({
  intel,
  hostname,
  rdap,
}: {
  intel: IpIntel | null;
  hostname: string | null;
  rdap: RdapInfo | null;
}): DomainVote[] {
  const votes: DomainVote[] = [];

  // A generated carrier hostname is not evidence of anything, so it is dropped
  // here rather than being allowed to vote at the strongest weight in the table.
  const fromPtr = isGenericHostname(hostname) ? null : registrableDomain(hostname);
  if (fromPtr) votes.push({ method: 'reverse_dns', domain: fromPtr });

  if (intel?.companyDomain) votes.push({ method: 'ip_intel_company', domain: intel.companyDomain });

  const fromRegistrant = guessDomain(cleanOrgName(rdap?.org));
  if (fromRegistrant) votes.push({ method: 'rdap_registrant', domain: fromRegistrant });

  const fromOrgName = guessDomain(cleanOrgName(intel?.org));
  if (fromOrgName) votes.push({ method: 'org_name_guess', domain: fromOrgName });

  return votes;
}

/**
 * Resolve a lot of addresses without resolving any of them twice.
 *
 * A dashboard row does not resolve its own IP — hundreds of rows share a few
 * dozen distinct addresses, and each resolution is up to three network calls.
 * So the caller hands over the whole list, duplicates collapse, and the rest go
 * out in a small pool rather than one at a time. Sixteen at once is enough to
 * make the wall-clock the slowest single lookup rather than the sum of all of
 * them, and small enough not to look like an attack to rdap.org.
 */
const POOL_SIZE = 16;

export async function resolveMany(ips: (string | null)[]): Promise<Map<string, Resolution>> {
  const queue = [...new Set(ips.filter((ip): ip is string => Boolean(ip)))];
  const out = new Map<string, Resolution>();

  const worker = async () => {
    for (;;) {
      const ip = queue.shift();
      if (!ip) return;
      out.set(ip, await resolveIp(ip));
    }
  };

  await Promise.all(Array.from({ length: Math.min(POOL_SIZE, queue.length) }, worker));
  return out;
}

export { classify, needsRdap } from './classify';
export { combine, qualifies, MINIMUM_CONFIDENCE, STRENGTH } from './confidence';
