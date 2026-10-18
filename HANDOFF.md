# HANDOFF — The Finance Intelligence (`nvr-voucher-v2`)

> **Read this file first, top to bottom, before touching anything.** It is the single current
> briefing on this repository: what the product is, what is true about it today, how it is built
> and verified, what was being worked on most recently, and which lines must never be crossed.
>
> *Written 11 October 2026 at commit `92d5dc2` on `main`. 73 test files / 1,360 tests passing,
> typecheck, lint and production build clean.*
>
> `Context file.md` in the repo root is an older and longer briefing (22 August 2026, commit
> `f41275a`). It is still the deepest record of the voucher workflow, multi-tenancy, analytics and
> the responsive rules, and this file points into it rather than repeating everything. **Where the
> two disagree, this file wins** — in particular the public site is no longer "dark always", there
> are now 31 migrations not 27, and five tools are live, not two. See §21 for the exact list of
> stale claims in it.

---

## 0. TL;DR for an assistant picking this up

- **What it is:** a multi-tenant SaaS for Indian finance teams (chartered accountants), branded
  **The Finance Intelligence**, live at **https://www.thefinanceintelligence.com**. A public
  marketing site plus a signed-in "workspace" of AI-assisted tools ("agents").
- **Five tools are live:** Voucher Desk, Ledger Reconciliation, Valuation Desk, Contact Finder,
  True Property Cost. Four more are roadmap entries (GST Reconciliation, TDS Compliance, Invoice
  Intake, Audit Copilot) and every page says so. **Ask** (an assistant) is a layer across all tools.
- **Stack:** Next.js 16.2 App Router (`src/proxy.ts`, not middleware) · React 19.2 · TypeScript ·
  Tailwind v4 · Supabase (Postgres + Auth + Storage, Mumbai) · Vercel (`bom1`, Mumbai) · Vitest ·
  Anthropic Claude for AI features · Apollo.io for Contact Finder.
- **Deploys:** every push to `main` auto-deploys to production via Vercel. GitHub Actions runs the
  same gate (`npm run check`) on push/PR.
- **Database changes are manual:** migrations in `supabase/migrations/` are pasted into the
  Supabase SQL editor by the owner. Code reaching production ahead of its schema is normal here.
  **Never assume the live schema matches the folder.**
- **Look at it without a database:** preview mode (`NEXT_PUBLIC_PREVIEW_MODE=1`, dev server only)
  signs you in as an owner on fabricated fixtures. See §16.
- **Most recent work (Oct 10–11):** a full visual redesign ("desert skin", earth-toned owl, arch
  scenes, premium tool heroes) across every page, the new True Property Cost tool, then a
  phone-width audit and a dark-mode audit with fixes. All committed and pushed. Nothing is
  half-done. See §19.
- **Standing instructions from the owner:** finish the work, then **commit and push without
  asking**. Never fabricate data. Never commit secrets. Stage explicit paths (never `git add -A`).
  Verify UI by actually rendering it. Details in §2.

---

## 1. Identity

| | |
|---|---|
| Product | **The Finance Intelligence** (`package.json` name `finance-intelligence`) |
| Owner | Krishna Ladha (GitHub `Krishna-1812`). Platform admin emails: `krishna.ladha18@gmail.com`, `vivekgaggarnvr@gmail.com` |
| Local path (owner's machine) | `C:\Users\krish\NVR Tech\nvr-voucher-v2` (Windows 11; note the space in "NVR Tech") |
| Remote | `https://github.com/Krishna-1812/nvr-co-tech.git`, branch `main` |
| Production | `https://www.thefinanceintelligence.com` (`SITE_URL` in `src/lib/marketing/content.ts`; override with `NEXT_PUBLIC_SITE_URL`) |
| Hosting | Vercel, functions pinned to `bom1` by `vercel.json` |
| Database | Supabase, project in `ap-south-1` (Mumbai). **Free tier — it pauses after ~a week of inactivity**, which breaks sign-in (DNS NXDOMAIN on the project URL). Fix: restore it in the Supabase dashboard |
| Mailbox | `team@thefinanceintelligence.com` (GoDaddy; one address, also used as the security contact) |
| Origin | A rebuild of a v1 voucher portal written for the **CIO Association**; the v1 repo name carries an old brand ("NVR") and is deliberately not recorded in the repo |

**Audience:** chartered accountants and finance teams in India, who check. **Accuracy in copy is a
correctness concern, not polish.** A page that claims something the code does not do is a bug.

---

## 2. How the owner wants work done (standing instructions)

These were given explicitly and repeatedly. Treat them as rules.

1. **Finish, then commit and push without asking.** Do not stop to ask "shall I commit?". Pushing
   to `main` deploys to production, so run the gate first (§15).
2. **Never fabricate data.** No invented companies, people, numbers, testimonials or metrics, in
   the UI, in fixtures that pretend to be real, or in copy. An honest empty state beats a
   plausible fake. (This project once shipped invented company names on the analytics screen; see
   `Context file.md` §10.)
3. **Never commit secrets.** `.env.local` is gitignored (`.env*` with `!.env.example`). Never put a
   Supabase service-role key anywhere. Never echo keys back into chat.
4. **Stage explicit paths.** Never `git add -A` / `git add .` — there are untracked local folders
   (`.claude/`, `scratch/`) that must not be committed.
5. **Delete scratch verification routes/files before committing** (e.g. a temporary
   `src/app/dark-lab/` page or `public/__mobile-probe.js`).
6. **Commit message style:** one sentence of intent in the imperative, not a diff summary — e.g.
   "Fix what a dark-mode audit turned up", "Refuse to name a company off a domain we guessed".
   Read `git log --oneline` for the house voice. Body explains the why. End every commit message
   with the attribution line your environment asks for (previous sessions used
   `Co-Authored-By: Claude …`).
7. **Comments explain *why*, at length**, where the why is not obvious. Match the surrounding
   comment density and voice. Many files open with a long doc comment; keep that style.
8. **Verify visually.** `tsc`, `eslint` and 1,360 tests have repeatedly been green while a page
   was broken. Render the page (preview mode), at phone width and desktop, light and dark, before
   calling UI work done.
9. **Design ambition:** the owner's recurring ask is "super premium, rich, super cool, extremely
   beautiful", while not interfering with the actual work. Keep the established design language
   (§17) rather than inventing a new one per page.
10. **The owner usually writes short requests**, often with a screenshot. Infer intent from the
    product's context, act, and report back plainly (what changed, what was verified, anything
    that needs them — e.g. a migration to paste).

---

## 3. Stack and tooling

Next.js **16.2.12** (App Router, Turbopack for dev/build) · React **19.2.4** · TypeScript 5 ·
Tailwind **v4** via `@tailwindcss/postcss` (container queries `@container` / `@2xl:` are available
and used) · Supabase (`@supabase/ssr` 0.12, `supabase-js` 2.111) · Vitest 4 · Zod 4 ·
react-hook-form 7 · Radix (dialog, dropdown-menu, select, tooltip) · lucide-react · sonner
(toasts) · `@react-pdf/renderer` 4 (server-side vector PDFs) · `pdfjs-dist` 6 (reading bank
statement PDFs in the browser) · SheetJS `xlsx` · `date-fns` 4 · `tailwind-merge` + `clsx` (`cn`) ·
`googleapis` (for an unbuilt Sheets sync) · `pgsql-parser` (dev; parse-checks migrations).

`next.config.ts`: `productionBrowserSourceMaps: false` (deliberate), permanent redirects
`/landed-cost → /true-property-cost`, `/agents/landed-cost → /tools/true-property-cost`, and
`/agents → /tools`, `/agents/:slug → /tools/:slug` (the public tool pages were called agents until
17 Oct; the owner asked for "tools", address included — old page paths fold into the new ones in
analytics through the prefix rule in `lib/analytics/aliases.ts`; the signed-in app already showed
no "agent" anywhere, checked by crawling every page, and the assistant's prompt now tells it to
say "tools" too — `AGENTS`, `agent` fields and the `agent` DB column are internal names and stay), one
`remotePatterns` entry (`logo.clearbit.com`, admin analytics only), `staleTimes` 30s dynamic / 180s
static (safe because every mutation calls `revalidatePath` + `router.refresh()`).

---

## 4. Route map

