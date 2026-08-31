import type { Metadata } from 'next';
import { BRAND, CONTACT } from '@/lib/marketing/content';
import { LegalPage, type Clause } from '@/components/marketing/LegalPage';

export const metadata: Metadata = {
  title: 'Terms',
  description: `The terms that apply to using ${BRAND.name}.`,
  alternates: { canonical: '/terms' },
};

const TRAIL = [
  { label: 'Home', href: '/' },
  { label: 'Terms', href: '/terms' },
] as const;

const LAST_UPDATED = '22 August 2026';

/**
 * The clause this page was missing.
 *
 * "Not professional advice" was not here, on a product that works out how GST
 * splits, deducts TDS, and produces a reconciliation statement somebody signs.
 * It is also the one clause that agrees with the rest of the site rather than
 * contradicting it: the About page argues at length that knowing where the rules
 * stop is the whole product, and then the terms did not say what happens on the
 * other side of that line.
 *
 * Governing law and jurisdiction are still absent, deliberately. That is a
 * decision for the people whose company it is, not a sentence to be inferred
 * from a hosting region, and a wrong one is worse than a missing one.
 */
const CLAUSES: Clause[] = [
  {
    title: 'Agreement to these terms',
    body: 'By creating an account or otherwise using the platform, you agree to these terms. If you are using it on behalf of an organisation, you are confirming you have the authority to agree on its behalf, and "you" refers to that organisation as well as to you personally.',
  },
  {
    title: 'Using the platform',
    body: 'You may use the platform only for its intended purpose and only in ways that are lawful. You are responsible for what happens under your account, so keep your credentials to yourself and let us know if you think somebody else has access to them.',
  },
  {
    title: 'Your account and your organisation',
    body: [
      'You need an account to use most of the platform, and the information you give us to create one should be accurate. Whoever sets an organisation up is its owner and decides who else is let in and what they may do.',
      'We may suspend or close an account that is used in a way that breaches these terms or puts the platform or other users at risk.',
    ],
  },
  {
    title: 'This is not professional advice',
    body: [
      'The platform applies rules. It works out how GST splits on the figures you enter, it holds your totals, it matches ledger lines and it tells you which ones did not match. None of that is an opinion on your tax position, and none of it is a substitute for the judgement of the person who signs the return.',
      'Which rule applies to a particular payment, whether a credit can be claimed, and what a reconciliation difference actually means are decisions that stay with you and your advisers. Rates and rules change, and where the platform states one it is stating the ordinary case rather than yours.',
    ],
  },
  {
    title: 'Your content and records',
    body: 'Anything you or your organisation enters into the platform remains yours. We do not claim ownership of it. We use it only to provide the service back to you, in the ways described in our privacy policy.',
  },
  {
    title: 'What is still being built',
    body: 'Some of what the site describes is on the roadmap rather than running, and every page that lists it says which is which. Nothing on a roadmap page is a commitment to a date, and the order can change. What you are agreeing to here is the use of what exists today.',
  },
  {
    title: 'Availability',
    body: 'We aim to keep the platform available and working as intended, but we do not promise it will be uninterrupted or error free. From time to time it may be unavailable for maintenance or for reasons outside our control.',
  },
  {
    title: 'No guarantees',
    body: 'The platform is provided as it stands, without guarantees beyond what is stated here or required by law. Where the law allows it, we are not liable for indirect or consequential loss arising from your use of the platform.',
  },
  {
    title: 'Ending your use',
    body: 'You may stop using the platform and close your account at any time. We may also end or suspend access where these terms have not been followed. Where it is reasonably possible, we will give notice first.',
  },
  {
    title: 'Changes to these terms',
    body: 'We may update these terms as the platform changes. The date at the top always reflects the current version, and continuing to use the platform after a change means you accept the update.',
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="The terms that apply."
      lead={`Ordinary terms for ordinary use of ${BRAND.name}, written to be read rather than to be got past.`}
      updated={LAST_UPDATED}
      clauses={CLAUSES}
      trail={TRAIL}
      related={{ href: '/privacy', label: 'how we handle information' }}
      accent="var(--m-violet)"
    >
      <div className="m-card p-6 sm:p-7">
        <h2 className="m-eyebrow">If something here is unclear</h2>
        <p className="m-dim mt-4 text-[14px] leading-relaxed">
          Write to us and say which clause. We would rather answer it now than have the conversation
          after it matters.
        </p>
        <a
          href={`mailto:${CONTACT.email}`}
          className="m-mono mt-5 inline-block text-[13px] text-[var(--m-violet)] underline underline-offset-4 transition hover:text-[var(--m-ink)]"
        >
          {CONTACT.email}
        </a>
      </div>
    </LegalPage>
  );
}
