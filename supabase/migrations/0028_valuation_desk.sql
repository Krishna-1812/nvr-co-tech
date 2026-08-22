-- ============================================================================
-- Valuation Desk — comparable companies, and the multiples they imply
--
-- The third tool. You name a company or an industry; it finds the companies that
-- are economically comparable, shows what each of them earns and what the market
-- pays for it, and reconciles that into a value you can defend to somebody who
-- will argue with you about it.
--
-- Two things about the shape of this migration are unlike everything before it,
-- and both are deliberate.
--
-- ── One: half of these tables are NOT tenant data ──────────────────────────
--
-- Every table added since 0012 has been scoped to one organization. Five of the
-- nine here are not, and must not be: `companies`, `company_financials`,
-- `company_quotes`, `funding_rounds` and `source_documents` hold public record —
-- what NSE and BSE publish, what the MCA files, what a company announced in a
-- press release. It is the same for every reader because it is the same in the
-- world.
--
-- Scoping it per organization would mean paying for the same MCA document once
-- per customer. A private company's financials cost real money to fetch (about
-- ₹330 through a document API, ₹100 direct from the MCA portal), and the whole
-- economics of this tool is that a company is paid for ONCE, ever, and every
-- reader afterwards is free. The cache is the asset. Ten tenants each holding
-- their own copy is ten times the cost for identical data.
--
-- 0012's header called `chapters_read using (auth.uid() is not null)` a bug, and
-- it was — chapters are one client's list of their own offices. These tables get
-- the same policy on purpose, because they are the opposite kind of thing. The
-- line that keeps that honest is below and it is absolute:
--
--   NOTHING A CUSTOMER TYPED, CHOSE, OR CONCLUDED MAY BE STORED IN THE SHARED
--   TABLES. Not a note, not a flag, not a preferred peer. If it came from a
--   person rather than from a public source, it belongs on peer_set_members or
--   valuations, which are org-scoped. There is no column here to put it in, and
--   there must never be one.
--
-- ── Two: a figure with no source is not a figure ──────────────────────────
--
-- Every number in the shared tables carries where it came from, when it was
-- true, and what document says so. That is not diligence for its own sake: the
-- audience is chartered accountants, the output is signed, and the first
-- question anybody asks about a multiple is "from what?".
--
-- So `revenue` is nullable and an unknown revenue is null — never zero, never a
-- guess. The application shows an empty cell. This is the same rule the visitor
-- resolver already follows when it refuses to name a company it could not
-- observe: a low fill rate is the instrument working, and the urge to widen it
-- until the screen looks full is the one change that makes every row worthless.
--
-- `funding_rounds.disclosure` takes that further and admits only 'disclosed' or
-- 'reported'. There is deliberately no 'estimated'. A modelled valuation is
-- somebody's opinion, and once one is in the table nobody downstream can tell it
-- apart from a number a founder actually announced.
-- ============================================================================

-- Peer discovery is nearest-neighbour over business descriptions, because
-- industry codes are too coarse to build a peer set from: one "software
-- publishers" code holds cybersecurity, gaming and enterprise SaaS, and excludes
-- genuinely comparable businesses that were filed under something else. The
-- codes are still stored — they are how a reviewer expects to be able to check —
-- but they are not what does the finding.
create extension if not exists vector;


-- ═══════════════════════════════════════════════════════════════════════════
-- PART ONE — the shared registry
-- ═══════════════════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------------------
-- companies — a company somebody is valuing
--
-- Three things in this database now say "company" and they are not the same
-- thing, so to save the next person the confusion:
--
--   organizations       a tenant. A customer of this platform.
--   company_enrichment  a visitor's employer, inferred from an IP address (0010).
--   companies           a subject of research, drawn from public record.
--
-- Nothing here is created by a user filling in a form. Rows arrive from
-- data.gov.in's MCA master data, from the exchanges, or from a document pull,
-- always through upsert_company() below.
-- ---------------------------------------------------------------------------
create table companies (
  id uuid primary key default gen_random_uuid(),

  -- ── Identity ───────────────────────────────────────────────────────────────
  -- Each is unique where present and null where it does not apply: an unlisted
  -- Indian company has a CIN and no symbol, a US filer has neither.
  cin text,                 -- India, MCA. The only identifier that is free and complete.
  isin text,
  nse_symbol text,
  bse_code text,
  cik text,                 -- US, SEC EDGAR.
  lei text,                 -- GLEIF. Free, global, and the only cross-border join we get.

  name text not null,
  legal_name text,
  country text not null default 'IN' check (length(country) = 2),

  -- ── What kind of company ───────────────────────────────────────────────────
  -- 'listed' and 'unlisted' answer a different question from each other than
  -- people expect: a listed company's market pays a visible price for its
  -- earnings, an unlisted one's does not. That is the whole reason a comparable
  -- set exists, so it is a column and not a derived guess.
  listing_status text not null default 'unknown'
    check (listing_status in ('listed', 'unlisted', 'delisted', 'unknown')),
  incorporated_on date,
  registered_state text,

  -- ── How it is classified ───────────────────────────────────────────────────
  -- Kept because a reviewer will ask, not because peer selection uses them.
  nic_code text,            -- India's own classification, from the MCA filing.
  sic_code text,
  industry text,
  sector text,

  -- ── What it says it does ───────────────────────────────────────────────────
  -- The text peer discovery actually runs on: an Item 1 business description, an
  -- annual report's principal-activities note, a DRHP's business section. Stored
  -- verbatim so the embedding can be rebuilt when the model changes.
  business_description text,
  embedding vector(1536),
  embedding_model text,

  -- ── Provenance ─────────────────────────────────────────────────────────────
  source text not null,
  source_url text,
  first_seen timestamptz not null default now(),
  last_refreshed timestamptz not null default now()
);

comment on table companies is
  'A company somebody is valuing. Public record, shared across every tenant, '
  'never written to directly — see upsert_company(). Not organizations (a '
  'tenant) and not company_enrichment (a visitor''s employer).';

comment on column companies.embedding is
  'Nearest-neighbour peer discovery over business_description. Industry codes '
  'are stored alongside because a reviewer expects them, not because they are '
  'good enough to build a peer set from.';

create unique index companies_cin_key on companies (cin) where cin is not null;
create unique index companies_isin_key on companies (isin) where isin is not null;
create unique index companies_nse_key on companies (nse_symbol) where nse_symbol is not null;
create unique index companies_bse_key on companies (bse_code) where bse_code is not null;
create unique index companies_cik_key on companies (cik) where cik is not null;
create unique index companies_lei_key on companies (lei) where lei is not null;

