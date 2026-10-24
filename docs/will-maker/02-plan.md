# Will Maker — build plan (5 phases)

*24 October 2026. Read `01-research.md` first. Slug `will-maker`, route `/will-maker`, working
name **Will Maker** (change in one place, `content.ts`).*

## The product in one paragraph

A free, in-browser tool that turns what a person already told us (their Wealth Tracker record, if
they have one) plus a short guided interview into a **correctly structured Indian will**: a
print-ready PDF and an editable Word file, with a signing-day checklist, and a set of plain-English
checks that catch the mistakes that actually void or contest wills. It is a **drafting aid built on
the Indian Succession Act, not legal advice**, and it says so, and it refuses cases it cannot do
safely. Like Wealth Tracker and True Property Cost it works with no account; sign-in only saves the
work, and a passcode keeps it encrypted.

## Principles (non-negotiable; they come from HANDOFF §2 and the research)

1. **Deterministic, not generative.** The will text is assembled from a reviewed clause library by
   code. No LLM writes a clause. (Ask can *explain* a clause; it never drafts one.)
2. **Every rule cites its section and has a test.** If we are not certain, the check is a `note`,
   never a silent pass.
3. **Honest scope.** Out-of-scope (Muslim testators, Goa, foreign assets, anything needing a trust)
   gets a specific explanation and a hand-off, not a best guess.
4. **Browser-first privacy.** Will content never reaches our servers in plain text; never logged,
   never in analytics. Server sync is ciphertext when a passcode is set (existing `tool_saves`).
5. **No fabricated anything.** Sample wills are labelled samples with invented names; no
   testimonials, no counts of wills made.
6. **Match the house.** Same patterns as Wealth Tracker: pure `src/lib/will/*` + tests first, then
   UI in `src/components/will/`, route group `(will)`, desert skin, phone-first, light and dark.
7. **A lawyer signs off before it is public.** Phase 5 is gated on an advocate's written review of
   the clause library and the rules. Until then the tool is behind a flag.

## Architecture

```
src/lib/will/
  law.ts          statutory constants + citations; religion/regime → scope verdict
  model.ts        WillRecord, readWill() (defensive), blank*, ids, labels
  checks.ts       readiness checks: act / review / note, each with a section + a fix target
  clauses.ts      the clause library: ordered, conditional, deterministic text builders
  document.ts     buildWill(record) → WillDocument (sections, schedule, attestation) + plain text
  fromWealth.ts   WealthRecord → asset/people drafts (identifiers kept to last 4 unless the user adds them)
  store.ts        (Phase 2) per-user localStorage + optional passcode (reuses wealth/lock.ts)
  report.tsx      (Phase 3) PDF (react-pdf)   docx.ts (Phase 3) Word file
src/components/will/   wizard, review, preview               (Phase 2)
src/app/(will)/will-maker/                                   (Phase 2)
```

Reuse, don't duplicate: `wealth/lock.ts` (AES-GCM passcode), `wealth/money.ts` (Indian amounts),
`cloud/sync.ts` (account copy), `ui/CenterPanel`, `analytics` (counts only), `access.ts`
(`OPEN_TOOLS`), the PDF font setup used for ₹ and Indian scripts.

**Data model (v1, versioned, field keys never renamed):** `testator` (name, kin-of line, DOB/age,
religion, marital status, address, domicile), `people[]` (id, name, relation, DOB, address, role
tags), `assets[]` (id, kind, plain description, identifiers, share owned, nominee note, source =
`wealth:<itemId>` | `typed`), `gifts[]` (asset → beneficiaries with shares, alternate), `residue`
(beneficiaries + alternates, sums to 100), `executors[]`, `guardians[]`, `witnesses[]` (optional
until signing), `extras` (funeral wishes, digital assets, pets, liabilities, family-trust-style
conditions we *do not* support are not modelled), `signing` (place, date). Dates are ISO text.

## Phase 1 — Foundations: legal rules, model, clause library, document builder  *(this commit)*

