# Finance Intelligence

A platform of AI agents for finance work, built by chartered accountants.

Two agents are live.

**Voucher Desk** is the first: payment vouchers and a two-step **approval workflow** for the CIO
Association. It is a rebuild of the v1 voucher portal, whose repository is recorded outside this
file because its name carries the old brand. All 32 business fields, the amount formulas and the
printed voucher layout are preserved exactly — they encode a real accounting process. Everything
around them is rebuilt.

**Ledger Reconciliation** is the second: two ledgers in, a Bank Reconciliation Statement out. It is
a port of a Python and React tool that ran as a separate FastAPI service, rebuilt as a TypeScript
engine that runs **entirely in the browser**. The files are read on the reader's own machine and
never uploaded, which for client bank statements is a better answer than a server-side session; it
also removed the in-memory store the original lost on every restart.

**Ask** is not a third agent. It is a layer across the other two: a chat panel on every signed-in
screen, and a page of its own at `/ask`. It answers questions about the tools and about the
accounting behind them, grounded in a corpus that is generated from the same roster the website
renders, and it does its arithmetic by calling the application's own functions rather than by adding
up in prose. See below.

See [`docs/01-system-analysis.md`](docs/01-system-analysis.md) for the analysis of v1 and
[`docs/03-rebuild-architecture.md`](docs/03-rebuild-architecture.md) for the design decisions.

## Layout of the app

```
/                     public marketing site   src/app/(marketing)
/login, /signup       auth                    src/app/(auth)
/hub                  the workspace           src/app/(hub)
/dashboard, /vouchers,
/approvals, /admin,
/settings             Voucher Desk            src/app/(app)
/reconcile            Ledger Reconciliation   src/app/(recon)
/ask                  the assistant           src/app/(assist)
/analytics            visitor intelligence    src/app/(insight)
```

Each tool is a route group with its own `Section` (see [`src/lib/nav.ts`](src/lib/nav.ts)) handed to
one shared `AppShell`. A third tool is a nav definition and a route group, not a third shell.

`src/proxy.ts` gates the last group and nothing else — see the note there on why it is a deny-list.
Everything the public site says about itself lives in
[`src/lib/marketing/content.ts`](src/lib/marketing/content.ts), including the agent roster, so the
product name and positioning are one file rather than a search-and-replace.

The public site is dark always and the application follows the reader's system theme. Those are two
separate token sets: `--m-*` under `[data-skin='night']` for marketing, and the `:root` tokens for
the app. Neither can reach the other, which is deliberate.

---

## The headline change: approvals are real

In v1, "1st Approval Done By" and "2nd Approval Done By" were free-text boxes typed by whoever
created the voucher. There was no status, no approver identity, no timestamps, no rejection path and
no audit trail — a voucher could be self-approved by typing a colleague's name.

Here the workflow is enforced **in Postgres**, so it holds regardless of client:

```
draft ──submit──► pending_first ──approve──► pending_second ──approve──► approved ──► paid
  ▲                    │                          │                          │
  └──── reopen ────────┴───────── reject ─────────┘                    (immutable)
```

- The initiator can **never** approve their own voucher.
- The second approver must be a **different person** from the first.
- Rejection **requires a reason**; approvals already given are voided so the next run starts clean.
- `approved` and `paid` vouchers are **immutable** — a trigger blocks field edits.
- Every transition writes to `voucher_audit`, which has **no UPDATE or DELETE policy**: not even an
  owner can rewrite history.

Roles: `member` → `approver` → `admin` → `owner`. An owner may not demote another owner or themselves
(carried over from v1).

## Other fixes carried in

| v1 problem | v2 |
|---|---|
| `event_id`/`event_date` silently dropped on insert — re-downloaded PDFs showed a blank Event Date | Both persisted; `event_id` is a real FK |
| Voucher numbers hand-typed, duplicates possible | Generated `FI/<CHAPTER>/<FY>/0001`, unique, assigned on submit |
| `net_total`/`grand_total` computed in JS and trusted | Postgres **generated columns** — cannot drift |
| Events/chapters per-user, so staff kept diverging lists | Org-level |
| Sheet sync failures swallowed by `.catch(() => {})` | `sheet_sync_log` — every attempt recorded and retryable |
| No schema in the repo; RLS lived only in the dashboard | Four reviewable migrations |
| No invoice attachment anywhere | Supabase Storage, access mirroring the voucher |
| No tests | 115, covering the formulas, every segregation-of-duties rule, PDF output and attachment handling |

