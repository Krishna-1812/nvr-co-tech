/**
 * Every filter the panel exposes, written down once.
 *
 * ── Why this is a table and not markup ─────────────────────────────────────
 *
 * There are about forty filters across two tabs. Written as JSX they became
 * forty places to forget something — a label, a tooltip, a key, the conversion
 * on the way out — and the two tabs drifted, so the same Apollo parameter got
 * two different names depending on which one you were looking at. Adding a
 * filter is now one entry here.
 *
 * ── Why so many of them carry a `note` ─────────────────────────────────────
 *
 * Because Apollo lies about what several of these do, and a control that
 * silently means something other than what it says is the exact failure this
 * whole tool is built around. Industry is not a filter, it is a keyword match
 * over a company's name and tags, re-checked here afterwards. Company size only
 * filters in buckets. Two of the four documented email statuses change nothing
 * at all on this account and are therefore not offered. Every one of those facts
 * is on the control that carries it, not in a wiki nobody opens.
 */

export type Entity = 'people' | 'companies';

export type FieldKind =
  | 'text'
  | 'csv'
  | 'number'
  | 'date'
  | 'check'
  | 'chips'
  | 'select'
  | 'combo';

export type Field = {
  /** The key this writes into the panel's own value bag. */
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  /** What Apollo really does with it. Shown on the control. */
  note?: string;
  /** For `combo`: which vocabulary the picker offers. */
  vocab?: 'industry' | 'technology' | 'location' | 'naics' | 'sic';
  /** For `chips` and `select`: `[value, label]`. */
  options?: readonly (readonly [string, string])[];
  /** Rendered side by side with the next field, as a range. */
  pair?: 'start' | 'end';
  width?: 'full' | 'half' | 'auto';
};

export type Group = {
  title: string;
  /** Behind "More filters", collapsed by default. */
  advanced?: boolean;
  fields: readonly Field[];
};

const SENIORITIES = [
  ['owner', 'Owner'],
  ['founder', 'Founder'],
  ['c_suite', 'C-Suite'],
  ['partner', 'Partner'],
  ['vp', 'VP'],
  ['head', 'Head'],
  ['director', 'Director'],
  ['manager', 'Manager'],
  ['senior', 'Senior'],
  ['entry', 'Entry'],
  ['intern', 'Intern'],
] as const;

/**
 * The eleven Apollo ranks, in seniority order rather than alphabetical.
 *
 * This offered nine for a long time: "partner" and "head" were missing, so a
 * search for the partners at a firm, or the heads of a function, could not be
 * expressed at all — even though the ranking table has held all eleven since
 * the tool shipped.
 */
export { SENIORITIES };

const SIZES = [
  ['', 'Any company size'],
  ['1,10', '1-10 employees'],
  ['11,50', '11-50 employees'],
  ['51,200', '51-200 employees'],
  ['201,500', '201-500 employees'],
  ['501,1000', '501-1,000 employees'],
  ['1001,5000', '1,001-5,000 employees'],
  ['5001,', '5,001+ employees'],
] as const;

const DEPARTMENTS = [
  ['', 'Dept. headcount (any)'],
  ['c_suite', 'C-Suite'],
  ['master_marketing', 'Marketing'],
  ['master_sales', 'Sales'],
  ['master_engineering_technical', 'Engineering'],
  ['product_management', 'Product'],
  ['design', 'Design'],
  ['master_finance', 'Finance'],
  ['master_human_resources', 'HR'],
  ['master_information_technology', 'IT'],
  ['master_operations', 'Operations'],
  ['master_legal', 'Legal'],
  ['medical_health', 'Medical / Health'],
  ['education', 'Education'],
  ['consulting', 'Consulting'],
] as const;

const GROWTH_WINDOWS = [
  ['', 'Growth window'],
  ['3', 'Past 3 months'],
  ['6', 'Past 6 months'],
  ['12', 'Past 12 months'],
  ['24', 'Past 24 months'],
] as const;