Each tool is a **route group** with its own `Section` in `src/lib/nav.ts`, all rendered by one
shared `AppShell` (`src/components/AppShell.tsx`). A new tool = a nav section + a route group + a
roster entry, not a new shell.

```
src/app/
  (marketing)  /  /tools  /tools/[slug]  /about  /contact  /privacy  /terms   → public, light desert skin
  (auth)       /login  /signup  /forgot-password  /reset-password  /onboarding
  (hub)        /hub                         → the workspace; where sign-in lands (AFTER_LOGIN)
  (app)        Voucher Desk: /dashboard  /vouchers  /vouchers/[id]  /vouchers/[id]/edit
               /approvals  /admin  /admin/chapters  /admin/deleted  /settings
               + route handlers /vouchers/new  /vouchers/[id]/pdf  /vouchers/export
  (recon)      Ledger Reconciliation: /reconcile  /reconcile/history  /reconcile/history/[id]
               + /reconcile/export
  (value)      Valuation Desk: /comps  /comps/ingest (platform admins only)
  (finder)     Contact Finder: /contacts  /contacts/activity (platform allowlist only)
  (landed)     True Property Cost: /true-property-cost
  (assist)     Ask: /ask  /ask/history
  (insight)    Visitor intelligence + operator analytics (platform allowlist only; 404s otherwise):
               /analytics  /analytics/activation  /analytics/external  /analytics/orgs
               /analytics/orgs/[id]  /analytics/requests  /analytics/visitors
               /analytics/visitors/[id]  /analytics/errors
  api/         assist  track  atrack  identify  whoami  comps/brief
               finder/{chat,count,credits,enrich,enrich-bulk,export,history,history/[id],list,parse-query,search,vocab}
  auth/callback (OAuth)   llms.txt   robots.ts   sitemap.ts   manifest.ts
  layout.tsx  error.tsx  global-error.tsx  not-found.tsx  icon.svg  globals.css
  actions/     server actions ('use server' files)
```

**Gating** (`src/lib/routes.ts`, `PROTECTED_PREFIXES`) is a **deny-list**: `/hub`, `/dashboard`,
`/vouchers`, `/approvals`, `/admin`, `/settings`, `/reconcile`, `/ask`, `/comps`,
`/true-property-cost`, `/onboarding`, `/analytics`, `/contacts`. Everything else is public. The
proxy skips the Supabase round trip when no `sb-*auth-token` cookie exists.

**Two different "admins" — do not confuse them** (a real security bug shipped once, fixed in
`72e21a5`):
1. `isAdmin(role)` (`src/lib/domain/workflow.ts`) — per-**organisation** role
   (`member → approver → admin → owner`). Every customer has their own. Right for Voucher Desk
   admin screens.
2. `isAnalyticsAdmin()` (`src/lib/analytics/admin.ts`, backed by the `analytics_admins` table and
   `is_analytics_admin()` from migration 0010) — the **platform** allowlist (the two emails in §1).
   Use it for anything that touches data shared across tenants or spends platform money: the
   analytics section, Valuation Desk ingest, Contact Finder. Adding a colleague is one SQL
   `INSERT`, no deploy. Audit with `grep -rn "isAdmin(" src/app/actions`.

`(insight)/layout.tsx` calls `notFound()` for non-admins deliberately (nothing may reveal that
`/analytics` exists), so the root `not-found.tsx` copy must stay generic and name no record type.

---

## 5. The agent roster

One array, `AGENTS` in `src/lib/marketing/content.ts`, feeds the public site, the hub, the Ask
corpus and `llms.txt`. A tool going live changes stage in one place. Counts are derived by the
`ROSTER` helper — **never type a count**. (The owner also asked, 1 Sep, to stop showing roster
counts on the public site at all.)

| Slug | Name | Stage | Opens at | Access |
|---|---|---|---|---|
| `voucher-desk` | Voucher Desk | live | `/dashboard` | any org member |
| `ledger-reconciliation` | Ledger Reconciliation | live | `/reconcile` | any signed-in user |
| `valuation-desk` | Valuation Desk | live | `/comps` | any signed-in user reads; ingest = platform admins |
| `contact-finder` | Contact Finder | live | `/contacts` | platform allowlist only (spends Apollo credits) |
| `true-property-cost` | True Property Cost | live | `/true-property-cost` | any signed-in user (runs in the browser) |
| `gst-reconciliation` | GST Reconciliation | planned | — | — |
| `tds-compliance` | TDS Compliance | planned | — | — |
| `invoice-intake` | Invoice Intake | planned | — | — |
| `audit-copilot` | Audit Copilot | planned | — | — |

---

## 6. Voucher Desk (the first tool)

Payment vouchers with an optional approval workflow, enforced **in Postgres**. Full detail in
`Context file.md` §5–§7 and `README.md`; the facts that matter:

- All **32 business fields**, the amount formulas and the printed voucher layout are preserved
  exactly from v1 (`docs/02-reference-constants.ts`). Do not "improve" formulas or label wording.
- **Approval is optional and off by default** (0013/0014). When on, **one signature** is enough
  (0015). Never write "two approvals". Legacy two-signature vocabulary survives only to render old
  rows (`ApprovalChain`, `STATUS_META`, preview fixture `v-02`) — don't delete it.
- A voucher **locks on submit**. Initiator can never approve their own. Rejection needs a reason.
  `approved`/`paid` are immutable by trigger. `voucher_audit` has no UPDATE/DELETE policy.
- Voucher numbers are **typed by hand** with a suggestion (0019), format `FI/<CHAPTER>/<FY>/0001`
  (pre-0007 numbers keep `NVR/`). Every date floored at **1 April 2026** (FY 26-27) — worked
  examples must be FY 26-27 or later. Invoice date must be the earliest of the three dates (0020).
- `net_total`/`grand_total` are Postgres **generated columns**; GST exclusivity and CGST/SGST
  pairing are CHECK constraints. There is **no TDS section field**, only a `tds` amount.
- Vector PDF (`/vouchers/[id]/pdf`), 32-column Excel export (`src/lib/export/columns.ts`), invoice
  attachments in Supabase Storage, autosaving drafts (900 ms), admin screens (roles, chapters,
  invites, recycle bin).
- `src/lib/domain/desk.ts` is the one "what needs doing" brief for both the hub card and the
  dashboard headline.
- **Not built:** Google Sheets sync worker. **Never exercised against real Postgres:** approve /
  reject / reopen / mark-paid (they need 2–3 accounts), PDF, Excel, attachments.

Key code: `src/lib/domain/*`, `src/components/voucher/*`, `src/components/dashboard/*`
(`Briefing.tsx`, `VoucherPipeline.tsx`, `RegisterSummary`), `src/app/(app)/*`,
`src/app/actions/*`.

## 7. Ledger Reconciliation

Two ledgers in, a Bank Reconciliation Statement out. A pure TypeScript engine in `src/lib/recon`
that runs **entirely in the browser** — files never leave the user's machine; only the resulting
statement is saved (`reconciliations`, 0008, private to its creator, never updatable). Excel/CSV
via SheetJS, PDF via pdf.js (rebuilds borderless tables from word coordinates; refuses scanned
PDFs). Six matching passes, strongest evidence first. Contra ledgers detected from shared entries.
Exports: PDF working paper + three-sheet workbook (server-rendered from a posted result) + CSV.
UI: `src/components/recon/*` (`WizardHero`, `Steps`, `Outcome`, `HistorySummary`).
`npm run recon:sample` writes sample ledgers to `scratch/`.