create index companies_name_idx on companies (lower(name));
create index companies_country_status_idx on companies (country, listing_status);

-- Cosine, because the embeddings are normalised and what matters is what a
-- company does, not how much it writes about it.
create index companies_embedding_idx on companies
  using hnsw (embedding vector_cosine_ops);


-- ---------------------------------------------------------------------------
-- company_financials — one filed period, one basis, one source
--
-- The uniqueness rule is the interesting part: (company, period_end, basis,
-- source). The same year genuinely arrives twice — NSE publishes a quarterly
-- result and the MCA holds the AOC-4 for the same twelve months, and they will
-- not agree to the rupee. Both are kept, with their source, and the engine picks
-- by a stated precedence rather than one silently overwriting the other.
--
-- `basis` exists because mixing standalone and consolidated figures inside one
-- peer set is the most common way a comparables table quietly becomes wrong, and
-- it cannot be spotted afterwards from the numbers alone.
-- ---------------------------------------------------------------------------
create table company_financials (
  id bigserial primary key,
  company_id uuid not null references companies(id) on delete cascade,

  period_start date,
  period_end date not null,
  -- This project's own fiscal vocabulary: '26-27'. See src/lib/fiscal.ts.
  fy_label text,
  months integer check (months is null or months between 1 and 18),
  basis text not null check (basis in ('standalone', 'consolidated')),

  -- ── The figures ────────────────────────────────────────────────────────────
  -- Every one nullable. A null is "we do not know", and there is no other way to
  -- say that: a zero is a claim that the company earned nothing.
  --
  -- numeric(20,2) rather than the (14,2) used for voucher amounts. A voucher is
  -- one payment; a market capitalisation in rupees runs to fourteen digits
  -- before the decimal point and (14,2) would have silently overflowed on the
  -- larger half of the Nifty.
  revenue numeric(20, 2),
  other_income numeric(20, 2),
  ebitda numeric(20, 2),
  ebit numeric(20, 2),
  pat numeric(20, 2),
  total_assets numeric(20, 2),
  net_worth numeric(20, 2),
  total_debt numeric(20, 2),
  cash numeric(20, 2),
  employees integer check (employees is null or employees >= 0),

  currency text not null default 'INR' check (length(currency) = 3),
  is_audited boolean,

  -- ── Provenance ─────────────────────────────────────────────────────────────
  source text not null,
  source_url text,
  source_document_id bigint,
  as_of date,
  fetched_at timestamptz not null default now(),

  unique (company_id, period_end, basis, source)
);

comment on table company_financials is
  'One reporting period for one company on one basis from one source. All '
  'figures nullable: null is "not known" and zero is a claim. The same period '
  'from two sources is two rows on purpose.';

create index company_financials_company_idx
  on company_financials (company_id, period_end desc);


-- ---------------------------------------------------------------------------
-- company_quotes — what the market was paying, and when
--
-- A separate table from financials because it moves on a different clock. A
-- filing is true for a year; a market capitalisation is true for a day, and a
-- multiple built from today's price over last year's revenue has to be able to
-- say both dates.
-- ---------------------------------------------------------------------------
create table company_quotes (
  id bigserial primary key,
  company_id uuid not null references companies(id) on delete cascade,

  as_of date not null,
  close_price numeric(20, 4),
  shares_outstanding numeric(20, 2),
  market_cap numeric(20, 2),
  currency text not null default 'INR' check (length(currency) = 3),

  source text not null,
  source_url text,
  fetched_at timestamptz not null default now(),

  unique (company_id, as_of, source)
);

create index company_quotes_company_idx on company_quotes (company_id, as_of desc);


-- ---------------------------------------------------------------------------
-- funding_rounds — the private-market half, and the reason this tool exists
--
-- India is one of very few places where the number people actually want can be
-- computed rather than modelled. A private limited company here files real
-- financials with the MCA and those filings are public, so when a round is
-- announced you can put a disclosed post-money valuation over a filed revenue
-- and get a multiple that is arithmetic. Everywhere else, one half of that
-- fraction does not exist and the databases that sell it are estimating.
--
-- Which is why `post_money_to_revenue` is a generated column. It follows
-- net_total and grand_total on vouchers (0001) for the same reason those are:
-- the number that gets quoted must not be able to drift from the two numbers it
-- is made of. And it is null unless both halves are present, so the tool can
-- only ever show a multiple it can show the workings for.
--
-- `revenue_period` is stored beside the revenue because staleness is the whole
-- risk here. A March-2026 revenue under a January-2027 valuation is a fair
-- comparison; the same revenue under a January-2029 valuation is not, and only
-- the reader can judge which — so they are shown the dates.
-- ---------------------------------------------------------------------------
create table funding_rounds (
  id bigserial primary key,
  company_id uuid not null references companies(id) on delete cascade,

  round_label text not null,          -- 'Series B', 'Pre-IPO', 'Seed'
  announced_on date not null,
  amount_raised numeric(20, 2),
  pre_money numeric(20, 2),
  post_money numeric(20, 2),
  currency text not null default 'INR' check (length(currency) = 3),
  lead_investor text,
  investors text[],

  -- ── The denominator ───────────────────────────────────────────────────────
  revenue numeric(20, 2),
  revenue_period date,
  revenue_basis text check (revenue_basis is null or revenue_basis in ('standalone', 'consolidated')),
  revenue_source text,

  -- ── The multiple, which cannot disagree with its inputs ───────────────────
  post_money_to_revenue numeric generated always as (
    case
      when post_money is not null and revenue is not null and revenue > 0
      then post_money / revenue
    end
  ) stored,

  -- ── How much this is worth believing ──────────────────────────────────────
  -- 'disclosed'  the company or an investor stated it
  -- 'reported'   credible press, attributed
  --
  -- There is no 'estimated', on purpose. A modelled valuation is an opinion, and
  -- the moment one is in this table nobody downstream can distinguish it from a
  -- number somebody actually announced. If a valuation was never stated, this
  -- tool does not know it.
  disclosure text not null check (disclosure in ('disclosed', 'reported')),
  source text not null,
  source_url text,
  fetched_at timestamptz not null default now(),

  -- Two announcements of the same round from two outlets are one row. A genuine
  -- extension of a round is a different label.
  unique (company_id, round_label, announced_on)
);