**Goal:** a tested pure library that, given a will record, answers *can we make this will*, *what
is wrong with it*, and *what does it say* — with no UI.

Scope
- `law.ts`: scope verdict from religion/domicile/assets abroad → `ok | caution | out_of_scope`
  with reasons and statute citations.
- `model.ts`: the record, a defensive reader (never trusts storage or a backup), blanks.
- `checks.ts`: ~20 checks (testator is a minor; no name/address; no residue; residue ≠ 100%; a
  gift ≠ 100%; **witness is a beneficiary (s.67)**; fewer than two witnesses at signing; minor
  beneficiary and no guardian/trustee wording; executor missing or same as only witness; no
  alternate (lapse, s.105); an asset gifted to nobody (falls to residue — note); asset gifted twice
  over 100%; joint-held asset gifted in full; nominee on an asset that differs from the will (note);
  spouse/minor children not provided for (review); one-third rule for Muslim testators; etc.).
- `clauses.ts` + `document.ts`: our own clause wording (revocation, appointment of executor and
  substitute, family declaration, specific gifts by schedule, alternates, residue, guardian,
  funeral/digital/pets extras, signature, attestation) → a structured document.
- `fromWealth.ts`: map Wealth Tracker heads to will assets; carry nominee data; never expands a
  masked identifier.
- Tests for each of the above, including a full worked example whose text is snapshot-read.

Exit: `npm run check` green; no route, no nav change, nothing user-visible; pushed.

## Phase 2 — The guided interview (UI) and Wealth Tracker import  *(built; see notes)*

Scope
- Route group `(will)`, `/will-maker`; entry screen that states scope and refuses early (Muslim /
  Goa / trust cases) with the specific reason.
- Wizard (8 short steps, phone-first, each saved as you go): you → family → what you own (import
  from Wealth Tracker with one tap, or type) → who gets what (asset-by-asset, then *everything
  else*) → if someone dies before you (alternates) → executor, guardian → extras → review.
- Live **Readiness** panel from `checks.ts` with the fix one tap away; live **preview** of the will.
- `store.ts`: localStorage per user (`tfi:will:v1:<userId|guest>`), passcode encryption via
  `wealth/lock.ts`, backup/restore JSON, account mirror through `cloud/sync.ts` (add `will` key).
- Register everywhere the way Wealth Tracker was: `AGENTS` roster, `OPEN_TOOLS`, nav, hub card
  (counts only), `/tools/will-maker`, sitemap/robots/`llms.txt`, Ask corpus, analytics event names
  (counts, never content).
- **Behind a flag** (`NEXT_PUBLIC_WILL_MAKER=1` + admins) until Phase 5 sign-off.

**As built, two deliberate differences from the above:** (1) no account mirror (`cloud/sync.ts`): the draft stays in the browser, with a backup file and optional passcode, and an encrypted account copy moves to Phase 4 because it needs a migration and a privacy decision of its own; (2) it is not registered on the roster, hub, sitemap, assistant or analytics at all while flagged, because registering a tool the public cannot open would advertise it. Registration is a Phase 5 task.

Exit: a tester can go from nothing (or from a Wealth Tracker record) to a clean review in under
10 minutes at 375px and desktop, light and dark; checks all reachable by keyboard; tests for the
store and the import.

## Phase 3 — The document: PDF, Word, signing pack

Scope
- PDF via `@react-pdf/renderer` in the house style: numbered clauses, schedule of assets, page
  numbers "Page x of y" and a footer line on every page (a missing page is how wills are
  challenged), initials line, signature block, two-witness attestation block.
- DOCX export (add `docx`) so an advocate can edit; same `WillDocument` feeds both, so they cannot
  drift. Round-trip test: read back PDF text (pdf.js) and DOCX (zip) and compare to `plainText()`.
