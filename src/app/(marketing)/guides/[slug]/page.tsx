import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Clock, Plus } from 'lucide-react';
import { ArrowLink, Container, Eyebrow, LineRise, Rise, Section } from '@/components/marketing/bits';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { JsonLd } from '@/components/marketing/JsonLd';
import { Reveal } from '@/components/marketing/Reveal';
import { Tilt } from '@/components/marketing/motion';
import { HeroStage } from '@/components/marketing/play/HeroStage';
import { Letters } from '@/components/marketing/play/Letters';
import { Odometer } from '@/components/marketing/play/Odometer';
import { ScrollWords } from '@/components/marketing/play/ScrollWords';
import { Springy } from '@/components/marketing/play/Springy';
import { GuideContents } from '@/components/marketing/guides/GuideContents';
import { GuideCta } from '@/components/marketing/guides/GuideCta';
import { toCard } from '@/components/marketing/guides/summary';
import { articleLd, faqLd, pageMeta } from '@/lib/marketing/seo';
import { guideBySlug, sectionId, visibleGuides, type Block } from '@/lib/guides';

type Params = { params: Promise<{ slug: string }> };

/** Only the guides this deployment shows: drafts exist on previews, never in production. */
export const dynamicParams = false;

export function generateStaticParams() {
  return visibleGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const guide = guideBySlug((await params).slug);
  if (!guide) return { title: 'Guide not found' };
  const meta = pageMeta({ title: guide.search.title, description: guide.search.description, path: `/guides/${guide.slug}` });
  // A draft can be read on a preview deployment, and must never be indexed from one.
  return guide.status === 'draft' ? { ...meta, robots: { index: false, follow: false } } : meta;
}

const date = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** A table cell that is one figure (₹6,00,000, 1,094, 14.6%, (12,590)) rolls in on the odometer. */
const FIGURE = /^[(₹+− ]*\d[\d,.]*[)%x]*$/;