comment on table funding_rounds is
  'Announced private rounds. post_money_to_revenue is generated, so a quoted '
  'multiple can never drift from the valuation and revenue it was built from, '
  'and is null unless both are known.';

comment on column funding_rounds.disclosure is
  'disclosed = the company or an investor said so; reported = attributed press. '
  'There is deliberately no estimated value — see the table comment.';

create index funding_rounds_company_idx on funding_rounds (company_id, announced_on desc);
create index funding_rounds_multiple_idx on funding_rounds (announced_on desc)
  where post_money_to_revenue is not null;


-- ---------------------------------------------------------------------------
-- source_documents — what was read, not a copy of it
--
-- There is no file column here and no storage path, and that is a decision
-- rather than an omission. The FACTS in a public filing are facts and this
-- database records them; the DOCUMENT is somebody else's artefact, and a
-- platform that hands one customer a PDF it bought while researching another
-- customer's question is redistributing it. So this table records that a
-- document exists, what it is, and where the reader can fetch it themselves.
--
-- It is also the audit trail the product is sold on. Every figure in
-- company_financials points at a row here, so "where did this come from" has an
-- answer that is a document and a date rather than a vendor's name.
-- ---------------------------------------------------------------------------
create table source_documents (
  id bigserial primary key,
  company_id uuid not null references companies(id) on delete cascade,

  doc_type text not null,             -- 'AOC-4', 'MGT-7', 'DRHP', 'NSE-RESULT', '10-K'
  filed_on date,
  period_end date,
  provider text not null,             -- who we got it through
  external_id text,                   -- their id for it, so a refetch is possible
  url text,                           -- where a reader can get it themselves
  retrieved_at timestamptz not null default now(),

  unique (provider, external_id)
);

comment on table source_documents is
  'A record that a filing was read, and where to read it. Deliberately holds no '
  'copy of the document: the facts are recorded, the artefact is not '
  'redistributed.';

create index source_documents_company_idx on source_documents (company_id, filed_on desc);

alter table company_financials
  add constraint company_financials_source_document_fk
  foreign key (source_document_id) references source_documents(id) on delete set null;


-- ═══════════════════════════════════════════════════════════════════════════
-- PART TWO — the work product, which is tenant data
-- ═══════════════════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------------------
-- peer_sets — a judgement, recorded
--
-- Fairvaluation's own pitch puts it well and it is worth repeating here as the
-- design brief: a comparable set is not a screen output, it is a judgement call
-- reviewers will challenge. So this table is not a query result cache. It is the
-- record of what a named person decided, on a date, and why — down to why the
-- companies they left out were left out.
--
-- Append-only, for the reason reconciliations are (0008): a peer set is a
-- statement about what was comparable on a given day. Rebuilding it with a
-- different screen is a different statement and gets its own row.
--
-- Unlike reconciliations, it is visible to the whole organization rather than
-- only its author. A reconciliation is working papers; a valuation is an
-- engagement deliverable that a partner signs, and the entire product promise is
-- that a reviewer can see the reasoning. Hiding it from the reviewer would
-- defeat the thing being built.
-- ---------------------------------------------------------------------------
create table peer_sets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete cascade,

  -- ── What is being valued ──────────────────────────────────────────────────
  -- subject_company_id when the target is in the registry. subject_name always,
  -- because the target is frequently an unlisted client that no public source
  -- has ever heard of — which is the normal case for this audience.
  subject_company_id uuid references companies(id) on delete restrict,
  subject_name text not null,
  subject_description text,

  -- ── How the set was arrived at ────────────────────────────────────────────
  as_of date not null,
  basis text not null default 'consolidated' check (basis in ('standalone', 'consolidated')),
  screen jsonb not null default '{}'::jsonb,
  method_note text,

  created_at timestamptz not null default now()
);

comment on table peer_sets is
  'One recorded judgement about what is comparable to a subject, on a date. '
  'Append-only; visible to the whole organization because the point of it is to '
  'be reviewed.';

comment on column peer_sets.screen is
  'The filters actually applied — size band, geography, growth, margin. Stored '
  'so the set can be explained and reproduced, not so it can be re-run.';

create index peer_sets_org_idx on peer_sets (organization_id, created_at desc);
create index peer_sets_subject_idx on peer_sets (subject_company_id)
  where subject_company_id is not null;


