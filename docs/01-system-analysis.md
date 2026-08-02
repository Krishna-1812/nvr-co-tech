# NVR Voucher Portal — Full System Analysis

**Source-verified** against the real repo: `github.com/vivekgaggarnvr-crypto/NVR-Voucher`
(cloned to `NVR Tech/NVR-Voucher`). Live at `https://nvr-voucher.vercel.app`.

37 files, ~3,100 lines of application code, 14 commits. Everything below is read from source.

> Earlier notes in this folder were reconstructed from the deployed bundle before the correct repo
> was available. This document supersedes them; `_reverse/` is kept only as a cross-check and can
> be deleted.

---

## 1. What this product actually is

**"N V R & Co — Payment Voucher Portal."** The npm package name is **`cio-voucher`**.

N V R & Co is the accounting firm operating the portal; the subject organisation is the
**CIO Association**, which has a Head Office plus 14 city chapters. The association runs **events**,
vendors invoice against those events, and staff raise a numbered **payment voucher** per payment
with two named approvals.

The job-to-be-done: **turn an invoice + an event into a signed, numbered voucher — emitted
simultaneously as a PDF, an Excel row, and a Google Sheet row.**

Per the README: *"Each user only sees their own data (enforced by Supabase Row Level Security)."*

---

## 2. Tech stack (from `package.json`)

| Layer | Technology |
|---|---|
| Framework | **React 19.2** + **Vite 8** |
| Routing | react-router-dom **v7** |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) |
| Auth + DB | Supabase (`@supabase/supabase-js` 2.108) |
| PDF | jsPDF 4.2 + html2canvas 1.4 |
| Excel | xlsx (SheetJS) 0.18 |
| Sheets | `googleapis` 173 — **server-side only** |
| Lint | oxlint |
| Host | Vercel (SPA rewrite + `/api/*` serverless functions) |

