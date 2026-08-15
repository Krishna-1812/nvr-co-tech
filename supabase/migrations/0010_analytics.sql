-- ============================================================================
-- First-party web analytics, and the visitor de-anonymisation store
--
-- Everything a visitor does on the public site is recorded here by our own
-- endpoints, from our own cookie, into our own database. There is no Google
-- Analytics, no ad pixel and no third-party script involved at any point, which
-- is what makes the word "first-party" mean something rather than being a claim
-- on a privacy page.
--
-- Four decisions are worth stating before the tables, because they are the ones
-- that shaped every one of them:
--
--  1. NOBODY CAN READ THIS BUT AN ANALYTICS ADMIN. Every table below has a
--     select policy and it is the same policy: `is_analytics_admin()`. That
--     function reads one allowlist table, seeded in this migration with a single
--     address. A signed-in member of the voucher workflow — even an `owner` —
--     has no more access to this data than a stranger does. Being able to
--     approve a payment is not a reason to be shown who visited the pricing
--     page, and the two permissions are kept completely separate for that
--     reason.
--
--  2. NOBODY CAN WRITE TO IT DIRECTLY EITHER. The beacon is unauthenticated by
--     necessity: an anonymous visitor has no session. Granting `anon` an insert
--     policy would have meant that anybody holding the publishable key — which
--     is in the JavaScript bundle, by design — could write whatever they liked
--     into the visitor record. So there are no insert policies at all on the
--     event tables. Writes go through the SECURITY DEFINER functions at the
--     bottom of this file, which take a payload, validate it, and decide
--     themselves what a row is allowed to contain.
--
--  3. IT IS APPEND-ONLY. Same stance as `voucher_audit` (0001) and
--     `reconciliations` (0008): no update policy exists on any event table, so
--     with RLS on, an UPDATE is denied to everyone. A page view is a record of
--     something that happened. The only deletion is `prune_analytics()`, which
--     is retention, not editing.
--
--  4. AN IDENTIFICATION IS EVIDENCE, NOT A GUESS. `identity_edges` splits into
--     `deterministic` (someone logged in, submitted a form, or was named by a
--     webhook — confidence 1.0) and `co_occurrence` (two visitors shared an IP
--     or a device fingerprint — confidence well under 1.0). Only the first kind
--     may ever merge two identities. This is the whole reason the distinction
--     exists: one coincidental shared IP on office wifi must never silently fuse
--     two unrelated people's browsing histories together.
--
-- One deliberate departure from the specification this was built from: it lists
-- a `duration_formatted` column holding "2m 14s". A formatted string is a
-- display concern and it is derived from a column sitting next to it, so it is
-- computed when the page renders instead. The derived date and weekday columns
-- ARE stored, because those exist to group by without re-parsing a timestamp,
-- which is a real reason.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Who may look at any of this
--
-- A table rather than an environment variable, and this is the one design note
-- most worth reading. Two copies of an admin list — one in Postgres deciding
-- what the row-level policies allow, one in the application deciding what the
-- navigation shows — drift apart the first time somebody is added to only one
-- of them, and the failure is silent: the menu item appears and every page
-- under it is empty. So there is exactly one list, it lives here, and the
-- application asks this database who is on it.
--
-- It also means adding a colleague is one INSERT rather than a redeploy.
-- ---------------------------------------------------------------------------
create table analytics_admins (
  email      text primary key check (position('@' in email) > 1),
  note       text,
  added_at   timestamptz not null default now()
);

comment on table analytics_admins is
  'The only people who may read the analytics tables. The single source of '
  'truth: the application reads it through is_analytics_admin() rather than '
  'keeping a copy.';

insert into analytics_admins (email, note)
values ('krishna.ladha18@gmail.com', 'First administrator.');

-- SECURITY DEFINER so it can read the allowlist while the allowlist's own
-- policy is what it is being used to evaluate. STABLE so a policy that calls it
-- once per row is planned as one call rather than as thousands.
create or replace function is_analytics_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from analytics_admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

comment on function is_analytics_admin() is
  'True when the caller''s verified email is on the analytics allowlist. Used by '
  'every select policy in this migration and by the application''s own gate.';


