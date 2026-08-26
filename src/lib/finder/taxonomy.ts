/**
 * What a job title means: how senior, and which part of the business.
 *
 * Pure functions, no API calls and no model. Used by the grid and by the chat,
 * so the two cannot come to different conclusions about whether a Chief Revenue
 * Officer counts as marketing.
 *
 * ── Why any of this is derived rather than read ────────────────────────────
 *
 * Apollo's own `seniority` and `departments` fields come only from paid
 * enrichment, and the free search returns neither. It does return the job title,
 * which already carries both answers. Reading them off the title is free,
 * deterministic, and uses the exact taxonomy the chat answers questions with.
 *
 * Anything derived here is kept under distinct `*_from_title` keys and is never
 * written into Apollo's own fields, so nothing this file infers is ever
 * displayed or exported as something Apollo asserted.
 */

/** Abbreviations expanded so "CMO" and "Chief Marketing Officer" compare equal. */
const TITLE_ALIASES: Readonly<Record<string, string>> = {
  ceo: 'chief executive officer',
  cfo: 'chief financial officer',
  cmo: 'chief marketing officer',
  cto: 'chief technology officer',
  coo: 'chief operating officer',
  cio: 'chief information officer',
  cro: 'chief revenue officer',
  chro: 'chief human resources officer',
  cpo: 'chief product officer',
  ciso: 'chief information security officer',
  vp: 'vice president',
  svp: 'senior vice president',
  evp: 'executive vice president',
  avp: 'assistant vice president',
  hr: 'human resources',
  'svp.': 'senior vice president',
};

/** Filler that carries no role meaning and would make unrelated titles look alike. */
const TITLE_FILLER = new Set([
  'of',
  'the',
  'and',
  'for',
  'a',
  'an',
  'at',
  'global',
  'senior',
  'sr',
  'jr',
]);