Frontend env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
Server env (used by `/api`, **not documented in `.env.example`**): `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
`GOOGLE_PRIVATE_KEY`, plus the two `VITE_*` vars reused server-side.

---

## 3. Routes (`src/App.jsx`)

| Path | Access | Page |
|---|---|---|
| `/login` | public | Login |
| `/signup` | public | Signup |
| `/` | protected | Dashboard |
| `/new` | protected | VoucherForm |
| `/report` | protected | Report |
| `/settings` | protected | Settings (Google Sheet) |
| `/admin` | protected + **in-component** `isAdmin` guard | Admin |
| `*` | — | redirect to `/` |

`ProtectedRoute` only checks for a session. `/admin` is not gated at the route level — the guard
lives inside `Admin.jsx` (`if (!isAdmin) return <Navigate to="/" replace />`). Fine in practice, but
real enforcement depends entirely on RLS.

---

## 4. Auth & roles

`AuthContext` wraps Supabase auth: `signInWithPassword`, `signUp`, `signInWithOAuth({ provider: 'google' })`,
`signOut`. No password reset, no email verification step, no MFA.

### Three-tier roles — `profiles.is_admin`, `profiles.is_owner`

| Role | Capability |
|---|---|
| **User** | Own vouchers only |
| **Admin** | View + download **every** user's vouchers |
| **Owner** | Everything, **plus** grant/revoke admin |

Promotion rule (`Admin.jsx`): `canToggle = isOwner && !u.is_owner && !isSelf` — only an owner can
promote/demote, never another owner, never themselves. Owner is not assignable in-app (set in DB).

---

## 5. Data model (Supabase / Postgres)

**No SQL migrations exist in the repo** — the schema lives only in the Supabase project. Inferred
from queries:

- **`vouchers`** — the 32 form fields + `id`, `user_id`, `created_at`, `deleted_at`, `net_total`,
  `grand_total`. `type_of_payment` is a **Postgres array** (`text[]`) — written as `[value]`.
- **`events`** — `id`, `user_id`, `name`, `chapter`, `date_of_event`, `created_at`.
- **`chapters`** — `id`, `user_id`, `name`.
- **`profiles`** — `id`, `email`, `is_admin`, `is_owner`.
- **`user_settings`** — `google_sheet_id` (one row per user).

Events and chapters are **per-user**, not global — two staff members build separate event lists.

---

## 6. The New Voucher form (`VoucherForm.jsx`, 630 lines)

One page, five numbered `<Section>`s, sticky bottom action bar (Reset · Generate Voucher).

**① Voucher Info** — Date · Chapter (select) · Voucher No. (`e.g. V001`) · Sponsored / Non-Sponsored (radio pills)

**② Event Details** — Event Name (select existing, or `Create New Event…`) · Event Narration ·
Type of Supporting (pills) · Type of Payment (pills, conditional) · Invoice No. · Invoice Date ·
Invoice Received Date

**③ Amount Breakdown** — Basic Value (A) · VAT/Other (C) · CGST · SGST · IGST · auto Total Tax (B) ·
auto Net Total · (−) TDS (E) · (−) Advance (G) · (+) Tips (H) · (−) Discount (I) · auto Grand Total

**④ Payment Details** — Paid To · Paid By Chapter · Payment Date · Beneficiary Name · UTR/Ref No. ·
PAN Number (optional) · GST Number (optional)

**⑤ Approvals** — Initiated By · 1st Approval Done By · 2nd Approval Done By

### Business rules actually enforced

**Formulas** (`helpers.js`) — note the sign convention:
```
Total Tax  (B) = CGST + SGST + IGST
Net Total  (D) = Basic Value (A) + B + VAT/Other (C)
Grand Total    = D − TDS(E) − Advance(G) + Tips(H) − Discount(I)
```

**GST is exclusive-by-disabling** — not just validated. If CGST or SGST has any value, the IGST
input is `disabled`; if IGST has a value, CGST and SGST are `disabled`. Helper text:
*"Use either CGST + SGST (same state) or IGST (other state) — not both. Clear one side to switch."*
A submit-time check still catches the half-filled pair.

**Type of Supporting → Type of Payment** (`PAYMENT_RULES`):

| Supporting | Options | Auto |
|---|---|---|
| Invoice | Advance, Full Payment | *user picks* |
| Proforma Invoice | Advance | Advance |
| Reimbursement | Full Payment | Full Payment |
| Contract | Advance | Advance |

When auto, the UI renders a locked pill reading e.g. `Advance · auto-selected`.

**Paid By Chapter ∈ {`CIO Association HO`, selected chapter}.** Changing Chapter clears
`paid_by_chapter` if it's no longer allowed.

**Event selection auto-fills** `event_id`, `event_name`, `event_date`, and `chapter`
(chapter only if not already set).

**Input sanitisers** (applied live, on keystroke):
- `lettersOnly` → `[A-Za-z\s.]` — the three approval-name fields
- `alphaNumeric` → `[A-Za-z0-9\s\-/]` — Beneficiary Name, UTR/Ref
- PAN and GST also `.toUpperCase()`

**Validation is only two rules:** `Please enter a Voucher No.` and the CGST/SGST pairing check.

### On "Generate Voucher"
1. `INSERT` into `vouchers` (empty → `null`, amounts → `0`), `.select().single()`.
2. `syncVouchersToSheet(inserted).catch(() => {})` — **fire-and-forget, deliberately silent**
   (comment: *"so a sheet problem can never block or fail the voucher save"*).
3. `generateVoucherPDF(...)` → auto-downloads `NVR-Voucher-<voucher_no>.pdf`.
4. Success banner, scroll to top. The form is **not** cleared.

---

## 7. The PDF (`VoucherDocument.jsx` + `pdf.js`)

A 1040px-wide styled HTML node rendered off-screen at `left: -10000px`, captured by html2canvas at
`scale: 2.5`, embedded as a PNG into an **A4 landscape** jsPDF with an 8mm margin.

Layout: `NVR` wordmark (the V in `#7091E6`) · centred "N V R & Co / Payment Voucher" ·
Date/Chapter/Vch. No. block · a `Sponsored / Non-Sponsored` line where the **non-applicable word is
struck through and greyed** · then the main table:

`Particulars | Details | Amount | Amount` — Event Name, Event Date, Event Narration, Type of
Supporting, Type of Payment, Invoice No./Date/Received Date, then the amount ladder
(Basic Value, +CGST/+SGST/+IGST **only when non-zero**, +VAT, Net Total, −TDS, −Advance, +Tips,
−Discount, Grand Total), then "Amount to be paid", then the payment/approval footer.

Palette: `#3D52A0` (border/ink), `#7091E6`, `#8697C4`, `#ADBBDA`, text `#1F2937`, label bg `#F7F6FB`.

---

## 8. Report page (`Report.jsx`, 569 lines)

- Active vouchers (`deleted_at IS NULL`), newest first. Per-row **Download PDF** and **soft delete**.
- **Deleted Vouchers** bin below: **Restore** / **Delete permanently**. Permanent delete removes the
  DB row *then* calls `deleteSheetRow(id)` (best-effort) to pull the matching Google Sheet row.
