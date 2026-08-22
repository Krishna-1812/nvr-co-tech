# Context file — The Finance Intelligence (`nvr-voucher-v2`)

**Purpose.** This file is a single, self-contained briefing on this repository. It is written so
that it can be pasted verbatim into a fresh chat with an AI assistant, or read start-to-finish by a
new engineer, and either will come away knowing what this product is, what is true about it today,
which of its decisions look arbitrary but are not, and which lines must not be crossed.

Everything below was read out of the repository, the migrations and the git history rather than
recalled. Where a claim cannot be verified from this machine, it says so.

*Last verified: 22 August 2026, at commit `f41275a` on `main`. 46 test files / 735 tests passing.*

---

## 0. How to use this file as a prompt

If you are an assistant starting fresh on this codebase, read this file first and then treat the
following as your standing instructions:

> You are working on **The Finance Intelligence** (`nvr-voucher-v2`), a Next.js 16 + Supabase
> multi-tenant SaaS for Indian finance teams, at `C:\Users\krish\NVR Tech\nvr-voucher-v2`, branch
> `main`, remote `https://github.com/Krishna-1812/nvr-co-tech.git`. Read `README.md` and this
> `Context file.md` before touching anything. The audience is chartered accountants, who check —
> so accuracy in copy is a correctness concern, not a polish concern. Authorisation is enforced in
> **Postgres**, not in React; if you change a rule, change it in a migration. Migrations are
> applied **by hand** through the Supabase SQL editor while a push to `main` deploys itself, so
> never assume the live schema matches `supabase/migrations/`. Verify UI work by actually rendering
> it (see §12), because every interesting defect this project has had was invisible to `tsc`,
> `eslint` and the test suite. Section 14 lists invariants that must not be relaxed — read it
> before proposing anything that touches RLS, the identification gate, or the operator functions.
> Finish the work, then commit and push without asking.

---

## 1. Identity

| | |
|---|---|
| Product name | **The Finance Intelligence** |
| `package.json` name | `finance-intelligence` |
| Repo path | `C:\Users\krish\NVR Tech\nvr-voucher-v2` |
| Remote | `https://github.com/Krishna-1812/nvr-co-tech.git` |
| Default branch | `main` (pushes to `main` deploy themselves) |
| Host | Vercel, functions pinned to `bom1` (Mumbai) via `vercel.json` |
| Database | Supabase, project in `ap-south-1` (Mumbai) |
| Real mailbox | `team@thefinanceintelligence.com` (GoDaddy, one address, no separate security inbox) |
| Origin | A rebuild of a v1 voucher portal written for the **CIO Association**; v1's repo name carries an old brand and is deliberately recorded outside the repo |

**What it is.** A platform of AI agents for finance work, positioned as built by chartered
accountants. Two agents are live, four are roadmap entries and the pages say so. Around the agents
sit a public marketing site, an auth and onboarding flow, a workspace hub, a grounded assistant,
and an operator-only analytics section.

**The roster** (`src/lib/marketing/content.ts`, `AGENTS` — one file, read by both the public site
and the signed-in hub, so a tool going live changes stage in one place):

| Slug | Name | Stage | Category | Opens at |
|---|---|---|---|---|
| `voucher-desk` | Voucher Desk | **live** | Payments & approvals | `/dashboard` |
| `ledger-reconciliation` | Ledger Reconciliation | **live** | Books & closing | `/reconcile` |
| `gst-reconciliation` | GST Reconciliation | planned | Indirect tax | — |
| `tds-compliance` | TDS Compliance | planned | Direct tax | — |
| `invoice-intake` | Invoice Intake | planned | Document capture | — |
| `audit-copilot` | Audit Copilot | planned | Assurance & reporting | — |

The live/coming/total counts are **derived** from that array by a `ROSTER` helper, never typed —
four places said "one is live" for a month after the second tool shipped.

---

## 2. Stack

Next.js **16.2.12** (App Router, `proxy.ts` not `middleware.ts`) · React **19.2.4** ·
TypeScript 5 · Tailwind **v4** (`@tailwindcss/postcss`) · Supabase (`@supabase/ssr` 0.12,
`supabase-js` 2.111) · Vitest 4 · Zod 4 · react-hook-form 7 · Radix UI primitives ·
lucide-react · `@react-pdf/renderer` 4 · `pdfjs-dist` 6 · SheetJS (`xlsx`) ·
`date-fns` 4 · `sonner` (toasts) · `tailwind-merge` · `googleapis` (for the unbuilt Sheets worker).

Dev tooling of note: **`pgsql-parser`**, used by `scripts/check-sql.mjs` to parse-check every
migration against real PostgreSQL grammar (there is no local Postgres — migrations are
parse-checked, never executed, locally).

`next.config.ts` carries two deliberate settings: one `remotePatterns` entry for
`logo.clearbit.com` (the only external image, admin-only, and a 200 from it doubles as weak evidence
a resolved domain is real), and `experimental.staleTimes` of 30s dynamic / 180s static — safe only
because every mutation calls `revalidatePath` and its component calls `router.refresh()`.

---

## 3. Route map

Route groups, each with its own `Section` definition in `src/lib/nav.ts`, all handed to **one**
shared `AppShell`. A third tool is a nav definition plus a route group, not a third shell.

```
src/app/
  (marketing)   /  /agents  /agents/[slug]  /about  /contact  /privacy  /terms
                + opengraph-image, not-found            → public, dark always
  (auth)        /login  /signup  /forgot-password  /reset-password  /onboarding
  (hub)         /hub                                    → the workspace, lands here after sign-in
  (app)         /dashboard  /vouchers  /vouchers/[id]  /vouchers/[id]/edit
                /approvals  /admin  /admin/chapters  /admin/deleted  /settings
                + /vouchers/new (route handler), /vouchers/[id]/pdf, /vouchers/export
  (recon)       /reconcile  /reconcile/history  /reconcile/history/[id]  /reconcile/export
  (assist)      /ask  /ask/history
  (insight)     /analytics  /analytics/activation  /analytics/external
                /analytics/orgs  /analytics/orgs/[id]  /analytics/requests
                /analytics/visitors  /analytics/visitors/[id]  /analytics/errors
  api/          /api/assist  /api/track  /api/atrack  /api/identify  /api/whoami
  auth/callback (OAuth)
  layout.tsx  error.tsx  not-found.tsx  icon.svg  robots.ts  sitemap.ts
```

36 routes in total. `AFTER_LOGIN = '/hub'` — signing in gets you into the *platform*, not into the
voucher dashboard; landing on `/dashboard` made the whole product look like one application with an
odd marketing site attached.

**Gating is a deny-list, not an allow-list** (`src/lib/routes.ts`, `PROTECTED_PREFIXES`): `/hub`,
`/dashboard`, `/vouchers`, `/approvals`, `/admin`, `/settings`, `/reconcile`, `/ask`, `/onboarding`,
`/analytics`. The public surface is the larger and faster-growing one, so with an allow-list every
new marketing page would need an edit here and forgetting one hides a public page behind a login
wall. `src/proxy.ts` also skips the Supabase round-trip entirely when no `sb-*auth-token` cookie is
present, which takes a network hop off every page of the public site.

**Two token sets that cannot reach each other.** The public site is dark always
(`--m-*` under `[data-skin='night']`); the application follows the reader's system theme (`:root`
tokens). The hub uses a third, `--h-*`, for per-agent accents that have to work in both app themes.

---

## 4. Data model and the 27 migrations

All schema, policies and functions live in `supabase/migrations/`, applied **manually** in order.
Every one carries a long header explaining why it exists; read the header before changing anything
it touched.

