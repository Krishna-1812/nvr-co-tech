import type { Metadata } from 'next';
import { pageMeta } from '@/lib/marketing/seo';
import { BRAND, CONTACT } from '@/lib/marketing/content';
import { LegalPage, type Clause } from '@/components/marketing/LegalPage';
import { willMakerPublic } from '@/lib/will/flag';

export const metadata: Metadata = pageMeta({
  title: 'Privacy',
  description: `How ${BRAND.name} collects, uses and protects information.`,
  path: '/privacy',
});

const TRAIL = [
  { label: 'Home', href: '/' },
  { label: 'Privacy', href: '/privacy' },
] as const;

const LAST_UPDATED = '20 October 2026';

/**
 * Rewritten on 20 Oct 2026 at the owner's request, broad rather than specific.
 * Broad is not the same as untrue: every sentence still has to hold for what
 * the site does today (components/Tracker, migrations 0032 and 0033, the
 * access request form, the session cookies), and the hedged ones ("may") are
 * there because the detail varies by tool and changes as tools are added, not
 * to cover something the site does not admit to.
 */
const CLAUSES: Clause[] = [
  {
    title: 'Information you give us',
    body: 'When you sign in, request access, write to us or otherwise share details with us, we receive what you provide, such as your name, email address, organisation and message.',
  },
  {
    title: 'Information collected automatically',
    body: 'When you use the website we record how it is used: for example the pages you open, how long you spend on them, how you arrived, and technical details such as your device, browser, approximate location and IP address. If you sign in, this may be linked to your account.',
  },
  {
    title: 'Information you enter into the tools',
    body: 'Depending on the tool, what you enter may be kept in your own browser, saved to your account when you are signed in, or processed on our servers to produce a result. Some tools work entirely within your browser.',
  },
  // Only once Will Maker is public: this page should not describe a tool that is not there.
  ...(willMakerPublic()
    ? [
        {
          title: 'Will Maker',
          body: 'Will Maker writes your will in your browser and keeps it there. It is not sent to us, and what you type or click in it is not recorded in our usage statistics (we do count that the page was opened). If you sign in and lock your will with a passcode, an encrypted copy is saved to your account that we cannot read, and we cannot recover a forgotten passcode. If you ask for an advocate’s help, we receive what you type in that request and the usual details of a visit, and nothing from your will.',
        },
      ]
    : []),
  {
    title: 'Cookies',
    body: 'We use cookies and similar storage to keep you signed in, remember your preferences and recognise returning visitors. You can clear or block cookies in your browser settings, though some features may not work without them.',
  },
  {
    title: 'How we use information',
    body: 'We use information to provide and run the website, to respond to you, to keep the website secure, to understand how it is used, and to improve it.',
  },
  {
    title: 'Sharing',
    body: 'We do not sell your personal information. We may share it with service providers who help us run the website, such as hosting and email providers, only as needed for them to do so, or where we are required to by law.',
  },
  {
    title: 'Storage and security',
    body: 'We take reasonable steps to protect the information we hold and to limit who can access it. No method of storing or sending information over the internet is completely secure, so we cannot guarantee absolute security.',
  },
  {
    title: 'Retention',
    body: 'We keep information for as long as it is needed for the purposes above, or as the law requires, and then delete it or keep it in a form that no longer identifies you.',
  },
  {
    title: 'Your choices',
    body: 'You can ask us what information we hold about you, and ask us to correct or delete it, by writing to us at the address below. If your browser sends a Do Not Track or Global Privacy Control signal, we do not record your visits.',
  },
  {
    title: 'Other websites',
    body: 'Links to other websites are provided for convenience. Their own privacy practices apply, and we are not responsible for them.',
  },
  {
    title: 'Changes to this policy',
    body: 'We may update this policy from time to time. The date at the top shows the current version, and continuing to use the website after a change means you accept it.',
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy policy."
      lead={`What information we collect when you use ${BRAND.name}, and how we use and protect it.`}
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