/** Comparison tokens for a job title, with abbreviations expanded. */
export function titleTokens(title: string | null | undefined): Set<string> {
  const t = String(title ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');

  const words: string[] = [];
  for (const w of t.split(/\s+/)) {
    if (!w) continue;
    words.push(...(TITLE_ALIASES[w] ?? w).split(' '));
  }
  return new Set(words.filter((w) => w && !TITLE_FILLER.has(w)));
}

/**
 * Does this person actually hold (close to) one of the requested titles?
 *
 * Apollo's people search runs with `include_similar_titles` on, which is good
 * for recall but means asking for a CMO can return a Marketing Manager.
 * Presenting that person as the CMO would state something Apollo never said, so
 * the match is verified here in code rather than trusted to a prompt.
 *
 * A request matches when **every meaningful word** of the requested title is
 * present in the person's actual title. So "chief marketing officer" matches
 * "Chief Marketing Officer (CMO)" and "Global CMO", and does not match
 * "Marketing Manager".
 */
export function titleMatches(
  personTitle: string | null | undefined,
  requested: readonly string[] | null | undefined,
): boolean {
  const have = titleTokens(personTitle);
  if (have.size === 0) return false;

  for (const wantRaw of requested ?? []) {
    const want = titleTokens(wantRaw);
    if (want.size > 0 && [...want].every((w) => have.has(w))) return true;
  }
  return false;
}

// ─── Seniority ───────────────────────────────────────────────────────────────

/** Most senior first. The index into this is the sort key. */
export const SENIORITY_ORDER = [
  'owner',
  'founder',
  'c_suite',
  'partner',
  'vp',
  'head',
  'director',
  'manager',
  'senior',
  'entry',
  'intern',
] as const;

export type Seniority = (typeof SENIORITY_ORDER)[number];

export const SENIORITY_LABELS: Readonly<Record<Seniority, string>> = {
  owner: 'Owner',
  founder: 'Founder',
  c_suite: 'C-suite',
  partner: 'Partner',
  vp: 'VP',
  head: 'Head of function',
  director: 'Director',
  manager: 'Manager',
  senior: 'Senior',
  entry: 'Entry level',
  intern: 'Intern',
};

/**
 * Reading a level off a title, in seniority order so the first match wins.
 *
 * The third element is tokens that **disqualify** a row even when its own tokens
 * matched, and it is load-bearing: `titleTokens` expands "vp" into "vice
 * president", so every VP carried the c_suite token "president" and — c_suite
 * being checked first — every VP ranked as C-suite. That put a VP of Sales level
 * with the CEO in the ordering of who to contact, and would have printed
 * "C-suite" under their name in the grid.
 */
const TITLE_SENIORITY: readonly (readonly [Seniority, readonly string[], readonly string[]])[] = [
  ['owner', ['owner', 'proprietor'], []],
  ['founder', ['founder', 'cofounder'], []],
  ['c_suite', ['chief', 'chairman', 'chairperson', 'president'], ['vice']],
  ['partner', ['partner'], []],
  ['vp', ['vice'], []],
  ['head', ['head'], []],
  ['director', ['director'], []],
  ['manager', ['manager', 'lead', 'supervisor'], []],
];

/** A person-shaped thing with the two fields seniority can be read from. */
export type RankablePerson = {
  seniority?: string | null;
  title?: string | null;
  departments?: readonly string[] | null;
  subdepartments?: readonly string[] | null;
};

/**
 * Sort key: 0 is the most senior, and anything unplaceable sorts last.
 *
 * Apollo's own seniority string wins when it has one, because it is an assertion
 * rather than an inference. Otherwise the title is read.
 */
export function seniorityRank(p: RankablePerson | null | undefined): number {
  const raw = String(p?.seniority ?? '')
    .trim()
    .toLowerCase();
  const direct = SENIORITY_ORDER.indexOf(raw as Seniority);
  if (direct !== -1) return direct;

  const have = titleTokens(p?.title);
  for (const [level, tokens, blockers] of TITLE_SENIORITY) {
    const hit = tokens.some((t) => have.has(t));
    const blocked = blockers.some((b) => have.has(b));
    if (hit && !blocked) return SENIORITY_ORDER.indexOf(level);
  }
  return SENIORITY_ORDER.length;
}

// ─── Functions ───────────────────────────────────────────────────────────────

/**
 * Which part of the business a title belongs to.
 *
 * Asking for a CFO and being handed six unrelated senior people is not an
 * answer, it is a list of strangers: nobody who wants the finance lead has any
 * use for the VP of Engineering. So when the requested title is not on file, the
 * fall back is scoped to the SAME function, and a person is only offered if
 * their own title positively places them in it.
 *
 * The token lists are deliberately narrow. A title matching nothing is
 * classified as nothing and is therefore never offered as a same-function
 * contact, which is the safe direction to fail: **a missing name is a smaller
 * error than a wrong one.**
 *
 * Each entry: key, human label, the tokens that place a title in it, and the
 * canonical titles to search Apollo with.
 */
export const FUNCTIONS: readonly (readonly [
  string,
  string,
  readonly string[],
  readonly string[],
])[] = [
  [
    'finance',
    'finance',
    ['financial', 'finance', 'accounting', 'accountant', 'controller', 'treasurer', 'treasury', 'audit', 'auditor', 'tax', 'fpa', 'payroll', 'bookkeeping', 'bookkeeper', 'investor'],
    ['CFO', 'Chief Financial Officer', 'VP Finance', 'Head of Finance', 'Finance Director', 'Financial Controller', 'Chief Accounting Officer', 'VP Accounting', 'Head of Accounting', 'Treasurer', 'Finance Manager'],
  ],
  [
    'marketing',
    'marketing',
    ['marketing', 'brand', 'demand', 'growth', 'communications', 'pr', 'advertising', 'content', 'seo', 'campaigns'],
    // The last two are searched here because a revenue leader counts as
    // marketing (see LEADER_CROSSOVERS). Without them the crossover would be a
    // rule with nothing to apply to: Apollo would never surface the CRO at all.
    ['CMO', 'Chief Marketing Officer', 'VP Marketing', 'Head of Marketing', 'Marketing Director', 'VP Brand', 'Head of Growth', 'Head of Demand Generation', 'VP Communications', 'Marketing Manager', 'Chief Revenue Officer', 'VP Revenue'],
  ],
  [
    'sales',
    'sales',
    ['sales', 'revenue', 'commercial', 'account', 'accounts', 'business', 'bd', 'partnerships', 'channel'],
    ['CRO', 'Chief Revenue Officer', 'VP Sales', 'Head of Sales', 'Sales Director', 'Chief Commercial Officer', 'VP Business Development', 'Head of Partnerships', 'Sales Manager'],
  ],
  [
    'technology',
    'engineering and technology',
    ['technology', 'technical', 'engineering', 'engineer', 'software', 'development', 'developer', 'architect', 'infrastructure', 'devops', 'platform', 'it'],
    ['CTO', 'Chief Technology Officer', 'VP Engineering', 'Head of Engineering', 'Engineering Director', 'Chief Information Officer', 'VP Technology', 'Head of IT', 'Engineering Manager'],
  ],
  [
    'product',
    'product',
    ['product', 'ux', 'design', 'designer', 'research'],
    ['CPO', 'Chief Product Officer', 'VP Product', 'Head of Product', 'Product Director', 'Head of Design', 'Product Manager'],
  ],
  [
    'data',
    'data and analytics',
    ['data', 'analytics', 'analyst', 'science', 'scientist', 'intelligence', 'insights', 'bi'],
    ['Chief Data Officer', 'VP Data', 'Head of Data', 'Head of Analytics', 'Director of Analytics', 'Chief Analytics Officer', 'Data Manager'],
  ],
  [
    'security',
    'security',
    ['security', 'infosec', 'cybersecurity', 'ciso', 'privacy', 'risk'],
    ['CISO', 'Chief Information Security Officer', 'VP Security', 'Head of Security', 'Director of Security', 'Chief Risk Officer'],
  ],
  [
    'hr',
    'people and HR',
    ['human', 'resources', 'people', 'talent', 'recruiting', 'recruitment', 'hiring', 'culture', 'learning', 'compensation'],
    ['CHRO', 'Chief Human Resources Officer', 'Chief People Officer', 'VP Human Resources', 'Head of People', 'HR Director', 'Head of Talent', 'HR Manager'],
  ],
  [
    'legal',
    'legal',
    ['legal', 'counsel', 'compliance', 'regulatory', 'attorney', 'paralegal', 'governance'],
    ['General Counsel', 'Chief Legal Officer', 'VP Legal', 'Head of Legal', 'Chief Compliance Officer', 'Legal Director'],
  ],
  [
    'operations',
    'operations',
    ['operations', 'operating', 'operational', 'ops', 'supply', 'chain', 'logistics', 'procurement', 'sourcing', 'manufacturing', 'quality', 'facilities'],
    ['COO', 'Chief Operating Officer', 'VP Operations', 'Head of Operations', 'Operations Director', 'Chief Supply Chain Officer', 'Head of Procurement', 'Operations Manager'],
  ],
  [
    'customer',
    'customer success and support',
    ['customer', 'client', 'success', 'support', 'service', 'experience', 'care', 'retention'],
    ['Chief Customer Officer', 'VP Customer Success', 'Head of Customer Success', 'VP Customer Experience', 'Head of Support', 'Customer Success Manager'],
  ],
  [
    'medical',
    'medical and clinical',
    ['medical', 'clinical', 'physician', 'nursing', 'nurse', 'health', 'pharmacy', 'pharmacist', 'care', 'patient'],
    ['Chief Medical Officer', 'Chief Nursing Officer', 'VP Clinical', 'Head of Clinical Operations', 'Medical Director', 'Chief Clinical Officer'],
  ],
  [
    'executive',
    'the executive team',
    ['executive', 'president', 'chairman', 'chairperson', 'founder', 'owner', 'proprietor', 'partner', 'principal', 'managing', 'general', 'gm', 'strategy', 'corporate'],
    ['CEO', 'Chief Executive Officer', 'President', 'Founder', 'Owner', 'Managing Director', 'General Manager', 'Chief of Staff', 'Chief Strategy Officer'],
  ],
];

/**
 * Apollo's own department strings mapped onto the same keys.
 *
 * A second, independent signal: a title this code cannot classify may still be
 * placeable by the department Apollo filed the person under.
 */
const DEPARTMENT_FUNCTIONS: Readonly<Record<string, string>> = {
  finance: 'finance',
  accounting: 'finance',
  master_finance: 'finance',
  marketing: 'marketing',
  master_marketing: 'marketing',
  sales: 'sales',
  master_sales: 'sales',
  business_development: 'sales',
  engineering: 'technology',
  information_technology: 'technology',
  master_engineering_technical: 'technology',
  master_information_technology: 'technology',
  product_management: 'product',
  design: 'product',
  data_science: 'data',
  business_intelligence: 'data',
  information_security: 'security',
  human_resources: 'hr',
  master_human_resources: 'hr',
  recruiting: 'hr',
  legal: 'legal',
  master_legal: 'legal',
  compliance: 'legal',
  operations: 'operations',
  master_operations: 'operations',
  support: 'customer',
  customer_service: 'customer',
  customer_success: 'customer',
  medical_health: 'medical',
  master_medical_health: 'medical',
  c_suite: 'executive',
  executive: 'executive',
};

/**
 * `[token, extra function, lowest seniority that counts]`.
 *
 * A revenue **leader** usually owns marketing as well as sales, so a CMO
 * question should be offered the CRO when no CMO is on file. Their team should
 * not be: a Revenue Operations Manager is a sales-side role, and offering one as
 * the closest marketing contact is exactly the substitution this scoping exists
 * to prevent. "Head of Revenue" is the lowest rung that counts, because below
 * that the title describes a specialism rather than ownership of the org.
 *
 * One-directional on purpose. That a CRO's remit usually includes marketing
 * makes a CRO a reasonable answer to a marketing question; it does not make a
 * marketing head a reasonable answer to a revenue one.
 */
const LEADER_CROSSOVERS: readonly (readonly [string, string, Seniority])[] = [
  ['revenue', 'marketing', 'head'],
];

/**
 * Which business function(s) a job title belongs to. Empty when unclassifiable.
 *
 * More than one is normal and correct: "VP Finance & Operations" really does sit
 * in both, and somebody asking for either should be offered them.
 */
export function titleFunctions(title: string | null | undefined): Set<string> {
  const have = titleTokens(title);
  if (have.size === 0) return new Set();

  const found = new Set<string>();
  for (const [key, , tokens] of FUNCTIONS) {
    if (tokens.some((t) => have.has(t))) found.add(key);
  }

  for (const [token, extra, minLevel] of LEADER_CROSSOVERS) {
    if (have.has(token) && seniorityRank({ title }) <= SENIORITY_ORDER.indexOf(minLevel)) {
      found.add(extra);
    }
  }
  return found;
}

/**
 * A person's function(s): from their title, from Apollo's own department fields
 * where the plan returns them, and from their seniority.
 *
 * Anyone at C-suite level or above counts as being in "the executive team"
 * whatever their specialism, because that is the only honest way to answer a
 * question about the CEO — a Chief Creative Officer is a real alternative
 * contact when no CEO is on file, and no keyword list would have placed them
 * there. It does not loosen the functional cases: a CFO question asks for
 * finance, and being C-suite is not being in finance.
 */
export function personFunctions(p: RankablePerson | null | undefined): Set<string> {
  const found = titleFunctions(p?.title ?? '');

  for (const raw of [...(p?.departments ?? []), ...(p?.subdepartments ?? [])]) {
    const key = DEPARTMENT_FUNCTIONS[String(raw ?? '').trim().toLowerCase()];
    if (key) found.add(key);
  }

  if (seniorityRank(p) <= SENIORITY_ORDER.indexOf('c_suite')) found.add('executive');
  return found;
}

/** The function(s) a question was about, from the titles it asked for. */
export function requestedFunctions(titles: readonly string[] | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const t of titles ?? []) for (const k of titleFunctions(t)) out.add(k);
  return out;
}