const HQ_NOTE =
  "The company's head office. Apollo matches this loosely, so it is checked again here against the city, state and country on each company, and rows outside it are removed. Type any level: United States, Texas, or Austin, Texas.";

const SIZE_NOTE =
  "Apollo can only filter by fixed buckets, so it returns companies outside the range you pick. The exact range is enforced here against each company's own headcount, and rows outside it are removed.";

const SEGMENT_NOTE =
  "Apollo matches this against the company's keyword tags and its NAME, not against a verified classification, so it widens a search rather than narrowing it. Use Industry for a check against what Apollo says a company actually is.";

const TECH_NOTE =
  'Sent to Apollo in its own uid spelling (Google Analytics becomes google_analytics), then checked again against the technologies Apollo lists for each company. Type the ordinary product name.';

const INDUSTRY_NOTE =
  'Apollo has no industry filter. The words you pick are sent as a recall net and then enforced here against Apollo’s own classification, so rows outside the industry are removed and counted.';

const growthFields: readonly Field[] = [
  { key: 'headcount_growth_min', label: 'Min growth %', kind: 'number', pair: 'start' },
  { key: 'headcount_growth_max', label: 'Max growth %', kind: 'number', pair: 'end' },
  {
    key: 'headcount_growth_months',
    label: 'Growth window',
    kind: 'select',
    options: GROWTH_WINDOWS,
  },
];

const deptFields: readonly Field[] = [
  { key: 'dept_name', label: 'Department', kind: 'select', options: DEPARTMENTS },
  { key: 'dept_min', label: 'Min', kind: 'number', pair: 'start' },
  { key: 'dept_max', label: 'Max', kind: 'number', pair: 'end' },
];

const techFields = (prefix: '' = '') => [
  {
    key: `technologies${prefix}`,
    label: 'Uses ANY of',
    kind: 'combo' as const,
    vocab: 'technology' as const,
    placeholder: 'Uses ANY of, type to search',
    note: TECH_NOTE,
  },
  {
    key: 'technologies_all',
    label: 'Uses ALL of',
    kind: 'combo' as const,
    vocab: 'technology' as const,
    placeholder: 'Uses ALL of, type to search',
  },
  {
    key: 'exclude_technologies',
    label: 'Does NOT use',
    kind: 'combo' as const,
    vocab: 'technology' as const,
    placeholder: 'Does NOT use, type to search',
  },
];

const hiringFields: readonly Field[] = [
  {
    key: 'job_titles',
    label: 'Hiring for titles',
    kind: 'csv',
    placeholder: 'Hiring for title(s), e.g. sales manager',
    note: 'A signal about the COMPANY, not about a person: these are the roles it has open, not the roles its people hold.',
  },
  {
    key: 'job_locations',
    label: 'Hiring in',
    kind: 'combo',
    vocab: 'location',
    placeholder: 'Hiring in, type to search',
  },
  { key: 'num_jobs_min', label: 'Min jobs', kind: 'number', pair: 'start' },
  { key: 'num_jobs_max', label: 'Max jobs', kind: 'number', pair: 'end' },
  { key: 'job_posted_after', label: 'Jobs posted after', kind: 'date' },
];