### One more, found while building the settings screen

`profiles_update_self` let anyone update their own profile row. RLS is *row*-level —
it decides which rows an UPDATE may touch, never which columns — so on its own it
also permitted:

```sql
update profiles set role = 'owner' where id = auth.uid();
```

Since `current_role_of()` reads exactly that column, any signed-in member could have
taken over the authorisation model with one REST call. Restricting columns needs a
column-level `GRANT`, which `0003_rls.sql` now does: only `full_name` is
self-writable, and `role` moves solely through `set_user_role()`.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase · Vitest

## Setup

```bash
npm install
cp .env.example .env.local   # fill in your Supabase values
npm run dev
```

### Looking at it without a database

Set `NEXT_PUBLIC_PREVIEW_MODE=1` in `.env.local` and run `npm run dev`. The app
runs on fixtures with no Supabase at all, signed in as an owner, so every screen
is reachable. An amber banner marks it throughout.

It bypasses authentication, so it cannot be enabled on a deployed instance: it
requires a non-production build as well as the flag, and `next build` / `next start`
both set `NODE_ENV=production`. It also proves nothing — RLS, the triggers, the
generated columns and the constraints are all absent. See `src/lib/preview/`.

Apply the migrations in order (`supabase/migrations/0001` → `0007`) via the Supabase SQL editor or
`supabase db push`, then promote your first account:

```sql
update profiles set role = 'owner' where email = 'you@example.com';
```

Migrations are applied by hand while a push to `main` deploys itself, so **apply the
migration before merging the code that needs it**. Code that reaches production ahead
of its schema is the normal case here, not an accident.

## Where this runs

`vercel.json` pins the functions to `bom1` (Mumbai). This is not a preference, it is
the difference between a page that answers in 200 ms and one that takes over a second.

Vercel's default function region is `iad1` (Virginia), and the Supabase project is in
`ap-south-1` (Mumbai). Every signed-in page makes four round trips to Supabase before
it can send a byte — the proxy validates the session, then `getCurrentUser()` validates
it again and reads the profile, then the page runs its own queries — and on the default
region each of those crossed the planet, at roughly 220 ms a turn. The request itself
did the same: Mumbai edge, Virginia function, back again.

Both ends now sit in the same city. If the Supabase project is ever moved, move this
with it; a mismatch is invisible in the code and costs about a second a page.

### If the deployment URL ever changes, sign-in breaks

Renaming the Vercel project changes the `*.vercel.app` host, and **Supabase will not
follow**. Two fields in the Supabase dashboard, under **Authentication → URL
Configuration**, have to be updated by hand:

- **Site URL** — the new origin, e.g. `https://the-finance-intelligence.vercel.app`
- **Redirect URLs** — add `<new origin>/**`, keeping `http://localhost:3000/**` for
  local development

Miss them and the failure is thoroughly misleading. `signInWithOAuth` passes
`window.location.origin` as `redirect_to`, which is correct, but Supabase checks that
value against the allow-list and **silently discards it if absent**, falling back to
Site URL. With Site URL left at its default the browser is sent to
`http://localhost:3000` after a successful Google sign-in, and the user sees
`ERR_CONNECTION_REFUSED` from their own machine. Nothing is logged anywhere, and the app
is not involved in the redirect at all, so the repository looks blameless — it is.

To read the live configuration without dashboard access, ask the auth API to resolve a
`redirect_to` for you. A deliberately invalid token consumes nothing:

```bash
curl -s -o /dev/null -w '%{redirect_url}\n' -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/verify?token=invalid&type=recovery&redirect_to=https%3A%2F%2Fyour-host%2Fauth%2Fcallback"
```

The URL echoed back is the one Supabase would actually use. If it is your host, the
host is allow-listed. If it is something else, that something else is Site URL and your
host is not on the list. Omit `redirect_to` entirely to read Site URL directly.

Google Cloud Console needs nothing: Google returns to
`https://<project>.supabase.co/auth/v1/callback`, which does not vary with the app's
own domain.

## Verification

```bash
npm run check
```

Runs eslint, parse-checks every migration against real PostgreSQL grammar, runs the test suite, and
does a production build.