- **Clear All** — bulk soft-delete of the user's active vouchers.
- **Events** and **Chapters** management: individual delete + "clear all" (both **hard** deletes).
- `↓ Download Excel` → `NVR-Voucher-Report.xlsx`, sheet `Vouchers`, 32 columns.

Re-downloading a PDF sets `docData` then waits a **60 ms `setTimeout`** for the hidden document to
re-render before capturing — a race, not a guarantee.

**There is no search, filter, sort, date range, or pagination.** Every voucher loads at once.

---

## 9. Dashboard, Settings, Admin

**Dashboard** — two stat cards (Total Vouchers, Total Amount ₹) + 10 most recent
(Voucher No. · Event · Date · Chapter · Grand Total). Every row navigates to `/report`.

**Settings** — Google Sheet Sync. Three-step manual onboarding: create a sheet → share it as
**Editor** with `voucher-sheet-sync@voucher-502510.iam.gserviceaccount.com` (with Copy button) →
paste the link. `getSheetInfo` fetches the title, which doubles as a permission check; the title is
shown for confirmation before saving. Green **Connected** badge; **Remove sheet** disconnects.

**Admin** — user list with Owner/Admin/User badges and per-user voucher counts; click through to
that user's vouchers, download any PDF, or export `NVR-<email>-Vouchers.xlsx`.

---

## 10. Serverless API (`/api/*`)

All three POST endpoints take the user's Supabase `access_token` **in the JSON body**, verify it via
`supabase.auth.getUser()`, then read that user's own `user_settings.google_sheet_id` through an
RLS-scoped client — so a user can only ever write to the sheet they connected. Google access uses a
service-account JWT (`google.auth.JWT`) with the `spreadsheets` scope.

| Endpoint | Body | Behaviour |
|---|---|---|
| `POST /api/sheet-info` | `{access_token, sheet_id}` | Returns sheet title. Maps 403 → *"make sure you shared it with the service account email (as Editor)"*, 404 → *"No sheet found for that link."* |
| `POST /api/sync-sheet` | `{access_token, headers, rows}` | Writes the header row **only if A1 is empty**, then appends rows (`INSERT_ROWS`, `RAW`). |
| `POST /api/delete-sheet-row` | `{access_token, voucher_id}` | Reads column A, finds the matching id, `deleteDimension` on that row. No sheet connected or id not found → **200 no-op**. |

The sheet carries **33** columns: `Voucher ID` prepended to the 32 export columns.

---

## 11. Complete flow

```
Signup / Login (email+password or Google OAuth)
        │
        ▼
   Dashboard ────────────► Report ──► per-row PDF · Excel export
        │                    │        soft delete → Restore / Permanent delete (+ sheet row)
        │                    └──────► manage Events & Chapters (hard delete)
        ▼
  New Voucher (32 fields, 5 sections)
        │  select Event      → auto-fills name, date, chapter
        │  Type of Supporting→ constrains/auto-selects Type of Payment
        │  CGST+SGST xor IGST→ opposite inputs disabled
        │  amounts           → live Total Tax, Net Total, Grand Total
        ▼
  Generate Voucher ──► Supabase INSERT
                   ──► Google Sheet append (silent on failure)
                   ──► PDF auto-download
        │
        ▼
   Settings: connect Google Sheet      Admin: roles + all users' vouchers
```

---

## 12. Problems found in the source

### Bugs

1. **`event_id` and `event_date` are never saved.** The insert payload in `VoucherForm.jsx`
   (lines 178–212) omits both, though they exist in form state and the DB. Consequences: the
   voucher→event link is lost entirely, and **re-downloading a PDF from Report or Admin renders an
   empty "Event Date" row** — the field only appears on the copy generated at creation time. This is
   the most serious defect in the codebase.
2. **PDF re-download depends on a 60 ms `setTimeout`** to let the hidden node re-render. On a slow
   device this captures the previous voucher — or a blank node.
3. **Duplicate chapters in the dropdown.** The hard-coded `CHAPTERS` list and the user's own
   `chapters` rows are rendered back to back with no dedupe, so re-adding "CIO Association Pune"
   shows it twice.
4. **Hard-coded chapters can't be removed**, only added to — the constant is compiled into the bundle.
5. **`Sponsored / Non-Sponsored` prints twice** in the PDF header: once as the struck-through pair,
   then again as the raw value. Minor, but it's on the signed artefact.
6. The PDF table declares **four columns, two of them both headed "Amount"**.

