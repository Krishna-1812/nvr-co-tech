/**
 * The shapes the analytics system passes around.
 *
 * Kept in one file with no imports of its own so that a client component, a
 * route handler and a Node-only resolver can all name the same thing without
 * dragging `next/headers` or `dns` into a browser bundle.
 */

// ─── Connection type: the hard gate ──────────────────────────────────────────

/**
 * What kind of connection an IP address represents.
 *
 * This is the single most important classification in the system. An IP that
 * resolves to an organisation name does not mean that organisation is the
 * visitor's employer: it might be their broadband provider, their mobile
 * carrier, a cloud host running somebody else's crawler, or a corporate
 * security proxy that a thousand unrelated companies route their traffic
 * through. Showing any of those as "the company that read your pricing page" is
 * the failure that destroys trust in the whole feature, and it destroys it the
 * first time it happens.
 *
 * Only `business`, `education` and `government` are ever allowed to surface a
 * company name. Everything else is not-identifiable, however confident the
 * underlying signal looked.
 */
export type ConnectionType =
  | 'business'
  | 'education'
  | 'government'
  | 'isp'
  | 'mobile'
  | 'hosting'
  | 'proxy'
  | 'unknown';

/** The three types that may ever be shown as an identified organisation. */
export const IDENTIFIABLE: readonly ConnectionType[] = ['business', 'education', 'government'];

// ─── Evidence ────────────────────────────────────────────────────────────────

/**
 * Where a domain candidate came from. The name matters as much as the value:
 * every resolution carries its methods so a person looking at a surprising
 * result can see what convinced the machine.
 */
export type SignalMethod =
  /** A PTR record on the address itself. The strongest domain signal there is. */
  | 'reverse_dns'
  /** The IP-intelligence provider naming a company outright. */
  | 'ip_intel_company'
  /** A domain invented from an organisation name. Deliberately weak. */
  | 'org_name_guess'
  /** The organisation that registered the address block, per RDAP. */
  | 'rdap_registrant';

export type DomainVote = { method: SignalMethod; domain: string };

/** What an IP-intelligence provider gives back, normalised across providers. */
export type IpIntel = {
  /** The ASN's organisation name, e.g. "AS15169 Google LLC". */
  org: string | null;
  asn: string | null;
  hostname: string | null;
  city: string | null;
  country: string | null;
  /** Only on paid tiers. An explicit "this is infrastructure" flag. */
  privacy: 'hosting' | 'vpn' | 'proxy' | 'tor' | null;
  /** The provider's own coarse classification, where it offers one. */
  asnType: 'isp' | 'hosting' | 'education' | 'government' | 'business' | null;
  /** A direct company hit, with its own domain. The best thing a provider gives. */
  companyName: string | null;
  companyDomain: string | null;
};

/** What the registry says about the block this address sits in. */
export type RdapInfo = {
  org: string | null;
  handle: string | null;
  /** Number of addresses in the allocation. Small means dedicated. */
  blockSize: number | null;
};

/**
 * One address, resolved.
 *
 * `reasons` is not decoration. Every resolution has to be able to say why it
 * did or did not identify somebody, both because that is how the thresholds get
 * debugged and because a salesperson who cannot see the reasoning will either
 * trust the output completely or not at all, and both are wrong.
 */
export type Resolution = {
  ip: string;
  /** True only when the gate passed AND the confidence policy was satisfied. */
  identified: boolean;
  connectionType: ConnectionType;
  companyName: string | null;
  domain: string | null;
  /** 0 to 1. Meaningless unless `identified`. */
  confidence: number;
  methods: SignalMethod[];
  reasons: string[];
  city: string | null;
  country: string | null;
  asn: string | null;
  asnOrg: string | null;
  hostname: string | null;
  blockSize: number | null;
};

// ─── Firmographics ───────────────────────────────────────────────────────────

