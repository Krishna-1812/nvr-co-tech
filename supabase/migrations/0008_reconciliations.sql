-- ============================================================================
-- Ledger Reconciliation — saved runs
--
-- The second tool on the platform, and the first one whose work is done entirely
-- in the browser. The two ledger files are read there and never uploaded, so
-- nothing in this table is a file: what is stored is the RESULT of comparing
-- two files that the person doing it already has.
--
-- That distinction drives the whole design:
--
--   * There is no `update`. A reconciliation is a statement of what two books
--     said on a given date. Re-running it with a different date or tolerance is
--     a different statement, not an edit of this one, and it gets its own row.
--     Same reason the voucher audit trail is append-only.
--
--   * It is private to the person who ran it. Vouchers are shared because they
--     move through other people's hands; a reconciliation does not. An approver
--     has no business in somebody else's working papers, so unlike vouchers
--     there is no can_approve() branch in the read policy.
--
--   * The whole result is kept as jsonb rather than being normalised into
--     statement lines and difference rows. It is written once, read whole, and
--     never queried across — and the shape it has to survive in is the shape the
--     TypeScript engine produced, which a set of tables would only approximate.
--     The columns beside it exist purely so the history list can be rendered
--     without pulling every stored run into memory.
-- ============================================================================

create table reconciliations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references profiles(id) on delete cascade,

  -- ── What was reconciled, for the list ──────────────────────────────────────
  ledger_a_name text not null,
  ledger_b_name text not null,
  reconciliation_date date not null,
  starting_ledger text not null check (starting_ledger in ('A', 'B')),
  -- Null means no window was applied: anything posted by the date was on time.
  tolerance_days integer check (tolerance_days is null or tolerance_days >= 1),

  -- ── How it came out ────────────────────────────────────────────────────────
  status text not null check (status in ('RECONCILED', 'PARTIAL', 'NOT_RECONCILED')),
  variance numeric(14, 2) not null,
  starting_balance numeric(14, 2) not null,
  closing_balance numeric(14, 2) not null,
  matched_count integer not null default 0,
  timing_count integer not null default 0,
  one_sided_count integer not null default 0,
  amount_diff_count integer not null default 0,

  -- ── The statement itself ───────────────────────────────────────────────────
  result jsonb not null,

  created_at timestamptz not null default now()
);

comment on table reconciliations is
  'One saved reconciliation. Written once and never updated: re-running produces '
  'a new row. Private to whoever ran it.';

comment on column reconciliations.result is
  'The full ReconResult from src/lib/recon, as the engine produced it. Read '
  'whole, never queried across; the columns beside it are what the list renders.';

-- The history list, newest first, for one person. The only query this table has.
create index reconciliations_mine_idx on reconciliations (created_by, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Yours and nobody else's, in all three directions. Note the absence of an
-- update policy: with RLS enabled and no policy for a command, that command is
-- denied to everyone, which is exactly the intent. It is stated here in a
-- comment rather than left to be inferred from a missing block.
-- ---------------------------------------------------------------------------
alter table reconciliations enable row level security;

create policy reconciliations_read_own on reconciliations
  for select using (created_by = auth.uid());

create policy reconciliations_insert_own on reconciliations
  for insert with check (created_by = auth.uid());

create policy reconciliations_delete_own on reconciliations
  for delete using (created_by = auth.uid());

-- Belt and braces alongside the missing update policy: even if one were added
-- later by mistake, there is no column grant behind it.
revoke update on reconciliations from authenticated;