/** "finance", or "finance and operations" for a title spanning two. */
export function functionLabel(keys: Iterable<string> | null | undefined): string {
  const wanted = new Set(keys ?? []);
  const labels = FUNCTIONS.filter(([key]) => wanted.has(key)).map(([, label]) => label);
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/** Canonical titles to search Apollo with, for these functions. */
export function functionSearchTitles(
  keys: Iterable<string> | null | undefined,
  cap = 24,
): string[] {
  const wanted = new Set(keys ?? []);
  const out: string[] = [];
  for (const [key, , , titles] of FUNCTIONS) if (wanted.has(key)) out.push(...titles);
  return [...new Set(out)].slice(0, cap);
}

// ─── Free derived fields for every grid row ──────────────────────────────────

export type DerivedRole = {
  seniority_from_title?: string;
  functions_from_title?: string[];
};

/**
 * The seniority and function a title implies, for display beside a person.
 *
 * Either key is omitted when the title does not place them, because a guess is
 * worth less here than an honest blank: the whole point of the pair is that a
 * reader can trust them.
 */
export function deriveRole(title: string | null | undefined): DerivedRole {
  const out: DerivedRole = {};
  const t = String(title ?? '').trim();
  if (!t) return out;

  const rank = seniorityRank({ title: t });
  if (rank < SENIORITY_ORDER.length) {
    const label = SENIORITY_LABELS[SENIORITY_ORDER[rank]];
    if (label) out.seniority_from_title = label;
  }

  /*
   * "executive" is dropped here alone. It exists in the taxonomy as a seniority
   * band worded for prose ("the most senior people we hold"), and printed as a
   * function chip it would both duplicate the seniority beside it and read as a
   * department nobody works in.
   */
  const funcs = titleFunctions(t);
  funcs.delete('executive');
  if (funcs.size > 0) {
    // Ordered by FUNCTIONS rather than by set iteration, so one title always
    // renders its functions in the same order.
    out.functions_from_title = FUNCTIONS.filter(([key]) => funcs.has(key)).map(([, label]) => label);
  }
  return out;
}

// ─── Seniority words a model produced ────────────────────────────────────────

/**
 * Apollo's nine values. **Closed and case-sensitive**, measured against a live
 * account with `person_titles=["chief marketing officer"]`:
 *
 *     ["c_suite"]                68,174 people
 *     ["C_Suite"]                     0
 *     ["C-Suite"]                     0
 *     ["executive"]                   0
 *     ["c_suite", "executive"]   68,174
 *
 * So one bad value in a list is skipped, but an **all-bad** list returns
 * nothing — which is exactly what a model produces when it writes "executive" or
 * "C-Suite" for "the executives at Acme". A question could come back "nobody
 * matches" having never actually asked Apollo anything.
 */
export const APOLLO_SENIORITIES = [
  'owner',
  'founder',
  'c_suite',
  'vp',
  'director',
  'manager',
  'senior',
  'entry',
  'intern',
] as const;

/**
 * What a model writes, mapped onto what Apollo calls it.
 *
 * Only unambiguous renamings. A word that could mean two levels is dropped
 * rather than guessed at, because inventing a level is how a question about
 * founders comes back full of middle managers.
 */
const SENIORITY_ALIASES: Readonly<Record<string, string>> = {
  csuite: 'c_suite',
  cxo: 'c_suite',
  clevel: 'c_suite',
  executive: 'c_suite',
  executives: 'c_suite',
  chief: 'c_suite',
  cofounder: 'founder',
  coowner: 'owner',
  proprietor: 'owner',
  vicepresident: 'vp',
  vps: 'vp',
  svp: 'vp',
  evp: 'vp',
  avp: 'vp',
  directors: 'director',
  managers: 'manager',
  management: 'manager',
  individualcontributor: 'senior',
  ic: 'senior',
  junior: 'entry',
  entrylevel: 'entry',
  graduate: 'entry',
  internship: 'intern',
  interns: 'intern',
  founders: 'founder',
  owners: 'owner',
};

/**
 * `[kept, dropped]` for the seniority words a parsed question produced.
 *
 * Case and punctuation are normalised first, so "C-Suite" becomes `c_suite`
 * rather than being thrown away. Anything still unrecognised is dropped **and
 * handed back**, because a filter Apollo cannot read is not a narrower search,
 * it is an empty one, and the reader is owed the difference. That matters most
 * when the answer is empty: it is what separates nobody matching from that
 * filter never having been asked for.
 */
export function cleanSeniorities(
  values: readonly unknown[] | null | undefined,
): [string[], string[]] {
  const kept: string[] = [];
  const dropped: string[] = [];
  const collapsed = new Map(APOLLO_SENIORITIES.map((s) => [s.replace(/_/g, ''), s]));

  for (const raw of values ?? []) {
    if (typeof raw !== 'string' || !raw.trim()) continue;

    const lower = raw.trim().toLowerCase();
    const key = lower.replace(/[^a-z0-9]+/g, '');
    const exact = lower.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');

    let value = '';
    if ((APOLLO_SENIORITIES as readonly string[]).includes(exact)) value = exact;
    else if (collapsed.has(key)) value = collapsed.get(key) ?? '';
    else value = SENIORITY_ALIASES[key] ?? '';

    if (value) {
      if (!kept.includes(value)) kept.push(value);
    } else if (!dropped.includes(raw.trim())) {
      dropped.push(raw.trim());
    }
  }
  return [kept, dropped];
}

// ─── Masked names ────────────────────────────────────────────────────────────

/**
 * `\p{L}*` rather than a word-character class, so accented given names survive.
 */
const MASKED_TOKEN = /^(\p{L}*)\*+\S*$/u;

/**
 * A withheld surname made printable: "Vivek Sh***a" becomes "Vivek Sh."
 *
 * Apollo returns a withheld surname as an asterisk mask depending on plan. The
 * chat renderer treats `**...**` as bold, so two masked names in one sentence
 * made the text *between* them bold — "Vivek Sh**a, Meghana Ka**i" rendered with
 * "a, Meghana Ka" in bold, which reads as a rendering bug and drew the eye to
 * nothing.
 *
 * Escaping the asterisks would keep them on screen, and "Sh***a" is not a name
 * anybody can use. Abbreviating says the same thing in a form a reader already
 * understands and carries no markup. **No letters are invented**, only the
 * masked token is touched, and the row keeps its `name_masked` flag so the
 * answer can still explain why the surname is short and offer to buy it.
 *
 * A token whose mask leaves no real letters at all is dropped rather than
 * printed as a bare full stop.
 */
export function displayName(name: string | null | undefined): string {
  const raw = String(name ?? '').trim();
  if (!raw.includes('*')) return raw;

  const out: string[] = [];
  for (const token of raw.split(/\s+/)) {
    if (!token.includes('*')) {
      out.push(token);
      continue;
    }
    const m = MASKED_TOKEN.exec(token);
    const prefix = (m ? m[1] : token.split('*')[0]).replace(/^[.,;:]+|[.,;:]+$/g, '');
    if (prefix) out.push(`${prefix}.`);
  }
  return out.join(' ').trim();
}
