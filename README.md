# NVR Intelligence

A platform of AI agents for finance work, operated by N V R & Co, Chartered Accountants.

**Voucher Desk** is the first and currently the only live agent: payment vouchers and a two-step
**approval workflow** for the CIO Association. It is a rebuild of
[`vivekgaggarnvr-crypto/NVR-Voucher`](https://github.com/vivekgaggarnvr-crypto/NVR-Voucher).
All 32 business fields, the amount formulas and the printed voucher layout are preserved exactly —
they encode a real accounting process. Everything around them is rebuilt.

See [`docs/01-system-analysis.md`](docs/01-system-analysis.md) for the analysis of v1 and
[`docs/03-rebuild-architecture.md`](docs/03-rebuild-architecture.md) for the design decisions.

## Layout of the app

```
/                     public marketing site   src/app/(marketing)
/login, /signup       auth                    src/app/(auth)
/dashboard, /vouchers,
/approvals, /admin,
/settings             the signed-in product   src/app/(app)
```

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
| Voucher numbers hand-typed, duplicates possible | Generated `NVR/<CHAPTER>/<FY>/0001`, unique, assigned on submit |
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

Apply the migrations in order (`supabase/migrations/0001` → `0006`) via the Supabase SQL editor or
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

- Schema, workflow and RLS migrations (5 files, parse-checked)
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

Not yet built: Google Sheets sync worker. Five of the six agents on `/agents` are roadmap
entries, and the pages say so — only Voucher Desk exists.

### Verified against a live database

The migrations have been applied to a real Supabase project in Mumbai, and sign-up,
Google OAuth, voucher creation and submission (including the generated
`NVR/CIO/25-26/0001` number) have been exercised end to end.

Still only exercised in preview mode, never against Postgres: approval and rejection —
both need a second and third account, since the segregation-of-duties rules deliberately
prevent one person from testing them — plus reopen, mark-paid, PDF, Excel export and
attachment upload.

> `hello@nvrco.in` and `security@nvrco.in` on `/contact` are **unverified**. They were
> inferred from placeholder addresses in the test fixtures. Confirm both mailboxes exist
> before sharing the site — see the note on `CONTACT` in `src/lib/marketing/content.ts`.
