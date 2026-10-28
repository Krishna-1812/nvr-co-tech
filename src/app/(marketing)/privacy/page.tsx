import type { Metadata } from 'next';
import { pageMeta } from '@/lib/marketing/seo';
import { BRAND, CONTACT } from '@/lib/marketing/content';
import { LegalPage } from '@/components/marketing/LegalPage';
import { PRIVACY_CLAUSES, PRIVACY_UPDATED } from '@/lib/marketing/legal';

export const metadata: Metadata = pageMeta({
  title: 'Privacy',
  description: `What ${BRAND.name} collects, what you enter into its tools, cookies, how it is used, shared and stored, how long it is kept, and your choices.`,
  path: '/privacy',
});

const TRAIL = [
  { label: 'Home', href: '/' },
  { label: 'Privacy', href: '/privacy' },
] as const;

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy policy."
      lead={`What information we collect when you use ${BRAND.name}, and how we use and protect it.`}
      updated={PRIVACY_UPDATED}
      clauses={PRIVACY_CLAUSES}
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