-- ---------------------------------------------------------------------------
-- page_views — a signed-in person reading a page
--
-- The counterpart to visitor_analytics below: this is the side of the journey
-- where we already know who it is. `visitor_id` is the join between the two,
-- and it is the whole point of the table. It is the same browser-persisted id
-- the anonymous beacon uses, so the moment somebody signs in, everything they
-- read before they did becomes attributable to them.
-- ---------------------------------------------------------------------------
create table page_views (
  id           bigserial primary key,
  occurred_at  timestamptz not null default now(),
  -- Derived at insert, in IST, because every reading of this data is grouped by
  -- day and `at time zone` is not immutable enough for a generated column.
  occurred_on  date not null,
  weekday      text not null,

  email        text,
  page_title   text,
  page_url     text not null,
  -- Under a second is a redirect or a bounced back-button, not a page read.
  seconds      integer not null check (seconds >= 1),

  ip           text,
  browser      text,
  os           text,
  device       text,
  visitor_id   text
);

create index page_views_when_idx    on page_views (occurred_at desc);
create index page_views_visitor_idx on page_views (visitor_id) where visitor_id is not null;
create index page_views_email_idx   on page_views (email)      where email is not null;


-- ---------------------------------------------------------------------------
-- visitor_analytics — one row per anonymous page view
--
-- The wide one. Everything the tracker measured about a single page view, in
-- the shape the tracker sends it, so that what is stored and what was observed
-- can be compared line for line.
--
-- Bot traffic is stored rather than dropped. A crawler's visit is real traffic
-- and worth being able to count; what it must never do is inflate the numbers a
-- human reads, so it is flagged here and excluded at every read instead.
-- ---------------------------------------------------------------------------
create table visitor_analytics (
  id           bigserial primary key,
  occurred_at  timestamptz not null default now(),
  occurred_on  date not null,
  weekday      text not null,

  -- ── Identity ─────────────────────────────────────────────────────────────
  visitor_id     text not null,
  session_id     text not null,
  is_new_visitor boolean not null default false,

  -- ── Where ────────────────────────────────────────────────────────────────
  page_url      text not null,
  page_title    text,
  referrer      text,
  -- Hostname only, 'www.' stripped, 'direct' when there was none.
  referrer_host text not null default 'direct',

  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_term     text,
  utm_content  text,

  landing_page     text,
  pages_in_session integer not null default 1 check (pages_in_session >= 1),

  -- ── What they did ────────────────────────────────────────────────────────
  time_on_page_s integer not null default 0 check (time_on_page_s >= 0),
  -- Ticked only while the tab was visible AND something had been touched in the
  -- last fifteen seconds. This is the number worth trusting; time_on_page_s
  -- counts an abandoned tab as attention.
  engaged_time_s integer not null default 0 check (engaged_time_s >= 0),
  max_scroll_pct integer not null default 0 check (max_scroll_pct between 0 and 100),
  total_clicks   integer not null default 0 check (total_clicks >= 0),
  -- Flattened by the endpoint as "label×count · label×count". Parsed back at
  -- read time. A jsonb object would query better, and would also mean the
  -- storage shape and the wire shape could drift; this way there is one.
  cta_clicks     text,
  video          text check (video is null or video in ('opened')),
  form_stage     text check (form_stage is null or form_stage in ('open', 'started', 'submitted')),
  search_terms   text,
  -- Two clicks inside 800ms and 32px of each other. A frustration signal.
  rage_clicks    integer not null default 0 check (rage_clicks >= 0),

  -- ── Core Web Vitals. Zero means "not measured", never "measured as zero",
  -- which is why every average over these excludes the zeroes.
  lcp_ms integer not null default 0 check (lcp_ms >= 0),
  cls    numeric(7, 4) not null default 0 check (cls >= 0),
  inp_ms integer not null default 0 check (inp_ms >= 0),

  -- ── Environment ──────────────────────────────────────────────────────────
  viewport text,
  screen   text,
  language text,
  browser  text,
  os       text,
  device   text,
  is_bot   boolean not null default false,
  ip       text,
  -- The capped raw event log: {type, label, at, extra?}. Eighty entries at most,
  -- so a tab left open for a day cannot grow one row without bound.
  events   jsonb
);

create index visitor_analytics_when_idx    on visitor_analytics (occurred_at desc);
create index visitor_analytics_day_idx     on visitor_analytics (occurred_on);
create index visitor_analytics_visitor_idx on visitor_analytics (visitor_id, occurred_at desc);
create index visitor_analytics_session_idx on visitor_analytics (session_id);
-- The de-anonymisation pass resolves the distinct IPs of real traffic only.
create index visitor_analytics_ip_idx      on visitor_analytics (ip) where not is_bot and ip is not null;