> The migrations are **parse-checked, not executed** — there is no local Postgres in this
> environment. Run them against a Supabase branch before trusting them in production.

## Status

Built:

- Schema, workflow and RLS migrations (8 files, parse-checked)
- Domain layer — formulas, payment rules, GST exclusivity, PAN/GSTIN validation — with 52 tests
- **Auth** — sign in, sign up, Google OAuth with its callback, route protection, role-aware shell
- **Settings** — your name, the role ladder and what each rung grants, theme
- Light and dark themes throughout, with the choice applied before first paint
- Dashboard (role-aware), approval queue with ageing and blocked-reason explanations
- **Voucher form** — autosaving drafts, live totals, dependent-field rules, inline validation
- **Voucher detail** — full record, amount ladder, approvals, and the immutable audit timeline
- **Voucher list** — server-side search, status/chapter filters, pagination
- **Vector PDF** — server-rendered, searchable, ~7 KB (v1 shipped a rasterised screenshot)
- **Admin screens** — roles, chapters, and a recycle bin that refuses to destroy approval records
- **Excel export** — 32-column v1 contract preserved, real numbers and dates, live totals, respects the active filters
- **Invoice attachments** — direct-to-Storage upload, signed-URL viewing, and a "no invoice attached" warning in the approval queue
- Error, not-found and per-route loading states
- **Public marketing site** — home, agent roster, per-agent pages, about, contact,
  with a generated social card, sitemap and robots
- **Ledger Reconciliation** — the whole tool (see below)
- **Ask** — a grounded assistant across every tool, with the arithmetic done by the app's own code

Not yet built: Google Sheets sync worker. Four of the six agents on `/agents` are roadmap
entries, and the pages say so.

### Ledger Reconciliation

The engine is pure TypeScript in [`src/lib/recon`](src/lib/recon), with 140 tests. Nothing in it
touches the network, the database or the DOM, which is what makes a reconciliation reproducible:
the same two files reconcile to the same statement every time.

- **Parsing** — Excel and CSV through SheetJS, PDF through pdf.js. The PDF reader rebuilds a
  BORDERLESS table from word coordinates, which is what a bank statement is: no ruled lines, just
  text that happens to line up. Scanned PDFs are refused with an explanation rather than returning
  an empty ledger.
- **Matching** — six passes, strongest evidence first: shared reference, then narration and amount,
  then narration alone, then a contra amount, then any amount, then one-sided.
- **The statement** — computed in one signed debit-positive space and projected onto the starting
  ledger's side, so a credit-balance start needs no separate rule. Contra ledgers, where a bank
  statement mirrors your cash book, are detected from the entries the two books share rather than
  from their closing balances, which a single timing difference can flip.
- **Exports** — a PDF working paper and a three-sheet workbook, both rendered server-side from a
  posted result, plus a CSV of whatever the differences table is showing.
- **History** — saved automatically to `reconciliations` (migration 0008), private to whoever ran
  it, and never updatable: re-running produces a new row.

`npm run recon:sample` writes a sample pair of ledgers to `scratch/`, in CSV and as borderless
PDFs, plus a reconciliation of them. The PDF parser's own test suite reads those PDFs back, and
skips itself if they have not been generated.

### Ask

The assistant lives in [`src/lib/assist`](src/lib/assist), with 262 tests. It talks to Anthropic's
Claude, streams over server-sent events, and is signed-in only, because an unauthenticated endpoint
that spends somebody else's API quota is a bill waiting to happen.

One file, [`anthropic.ts`](src/lib/assist/anthropic.ts), knows whose API it is. Everything else is
provider-agnostic and has proved it twice: the platform moved from OpenAI to Gemini and then from
Gemini to Anthropic without retrieval, the prompt, the tools, the event stream, the markdown
renderer or a single component changing.

Three things do the work that "accurate" usually only claims:

- **It may not invent.** Every claim about this platform has to come from a retrieved document, and
  the interface shows the reader which documents those were. The corpus is partly generated from
  `AGENTS`, so the assistant cannot describe a roadmap tool as available or promise something the
  marketing page stopped claiming.
- **It does no arithmetic.** Six tools are exposed to the model, and they call `calcGrandTotal`,
  `gstMode`, `isValidGstin`, `fiscalYear` and the rest directly. The same code the voucher form uses
  and the database mirrors. The working is printed under the answer with its inputs.