| # | File | What it did |
|---|---|---|
| 0001 | `schema.sql` | Core schema. Header still says "Client: CIO Association" — pre-multi-tenant. `event_id`/`event_date` actually persisted (v1 dropped both); `net_total`/`grand_total` are **generated columns**; `gst_mode_exclusive` and `cgst_sgst_paired` are CHECK constraints; chapters/events org-level not per-user |
| 0002 | `workflow.sql` | The approval workflow, enforced in the database. `voucher_audit` with no UPDATE or DELETE policy |
| 0003 | `rls.sql` | Row Level Security, explicit and reviewable (v1 had it only in the dashboard). Also the column-level `GRANT` that stops `update profiles set role='owner' where id=auth.uid()` |
| 0004 | `seed.sql` | The 15 CIO Association chapters, from v1's hard-coded constant into real rows |
| 0005 | `admin.sql` | Soft delete, restore, chapter admin. Fixed a real 0003 bug where restore was impossible for everyone |
| 0006 | `avatars.sql` | `profiles.avatar_url`. **Never applied to production until 0027** — see below |
| 0007 | `voucher_prefix.sql` | `NVR/` → `FI/` in issued numbers. Existing numbers deliberately not rewritten; the run continued unbroken |
| 0008 | `reconciliations.sql` | Saved reconciliation runs. Never updatable — re-running makes a new row |
| 0009 | `assist_history.sql` | `assist_conversations` + `assist_turns`, append-only like `voucher_audit` |
| 0010 | `analytics.sql` (653 ln) | First-party web analytics + the visitor de-anonymisation store. `analytics_admins` table, `is_analytics_admin()`, no insert policies at all on event tables |
| 0011 | `operations.sql` | Cross-instance rate limiting and `error_log` |
| 0012 | `organizations.sql` (839 ln) | **The multi-tenancy conversion.** `organizations`, `organization_id` on profiles/chapters/events/vouchers, `my_organization_id()`, every policy rewritten, per-org uniqueness, `before insert` triggers stamping the org, invites, `create_organization`/`accept_invite`/`invite_user` |
| 0013 | `optional_approval.sql` | `organizations.requires_approval` — approval becomes a per-org toggle |
| 0014 | `approval_off_by_default.sql` | Flipped the default to **off**, for existing orgs and new ones |
| 0015 | `single_approval.sql` | **One signature, not two.** `approve_voucher` takes `pending_first` *or* `pending_second` straight to `approved` |
| 0016 | `scope_voucher_no_unique.sql` | Genuine 0012 bug: numbering was org-scoped but the unique index was not, so two orgs each with a chapter coded `HO` collided |
| 0017 | `audit_edits.sql` | Log what a plain edit changed — autosave was doing bare updates, so a voucher sent back and quietly altered left no record |
| 0018 | `audit_fixes.sql` | Four readiness-audit fixes: purge restricted to `is_owner()`, a lock that names its scope, a real size limit on the `invoices` bucket, voucher date bounds |
| 0019 | `manual_voucher_no_and_date_floor.sql` | Voucher numbers are **typed by hand** now (auto-assign removed from `submit_voucher`; `next_voucher_no()` kept as the suggestion), and every date floored at FY 26-27 |
| 0020 | `invoice_date_ordering.sql` | Invoice date must be the earliest of the three dates. Enforced twice — in the function for the message, in a constraint for the truth |
| 0021 | `first_run_and_org_admin.sql` | Cleared the first-run wall: `create_organization()` made an org with no chapters, and Chapter is required on every voucher, so a new owner met a mandatory empty dropdown |
| 0022 | `product_events.sql` | The product events that make onboarding measurable: `account_created`, `organisation_created`, `chapter_created`, `voucher_drafted`, `voucher_submitted`, `invite_accepted` |
| 0023 | `agent_runs_and_requests.sql` | `agent_runs`, access requests, feature requests — write paths first, dashboards second |
| 0024 | `ai_summaries.sql` | Cache for the model-written read of a person, keyed on a **hash of facts + `PROMPT_VERSION`**, never on time |
| 0025 | `record_every_run.sql` | Record every run and *report* the cap rather than enforce it — 0023's gating version made "total runs" a lie |
| 0026 | `activation_and_operator_views.sql` | The missing activation events, plus five `operator_*` SECURITY DEFINER functions so the operator can see across tenants **without** being able to read a customer's vouchers |
| 0027 | `avatar_column_catchup.sql` | 0006, minus its `handle_new_user` |

### The 0006 / 0027 story — worth knowing, because it is the shape of the next such bug

`profiles.avatar_url` did not exist in production. 0006 added it; 0006 was never applied. Nobody
knew, because nothing referenced the column from a context PostgreSQL validates — until 0026's
`operator_members()`, which is `language sql` and therefore checked at creation time, failed with
`ERROR 42703: column p.avatar_url does not exist`. Meanwhile 0022 had given `handle_new_user()` an
insert into that missing column, and **plpgsql bodies are not checked until they run** — so
**signup was silently broken** from the moment 0022 was applied until 0027 fixed it.

0027 is 0006 minus its `handle_new_user`, because 0022 supersedes that and re-running 0006 wholesale
would have un-recorded `account_created`.

Lesson, generalised: *a `language sql` function is a free schema assertion; a plpgsql one defers the
error to a user.*

All migrations **0001–0027 are applied** as of 2026-08-21, verified by a 13-row check (the column,
nine functions, three triggers). But the project is manual-apply — there is no `supabase db push` —
so drift between the folder and the live schema is normal and must be **checked, not assumed**.
Combined paste scripts for this project should be written re-runnable, because they have already
failed on `ERROR 42710: constraint "dates_not_before_fy2627" already exists`.

---

## 5. The workflow — what is actually true today

This is the product's central claim and both halves of the app were describing an older version of
it for a while. Check anything new against this list.

- **Approval is optional and off by default.** 0013 added `organizations.requires_approval`; 0014
  made it `false` for new orgs and switched it off for existing ones. A new firm's voucher goes
  from submit straight to paid. Never write "two approvals"; never imply approval is on out of the
  box.
- **When approval is on, one signature is enough.** 0015: `approve_voucher` moves `pending_first`
  **or** `pending_second` straight to `approved`. Nothing new ever enters `pending_second`.
- **A voucher locks on submit, not on approval.** `vouchers_update` permits only
  `status in ('draft','rejected')`.
- **The initiator can never approve their own voucher**, rejection **requires a reason**, and
  `approved`/`paid` rows are immutable by trigger.
- **`voucher_audit` has no UPDATE or DELETE policy.** Not even an owner can rewrite history.
- Roles: `member` → `approver` → `admin` → `owner`. An owner may not demote another owner or
  themselves. `role` moves only through `set_user_role()`.
- **Voucher numbers are typed by hand** (0019). `suggestVoucherNo` offers the next one; the field
  accepts or overwrites it. Format `FI/<CHAPTER-CODE>/<FY>/0001`.
- **Every date is floored at 1 April 2026** (0019), so any worked example must be FY 26-27 or later.
- **Invoice date must be the earliest** of invoice / voucher / payment date (0020).

The original v1 shape, for reference, since the audit trail still contains rows from it:

```
draft ──submit──► pending_first ──approve──► pending_second ──approve──► approved ──► paid
  ▲                    │                          │                          │
  └──── reopen ────────┴───────── reject ─────────┘                    (immutable)
```

### Where the two-signature vocabulary still legitimately survives — do not delete it

