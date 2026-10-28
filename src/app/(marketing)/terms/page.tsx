import type { Metadata } from 'next';
import { pageMeta } from '@/lib/marketing/seo';
import { BRAND, CONTACT } from '@/lib/marketing/content';
import { LegalPage } from '@/components/marketing/LegalPage';
import { TERMS_CLAUSES, TERMS_UPDATED } from '@/lib/marketing/legal';

export const metadata: Metadata = pageMeta({
  title: 'Terms',
  description: `The terms for using ${BRAND.name} and its tools: general information only, results that are estimates, accounts, your content, and liability.`,
  path: '/terms',
});

const TRAIL = [
  { label: 'Home', href: '/' },
  { label: 'Terms', href: '/terms' },
] as const;

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms of use."
      lead={`The terms that apply when you visit ${BRAND.name} or use any of its tools.`}
      updated={TERMS_UPDATED}
      clauses={TERMS_CLAUSES}
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
