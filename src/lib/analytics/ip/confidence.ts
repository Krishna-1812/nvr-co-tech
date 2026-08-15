import type { ConnectionType, DomainVote, SignalMethod } from '../types';

/**
 * How sure we are, and whether that is sure enough to say anything.
 *
 * Two separate questions, and keeping them apart is the point of this file. The
 * first is arithmetic: several independent signals each suggest a domain, and
 * they have to be combined into one number without that number being nonsense.
 * The second is policy: a number on its own is never enough, because 0.6 built
 * from one weak guess is not the same claim as 0.6 built from two independent
 * sightings, even though the arithmetic cannot tell them apart.
 *
 * Precision over recall, explicitly. Somewhere between a fifth and two fifths
 * of real traffic resolving to a named company is the expected outcome and the
 * healthy one. The temptation, the first time somebody looks at the dashboard
 * and sees mostly "not identified", is to lower the bar — which converts an
 * honest gap into a confident lie and cannot be undone, because nobody
 * downstream can tell the two apart.
 */

/**
 * What each kind of evidence is worth on its own.
 *
 * Reverse DNS leads because a PTR record is something the address's owner had
 * to configure deliberately; nobody accidentally points mail.acme.com at their
 * own range. The guessed domain trails everything because it is a string
 * transformation, not an observation.
 */
export const STRENGTH: Record<SignalMethod, number> = {
  reverse_dns: 0.8,
  ip_intel_company: 0.78,
  rdap_registrant: 0.55,
  org_name_guess: 0.5,
};

/** Below a /20 or so. Small enough to suggest one dedicated tenant. */
const DEDICATED = 4_096;
/** A /12 or bigger. Certainly shared infrastructure. */
const SPRAWLING = 1_048_576;
/** Institutions get an organisation-level claim, never a confident domain one. */
const INSTITUTION_CAP = 0.85;

export const MINIMUM_CONFIDENCE = 0.6;
/** A block this size or smaller can carry a registrant-backed identification. */
export const REGISTRANT_BLOCK_LIMIT = 65_536;

export type Combined = {
  domain: string;
  confidence: number;
  methods: SignalMethod[];
  reasons: string[];
};

/**
 * Combine every vote for every domain, and return the winner.
 *
 * Noisy-OR rather than a sum: `1 - Π(1 - strength)`. Two signals at 0.5 come out
 * at 0.75, which is the desired behaviour — agreement is worth more than either
 * alone — where a sum would come out at 1.0 and claim certainty from two coin
 * tosses that happened to land the same way.
 */
export function combine(
  votes: DomainVote[],
  { blockSize, connectionType }: { blockSize: number | null; connectionType: ConnectionType },
): Combined | null {
  if (votes.length === 0) return null;

  const byDomain = new Map<string, Set<SignalMethod>>();
  for (const vote of votes) {
    const key = vote.domain.trim().toLowerCase();
    if (!key) continue;
    (byDomain.get(key) ?? byDomain.set(key, new Set()).get(key)!).add(vote.method);
  }
  if (byDomain.size === 0) return null;

  let best: Combined | null = null;

  for (const [domain, methodSet] of byDomain) {
    const methods = [...methodSet];
    const reasons: string[] = [];

    let confidence = 1 - methods.reduce((product, m) => product * (1 - STRENGTH[m]), 1);
    reasons.push(
      `${methods.map(describe).join(' and ')} point at ${domain}.`,
    );

    // Independent corroboration is worth rewarding past what noisy-OR already
    // gives it: two methods agreeing is qualitatively different from one method
    // being confident, and the arithmetic alone under-states that.
    if (methods.length > 1) {
      confidence += 0.05 * (methods.length - 1);
      reasons.push(`${methods.length} independent methods agree, which adds a corroboration bonus.`);
    }

    if (blockSize != null && blockSize <= DEDICATED) {
      confidence += 0.05;
      reasons.push(`The block is only ${blockSize.toLocaleString('en-IN')} addresses, so it is likely dedicated.`);
    } else if (blockSize != null && blockSize >= SPRAWLING) {
      confidence *= 0.7;
      reasons.push(
        `The block holds ${blockSize.toLocaleString('en-IN')} addresses, which is shared `
        + 'infrastructure however good the name looks.',
      );
    }

    if (connectionType === 'education' || connectionType === 'government') {
      if (confidence > INSTITUTION_CAP) {
        reasons.push(
          `Capped at ${INSTITUTION_CAP} because a ${connectionType} address supports naming the `
          + 'institution, not pinning down a specific domain.',
        );
      }
      confidence = Math.min(confidence, INSTITUTION_CAP);
    }

    confidence = Math.min(1, Math.round(confidence * 1000) / 1000);

    if (!best || confidence > best.confidence) best = { domain, confidence, methods, reasons };
  }

  return best;
}

function describe(method: SignalMethod): string {
  switch (method) {
    case 'reverse_dns':
      return 'the reverse DNS record';
    case 'ip_intel_company':
      return 'a direct company hit from the IP-intelligence provider';
    case 'rdap_registrant':
      return 'the registry registrant';
    case 'org_name_guess':
      return 'a domain guessed from the organisation name';
  }
}

export type Verdict = { ok: boolean; reason: string };

/**
 * Whether an identification may actually be claimed.
 *
 * Clearing the confidence floor is necessary and nowhere near sufficient. One of
 * three independent things must also be true, and the three are ranked by how
 * much they rely on inference:
 *
 *   1. Domain-backed — the winning domain came from a PTR record or from the
 *      provider naming the company outright. That is an observation about this
 *      address, and it stands alone.
 *
 *   2. Corroborated — two methods that could not have influenced each other
 *      arrived at the same domain.
 *
 *   3. Registrant-backed — neither of the above, but the registry says a
 *      clean-looking organisation holds this block and the block is small
 *      enough to belong to one tenant. Here the *name* is trustworthy even
 *      though the domain is only a guess, so the identification is made off the
 *      name and the domain is left to be corrected later.
 *
 * What this rules out is the case the whole policy exists for: a single guessed
 * domain, from one organisation name, on a large shared block. That combination
 * can reach 0.6 on the arithmetic and it means nothing.
 */
export function qualifies({
  confidence,
  methods,
  registrantIsClean,
  blockSize,
}: {
  confidence: number;
  methods: SignalMethod[];
  registrantIsClean: boolean;
  blockSize: number | null;
}): Verdict {
  if (confidence < MINIMUM_CONFIDENCE) {
    return {
      ok: false,
      reason: `Confidence ${confidence.toFixed(2)} is below the ${MINIMUM_CONFIDENCE} floor.`,
    };
  }

  if (methods.includes('reverse_dns') || methods.includes('ip_intel_company')) {
    return { ok: true, reason: 'Domain-backed: the domain came from the address itself.' };
  }

  if (methods.length >= 2) {
    return { ok: true, reason: 'Corroborated: two independent methods agree on the domain.' };
  }

  if (registrantIsClean && blockSize != null && blockSize <= REGISTRANT_BLOCK_LIMIT) {
    return {
      ok: true,
      reason:
        'Registrant-backed: a clean organisation name holds a block small enough to be its '
        + 'own, so the name is trusted even though the domain is a guess.',
    };
  }

  return {
    ok: false,
    reason:
      'One weak signal on a block that is not demonstrably dedicated. That is not enough to '
      + 'name a company.',
  };
}