- **It is careful about statute.** Rates, sections and due dates are stated only where the site
  already commits to them, always with the note to confirm the current position.

Retrieval is lexical rather than embeddings, on purpose: the corpus is thirty documents we wrote, and
the same question has to reach the same documents every time or the tests are asserting about the
weather. A retrieval miss is fixed by adding a keyword, which is a thing a person can do.

Markdown is parsed to a tree and rendered as React elements. Nothing the model writes ever reaches
the HTML parser, and a link is only a link when it points inside this app.

**History** is saved to `assist_conversations` and `assist_turns` (migration 0009), private to
whoever asked, and kept until they delete it. The exchange is written by the route as the answer
streams, so what is stored is byte for byte what was on screen; a question whose answer failed is
not written at all, so a conversation never has a question sitting in it with nothing underneath.
Nothing expires on its own, which is why `/ask/history` carries a delete-everything control rather
than a retention rule invented on somebody's behalf. Neither table has an update policy: a turn is
a record of something that was said, so it is append-only, like `voucher_audit`. On a project
where the migration has not been applied, the assistant behaves exactly as it did before it
existed, and both the history page and the dropdown say why they are empty rather than showing an
empty list.

`ANTHROPIC_API_KEY` switches it on; without one the panel says so and nothing else is affected. In
preview mode with no key it streams a clearly labelled sample built from whatever retrieval found,
which is how the interface was built and is the reason the whole pipeline can be exercised without
spending anything.

#### How the tool loop is streamed

A tool call's arguments do not arrive as one object: they stream as fragments of JSON text against
the `content_block` they belong to, and are only complete once that block's `content_block_stop`
event closes it. [`anthropic.ts`](src/lib/assist/anthropic.ts) assembles each block in a map keyed by
its index and parses the accumulated JSON once, at that point, rather than trying to parse partial
fragments as they land.

Several tool calls in one turn go back as one `assistant` message and all their results as one `user`
message after it. Splitting them into a message each would interleave calls and results, which the
API rejects when the model asked for more than one at once.

Extended thinking is not wired up. If it is ever turned on, a thinking block streams as its own
`content_block` with `thinking_delta` events, and this code only ever reads `text_delta`, so it is
dropped by construction rather than by a special case that could be forgotten.

#### The model

Defaults to `claude-opus-5`, moved with `ANTHROPIC_MODEL`.

### Visitor intelligence

First-party web analytics, plus an engine that works out which *company* is behind an anonymous
visit. Migration 0010, the library in [`src/lib/analytics`](src/lib/analytics), the tracker in
[`public/a.js`](public/a.js), and four screens under `/analytics`.

There is no Google Analytics on this site and no third-party pixel of any kind. Our own script, our
own cookie, our own endpoints, our own database. That is the whole architecture, and it is why the
word first-party means something here rather than being a claim on a privacy page.

**Nobody sees it but an analytics admin.** The allowlist is a table, seeded with one address, and
`is_analytics_admin()` is called by every select policy in 0010 *and* by the application. One list,
so what the navigation shows and what Postgres will hand over cannot drift apart — which is the
usual way admin-gated interface quietly starts lying. Being an `owner` of the voucher workflow
grants nothing here; approving a payment is not a reason to be shown who read the pricing page.
Adding a colleague is one `INSERT`, with no deploy.

**Nobody writes to it directly either.** The beacon is unauthenticated by necessity — an anonymous
visitor has no session — so granting `anon` an insert policy would let anybody holding the
publishable key write whatever they liked into the visitor record. There are no insert policies on
the event tables at all. Every write goes through a `SECURITY DEFINER` function that decides for
itself what a row may contain.

#### The gate is the product

An IP address resolving to an organisation name does not mean that organisation employs the
visitor. It might be their broadband provider, their mobile carrier, a cloud host running somebody
else's crawler, or a security proxy that a thousand unrelated companies route their traffic
through. Reporting any of those as an account that visited your pricing page is a false positive
that ends the feature's credibility the first time a salesperson sees it.

So every address is classified first, and only `business`, `education` and `government` may ever
surface a name. Past that gate a name still needs evidence of the right *kind*: a reverse DNS
record or a direct provider hit stands alone; two independent methods agreeing stands; a clean
registry registrant on a small dedicated block stands. A single domain guessed from an organisation
name, on a large shared block, never does — however plausible the guess and whatever the arithmetic
said.