-- ---------------------------------------------------------------------------
-- peer_set_members — the comparables table, frozen
--
-- The figures are copied onto this row rather than joined at read time, and that
-- is the point of the table. A comparables schedule is evidence: it has to keep
-- saying in two years' time what it said when the conclusion was signed, and a
-- join to live market data would quietly restate it every time somebody opened
-- it. Same reasoning as the voucher totals being fixed at submit.
--
-- The multiples are generated columns over those frozen figures, so the number a
-- reviewer challenges is arithmetic on numbers in the same row. Note that a
-- generated column may not reference another generated column, which is why the
-- enterprise-value expression is written out in full three times rather than
-- computed once — that repetition is a Postgres constraint, not an oversight.
--
-- Ratios are plain `numeric` with no precision: a distressed company can print a
-- multiple of 4,000 and a fixed scale would have thrown rather than shown it.
--
-- Multiples are currency-agnostic because numerator and denominator are always
-- the same currency in the same row, so a US comp and an Indian comp can sit in
-- one median without conversion. The absolute figures cannot, and the engine is
-- what converts those for display.
-- ---------------------------------------------------------------------------
create table peer_set_members (
  id bigserial primary key,
  peer_set_id uuid not null references peer_sets(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  company_id uuid not null references companies(id) on delete restrict,

  -- ── Whether it counted, and why ───────────────────────────────────────────
  -- An excluded peer must say why it was excluded. A peer set whose rejects are
  -- invisible is the one a reviewer cannot check, and "we looked at it and ruled
  -- it out for this reason" is worth more to them than a shorter list.
  included boolean not null default true,
  rationale text not null,
  decided_by text not null check (decided_by in ('screen', 'model', 'person')),
  excluded_reason text,
  constraint peer_member_exclusion_explained
    check (included or excluded_reason is not null),

  -- ── The figures, as at the peer set's date ────────────────────────────────
  revenue numeric(20, 2),
  ebitda numeric(20, 2),
  ebit numeric(20, 2),
  pat numeric(20, 2),
  total_debt numeric(20, 2),
  cash numeric(20, 2),
  market_cap numeric(20, 2),
  currency text not null default 'INR' check (length(currency) = 3),

  -- Which rows these were taken from, so every cell traces to a filing.
  financials_id bigint references company_financials(id) on delete set null,
  quote_id bigint references company_quotes(id) on delete set null,
  period_end date,

  -- ── The multiples ─────────────────────────────────────────────────────────
  enterprise_value numeric(20, 2) generated always as (
    case
      when market_cap is not null
      then market_cap + coalesce(total_debt, 0) - coalesce(cash, 0)
    end
  ) stored,

  ev_to_revenue numeric generated always as (
    case
      when market_cap is not null and revenue is not null and revenue > 0
      then (market_cap + coalesce(total_debt, 0) - coalesce(cash, 0)) / revenue
    end
  ) stored,

  ev_to_ebitda numeric generated always as (
    case
      when market_cap is not null and ebitda is not null and ebitda > 0
      then (market_cap + coalesce(total_debt, 0) - coalesce(cash, 0)) / ebitda
    end
  ) stored,

  price_to_earnings numeric generated always as (
    case
      when market_cap is not null and pat is not null and pat > 0
      then market_cap / pat
    end
  ) stored,

  created_at timestamptz not null default now(),

  unique (peer_set_id, company_id)
);

comment on table peer_set_members is
  'One comparable, frozen as at the peer set''s date. Figures are copied rather '
  'than joined so the schedule keeps saying what it said when it was signed. '
  'Multiples are generated from the figures in this row.';

comment on column peer_set_members.excluded_reason is
  'Required when included is false. A peer set whose rejects are invisible is '
  'the one a reviewer cannot check.';

create index peer_set_members_set_idx on peer_set_members (peer_set_id, included);
create index peer_set_members_company_idx on peer_set_members (company_id);


-- ---------------------------------------------------------------------------
-- valuations — the conclusion, and how it was reached
--
-- Kept whole as jsonb for the reason a reconciliation is (0008): it is written
-- once, read whole, and never queried across, and the shape it must survive in
-- is the shape the TypeScript engine produced. The columns beside it are what
-- the history list renders without pulling every stored run into memory.
--
-- What is NOT here: any column the engine could recompute. The concluded value
-- is stored because it was concluded, not because it is derivable — the methods
-- and weights that produced it are in the jsonb, and if a later version of the
-- engine would reconcile them differently then this row must keep saying what
-- was actually signed.
-- ---------------------------------------------------------------------------
create table valuations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete cascade,
  peer_set_id uuid references peer_sets(id) on delete restrict,

  subject_name text not null,
  as_of date not null,

  -- ── The conclusion ────────────────────────────────────────────────────────
  concluded_value numeric(20, 2),
  low_value numeric(20, 2),
  high_value numeric(20, 2),
  currency text not null default 'INR' check (length(currency) = 3),

  -- Minority/control and marketability change the answer by tens of percent and
  -- are the second thing a reviewer asks about after the peer set.
  valuation_basis text not null default 'minority_private'
    check (valuation_basis in ('minority_private', 'control_private', 'minority_listed', 'control_listed')),

  -- ── The working ───────────────────────────────────────────────────────────
  methods jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint valuation_range_ordered
    check (low_value is null or high_value is null or low_value <= high_value)
);

comment on table valuations is
  'One concluded valuation, append-only. Stores what was signed rather than '
  'what the current engine would recompute.';

comment on column valuations.methods is
  'Each method applied, its output, its weight and the assumptions behind it. '
  'The dispersion between methods is the thing a reviewer reads first.';

create index valuations_org_idx on valuations (organization_id, created_at desc);


-- ---------------------------------------------------------------------------
-- data_lookups — every paid fetch, and who caused it
--
-- Copied deliberately from enrichment_spend (0010), whose comment applies here
-- word for word: a rule about deliberate spending is only true if somebody can
-- check it afterwards. The difference is that this one has to answer a second
-- question too — WHICH TENANT to attribute the cost to — because a private
-- company lookup costs a few hundred rupees and one curious user can run up a
-- bill nobody notices until the wallet is empty.
--
-- `cache_hit` rows cost nothing and are recorded anyway. They are how you find
-- out whether the cache is actually paying for itself, which is the only
-- question that matters about this product's margins.
--
-- Nobody may update or delete a row here, including an owner of the organization
-- being billed. Same reasoning as voucher_audit: it is a record of something
-- that happened.
-- ---------------------------------------------------------------------------
create table data_lookups (
  id bigserial primary key,
  looked_up_at timestamptz not null default now(),

  organization_id uuid references organizations(id) on delete set null,
  actor_id uuid references profiles(id) on delete set null,
  actor_email text not null,

  provider text not null,
  kind text not null,                 -- 'company_unlock', 'financials', 'master', 'quote'
  subject text not null,              -- CIN, symbol, or CIK — whatever was asked for
  company_id uuid references companies(id) on delete set null,

  -- Paise, not rupees, because the providers bill to the paisa and a rounded
  -- ledger cannot be reconciled against their invoice.
  cost_paise integer not null default 0 check (cost_paise >= 0),
  cache_hit boolean not null default false,
  outcome text not null check (outcome in ('hit', 'miss', 'error')),
  note text,

  -- A cached read is free by definition. If these ever disagree, one of them is
  -- lying about the bill.
  constraint cache_hit_costs_nothing check (not cache_hit or cost_paise = 0)
);

comment on table data_lookups is
  'Every fetch against a paid provider, with the person and organization that '
  'caused it. Append-only. Cache hits are recorded at zero cost because the hit '
  'rate is the margin.';

create index data_lookups_org_idx on data_lookups (organization_id, looked_up_at desc);
create index data_lookups_billable_idx on data_lookups (looked_up_at desc)
  where cost_paise > 0;


-- ═══════════════════════════════════════════════════════════════════════════
-- Stamping and guarding organization_id
--
-- The same pattern as 0012, and for the same two reasons. First, the trigger
-- sets the column so no application code has to send it and none of it can
-- spoof one. Second — and this is the part that is easy to miss — a child row
-- must check that its PARENT belongs to the caller's organization. RLS hides
-- another tenant's peer set, but nothing stops an insert naming a UUID you
-- cannot see, and a foreign key does not care whose row it points at.
-- ═══════════════════════════════════════════════════════════════════════════

-- Used by peer_sets and valuations both. Named for what it does rather than for
-- the first table that needed it: it touches only organization_id, so any table
-- carrying that column can share it.
create or replace function stamp_valuation_desk_organization() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.organization_id := my_organization_id();
  if new.organization_id is null then
    raise exception 'You must belong to an organization to do this';
  end if;
  return new;