export default async function GuidePage({ params }: Params) {
  const guide = guideBySlug((await params).slug);
  if (!guide) notFound();

  const all = visibleGuides();
  const index = all.findIndex((g) => g.slug === guide.slug);
  const card = toCard(guide, index);
  const prev = index > 0 ? toCard(all[index - 1], index - 1) : null;
  const next = index < all.length - 1 ? toCard(all[index + 1], index + 1) : null;

  const headings = guide.blocks.filter((b): b is Extract<Block, { t: 'h2' }> => b.t === 'h2');
  const sections = [
    ...headings.map((h) => ({ id: sectionId(h.text), label: h.text })),
    { id: 'questions', label: 'Questions' },
  ];
  let n = 0;

  const trail = [
    { label: 'Home', href: '/' },
    { label: 'Guides', href: '/guides' },
    { label: guide.title, href: `/guides/${guide.slug}` },
  ];

  return (
    <>
      {guide.status === 'published' && <JsonLd data={articleLd(guide)} />}

      <section className="relative overflow-hidden">
        <Container wide className="relative pt-12 pb-16 sm:pt-16 sm:pb-20">
          {guide.status === 'draft' && (
            <p
              role="note"
              className="m-card mb-7 inline-block rounded-2xl border border-dashed border-[var(--m-gold)] px-4 py-2.5 t-3 font-semibold text-[var(--m-ink)]"
            >
              Draft for review. Not on the live site and not indexed.
            </p>
          )}
          <Rise>
            <Breadcrumbs trail={trail} className="mb-8" />
          </Rise>

          <div className="grid items-center gap-12 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
            <div className="min-w-0">
              <Rise>
                <span className="flex items-center gap-3.5">
                  <span aria-hidden className="h-px w-10" style={{ background: card.color }} />
                  <span className="m-mono t-1 font-medium t-caps uppercase" style={{ color: card.colorText }}>
                    Guide {card.n} · {card.topic}
                  </span>
                </span>
              </Rise>
              <Springy as="h1" className="m-display mt-6 t-h1" delay={1200}>
                <LineRise delay={60}>
                  <Letters text={guide.title} />
                </LineRise>
              </Springy>
              <Rise delay={200}>
                <p className="m-dim mt-7 max-w-2xl t-4 sm:t-5">{guide.lead}</p>
              </Rise>
              <Rise delay={280}>
                <dl className="mt-9 flex flex-wrap gap-3">
                  <Plate label="Updated">
                    <time dateTime={guide.updated}>{date(guide.updated)}</time>
                  </Plate>
                  <Plate label="Reading time">{card.minutes} min</Plate>
                  <Plate label="Leads to">
                    <Link href={`/tools/${card.toolSlug}`} className="underline decoration-[var(--m-line-2)] underline-offset-4 hover:decoration-current">
                      {card.tool}
                    </Link>
                  </Plate>
                </dl>
              </Rise>
            </div>

            {/*
              The guide's figure, in a doorway with the sun behind it. The window
              answers the pointer (HeroStage) and the figure rolls in on load.
            */}
            <Rise delay={160}>
              <HeroStage className="m-arch m-arch-open relative mx-auto max-w-md overflow-hidden bg-[var(--sky-wash,var(--m-bg-2))] px-5 pt-40 pb-6 transition-colors duration-[4s] sm:px-8">
                <span aria-hidden className="m-stars" />
                <span aria-hidden className="m-drift-far absolute inset-0">
                  <span className="m-sun absolute top-10 left-1/2 size-40 -translate-x-1/2" />
                </span>
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-32 bg-[var(--m-bg-3)]" style={{ borderRadius: '60% 40% 0 0 / 30% 25% 0 0' }} />
                <div className="m-drift-near relative">
                  <div data-grab className="m-card rounded-3xl p-6 shadow-[0_30px_50px_-28px_rgb(60_30_15_/_0.55)]">
                    <div className="flex items-center justify-between gap-4">
                      <span className="m-eyebrow" style={{ color: card.colorText }}>
                        The figure
                      </span>
                      <span aria-hidden className="m-arch relative block h-14 w-11 overflow-hidden" style={{ background: card.color }}>
                        <span className="absolute inset-x-2 bottom-1.5 aspect-square rounded-full bg-[var(--m-sun)]" />
                      </span>
                    </div>
                    <p className="m-display mt-4 t-h1 tabular-nums" style={{ color: card.colorText }}>
                      <Odometer value={guide.figure.value} roll="load" delay={700} />
                    </p>
                    <p className="m-dim-2 mt-2 t-3">{guide.figure.label}</p>
                    <a href="#working" className="mt-5 inline-flex items-center gap-1.5 border-t border-[var(--m-line)] pt-4 t-3 font-semibold text-[var(--m-ink)]">
                      Worked through below
                      <ArrowRight className="size-4 rotate-90" aria-hidden />
                    </a>
                  </div>
                </div>
              </HeroStage>
            </Rise>
          </div>
        </Container>
      </section>

      <Section id="working">
        <Container wide>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[17rem_minmax(0,46rem)]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <GuideContents sections={sections} minutes={card.minutes} articleId="article" />
            </div>

            <article id="article" className="min-w-0">
              {/*
                The answer first, because it is what most readers came for and
                what an answer engine quotes. Its words darken into ink as they
                scroll past (ScrollWords); they are legible from the start.
              */}
              <Reveal>
                <div className="m-card relative overflow-hidden rounded-[2rem] p-7 sm:p-9">
                  <span aria-hidden className="g-quote m-display absolute -top-6 right-6 text-[9rem] leading-none" style={{ color: card.color, opacity: 0.18 }}>
                    “
                  </span>
                  <p className="m-eyebrow">The short answer</p>
                  <ScrollWords text={guide.answer} className="relative mt-4 block t-5 font-medium leading-snug sm:t-6" />
                </div>
              </Reveal>

              {guide.blocks.map((b, i) => {
                if (b.t === 'h2') n++;
                return <GuideBlock key={i} block={b} number={n} color={card.color} />;
              })}
            </article>
          </div>
        </Container>
      </Section>

      <Section id="questions" className="scroll-mt-20">
        <JsonLd data={faqLd(guide.faq)} />
        <Container>
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <Eyebrow>Questions</Eyebrow>
              <h2 className="m-display s-settle mt-4 t-h2">What people ask next.</h2>
            </Reveal>
            <div className="mt-10 space-y-3">
              {guide.faq.map((f, i) => (
                <Reveal key={f.q} delay={Math.min(i, 4) * 60}>
                  <details className="g-faq m-card group rounded-2xl" open={i === 0}>
                    <summary className="flex items-center justify-between gap-6 px-6 py-5">
                      <span className="t-4 font-semibold text-[var(--m-ink)]">{f.q}</span>
                      <span aria-hidden className="g-plus grid size-9 shrink-0 place-items-center rounded-full border border-[var(--m-line-2)] text-[var(--m-ink)]">
                        <Plus className="size-4" />
                      </span>
                    </summary>
                    <p className="m-dim px-6 pb-6 t-3">{f.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <GuideCta
            eyebrow={`Do it with ${card.tool}`}
            title="Let the tool do the working."
            body={`${card.tool} does what this guide describes, on your own figures, with the same rules.`}
            href={`/tools/${card.toolSlug}`}
            label={`See ${card.tool}`}
          />

          <nav aria-label="More guides" className="mt-14 grid gap-4 md:grid-cols-2">
            {prev ? <Neighbour card={prev} dir="prev" /> : <span className="hidden md:block" />}
            {next && <Neighbour card={next} dir="next" />}
          </nav>
          <div className="mt-10 text-center">
            <ArrowLink href="/guides">All guides</ArrowLink>
          </div>
        </Container>
      </Section>
    </>
  );
}

function Plate({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="m-card rounded-2xl px-4 py-3 shadow-[0_10px_24px_-18px_rgb(80_40_20_/_0.5)]">
      <dt className="m-eyebrow t-1">{label}</dt>
      <dd className="mt-1 t-3 font-semibold text-[var(--m-ink)] tabular-nums">{children}</dd>
    </div>
  );
}

function Neighbour({ card: c, dir }: { card: ReturnType<typeof toCard>; dir: 'prev' | 'next' }) {
  return (
    <Reveal className={dir === 'next' ? 'md:text-right' : undefined}>
      <Tilt max={4} className="h-full">
        <Link href={`/guides/${c.slug}`} className="g-card m-card relative block h-full overflow-hidden rounded-[1.75rem] p-6 sm:p-8">
          <span className={`m-eyebrow inline-flex items-center gap-2 ${dir === 'next' ? 'md:flex-row-reverse' : ''}`}>
            {dir === 'prev' ? <ArrowLeft className="size-3.5" aria-hidden /> : <ArrowRight className="g-arrow size-3.5" aria-hidden />}
            {dir === 'prev' ? 'Previous guide' : 'Next guide'}
          </span>
          <p className="m-display mt-4 t-h3 tabular-nums" style={{ color: c.colorText }}>
            {c.figure.value}
          </p>
          <p className="m-display mt-3 t-5 text-[var(--m-ink)]">{c.title}</p>
          <p className="m-dim-2 mt-3 inline-flex items-center gap-1.5 t-2">
            <Clock className="size-3.5" aria-hidden />
            {c.minutes} min · {c.topic}
          </p>
          <span aria-hidden className="g-foot-line absolute inset-x-0 bottom-0 h-1" style={{ background: c.color }} />
        </Link>
      </Tilt>
    </Reveal>
  );
}

function GuideBlock({ block: b, number, color }: { block: Block; number: number; color: string }) {
  switch (b.t) {
    case 'h2':
      return (
        <Reveal>
          <h2 id={sectionId(b.text)} className="mt-16 flex scroll-mt-28 items-baseline gap-4">
            <span className="m-mono t-2 tabular-nums" style={{ color }}>
              {String(number).padStart(2, '0')}
            </span>
            <span className="m-display s-settle t-h3">{b.text}</span>
          </h2>
          <span aria-hidden className="s-rule mt-4 block h-px bg-[var(--m-line)]" />
        </Reveal>
      );
    case 'p':
      return (
        <Reveal>
          <p className="m-dim mt-5 t-4">{b.text}</p>
        </Reveal>
      );
    case 'ul':
    case 'ol': {
      const Tag = b.t;
      return (
        <Tag className="mt-6 space-y-3 s-deal">
          {b.items.map((item, i) => (
            <li key={item} className="m-card flex gap-4 rounded-2xl px-5 py-4">
              {b.t === 'ol' ? (
                <span className="m-display grid size-8 shrink-0 place-items-center rounded-full t-3 text-[var(--m-on-grad)]" style={{ background: color }}>
                  {i + 1}
                </span>
              ) : (
                <span aria-hidden className="mt-2.5 size-2.5 shrink-0 rounded-full bg-[var(--m-sun)] ring-4 ring-[var(--m-wait-wash)]" />
              )}
              <span className="m-dim t-3">{item}</span>
            </li>
          ))}
        </Tag>
      );
    }
    case 'formula':
      return (
        <Reveal>
          <p className="g-formula m-mono mt-7 rounded-2xl bg-[var(--m-ink)] px-6 py-6 t-4 text-[var(--m-on-grad)] shadow-[0_24px_44px_-30px_rgb(43_33_27_/_0.8)]">
            {b.text}
          </p>
        </Reveal>
      );
    case 'table': {
      // A wide table scrolls sideways on a phone rather than squeezing every
      // cell into a column of single words; a two-column one simply wraps. The
      // caption sits outside the scrolling box so it is never cut off.
      const wide = b.head.length > 3;
      return (
        <Reveal>
          <figure className="m-card mt-8 overflow-hidden rounded-[1.75rem]">
            <figcaption className="m-eyebrow flex items-center gap-3 px-5 pt-5 pb-3">
              <span aria-hidden className="m-arch inline-block h-5 w-4" style={{ background: color }} />
              {b.caption}
            </figcaption>
            {/* relative: the odometer's screen-reader copy is absolutely placed,
                and without a positioned scroller it would escape the scroll box
                and widen the whole page on a phone. */}
            <div className="relative overflow-x-auto">
              <table className={`w-full border-collapse t-3 ${wide ? 'min-w-[40rem] whitespace-nowrap' : ''}`}>
                <thead>
                  <tr className="border-b border-[var(--m-line)] bg-[var(--m-bg)]">
                    {b.head.map((h, i) => (
                      <th key={i} scope="col" className={`px-5 py-3 font-semibold text-[var(--m-ink)] ${i === 0 ? 'text-left' : 'text-right'}`}>
                        {h || <span className="sr-only">Item</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((row, r) => {
                    const last = r === b.rows.length - 1 && !wide;
                    return (
                      <tr key={r} className={`border-b border-[var(--m-line)] transition-colors last:border-0 hover:bg-[var(--m-bg)] ${last ? 'bg-[var(--m-wait-wash)]' : ''}`}>
                        {row.map((cell, c) =>
                          c === 0 ? (
                            <th key={c} scope="row" className={`px-5 py-3 text-left ${last ? 'font-semibold text-[var(--m-ink)]' : 'm-dim font-normal'}`}>
                              {cell}
                            </th>
                          ) : (
                            <td key={c} className={`px-5 py-3 text-right align-top tabular-nums ${last ? 'm-display t-4' : 'text-[var(--m-ink)]'}`}>
                              {FIGURE.test(cell) ? <Odometer value={cell} /> : cell}
                            </td>
                          ),
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </figure>
        </Reveal>
      );
    }
    case 'note':
      return (
        <Reveal>
          <aside className="m-card mt-8 flex gap-5 rounded-[1.75rem] px-6 py-6">
            <span aria-hidden className="m-arch relative h-14 w-11 shrink-0 overflow-hidden" style={{ background: color }}>
              <span className="absolute inset-x-2 bottom-1 aspect-square rounded-full bg-[var(--m-sun)]" />
            </span>
            <div>
              <p className="t-4 font-semibold text-[var(--m-ink)]">{b.title}</p>
              <p className="m-dim mt-2 t-3">{b.text}</p>
            </div>
          </aside>
        </Reveal>
      );
  }
}