Expect roughly a fifth to two fifths of real traffic to resolve. That gap is the gate working, and
the instinct to widen it until the screen fills is the one change that would make every row on it
worthless. Every resolution carries the list of reasons it did or did not identify somebody, which
is what makes the refusals readable as answers rather than as failures.

The classification and scoring are unit-tested entirely offline, by injecting fake provider
responses — see [`gate.test.ts`](src/lib/analytics/ip/gate.test.ts), where most of the assertions
are about a refusal rather than a result.

#### Never fabricate a person

An anonymous visitor becomes a named person only when something proves it: a sign-in, a form
submission, or a token-gated webhook. Those create `deterministic` edges in the identity graph, and
only those may merge two identities. Sharing an IP or a device fingerprint creates a
`co_occurrence` edge, which is recorded and never read by the resolver — because the classic way an
identity graph destroys itself is one coincidental shared address on office wifi silently fusing
two unrelated people's histories.

What that buys, and it is the valuable half: the moment somebody signs in, everything they read
beforehand becomes theirs, because it was all keyed on a visitor id their browser was carrying the
whole time. What it does not buy is naming a stranger who has never interacted with us. That needs
a licensed identity graph or a publisher co-op; the plug point is a file reader shaped exactly like
one, so wiring a real feed in later is a procurement decision rather than an engineering project.

#### Money

Free enrichment runs for every identified visitor and costs nothing: the company's own homepage,
its schema.org and OpenGraph data, and a tech-stack fingerprint. Headcount and revenue for a
private company are left empty rather than estimated, because an honest gap is not a bug.

Paid enrichment lives in its own file that nothing else imports, has exactly one call site, and
that call site is a button on one named account. Every call writes a row to `enrichment_spend` with
the name of the person who caused it, because a rule about deliberate spending is only true if
somebody can check it afterwards.

#### Privacy

Do Not Track and Global Privacy Control are honoured unconditionally — no cookie, no identifier, no
request, not a reduced mode. Visitors whose timezone suggests a jurisdiction that expects to be
asked get a dismissible card, and declining wipes the identifier that already exists rather than
only the ones that would have. Both leave permanent, deliberate gaps in these numbers.

None of `IPINFO_TOKEN`, `APOLLO_API_KEY` or the rest is required. Without an IP-intelligence token
the engine falls back to reverse DNS and RDAP, which are free and need no key; it identifies fewer
visitors, which is the trade, not a fault. This project currently runs with no such token.

### Verified against a live database

Every migration through 0009 has been applied to a real Supabase project in Mumbai, confirmed on
15 August 2026 by querying `pg_tables`, `pg_policies`, `pg_indexes` and `pg_proc` rather than by
remembering. Sign-up, Google OAuth, voucher creation and submission (including the generated
voucher number) have been exercised end to end.

> **Migration 0010 has not been applied yet.** Until it is, the tracker collects nothing, the
> endpoints answer without writing, and `/analytics` says so plainly to whoever opens it instead of
> showing an empty dashboard. Run [`0010_analytics.sql`](supabase/migrations/0010_analytics.sql) in
> the Supabase SQL editor as one paste. It seeds `analytics_admins` with
> `krishna.ladha18@gmail.com`, which is the address that will be able to open those screens.

Voucher numbers issued before 0007 keep their `NVR/` prefix permanently, and the run of numbers
continued unbroken across the rename: see the note at the top of that migration for why both of
those are deliberate.

Still only exercised in preview mode, never against Postgres: approval and rejection —
both need a second and third account, since the segregation-of-duties rules deliberately
prevent one person from testing them — plus reopen, mark-paid, PDF, Excel export,
attachment upload, saving a reconciliation, and saving an assistant conversation. The last
of those was exercised in full against the preview client: asked, saved, reopened with its
tool traces and source chips intact, continued into the same conversation rather than a new
one, and deleted. That proves the components and the queries agree on a shape. It proves
nothing about the policies, which only Postgres enforces.

> `hello@thefinanceintelligence.com` and `security@thefinanceintelligence.com` on `/contact`
> are **unverified**: the domain is live, but neither mailbox has been created on it yet
> (no Google Workspace or equivalent is set up). Create both before sharing the site — see
> the note on `CONTACT` in `src/lib/marketing/content.ts`.