end $$;

create trigger peer_sets_stamp_org before insert on peer_sets
  for each row execute function stamp_valuation_desk_organization();

create trigger valuations_stamp_org before insert on valuations
  for each row execute function stamp_valuation_desk_organization();


create or replace function guard_peer_set_member_organization() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_set_org uuid;
begin
  new.organization_id := my_organization_id();
  if new.organization_id is null then
    raise exception 'You must belong to an organization to do this';
  end if;

  select organization_id into v_set_org from peer_sets where id = new.peer_set_id;
  if v_set_org is distinct from new.organization_id then
    raise exception 'That peer set does not belong to your organization';
  end if;

  return new;
end $$;

create trigger peer_set_members_guard_org before insert on peer_set_members
  for each row execute function guard_peer_set_member_organization();


create or replace function guard_valuation_peer_set() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_set_org uuid;
begin
  if new.peer_set_id is not null then
    select organization_id into v_set_org from peer_sets where id = new.peer_set_id;
    if v_set_org is distinct from new.organization_id then
      raise exception 'That peer set does not belong to your organization';
    end if;
  end if;
  return new;
end $$;

-- After the stamping trigger, which alphabetical order on the trigger name
-- happens to guarantee — `valuations_stamp_org` runs before `valuations_z_guard`.
-- Named deliberately rather than relying on luck.
create trigger valuations_z_guard_peer_set before insert on valuations
  for each row execute function guard_valuation_peer_set();


-- ═══════════════════════════════════════════════════════════════════════════
-- Row level security
-- ═══════════════════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------------------
-- The shared registry: readable by anybody signed in, writable by nobody.
--
-- There are no insert, update or delete policies on these five tables at all.
-- With RLS enabled and no policy for a command, that command is denied to
-- everyone — which is exactly the intent, and is stated here rather than left to
-- be inferred from a missing block. Every write goes through the SECURITY
-- DEFINER functions below, which decide for themselves what a row may contain.
--
-- That is the same shape as the analytics event tables in 0010, and it is what
-- makes a shared cache safe: a customer can read the registry but cannot put
-- anything into it, so no tenant can poison another tenant's comparables.
-- ---------------------------------------------------------------------------
alter table companies enable row level security;
alter table company_financials enable row level security;
alter table company_quotes enable row level security;
alter table funding_rounds enable row level security;
alter table source_documents enable row level security;

create policy companies_read on companies
  for select using (auth.uid() is not null);

create policy company_financials_read on company_financials
  for select using (auth.uid() is not null);

create policy company_quotes_read on company_quotes
  for select using (auth.uid() is not null);

create policy funding_rounds_read on funding_rounds
  for select using (auth.uid() is not null);

create policy source_documents_read on source_documents
  for select using (auth.uid() is not null);

revoke insert, update, delete on companies from authenticated;
revoke insert, update, delete on company_financials from authenticated;
revoke insert, update, delete on company_quotes from authenticated;
revoke insert, update, delete on funding_rounds from authenticated;
revoke insert, update, delete on source_documents from authenticated;


-- ---------------------------------------------------------------------------
-- The work product: your organization's, and append-only.
--
-- Read is org-wide rather than author-only, deliberately — see the peer_sets
-- header. Delete is author-only: throwing away somebody else's recorded
-- judgement is not a thing a colleague should be able to do quietly, and an
-- organization that needs it gone has an owner who can ask.
--
-- No update policies anywhere here. A peer set and a valuation are statements
-- about a date; editing one in place would make the audit trail a lie.
-- ---------------------------------------------------------------------------
alter table peer_sets enable row level security;
alter table peer_set_members enable row level security;
alter table valuations enable row level security;

create policy peer_sets_read on peer_sets
  for select using (organization_id = my_organization_id());

create policy peer_sets_insert on peer_sets
  for insert with check (created_by = auth.uid());

create policy peer_sets_delete_own on peer_sets
  for delete using (created_by = auth.uid() and organization_id = my_organization_id());

create policy peer_set_members_read on peer_set_members
  for select using (organization_id = my_organization_id());

create policy peer_set_members_insert on peer_set_members
  for insert with check (
    exists (
      select 1 from peer_sets s
      where s.id = peer_set_id and s.created_by = auth.uid()
    )
  );

create policy peer_set_members_delete on peer_set_members
  for delete using (
    exists (
      select 1 from peer_sets s
      where s.id = peer_set_id
        and s.created_by = auth.uid()
        and s.organization_id = my_organization_id()
    )
  );

create policy valuations_read on valuations
  for select using (organization_id = my_organization_id());

create policy valuations_insert on valuations
  for insert with check (created_by = auth.uid());

create policy valuations_delete_own on valuations
  for delete using (created_by = auth.uid() and organization_id = my_organization_id());

revoke update on peer_sets from authenticated;
revoke update on peer_set_members from authenticated;
revoke update on valuations from authenticated;


-- ---------------------------------------------------------------------------
-- The ledger: your organization may read its own bill, and change nothing.
--
-- No insert policy either — the write goes through record_data_lookup() below,
-- so the application cannot understate a cost by writing the row itself.
-- ---------------------------------------------------------------------------
alter table data_lookups enable row level security;

create policy data_lookups_read_own_org on data_lookups
  for select using (organization_id = my_organization_id());