The reconciliation **PDF** and the voucher PDF were moved to the desert palette on 11 Oct
(colours only; the voucher's v1 layout, fields and labels are unchanged).

## 8. Valuation Desk (`/comps`)

Comparable-company valuation. The user picks a **listed** subject (listed on purpose: its market
price lets the screen check itself — "market says ₹2,900 Cr, peers imply ₹2,478 Cr, −14.6%"). The
tool builds a peer pool, applies EV/Revenue, EV/EBITDA and P/E (median/mean/Q1/Q3 via
`?stat=`), weights them (⅓ each) into an implied equity value and shows a **verdict** against the
market cap. Unlisted, typed-in subjects are the intended future, not built.

- **Routes:** `src/app/(value)/` — `layout.tsx` (`requireOrgMember()`, `valuationSection({canSeed})`),
  `comps/page.tsx` (`?subject=<uuid>&stat=`), `comps/ingest/page.tsx` + `IngestForm.tsx` ("Seed the
  registry", **platform admins only**, `maxDuration = 60` lives here), `api/comps/brief/route.ts`,
  server actions in `src/app/actions/valuationIngest.ts`.
- **Page flow:** picker of listed companies → pool of ≤120 sharing the subject's 5-digit NIC code
  (fallback: exact industry string; a placeholder for embeddings) → financials + quotes → as-of date
  = newest quote in the pool (not "today") → `buildCompsView` → `Verdict`, `MethodBreakdown`,
  `DetailTabs` (Peer set / Considered & excluded / Basis & sources). Clicking a peer opens
  `CompanyBriefDrawer` — actually a **centred modal** (owner asked for centre, not a right drawer).
- **Pure engine `src/lib/comps/`** (no network/DB/DOM): `multiples.ts` (denominator must be > 0,
  so loss-makers drop out; `formatMultiple` is the only rounding point), `stats.ts` (quartiles match
  Excel `QUARTILE.INC` because CAs rebuild it in Excel; outliers beyond 1.5×IQR are **flagged, never
  removed**), `screen.ts` (country → listing → size 1/3×–3× revenue → growth → margin; first failure
  wins), `conclude.ts` (the **only** EV→equity bridge, using the *subject's* debt and cash; P/E is
  never bridged; no default DLOM/DLOC), `view.ts` (`SOURCE_RANK`, `DEFAULT_WEIGHTS`),
  `statistics.ts`, `format.ts` (crore/lakh). Multiples are also generated columns on
  `peer_set_members` in 0028 — **edit both sides together**.
- **Null means unknown, everywhere — refuse rather than return a zero.** The one sanctioned default:
  null debt/cash counts as 0 in EV. "No quote" ≠ "not listed" (`Verdict` takes `listingStatus`).
- **Data sources `src/lib/comps/sources/`** (all fetching injected; tests offline). Settled research
  — do not redo it:
  - **SEC EDGAR — complete.** `company_tickers_exchange.json` (10,403 tickers) + per-CIK
    `companyfacts`/`submissions`, paced 5 companies/s. Annual = 12-month duration *and* annual form.
    EBITDA = operating income + D&A (null unless both). Market cap = dei share count × Yahoo v8 chart
    price (keyless, best-effort, may be refused from Vercel IPs). Proven against Apple FY2024 revenue
    391.035bn. "Sync every SEC company" button ≈ 1 hour, resumable (localStorage cursor).
  - **MCA via data.gov.in — hard ceiling.** Public sample key (hardcoded, not a secret). Any query
    past 10,000 rows fails (Elasticsearch `max_result_window`); no filter splits big states under it.
    Full coverage for the 10 states in `KNOWN_STATES` (register spellings: "Orissa",
    "Pondicherry"), first 10k rows for the rest (~270k of 4.07M). Also CSV/XLSX upload of the MCA
    master (`mcaMaster.ts`; live statuses include `ACTV`, `NAEF`). CIN parsing in `cin.ts`.
  - **NSE — blocked** by Akamai Bot Manager (confirmed; 401 from datacentres). No evasion; the
    honest fix is a licensed data provider. **Moneycontrol** also Akamai. **Yahoo** price only.
    **Screener.in** forbids this use in its ToS — **refused**, don't revisit without a licence.
    BSE deliberately absent. Real Indian financials need a paid vendor or MCA21's paid export.
  - `INGEST_ORDER = ['mca_master','nse','sec_edgar']` matters; companies are matched by identifier
    (CIN → NSE → BSE → ISIN → CIK → LEI), **never by name**.
- **Ingest:** `src/lib/comps/ingest/` (`runner.ts` with injected writer/fetcher/clock, per-item
  writes, stop after consecutive failures). `MAX_ITEMS = 10` per action call (serverless timeout),
  `MCA_BATCH_SIZE = 100` — both live in `sheetRows.ts`, **not** in the `'use server'` file. Dry run:
  `npm run ingest:dry -- --source edgar --ciks 320193,789019`. Writes use the admin's own session
  (there is deliberately no service-role key).
- **Gate:** ingest = `isAnalyticsAdmin()` (nav, page, every action). The DB write functions are
  granted to all `authenticated`, so the app layer is the only gate — flagged as worth tightening.
- **Company brief** (`src/lib/comps/brief.ts`): the two-call research→forced-tool pattern (§11),
  grounded in registry figures (`dataBlock()`), no investment advice, citations collected and
  deduped. Output `BriefContent` = overview, highlights, recent developments (tone), competitive
  position, key risks (severity), rendered as cards. Route: signed-in, 503 in preview,
  `maxDuration = 90`, cache 30 days in `company_briefs` (`force` regenerates), 8 generations /
  10 min / user (in-memory).
- **Schema (0028):** shared registry `companies`, `company_financials` (unique per
  company/period/basis/source), `company_quotes`, `funding_rounds` (no "estimated"),
  `source_documents` — **nothing a customer typed may be stored in shared tables**. Tenant
  append-only `peer_sets`, `peer_set_members`, `valuations`, `data_lookups`. `numeric(20,2)`.
  `vector(1536)` (OpenAI `text-embedding-3-small`, HNSW cosine) — expensive to change; functions
  touching it pin `search_path = public, extensions` because Supabase installs pgvector in
  `extensions`. Writes only via SECURITY DEFINER functions (`upsert_company`, `record_financials`,
  `record_quote`, …).
- **Preview fixtures** (`src/lib/preview/comps.ts`) use invented names on purpose; three exercise
  refusals (loss-maker/outlier, unlisted, market cap with no filing).
- **Tests:** multiples, stats, screen, conclude, every source, ingest. **No tests** for `brief.ts`,
  `view.ts`, the route or the components.
- **Open:** embeddings / `find_peers` not wired; saving peer sets/valuations not built; typed
  subjects; EDGAR USD values labelled ₹ crore (`crore()` ignores currency; multiples unaffected);
  existing US companies lack market cap until the EDGAR sync is re-run.

## 9. Contact Finder (`/contacts`)

B2B prospecting on **Apollo.io**, ported from an earlier Python/Flask tool. People or company search
with ~40 filters, "say it in a sentence" query parsing, a grounded chat, paid reveals of contact
details, a working list, XLSX/CSV export, history and spend. The owner plans to sell it to clients,
so filter correctness against Apollo's real behaviour was tested live.

**The core idea:** many Apollo parameters "look like filters and behave as relevance hints", so the
tool asks broadly, **re-verifies every row in code** (`src/lib/finder/verify.ts`: industry, size,
revenue, HQ location, technology, title, domain) and tells the user what it removed and why
(rejection banner; each reason is a button that drops that filter and re-runs). Second rule: **"we
could not look" and "there is nothing there" must never share a code path** — failures throw or
flag, never return empty.

- **Access:** platform allowlist only. `(finder)/layout.tsx`: `requireUser()`, non-admin →
  `notFound()`, migration missing → `<NotInstalled/>`. Real enforcement per API route in
  `src/lib/finder/gate.ts` (401 → 403 → 503 preview → 503 no key). In-memory per-instance rate
  limits (cost control). Opening it to everyone is real work, because shared caches hold revealed
  emails/phones gated on the same allowlist.
- **Routes:** `contacts/page.tsx` (Workspace, or a "Not connected" hero without `APOLLO_API_KEY` or
  in preview), `contacts/activity/page.tsx` (history, list, spend — no credential gate on purpose),
  `api/finder/*`: `search` (24/page), `count` (guaranteed free), `parse-query` (two model calls, zero
  Apollo credits; fills filters, doesn't search), `chat`, `enrich`, `enrich-bulk` (≤50), `history`,
  `history/[id]`, `list`, `credits` (month/today spend in IST, never "remaining"), `export` (≤5,000
  rows), `vocab`.
- **Apollo client** `src/lib/finder/apollo/client.ts` — the only file that talks to Apollo. Free
  `mixed_people/api_search`; billed `mixed_companies/search`, `people/match`, `people/bulk_match`,
  `organizations/enrich`. Tries `/api/v1` then `/v1`. All-429 throws. Headcount only filters in
  buckets → re-checked. Technologies sent as uids. Funding clamped at 2^31−1.
  **People search returns `total_entries` at the top level** (companies nest it under
  `pagination`) — reading the wrong one made the count null for weeks.
- **Vocabularies** `src/lib/finder/vocab/`: 147 industries / 21 families / 63 aliases; 121 NAICS
  (2–5 digits), 135 SIC (4 digits), 168 technologies, 204 places. Learned vocab merges over seeds.
- **Taxonomy** `taxonomy.ts`: seniority/function inferred from title into `*_from_title` keys (the
  "vice" blocker stops every VP ranking as C-suite).
- **Search pipeline** `search.ts`: people searches attach employer firmographics (`employer.ts`, one
  company search per ≤50 org ids + 30-day cache); `has_more` from rows *served*, not survived.
- **Natural language** `llm/intent.ts` + `llm/prompts.ts` (six prompts; "almost every paragraph is
  a bug that shipped"). A reviewer pass uses the same model unless `FINDER_VERIFY_MODEL` is set.
- **Chat** `chat/run.ts`: stateless (browser resends the conversation); model parses, code decides
  lookups. Distinguishes "nobody on file holds that title" (our data) from "the role is vacant"
  (almost never ours to say). Web research capped at 55 s. Company searches bill on what Apollo
  served.
- **Pay once:** every reveal reads the by-id cache first and writes after; ledger counts what was
  fetched. `PERSON_SHAPE` stamp must be written by the same path that reads it.
- **UI** `src/components/finder/`: `Workspace.tsx` (~1,340 lines: reducer, 420 ms debounced free
  count with sequence numbers, layout), `store.ts` (`entity` vs `shownEntity`; selection keyed by
  Apollo id), `FilterPanel.tsx` + `filters.ts` (one table of filter definitions), `Results`,
  `Banners`, `Hero`, `AskBar`, `Chat`, `Combobox`, `Profile`, `Activity`. Layout: with results
  `xl:grid-cols-[26rem_minmax(0,1fr)]` + a 24rem chat track at `2xl`; before the first search
  filters and chat split **3:2** (owner asked for this ratio and equal heights). Below `xl` filters
  collapse. `.a-ring` sets `position: relative` unless the element has `.sticky`, so sticky lives on
  a wrapper.
- **Schema 0031:** caches `finder_industry_seen`, `finder_vocab_seen`, `finder_org_firmo` (30 d),
  `finder_person_enrichment` (90 d), `finder_org_resolve` (24 h) — positive-only, readable only by
  allowlisted admins; per-user `finder_search_history`, `finder_list_rows`, `finder_credit_ledger`
  (not a balance). All writes via SECURITY DEFINER functions; `finder_expire()` prunes on read
  (history/list 90 d, ledger 400 d); history ≤60 entries/≤120 rows each; list ≤500.
- **Scripts:** `npm run finder:audit-filters` (live, free unless `--paid`), `finder:audit-chat`
  (real Apollo + Anthropic, stub DB).
- **Tests:** ~213 across client, vocab, verify, search, enrich, export, llm, chat (stubbed).
- **Open:** credit ledger not explicitly audited live; some filters are no-ops on this Apollo plan
  (certain email statuses); roster copy in `content.ts` doesn't yet mention the chat.

## 10. True Property Cost (`/true-property-cost`)

What an under-construction property **really** costs by possession: every instalment carries the
cost of the money that paid it (own funds at an opportunity rate, borrowed funds at the loan rate)
from its payment date to the occupancy-certificate (OC) date. Plus rental yield on that true cost.
Built 10 Oct as "Landed Cost", renamed by the owner (permanent redirects in `next.config.ts`;
internal module names and the localStorage key still say "landed" — leave them). It is the
**template every other tool's design was brought up to** in `aa28cb8`.

- **Signed-in** (`(landed)/layout.tsx`, `requireOrgMember()`, `landedSection()`), but runs
  **entirely in the browser**; schedules are saved to `localStorage` key `tfi:landed-cost:v1`
  (`src/lib/landed/store.ts`). No DB tables.
- **Maths** `src/lib/landed/calc.ts` (pure, UTC whole-day counts, actual/365):
  - Inputs (`Schedule`): `ocDate`, `rates {self, borrowed}` (defaults 7% / 8.5%), `compounding`
    (simple | annual | quarterly | monthly), `instalments [{label, date, amount, source}]`,
    `areaSqft?`, `rental? {monthlyRent, maintenanceMonthly, annualCosts, vacancyPct, marketValue}`.
  - `carryingCost`: simple `amount × rate × days/365`, or compounded
    `amount·((1+r/n)^(n·years) − 1)`; payments on/after OC carry nothing (flagged `afterOc`).
    Rounded to the paisa.
  - `landedCost()` → rows, per-source paid/interest, `paid`, `interest`, **`landed`** (= true cost),
    **`cash`** (= paid + borrowed interest only), `upliftPct`, `weightedDays`, `perSqft`.
  - `rentalYield()` (null until rent entered; pre-tax, no growth): gross on price paid, gross and
    net on true cost, net on market value, spread vs blended cost of funds, break-even rent,
    payback years.
  - `problems()` (plain-language validation), `parseAmount()` (accepts "12,50,000", ₹, Rs., INR),
    `timeline()` (last point equals the total exactly), `withDelay()` ("if possession slips"
    slider, up to 3 years), `delayCase()` (what a given delay adds; the slider and both exports
    read it), `uncounted()` (the payments `landedCost()` drops — no real date or no amount above
    zero — each with the `problems()` messages for it, by the same test).
  - **Stamp duty, GST, registration etc. are not computed** — they're entered as dated payments via
    one-click chips (`CHARGES` in `Payments.tsx`), so they carry cost of funds like any instalment.
  - The on-screen Method panel says what is **not** modelled: EMIs, rate changes, tax,
    appreciation, rent escalation.
- **Exports carry everything the screen shows** (fixed 17 Oct after the owner found they did not).
  Both are drawn in the browser; nothing is posted anywhere.
  - **PDF** (`report.tsx`, `@react-pdf/renderer`): the answer with the own / borrowed / carrying
    split, the figures, a named list of any payment **not counted** and why, the "Money tied up"
    chart (react-pdf SVG from `timeline()`), everything entered (rates, area, every rent input),
    the rental yield with its bars and the screen's **verdict sentence**, an "If possession slips"
    table (3, 6, 12, 24, 36 months), the working with the after-OC caution, and the full method.
  - **Excel** (`workbook.ts`, lazy `xlsx`): Summary (adds the funds split, the verdict, what is not
    counted), Schedule (dates are **real Excel dates** now, `dd/mm/yyyy`), **Not counted** (only
    when there is any), **If possession slips** (every month 0–36), **Over time** (the chart's own
    figures, ending on the true cost), **Method**.
  - **One wording source:** `src/lib/landed/words.ts` holds the verdict (`rentVerdict`), the
    after-OC note and `METHOD`; the screen's Method/Rental panels, the PDF and the workbook all read
    it. Change a sentence there, not in a component.
  - **Fonts** (`src/lib/pdf/fonts.ts`, files + OFL licence in `public/fonts/pdf/`): Figtree (has ₹)
    with a face per Indian script behind it — Noto Sans Devanagari, Bengali, Gujarati, Tamil,
    Telugu, Kannada; **Anek** Gurmukhi, Odia, Malayalam, because fontkit throws on the current Noto
    Gurmukhi/Malayalam and mis-shapes Noto Oriya. Helvetica printed ₹ and Hindi as garbage.
    `fontStack()` names only the scripts a document's text uses (every family named is fetched,
    and the script faces are 2.6 MB); `textFont()` leads typed Indic text with its own face;
    `fitWords()` breaks a spaceless word too wide for its column (a demand-letter reference ran
    across the next columns). Typed labels are given `hyphenationPenalty: 10000`, because react-pdf
    otherwise breaks and hyphenates at every script change ("(-" / "बुकिंग)"). Not covered: Urdu
    and other RTL, CJK, emoji.
  - Download file names keep any script's letters (`fileBase`); `\w` used to empty Hindi names.
- **Worked example:** `landedStore.createExample()` — "Example: Tower B, 2 BHK", OC 2028-03-31,
  eight payments (booking, stamp duty, slabs on loan, GST, finishing, possession), 950 sq ft, rent
  ₹32,000/month.
- **UI** `src/components/landed/`: `LandedWorkbench.tsx` (structure, Load example / Excel / PDF,
  property chips, delete modal), `Hero.tsx` (its own hero: true cost, countdown, paid + carrying =
  true cost, source bar, tower `ArchScene` with an uplift seal), `MoneyChart.tsx` (stacked own /
  borrowed / carrying over time, OC rule, keyboard-followable crosshair), `Payments.tsx`,
  `Panels.tsx` (property, funds with rate sliders, delay), `Rental.tsx` (the owner had the
  break-even rent, payback and cost-of-the-money **tiles** taken off the screen, the PDF and the
  Excel on 17 Oct; the cost of the money is still in the bars on screen and in the PDF, and in the
  verdict; `rentalYield()` still computes all three, and the tests check they stay out of the files), `Controls.tsx`, `shared.ts`
  (`TONE` = `--lc-*`), `LandedPanel.tsx` (hub card).
- **Tests:** `calc.test.ts` (dates, leap years, compounding, ordering, after-OC, yield, …),
  `report.test.tsx` (reads the PDF's text back through **pdf.js** — so a glyph that did not draw
  fails — and checks every section, the verdict, the delay table, uncounted payments, ₹ and
  Devanagari), `workbook.test.ts` (every sheet, real dates), `src/lib/pdf/fonts.test.ts`.
- The owner compared it with a reference calculator
  (`property-landed-cost.vivek-gaggar-1909.chatgpt.site`) and asked for rental yield and anything
  missing — that's what `a7e2e01` added.

## 11. Ask — the assistant

A chat panel on every signed-in screen plus `/ask` and `/ask/history`. `src/lib/assist`, provider
code isolated in **one file** (`src/lib/assist/anthropic.ts`; it moved OpenAI → Gemini → Anthropic
without anything else changing). Signed-in only. Lexical retrieval over a ~30-document corpus
partly **generated from `AGENTS`**, so it cannot describe a roadmap tool as live. **It does no
arithmetic** — tools call the app's own functions (`calcGrandTotal`, `gstMode`, `isValidGstin`,
`fiscalYear`, …) and the working is shown. Markdown is parsed to a tree and rendered as React (no
HTML from the model). History in `assist_conversations`/`assist_turns` (0009), append-only.
`ANTHROPIC_API_KEY` switches it on; `ANTHROPIC_MODEL` overrides the default model. In preview mode
with no key it streams a labelled sample. Details: `Context file.md` §9, `README.md`.

**Pattern for any Anthropic call that needs web search *and* a strict JSON shape** (used by the
Valuation Desk company brief, `src/lib/comps/brief.ts`): two calls — (1) free research with the
`web_search` server tool and `tool_choice: auto`, then (2) a search-free call with a custom tool
and `tool_choice` forced to it, fed the notes from (1). Don't force a tool alongside a server tool
in one call.

## 12. Visitor intelligence & operator analytics (`(insight)`)

First-party analytics (own script `public/a.js`, own cookie, own endpoints — no Google Analytics,
no third-party pixels) plus an engine that identifies the **company** behind anonymous visits, and
operator dashboards (activation funnel, usage, organisations, access requests, errors). Platform
allowlist only. This area has the most hard-won invariants in the codebase — **read
`Context file.md` §10 before changing anything here.** The short version:

- **Do not relax `qualifies()`** in the identification gate. Only `business`/`education`/
  `government` IPs may surface a name, and only with an *observed* method (reverse DNS or an
  IP-intel company hit). `IPINFO_TOKEN` is unset in production; setting it (free tier) is the
  correct way to identify more visitors. If rows ever all read "60% / 1 signal", that is the old
  fabrication bug returning.
- **Never fabricate a person.** Only deterministic evidence (sign-in, form, token webhook) merges
  identities.
- Cross-tenant operator reads go only through `operator_*` SECURITY DEFINER functions (0026),
  which must never be widened to expose payment details. `is_analytics_admin()` is not granted on
  `organizations`/`profiles`/`vouchers`.
- DNT and GPC honoured unconditionally.

---

## 13. Data model & migrations

All schema, RLS, triggers and functions are in `supabase/migrations/` (31 files). Each has a long
header explaining why it exists — read it before changing what it touched. Migrations 0001–0027
are described one by one in `Context file.md` §4. Since then:

| # | File | What it does |
|---|---|---|
| 0028 | `valuation_desk.sql` | Valuation Desk: shared company registry, financials, quotes, multiples, lookup cost ledger; readable by every signed-in user; writes only through SECURITY DEFINER functions (see §8) |
| 0029 | `company_briefs.sql` | Cache table for the AI company brief |
| 0030 | `company_briefs_structured.sql` | Replaces the brief's markdown column with structured `content jsonb` |
| 0031 | `contact_finder.sql` | Contact Finder: caches, records, credit ledger, allowlist (see §9) |

**Applied status (as far as known — verify, don't assume):** 0001–0027 verified applied
(21 Aug 2026). 0028 applied (Valuation Desk is used in production). 0029/0030: 0029 was found
missing once and the owner was told to run 0029 then 0030; they were later giving feedback on the
structured brief's content, so both are very likely applied — confirm with
`select column_name from information_schema.columns where table_name = 'company_briefs';` (expect
`content`). 0031: owner confirmed applied.

**Rules:** apply the migration **before** pushing code that needs it; write paste scripts
re-runnable (`if not exists`, `create or replace`, guarded constraints) because drift is normal;
`npm run check:sql` parse-checks every migration (they are never executed locally — there is no
local Postgres). Every new `SECURITY DEFINER` function needs an explicit `organization_id` guard,
not just a role check. A `language sql` function is validated at creation; a plpgsql body is not
checked until it runs (this once broke signup silently — `Context file.md` §4, the 0006/0027 story).

When you hand the owner a migration, give them the **full SQL to paste in the Supabase SQL
editor** in chat, and a one-line verification query.

---

## 14. Multi-tenancy & security model (summary)

`organizations` (0012) with `organization_id` on profiles (nullable = not yet onboarded),
chapters, events, vouchers; `my_organization_id()` used by every policy; `before insert` triggers
stamp the org so the app can't spoof it; per-org uniqueness. Onboarding: `create_organization`,
`invite_user`, `accept_invite` (invites are copy-a-link; email is optional via Resend). `role`
moves only through `set_user_role()`; only `full_name` is self-writable on `profiles` (column
GRANT, because RLS is row-level). Reconciliations and Ask history are private to the creator with no
admin override. Full detail: `Context file.md` §6.

---

## 15. Commands & verification

```bash
npm install
npm run dev          # http://localhost:3000, needs .env.local with Supabase values
npm run check        # THE GATE: lint → check:sql → test → next build
```

| Command | What |
|---|---|
| `npx tsc --noEmit` | Typecheck (run it; `check` doesn't on its own beyond the build) |
| `npm run lint` | `eslint src --max-warnings 0` |
| `npm run check:sql` | Parse every migration with real PostgreSQL grammar |
| `npm run test` | Vitest — 73 files / 1,360 tests at `92d5dc2` |
| `npm run build` | Production build. **Required before pushing anything touching a `'use server'` file** (see below) |
| `npm run recon:sample` / `pdf:sample` / `xlsx:sample` | Sample artefacts into `scratch/` |
| `npm run brand:icons` | Regenerate brand marks |
| `npm run ingest:dry` | Valuation Desk ingest dry run (in-memory writer) |
| `npm run finder:audit-filters` / `finder:audit-chat` | Live audits of Contact Finder against Apollo (spend real API calls) |

CI: `.github/workflows/check.yml` runs lint, check:sql, test, build on Node 24 with
`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` from repo secrets.

**Green-build-broken-runtime traps this repo has hit (static checks miss all of them):**
1. A `'use server'` file may export **only async functions**. A plain `export const` silently kills
   the whole module; only `npm run build` catches it. (Broke a production deploy once.) Put
   constants in a sibling module; put `maxDuration` on the calling `page.tsx`/`route.ts`.
2. A Server Component importing a **plain value** (array/object) from a `'use client'` file gets a
   proxy, and `.find` throws at request time — tsc and build stay green. Shared values belong in a
   neutral module.
3. A JSX comment `{/* */}` placed directly before an element inside `cond && ( … )` is a parse
   error that blanks the page. Use a `//` comment on its own line inside the parentheses instead.
4. Layout/contrast/overflow bugs (§16).

---

## 16. Seeing the app & visual QA

### Preview mode (signed-in pages without a database)

`NEXT_PUBLIC_PREVIEW_MODE=1` + a **non-production** build (`next dev`) → auth bypassed, signed in
as an owner on fixtures from `src/lib/preview/` (`fixtures.ts`, `comps.ts`, `analytics.ts`,
`operator.ts`, `resolutions.ts`, `client.ts`). An amber banner (~61px) marks every page. **The
double gate (flag *and* NODE_ENV) must never be relaxed** — it is an auth bypass. It proves nothing
about RLS/triggers/constraints. Fixtures live on `globalThis`: restart the dev server after editing
them. Opening `/vouchers/new` creates an empty draft in the in-memory fixtures each time — that is
expected and clears on restart.

`.claude/launch.json` (local, untracked) has three configs; the one used for all recent QA is:

```json
{ "name": "nvr-voucher-v2-preview", "runtimeExecutable": "node",
  "runtimeArgs": ["-e", "process.env.NEXT_PUBLIC_PREVIEW_MODE='1';require('child_process').spawn('npx',['next','dev','-p','3001'],{stdio:'inherit',shell:true,env:process.env})"],
  "port": 3001 }
```

This sets the flag in the process env only, so `.env.local` never has to be edited. Also present:
`nvr-voucher-v2` (`npm run dev`, 3000) and `nvr-voucher-v2-prod` (`next start -p 3100`, after a
build). Next 16 refuses two `next dev` servers in one directory.

> Historical note: in August, when sessions ran from a *different* working directory, Turbopack
> panicked on the space in "NVR Tech" and `--webpack` plus 8.3 short paths were needed
> (`Context file.md` §11). Running from the repo itself (as now), plain `next dev` with Turbopack
> works. If you see `FileSystemPath("").join(...) leaves the filesystem root`, fall back to
> `npx next dev --webpack -p 3001` and kill orphaned `node.exe` by command line.

### Methods that worked for audits

- **Overflow (phone width):** in the browser, load pages at 320 / 375 / 768 / 1024 and check
  `document.documentElement.scrollWidth - innerWidth` plus any element whose right edge passes the
  viewport without a scrollable ancestor. Test the exact breakpoint values — 1024 is where the rail
  arrives and is the width that broke before.
- **Truncation:** find elements with `text-overflow: ellipsis` where `scrollWidth > clientWidth`.
- **Contrast (dark mode):** set `localStorage.theme = 'dark'`, then for every text node resolve its
  colour and the blended background stack (canvas-resolve `light-dark()`/`color-mix()` values) and
  require 4.5:1 (3:1 for ≥24px or ≥18.66px bold); flag anything under 0.9× the threshold.
- Run audits by injecting a script into the page, and **don't edit files while one runs** — HMR
  reloads wipe its state.
- **Full-page screenshots:** headless Edge on Windows:
  ```powershell
  & "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu `
    --hide-scrollbars --force-prefers-reduced-motion --user-data-dir="$env:TEMP\edge$(Get-Random)" `
    --window-size=1440,1000 --virtual-time-budget=9000 --screenshot="C:\path\out.png" `
    http://localhost:3001/dashboard
  ```
  Wrap it with a ~75 s `WaitForExit` and kill, because headless Edge occasionally hangs. Edge's
  minimum window width is ~500px, so for phone shots load a same-origin page that iframes the route
  at 375px. Dark screenshots need a same-origin page that sets `localStorage.theme='dark'` first.
  Delete any such helper page before committing.
- Screenshots taken mid entrance-animation look washed out — wait ~2s or use reduced motion.

### Responsive rules (all still in force — details `Context file.md` §12)

- **The touch band is 640–1023** (the `MobileDock` is `lg:hidden`). Size tap targets and controls
  against `lg`, not `sm`.
- Inputs must be ≥16px on touch (iOS zoom): shared `CONTROL` is `text-base … lg:text-sm`.
- `flex-1` inside `flex-col` sets height, not width.
- Tables with an action column switch to a grid row on phones so the action stays reachable.
- `shrink-0` needs its sibling to have `min-w-0`.
- Prefer **container queries** where a component's width varies independently of the viewport
  (e.g. `VoucherPipeline` is `@container` and goes 2×2 below `@2xl`).
- Deliberately scrolls sideways (don't "fix"): the recon `DifferenceTable`, analytics activation
  metric tables, the visitor table, the home-page product mockup.

---

## 17. Design system — the "desert skin"

Owner's brief (10 Oct): a **light** theme, explicitly **no purple/blue "AI colours"**, inspired by
threeui.com and northaxis.outcomes.digital; then "super premium, rich, super cool, extremely
beautiful" across every page. Everything lives in `src/app/globals.css` (~2,600 lines; read its
header comment) plus the shared components below. **Use the tokens and material classes; never
hard-code colours** (hard-coded `text-white`, `text-red-600` without `dark:`, `#…` literals were
exactly what the dark-mode audit had to fix).

**Palette.** Bone `#F6EFE4` page, `#FBF6EE` cards, sand `#EBDDCB` sunken, warm ink `#2B211B`,
**terracotta `#9C4026` accent** (rationed: live signal, focus, selection, the one key figure per
screen, primary-button hover — never a large field), sun `#E9B44C` (fill only, never text). Rules
from the header: **no two-hue gradients**; fills are flat with edges and a warm shadow. Dark theme:
night `#1B1511`, raised `#261E18`, text `#F3EADD`, accent `#E5946B`. Every text token is measured to
WCAG AA on all three surfaces in both themes.

**Typefaces:** **Gloock** (display serif, one weight — only `.m-display` sets it) and **Figtree**
(everything else), via `next/font` in `src/lib/brand/fonts.ts`, variables on `<html>`. There is no
monospace face (`--font-mono` → Figtree). (Bricolage Grotesque was used until the desert redesign;
some comments in `globals.css` still mention it, the old navy owl, and "two of the six" — stale.)
Type scale `--t-1…--t-15` at ratio 2^(1/5); utilities `t-1…t-11`, fluid `t-hero`, `t-h1…t-h5`,
`t-caps`.

**Two token worlds:**
- **Public site + auth** wear `[data-skin='desert']` (set by `PublicShell` and the auth layout) with
  `--m-*` tokens and `color-scheme: light` — **always light**, regardless of the app theme. Inside
  the skin the app tokens are re-pointed at `--m-*` so `Button`/`Field`/`Input` work unchanged.
  Note `--m-gold` is actually terracotta (names kept for ~50 call sites).
- **Signed-in app** uses `:root` tokens: `--surface`, `--surface-raised`, `--surface-sunken`,
  `--border-c`, `--border-strong`, `--text-c`, `--text-muted`, `--text-subtle`, `--accent`,
  `--accent-lit` (non-text only), `--focus`, `--action`/`--on-action`/`--action-hover`, `--on-tone`,
  `--elev-1..4`, status `--status-draft|pending|approved|rejected|paid|warn`, brand scale
  `--color-brand-50…950` (terracotta). Tool accents via `light-dark()`: `--h-indigo` (terracotta
  `#9C4026`/`#CF7853`), `--h-cyan` (verdigris `#008779`/`#0E9C8E` — changed so the standard
  two-series pair is CVD-distinguishable), `--h-violet`, `--h-emerald`, `--h-amber`, `--h-rose`,
  `--h-lime`, `--h-magenta`. Chart series for TPC: `--lc-own` (verdigris), `--lc-borrow` (ochre —
  under 3:1, so never the only carrier of a value), `--lc-carry` (terracotta). `--scene-sun`
  (`#E9B44C` / sunset `#B9702F` at night).

**Theme mechanics.** Default is **light** (`DEFAULT_THEME` in `src/lib/theme.ts`), with
light / dark / system choice in the account menu and Settings, stored in `localStorage` `theme`. An
inline script in `src/app/layout.tsx` sets `data-theme` before first paint (none for "system"). Dark
tokens are written under both `@media (prefers-color-scheme: dark) :root:not([data-theme='light'])`
and `:root[data-theme='dark']`; Tailwind `dark:` is taught the same via `@custom-variant`.
`ThemeColor.tsx` keeps the phone address bar matching the page (app only).

**Material classes** (use these, they're what make it look "premium"):
`surface-lit` (every Card: sheen + border + shadow) · `surface-sunken` · `a-ring` (1px masked
gradient edge; sets `position: relative` unless `.fixed/.absolute/.sticky`) · `a-inner` (top inset
highlight) · `a-glass` (chrome only) · `hover-lift`/`a-lift` · `a-label` (10px uppercase micro-label)
· `a-figure` (big tabular figure) · `numeric`/`amount` (tabular nums) · **`tinted` + `--tone`** (chip
coloured from a tone, works in both themes) · `on-tone` (text on a full tone fill — never
`text-white`) · `a-track`/`a-fill` (bars) · `a-hatch` (deliberately empty) · `a-blip`, `a-shine`
(one per screen) · marketing `m-arch`, `m-arch-open`, `m-sun`, `m-display`, `m-eyebrow`, `m-card` ·
`lc-range` (slider).

**Corners:** lg 7 (controls), xl 10 (inputs, tiles), 2xl 14, **3xl 18 (cards)**, ToolHero
`rounded-[2rem]`, buttons are `rounded-full` pills.

**Motion:** stepped easing (`--ease-step: steps(8)`), scroll-driven `view()` reveals behind
`@supports` with a fully-visible fallback (`src/components/marketing/Reveal.tsx`), scene keyframes
`sc-tip`/`sc-seek`/`sc-shadow`/`sc-blink`; all transform-only and off under reduced motion.

**Public-site play** (`src/components/marketing/play/`, CSS in the PLAY block at the end of
`globals.css`; added 11 Oct after the owner asked for northaxis.outcomes.digital-style motion):
a once-per-session home opening sequence (`IntroCurtain`; decided by the `<head>` script in
`src/app/layout.tsx` via `html[data-intro]`, `--intro-wait` holds hero entrances behind it),
a four-band page curtain between public pages (`(marketing)/template.tsx` → `PageCurtain`,
client navigations only), letter-by-letter headlines that answer the pointer (`Letters` +
`Springy`), the sun highlighter on the hero's last line (`.m-mark`), rolling digits
(`Odometer`), a live-tools ticker and a kinetic type band (both read `LIVE_AGENTS`, lean with
scroll speed), words read into ink (`ScrollWords`), the final panel opening like a window
(`.s-portal`), buttons that flood from the pointer (`.m-flood` on `CTA`), confetti on
`data-demo`/`data-signup` clicks, labels that decode, the footer wordmark and shape toys
(`Footplay`), and a draggable hero card on a spring (`HeroStage`; the picture is `home/HeroVisual.tsx`: three
wordless drawn sheets — ledger, chart, ticked document with a seal — that replaced the expense
voucher (17 Oct) and then a worded checklist card (18 Oct), both at the owner's request, so the
home page names no single tool and shows no figures; the month-of-work section (`home/WorkCalendar.tsx`) also names
no tool since 18 Oct — each job shows "How it usually goes" (`JOBS[].now`) and "What good looks
like" (`JOBS[].good`), one accent for all; `agent`/`ours` remain only for the assistant; the "Have a go" GST/TDS
slider section, `RulesPlayground`, came off the home page the same day for the same reason). A pinned
scroll story (`HowItMoves`, a sheet through four doorways) was added in its place the same
day and then removed at the owner's request; don't re-add it. The `/tools`
cards also lean a few degrees towards a mouse (`Tilt` in `marketing/motion.tsx`, now mouse-only). Then, same
day: `/about`'s roster reads down a spine that fills with scroll and lights each number in its
tool's colour (`marketing/about/RoadmapList.tsx`, `.m-road*` in globals.css; rows only dim once JS
arms the list), and the four habits are a sticky deck that stacks as you scroll
(`about/HabitDeck.tsx`; the old 2×2 grid under reduced motion). The footer wordmark waves and leans
with scroll speed (`FootWord`, via `subscribeSpeed`, written to `translate`/`rotate` so it composes
with the rise and the pointer swell). Arriving at a tool page plays a **door** in that tool's
colour with its name (`.m-door*`, PageCurtain) instead of the bands. Note
`(marketing)/tools/template.tsx`: the site template never remounted between `/tools` and a tool or
between two tools, so no transition used to play there at all; the tools template now owns every
arrival under `/tools` and the site one stands aside there (`scope` prop). All of it is off under
reduced motion and writes into the DOM only after React has hydrated the node (`hydrated()` in
`Play.tsx`).

**App play** (11 Oct, owner asked for the same in the signed-in app; tuned for repeated work): a once-per-session welcome on `/hub` greeting the user by name (same
`IntroCurtain`, key `tfi-welcome`); `RouteStage` in `AppShell`/hub layout — the four-band
curtain on every page change (owner's choice; it was tool changes only at first); `ToolHero`/`PageHeader` string
titles set letter by letter (`Letters` + `Springy`), `ToolHero mark=` for the sun highlighter,
figure titles/`HeroStat`/`SealFigure`/`Figure`/grand totals roll as odometers (the voucher
form's total rolls on every change); arch scenes drift with the pointer; seals swing; buttons
flood (`.m-flood` in `buttonClass`); `.surface-lit` cards carry a pointer light (skipped above
~640k px² so tables are left alone); rail/dock active states animate; `[data-decode]` labels
decode. Confetti only on real success: approve, mark paid, submit, and a fresh reconciliation
that ties outright (`celebrate()` in `play/confetti.ts`). Play tokens `--p-band-1..4`,
`--p-mark`, `--p-glow` are `light-dark()` so all of it works in both themes.

**Live demos and the sky** (11 Oct): `/tools/ledger-reconciliation` and
`/tools/true-property-cost` each carry a "Try it on this page" panel running the real engine in
the browser (`components/marketing/agents/ReconDemo.tsx` on `lib/recon/demo.ts`;
`PropertyDemo.tsx` on `lib/landed/example.ts`, which the tool's "Load example" now shares).
Every sun follows IST (`lib/sky.ts`: `skyAt` is inlined into the `<head>` as its own source and
re-run every 5 min from `Play`; `html[data-sky]`, `--sun-dy`, `--sky-sun`, `--sky-wash`, stars
and a crescent moon at night; the FinalCTA sunset opts out).

**Brand.** The owl mark's geometry and four inks live in `src/lib/brand/mark.ts` (body `#862F1C`,
lit `#A8492B`, gold `#E9B44C`, pupil `#2B211B`, bone halo) — regenerate favicons/social cards/PDF
mark from it with `npm run brand:icons`. **21 owl miniatures** (`src/lib/brand/owlkit.ts`,
`src/components/brand/Owl.tsx`): deterministic from a seed, blink/turn/idle habits, `aria-hidden`,
`pointer-events: none`. They appear on public pages and, in the app, **only in `EmptyState`** —
never on vouchers, ledgers, queues or forms (owner: "should not interfere with anything").

**Shared kit for every tool page:**
- `src/components/ui/ToolHero.tsx` — `ToolHero({label, pill?, title, as, variant:'figure'|'headline',
  sub, children, scene, glow, id})`; scene column only from `lg`, capped 26rem tall. `HeroStat({label,
  value, note, tone, strong})` (strong = the answer tile), `HeroChip`.
- `src/components/ui/Scene.tsx` — `ArchScene({motif, seal?, sun?, className})`, motifs: `tower`,
  `voucher`, `scales`, `columns`, `seekers`, `sundial`, `owl`, `doorways`, `ledger`, `gate`; drawn in
  tokens only. `SealFigure({value, note})` hangs across the arch threshold; its value must also appear
  in the hero text.
- `src/components/ui/Skeletons.tsx` — `HeroSkeleton({scene, working, buttons})` for `loading.tsx`.
- `src/components/ui/primitives.tsx` — `Button`/`buttonClass` (primary, secondary, ghost, danger,
  success), `Card` (`surface-lit a-ring rounded-3xl`), `CardTitle({icon, title, description,
  action})`, `CardBody`, `DataTable`/`Thead`/`Th`/`Td`/`Tr`, `Field`, `Input`/`Textarea`/`Select`
  (`CONTROL` = `text-base lg:text-sm`), `ChoicePill`, `EmptyState`, `IconTile`, `Skeleton`. Also
  `Modal.tsx`, `Drawer.tsx`.
- `src/components/PageHeader.tsx` (eyebrow with a mini arch + sun, display title),
  `src/components/AppShell.tsx`, `src/components/app/SideRail.tsx` (`FiscalMeter`: the financial
  year as a sun crossing an arc, April → March).

**How a tool page is composed now:** `PageHeader` (or none) → `ToolHero` with the tool's motif and,
where there's a headline number, `variant="figure"` + `HeroStat`s → `Card`s with `CardTitle` icon
tiles → `EmptyState` with an owl when empty → `loading.tsx` using `HeroSkeleton`. Copy this
pattern for anything new.

**Charts:** follow the existing ones (`MoneyChart.tsx`, `MethodBreakdown.tsx`, analytics
`Strip.tsx`): thin marks, one axis, tokens for series, legend + direct labels, hover tooltip, a table
or figures alongside. Validate any new categorical palette for colour-blind separation in both
themes before shipping.

---

## 18. Environment variables

`.env.example` documents all of them with comments. `.env.local` is gitignored and **does not
exist on the owner's machine at the moment** (QA has been done in preview mode). Production values
live in **Vercel → Project → Settings → Environment Variables**. Ask the owner to create
`.env.local` themselves if you need to run against the real database; never ask them to paste
keys into chat.

| Variable | Needed for | If unset |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | everything with a DB | app can't sign in (preview mode still works) |
| `NEXT_PUBLIC_PREVIEW_MODE` | local fixture mode | keep `0` in any file; set via process env |
| `NEXT_PUBLIC_SITE_URL` | canonical URLs, sitemap | falls back to the production domain |
| `ANTHROPIC_API_KEY` (+ `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL`) | Ask, company briefs, Contact Finder chat/verification | those features say they're off |
| `FINDER_VERIFY_MODEL` | model override for Contact Finder's verification pass | default model |
| `APOLLO_API_KEY` | Contact Finder search/enrich; analytics "Enrich further" | those features inert |
| `IPINFO_TOKEN` | wider visitor identification | falls back to reverse DNS/RDAP (currently unset) |
| `ANALYTICS_IDENTIFY_TOKEN`, `ANALYTICS_EXCLUDE_ORGS`, `ANALYTICS_CONTACT_EMAIL`, `ANALYTICS_REGISTRY_LOOKUP`, `ANALYTICS_COOP_FILE` | analytics extras | safe defaults |
| `ERROR_ALERT_WEBHOOK_URL` | push alert on caught server errors | errors only in `/analytics/errors` |
| `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` | workflow + invite emails | nothing sent, nothing breaks (owner deliberately skipped Resend) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | unbuilt Sheets sync | n/a |

> **Security note:** Apollo API keys were pasted into a chat transcript in an earlier session.
> Recommend the owner rotates the Apollo key (Apollo dashboard → API keys), updates it in Vercel,
> and never pastes keys into chat again.

---

## 19. Recent history & current state

`git log --oneline` (175 commits since 1 Aug 2026) is the real record. Phases since the old
Context file:

1. **Valuation Desk** (22–24 Aug, `4e9f7cd`→`f4a76ec`) — registry, free data sources, multiples,
   verdict-led redesign, AI company briefs, ingest restricted to platform admins.
2. **Contact Finder** (26–27 Aug, `386b6be`→`bba87c5`) — Apollo-backed contact search ported from
   a Python/Flask original, verification pass, credits, history, layout iterations.
3. **Design-system rebuild** (30 Aug–1 Sep, `0883b33`→`741aead`) — palette built on the owl's own
   colours, AA contrast measured, scroll-driven reveals, Bricolage Grotesque (since replaced by
   Figtree + Gloock), 21 owl
   miniatures (site + app empty states only), softer corners, one type scale, SEO pass (titles,
   descriptions, canonical, structured data, sitemap, robots, `llms.txt`, custom 404), copy cuts
   (no roster counts, no "Mumbai" credit).
4. **Desert skin** (10 Oct, `e352dc0`→`04a4fbc`) — owner asked for a light theme, explicitly *not*
   purple/blue AI colours, inspired by threeui.com and northaxis.outcomes.digital. Public site
   redrawn in a light desert skin, then the signed-in app, then the owl logo in terracotta/earth
   tones.
5. **True Property Cost** (10 Oct, `24ced2e`→`a7e2e01`) — built as "Landed Cost", audited,
   redesigned as premium, renamed (owner chose the name from options), rental yield + cash cost +
   PDF report + worked example added (compared against a reference calculator the owner shared).
6. **Everything to the TPC standard** (11 Oct, `aa28cb8`) — shared hero/scene kit (`ToolHero`,
   `ArchScene`, `SealFigure`, `HeroStat`, `HeroSkeleton`) rolled out to every tool, page, loading
   state, auth screen and 404 (~130 files).
7. **Phone audit** (`b00e1d4`) and **dark-mode audit** (`92d5dc2`) — 320/375/768px overflow and
   truncation fixes; dark contrast fixes (asterisks, links, avatar initials, badges), address-bar
   `theme-color` following the page (`src/components/app/ThemeColor.tsx`), dashboard pipeline as a
   container query, recon step labels wrap.

**State right now:** working tree clean apart from untracked `.claude/`. Nothing in progress. The
last request ("check the website in dark mode and fix errors") is done, pushed and reported.

---

## 20. Open items & ideas (none started; ask before doing)

Needing the owner (dashboard / decisions):
1. Confirm migrations 0029/0030 are applied (query in §13).
2. Supabase **free tier pauses** the project after inactivity — production sign-in goes down until
   restored. Upgrading to a paid plan is the real fix if real vouchers run through it.
3. Supabase Database → Backups / PITR status never confirmed.
4. Supabase's built-in auth mailer (signup confirmation, password reset) is rate-limited and not
   meant for production; a Resend account could back custom SMTP. (Resend for workflow emails was
   *deliberately* skipped — don't re-raise that part.)
5. Migration 0018's two verification queries were never confirmed run.
6. Rotate the Apollo key (§18).
7. Strategic, unresolved, don't re-litigate unprompted: self-serve SaaS architecture vs a
   sales-led funnel, and **no billing at all** (`Context file.md` §19).
8. Contact Finder is allowlist-only; the owner said (Aug) "we'll finish building this and then
   open to everyone" — opening it needs a decision on who pays for Apollo credits.

Code, optional:
9. ~~Reconciliation PDF in the old navy palette~~ — done 11 Oct (voucher PDF too).
10. Valuation Desk: EDGAR USD figures are labelled ₹ crore in places (`crore()` ignores currency);
    Yahoo price fetch may be refused from Vercel's IP (then multiples stay blank for US filers).
11. Legal pages' reading measure is ~88 characters, not the intended 64.
12. Rage-click card could return to the analytics behaviour screen when traffic supports it.
13. Not built: Google Sheets sync; the four planned agents.

---

## 21. What is stale in `Context file.md`

Read it for depth, but correct these:
- "The public site is dark always (`--m-*` under `[data-skin='night']`)" → now the **light desert
  skin** (`[data-skin='desert']`); the app defaults to **light**, with dark as a user choice.
- "Two agents are live" / roster table → five live (§5).
- "27 migrations" → 31 (§13).
- Route map lacks `(value)`, `(finder)`, `(landed)`, `api/comps`, `api/finder`, `llms.txt`.
- Test counts (735) → 1,360.
- "Never `next dev` with Turbopack" → only applies when serving from a foreign working directory
  (§16).
- Model defaults mentioned there may differ from the code — check `src/lib/assist/anthropic.ts`.
- `README.md` has the same "dark always" and "two agents" staleness.

---

## 22. Further reading in the repo

- `Context file.md` — deep briefing (Aug 22): workflow, multi-tenancy, analytics decisions,
  responsive rules, copy rules, invariants.
- `README.md` — front door; long-form on approvals, recon, Ask, analytics, Supabase URL config
  (the "sign-in sends you to localhost" trap and how to diagnose it with curl).
- `docs/01-system-analysis.md` (v1 analysis), `docs/02-reference-constants.ts` (v1 business rules
  — do not change), `docs/03-rebuild-architecture.md` (original decisions; predates multi-tenancy).
- Every migration's header comment — the real design record.
