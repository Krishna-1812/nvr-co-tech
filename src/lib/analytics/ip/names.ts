/**
 * Deciding whether a string is a company name.
 *
 * Registry data is not a directory of companies. It is a directory of *objects*,
 * and only some of them are companies — the rest are maintainer records, role
 * accounts, netname tokens and the registry's own bookkeeping. RDAP will hand
 * back `NS1212-MNT` and `ZSCALER-WAS1` and `RIPE` with exactly the same
 * enthusiasm it hands back `Acme Manufacturing Limited`.
 *
 * So this file is the last thing every candidate name passes through before it
 * can reach a screen, after every scoring step upstream has already picked a
 * winner. If it does not look like something a person would write on a business
 * card, nothing is shown at all. An empty result is a correct answer here; a
 * garbage string is not.
 */

/**
 * The patterns that are definitely not companies.
 *
 * The suffixes are RIR maintainer conventions (`-MNT`, `-MAINT`), operations
 * contacts (`-NOC`, `-ADM`, `-HM`) and handle prefixes (`NET-`, `ORG-`, `AS-`).
 * The role words are the mailbox names registries insist on having on file.
 */
const BOOKKEEPING =
  /(^|\b)(ripe|apnic|arin|lacnic|afrinic|iana|ripencc)(\b|$)|[-_](mnt|maint|noc|adm|hm|abuse|tech|admin)$|^(net|org|as|asn|ipv4|ipv6)[-_]|^(hostmaster|postmaster|ip[-_]?admin|abuse|noc|netops|dns[-_]?admin|nobody|unknown|not disclosed|redacted|private|n\/a)$/i;

/** A single word in capitals is a handle; a real company name has a space. */
const SHOUTED_TOKEN = /^[^a-z\s]*[A-Z][A-Z0-9&._-]*$/;

/** One token mixing a hyphen and a digit is a netname: `ZSCALER-WAS1`. */
const HANDLE_TOKEN = /^\S*-\S*\d|\d\S*-\S*$/;

/**
 * A company name, or nothing.
 *
 * Returns the tidied name when the string survives every test, and null when it
 * does not. There is no third answer on purpose: a caller that gets a string
 * back may show it, and a caller that gets null must show nothing rather than
 * fall back to whatever it had before.
 */
export function cleanOrgName(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Registries pad names with quotes, trailing commas and doubled spaces.
  const name = raw
    .replace(/["“”']/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[,;]+$/, '')
    .trim();

  if (name.length < 2 || name.length > 120) return null;
  if (BOOKKEEPING.test(name)) return null;
  // A name with no letter in it at all is an identifier of some kind.
  if (!/[a-zA-Z]/.test(name)) return null;

  const multiWord = name.includes(' ');
  if (!multiWord) {
    // Single tokens are where almost all the rubbish lives, so both handle tests
    // apply only here. "Cloudflare" is a real single-token name and survives;
    // "MSFT" and "ZSCALER-WAS1" do not.
    if (SHOUTED_TOKEN.test(name)) return null;
    if (HANDLE_TOKEN.test(name)) return null;
  }

  return name;
}

/** Whether a name is clean enough to be shown, without needing the tidied form. */
export function isCleanOrgName(raw: string | null | undefined): boolean {
  return cleanOrgName(raw) !== null;
}

/**
 * Corporate furniture, stripped before guessing a domain.
 *
 * `Technologies`, `Holdings` and `Group` are in here with the legal suffixes
 * because they are just as rarely part of the domain: Acme Technologies Private
 * Limited is almost always acme.com.
 */
const SUFFIXES =
  /\b(inc|incorporated|llc|l\.l\.c|ltd|limited|pvt|private|plc|corp|corporation|co|company|gmbh|ag|nv|bv|sa|s\.a|srl|sarl|spa|s\.p\.a|oy|ab|as|aps|kk|pte|pty|llp|lp|holdings?|group|technologies|technology|solutions|services|international|the)\b/gi;

/**
 * A domain guessed from an organisation name.
 *
 * Crude, and meant to be. It exists to give the confidence scoring something to
 * agree with, never to be trusted on its own — the tiered-trust policy in
 * confidence.ts refuses to identify anybody on this signal alone, precisely
 * because "Acme Widgets Ltd" becoming acmewidgets.com is a coin toss.
 */
export function guessDomain(name: string | null | undefined): string | null {
  if (!name) return null;

  const stripped = name
    .replace(SUFFIXES, ' ')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

  // Two characters is not a company, it is what is left of one.
  if (stripped.length < 3 || stripped.length > 40) return null;

  return `${stripped}.com`;
}

/**
 * The registrable domain inside a hostname.
 *
 * `mail.acme.co.uk` has to become `acme.co.uk` rather than `co.uk`, which is
 * why the two-part suffixes are listed rather than "take the last two labels".
 * The list is short because it only has to cover the shapes actually seen on
 * corporate PTR records; anything unlisted falls back to the last two labels,
 * which is right for every single-part TLD.
 */
const TWO_PART_SUFFIX = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'ltd.uk', 'plc.uk',
  'co.in', 'net.in', 'org.in', 'gov.in', 'ac.in', 'edu.in', 'firm.in', 'gen.in', 'ind.in',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'co.nz', 'net.nz', 'org.nz', 'govt.nz',
  'co.za', 'org.za', 'net.za',
  'com.br', 'net.br', 'org.br', 'gov.br',
  'com.sg', 'com.my', 'com.hk', 'com.tw', 'com.cn', 'net.cn', 'org.cn', 'gov.cn',
  'co.jp', 'or.jp', 'ne.jp', 'ac.jp', 'go.jp',
  'co.kr', 'or.kr', 're.kr',
  'com.mx', 'com.ar', 'com.co', 'com.pe', 'com.tr', 'com.ua', 'com.pl',
  'co.il', 'co.id', 'co.th', 'in.th', 'com.ph', 'com.vn', 'com.pk', 'com.bd',
  'com.sa', 'com.eg', 'com.ng', 'co.ke',
]);

export function registrableDomain(hostname: string | null | undefined): string | null {
  if (!hostname) return null;

  const host = hostname.trim().toLowerCase().replace(/\.$/, '');
  // An address rather than a name: reverse DNS sometimes returns the IP back.
  if (!host.includes('.') || /^[\d.]+$/.test(host)) return null;

  const labels = host.split('.').filter(Boolean);
  if (labels.length < 2) return null;

  const lastTwo = labels.slice(-2).join('.');
  const want = TWO_PART_SUFFIX.has(lastTwo) ? 3 : 2;
  if (labels.length < want) return null;

  return labels.slice(-want).join('.');
}

/**
 * Hostnames that name infrastructure rather than an occupant.
 *
 * A PTR record is the strongest domain signal available right up until it is a
 * generated one, at which point it is worth nothing: `192-0-2-5.dynamic.
 * someisp.net` tells you the shape of a carrier's naming scheme and nothing
 * about the person behind it. The giveaway is almost always the octets of the
 * address itself appearing in the name.
 */
const GENERIC_PTR =
  /\b(dyn|dynamic|dhcp|pool|broadband|dsl|cable|fibre|fiber|static|customer|client|user|host|node|ip|adsl|ppp|res|resnet|cust|subscriber|wireless|mobile|cpe|gprs|lte)\b|\d+[-.]\d+[-.]\d+[-.]\d+/i;

export function isGenericHostname(hostname: string | null | undefined): boolean {
  if (!hostname) return true;
  return GENERIC_PTR.test(hostname);
}
