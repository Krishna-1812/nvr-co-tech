# NVR Voucher v2

Payment voucher and **approval workflow** for the CIO Association, operated by N V R & Co.

A rebuild of [`vivekgaggarnvr-crypto/NVR-Voucher`](https://github.com/vivekgaggarnvr-crypto/NVR-Voucher).
All 32 business fields, the amount formulas and the printed voucher layout are preserved exactly —
they encode a real accounting process. Everything around them is rebuilt.

See [`../docs/01-system-analysis.md`](../docs/01-system-analysis.md) for the analysis of v1 and
[`../docs/03-rebuild-architecture.md`](../docs/03-rebuild-architecture.md) for the design decisions.

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
| No tests | 100, covering the formulas, every segregation-of-duties rule, PDF output and attachment handling |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase · Vitest

## Setup

```bash
npm install
cp .env.example .env.local   # fill in your Supabase + Google values
npm run dev
```

Apply the migrations in order (`supabase/migrations/0001` → `0004`) via the Supabase SQL editor or
`supabase db push`, then promote your first account:

```sql
update profiles set role = 'owner' where email = 'you@example.com';
```

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

- Schema, workflow and RLS migrations (4 files, parse-checked)
- Domain layer — formulas, payment rules, GST exclusivity, PAN/GSTIN validation — with 52 tests
- Auth, route protection, role-aware app shell, dark mode
- Dashboard (role-aware), approval queue with ageing and blocked-reason explanations
- **Voucher form** — autosaving drafts, live totals, dependent-field rules, inline validation
- **Voucher detail** — full record, amount ladder, approvals, and the immutable audit timeline
- **Voucher list** — server-side search, status/chapter filters, pagination
- **Vector PDF** — server-rendered, searchable, ~7 KB (v1 shipped a rasterised screenshot)
- **Excel export** — 32-column v1 contract preserved, real numbers and dates, live totals, respects the active filters
- **Invoice attachments** — direct-to-Storage upload, signed-URL viewing, and a "no invoice attached" warning in the approval queue

Not yet built: Google Sheets sync
worker, admin screens (user roles, chapters, deleted-voucher bin).
