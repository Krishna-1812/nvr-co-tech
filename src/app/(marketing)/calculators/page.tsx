import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ArchScene, ArrowLink, Container, Eyebrow, Rise, Section } from '@/components/marketing/bits';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { JsonLd } from '@/components/marketing/JsonLd';
import { Reveal } from '@/components/marketing/Reveal';
import { MotionTitle } from '@/components/marketing/rich/MotionTitle';
import { CALCULATORS } from '@/lib/calculators';
import { collectionLd, pageMeta } from '@/lib/marketing/seo';

const DESCRIPTION =
  'Free calculators for Indian property and valuation sums: rental yield, carpet area and loading, GST on a flat, pre-EMI vs full EMI and EV/EBITDA.';

export const metadata: Metadata = pageMeta({
  title: 'Free finance calculators for India',
  description: DESCRIPTION,
  path: '/calculators',
});

const TRAIL = [
  { label: 'Home', href: '/' },
  { label: 'Calculators', href: '/calculators' },
] as const;

/**
 * Every free calculator, grouped by what it is for. Each card says what the
 * calculator answers in a sentence and links to it; the list is an ItemList in
 * the structured data, like the guides and the tools.
 */
export default function CalculatorsPage() {
  const topics = [...new Set(CALCULATORS.map((c) => c.topic))];

  return (
    <>
      <JsonLd
        data={collectionLd({
          path: '/calculators',
          name: 'Free finance calculators',
          description: DESCRIPTION,
          items: CALCULATORS.map((c) => ({ name: c.name, path: `/calculators/${c.slug}`, description: c.search.description })),
        })}
      />

      <section className="relative overflow-hidden">
        <ArchScene motif="sundial" />
        <Container wide className="relative pt-16 pb-14 sm:pt-24 sm:pb-20 lg:pr-[25rem] xl:pr-[28rem]">
          <Rise>
            <Breadcrumbs trail={TRAIL} className="mb-7" />
          </Rise>
          <Rise>
            <Eyebrow>Calculators</Eyebrow>
          </Rise>
          <MotionTitle className="mt-5 max-w-4xl t-h1" lines={[[{ text: 'The sums,' }, { text: 'worked on your figures.', tint: true }]]} />
          <Rise delay={120} solid>
            <p className="m-dim mt-7 max-w-2xl t-4 sm:t-5">
              Free calculators for the sums people check before buying a flat or valuing a
              company. Each one opens on a worked example, shows its formulas, and links to the
              guide that explains it. No sign-up.
            </p>
          </Rise>
        </Container>
      </section>

      {topics.map((topic) => (
        <Section key={topic} divider={false} className="pt-0 sm:pt-0">
          <Container wide>
            <Reveal>
              <h2 className="m-display s-settle t-h3">{topic}</h2>
            </Reveal>
            <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {CALCULATORS.filter((c) => c.topic === topic).map((c, i) => (
                <li key={c.slug}>
                  <Reveal delay={Math.min(i, 3) * 60} className="h-full">
                    <Link
                      href={`/calculators/${c.slug}`}
                      className="g-card m-card relative flex h-full flex-col overflow-hidden rounded-[1.75rem] p-6 transition hover:bg-[var(--m-bg-2)] sm:p-7"
                    >
                      <span className="m-display t-5 text-[var(--m-ink)]">{c.name}</span>{' '}
                      <span className="m-dim mt-3 t-3">{c.lead}</span>{' '}
                      <span className="mt-auto inline-flex items-center gap-1.5 pt-6 t-3 font-semibold text-[var(--m-ink)]">
                        Open the calculator
                        <ArrowRight className="g-arrow size-4" aria-hidden />
                      </span>
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ))}

      <Section>
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <p className="m-dim t-4">
                Each calculator does one sum. For the whole picture, such as every payment on a flat
                until possession or a full peer set for a valuation, the tools do the rest.
              </p>
            </Reveal>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
              <ArrowLink href="/guides">All guides</ArrowLink> <ArrowLink href="/tools">All tools</ArrowLink>{' '}
              <ArrowLink href="/glossary">Glossary</ArrowLink>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
