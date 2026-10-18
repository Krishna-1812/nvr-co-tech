import type { Metadata } from 'next';
import { BRAND, CONTACT } from '@/lib/marketing/content';
import { LegalPage, type Clause } from '@/components/marketing/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy',
  description: `How ${BRAND.name} handles information: our own measurement, no third-party pixel of any kind, and reconciliation files that never leave your browser.`,
  alternates: { canonical: '/privacy' },
};

const TRAIL = [
  { label: 'Home', href: '/' },
  { label: 'Privacy', href: '/privacy' },
] as const;

const LAST_UPDATED = '18 October 2026';

/**
 * Written for somebody who checks.
 *
 * The previous version was the policy any product could have published: trusted
 * service providers, reasonable technical steps, information used to improve the
 * service. All true, none of it worth reading, and it left out every fact about
 * this site that a privacy-minded reader would actually have wanted, while
 * breaking the no-em-dash house rule four times in the process.
 *
 * What went in instead is only what can be checked from the outside or from the
 * source: our own measurement on our own origin (components/Tracker since 18
 * Oct 2026, which records more than the old tracker did, and the clauses say
 * exactly what), no third-party request from a public page at all, Do Not
 * Track honoured by refusing to record, one first-party cookie, and
 * reconciliation ledgers that are opened and matched inside the page. A policy
 * on a site whose entire pitch is specificity cannot be the one part of it
 * written in the passive voice.
 */
const CLAUSES: Clause[] = [
  {
    title: 'What we collect',
    body: [
      'What you give us, which is your name and email when you create an account, anything you write to us, and the records your organisation creates while using the platform.',
      'What your browser reports on every page of the site and the workspace: the page, how long it was open in front of you, the page that sent you and any campaign tags on the link, your screen size, language and time zone, and the browser, system and kind of device named in the request. None of it is combined with anything bought from anywhere.',
      'The network address the request arrived from, and the country, region and city our host works out from it.',
      'A random visitor ID, kept in a cookie, so that coming back is recognised as the same visitor. If you sign in, your earlier visits from that browser are joined to your account, so we can see one person rather than several. Your account records when you joined and last signed in, and how.',
    ],
  },
  {
    title: 'The measurement is our own',
    body: [
      'There is no Google Analytics on this site. No advertising or social pixel, no session recorder, no heatmap tool, no consent vendor, no tag manager. One script, served from this domain, writing to a database we run in Mumbai.',
      'The typefaces are served from here too, so reading a public page on this site makes no request to any other company at all.',
    ],
  },
  {
    title: 'Do Not Track and Global Privacy Control',
    body: 'If your browser sends either signal, none of the measurement above runs: no visitor cookie and no request.',
  },
  {
    title: 'Cookies',
    body: 'One of ours, first-party, holding a random visitor identifier for a year from your last visit, so that repeat visits from the same browser are counted as one visitor rather than several. Signing in sets the cookies the session itself needs. That is the whole list. There is nothing here belonging to anybody else.',
  },
  {
    title: 'Files you reconcile never leave your browser',
    body: [
      'The two ledgers you compare in Ledger Reconciliation are opened, read and matched inside the page. They are not uploaded, not sent to a model, and never touch a server of ours.',
      'What gets saved is the statement you produced from them, kept in a history that only the account which created it can open. Not your administrator, and not us.',
    ],
  },
  {
    title: 'True Property Cost and Wealth Tracker: your browser, and your account if you sign in',
    body: [
      'Both tools work everything out inside your own browser, and both can be used without an account. Used that way, what you type — payment schedules, assets, liabilities, account numbers, nominees — is saved only in that browser and is never sent to a server of ours. Clearing the browser deletes it, and we cannot recover it, because we never had it.',
      'If you sign in, a copy is also saved to your account so it is not lost with the browser and is there on your other devices. Only your account can read it: not an administrator, and not us. If you set a passcode in Wealth Tracker, the copy saved is encrypted in your browser with that passcode first, so what reaches us cannot be read by anybody without it.',
    ],
  },
  {
    title: 'How we use it',
    body: 'To run the platform, to keep accounts and records secure, to answer you when you write to us, and to understand which parts of the product are used so we know what to build next. We do not use it to advertise to you, here or anywhere else.',
  },
  {
    title: 'Who else sees it',
    body: [
      'The companies that host the application and its database, which process it on our instructions and for nothing else. We do not sell personal information, to anybody, for any reason.',
      'Inside the firm, only the platform\'s administrators can see the visit records, and they see them on one screen.',
    ],
  },
  {
    title: 'How long we keep it',
    body: 'Account and organisation records stay for as long as the account does. Analytics rows are kept while they are still telling us something and are not kept indefinitely. Anything we are required to retain for legal or accounting reasons is kept for as long as that requires and no longer.',
  },
  {
    title: 'What you can ask for',
    body: 'You can ask what we hold about you, ask us to correct it, or ask us to delete anything we are not required to keep. You can clear the analytics cookie from the notice on any public page, or from your browser, at any time.',
  },
  {
    title: 'Security',
    body: 'Who can read and change what is decided by the database rather than by the screens, which is the part of this that is worth saying: a rule held there holds whether the request comes from this website, from a script, or from anywhere else. Access is limited to the people who need it to run the service.',
  },
  {
    title: 'Changes to this policy',
    body: 'We may update it as the product changes. The date at the top always reflects the current version.',
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="How we handle information."
      lead="What we collect, what we deliberately do not, and how to reach us about any of it. Everything below can be checked from the outside."
      updated={LAST_UPDATED}
      clauses={CLAUSES}
      trail={TRAIL}
      related={{ href: '/terms', label: 'the terms that apply to using the platform' }}
      accent="var(--m-cyan)"
      motif="ledger"
    >
      <div className="m-card p-6 sm:p-7">
        <h2 className="m-eyebrow">Asking us something</h2>
        <p className="m-dim mt-4 t-3">
          A question about this policy, or a request about your own information, goes to a person and
          not to a queue.
        </p>
        <a
          href={`mailto:${CONTACT.email}`}
          className="m-mono mt-5 inline-block t-3 text-[var(--m-cyan)] underline underline-offset-4 transition hover:text-[var(--m-ink)]"
        >
          {CONTACT.email}
        </a>
      </div>
    </LegalPage>
  );
}
