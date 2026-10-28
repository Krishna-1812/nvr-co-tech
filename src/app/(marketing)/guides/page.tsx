import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container, LineRise, Rise, Section, SectionHeading } from '@/components/marketing/bits';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { Counter } from '@/components/marketing/motion';
import { Letters } from '@/components/marketing/play/Letters';
import { Springy } from '@/components/marketing/play/Springy';
import { FigureBand } from '@/components/marketing/guides/FigureBand';
import { GuideBrowser } from '@/components/marketing/guides/GuideBrowser';
import { DuneCta } from '@/components/marketing/rich/DuneCta';
import { GuideDeck } from '@/components/marketing/guides/GuideDeck';
import { StepRail } from '@/components/marketing/rich/StepRail';
import { toCard } from '@/components/marketing/guides/summary';
import { Roost } from '@/components/brand/Owl';
import { collectionLd, pageMeta } from '@/lib/marketing/seo';
import { JsonLd } from '@/components/marketing/JsonLd';
import { publishedGuides, visibleGuides } from '@/lib/guides';

const meta = pageMeta({
  // What the index is, in words somebody searches; "Guides" alone matched nothing.
  title: 'Finance guides for India',
  description:
    'Plain answers with worked examples: the true cost of a flat, rental yield, bank reconciliation, net worth, income tax notices and valuing a company.',
  path: '/guides',
});

/** Indexed only once a guide is published; until then the index is a preview of drafts. */
export function generateMetadata(): Metadata {
  return publishedGuides().length > 0 ? meta : { ...meta, robots: { index: false, follow: false } };
}

/** How every guide is laid out. */
const STOPS = [
  { t: 'The short answer', d: 'What you came for, in under sixty words, first.' },
  { t: 'The working', d: 'Each step in order, with the rule behind it.' },
  { t: 'A worked example', d: 'Real figures in rupees, checked on every build.' },
  { t: 'The tool', d: 'The software that does the same work for you.' },
];

const TRAIL = [
  { label: 'Home', href: '/' },
  { label: 'Guides', href: '/guides' },
] as const;

export default function GuidesPage() {
  const guides = visibleGuides();
  // In production with nothing published there is no index to show.
  if (guides.length === 0) notFound();

  const cards = guides.map(toCard);
  const minutes = cards.reduce((n, c) => n + c.minutes, 0);
  const tools = new Set(cards.map((c) => c.toolSlug)).size;
  const toolList = Array.from(new Map(cards.map((c) => [c.toolSlug, c])).values());

  return (
    <>
      {publishedGuides().length > 0 && (
        <JsonLd
          data={collectionLd({
            path: '/guides',
            name: 'Guides',
            description: meta.description as string,
            items: publishedGuides().map((g) => ({ name: g.title, path: `/guides/${g.slug}`, description: g.lead })),
          })}
        />
      )}
      <section className="relative overflow-hidden">
        <Roost seed="guides-rafter" band="top-right" />
        <Container wide className="relative pt-12 pb-16 sm:pt-16 sm:pb-24">
          <Rise>
            <Breadcrumbs trail={TRAIL} className="mb-8" />
          </Rise>
          <div className="grid items-center gap-14 lg:grid-cols-[1.08fr_1fr] lg:gap-16">
            <div>
              <Rise>
                <span className="flex items-center gap-3.5">
                  <span aria-hidden className="h-px w-10 bg-[var(--m-gold)]" />
                  <span className="m-mono t-1 font-medium t-caps text-[var(--m-gold)] uppercase">Guides</span>
                </span>
              </Rise>
              <Springy as="h1" className="m-display mt-7 t-hero" delay={1400}>
                <LineRise delay={60}>
                  <Letters text="Answers," />
                </LineRise>
                <LineRise delay={160}>
                  <span className="m-mark" style={{ '--mark-delay': '900ms' } as React.CSSProperties}>
                    <Letters text="worked through." start={8} />
                  </span>
                </LineRise>
              </Springy>
              <Rise delay={320}>
                <p className="m-dim mt-7 max-w-xl t-4 sm:t-5">
                  Each guide answers one question people search for, in plain words, with a worked
                  example in rupees you can check line by line. Then it points to the tool that
                  does the work.
                </p>
              </Rise>
              <Rise delay={420}>
                <dl className="mt-10 grid max-w-lg grid-cols-3 gap-3">
                  <Stat value={cards.length} label="Guides" />
                  <Stat value={minutes} label="Minutes of reading" />
                  <Stat value={tools} label="Tools they lead to" />
                </dl>
              </Rise>
            </div>
            <Rise delay={200} className="lg:pl-4">
              <GuideDeck cards={cards} />
            </Rise>
          </div>
        </Container>
      </section>

      <FigureBand cards={cards} />

      <Section divider={false}>
        <Container wide>
          <SectionHeading
            eyebrow="Every guide"
            title="Pick a question."
            lead="Filter by the kind of work. Every figure on a card is quoted from its guide."
          />
          <div className="mt-10">
            <GuideBrowser cards={cards} />
          </div>
          {publishedGuides().length > 0 && (
            <p className="m-dim mt-10 t-3">
              Every term these guides use is defined in a sentence or two in the{' '}
              <Link href="/glossary" className="font-semibold text-[var(--m-ink)] underline decoration-[var(--m-line-2)] underline-offset-4 hover:decoration-current">
                glossary
              </Link>
              .
            </p>
          )}
        </Container>
      </Section>

      <Section>
        <Container wide>
          <SectionHeading
            eyebrow="How they are built"
            title="Four stops, every time."
            lead="Every guide is laid out the same way, so you always know where the answer is."
            center
          />
          <div className="mt-14">
            <StepRail stops={STOPS} />
          </div>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <DuneCta
            eyebrow="Rather not do it by hand?"
            title="Let the tool do the working."
            body="Every guide leads to a tool that does the same job: the same rules, the same arithmetic, on your own figures."
            href="/tools"
            label="See every tool"
          >
            {toolList.slice(0, 3).map((c) => (
              <Link
                key={c.toolSlug}
                href={`/tools/${c.toolSlug}`}
                className="rounded-full border border-[rgb(251_246_238_/_0.35)] px-4 py-2 t-3 transition hover:bg-[rgb(251_246_238_/_0.12)]"
              >
                {c.tool}{' '}
              </Link>
            ))}
          </DuneCta>
        </Container>
      </Section>
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="m-card flex flex-col-reverse justify-end rounded-2xl px-4 py-4 shadow-[0_10px_24px_-18px_rgb(80_40_20_/_0.5)]">
      <dt className="m-dim-2 mt-1 t-2">{label}</dt>
      <dd className="m-display t-h3 tabular-nums text-[var(--m-ink)]">
        <Counter to={value} />
      </dd>
    </div>
  );
}