### Product gaps

7. **The approval workflow is fake.** `initiated_by` / `approval_1` / `approval_2` are free-text
   name boxes typed by whoever creates the voucher. No status field, no submit-for-approval, no
   approver identity, no timestamps, no rejection path, no audit trail. **This is the single biggest
   gap** — the app is named for an approval process it doesn't implement.
8. **Vouchers cannot be edited.** Insert, soft-delete, restore only. A typo in any of 32 fields means
   deleting and re-keying the whole thing.
9. **No invoice attachment.** The entire product is driven by invoices and there is nowhere to
   upload one.
10. **Voucher numbers are typed by hand** — no auto-increment, no per-chapter series, no uniqueness
    check. Collisions and gaps are inevitable, and voucher_no is the human primary key.
11. **No search, filter, sort, date range, or pagination** anywhere. Unusable past a few hundred rows.
12. **No voucher detail view** — dashboard rows all just navigate to `/report`.
13. Dashboard has two numbers. No spend by chapter/event/month, no tax summary, no top vendors.
14. **Sheet sync fails silently by design.** The user is told "saved & downloaded"; the sheet may
    have received nothing. No status, no retry, no backfill.
15. **No form persistence.** 32 fields, no autosave/draft — a refresh loses everything. The form
    also isn't cleared after a successful save, inviting accidental duplicates.
16. Deleting an event or chapter is a **hard delete** while vouchers are soft-deleted — inconsistent
    and destructive.

### Engineering / DX

17. **No SQL migrations or RLS policies in the repo.** The entire schema and the security model are
    undocumented and live only in the Supabase dashboard — unreviewable and unreproducible.
18. **`.env.example` omits `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY`**, so a fresh
    clone cannot get Sheets working without reading the API source.
19. **README is stale** — documents 5 routes and no Sheets integration; the app has 7 routes,
    Google Sheets sync, soft delete, and a three-tier role system.
20. **PDF is a rasterised screenshot.** Text isn't selectable or searchable, file sizes are large,
    and quality is resolution-dependent — bad for an archival financial document.
21. **No code splitting**; SheetJS, html2canvas and jsPDF all load before the login screen paints.
22. **No tests at all**, no CI. Lint only.
23. Access tokens are passed in the request **body** rather than an `Authorization` header.
24. Every list query is unbounded `select('*')` with no `.limit()`.

---

## 13. Requirements to carry into the rebuild

Non-negotiable — these encode the actual accounting process:

- The 32 voucher fields with their exact labels (they mirror a physical form).
- The three formulas exactly, **including Tips adding and Advance subtracting**.
- The Type of Supporting → Type of Payment rules, with auto-selection.
- CGST+SGST **xor** IGST, enforced by disabling.
- Paid By Chapter ∈ {HO, selected chapter}.
- ₹ `en-IN` 2-decimal formatting; **dd/mm/yyyy** dates.
- The printed voucher layout — this is the artefact people sign.
- Three outputs: PDF, Excel, Google Sheet.
- Soft delete with a restore bin.
- Owner > Admin > User, with the "owner can't demote an owner or self" rule.
- 15 default chapters, user-extensible; user-creatable events.

---

## 14. Questions before I design the replacement

1. **Should the approval workflow become real?** Statuses, approver accounts, submit → approve/reject,
   audit log, email notification. It's the highest-value change available and the one the product is
   named for — but it reshapes the data model and is meaningfully more than a UI refresh.
2. **Same client, or a generic multi-tenant product?** Decides whether the 15 CIO chapters and
   "CIO Association HO" stay hard-coded or become org configuration.
3. **Do you have access to the Supabase project?** The repo has no migrations, so I can't see the
   RLS policies or column constraints. If not, I'll design a fresh schema and write the migrations
   properly — arguably better anyway.
4. **Stack:** I'd recommend Next.js + Supabase + Tailwind + shadcn/ui, with **server-generated
   vector PDFs** replacing html2canvas. Say the word if you're tied to Vite/React SPA or another host.
5. **Keep Google Sheets sync?** It reads like a workaround for "finance wants it in a sheet."
   A genuinely filterable table plus scheduled Excel export may remove the need — but if their
   accountant lives in that sheet, it stays and should become *reliable* (queued, retried, visible).
6. **Invoice attachments** — worth adding? (Supabase Storage.) It's the most obvious missing feature.
7. **Should events and chapters become shared/org-level** instead of per-user? Right now two staff
   members maintain separate, diverging event lists for the same real events.
