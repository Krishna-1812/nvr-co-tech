import type { Metadata } from 'next';
import { pageMeta } from '@/lib/marketing/seo';
import { BRAND, CONTACT } from '@/lib/marketing/content';
import { LegalPage, type Clause } from '@/components/marketing/LegalPage';

export const metadata: Metadata = pageMeta({
  title: 'Terms',
  description: `The terms that apply to using ${BRAND.name} and its tools.`,
  path: '/terms',
});

const TRAIL = [
  { label: 'Home', href: '/' },
  { label: 'Terms', href: '/terms' },
] as const;

const LAST_UPDATED = '20 October 2026';

/**
 * Rewritten on 20 Oct 2026 at the owner's request, broad rather than specific,
 * after the pattern of the terms on free calculator sites: general information
 * only, results that are estimates, no advice, no warranty, and the usual
 * limits. Specific promises about how a tool works belong on that tool's page,
 * where they can be kept accurate; here they would only date.
 *
 * Governing law and jurisdiction are still not named. That is a decision for
 * the people whose company it is, not a sentence to be inferred.
 */
const CLAUSES: Clause[] = [
  {
    title: 'Acceptance of these terms',
    body: `By visiting or using ${BRAND.name}, including any of its tools, you agree to these terms. If you do not agree with them, please do not use the website. If you use it on behalf of an organisation, you confirm you are able to accept these terms for it.`,
  },
  {
    title: 'General information only',
    body: 'The content and tools on this website are provided for general information and convenience. They are not intended to be, and should not be taken as, financial, tax, legal, accounting or investment advice. You should consult a qualified professional before acting on anything you read or work out here.',
  },
  {
    title: 'Results are estimates',
    body: [
      'Calculations, summaries, matches and figures produced by the tools depend on the information you enter and on assumptions that may not fit your circumstances. They are indicative and may differ from the actual position.',
      'Rules, rates and practices change from time to time, and we do not guarantee that the website reflects the latest position. Please verify anything important independently before relying on it.',
    ],
  },
  {
    title: 'Using the website',
    body: 'You agree to use the website lawfully and only for its intended purpose, and not to interfere with its working, attempt to gain access to parts of it you are not permitted to use, or use it in a way that could harm us or anybody else. Some tools are available only to people we have given access to.',
  },
  {
    title: 'Accounts',
    body: 'Some features may need you to sign in. You are responsible for keeping your sign-in details private and for what happens under your account. We may suspend or close access where we reasonably believe these terms have not been followed.',
  },
  {
    title: 'Your information and content',
    body: `Anything you enter remains yours. How information is collected and used is described in our privacy policy, which forms part of these terms.`,
  },
  {
    title: 'Intellectual property',
    body: `The website, its design, text, graphics, tools and code belong to ${BRAND.name} or its licensors. You may use them for your own purposes, but you may not copy, reproduce, resell or redistribute them without our written permission.`,
  },
  {
    title: 'Links to other websites',
    body: 'The website may link to websites run by other people. We do not control them and are not responsible for their content, availability or practices. A link is not an endorsement.',
  },
  {
    title: 'No warranty',
    body: 'The website and its tools are provided "as is" and "as available". We try to keep them accurate and working, but we make no promise that they will be error free, complete, current or uninterrupted, and we may change or withdraw any part of them at any time without notice.',
  },
  {
    title: 'Limitation of liability',
    body: `To the extent the law allows, ${BRAND.name} and the people behind it are not liable for any loss or damage, direct or indirect, arising from your use of the website, its tools, or reliance on anything shown on it. Your use of the website is at your own risk.`,
  },
  {
    title: 'Indemnity',
    body: 'You agree to hold us harmless from claims arising out of your misuse of the website or your breach of these terms.',
  },
  {
    title: 'Changes to these terms',
    body: 'We may revise these terms at any time by updating this page. The date at the top shows the current version, and continuing to use the website after a change means you accept it.',
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms of use."
      lead={`The terms that apply when you visit ${BRAND.name} or use any of its tools.`}
      updated={LAST_UPDATED}
      clauses={CLAUSES}
      trail={TRAIL}
      related={{ href: '/privacy', label: 'how we handle information' }}
      accent="var(--m-violet)"
      motif="scales"
    >
      <div className="m-card p-6 sm:p-7">
        <h2 className="m-eyebrow">If something here is unclear</h2>
        <p className="m-dim mt-4 t-3">
          Write to us and say which clause. We would rather answer it now than have the conversation
          after it matters.
        </p>
        <a
          href={`mailto:${CONTACT.email}`}
          className="m-mono mt-5 inline-block t-3 text-[var(--m-violet)] underline underline-offset-4 transition hover:text-[var(--m-ink)]"
        >
          {CONTACT.email}
        </a>
      </div>
    </LegalPage>
  );
}