-- ---------------------------------------------------------------------------
-- visitor_identities — the moment somebody stopped being anonymous
--
-- Written only when a visitor genuinely revealed who they are: they filled in a
-- form, they signed in, or a system we trust told us over the webhook. Nothing
-- inferred, nothing guessed, and nothing bought ever lands in this table
-- unprompted.
-- ---------------------------------------------------------------------------
create table visitor_identities (
  id            bigserial primary key,
  identified_at timestamptz not null default now(),
  visitor_id    text not null,
  full_name     text,
  email         text,
  company       text,
  title         text,
  -- 'lead_form', 'sign_in', 'provider', or whatever else is introduced later.
  source        text not null
);

create index visitor_identities_visitor_idx on visitor_identities (visitor_id, identified_at desc);
create index visitor_identities_email_idx    on visitor_identities (lower(email)) where email is not null;


-- ---------------------------------------------------------------------------
-- The identity graph
--
-- Nodes are identifiers; edges are the reasons to believe two of them belong to
-- the same person. Kept as a graph rather than as a `person_id` column on every
-- table because the whole value is in the retroactive join: an edge created
-- today has to make sense of sessions recorded months ago, and it does that by
-- being reachable from them, not by rewriting them.
-- ---------------------------------------------------------------------------
create table identity_nodes (
  id         bigserial primary key,
  kind       text not null check (
    kind in ('visitor_id', 'email', 'email_sha256', 'crm_id', 'ip', 'device', 'person')
  ),
  value      text not null,
  -- Name, title, company and where they came from, for the identity-bearing
  -- kinds. Merged rather than replaced on each observation, so a later sighting
  -- that knows less cannot erase what an earlier one knew.
  attrs      jsonb not null default '{}'::jsonb,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  unique (kind, value)
);

create table identity_edges (
  id           bigserial primary key,
  src_id       bigint not null references identity_nodes(id) on delete cascade,
  dst_id       bigint not null references identity_nodes(id) on delete cascade,
  -- 'deterministic' is proof and may merge two identities. 'co_occurrence' is a
  -- coincidence worth remembering and may not. Nothing in the resolver reads a
  -- co_occurrence edge to decide who somebody is.
  kind         text not null check (kind in ('deterministic', 'co_occurrence')),
  confidence   numeric(4, 3) not null check (confidence > 0 and confidence <= 1),
  source       text,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  observations integer not null default 1,
  -- Seeing the same thing again is a stronger version of one edge, not a second
  -- edge. Without this the table would grow one row per page view forever.
  unique (src_id, dst_id, kind)
);

create index identity_edges_src_idx on identity_edges (src_id);
create index identity_edges_dst_idx on identity_edges (dst_id);
-- The resolver walks deterministic edges only, so it gets its own index.
create index identity_edges_firm_idx on identity_edges (src_id) where kind = 'deterministic';


-- ---------------------------------------------------------------------------
-- The caches
--
-- Both are keyed by the thing looked up and version-stamped by the logic that
-- produced them. The version is what lets the extraction rules be improved
-- later without serving last month's wrong answer forever: bump the constant in
-- the code and every cached row re-resolves once, on demand.
--
-- A negative result is cached too, with a much shorter life. A dead website
-- should not be re-fetched on every dashboard load; it also should not be
-- written off for a week because of one bad minute.
-- ---------------------------------------------------------------------------
create table ip_resolutions (
  ip          text primary key,
  version     integer not null,
  resolution  jsonb not null,
  resolved_at timestamptz not null default now(),
  expires_at  timestamptz not null
);

create table company_enrichment (
  domain     text not null,
  -- 'free' is scraped from what the company publishes about itself and costs
  -- nothing. 'paid' is a purchased record. They are separate rows on purpose:
  -- expiring one must never quietly discard the other.
  tier       text not null check (tier in ('free', 'paid')),
  version    integer not null,
  -- Null is a real, cached answer: "we looked, and there was nothing".
  data       jsonb,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (domain, tier)
);

-- ---------------------------------------------------------------------------
-- enrichment_spend — every paid lookup, and who asked for it
--
-- Not in the specification, and added because the specification's rule needs
-- it: paid enrichment may only ever happen because one person deliberately
-- clicked one button. A rule like that is only true if it can be checked
-- afterwards, so each call writes a line here naming the person who caused it.
-- ---------------------------------------------------------------------------
create table enrichment_spend (
  id          bigserial primary key,
  spent_at    timestamptz not null default now(),
  actor_email text not null,
  kind        text not null check (kind in ('company', 'person')),
  subject     text not null,
  outcome     text not null check (outcome in ('hit', 'miss', 'error'))
);

