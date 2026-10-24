# Will Maker: launch runbook

Everything that can be built is built. What is left is people's decisions and
five owner actions. Do them in this order. Until step 5 the tool is visible to
platform admins only and appears nowhere on the public site.

## 0. What the build already guarantees

- **Public needs two things, both.** `willMakerPublic()` (`src/lib/will/flag.ts`)
  is true only when `LAW.advocateSignOff` is filled in **and**
  `NEXT_PUBLIC_WILL_MAKER=1`. The flag alone changes nothing. Tested in
  `flag.test.ts` and `launch.test.ts`.
- **Before that there is no trace.** The roster (`AGENTS`), `OPEN_TOOLS`, the hub,
  `/tools`, the sitemap, `llms.txt`, the assistant's knowledge and the privacy
  page's Will Maker clause are all derived from `willMakerPublic()`. Nothing to
  remember to switch on, and nothing to hide.
- **A sign-off cannot go stale.** It records the digest of the reviewed files
  (`REVIEWED_FILES` in `review.ts`: `law`, `checks`, `clauses`, `document`,
  `guide`, `faq`, `register`). The build fails if any of them changes after the
  sign-off, until a new packet is reviewed.
- **No will content leaves the browser** (`privacy.test.ts`,
  `private-paths.test.ts`, `lib/cloud/guard.test.ts`); see `dpdp.md` for the
  browser audit.

## 1. Choose the reviewing advocate  *(owner; blocks everything below)*

Someone enrolled with a State Bar Council who does wills and succession for
Hindu, Christian, Parsi, Sikh, Jain and Buddhist families. Give them
`docs/will-maker/legal-review.md` (generated; answers §3's questions and signs §11)
and `terms-draft.md`, `dpdp.md` for counsel. The packet has the digest at the top.
Their corrections come back as edits to the code; then regenerate:

```
npm run will:packet      # rewrites docs/will-maker/legal-review.md and its digest
npm run check            # fails if the packet or a recorded sign-off is stale
```

Re-send the new packet whenever a reviewed file changed. The sign-off must name the
final digest.

## 2. Record the sign-off  *(owner, after the advocate signs)*

Edit **only** `src/lib/will/signoff.ts` (it is outside the digest on purpose):

```ts
export const SIGN_OFF: SignOff | null = {
  by: 'Name, Enrolment no., Bar Council, Firm',
  on: '2026-12-01',            // the date of their written sign-off
  packet: '<the digest printed at the top of legal-review.md>',
};
```

`review.test.ts` fails if `packet` is not the current digest. The workbench chip
then reads "Rules reviewed by …" instead of "In testing: not yet reviewed by an advocate".

## 3. Counsel's other documents  *(owner + counsel)*

- `terms-draft.md`: fill the bracketed decisions (liability, governing law, fee,
  how often the rules are re-checked) and publish as part of `/terms`, linked from
  the tool header and the download step.
- `dpdp.md`: confirm the **Counsel** items (retention period for help requests,
  consent wording, whether ciphertext in the account counts as personal data for
  breach purposes). Set the retention period and, if wanted, a consent line on
  the help form.
- Update `LAST_UPDATED` in `src/app/(marketing)/privacy/page.tsx`; the Will Maker
  clause appears by itself at launch.

## 4. Apply migration 0038  *(owner pastes it in the Supabase SQL editor)*

`supabase/migrations/0038_will_maker_saves.sql` adds `will-maker` to
`tool_saves` and the constraint `tool_saves_will_is_sealed`. Until it is applied
the status line reads "not switched on yet" and drafts stay in the browser only,
which is safe. Check with a signed-in test account: lock a draft with a passcode,
clear site data, sign in again, enter the passcode, the draft returns.
Also verify the real help-request insert once: send one from the After signing tab
and see it under Admin, Access requests (preview mode cannot test this).

## 5. Switch it on  *(owner; the launch decision)*

1. Railway: set `NEXT_PUBLIC_WILL_MAKER=1` and redeploy (it is inlined at build
   time, so a restart is not enough).
2. Smoke test on production, signed out and in a private window:
   `/tools/will-maker` (FAQ, "Open Will Maker"), `/will-maker` opens without an
   account, `/tools`, the hub card, `/sitemap.xml` lists `/tools/will-maker` and not
   `/will-maker`, `/llms.txt`, `/privacy` has the Will Maker clause.
3. Download the PDF and Word file from the example will; open the Word file in real
   Word (not yet done) and print the PDF once on paper.
4. Rollback is removing the variable and redeploying: everything above disappears
   together.

## 6. Growth  *(after launch; not built)*

- Instagram and LinkedIn assets: use the `/brag` workflow for a reel and stills,
  as for True Property Cost and Wealth Tracker. Copy must keep to what the FAQ
  says: no "legally valid in minutes", no "lawyer-made", no price claims.
- Admin screen: funnel counts for Will Maker would need an event that carries no
  will content (for example "export downloaded", with nothing else). The tool is
  excluded from capture on purpose, so adding one is a decision, not a toggle.
- Reminders by email, Hindi and other languages, codicils, mirror and joint wills,
  living will and power of attorney, NRI flows, a family-trust referral and a
  partner mode for CA firms are all out of scope of this build.

## Open decisions still with the owner

- The reviewing advocate (step 1).
- Pricing: the draft is free; an assisted layer (review, registration help,
  drafting) is a request form only today.
- Muslim testators are out of scope (the tool turns them away); English only; the
  name "Will Maker".
