import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ArchScene, Container, Eyebrow, Rise, Section } from '@/components/marketing/bits';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { JsonLd } from '@/components/marketing/JsonLd';
import { Reveal } from '@/components/marketing/Reveal';
import { Roost } from '@/components/brand/Owl';
import { MotionTitle } from '@/components/marketing/rich/MotionTitle';
import { DuneCta } from '@/components/marketing/rich/DuneCta';
import { TOPICS, glossary } from '@/lib/guides/glossary';
import { glossaryLd, pageMeta } from '@/lib/marketing/seo';

const DESCRIPTION =
  'Plain definitions of the finance terms Indian households and finance teams meet: carpet area, pre-EMI, rental yield, bank reconciliation, vouchers, DIN, EV/EBITDA and more.';

export const metadata: Metadata = pageMeta({
  title: 'Finance glossary: terms explained simply',
  description: DESCRIPTION,
  path: '/glossary',
});

const TRAIL = [
  { label: 'Home', href: '/' },
  { label: 'Guides', href: '/guides' },
  { label: 'Glossary', href: '/glossary' },
] as const;

const anchor = (topic: string) => topic.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/**
 * Every term the guides and tools use, defined in a sentence or two, grouped by
 * the kind of work, each linked to the guide that works it through. The page an
 * assistant can quote a definition from; DefinedTermSet data says so.
 */
export default function GlossaryPage() {
  const terms = glossary();

  return (
    <>
      <JsonLd data={glossaryLd({ path: '/glossary', name: 'Finance glossary', description: DESCRIPTION, terms })} />

      <section className="relative overflow-hidden">
        <ArchScene motif="ledger" />
        <Roost seed="glossary-shelf" band="top-right" />
        <Container wide className="relative pt-16 pb-14 sm:pt-24 sm:pb-20 lg:pr-[25rem] xl:pr-[28rem]">
          <Rise>
            <Breadcrumbs trail={TRAIL} className="mb-7" />
          </Rise>
          <Rise>
            <Eyebrow>Glossary</Eyebrow>
          </Rise>
          <MotionTitle className="mt-5 max-w-4xl t-h1" lines={[[{ text: 'Every term,' }, { text: 'in a sentence or two.', tint: true }]]} />
          <Rise delay={120} solid>
            <p className="m-dim mt-7 max-w-2xl t-4 sm:t-5">
              The words the guides and tools use, defined plainly, {terms.length} of them. Each one
              links to the guide that works it through with an example.
            </p>
          </Rise>
          <Rise delay={200}>
            <nav aria-label="Topics" className="mt-9 flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <a
                  key={t}
                  href={`#${anchor(t)}`}
                  className="m-card rounded-full px-4 py-2 t-3 font-medium text-[var(--m-ink)] transition hover:bg-[var(--m-bg-2)]"
                >
                  {t}{' '}
                </a>
              ))}
            </nav>
          </Rise>
        </Container>
      </section>

      {TOPICS.map((topic) => {
        const list = terms.filter((t) => t.topic === topic);
        if (list.length === 0) return null;
        return (
          <Section key={topic} id={anchor(topic)} className="scroll-mt-20">
            <Container wide>
              <Reveal>
                <h2 className="m-display t-h3">{topic}</h2>
              </Reveal>
              <dl className="mt-8 grid gap-4 md:grid-cols-2">
                {/* Each card is the dl's group div itself, so a dt and its dd
                    sit directly inside it, as a definition list requires. */}
                {list.map((t) => (
                  <Reveal key={t.id} className="m-card h-full rounded-[1.5rem] p-6 sm:p-7">
                    <dt id={t.id} className="m-display scroll-mt-28 t-5 text-[var(--m-ink)]">
                      <dfn className="not-italic">{t.term}</dfn>
                    </dt>
                    <dd className="m-dim mt-3 t-3">{t.definition}</dd>
                    {t.href && (
                      <dd className="mt-4 t-2">
                        <Link
                          href={t.href}
                          className="group inline-flex items-center gap-1.5 font-semibold text-[var(--m-ink)] underline decoration-[var(--m-line-2)] underline-offset-4 hover:decoration-current"
                        >
                          {t.guideTitle}
                          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </Link>
                      </dd>
                    )}
                  </Reveal>
                ))}
              </dl>
            </Container>
          </Section>
        );
      })}

      <Section>
        <Container wide>
          <DuneCta
            eyebrow="Rather not do it by hand?"
            title="Let the tool do the working."
            body="Every guide behind these terms leads to a tool that does the same job, with the same rules, on your own figures."
            href="/tools"
            label="See every tool"
          />
        </Container>
      </Section>
    </>
  );
}