create index enrichment_spend_when_idx on enrichment_spend (spent_at desc);


-- ═══════════════════════════════════════════════════════════════════════════
-- Writing
--
-- All of it, from the unauthenticated beacon to the identity webhook, goes
-- through these. They are SECURITY DEFINER, so they run as the table owner and
-- are unaffected by the fact that the event tables have no insert policy — and
-- that is the point: this is the only door, and it is narrow enough to see
-- through. Each one takes a single jsonb payload rather than thirty-odd
-- arguments, reads the keys it knows about, and ignores everything else.
-- ═══════════════════════════════════════════════════════════════════════════

-- One node, created or refreshed. Attributes merge, so a later sighting that
-- knows less than an earlier one cannot blank out a name.
create or replace function graph_node(p_kind text, p_value text, p_attrs jsonb default '{}'::jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if p_value is null or btrim(p_value) = '' then return null; end if;

  insert into identity_nodes (kind, value, attrs)
  values (p_kind, btrim(p_value), coalesce(p_attrs, '{}'::jsonb))
  on conflict (kind, value) do update
    set last_seen = now(),
        attrs = identity_nodes.attrs || coalesce(excluded.attrs, '{}'::jsonb)
  returning id into v_id;

  return v_id;
end $$;

-- One edge, created or reinforced. A repeat sighting bumps the counter and the
-- last-seen stamp; it never adds a second row saying the same thing.
create or replace function graph_edge(
  p_src bigint, p_dst bigint, p_kind text, p_confidence numeric, p_source text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_src is null or p_dst is null or p_src = p_dst then return; end if;

  insert into identity_edges (src_id, dst_id, kind, confidence, source)
  values (p_src, p_dst, p_kind, p_confidence, p_source)
  on conflict (src_id, dst_id, kind) do update
    set last_seen = now(),
        observations = identity_edges.observations + 1,
        -- The strongest confidence ever recorded for this pairing wins. A weak
        -- later observation of an already-proven link is not new doubt.
        confidence = greatest(identity_edges.confidence, excluded.confidence);
end $$;

-- Neither helper is part of the public surface: they take node ids, which a
-- caller outside this file has no way to hold, and they would let anybody write
-- arbitrary edges. The functions below call them as the owner regardless.
revoke execute on function graph_node(text, text, jsonb) from public;
revoke execute on function graph_edge(bigint, bigint, text, numeric, text) from public;

-- ---------------------------------------------------------------------------
-- record_visitor_view — the anonymous beacon's landing point
--
-- Also touches the identity graph, rather than leaving that to a second call.
-- One round trip, and the graph cannot fall behind the event log because of a
-- failure between two statements that were meant to happen together.
-- ---------------------------------------------------------------------------
create or replace function record_visitor_view(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_when timestamptz := now();
  v_local timestamp := v_when at time zone 'Asia/Kolkata';
  v_visitor text := nullif(btrim(coalesce(p ->> 'visitor_id', '')), '');
  v_ip text := nullif(btrim(coalesce(p ->> 'ip', '')), '');
  v_device text := nullif(btrim(coalesce(p ->> 'device_fp', '')), '');
  v_node bigint;
begin
  -- A page view with no visitor and no session is not a page view.
  if v_visitor is null or nullif(btrim(coalesce(p ->> 'session_id', '')), '') is null then
    return;
  end if;

  insert into visitor_analytics (
    occurred_at, occurred_on, weekday,
    visitor_id, session_id, is_new_visitor,
    page_url, page_title, referrer, referrer_host,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    landing_page, pages_in_session,
    time_on_page_s, engaged_time_s, max_scroll_pct, total_clicks,
    cta_clicks, video, form_stage, search_terms, rage_clicks,
    lcp_ms, cls, inp_ms,
    viewport, screen, language, browser, os, device, is_bot, ip, events
  ) values (
    v_when, v_local::date, to_char(v_local, 'Dy'),
    v_visitor,
    p ->> 'session_id',
    coalesce((p ->> 'is_new_visitor')::boolean, false),
    coalesce(nullif(p ->> 'page_url', ''), '/'),
    p ->> 'page_title',
    p ->> 'referrer',
    coalesce(nullif(p ->> 'referrer_host', ''), 'direct'),
    p ->> 'utm_source', p ->> 'utm_medium', p ->> 'utm_campaign',
    p ->> 'utm_term', p ->> 'utm_content',
    p ->> 'landing_page',
    greatest(coalesce((p ->> 'pages_in_session')::integer, 1), 1),
    greatest(coalesce((p ->> 'time_on_page_s')::integer, 0), 0),
    greatest(coalesce((p ->> 'engaged_time_s')::integer, 0), 0),
    least(greatest(coalesce((p ->> 'max_scroll_pct')::integer, 0), 0), 100),
    greatest(coalesce((p ->> 'total_clicks')::integer, 0), 0),
    nullif(p ->> 'cta_clicks', ''),
    nullif(p ->> 'video', ''),
    nullif(p ->> 'form_stage', ''),
    nullif(p ->> 'search_terms', ''),
    greatest(coalesce((p ->> 'rage_clicks')::integer, 0), 0),
    greatest(coalesce((p ->> 'lcp_ms')::integer, 0), 0),
    greatest(coalesce((p ->> 'cls')::numeric, 0), 0),
    greatest(coalesce((p ->> 'inp_ms')::integer, 0), 0),
    p ->> 'viewport', p ->> 'screen', p ->> 'language',
    p ->> 'browser', p ->> 'os', p ->> 'device',
    coalesce((p ->> 'is_bot')::boolean, false),
    v_ip,
    p -> 'events'
  );

  -- A crawler is not a person, so it gets no place in the identity graph.
  if coalesce((p ->> 'is_bot')::boolean, false) then return; end if;

  v_node := graph_node('visitor_id', v_visitor);

  -- Both of these are coincidences, not proof, and are recorded at confidences
  -- that say so. The resolver never reads them to decide who somebody is; they
  -- are here for the day there is something worth doing with a weak signal.
  if v_ip is not null then
    perform graph_edge(v_node, graph_node('ip', v_ip), 'co_occurrence', 0.3, 'beacon');
  end if;
  if v_device is not null then
    perform graph_edge(v_node, graph_node('device', v_device), 'co_occurrence', 0.4, 'beacon');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- record_page_view — a signed-in person's reading time
-- ---------------------------------------------------------------------------
create or replace function record_page_view(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_when timestamptz := now();
  v_local timestamp := v_when at time zone 'Asia/Kolkata';
  v_seconds integer := coalesce((p ->> 'seconds')::integer, 0);
begin
  -- Under a second is navigation, not reading.
  if v_seconds < 1 then return; end if;

  insert into page_views (
    occurred_at, occurred_on, weekday,
    email, page_title, page_url, seconds, ip, browser, os, device, visitor_id
  ) values (
    v_when, v_local::date, to_char(v_local, 'Dy'),
    nullif(btrim(coalesce(p ->> 'email', '')), ''),
    p ->> 'page_title',
    coalesce(nullif(p ->> 'page_url', ''), '/'),
    v_seconds,
    nullif(btrim(coalesce(p ->> 'ip', '')), ''),
    p ->> 'browser', p ->> 'os', p ->> 'device',
    nullif(btrim(coalesce(p ->> 'visitor_id', '')), '')
  );
end $$;

-- ---------------------------------------------------------------------------
-- record_identity — somebody said who they are
--
-- The one function here that creates a deterministic edge, which is to say the
-- one that can change what the resolver believes. It is reached from three
-- places and all three of them are proof: a lead form that captured an address,
-- a sign-in, and the token-gated webhook.
-- ---------------------------------------------------------------------------
create or replace function record_identity(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_visitor text := nullif(btrim(coalesce(p ->> 'visitor_id', '')), '');
  v_email   text := lower(nullif(btrim(coalesce(p ->> 'email', '')), ''));
  v_crm     text := nullif(btrim(coalesce(p ->> 'crm_id', '')), '');
  v_source  text := coalesce(nullif(btrim(coalesce(p ->> 'source', '')), ''), 'unknown');
  v_attrs   jsonb;
  v_visitor_node bigint;
begin
  if v_visitor is null then return; end if;
  -- An identification that names nobody identifies nobody.
  if v_email is null and v_crm is null then return; end if;

  insert into visitor_identities (visitor_id, full_name, email, company, title, source)
  values (
    v_visitor,
    nullif(btrim(coalesce(p ->> 'full_name', '')), ''),
    v_email,
    nullif(btrim(coalesce(p ->> 'company', '')), ''),
    nullif(btrim(coalesce(p ->> 'title', '')), ''),
    v_source
  );

  -- Only the keys that carry something. jsonb_strip_nulls is what stops a
  -- webhook that knows only an email from blanking a name captured earlier.
  v_attrs := jsonb_strip_nulls(jsonb_build_object(
    'full_name', nullif(btrim(coalesce(p ->> 'full_name', '')), ''),
    'title',     nullif(btrim(coalesce(p ->> 'title', '')), ''),
    'company',   nullif(btrim(coalesce(p ->> 'company', '')), ''),
    'source',    v_source
  ));

  v_visitor_node := graph_node('visitor_id', v_visitor);

  if v_email is not null then
    perform graph_edge(
      v_visitor_node, graph_node('email', v_email, v_attrs), 'deterministic', 1.0, v_source
    );
  end if;

  if v_crm is not null then
    perform graph_edge(
      v_visitor_node, graph_node('crm_id', v_crm, v_attrs), 'deterministic', 1.0, v_source
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- prune_analytics — the only deletion in this file
--
-- Retention, not editing, and an admin act. Four hundred days by default, which
-- is a full year of comparisons plus the month it takes to notice you wanted
-- them.
-- ---------------------------------------------------------------------------
create or replace function prune_analytics(p_days integer default 400)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_cut timestamptz; v_removed integer;
begin
  if not is_analytics_admin() then
    raise exception 'Only an analytics administrator can prune the visitor record';
  end if;
  if p_days is null or p_days < 30 then
    raise exception 'Retention must be at least 30 days';
  end if;

  v_cut := now() - make_interval(days => p_days);

  delete from visitor_analytics where occurred_at < v_cut;
  get diagnostics v_removed = row_count;
  delete from page_views where occurred_at < v_cut;

  return v_removed;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- Reading
--
-- One policy, repeated. The caches and the spend ledger additionally allow the
-- admin to write, because those are filled in while an admin is looking at a
-- dashboard rather than by an anonymous visitor, and a definer function for
-- them would be ceremony around a query the policy already covers.
-- ═══════════════════════════════════════════════════════════════════════════
alter table analytics_admins   enable row level security;
alter table page_views         enable row level security;
alter table visitor_analytics  enable row level security;
alter table visitor_identities enable row level security;
alter table identity_nodes     enable row level security;
alter table identity_edges     enable row level security;
alter table ip_resolutions     enable row level security;
alter table company_enrichment enable row level security;
alter table enrichment_spend   enable row level security;

create policy analytics_admins_read on analytics_admins
  for select using (is_analytics_admin());

create policy page_views_read on page_views
  for select using (is_analytics_admin());

create policy visitor_analytics_read on visitor_analytics
  for select using (is_analytics_admin());

create policy visitor_identities_read on visitor_identities
  for select using (is_analytics_admin());

create policy identity_nodes_read on identity_nodes
  for select using (is_analytics_admin());

create policy identity_edges_read on identity_edges
  for select using (is_analytics_admin());

create policy ip_resolutions_read on ip_resolutions
  for select using (is_analytics_admin());
create policy ip_resolutions_write on ip_resolutions
  for insert with check (is_analytics_admin());
create policy ip_resolutions_refresh on ip_resolutions
  for update using (is_analytics_admin()) with check (is_analytics_admin());

create policy company_enrichment_read on company_enrichment
  for select using (is_analytics_admin());
create policy company_enrichment_write on company_enrichment
  for insert with check (is_analytics_admin());
create policy company_enrichment_refresh on company_enrichment
  for update using (is_analytics_admin()) with check (is_analytics_admin());

create policy enrichment_spend_read on enrichment_spend
  for select using (is_analytics_admin());
create policy enrichment_spend_write on enrichment_spend
  for insert with check (is_analytics_admin());

-- Belt and braces on the append-only tables. With RLS on, a command with no
-- policy is already denied — but a policy added carelessly later would undo
-- that silently, and a missing column grant would not.
revoke update, delete on page_views         from anon, authenticated;
revoke update, delete on visitor_analytics  from anon, authenticated;
revoke update, delete on visitor_identities from anon, authenticated;
revoke update, delete on identity_nodes     from anon, authenticated;
revoke update, delete on identity_edges     from anon, authenticated;
revoke insert, update, delete on analytics_admins from anon, authenticated;