export const PEOPLE_GROUPS: readonly Group[] = [
  {
    title: 'Role & company',
    fields: [
      {
        key: 'titles',
        label: 'Job titles',
        kind: 'csv',
        placeholder: 'Job title(s), comma separated, e.g. CMO, VP Marketing',
        width: 'full',
      },
      {
        key: 'include_similar_titles',
        label: 'Include similar titles',
        kind: 'check',
        note: 'Apollo widens a title search to similar roles. Leave it on for recall; turn it off and every title is checked again here, so a Marketing Manager can never be returned for a CMO.',
      },
      {
        key: 'company_domains',
        label: 'At company',
        kind: 'text',
        placeholder: 'At company, e.g. acme.com or Acme Inc',
        note: 'A domain goes straight through. A name is resolved to a company first, which costs a credit, and you are asked to pick if it matches more than one.',
      },
    ],
  },
  {
    title: 'Seniority',
    fields: [{ key: 'seniorities', label: 'Seniority', kind: 'chips', options: SENIORITIES }],
  },
  {
    title: 'Location & company size',
    fields: [
      {
        key: 'person_locations',
        label: 'Person location',
        kind: 'combo',
        vocab: 'location',
        placeholder: 'Person location, type to search',
        note: "Where the PERSON lives. The free search does not return anyone's city, so unlike Industry and employer HQ this one cannot be re-checked here without enriching each person. Independent of the HQ filter, and both apply together.",
      },
      {
        key: 'company_locations',
        label: 'Employer HQ',
        kind: 'combo',
        vocab: 'location',
        placeholder: 'Employer HQ, type to search',
        note: HQ_NOTE,
      },
      { key: 'employee_range', label: 'Company size', kind: 'select', options: SIZES, note: SIZE_NOTE },
    ],
  },
  {
    title: 'Verification & keywords',
    fields: [
      {
        key: 'email_status',
        label: 'Email status',
        kind: 'chips',
        options: [
          ['verified', 'Verified email'],
          ['unavailable', 'No email available'],
        ],
        note: "Apollo documents four statuses. Measured on a 79,421-person baseline, only these two filter anything: 'unverified' and 'likely to engage' each returned the untouched 79,421, so they are not offered. A chip that visibly turns on and changes nothing is the exact mismatch this tool exists not to have.",
      },
      {
        key: 'keywords',
        label: 'Keywords',
        kind: 'text',
        placeholder: 'Keywords',
        note: 'A literal text match. It is ANDed with everything else, so a phrase nobody’s profile actually contains empties the search rather than narrowing it.',
      },
    ],
  },
  {
    title: 'Person',
    advanced: true,
    fields: [
      { key: 'yoe_min', label: 'Min yrs exp', kind: 'number', pair: 'start' },
      { key: 'yoe_max', label: 'Max yrs exp', kind: 'number', pair: 'end' },
      {
        key: 'tenure_min',
        label: 'Min months in role',
        kind: 'number',
        pair: 'start',
        note: 'Asked for in months, because that is how anybody thinks about a tenure. Apollo’s own filter is in days, so it is converted on the way out.',
      },
      { key: 'tenure_max', label: 'Max months in role', kind: 'number', pair: 'end' },
      {
        key: 'linkedin_urls',
        label: 'LinkedIn URLs',
        kind: 'csv',
        placeholder: 'LinkedIn profile URL(s), comma separated',
        width: 'full',
      },
    ],
  },
  {
    title: 'Employer firmographics',
    advanced: true,
    fields: [
      {
        key: 'industries',
        label: 'Industry',
        kind: 'combo',
        vocab: 'industry',
        placeholder: "Industry, type to search Apollo's list",
        note: INDUSTRY_NOTE,
      },
      {
        key: 'market_segments',
        label: 'Market segments',
        kind: 'csv',
        placeholder: 'Market segments, e.g. B2B, Enterprise',
        note: SEGMENT_NOTE,
      },
      { key: 'revenue_min', label: 'Min revenue $', kind: 'number', pair: 'start' },
      { key: 'revenue_max', label: 'Max revenue $', kind: 'number', pair: 'end' },
      { key: 'founded_min', label: 'Founded after', kind: 'number', pair: 'start' },
      { key: 'founded_max', label: 'Founded before', kind: 'number', pair: 'end' },
      {
        key: 'naics_codes',
        label: 'NAICS',
        kind: 'combo',
        vocab: 'naics',
        placeholder: 'Employer NAICS, code or industry',
      },
      {
        key: 'sic_codes',
        label: 'SIC',
        kind: 'combo',
        vocab: 'sic',
        placeholder: 'Employer SIC, code or industry',
      },
      ...deptFields,
      ...growthFields,
    ],
  },
  { title: 'Technologies', advanced: true, fields: techFields() },
  { title: 'Hiring signals', advanced: true, fields: hiringFields },
];

