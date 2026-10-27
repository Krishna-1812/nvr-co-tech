import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArchScene, Container, Eyebrow, Rise, Section } from '@/components/marketing/bits';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { Reveal } from '@/components/marketing/Reveal';
import { agentBySlug } from '@/lib/marketing/content';
import { pageMeta } from '@/lib/marketing/seo';
import { publishedGuides, readingMinutes, visibleGuides } from '@/lib/guides';

const meta = pageMeta({
  title: 'Guides',
  description:
    'Plain answers to the questions finance teams and households ask: the true cost of a flat, rental yield, bank reconciliation, net worth, tax notices and valuation.',
  path: '/guides',
});

/** Indexed only once a guide is published; until then the index is a preview of drafts. */
export function generateMetadata(): Metadata {
  return publishedGuides().length > 0 ? meta : { ...meta, robots: { index: false, follow: false } };
}

const TRAIL = [
  { label: 'Home', href: '/' },
  { label: 'Guides', href: '/guides' },
] as const;

export default function GuidesPage() {
  const guides = visibleGuides();
  // In production with nothing published there is no index to show.
  if (guides.length === 0) notFound();

  return (
    <>
      <section className="relative overflow-hidden">
        <ArchScene color="var(--m-gold)" motif="ledger" />
        <Container className="relative pt-16 pb-14 sm:pt-24 sm:pb-16 lg:pr-[25rem] xl:pr-[28rem]">
          <Rise>
            <Breadcrumbs trail={TRAIL} className="mb-7" />
          </Rise>
          <Rise>
            <Eyebrow>Guides</Eyebrow>
          </Rise>
          <Rise delay={60}>
            <h1 className="m-display mt-5 max-w-3xl t-h1">Answers, worked through.</h1>
          </Rise>
          <Rise delay={120}>
            <p className="m-dim mt-7 max-w-2xl t-4 sm:t-5">
              Each guide answers one question in full, with a worked example you can check, and then
              points to the tool that does the work.
            </p>
          </Rise>
        </Container>
      </section>

      <Section>
        <Container>
          <ul className="grid gap-4 md:grid-cols-2">
            {guides.map((g, i) => (
              <Reveal as="li" key={g.slug} delay={Math.min(i, 6) * 40}>
                <Link href={`/guides/${g.slug}`} className="m-card block h-full rounded-3xl p-6 transition hover:-translate-y-0.5 sm:p-7">
                  <p className="m-eyebrow">
                    {agentBySlug(g.tool)?.name} · {readingMinutes(g)} min read
                    {g.status === 'draft' ? ' · Draft' : ''}
                  </p>
                  <h2 className="m-display mt-3 t-5">{g.title}</h2>
                  <p className="m-dim-2 mt-3 t-3">{g.lead}</p>
                </Link>
              </Reveal>
            ))}
          </ul>
        </Container>
      </Section>
    </>
  );
}