/**
 * What a company publishes about itself, read from its own homepage.
 *
 * Employee count and revenue are absent on purpose. A private company does not
 * publish them, and a guess dressed as a fact is worse than an empty field.
 * They arrive only from the paid path, and only when somebody asked for them.
 */
export type Firmographics = {
  domain: string;
  name: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  linkedin: string | null;
  foundedYear: string | null;
  /** Frameworks, analytics and hosting fingerprinted out of the page source. */
  tech: string[];
  logoUrl: string | null;
  /** Only for the few visitors who are public filers. Usually null, correctly. */
  industry: string | null;
  registryId: string | null;
  /** Named on the company's own team page, and only when a real title was found. */
  people: { name: string; title: string }[];
};

/** The part that costs money, and only ever after somebody clicked. */
export type PaidFirmographics = {
  employeeBand: string | null;
  employees: number | null;
  revenue: number | null;
  industry: string | null;
  /** Who to talk to. Title, name, and a link if the provider had one. */
  committee: { name: string; title: string; linkedin: string | null }[];
};

// ─── People ──────────────────────────────────────────────────────────────────

/**
 * A person, resolved. Never invented: every field here traces to a login, a
 * form submission, a webhook, or a provider that was asked a direct question.
 */
export type PersonMatch = {
  fullName: string | null;
  email: string | null;
  title: string | null;
  company: string | null;
  linkedin: string | null;
  confidence: number;
  method: 'first_party' | 'provider' | 'coop';
};

/** Why somebody stayed anonymous. Recorded rather than shrugged at. */
export type PersonResult =
  | { resolved: true; person: PersonMatch }
  | { resolved: false; reason: string };

// ─── Intent ──────────────────────────────────────────────────────────────────

export type FunnelStage = 'awareness' | 'interest' | 'consideration' | 'decision';

export type IntentScore = {
  /** 0 to 100, one decimal. */
  score: number;
  stage: FunnelStage;
  /** What contributed, and how much. A score nobody can question is a score
   *  nobody acts on. */
  factors: { label: string; points: number }[];
};

// ─── Rows, as the dashboard reads them ───────────────────────────────────────

export type VisitorViewRow = {
  id: number;
  occurred_at: string;
  occurred_on: string;
  weekday: string;
  visitor_id: string;
  session_id: string;
  is_new_visitor: boolean;
  page_url: string;
  page_title: string | null;
  referrer: string | null;
  referrer_host: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  landing_page: string | null;
  pages_in_session: number;
  time_on_page_s: number;
  engaged_time_s: number;
  max_scroll_pct: number;
  total_clicks: number;
  cta_clicks: string | null;
  video: string | null;
  form_stage: 'open' | 'started' | 'submitted' | null;
  search_terms: string | null;
  rage_clicks: number;
  lcp_ms: number;
  cls: number;
  inp_ms: number;
  viewport: string | null;
  screen: string | null;
  language: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  is_bot: boolean;
  ip: string | null;
  events: unknown;
};

export type PageViewRow = {
  id: number;
  occurred_at: string;
  occurred_on: string;
  weekday: string;
  email: string | null;
  page_title: string | null;
  page_url: string;
  seconds: number;
  ip: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  visitor_id: string | null;
};

export type VisitorIdentityRow = {
  id: number;
  identified_at: string;
  visitor_id: string;
  full_name: string | null;
  email: string | null;
  company: string | null;
  title: string | null;
  source: string;
};

export type IdentityNodeRow = {
  id: number;
  kind: 'visitor_id' | 'email' | 'email_sha256' | 'crm_id' | 'ip' | 'device' | 'person';
  value: string;
  attrs: Record<string, unknown>;
  first_seen: string;
  last_seen: string;
};

export type IdentityEdgeRow = {
  id: number;
  src_id: number;
  dst_id: number;
  kind: 'deterministic' | 'co_occurrence';
  confidence: number;
  source: string | null;
  first_seen: string;
  last_seen: string;
  observations: number;
};