revoke insert, update, delete on data_lookups from authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- Writing
--
-- One door per table, all SECURITY DEFINER, all taking a single jsonb payload
-- rather than twenty-odd arguments — the same shape 0010's writers settled on,
-- for the same reason: an adapter for a new provider maps its response to keys
-- and does not have to care what the positional signature looks like this month.
--
-- Each one reads the keys it knows about and ignores everything else, so a
-- provider that starts returning an extra field breaks nothing.
-- ═══════════════════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------------------
-- upsert_company — the only way a company enters the registry.
--
-- Matching is by identifier in order of how much each one is worth: CIN first
-- because in India it is free, complete and stable; then the exchange codes;
-- then CIK; then LEI. Name is never matched on. Two unrelated companies share a
-- name often enough that merging them would be a data-corruption event with no
-- way back, and "Acme Pvt Ltd" resolving to the wrong Acme is exactly how a
-- comparables table ends up with a peer nobody can explain.
--
-- Attributes merge rather than replace, so a cheap master-data pass that knows
-- only a name and a state cannot blank out a business description an expensive
-- document pull established earlier. Same rule as graph_node() in 0010.
-- ---------------------------------------------------------------------------
create or replace function upsert_company(p jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_name text := btrim(coalesce(p ->> 'name', ''));
begin
  if v_name = '' then
    raise exception 'A company needs a name';
  end if;

  -- Sequential rather than one OR'd query with a `limit 1`, and this matters:
  -- if a payload carries a CIN matching one row and a symbol matching another —
  -- which happens after a demerger, or when a provider has the wrong symbol
  -- against a name — an OR lets the planner pick whichever it reached first and
  -- silently merges two different companies. Falling through in priority order
  -- means the CIN wins every time, and the answer does not depend on a plan.
  if p ->> 'cin' is not null then
    select id into v_id from companies where cin = p ->> 'cin';
  end if;

  if v_id is null and p ->> 'nse_symbol' is not null then
    select id into v_id from companies where nse_symbol = p ->> 'nse_symbol';
  end if;

  if v_id is null and p ->> 'bse_code' is not null then
    select id into v_id from companies where bse_code = p ->> 'bse_code';
  end if;

  if v_id is null and p ->> 'isin' is not null then
    select id into v_id from companies where isin = p ->> 'isin';
  end if;

  if v_id is null and p ->> 'cik' is not null then
    select id into v_id from companies where cik = p ->> 'cik';
  end if;

  if v_id is null and p ->> 'lei' is not null then
    select id into v_id from companies where lei = p ->> 'lei';
  end if;

  if v_id is null then
    insert into companies (
      cin, isin, nse_symbol, bse_code, cik, lei,
      name, legal_name, country, listing_status,
      incorporated_on, registered_state,
      nic_code, sic_code, industry, sector,
      business_description, source, source_url
    ) values (
      p ->> 'cin', p ->> 'isin', p ->> 'nse_symbol', p ->> 'bse_code',
      p ->> 'cik', p ->> 'lei',
      v_name, p ->> 'legal_name',
      coalesce(p ->> 'country', 'IN'),
      coalesce(p ->> 'listing_status', 'unknown'),
      (p ->> 'incorporated_on')::date, p ->> 'registered_state',
      p ->> 'nic_code', p ->> 'sic_code', p ->> 'industry', p ->> 'sector',
      p ->> 'business_description',
      coalesce(p ->> 'source', 'unknown'), p ->> 'source_url'
    )
    returning id into v_id;

    return v_id;
  end if;

  update companies set
    cin                  = coalesce(cin, p ->> 'cin'),
    isin                 = coalesce(isin, p ->> 'isin'),
    nse_symbol           = coalesce(nse_symbol, p ->> 'nse_symbol'),
    bse_code             = coalesce(bse_code, p ->> 'bse_code'),
    cik                  = coalesce(cik, p ->> 'cik'),
    lei                  = coalesce(lei, p ->> 'lei'),
    legal_name           = coalesce(p ->> 'legal_name', legal_name),
    listing_status       = case
                             when p ->> 'listing_status' is null then listing_status
                             when p ->> 'listing_status' = 'unknown' then listing_status
                             else p ->> 'listing_status'
                           end,
    incorporated_on      = coalesce(incorporated_on, (p ->> 'incorporated_on')::date),
    registered_state     = coalesce(p ->> 'registered_state', registered_state),
    nic_code             = coalesce(p ->> 'nic_code', nic_code),
    sic_code             = coalesce(p ->> 'sic_code', sic_code),
    industry             = coalesce(p ->> 'industry', industry),
    sector               = coalesce(p ->> 'sector', sector),
    business_description = coalesce(p ->> 'business_description', business_description),
    source_url           = coalesce(p ->> 'source_url', source_url),
    last_refreshed       = now()
  where id = v_id;

  return v_id;
end $$;

comment on function upsert_company(jsonb) is
  'The only door into the shared registry. Matches on identifiers, never on '
  'name. Merges attributes so a cheap pass cannot blank what an expensive one '
  'established.';


-- ---------------------------------------------------------------------------
-- set_company_embedding — kept separate from upsert_company on purpose.
--
-- Embedding a description costs a model call, so it happens on its own schedule
-- and in its own batch. Recording the model alongside the vector is what makes a
-- re-embedding campaign possible: when the model changes, the rows to redo are
-- the ones whose embedding_model is not the current one.
-- ---------------------------------------------------------------------------
create or replace function set_company_embedding(
  p_company_id uuid,
  p_embedding vector(1536),
  p_model text
) returns void
language sql security definer set search_path = public as $$
  update companies
     set embedding = p_embedding,
         embedding_model = p_model,
         last_refreshed = now()
   where id = p_company_id;
$$;


-- ---------------------------------------------------------------------------
-- record_financials — one filed period.
--
-- On conflict the figures are replaced rather than merged, unlike
-- upsert_company. A restatement is the same source saying something different
-- about the same period, and the newer statement is the true one; merging would
-- leave a row that is half of each and matches no filing at all.
-- ---------------------------------------------------------------------------
create or replace function record_financials(p jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into company_financials (
    company_id, period_start, period_end, fy_label, months, basis,
    revenue, other_income, ebitda, ebit, pat,
    total_assets, net_worth, total_debt, cash, employees,
    currency, is_audited, source, source_url, source_document_id, as_of
  ) values (
    (p ->> 'company_id')::uuid,
    (p ->> 'period_start')::date,
    (p ->> 'period_end')::date,
    p ->> 'fy_label',
    (p ->> 'months')::integer,
    coalesce(p ->> 'basis', 'standalone'),
    (p ->> 'revenue')::numeric,
    (p ->> 'other_income')::numeric,
    (p ->> 'ebitda')::numeric,
    (p ->> 'ebit')::numeric,
    (p ->> 'pat')::numeric,
    (p ->> 'total_assets')::numeric,
    (p ->> 'net_worth')::numeric,
    (p ->> 'total_debt')::numeric,
    (p ->> 'cash')::numeric,
    (p ->> 'employees')::integer,
    coalesce(p ->> 'currency', 'INR'),
    (p ->> 'is_audited')::boolean,
    coalesce(p ->> 'source', 'unknown'),
    p ->> 'source_url',
    (p ->> 'source_document_id')::bigint,
    (p ->> 'as_of')::date
  )
  on conflict (company_id, period_end, basis, source) do update set
    period_start       = excluded.period_start,
    fy_label           = excluded.fy_label,
    months             = excluded.months,
    revenue            = excluded.revenue,
    other_income       = excluded.other_income,
    ebitda             = excluded.ebitda,
    ebit               = excluded.ebit,
    pat                = excluded.pat,
    total_assets       = excluded.total_assets,
    net_worth          = excluded.net_worth,
    total_debt         = excluded.total_debt,
    cash               = excluded.cash,
    employees          = excluded.employees,
    currency           = excluded.currency,
    is_audited         = excluded.is_audited,
    source_url         = excluded.source_url,
    source_document_id = coalesce(excluded.source_document_id, company_financials.source_document_id),
    as_of              = excluded.as_of,
    fetched_at         = now()
  returning id into v_id;

  return v_id;
end $$;


-- ---------------------------------------------------------------------------
-- record_quote — a market capitalisation on a date.
-- ---------------------------------------------------------------------------
create or replace function record_quote(p jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into company_quotes (
    company_id, as_of, close_price, shares_outstanding, market_cap,
    currency, source, source_url
  ) values (
    (p ->> 'company_id')::uuid,
    (p ->> 'as_of')::date,
    (p ->> 'close_price')::numeric,
    (p ->> 'shares_outstanding')::numeric,
    (p ->> 'market_cap')::numeric,
    coalesce(p ->> 'currency', 'INR'),
    coalesce(p ->> 'source', 'unknown'),
    p ->> 'source_url'
  )
  on conflict (company_id, as_of, source) do update set
    close_price        = excluded.close_price,
    shares_outstanding = excluded.shares_outstanding,
    market_cap         = excluded.market_cap,
    source_url         = excluded.source_url,
    fetched_at         = now()
  returning id into v_id;

  return v_id;
end $$;


-- ---------------------------------------------------------------------------
-- record_funding_round — an announced round.
--
-- Refuses a disclosure value other than the two the table allows, before the
-- constraint would, so the caller gets a message naming the rule rather than a
-- constraint violation naming a constraint. Same courtesy submit_voucher()
-- extends for its own required fields.
-- ---------------------------------------------------------------------------
create or replace function record_funding_round(p jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_disclosure text := coalesce(p ->> 'disclosure', '');
begin
  if v_disclosure not in ('disclosed', 'reported') then
    raise exception
      'A round must be disclosed by the company or reported with attribution. There is no estimated valuation in this table.';
  end if;

  insert into funding_rounds (
    company_id, round_label, announced_on,
    amount_raised, pre_money, post_money, currency,
    lead_investor, investors,
    revenue, revenue_period, revenue_basis, revenue_source,
    disclosure, source, source_url
  ) values (
    (p ->> 'company_id')::uuid,
    p ->> 'round_label',
    (p ->> 'announced_on')::date,
    (p ->> 'amount_raised')::numeric,
    (p ->> 'pre_money')::numeric,
    (p ->> 'post_money')::numeric,
    coalesce(p ->> 'currency', 'INR'),
    p ->> 'lead_investor',
    case
      when p -> 'investors' is null then null
      else array(select jsonb_array_elements_text(p -> 'investors'))
    end,
    (p ->> 'revenue')::numeric,
    (p ->> 'revenue_period')::date,
    p ->> 'revenue_basis',
    p ->> 'revenue_source',
    v_disclosure,
    coalesce(p ->> 'source', 'unknown'),
    p ->> 'source_url'
  )
  on conflict (company_id, round_label, announced_on) do update set
    amount_raised  = coalesce(excluded.amount_raised, funding_rounds.amount_raised),
    pre_money      = coalesce(excluded.pre_money, funding_rounds.pre_money),
    post_money     = coalesce(excluded.post_money, funding_rounds.post_money),
    lead_investor  = coalesce(excluded.lead_investor, funding_rounds.lead_investor),
    investors      = coalesce(excluded.investors, funding_rounds.investors),
    revenue        = coalesce(excluded.revenue, funding_rounds.revenue),
    revenue_period = coalesce(excluded.revenue_period, funding_rounds.revenue_period),
    revenue_basis  = coalesce(excluded.revenue_basis, funding_rounds.revenue_basis),
    revenue_source = coalesce(excluded.revenue_source, funding_rounds.revenue_source),
    -- A disclosed figure outranks a reported one and never the other way round.
    disclosure     = case
                       when funding_rounds.disclosure = 'disclosed' then 'disclosed'
                       else excluded.disclosure
                     end,
    source_url     = coalesce(excluded.source_url, funding_rounds.source_url),
    fetched_at     = now()
  returning id into v_id;

  return v_id;
end $$;


-- ---------------------------------------------------------------------------
-- record_source_document — that a filing was read, and where.
-- ---------------------------------------------------------------------------
create or replace function record_source_document(p jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into source_documents (
    company_id, doc_type, filed_on, period_end, provider, external_id, url
  ) values (
    (p ->> 'company_id')::uuid,
    p ->> 'doc_type',
    (p ->> 'filed_on')::date,
    (p ->> 'period_end')::date,
    coalesce(p ->> 'provider', 'unknown'),
    p ->> 'external_id',
    p ->> 'url'
  )
  on conflict (provider, external_id) do update set
    filed_on     = coalesce(excluded.filed_on, source_documents.filed_on),
    period_end   = coalesce(excluded.period_end, source_documents.period_end),
    url          = coalesce(excluded.url, source_documents.url),
    retrieved_at = now()
  returning id into v_id;

  return v_id;
end $$;


-- ---------------------------------------------------------------------------
-- record_data_lookup — the bill.
--
-- Takes the caller's own identity from the session rather than from the payload.
-- An application that can name whose budget a lookup came out of can also name
-- somebody else's, and the one thing this ledger has to be is unarguable.
--
-- Called on the cache-hit path too, with cost zero. The hit rate is what tells
-- you whether the shared registry is doing its job, and you cannot compute a
-- rate from only the misses.
-- ---------------------------------------------------------------------------
create or replace function record_data_lookup(p jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_email text;
  v_hit boolean := coalesce((p ->> 'cache_hit')::boolean, false);
  v_cost integer := coalesce((p ->> 'cost_paise')::integer, 0);
begin
  select email into v_email from profiles where id = auth.uid();
  if v_email is null then
    raise exception 'Only a signed-in person can cause a lookup';
  end if;

  if v_hit then
    v_cost := 0;
  end if;

  insert into data_lookups (
    organization_id, actor_id, actor_email,
    provider, kind, subject, company_id,
    cost_paise, cache_hit, outcome, note
  ) values (
    my_organization_id(), auth.uid(), v_email,
    coalesce(p ->> 'provider', 'unknown'),
    coalesce(p ->> 'kind', 'unknown'),
    coalesce(p ->> 'subject', ''),
    (p ->> 'company_id')::uuid,
    v_cost, v_hit,
    coalesce(p ->> 'outcome', 'hit'),
    p ->> 'note'
  )
  returning id into v_id;

  return v_id;
end $$;

comment on function record_data_lookup(jsonb) is
  'Writes one line of the bill. Takes the actor and organization from the '
  'session, never from the payload, so the ledger cannot be misattributed.';


-- ---------------------------------------------------------------------------
-- find_peers — nearest neighbours, with the hard screens applied in SQL.
--
-- The vector search and the financial filters run together rather than the
-- filters being applied in TypeScript afterwards, because a top-k over the whole
-- registry followed by a filter returns eight peers when you asked for twenty
-- and gives no way to tell whether the twentieth was excluded or never found.
--
-- Distance is returned rather than a similarity score. It is what the index
-- computed, and turning it into a percentage would invent a precision the
-- number does not have.
-- ---------------------------------------------------------------------------
create or replace function find_peers(
  p_embedding vector(1536),
  p_country text default null,
  p_listing_status text default null,
  p_min_revenue numeric default null,
  p_max_revenue numeric default null,
  p_exclude uuid default null,
  p_limit integer default 25
)
returns table (
  company_id uuid,
  name text,
  listing_status text,
  industry text,
  distance double precision,
  latest_revenue numeric,
  latest_period date
)
language sql stable security definer set search_path = public as $$
  with latest as (
    select distinct on (f.company_id)
           f.company_id, f.revenue, f.period_end
      from company_financials f
     where f.revenue is not null
     order by f.company_id, f.period_end desc
  )
  select c.id, c.name, c.listing_status, c.industry,
         c.embedding <=> p_embedding as distance,
         l.revenue, l.period_end
    from companies c
    left join latest l on l.company_id = c.id
   where auth.uid() is not null
     and c.embedding is not null
     and (p_country is null or c.country = p_country)
     and (p_listing_status is null or c.listing_status = p_listing_status)
     and (p_exclude is null or c.id <> p_exclude)
     and (p_min_revenue is null or (l.revenue is not null and l.revenue >= p_min_revenue))
     and (p_max_revenue is null or (l.revenue is not null and l.revenue <= p_max_revenue))
   order by c.embedding <=> p_embedding
   limit greatest(coalesce(p_limit, 25), 1);
$$;

comment on function find_peers is
  'Nearest neighbours over business descriptions with the size and geography '
  'screens applied in the same query, so a short result means a short result '
  'and not a filter that ran too late.';


-- ---------------------------------------------------------------------------
-- Grants.
--
-- find_peers checks auth.uid() for itself and returns nothing to an
-- unauthenticated caller. The writers are DEFINER because the tables they write
-- to have no insert policy at all; that is the design, not a workaround.
-- ---------------------------------------------------------------------------
grant execute on function upsert_company(jsonb)                          to authenticated;
grant execute on function set_company_embedding(uuid, vector, text)      to authenticated;
grant execute on function record_financials(jsonb)                       to authenticated;
grant execute on function record_quote(jsonb)                            to authenticated;
grant execute on function record_funding_round(jsonb)                    to authenticated;
grant execute on function record_source_document(jsonb)                  to authenticated;
grant execute on function record_data_lookup(jsonb)                      to authenticated;
grant execute on function find_peers(vector, text, text, numeric, numeric, uuid, integer)
  to authenticated;


-- ============================================================================
-- Verification — run these after applying, and read the answers.
--
-- This project applies migrations by hand, so the folder is not evidence of what
-- is in the database. 0027 exists because 0006 was assumed applied for months
-- and was not.
--
--   -- 1. Nine tables.
--   select table_name from information_schema.tables
--    where table_schema = 'public'
--      and table_name in ('companies','company_financials','company_quotes',
--                         'funding_rounds','source_documents','peer_sets',
--                         'peer_set_members','valuations','data_lookups')
--    order by table_name;
--
--   -- 2. pgvector is on, and the HNSW index exists.
--   select extname from pg_extension where extname = 'vector';
--   select indexname from pg_indexes where indexname = 'companies_embedding_idx';
--
--   -- 3. Eight functions.
--   select proname from pg_proc
--    where proname in ('upsert_company','set_company_embedding','record_financials',
--                      'record_quote','record_funding_round','record_source_document',
--                      'record_data_lookup','find_peers')
--    order by proname;
--
--   -- 4. Four triggers.
--   select tgname from pg_trigger where not tgisinternal
--     and tgname in ('peer_sets_stamp_org','valuations_stamp_org',
--                    'peer_set_members_guard_org','valuations_z_guard_peer_set')
--    order by tgname;
--
--   -- 5. The shared tables have exactly one policy each, and it is a SELECT.
--   --    If any of these shows an INSERT or UPDATE policy, stop: a customer can
--   --    write into every other customer's comparables.
--   select tablename, policyname, cmd from pg_policies
--    where tablename in ('companies','company_financials','company_quotes',
--                        'funding_rounds','source_documents')
--    order by tablename;
--
--   -- 6. The generated multiple generates, and stays null when it cannot.
--   --    Expect Series X at 4, and Series Y null because its revenue is
--   --    unknown. Rolled back, so it leaves nothing behind.
--   begin;
--     with c as (
--       select upsert_company('{"name":"Generated column check","source":"verification"}'::jsonb) as id
--     )
--     select record_funding_round(jsonb_build_object(
--              'company_id', c.id, 'round_label', 'Series X',
--              'announced_on', '2026-04-01', 'post_money', 400, 'revenue', 100,
--              'disclosure', 'disclosed', 'source', 'verification')),
--            record_funding_round(jsonb_build_object(
--              'company_id', c.id, 'round_label', 'Series Y',
--              'announced_on', '2026-04-02', 'post_money', 400,
--              'disclosure', 'disclosed', 'source', 'verification'))
--       from c;
--
--     select round_label, post_money, revenue, post_money_to_revenue
--       from funding_rounds where source = 'verification' order by announced_on;
--   rollback;
--
--   -- 7. An estimate is refused outright. Expect an exception naming the rule,
--   --    not a constraint violation.
--   select record_funding_round('{"disclosure":"estimated"}'::jsonb);
-- ============================================================================
