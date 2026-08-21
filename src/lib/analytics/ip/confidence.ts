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

/**
 * The methods that read a domain off the address, rather than deriving one from
 * a name.
 *
 * `qualifies()` refuses to name anybody without one of these, which makes this
 * the most consequential line in the file. The distinction is not about how
 * strong each signal feels — it is whether anything was actually observed about
 * this address, or whether a string was transformed into something shaped like
 * a domain.
 */
export const OBSERVED: readonly SignalMethod[] = ['reverse_dns', 'ip_intel_company'];

/** Below a /20 or so. Small enough to suggest one dedicated tenant. */
const DEDICATED = 4_096;
/** A /12 or bigger. Certainly shared infrastructure. */
const SPRAWLING = 1_048_576;
/** Institutions get an organisation-level claim, never a confident domain one. */
const INSTITUTION_CAP = 0.85;

export const MINIMUM_CONFIDENCE = 0.6;

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
 * Clearing the confidence floor is necessary and nowhere near sufficient. One
 * further thing must be true, and it is the whole of the policy: at least one
 * method must have **observed** a domain rather than derived one.
 *
 * The four methods split cleanly along that line, and the split matters far
 * more than their individual weights:
 *
 *   observed   reverse_dns        a PTR record somebody configured on purpose
 *              ip_intel_company   a provider naming the company outright
 *
 *   derived    rdap_registrant    guessDomain() over the registry's name
 *              org_name_guess     guessDomain() over the provider's name
 *
 * Both derived methods are the same string transformation — strip the legal
 * suffixes, delete the punctuation, append `.com` — applied to two spellings of
 * what is usually the same name. They are therefore not independent in the way
 * a corroboration rule needs them to be: "IPPN HOLDINGS LTD" and "IPPN Holdings
 * Ltd" agreeing on `ippn.com` is one guess counted twice, not two sightings.
 *
 * ── Why this is stricter than it was ────────────────────────────────────────
 *
 * There were two weaker tiers here and both are gone.
 *
 * The first let a clean registrant name on a block small enough to be one
 * tenant's identify off the name alone, with the domain left "to be corrected
 * later". Every fabricated company on the visitors screen arrived through that
 * tier, at exactly 0.60 — 0.55 for the registrant plus 0.05 for the small block
 * — and no domain was ever corrected. The enrichment pass fetched them instead,
 * found real unrelated websites at those invented addresses, and copied their
 * branding onto strangers' rows.
 *
 * The second let any two methods agreeing stand as corroboration, which is
 * right for two observations and wrong for two derivations, per the paragraph
 * above.
 *
 * Neither tier existed because the evidence supported it. Both existed to cover
 * a gap: without an `IPINFO_TOKEN` the provider signals that would have caught
 * infrastructure earlier are unavailable, so the classifier's netblock-size
 * fallback was calling every small hosting reseller a business, and these tiers
 * were what let those names reach a screen. Widening what counts as proof is
 * the wrong way to compensate for having less of it.
 *
 * The cost is recall, and it is the right cost. With no IP-intelligence token
 * configured this leaves exactly one route to a name — a real corporate reverse
 * DNS record — so there will be few identifications and each one will be a
 * fact. Setting the token widens the gate again honestly, by adding an
 * observation rather than by lowering the bar.
 */
export function qualifies({
  confidence,
  methods,
}: {
  confidence: number;
  methods: SignalMethod[];
}): Verdict {
  if (confidence < MINIMUM_CONFIDENCE) {
    return {
      ok: false,
      reason: `Confidence ${confidence.toFixed(2)} is below the ${MINIMUM_CONFIDENCE} floor.`,
    };
  }

  const observed = methods.filter((method) => OBSERVED.includes(method));

  if (observed.length === 0) {
    return {
      ok: false,
      reason:
        'Every signal here built a domain out of an organisation name instead of reading one '
        + 'off the address. That is a guess however many times it agrees with itself, so no '
        + 'company is named.',
    };
  }

  return {
    ok: true,
    reason:
      methods.length > observed.length
        ? 'Domain-backed, and the registry agrees: the domain came from the address itself.'
        : 'Domain-backed: the domain came from the address itself.',
  };
}