Rows raised before 0015 can carry `approver_2`, `approved_2_at`, or sit in `pending_second`, and
every reader has to keep handling them. `ApprovalChain` draws its second rung only when one of
those three is true. `STATUS_META`, `StatusBadge`, `AuditTimeline` and `VoucherDocument` all keep
legacy branches and say why in comments. Preview fixture **v-02** is deliberately left as the one
two-approval record so that path stays visible on screen.

Where it was wrong and is now gone: the chain's unconditional fourth rung, the approve toast's "now
waiting for a second approver" and "fully approved", the reopen dialog's "voids both approvals", and
the voucher form's "You no longer type approver names" (a note about v1, shown to firms that never
used v1).

`src/lib/domain/desk.ts` is the **one** brief for what needs doing — used by both the workspace card
and the dashboard headline, carrying three strings per state (`headline`, `detail` which must add
something, `note` which must stand alone) with tests pinning all three apart. Before it, the two
screens ranked the same counts differently and the workspace could not see a rejection at all.

---

## 6. Multi-tenancy and the authorisation model

Before 0012 this was one client's database wearing a role system. `chapters_read` was
`using (auth.uid() is not null)` — any signed-in person from any client saw every chapter — and an
`admin` or `approver` role let someone read every voucher in the whole database.

0012's shape, and why it needed 839 lines:

- **`organizations`** with a per-org `voucher_prefix`; a backfill step that created one org for the
  existing data and stamped every existing row before the `not null` constraints landed.
- **`organization_id`** on `chapters`, `events`, `vouchers` (not null) and on `profiles`
  (**nullable** — that null is exactly "signed up, not yet onboarded", and every policy fails closed
  on it because `organization_id = my_organization_id()` can never match a null).
- **`my_organization_id()`**, a `stable security definer` helper every policy and function uses
  rather than re-deriving the answer.
- **A `before insert` trigger** stamping `organization_id` on chapters, events and vouchers — which
  is why the application code that creates them needed *no* changes and cannot spoof the value.
- **Per-org uniqueness**: chapter name and code, and one head office per org rather than one in the
  whole database.
- **Every `SECURITY DEFINER` function got an explicit org guard.** This was the point of the whole
  exercise: those functions bypass RLS for their own internal queries, so `is_admin()` alone would
  have let an admin of Org A call `rename_chapter(<Org B's chapter id>, …)`. Guarded:
  `submit_voucher`, `approve_voucher`, `reject_voucher`, `reopen_voucher`, `mark_voucher_paid`,
  `set_user_role`, `set_chapter_active`, `rename_chapter`, `soft_delete_voucher`, `restore_voucher`,
  `purge_voucher`, `next_voucher_no`. (`sync_own_avatar` needs none — it only touches the caller.)
