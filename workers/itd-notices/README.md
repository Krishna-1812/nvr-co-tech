# Tax notice watch

Every morning this logs in to each client's account on the Income Tax e-Filing
portal, reads **Pending Actions → e-Proceedings** (both tabs), opens the
notices that are new or changed, downloads their files, and:

- saves everything to Supabase (migration `0037_itd_notices.sql`), where the
  Admin screen shows it at **/analytics/notices**;
- emails the client's addresses and the team when a notice is new, with the
  files attached;
- emails the team a short summary when anything is new, a response is due
  within 7 days, or an account could not be checked.

It never solves a CAPTCHA or an OTP and never retries a password. An account
that asks for one is reported ("Not checked") and left alone.

## The accounts sheet

A Google Sheet, first row headings (any order, any extra columns ignored):

| Heading | Needed | What |
|---|---|---|
| `PAN` (or `User ID`) | yes | the e-Filing login |
| `Password` | yes | |
| `Name` (or `Client`) | no | shown in emails and on the dashboard |
| `Notify` (or `Email`) | no | the client's alert addresses, comma separated |
| `Active` | no | `No` skips the row; blank means yes |

Share the sheet (Viewer) with the Google service account's email address.

## Settings (environment variables)

| Variable | Needed | What |
|---|---|---|
| `ITD_SHEET_ID` | yes | the long ID in the sheet's address |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | yes | a Google service account with read access to the sheet |
| `ITD_SHEET_RANGE` | no | default `A:Z` of the first tab; e.g. `Accounts!A:F` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | yes | where findings go (service-role key: keep it on the server only) |
| `NOTIFY_TO` | yes | the team's addresses for every alert and the summary |
| `RESEND_API_KEY` + `NOTIFY_FROM_EMAIL` | one of these two | email through Resend (domain verified there) |
| `SMTP_URL` + `NOTIFY_FROM_EMAIL` | | or any SMTP server, e.g. Gmail with an app password: `smtps://you%40gmail.com:APP-PASSWORD@smtp.gmail.com:465` |
| `SITE_URL` | no | for the dashboard link; default the live site |
| `ITD_PAUSE_SECONDS` | no | pause between accounts, default 20 |
| `ITD_MAX_OPEN` | no | most notices opened per tab per account in one run, default 25 |

Without Supabase settings it writes to `itd-state/state.json` instead; without
email settings it still runs and the dashboard still fills.

## Running it

```
npm ci
npx playwright install --with-deps chromium   # not needed in the Docker image
node src/run.mjs                    # the morning run
node src/run.mjs --only ABCDE1234F  # one account, to try a new row
node src/run.mjs --dry              # no email, local JSON store
```

The run exits 0 even when some accounts could not be checked (that is news
for the email, not a crash), and 1 only when it could not run at all.

### On Railway (cron)

The `Dockerfile` here is the service. In the service's settings: root
directory `workers/itd-notices`, region **Singapore**, the variables above,
**Cron Schedule** `45 0 * * *` (06:15 in India; Railway's schedule is UTC),
and restart policy **Never**.

### On a server in India (e.g. Oracle Cloud, Mumbai)

```
git clone <repo> && cd <repo>/workers/itd-notices
docker build -t itd-notices .
# put the variables in .env (one NAME=value per line), then:
crontab -e
45 6 * * * cd $HOME/<repo>/workers/itd-notices && docker run --rm --env-file .env itd-notices >> run.log 2>&1
```

(Set the server's time zone to Asia/Kolkata, or write the cron time in UTC.)

## Tests

```
npm test                                   # parsing, change detection, the sheet
ITD_CHROMIUM_PATH=... node test/e2e.mjs    # three mornings against a stand-in portal
```

The stand-in (`test/mock-portal`) is built from screenshots of the real
portal taken on 20 Oct 2026: the two-step login with the secure access
message, "logged in elsewhere", both e-Proceedings tabs, the proceeding cards
and "View Notices/Orders". The notices view itself was not in those
screenshots, so the first runs against the real portal are where its layout
gets confirmed (the page text is saved with every proceeding, and the file
download looks for any PDF or download link, so nothing is lost if it differs).