export const COMPANY_GROUPS: readonly Group[] = [
  {
    title: 'Company',
    fields: [
      { key: 'name', label: 'Company name', kind: 'text', placeholder: 'Company name, e.g. Acme' },
      {
        key: 'domains',
        label: 'Domain',
        kind: 'csv',
        placeholder: 'Domain, e.g. acme.com',
        note: "Apollo treats a domain as a relevance hint rather than a rule, so it is enforced here. A company Apollo returned no domain for is kept and flagged rather than dropped: 'Apollo didn't say' is not 'Apollo said no'.",
      },
    ],
  },
  {
    title: 'Location & size',
    fields: [
      {
        key: 'locations',
        label: 'HQ location',
        kind: 'combo',
        vocab: 'location',
        placeholder: 'HQ location, type to search',
        note: HQ_NOTE,
      },
      {
        key: 'exclude_locations',
        label: 'Exclude HQ location',
        kind: 'combo',
        vocab: 'location',
        placeholder: 'Exclude HQ location',
      },
      { key: 'employee_range', label: 'Company size', kind: 'select', options: SIZES, note: SIZE_NOTE },
    ],
  },
  {
    title: 'Industry & keywords',
    fields: [
      {
        key: 'industries',
        label: 'Industry',
        kind: 'combo',
        vocab: 'industry',
        placeholder: "Industry, type to search Apollo's list",
        note: INDUSTRY_NOTE,
      },
      {
        key: 'exclude_keywords',
        label: 'Exclude keywords',
        kind: 'csv',
        placeholder: 'Exclude keywords',
        note: 'Apollo has no text-exclusion parameter at all, so this one is applied here, after the results come back. Rows it removes are counted like every other check.',
      },
    ],
  },
  {
    title: 'Firmographics',
    advanced: true,
    fields: [
      {
        key: 'market_segments',
        label: 'Market segments',
        kind: 'csv',
        placeholder: 'Market segments, e.g. B2B, Enterprise',
        note: SEGMENT_NOTE,
      },
      {
        key: 'include_unknown_founded_year',
        label: 'Include unknown founding year',
        kind: 'check',
      },
      { key: 'revenue_min', label: 'Min revenue $', kind: 'number', pair: 'start' },
      { key: 'revenue_max', label: 'Max revenue $', kind: 'number', pair: 'end' },
      { key: 'founded_min', label: 'Founded after', kind: 'number', pair: 'start' },
      { key: 'founded_max', label: 'Founded before', kind: 'number', pair: 'end' },
      {
        key: 'naics_codes',
        label: 'NAICS',
        kind: 'combo',
        vocab: 'naics',
        placeholder: 'NAICS, code or industry',
      },
      {
        key: 'exclude_naics_codes',
        label: 'Exclude NAICS',
        kind: 'combo',
        vocab: 'naics',
        placeholder: 'Exclude NAICS code',
      },
      {
        key: 'sic_codes',
        label: 'SIC',
        kind: 'combo',
        vocab: 'sic',
        placeholder: 'SIC, code or industry',
      },
      {
        key: 'exclude_sic_codes',
        label: 'Exclude SIC',
        kind: 'combo',
        vocab: 'sic',
        placeholder: 'Exclude SIC code',
      },
      ...deptFields,
      ...growthFields,
    ],
  },
  {
    title: 'Funding',
    advanced: true,
    fields: [
      {
        key: 'total_funding_min',
        label: 'Min total $',
        kind: 'number',
        pair: 'start',
        note: 'Apollo rejects a bound above 2,147,483,647 with a hard error rather than clamping it, so anything larger is clamped here and the result says so.',
      },
      { key: 'total_funding_max', label: 'Max total $', kind: 'number', pair: 'end' },
      { key: 'latest_funding_min', label: 'Min last round $', kind: 'number', pair: 'start' },
      { key: 'latest_funding_max', label: 'Max last round $', kind: 'number', pair: 'end' },
      { key: 'funded_after', label: 'Last round after', kind: 'date', pair: 'start' },
      { key: 'funded_before', label: 'and before', kind: 'date', pair: 'end' },
    ],
  },
  { title: 'Technologies', advanced: true, fields: techFields() },
  { title: 'Hiring signals', advanced: true, fields: hiringFields },
];

