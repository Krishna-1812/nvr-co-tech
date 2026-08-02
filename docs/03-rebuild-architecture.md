# NVR Voucher v2 — Architecture & Approval Workflow

Decisions for the rebuild. Client: **CIO Association** (same client — chapters stay as org data,
not multi-tenant config).

---

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Server Components for fast tables, Route Handlers replace the `/api` functions, one deploy target |
| DB + Auth | **Supabase** (same project, new tables) | Keep existing accounts; RLS is the security model |
| UI | **Tailwind v4 + shadcn/ui** | Accessible primitives, consistent design system |
| PDF | **`@react-pdf/renderer`, server-side** | Replaces html2canvas screenshots → real vector text, selectable, searchable, ~50× smaller, deterministic |
| Excel | SheetJS | Unchanged; column contract preserved |
| Sheets | `googleapis`, queued + retried | Same service account, but sync becomes observable |
| Files | Supabase Storage | Invoice attachments (new) |
| Validation | **Zod**, shared client + server | One schema, no drift |

**Migration note:** v1's PDF is a rasterised PNG. v2 renders vector PDFs server-side, so the output
is a genuine document — and identical whether generated at creation or re-downloaded years later
(v1's could not be, see the `event_date` bug).

---

## 2. Roles

`profiles.role` — a single enum, replacing v1's two loose booleans (`is_admin`, `is_owner`):

| Role | Create | Approve | Manage users | See all vouchers |
|---|---|---|---|---|
| `member` | ✅ | ❌ | ❌ | own only |
| `approver` | ✅ | ✅ | ❌ | own + queue |
| `admin` | ✅ | ✅ | ✅ (except owners) | ✅ |
| `owner` | ✅ | ✅ | ✅ | ✅ |

Carried over from v1: **an owner may not demote another owner or themselves.**

---

## 3. The approval workflow (the core change)

v1's approvals were three free-text name boxes typed by the person creating the voucher — no status,
no identity, no timestamps, no rejection. v2 makes them real.

### States

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
  ┌─────────┐  submit  ┌──────────────────┐  approve  ┌───────────────────┐  approve  ┌──────────┐
  │  draft  │─────────►│ pending_first    │──────────►│ pending_second    │──────────►│ approved │
  └─────────┘          └──────────────────┘           └───────────────────┘           └──────────┘
       ▲                       │                              │                             │
       │                       │ reject                       │ reject                      │ mark paid
       │                       ▼                              ▼                             ▼
       │                 ┌──────────┐                                                  ┌──────────┐
       └─────────────────│ rejected │◄─────────────────────────────────────────────────│   paid   │
            reopen       └──────────┘                                                  └──────────┘
                                                                                   (terminal, locked)
```

| Status | Meaning | Who acts next |
|---|---|---|
| `draft` | Being written. Editable. Not visible to approvers. | initiator |
| `pending_first` | Submitted, awaiting 1st approval | any eligible approver |
| `pending_second` | 1st approval given, awaiting 2nd | a *different* eligible approver |
| `approved` | Both approvals in. **Locked** — no field edits. | admin marks paid |
| `rejected` | Sent back with a mandatory reason. Reopenable to `draft`. | initiator |
| `paid` | Payment executed, UTR recorded. Terminal. | — |

### Segregation of duties — enforced in the database, not just the UI

1. The **initiator cannot approve** their own voucher (either level).
2. The **second approver must differ from the first**.
3. Only `approver` / `admin` / `owner` may approve.
4. **Rejection requires a reason** (non-empty, enforced by CHECK).
5. `approved` and `paid` vouchers are **immutable** — a trigger blocks field updates; corrections go
   through an explicit reopen, which is itself audited.

These are enforced by Postgres triggers so they hold regardless of client — the single most
important property the original lacked.

### Audit trail

Every transition writes an immutable row to `voucher_audit`: who, what, from → to, when, note.
Append-only (no UPDATE/DELETE grant to anyone). This is what makes the voucher defensible to an
auditor, and it's what v1 had no equivalent of.

---

## 4. Schema changes vs v1

**Kept identically** — all 32 business fields, the three formulas (Tips add, Advance subtracts),
the payment rules, the GST xor, Paid-By-Chapter constraint, ₹ `en-IN`, dd/mm/yyyy.

**Fixed:**
- `event_id` and `event_date` are **actually persisted** (v1's insert dropped both — see
  [01-system-analysis.md](01-system-analysis.md) §12.1). `event_id` becomes a real FK.
- `voucher_no` is **auto-generated and unique per chapter per financial year**
  (`NVR/<CHAPTER>/25-26/0001`), replacing hand-typed numbers.
- `type_of_payment` becomes a plain enum column, not a one-element array.
- Events and chapters become **org-level**, not per-user — v1 gave each user a diverging private list
  of the same real events.
- Chapters move fully into the DB (seeded with the 15), so HO can add/retire them without a deploy.
- Soft-delete is consistent across vouchers, events, and chapters.

**Added:**
- `voucher_attachments` — the actual invoice files (Supabase Storage).
- `voucher_audit` — append-only history.
- `sheet_sync_log` — makes Google Sheet sync observable instead of silently swallowed.

---

## 5. UX plan

The brief is "much better UI/UX". Concretely:

**Voucher form** — v1 was 32 fields on one page with no persistence. v2:
- A 5-step flow with a progress rail; each step validates before advancing, but any step is
  jump-to-able for editing.
- **Autosave to `draft` from the first keystroke** (debounced). A refresh never loses work.
- Live voucher preview alongside the form — you see the document as you fill it.
- Real inline validation: PAN `[A-Z]{5}[0-9]{4}[A-Z]`, GSTIN with its checksum, payment date ≥
  invoice date, duplicate-invoice warning per vendor.
- Amount inputs with ₹ formatting and a running total that stays visible.

**Approval queue** — new. "Awaiting your approval" as the approver's landing page, with a
side-by-side diff of voucher vs attached invoice, and one-click Approve / Reject-with-reason.

**Report** — real table: server-side search, filters (chapter, status, event, date range, amount
band), sortable columns, pagination, saved views, bulk export of the current filtered set.

**Dashboard** — role-aware. Members see their drafts and rejections; approvers see their queue depth
and ageing; admins see spend by chapter/month/event, tax summary, top vendors, and cycle time.

**Throughout** — keyboard navigation, optimistic updates with rollback, skeleton loaders, empty
states, toast system, full dark mode, and a mobile layout that actually works for approvals
(approving on a phone is the common case).

---

## 6. Build order

1. ✅ Analysis + decisions *(this doc)*
2. SQL migrations — schema, RLS, workflow triggers, seed
3. Next.js scaffold, Supabase auth, role-aware shell
4. Voucher form + autosave + validation
5. Approval queue + transitions + audit
6. Report table + filters + Excel
7. Server-side vector PDF
8. Attachments
9. Sheets sync with retry + log
10. Dashboards

---

## 7. Open items (not blocking — sensible defaults taken)

- **Voucher number format** — defaulting to `NVR/<CHAPTER-CODE>/<FY>/<0001>`. Easy to change; tell me
  if the firm has an existing convention that must be matched.
- **Financial year** — assuming India, 1 April – 31 March.
- **Notifications** — building in-app first; email on submit/approve/reject is a small addition once
  the client confirms they want it.
- **`paid` status** — added because "voucher approved" and "money sent" are different facts and the
  UTR field implies they track the second. Trivially removable if they don't want it.