- **Signing pack** (page 1 of the PDF, not part of the will): how to sign (wet ink; why not
  e-sign; two witnesses, not beneficiaries, ideally younger and not family), each page initialled,
  stamp paper not needed, optional registration (where and roughly what), where to keep the
  original, who to tell.
- "Sample will" with invented, labelled names for the public page and the brag assets.
- Watermark "DRAFT — not signed" on every preview; removed only in the final export after the
  person confirms the readiness panel and ticks the declarations.

Exit: exports read back and match; the sample renders at A4; fonts print ₹ and Devanagari names.

## Phase 4 — Keep it alive: safekeeping, reminders, assisted services

Scope
- **Will register** (not the will): where the signed original is kept, who knows, executor
  contact, date signed, date to review. Writes back to Wealth Tracker's `profile.will` /
  `willKept` / `executor` so the household record stays true.
- **Review reminders & life-event prompts** (marriage, child, property bought, loan closed):
  derived from the Wealth Tracker record on open; email only if the person opts in.
- **Nominee-vs-will check** across the combined record (insurance and bank nominees that
  contradict the will's gifts) — the feature WillJini cannot do.
- **Assisted layer** (the revenue line, decided with the owner): advocate review of a draft,
  registration booking, door-step signing. Start as a *request form into the existing Admin
  inbox* with partner advocates, no payments code. Razorpay checkout only after the owner picks
  a model (see decisions).
- Account-side only stores ciphertext + metadata; admin screens show counts, never content.

Exit: a signed will can be "registered" in the tool, the Wealth Tracker reflects it, a reminder
fires, an assisted request reaches the Admin screen.

## Phase 5 — Legal sign-off, launch and growth

Scope
- **Advocate review** of `clauses.ts`, `law.ts`, the scope refusals and every user-facing legal
  sentence; their comments recorded in `docs/will-maker/legal-review.md`; rules changed with tests.
- Terms/privacy sections for the will tool; DPDP review (consent, purpose, deletion, breach path);
  security pass (no will content in logs, analytics, errors, URLs; CSP; rate limits on any server
  endpoint); accessibility pass (screen reader through the wizard); phone/desktop/light/dark audit
  per HANDOFF §16.
- Content: 6–8 short, accurate explainers (will vs nominee, who can witness, registration by city,
  what happens without a will) in the existing marketing system; JSON-LD; `llms.txt`.
- Launch: remove the flag; Instagram/LinkedIn assets via the `/brag` workflow (reel + stills, as
  for the other two tools); Admin screen cards for funnel counts.
- Later (not in this plan's scope): mirror/joint wills, codicils, living will & POA, NRI flows,
  Hindi/regional-language output, family-trust referral, bulk/partner (CA firm) mode.

Exit: written advocate approval; flag off; production smoke test; owner sign-off.

## Decisions I need from the owner (defaults in bold; Phase 1 does not depend on them)

1. **Price:** **free draft + paid assisted layer** vs. a flat fee for the final export (market:
   ₹499–₹7,499).
2. **Legal reviewer:** who is the advocate (in-house, partner firm)? Needed before Phase 5.
3. **Muslim testators:** **out of scope with explanation** (as WillJini) vs. build the one-third
   logic with a mandatory advocate hand-off.
4. **Language:** **English only first**; Hindi output later.
5. **Name:** "Will Maker" vs. something on-brand.
6. **Entity & liability wording:** terms need the registered entity's name and a limitation-of-
   liability clause drafted by counsel.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Wrong clause = void gift / dispute | Fixed library, citations in code, tests, advocate sign-off, scope refusals |
| Over-claiming | Copy rules from HANDOFF §1; "drafting aid, not legal advice" on every screen and in the PDF |
| Sensitive data | Browser-first, ciphertext sync, no content in logs/analytics, delete-everything button |
| Law changes (e.g. s.213 probate item) | Rules in one file with dates; `law.ts` has a "last reviewed" constant shown in the product |
| Scope creep into trusts, POA, probate | Explicit non-goals; the assisted layer handles them |
