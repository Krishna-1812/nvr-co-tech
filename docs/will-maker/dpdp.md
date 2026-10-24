# Will Maker: data held, and what to tell people

Prepared 24 Oct 2026 from the code, for counsel to confirm. This is a description
of what the software does, not legal advice. Anything about what the law requires
is marked **Counsel** and has not been checked by one. The Digital Personal Data
Protection Act, 2023 and its Rules apply to this site; which provisions are in
force on the launch date is for counsel to say.

Every statement under "What is held" is enforced by a test, so it stays true
until a test is deliberately changed (`src/lib/will/privacy.test.ts`,
`src/lib/analytics/private-paths.test.ts`, `src/lib/cloud/guard.test.ts`).

## What is held, and where

| What | Where | Readable by us? | How long | How it is removed |
| --- | --- | --- | --- | --- |
| The draft: people, assets, gifts, clauses, signing record | The person's own browser (`localStorage`, key `tfi:will:v1:<user>`) | No. It never reaches our servers | Until the person clears it | "Delete this draft" in *Where it is kept* (also removes the account copy); clearing browser data |
| Backup file | Wherever the person saves it | No | Their choice | They delete the file |
| Account copy (signed-in people, only if they set a passcode) | Table `tool_saves`, row `(user_id, 'will-maker')`, `body` | **No.** Ciphertext only: AES-GCM, key from PBKDF2 of a passcode we never receive. A forgotten passcode cannot be recovered by us | Until the person removes it, or deletes their account | "Delete this draft" or "Remove the passcode" in *Where it is kept* (both remove the account copy); account deletion cascades (`user_id ... on delete cascade`) |
| Help request (only if the person sends one) | `access_requests`, plus an email to the team mailbox where email is configured | Yes. It is what the person typed | **Counsel**: set a period | By request, in writing (see Rights) |
| Visit details | Site analytics: page view (path `/will-maker`, page title, referrer, device, language, timezone, approximate location, IP) and time on page | Yes | As for the rest of the site | As for the rest of the site |

Nothing else. In particular:

- **No will text, name, address, asset or beneficiary reaches analytics.** The
  site-wide tracker records form fields and button clicks; it is switched off for
  `/will-maker` in the browser (`capture.ts`) and again on the server (`input.ts`),
  and the workbench is marked `data-private`. A browser audit on 24 Oct 2026
  drove the whole flow (interview, every tab, PDF and Word download, help
  request) against the example will with a unique marker typed into the fields:
  61 requests, none to another origin, no request body or URL carrying any name,
  address, relative or the marker. The only analytics calls were the page view
  and the time-on-page ping.
- **No third party.** No external script, font, analytics or AI service is
  loaded or called from the Will Maker route. The text of a will is composed
  from a fixed clause library; there is no language model in it.
- **No readable will in the account.** Enforced three times: the browser
  refuses to upload anything not sealed (`accept`), the server action refuses
  it (`acceptsBody`), and the database refuses it (`tool_saves_will_is_sealed`).
- **No will in logs, errors or URLs.** The will code does not call a logger or
  `console`, and reads no query string or cookie (static scan, `privacy.test.ts`).
- **Not indexed.** `/will-maker` is `noindex` and disallowed in `robots.txt`.

## The one thing that does leave: the help request

The *Ask for help* form sends what the person types (name, email, city, phone,
note, what they need) and the usual details of a visit (IP address, the page
they came from, the site's visitor cookie id). It says so on the form. It never
attaches or summarises the will; the note field tells people not to paste one.

## Notice and consent (for the public launch)

**Counsel** to confirm wording and whether a separate consent is needed.

- The workbench header already says where the draft is kept ("Kept only in this
  browser" / "encrypted in your account once locked"), and *Where it is kept*
  explains the passcode and the account copy. It should also link to the site
  privacy page.
- The site privacy page (`src/app/(marketing)/privacy/page.tsx`) is general. At
  launch it needs a section for Will Maker saying the above in plain words. It is
  deliberately not added yet, because it would describe a tool that is not
  public. The text is in the launch runbook.
- The help request is the only place the person gives us personal data on
  purpose. The form states the purpose (we write back about advocate help). A
  consent line and the retention period belong here.
- Beneficiaries, witnesses and executors are named by the person in their own
  browser. We never receive those names. If that ever changes (for example an
  advocate review service that reads the will), notice to those people becomes
  a question for counsel.

## Rights and contact

The site privacy page tells people to write to us to see, correct or delete
their information. For Will Maker, practically:

- Browser draft and backups: the person deletes them; we cannot see them.
- Account copy: the person removes it themselves (delete the draft, or remove
  the passcode), or we delete the
  `tool_saves` row on request. Because it is ciphertext, we can delete it
  but cannot read or correct it.
- Help request: we can find it by email in the Admin screen's access requests
  and delete it.
- Visit analytics: as for the rest of the site.

## If something goes wrong

- *A bug sends will text somewhere.* The guard tests exist to make this fail
  the build. If it is found in production, turn the tool off by removing
  `NEXT_PUBLIC_WILL_MAKER` (the page then returns not found for everyone but
  admins), then find what was captured: analytics rows for path `/will-maker`
  (there should be none beyond the page view and time).
- *The account table is exposed.* Rows are ciphertext. The key is derived from
  a passcode that is not stored anywhere, so an exposed row alone does not
  reveal a will. **Counsel**: whether this still counts as a personal-data
  breach to be notified, and to whom.
- *A person says their advocate request was seen by the wrong people.* It is in
  `access_requests` (admin only) and the team mailbox only.

## Things this does not cover

- Whether the draft stays "kept only in this browser" if the person's own
  device is shared or compromised. The passcode option and the wording in
  *Where it is kept* are the mitigation.
- Registration of the will, or anything a reviewing advocate does later with a
  will they are shown. That is a separate service and needs its own notice.