export function groupsFor(entity: Entity): readonly Group[] {
  return entity === 'companies' ? COMPANY_GROUPS : PEOPLE_GROUPS;
}

/** Every field either tab exposes, flattened, for lookups by key. */
export const FIELD_BY_KEY: ReadonlyMap<string, Field> = new Map(
  [...PEOPLE_GROUPS, ...COMPANY_GROUPS].flatMap((g) => g.fields).map((f) => [f.key, f]),
);

/** The panel's own value bag. Converted to Apollo filters by `toFilters`. */
export type PanelValues = Record<string, unknown>;

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function list(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  return String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The panel's values as the filter object the search route expects.
 *
 * Three conversions happen here and nowhere else, which is the point of having
 * one function: the size band expands into a numeric range, the department
 * controls collapse into one object, and months in role become the days Apollo
 * actually filters on.
 */
export function toFilters(entity: Entity, values: PanelValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const groups = groupsFor(entity);

  for (const group of groups) {
    for (const field of group.fields) {
      const raw = values[field.key];
      if (raw === undefined || raw === null || raw === '') continue;

      switch (field.kind) {
        case 'number': {
          const n = num(raw);
          if (n !== null) out[field.key] = n;
          break;
        }
        case 'csv':
        case 'chips':
        case 'combo': {
          const values_ = list(raw);
          if (values_.length > 0) out[field.key] = values_;
          break;
        }
        case 'check': {
          if (raw === true || raw === false) out[field.key] = raw;
          break;
        }
        default:
          out[field.key] = raw;
      }
    }
  }

  // The size band. An open-ended top bucket ("5001,") has no maximum, which is
  // a real request rather than an unbounded one, so only the floor is sent.
  const band = String(values.employee_range ?? '');
  delete out.employee_range;
  if (band) {
    const [lo, hi] = band.split(',');
    if (lo) out.employee_min = Number(lo);
    if (hi) out.employee_max = Number(hi);
  }

  // Department headcount: three controls, one Apollo parameter.
  const dept = String(values.dept_name ?? '');
  const deptMin = num(values.dept_min);
  const deptMax = num(values.dept_max);
  delete out.dept_name;
  delete out.dept_min;
  delete out.dept_max;
  if (dept && (deptMin !== null || deptMax !== null)) {
    const range: Record<string, number> = {};
    if (deptMin !== null) range.min = deptMin;
    if (deptMax !== null) range.max = deptMax;
    out.department_counts = { [dept]: range };
  }

  // Months in role to days, matching Apollo's own documented conversion.
  const tenureMin = num(values.tenure_min);
  const tenureMax = num(values.tenure_max);
  delete out.tenure_min;
  delete out.tenure_max;
  if (tenureMin !== null) out.days_in_title_min = Math.round(tenureMin * 30);
  if (tenureMax !== null) out.days_in_title_max = Math.round(tenureMax * 30);

  // The growth window means nothing without a bound to apply it to, and sending
  // it alone is a parameter Apollo silently ignores.
  if (out.headcount_growth_min == null && out.headcount_growth_max == null) {
    delete out.headcount_growth_months;
  }

  // A single "at company" box, which the server resolves if it is a name.
  if (entity === 'people' && typeof values.company_domains === 'string') {
    const typed = values.company_domains.trim();
    if (typed) out.company_domains = [typed];
    else delete out.company_domains;
  }

  return out;
}

/**
 * How many filters are set inside the collapsed half of the panel.
 *
 * Without this the long tail is genuinely invisible: the advanced panel is
 * collapsed by default, so a revenue floor set last week is still narrowing
 * today's search with nothing on screen to say so.
 */
export function advancedCount(entity: Entity, values: PanelValues): number {
  let n = 0;
  for (const group of groupsFor(entity)) {
    if (!group.advanced) continue;
    for (const field of group.fields) {
      const v = values[field.key];
      if (v === undefined || v === null || v === '' || v === false) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      n += 1;
    }
  }
  return n;
}