- **Onboarding**: `create_organization` (callable only while your `organization_id` is null, so
  nobody can orphan their own membership), `invite_user` (admin/owner, own org only), `accept_invite`
  (token must be unexpired, unaccepted, and match the caller's *verified* JWT email).

**Invites are copy-a-link by choice**, not email — see §15 on Resend.

Reconciliation runs and assistant conversation history needed **no** organization column: both are
strictly private to the user who created them with no admin-override branch anywhere in their RLS.

### The operator boundary (0026) — the most important thing in this section

The operator (us) needs to see across tenants to run the business. Customers' payment records are
not part of that. So:

- Cross-tenant reads go through **`operator_*` SECURITY DEFINER functions**, never through an RLS
  policy. They return counts, durations and one narrow projection.
- **Granting `is_analytics_admin()` on `organizations` / `profiles` / `vouchers` was explicitly
  refused and stays refused.** It would make the operator a reader of every customer's payment
  records as a side effect of counting approvals.
- **Never widen the `operator_*` functions** to expose `paid_to`, `grand_total`, `invoice_no`,
  `voucher_no`, notes or attachments. The privacy boundary *is* what they select.
- `readTenants()` and `readProfileDirectory()` **must never select from `organizations` or
  `profiles` again**. They did, RLS scoped both to the caller's own org, and so `/analytics/orgs`
  rendered exactly one row for months while customers showed as bare email addresses.

---

## 7. Voucher Desk

The first agent, and the rebuild's reason for existing. All **32 business fields**, the amount
formulas and the printed voucher layout are preserved exactly from v1 — they encode a real
accounting process and the PDF is the artefact people sign. Everything around them is rebuilt.

- **Domain layer** — `src/lib/domain/`: formulas, payment rules, GST exclusivity, PAN/GSTIN
  validation, `desk.ts` (the brief), `voucherQuery.ts`, `attachments.ts`, `schema.ts` (Zod).
- **Voucher form** — autosaving drafts (900 ms), live totals, dependent-field rules, inline
  validation.
- **Detail view** — full record, amount ladder, approval chain, immutable audit timeline.
- **List** — server-side search, status/chapter filters, pagination.
- **PDF** — server-rendered *vector* PDF, searchable, ~7 KB (v1 shipped a rasterised screenshot).
  The real CIO Association logo is embedded.
- **Excel export** — v1's 32-column contract preserved (`src/lib/export/columns.ts`), real numbers
  and dates, live totals, respects the active filters.
- **Invoice attachments** — direct-to-Storage upload, signed-URL viewing, and a "no invoice
  attached" warning in the approval queue.
- **Admin** — roles, chapters, invites, and a recycle bin that refuses to destroy approval records.
- **There is no TDS *section* field on a voucher**, only a `tds` amount. 194C/H/J live in the
  assistant's calculator, not the form; the site must not claim the desk derives a section or rate.

### What v1 got wrong, and where it is fixed

| v1 | v2 |
|---|---|
| "Approvals" were free-text name boxes typed by whoever created the voucher; a voucher could be self-approved by typing a colleague's name | Enforced in Postgres, with identity, timestamps, a rejection path and an audit trail |
| `event_id`/`event_date` silently dropped on insert — re-downloaded PDFs had a blank Event Date | Both persisted; `event_id` is a real FK |
| Voucher numbers hand-typed with duplicates possible | Unique per org, format enforced, suggestion generated |
| `net_total`/`grand_total` computed in JS and trusted | Postgres generated columns — cannot drift |
| Events/chapters per-user, so staff kept diverging lists | Org-level |
| Sheet sync failures swallowed by `.catch(() => {})` | `sheet_sync_log`, every attempt recorded and retryable |
| No schema in the repo; RLS only in the dashboard | 27 reviewable migrations, parse-checked in CI |
| No invoice attachment anywhere | Supabase Storage, access mirroring the voucher |
| No tests | 735 |

### One more, found while building the settings screen

`profiles_update_self` let anyone update their own profile row. RLS is *row*-level — it decides which
rows an UPDATE may touch, never which columns — so on its own it also permitted
`update profiles set role = 'owner' where id = auth.uid()`. Since `current_role_of()` reads exactly
that column, any signed-in member could have taken over the authorisation model with one REST call.
Restricting columns needs a column-level `GRANT`, which `0003_rls.sql` now does: only `full_name` is
self-writable, and `role` moves solely through `set_user_role()`.

---

## 8. Ledger Reconciliation

Two ledgers in, a Bank Reconciliation Statement out. A port of a Python + React tool that ran as a
separate FastAPI service, rebuilt as a TypeScript engine that runs **entirely in the browser** —
`src/lib/recon`, 140 tests, nothing in it touching the network, the database or the DOM. That purity
is what makes a reconciliation reproducible: the same two files reconcile to the same statement
every time.

- **Parsing** — Excel and CSV through SheetJS; PDF through pdf.js. The PDF reader rebuilds a
  **borderless** table from word coordinates, because that is what a bank statement is: no ruled
  lines, just text that happens to line up. Scanned PDFs are refused with an explanation rather than
  returning an empty ledger.
- **Matching** — six passes, strongest evidence first: shared reference → narration + amount →
  narration alone → contra amount → any amount → one-sided.
- **The statement** — computed in one signed debit-positive space and projected onto the starting
  ledger's side, so a credit-balance start needs no separate rule. **Contra ledgers** are detected
  from the entries the two books share, not from their closing balances, which a single timing
  difference can flip.
- **Exports** — a PDF working paper and a three-sheet workbook, both rendered server-side from a
  posted result, plus a CSV of whatever the differences table is showing.
- **History** — saved to `reconciliations` (0008), private to whoever ran it (`created_by =
  auth.uid()`, **no admin override**), never updatable.
- `npm run recon:sample` writes sample ledgers to `scratch/` as CSV and borderless PDFs; the PDF
  parser's own tests read those back and skip themselves if they have not been generated.

**Files never leave the reader's machine.** For client bank statements that is a better answer than
a server-side session, and it also removed the in-memory store the original lost on every restart.

---

## 9. Ask — the assistant

Not a third agent: a layer across the other two. A chat panel on every signed-in screen and a page
of its own at `/ask`. `src/lib/assist`, **262 tests**. Signed-in only, because an unauthenticated
endpoint that spends somebody else's API quota is a bill waiting to happen.

- **One file knows whose API it is** — `src/lib/assist/anthropic.ts`. Everything else is
  provider-agnostic and has proved it twice: OpenAI → Gemini → Anthropic, without retrieval, the
  prompt, the tools, the event stream, the markdown renderer or a single component changing.
- **It may not invent.** Every claim about this platform has to come from a retrieved document, and
  the interface shows the reader which. The corpus is partly *generated* from `AGENTS`, so the
  assistant cannot describe a roadmap tool as available or promise something the marketing page
  stopped claiming.
- **It does no arithmetic.** Six tools are exposed to the model and they call `calcGrandTotal`,
  `gstMode`, `isValidGstin`, `fiscalYear` and the rest directly — the same code the form uses and
  the database mirrors. The working is printed under the answer with its inputs.
- **It is careful about statute.** Rates, sections and due dates are stated only where the site
  already commits to them, always with the note to confirm the current position.
- **Retrieval is lexical, not embeddings, on purpose.** The corpus is thirty documents we wrote, and
  the same question has to reach the same documents every time or the tests are asserting about the
  weather. A retrieval miss is fixed by adding a keyword, which is a thing a person can do.
- **Markdown is parsed to a tree and rendered as React elements.** Nothing the model writes reaches
  the HTML parser, and a link is only a link when it points inside this app.
- **History** (0009) is written by the route *as the answer streams*, so what is stored is byte for
  byte what was on screen; a question whose answer failed is never written. No update policy.
  Nothing expires on its own, which is why `/ask/history` carries a delete-everything control
  rather than a retention rule invented on somebody's behalf.
- **Streaming detail worth keeping:** a tool call's arguments arrive as fragments of JSON text
  against a `content_block` and are only complete at `content_block_stop`. `anthropic.ts` assembles
  each block in a map keyed by index and parses once, at that point. Several tool calls in one turn
  go back as **one** assistant message and all their results as **one** user message — splitting
  them interleaves calls and results, which the API rejects. Extended thinking is not wired up, and
  because the code only reads `text_delta`, a thinking block is dropped by construction rather than
  by a special case someone could forget.
- Model defaults to `claude-opus-5`; `ANTHROPIC_MODEL` moves it. Without `ANTHROPIC_API_KEY` the
  panel says it is not switched on and nothing else is affected. In preview mode with no key it
  streams a clearly labelled sample built from whatever retrieval found — which is how the interface
  was built, and why the whole pipeline can be exercised without spending anything.

---

## 10. Visitor intelligence — the `(insight)` section

First-party web analytics plus an engine that works out which **company** is behind an anonymous
visit. Migration 0010, `src/lib/analytics`, the tracker in `public/a.js`, and seven screens under
`/analytics` (two with drill-downs).

There is no Google Analytics and no third-party pixel of any kind. Our own script, our own cookie,
our own endpoints, our own database — which is why "first-party" means something here rather than
being a claim on a privacy page.

**Who may read it.** The allowlist is a **table** (`analytics_admins`, seeded with
`krishna.ladha18@gmail.com`), and `is_analytics_admin()` is called by every select policy in 0010
*and* by the application. One list, so what the navigation shows and what Postgres will hand over
cannot drift apart — the usual way admin-gated interface quietly starts lying. Being an `owner` of
the voucher workflow grants nothing here; approving a payment is not a reason to be shown who read
the pricing page. Adding a colleague is one `INSERT`, no deploy.

**Nobody writes to it directly either.** The beacon is unauthenticated by necessity, so an `anon`
insert policy would let anybody with the publishable key write whatever they liked into the visitor
record. There are **no insert policies on the event tables at all** — every write goes through a
`SECURITY DEFINER` function that decides for itself what a row may contain.

**`(insight)/layout.tsx` calls `notFound()`** for a signed-in non-admin rather than redirecting,
deliberately, so that nothing reveals there *is* an `/analytics`. That 404 is their cover story —
which is why the root `not-found.tsx` copy must stay generic and name no record type (see §13).

### The gate is the product

An IP resolving to an organisation name does not mean that organisation employs the visitor. It
might be their broadband provider, their mobile carrier, a cloud host running somebody else's
crawler, or a security proxy a thousand unrelated companies route through. Reporting any of those as
an account that visited your pricing page is the false positive that ends the feature's credibility
the first time a salesperson sees it.

So every address is classified first, and only `business`, `education` and `government` may ever
surface a name. Past that gate, **`qualifies()` requires at least one *observed* method** —
`reverse_dns` or `ip_intel_company`. Expect roughly a fifth to two fifths of real traffic to
resolve. **That gap is the gate working**, and the instinct to widen it until the screen fills is
the one change that would make every row worthless. Every resolution carries the list of reasons it
did or did not identify somebody, which is what makes the refusals readable as answers rather than
as failures. The classification and scoring are unit-tested entirely offline by injecting fake
provider responses — see `src/lib/analytics/ip/gate.test.ts`, where most assertions are about a
refusal rather than a result.

#### The fabrication, 2026-08-21 — do not undo the fix

The live screen was showing invented companies ("Hostroyale Technologies", "steel-axis LLC",
"truview LLC", "IPPN HOLDINGS LTD"). All datacentre scanner traffic. The chain: `IPINFO_TOKEN` is
**not set**, so `fetchIntel()` always returns null, which silently turned both provider-side
suppression gates in `classify.ts` into dead code; classification fell to the netblock-size
fallback; `guessDomain()` invented a domain from the registry name; `qualifies()` passed it on its
registrant-backed tier; then free enrichment fetched that invented domain, found a real unrelated
website, and `Company.tsx` displayed *its* name in preference.

**Diagnostic signature: every fabricated row read exactly 60% / 1 signal** (0.55 registrant + 0.05
small-block, floored at 0.60). If that ever reappears, this is what it is.

Fixed in `d477b24` and `14cc944`: both weak tiers removed — *including* two-methods-agreeing,
because `rdap_registrant` and `org_name_guess` are the same `guessDomain()` transformation over two
spellings of one name. `RESOLVER_VERSION` → 2 so cached fabrications re-resolve.
`/analytics/companies` deleted. **Setting `IPINFO_TOKEN` (free tier, 50k/month) is the correct way
to widen the gate; lowering the bar in `qualifies()` is not.**

Also removed as structurally unmeasurable: the "Watched the video" KPI (no `<video>` element exists
anywhere on the site) and the Campaigns/UTM panel (no UTM-tagged link is generated anywhere).

`src/lib/preview/resolutions.test.ts` puts every preview fixture through the real `qualifies()`. If
that test fails, the fixtures are claiming an identification the gate refuses.

### Never fabricate a person

An anonymous visitor becomes a named person only when something proves it: a sign-in, a form
submission, or a token-gated webhook. Those create `deterministic` edges, and only those may merge
two identities. Sharing an IP or a device fingerprint creates a `co_occurrence` edge, which is
**recorded and never read by the resolver** — because the classic way an identity graph destroys
itself is one coincidental shared office-wifi address silently fusing two people's histories.

What that buys: the moment somebody signs in, everything they read beforehand becomes theirs,
because it was all keyed on a visitor id their browser was carrying the whole time. What it does not
buy is naming a stranger. That needs a licensed identity graph or a publisher co-op; the plug point
(`ANALYTICS_COOP_FILE`) is a file reader shaped exactly like one, so wiring a real feed in later is
a procurement decision rather than an engineering project.

### Money, and privacy

Free enrichment runs for every identified visitor and costs nothing: the company's own homepage, its
schema.org and OpenGraph data, a tech-stack fingerprint. **Headcount and revenue for a private
company are left empty rather than estimated**, because an honest gap is not a bug. Paid enrichment
lives in its own file nothing else imports, has exactly one call site — a button on one named
account — and every call writes a row to `enrichment_spend` with the name of the person who caused
it, because a rule about deliberate spending is only true if someone can check it afterwards. Paid
enrichment and AI sort are gated to `?who=them`, since spending Apollo credits to be told who works
here shows up on an invoice.

**DNT and GPC are honoured unconditionally** — no cookie, no identifier, no request; not a reduced
mode. Visitors whose timezone suggests a jurisdiction that expects to be asked get a dismissible
card, and declining wipes the identifier that already exists rather than only the ones that would
have. Both leave permanent, deliberate gaps in these numbers.

### The twelve decisions behind the current shape

Rebuilt 2026-08-21 from a 413-line spec of Position2's own admin analytics, cut from fourteen
screens to eight (rendering as seven plus two drill-downs). Deleted: `/analytics/companies`
(fabricated data), `/analytics/members` (duplicate roster), `/analytics/agents` (allowance against
an unenforced cap, with no billing), `/analytics/internal` (folded into usage),
`/analytics/behaviour` (folded into public site). Shared kit in `src/components/analytics/`
(`Kpi`, `People`, `Journey`, `Activation`) plus `src/components/ui/Drawer.tsx`; aggregation in
`src/lib/analytics/{people,tenants,ai,meter,caps,identity,funnel}.ts`.

**Do not "fix" any of the following without reading the reason:**

1. **"Visits", never "logins".** Supabase exposes no per-sign-in feed and this schema never recorded
   one, so the screens count activity separated by a 30-minute gap, and say so.
2. **RSC, not the spec's shell-plus-`/data`-fetch.** That pattern exists because Flask could not
   stream HTML. No client fetch and no Refresh button — reloading *is* the refresh.
3. **`record_agent_run` records every run and never refuses one** (0025). The allowance is reported,
   not enforced.
4. **The AI summary cache is keyed on a hash of facts plus `PROMPT_VERSION`, never on time.**
5. **The activation funnel is five steps, not seven.** `chapter_created` and `voucher_approved` are
   excluded because 0021 seeds the head-office chapter and 0013 lets a submitted voucher go straight
   to paid — neither is a prerequisite, and a funnel step asserts the step above it was required.
   Both are reported separately. Step one counts *people* (`account_created` is written before
   anybody belongs to an org); steps two onward count *organisations*; the screen labels the unit on
   every bar.
6. **Operator cross-tenant reads go through `operator_*`, never an RLS policy.** (See §6.)
7. **`readTenants()` / `readProfileDirectory()` must never select from `organizations` or
   `profiles`.** Same trap as 6, seen from the application side.
8. **`Person.organisation` and `Person.company` are different claims and may disagree** — the
   workspace on their profile row versus their email domain. A consultant at `acme.com` inside a
   workspace called Northwind is a real shape; collapsing them hides it.
9. **Behaviour lost the video, search-terms and rage-click cards.** The first two are unmeasurable
   by construction (no video element exists; the only search box is the auth-gated command palette,
   while that screen reads the anonymous log). Rage clicks are a real signal removed only for
   volume — the aggregation is still in `aggregate.ts` and should come back when traffic supports
   it.
10. **Usage is one screen with a `?who=` segment**, never two screens and never an "everyone" tab.
    The us/them split is by the `analytics_admins` allowlist, and exists because a
    customer-success figure that folds our own demonstrating and fixing into adoption reads as
    adoption when it is not. The combined number is the misleading one, so it is not offered.
    Segment and window are both URL params and each carries the other through (`query()` in
    `Window.tsx`) — a screen whose state lives in `useState` cannot be linked to, and an analytics
    finding is something people send each other. Reads are scoped *before* aggregation so no figure
    on one tab can be built from the other tab's rows.
11. **Paid enrichment and AI sort are gated to `who === 'them'`.**
12. **The staff screen's raw log was dropped, its five quick facts kept.** The profile drawer
    already answers "what has this person been doing". The busiest-weekday fact is the one figure in
    the section that has ever changed behaviour: it is when not to deploy.

Three defects only the rendered page showed, worth remembering as a class: `product_events` (0022)
and the five `operator_*` functions (0026) had no preview stand-in, so three screens rendered as
zeros until `lib/preview/operator.ts` derived them from the vouchers, the audit trail and the
profiles; milestones must be derived from the **voucher row** (what the trigger sees), not its audit
trail, because two fixtures are paid with no `marked_paid` entry; and three cards disagreed about
paid vouchers because `distinctVouchers()` reads `meta.voucher` and the derived events carried none.

---

## 11. Preview mode — how the app is looked at without a database

`NEXT_PUBLIC_PREVIEW_MODE=1` runs the whole app on fixtures with no Supabase at all, signed in as an
owner, so every screen is reachable. An amber banner marks it throughout.

It is an **authentication bypass by definition**, so it is deliberately impossible to enable on a
deployed instance: it requires the flag **and** a non-production build, and `next build` /
`next start` both set `NODE_ENV=production`. **Do not relax that double gate.** It also proves
nothing about RLS, triggers, generated columns or constraints, all of which are absent.

`src/lib/preview/` holds the client, the fixtures, `operator.ts` (which derives the 0022 product
events and the five 0026 `operator_*` results from the vouchers, the audit trail and the profiles —
without it, three analytics screens render as zeros) and `resolutions.ts`.

**`.env.local` must be committed-clean at `NEXT_PUBLIC_PREVIEW_MODE=0`.** The flag has regressed in
the working tree before. `.env.local` is gitignored and holds only the Supabase URL, the anon key
and that flag — no service-role key, ever.

### Serving it in a browser from a foreign working directory

This project went unseen in a browser for most of its life on the belief that the tooling "cannot
serve it". It can, and two passes then found roughly fifteen defects that `tsc`, `eslint` and 714
tests were all blind to.

- **Public pages** — `npm run build`, then `next start --port 3002`, launched through
  `cmd /c cd /d C:\Users\krish\NVRTEC~1\NVR-VO~2 && npx next start --port 3002`. The **8.3 short
  path** avoids the space in "NVR Tech", which otherwise fails as `'C:\Program' is not recognized`;
  `cmd /c cd /d` gives the process a real cwd, which `npm --prefix` does not. Rebuild and restart
  after every edit.
- **Signed-in pages** need preview mode, which needs `NODE_ENV !== production`, so `next start` can
  never show them. Run `npx next dev --webpack --port 3001` in the background and attach a
  url-only preview config; a supervised `preview_start` kills the dev server seconds after Ready.
- **Never `next dev` with Turbopack here.** It panics with
  `FileSystemPath("").join("../../NVR Tech/nvr-voucher-v2") leaves the filesystem root` on every
  request, and the panic loop once spawned **1,865 orphan `node.exe` workers** holding several GB,
  which made `tsc` and `eslint` die with `FATAL ERROR: Zone Allocation failed`. `--webpack` has none
  of it. Clean up by matching on the *command line*, never `Get-Process node`, then
  `rm -rf .next/types .next/dev` — a half-written `.next/types/validator.ts` makes `tsc` fail with
  `Type 'Route' does not satisfy the constraint 'never'` in files you never touched.
- Next 16 refuses a **second** `next dev` in the same directory, so preview-on and preview-off
  cannot run side by side; kill by the printed PID and restart with the other flag.
- Fixtures live on `globalThis` — **restart the dev server after editing them**, or you will read
  the old data and think your change failed.
- The preview banner adds ~61px to the top of every page. Subtract it before believing an overlap.

---

## 12. Responsive rules — the hard-won ones

All 36 routes were read at 375×812, then again at 768 and 1024, on 2026-08-22 (`4e83e4e`,
`f170385`, `7021025`, `e89422e`).

> **The touch band is 640–1023, not 0–639.** `MobileDock` is `lg:hidden`, so this app's own answer
> to "thumb or pointer?" is "is the dock showing?" — and it shows up to 1024. **Size every tap
> target and form control against `lg`, never `sm`.** The first pass got this wrong and gave every
> iPad a bottom dock with 28px icon buttons and 38px fields above it.

Six defect classes, none of which `tsc`, `eslint` or 735 tests can see:

1. **A control under 16px makes iOS Safari zoom in on focus and never zoom back out.** Every text
   field in the product was under it. The shared `CONTROL` in `src/components/ui/primitives.tsx` is
   now `text-base … lg:text-sm`. Watch for per-call-site overrides that defeat it —
   `ColumnStep`'s `text-[13px]` did.
2. **`flex-1` inside a `flex-col` parent sets height, not width.** It silently overrode `h-11` on the
   contact page's two CTAs and split the container 22px each. Any `flex-col sm:flex-row` container
   whose children carry an unprefixed `flex-1` has this bug.
3. **A table with an action column clips the action, not just the data.** `overflow-x-auto` means
   the row scrolls; it does not mean the button is reachable. Chapters hid Retire; the recycle bin
   hid Restore. Folding a column into another cell is *not* enough — auto table layout still gives
   the name column its min-content width. What works: `Tr` becomes
   `grid grid-cols-[minmax(0,1fr)_auto] … sm:table-row`, cells get explicit `col-start`/`row-start`
   plus `px-0 py-0 sm:px-4 sm:py-3`, and `Thead` gets `hidden sm:table-header-group`. `cn` is
   `twMerge`, so the later class wins and the `sm:` variant still applies.
4. **The breakpoint where chrome *arrives* is the one that overflows.** At exactly 1024 the rail
   appears *and* `HomeCrumb` gains the platform name — ~400px of new chrome at one width — and the
   top bar carried 73px more than it had room for, so every signed-in page scrolled sideways with
   "Sat, 22 Aug" wrapped two characters wide. Same shape on the public header at `md`, where three
   nav links arrive and flex shrank "Sign in" into two lines. **Test the exact breakpoint values,
   not just 375/768/1280.**
5. **`shrink-0` beside a sibling with no `min-w-0` does not do what the comment says.** `HomeCrumb`
   is `shrink-0` so "the search box gives up the space" — but the search box had `min-width: auto`
   and stopped at its content width, so neither yielded. A flex item cannot shrink below min-content
   without `min-w-0`.
6. **A dock cell is ~61px at six items.** Measure the *label*, not the cell: "Organisations" needed
   68px and "Access requests" was the only label wrapping to two lines. `NavItem.short` feeds the
   dock while `label` stays the `aria-label` — and the abbreviation is scoped `sm:hidden`, because a
   tablet cell is 125px and holds the real word.

**Deliberately left scrolling sideways — do not "fix" these:** the ledger `DifferenceTable`, the
operator metrics tables on `/analytics/activation`, the visitor table, and the home page product
mockup. The first three are comparison matrices whose whole point is columns side by side; the
mockup is a scaled screenshot of the desktop UI and says so in its own comment.

**Method that worked:** write a probe to `public/__mobile-probe.js`, then per page run
`(()=>{const x=new XMLHttpRequest();x.open('GET','/__mobile-probe.js',false);x.send();return eval(x.responseText)})()`
after navigating. Synchronous XHR keeps it to one small call per page instead of re-pasting the
probe. It reports page `scrollWidth - innerWidth`, elements whose right edge passes the viewport with
no scrollable ancestor, tap targets under 38px, text under 11.5px, active horizontal scrollers, and
fixed-bottom-bar height. **Delete the file from `public/` before committing.** Do *not* try to sweep
routes in an iframe — assigning `iframe.src` makes the inspector report "Inspected target navigated
or closed" and reload the top page, losing every global.

---

## 13. Copy rules

The audience is chartered accountants, who check. A site that undersells a shipped product is the
more expensive failure than one that oversells, because nobody ever complains about it.

- Everything the public site says about itself lives in **`src/lib/marketing/content.ts`** —
  including the agent roster — so the product name and positioning are one file rather than a
  search-and-replace.
- **Never write "two approvals"** or imply approval is on by default. See §5.
- **Chapter codes are per-org.** `CIO` was the one pre-multi-tenant client's code and must not
  appear in examples.
- **Worked examples must be FY 26-27 or later.** Anything dated 25-26 is a demo a reader cannot
  reproduce, because 0019 floors every date at 1 April 2026.
- **The strong claims are all real** and may be made: `gst_mode_exclusive` and `cgst_sgst_paired`
  are table CHECK constraints, `net_total` and `grand_total` are generated columns, the export is 32
  columns in `lib/export/columns.ts`, the region is `bom1` / `ap-south-1`.
- **Reconciliation ledgers are parsed in the browser** (`Workbench` is a client component); only the
  resulting statement is persisted.
- **The root `not-found.tsx` must name no record type.** It serves the whole signed-in app: any
  mistyped URL plus six `notFound()` calls (voucher, organisation, visitor and reconciliation ids,
  and the analytics gate). Because `(insight)/layout.tsx` 404s a signed-in non-admin deliberately,
  that page is their cover story. Current copy: *"The link may be out of date. Whatever it pointed
  at may have been deleted, or it may belong to somebody whose records you cannot see."*
- Governing law and jurisdiction were **deliberately left out of Terms** — the company's decision,
  not something to infer from a hosting region.
- The privacy and terms pages are deliberately generic summaries.
- The `ROSTER` helper exposes `live`/`coming`/`total` for mono micro-labels, `liveWord`/`comingWord`/
  `totalWord` for mid-sentence prose, `liveOpen`/`comingOpen` for sentence-initial positions, and
  `liveVerb`/`comingVerb` for agreement. Use it; never type the count.

---

## 14. Invariants — do not relax these

1. **Never commit a secret.** The Supabase connection string contains the database password. Never
   put a service-role key in `.env.local`. Never ask the user to paste a secret into chat.
2. **`NEXT_PUBLIC_PREVIEW_MODE` stays `0`** in the working tree. It has regressed before.
3. **Preview mode's double gate stays double** — flag *and* non-production build.
4. **Do not relax `qualifies()`.** Setting `IPINFO_TOKEN` is the correct way to widen the
   identification gate. (§10.)
5. **Never widen the `operator_*` functions** to expose `paid_to`, `grand_total`, `invoice_no`,
   `voucher_no`, notes or attachments.
6. **`is_analytics_admin()` is not granted on `organizations` / `profiles` / `vouchers`.** Refused
   once, stays refused.
7. **`(insight)/layout.tsx` keeps `notFound()`**, not a redirect — nothing may reveal that
   `/analytics` exists. Which is why §13's 404 rule holds.
8. **`voucher_audit`, `assist_turns`, `assist_conversations` and `reconciliations` stay
   append-only.** No update policies.
9. **`role` moves only through `set_user_role()`**, and only `full_name` is self-writable on
   `profiles` — enforced by a column-level `GRANT`, because RLS is row-level and can never restrict
   columns.
10. **Every new `SECURITY DEFINER` function needs an explicit `organization_id` guard**, not just a
    role check.
11. **Apply the migration before merging the code that needs it.** Code reaching production ahead of
    its schema is the normal case here, not an accident.

---

## 15. Environment variables

Required:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon key is public by design;
  every rule that matters is in RLS and the `SECURITY DEFINER` functions.
- `NEXT_PUBLIC_PREVIEW_MODE` — `0` in the tree.

Optional, and the app is fully functional without every one of them:

| Variable | Effect when unset |
|---|---|
| `ANTHROPIC_API_KEY` | The Ask panel says it is not switched on; nothing else affected |
| `ANTHROPIC_MODEL` / `ANTHROPIC_BASE_URL` | Defaults to `claude-opus-5` / Anthropic |
| `IPINFO_TOKEN` | Resolution falls back to reverse DNS and RDAP (free, no key). Identifies fewer visitors — the honest trade. **Currently unset.** |
| `APOLLO_API_KEY` | The single "Enrich further" button is inert |
| `ANALYTICS_IDENTIFY_TOKEN` | `POST /api/identify` answers 404 and does not exist |
| `ANALYTICS_EXCLUDE_ORGS` | Lets a newly spotted hosting false positive be patched today rather than at the next deploy |
| `ANALYTICS_CONTACT_EMAIL` / `ANALYTICS_REGISTRY_LOOKUP` | Registry lookup stays off |
| `ANALYTICS_COOP_FILE` | A visitor who never interacted with us stays anonymous |
| `ERROR_ALERT_WEBHOOK_URL` | A caught error is only visible to whoever opens `/analytics/errors` |
| `RESEND_API_KEY` + `NOTIFY_FROM_EMAIL` | Nothing is sent and nothing breaks; every send site is best-effort and a workflow step never fails because mail did. `/admin` notices and keeps telling admins to copy the invite link by hand |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` | The Sheets sync worker is not built yet anyway |

**Who may read the analytics is not configured here** — that list is the `analytics_admins` table,
so the application and the row-level policies cannot end up disagreeing.

---

## 16. Commands and verification

```bash
npm install
cp .env.example .env.local     # fill in Supabase values
npm run dev
```

| Command | What it does |
|---|---|
| `npm run check` | lint → parse-check every migration → test → production build. The gate. |
| `npm run lint` | `eslint src --max-warnings 0` |
| `npm run check:sql` | Parses every migration with `pgsql-parser`. **Parse-checked, not executed** |
| `npm run test` | Vitest — currently **46 files / 735 tests**, ~9s |
| `npm run recon:sample` | Sample ledgers + a reconciliation into `scratch/` |
| `npm run pdf:sample` / `xlsx:sample` | Sample voucher PDF / export workbook |
| `npm run brand:icons` | Regenerates the brand marks |

Then verify visually — §12's method, §11's serving recipe. Three consecutive passes over these
screens missed every one of §12's defects because nothing had ever opened them at a phone width.

Also useful: `npx tsc --noEmit`. Note that the production build currently compiles **42/42 static
pages**.

---

## 17. Operational facts that cost real time when forgotten

**The region is not a preference.** Vercel defaults functions to `iad1` (Virginia); the Supabase
project is in `ap-south-1` (Mumbai). Every signed-in page makes four round trips to Supabase before
it can send a byte — the proxy validates the session, `getCurrentUser()` validates it again and
reads the profile, then the page runs its own queries — and on the default region each crossed the
planet at ~220 ms a turn. `vercel.json` pins `bom1`. **If the Supabase project ever moves, move
this with it**; a mismatch is invisible in the code and costs about a second a page.

**If the deployment URL changes, sign-in breaks, and the failure is thoroughly misleading.**
Renaming the Vercel project changes the `*.vercel.app` host and **Supabase will not follow**. Two
fields under **Authentication → URL Configuration** must be edited by hand: **Site URL** (the new
origin) and **Redirect URLs** (`<new origin>/**`, keeping `http://localhost:3000/**`).
`signInWithOAuth` passes `window.location.origin` as `redirect_to`, which is correct — but Supabase
checks it against the allow-list and **silently discards it if absent**, falling back to Site URL.
With Site URL left at its default, a successful Google sign-in sends the browser to
`http://localhost:3000` and the user sees `ERR_CONNECTION_REFUSED` from their own machine. Nothing
is logged anywhere and the app is not involved in the redirect, so the repository looks blameless —
it is. Read the live configuration without dashboard access by asking the auth API to resolve a
`redirect_to` (a deliberately invalid token consumes nothing):

```bash
curl -s -o /dev/null -w '%{redirect_url}\n' -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/verify?token=invalid&type=recovery&redirect_to=https%3A%2F%2Fyour-host%2Fauth%2Fcallback"
```

The URL echoed back is the one Supabase would actually use. Google Cloud Console needs nothing —
Google returns to `https://<project>.supabase.co/auth/v1/callback`, which does not vary with the
app's own domain.

**Voucher numbers issued before 0007 keep their `NVR/` prefix permanently**, and the run of numbers
continued unbroken across the rename. Both are deliberate: a voucher number is the identifier an
approved voucher was signed and filed under, and ours are printed on PDFs and quoted in audit
trails.

**The live organisation already has a full chapter list** — a head-office row coded `HO` with
`is_head_office = true`, plus city chapters, all active, carried over by the 0012 backfill. 0021's
head-office seeding only fires for organisations created after it, so it was never needed for this
tenant; do not raise it as a gap again.

---

## 18. Status

**Built and working:** the full schema/workflow/RLS stack (27 migrations); the domain layer; auth
including Google OAuth and its callback, route protection and a role-aware shell; onboarding
(create-an-org or accept-an-invite); the hub; settings; light and dark themes applied before first
paint; the role-aware dashboard; the approval queue with ageing and blocked-reason explanations; the
voucher form, detail view and list; the vector PDF; the admin screens; the Excel export; invoice
attachments; error, not-found and loading states; the public marketing site with a generated social
card, sitemap and robots; Ledger Reconciliation end to end; Ask; visitor intelligence and the
operator analytics section; cross-instance rate limiting and error logging.

**Not built:** the Google Sheets sync worker. Four of the six agents are roadmap entries and every
page says so.

**Verified against the live database:** every migration 0001–0027 applied; sign-up, Google OAuth,
voucher creation and submission exercised end to end.

**Still only exercised in preview mode, never against Postgres:** approval and rejection (both need
a second and third account, since the segregation-of-duties rules deliberately prevent one person
from testing them), plus reopen, mark-paid, PDF, Excel export, attachment upload, saving a
reconciliation, and saving an assistant conversation. The last was exercised in full against the
preview client — asked, saved, reopened with tool traces and source chips intact, continued into the
same conversation, deleted. That proves the components and the queries agree on a shape. It proves
nothing about the policies, which only Postgres enforces.

---

## 19. Open items

Needing the user's confirmation or a dashboard check:

1. **Migration 0018's two verification queries** — the owner-gate check on `purge_voucher`, and the
   `storage.buckets` `file_size_limit` / `allowed_mime_types` check on the `invoices` bucket. 0018
   itself was run; these were never confirmed.
2. **Supabase Database → Backups** — point-in-time recovery status and retention window. Manual
   dashboard check, never confirmed.
3. **Supabase's built-in auth mailer is the sharper email risk.** Signup confirmation, password
   reset and email-change go through Supabase's own SMTP, not the notify module — so they work
   today, but that default mailer is heavily rate-limited and Supabase says it is not for
   production. A single Resend account would fix this *and* item 4, since its SMTP credentials can
   back Supabase's custom SMTP setting.
4. **Resend was deliberately skipped** (2026-08-21) — the user's decision, not an oversight. Do not
   re-raise it as a gap. Setting `RESEND_API_KEY` + `NOTIFY_FROM_EMAIL` would switch on four emails
   (approver told a voucher waits, raiser told approved, raiser told sent back, invite). The trigger
   for revisiting is an approver who will not log in unprompted.

Flagged and awaiting a decision, not started:

5. **The legal pages' reading measure.** `lg:grid-cols-[13.5rem_minmax(0,64ch)]` resolves `64ch`
   against the grid container's 16px while clause bodies are 14.5px, so the measure is ~88
   characters at every width ≥ `lg`, not 64. Narrowing to ~72 would be a real typographic
   improvement and a visible desktop change.
6. **At exactly 1024** an iPad in landscape crosses into the pointer layout (rail, 14px controls).
   Pre-existing and deliberate-looking; `xl` is the lever if it should move.
7. **Per-tenant retention as a weeks-active grid**, and **assistant outcome measurement** —
   `agent_runs` counts opens only; nothing records whether an answer was produced, refused or
   errored. Both are new measurement rather than corrections.
8. **Rage clicks** should come back to the behaviour screen when traffic supports it; the
   aggregation is still in `aggregate.ts`.

**The one strategic question, unresolved and deliberately not re-litigated:** the architecture is
self-serve multi-tenant SaaS, but the funnel is sales-led — six "Book a walkthrough" CTAs against
one "Create an account", none in the site header, no pricing page — and **there is no billing wired
at all**, so every signup is a permanent free tenant. Approval, which the whole marketing narrative
rests on, is off by default per 0014. Sales-led → gate or close public signup, and the setup gaps
matter far less because clients get configured on a call. Self-serve → billing is the missing half
of the business. The 0022 product events are what turn this from opinion into data.

---

## 20. How this repository is worked on

- **Commit messages are sentences about intent, not summaries of the diff.** "Stop the 404 naming a
  record it has no way to know about", "Treat the tablet as touched, and stop the bar overflowing at
  1024", "Refuse to name a company off a domain we guessed". Read `git log --oneline` for the house
  style; it is consistent across 80+ commits.
- **Comments explain the *why*, at length, where the why is not obvious** — and there is a lot of
  that in this codebase, deliberately. Several of the bugs in §12 and §10 existed *because* a
  comment described an intended mechanism that had never actually been wired up. When a comment
  already describes the intent, make the mechanism work rather than inventing a new one.
- **One place for each fact.** `AGENTS` for the roster, `desk.ts` for the brief, `columns.ts` for
  the export contract, `analytics_admins` for who may read analytics, `content.ts` for what the site
  claims. Duplication here is how the interface starts lying.
- **When a migration changes the workflow, grep both halves of the app**, not just the SQL — then
  look at it in a browser.
- **Finish the work, then commit and push without asking.** Standing instruction.
- **Static checks are necessary and not sufficient.** `tsc`, `eslint` and 735 tests were green the
  whole time the phone could not be used to fill in a voucher without the browser zooming, two admin
  screens hid their primary buttons off-screen, the approval queue offered an unlabelled red X
  beside the green tick, and every signed-in page scrolled sideways at exactly iPad-landscape width.

---

## 21. History, in phases

`git log --oneline` is the real record; this is the shape of it, oldest first.

1. **The rebuild** (`ec46bcd` → `9c92a08`) — schema, workflow enforced in Postgres, RLS, the voucher
   form with autosave, the detail view and audit timeline, the filterable list, the vector PDF, the
   invoice attachments, the Excel export, the admin screens.
2. **Dressing and preview mode** (`236fc02` → `9fc1580`) — the screens that were linked but never
   built, plus the fixtures that let the whole app be looked at with no database.
3. **A public face** (`3e56a02` → `0781979`) — the marketing site, one typeface, rules you can
   drive, the sign-in surface, then a rewrite of the copy so a person sounds like they wrote it.
4. **The signed-in app rebuilt around a rail** (`95ce27b` → `1325f1a`) — the hub as the landing
   place, the command palette, real instrumentation, identity cards and avatars.
5. **The second and third tools** (`886e85d` → `6fe78dc`) — Ledger Reconciliation, then Ask, which
   moved provider twice (OpenAI → Gemini → Anthropic) without anything but one file changing.
6. **Visitor intelligence** (`45d3aca` → `eb898dd`) — the tracker, the identification gate, the
   allowlist and the door on the analytics screens.
7. **Legal and operations** (`73be9c7` → `7ec3b21`) — privacy, terms, error monitoring, rate
   limiting, the real domain and one real mailbox.
8. **Multi-tenancy** (`21bf648` → `eddbb81`) — the 839-line conversion, then the approval policy
   settling: optional, off by default, one signature.
9. **Readiness audits** (`d86a07e` → `46cf848`) — manual voucher numbers, the FY 26-27 floor, the
   audit-edit log, owner-only purge, the printed CIO voucher.
10. **The analytics rebuild and its correction** (`b3445c4` → `f3409d5`) — eight screens from a
    fourteen-screen spec, then the removal of every fabricated company name.
11. **Responsive and copy passes** (`fe2d8c6` → `f41275a`) — the public copy re-grounded in the
    schema, then all 36 routes read at 375, 768 and 1024, then the 404 copy, then Analytics offered
    from the workspace and not only from inside a tool.

---

## 22. Further reading in this repo

- **`README.md`** — the long-form version of §5–§10, written as the project's front door.
- **`docs/01-system-analysis.md`** (354 lines) — source-verified analysis of the v1 portal: 37
  files, ~3,100 lines, 14 commits, everything read from source.
- **`docs/02-reference-constants.ts`** (207 lines) — v1's business rules, constants and formulas,
  typed up for reuse. *Do not "improve" the formulas or the label wording without checking with the
  client:* the labels mirror a physical form and the PDF is the artefact people sign.
- **`docs/03-rebuild-architecture.md`** (167 lines) — the original rebuild decisions. Note it
  predates multi-tenancy and still says "same client — chapters stay as org data, not multi-tenant
  config"; 0012 superseded that.
- Every migration's header comment. They are the real design record.
