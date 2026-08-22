/**
 * Reading an Indian Corporate Identity Number.
 *
 * A CIN is not an opaque key. Twenty-one characters, each group meaning
 * something:
 *
 *     U 72200 KA 2013 PTC 097389
 *     │   │    │   │    │    └─ registration number, 6 digits
 *     │   │    │   │    └────── ownership class, 3 letters
 *     │   │    │   └─────────── year of incorporation, 4 digits
 *     │   │    └─────────────── state of the registrar, 2 letters
 *     │   └──────────────────── industry code, 5 digits
 *     └──────────────────────── L for listed, U for unlisted
 *
 * Which makes this file worth more than it looks. The MCA publishes its company
 * master data as a free bulk download — 3.6 million rows — and every one of them
 * carries a CIN. So an industry code, a state, a year of incorporation and a
 * first guess at listing status come out of the identifier itself, for nothing,
 * before a single paid document is fetched. That is a meaningful part of what a
 * data vendor charges for.
 *
 * ── The listing bit is a hint, not the truth ──────────────────────────────
 *
 * `L` and `U` describe what was true when the number was allotted. A company that
 * listed years after incorporation, or delisted last month, may still carry the
 * other letter — the MCA does reissue CINs on a change of status, but not
 * reliably and not promptly.
 *
 * So exchange data is authoritative and this is a fallback, which has a
 * consequence for ingest ORDER: `upsert_company` in migration 0028 lets any
 * later non-'unknown' listing status overwrite an earlier one, so **master data
 * must be loaded before exchange data, never after.** Reversed, a bulk MCA pass
 * would quietly relabel every listed company in the registry as unlisted, and
 * nothing on screen would look wrong until a peer set came back empty.
 *
 * ── Malformed means null, never a guess ───────────────────────────────────
 *
 * Every parse either satisfies the whole grammar or returns null. Partial reads
 * are refused, because the failure mode is silent: a CIN with a transposed
 * character parses to a plausible wrong state and a plausible wrong year, and
 * nothing downstream can tell. Three and a half million rows will contain
 * whitespace, lowercase, and rows where the column is something else entirely.
 */

/** What a CIN says about itself. */
export type Cin = {
  /** The normalised 21-character CIN: trimmed, uppercased. */
  cin: string;
  /**
   * True for L, false for U. See the header on why this is a hint — an exchange
   * record beats it, and ingest order has to respect that.
   */
  listed: boolean;
  /** Five digits. NIC-derived, and stored as `nic_code` on the company. */
  industryCode: string;
  /** The registrar's state, as the two letters in the CIN. Always present. */
  stateCode: string;
  /** The state's name, where the code is one we recognise. Null otherwise. */
  state: string | null;
  /** Year of incorporation. */
  year: number;
  /** The three-letter ownership class, verbatim. */
  ownershipCode: string;
  /** What that class means, where we recognise it. Null otherwise. */
  ownership: string | null;
  /** Six digits. */
  registrationNumber: string;
};

/**
 * The grammar, as one expression.
 *
 * Anchored at both ends, so a 22-character string fails rather than matching its
 * first 21 — which is the difference between refusing a bad row and importing a
 * company under a truncated identifier that will never match anything again.
 */
const CIN_RE = /^([LU])(\d{5})([A-Z]{2})(\d{4})([A-Z]{3})(\d{6})$/;

/**
 * Registrar state codes.
 *
 * Only the ones worth being confident about. An unrecognised code leaves `state`
 * null and `stateCode` populated, which is the honest result: the CIN still tells
 * us where it was registered, we just have no name to put to it, and inventing
 * one would put a wrong state on a company profile.
 */
const STATES: Record<string, string> = {
  AN: 'Andaman and Nicobar Islands',
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CH: 'Chandigarh',
  CT: 'Chhattisgarh',
  DL: 'Delhi',
  GA: 'Goa',
  GJ: 'Gujarat',
  HP: 'Himachal Pradesh',
  HR: 'Haryana',
  JH: 'Jharkhand',
  JK: 'Jammu and Kashmir',
  KA: 'Karnataka',
  KL: 'Kerala',
  MH: 'Maharashtra',
  ML: 'Meghalaya',
  MN: 'Manipur',
  MP: 'Madhya Pradesh',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OR: 'Odisha',
  PB: 'Punjab',
  PY: 'Puducherry',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TG: 'Telangana',
  TN: 'Tamil Nadu',
  TR: 'Tripura',
  UP: 'Uttar Pradesh',
  UR: 'Uttarakhand',
  WB: 'West Bengal',
};

/**
 * Ownership classes.
 *
 * The consequential ones for valuation are PTC and PLC — a private limited
 * company and a public one are not comparable to each other on any multiple —
 * and NPL, because a section 8 not-for-profit has no equity value in the sense
 * this tool means and should never appear in a peer set. Unrecognised codes
 * resolve to null rather than to a nearest guess.
 */
const OWNERSHIP: Record<string, string> = {
  PTC: 'Private limited company',
  PLC: 'Public limited company',
  OPC: 'One person company',
  FTC: 'Subsidiary of a foreign company, private',
  FLC: 'Subsidiary of a foreign company, public',
  GOI: 'Government of India company',
  SGC: 'State government company',
  NPL: 'Not for profit, section 8',
  ULL: 'Unlimited liability, public',
  ULT: 'Unlimited liability, private',
};

/**
 * Parse a CIN, or return null.
 *
 * Whitespace and case are forgiven because a CSV cell is a CSV cell. Nothing else
 * is: a string that does not satisfy the whole grammar is refused.
 *
 * The year is sanity-checked rather than merely being four digits. The Companies
 * Act of 1956 is the oldest thing a CIN can predate, and a year in the future is
 * a transposition — `2031` for `2013` is the exact error this catches, and it is
 * the one a human eye slides straight past.
 */
export function parseCin(raw: unknown): Cin | null {
  if (typeof raw !== 'string') return null;

  const cin = raw.trim().toUpperCase().replace(/\s+/g, '');
  const m = CIN_RE.exec(cin);
  if (!m) return null;

  const [, listing, industryCode, stateCode, yearText, ownershipCode, registrationNumber] = m;
  const year = Number(yearText);
  // No CIN predates the 1956 Act, and none is issued for a future year.
  if (year < 1850 || year > new Date().getUTCFullYear() + 1) return null;

  return {
    cin,
    listed: listing === 'L',
    industryCode,
    stateCode,
    state: STATES[stateCode] ?? null,
    year,
    ownershipCode,
    ownership: OWNERSHIP[ownershipCode] ?? null,
    registrationNumber,
  };
}

/** Whether a string is a well-formed CIN. */
export function isCin(raw: unknown): boolean {
  return parseCin(raw) !== null;
}

/**
 * Ownership classes that should never enter a peer set.
 *
 * A section 8 not-for-profit has no equity value in the sense this tool means,
 * and a multiple computed against one is arithmetic on a category error. Left as
 * an exported set rather than a filter inside the parser, because refusing a
 * company is a screen's job and the screen records its reasons.
 */
export const NOT_COMPARABLE_OWNERSHIP = new Set(['NPL']);

/**
 * Whether the CIN alone is reason enough to keep a company out of a peer set.
 *
 * Returns the reason, so the caller can put it on the record rather than having
 * to reconstruct one. Null means nothing in the identifier disqualifies it, which
 * is not the same as saying it belongs.
 */
export function cinDisqualifies(cin: Cin): string | null {
  if (NOT_COMPARABLE_OWNERSHIP.has(cin.ownershipCode)) {
    return 'A section 8 not-for-profit has no equity value to compare';
  }
  return null;
}
