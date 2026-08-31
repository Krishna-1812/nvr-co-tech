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

const LAST_UPDATED = '22 August 2026';

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
 * source: one script on our own origin, no third-party request from a public
 * page at all, Do Not Track honoured by refusing to record rather than by
 * recording less, one first-party cookie, and reconciliation ledgers that are
 * opened and matched inside the page. A policy on a site whose entire pitch is
 * specificity cannot be the one part of it written in the passive voice.
 *
 * Nothing here overstates. The company lookup clause says what may be sent when
 * that lookup is switched on, rather than claiming no third party is ever
 * involved, because the honest version has to survive somebody setting the key.
 */
const CLAUSES: Clause[] = [
  {
    title: 'What we collect',
    body: [
      'What you give us, which is your name and email when you create an account, anything you write to us, and the records your organisation creates while using the platform.',
      'What your browser reports when you read a public page, which is the page itself, roughly how long you spent on it, how far down it you got, the page that sent you, the width of your screen, and coarse device and browser names read from the request. None of it is combined with anything bought from anywhere.',
      'The network address the request arrived from. It is what we use to work out roughly where in the world a visit came from, and sometimes which company it belongs to.',
    ],
  },
  {
    title: 'The measurement is our own',
    body: [
      'There is no Google Analytics on this site. No advertising or social pixel, no session recorder, no heatmap tool, no consent vendor, no tag manager. One script, served from this domain, writing to a database we run in Mumbai.',
      'The typefaces are served from here too, so reading a public page on this site makes no request to any other company at all. The whole of the client side is one file you can read for yourself at /a.js.',
    ],
  },
  {
    title: 'Do Not Track and Global Privacy Control',
    body: 'If your browser sends either signal, nothing is recorded. Not a reduced set with the identifier removed. Nothing, no cookie and no request. In the regions that expect to be asked, we ask before recording anything, and declining is remembered so you are not asked again.',
  },
  {
    title: 'Cookies',
    body: 'On the public site there is one, first-party, holding a random identifier so that repeat visits from the same browser are counted as one visitor rather than several. Signing in sets the cookies the session itself needs. That is the whole list. There is nothing here belonging to anybody else.',
  },
  {
    title: 'Files you reconcile never leave your browser',
    body: [
      'The two ledgers you compare in Ledger Reconciliation are opened, read and matched inside the page. They are not uploaded, not sent to a model, and never touch a server of ours.',
      'What gets saved is the statement you produced from them, kept in a history that only the account which created it can open. Not your administrator, and not us.',
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
      'Where a company lookup is switched on, the thing sent to the lookup service is the network address or the email domain. Nothing you have typed into a voucher, a reconciliation or a message ever forms part of one.',
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
    >
      <div className="m-card p-6 sm:p-7">
        <h2 className="m-eyebrow">Asking us something</h2>
        <p className="m-dim mt-4 text-[14px] leading-relaxed">
          A question about this policy, or a request about your own information, goes to a person and
          not to a queue.
        </p>
        <a
          href={`mailto:${CONTACT.email}`}
          className="m-mono mt-5 inline-block text-[13px] text-[var(--m-cyan)] underline underline-offset-4 transition hover:text-[var(--m-ink)]"
        >
          {CONTACT.email}
        </a>
      </div>
    </LegalPage>
  );
}
