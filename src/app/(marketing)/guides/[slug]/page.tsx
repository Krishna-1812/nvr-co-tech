import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArchScene, ArrowLink, CTA, Container, Eyebrow, Rise, Section } from '@/components/marketing/bits';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { JsonLd } from '@/components/marketing/JsonLd';
import { Reveal } from '@/components/marketing/Reveal';
import { agentBySlug } from '@/lib/marketing/content';
import { articleLd, faqLd, pageMeta } from '@/lib/marketing/seo';
import { guideBySlug, readingMinutes, sectionId, visibleGuides, type Block, type Guide } from '@/lib/guides';

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

export default async function GuidePage({ params }: Params) {
  const guide = guideBySlug((await params).slug);
  if (!guide) notFound();
  const tool = agentBySlug(guide.tool)!;
  const sections = guide.blocks.filter((b): b is Extract<Block, { t: 'h2' }> => b.t === 'h2');
  const related = visibleGuides().filter((g) => g.slug !== guide.slug).slice(0, 3);

  const trail = [
    { label: 'Home', href: '/' },
    { label: 'Guides', href: '/guides' },
    { label: guide.title, href: `/guides/${guide.slug}` },
  ];

  return (
    <>
      {guide.status === 'published' && <JsonLd data={articleLd(guide)} />}

      <section className="relative overflow-hidden">
        <ArchScene color="var(--m-gold)" motif="ledger" />
        <Container className="relative pt-16 pb-14 sm:pt-24 sm:pb-16 lg:pr-[25rem] xl:pr-[28rem]">
          {guide.status === 'draft' && (
            <p
              role="note"
              className="m-card mb-7 inline-block rounded-2xl border border-dashed border-[var(--m-gold)] px-4 py-2.5 t-3 font-semibold text-[var(--m-ink)]"
            >
              Draft for review. Not on the live site and not indexed.
            </p>
          )}
          <Rise>
            <Breadcrumbs trail={trail} className="mb-7" />
          </Rise>
          <Rise>
            <Eyebrow>Guide · {tool.name}</Eyebrow>
          </Rise>
          <Rise delay={60}>
            <h1 className="m-display mt-5 max-w-3xl t-h1">{guide.title}</h1>
          </Rise>
          <Rise delay={120}>
            <p className="m-dim mt-7 max-w-2xl t-4 sm:t-5">{guide.lead}</p>
          </Rise>
          <Rise delay={170}>
            <dl className="mt-9 flex flex-wrap gap-3">
              <div className="m-card rounded-2xl px-4 py-3 shadow-[0_10px_24px_-18px_rgb(80_40_20_/_0.5)]">
                <dt className="m-eyebrow t-1">Updated</dt>
                <dd className="mt-1 t-3 font-semibold text-[var(--m-ink)] tabular-nums">
                  <time dateTime={guide.updated}>{date(guide.updated)}</time>
                </dd>
              </div>
              <div className="m-card rounded-2xl px-4 py-3 shadow-[0_10px_24px_-18px_rgb(80_40_20_/_0.5)]">
                <dt className="m-eyebrow t-1">Reading time</dt>
                <dd className="mt-1 t-3 font-semibold text-[var(--m-ink)] tabular-nums">{readingMinutes(guide)} min</dd>
              </div>
            </dl>
          </Rise>
        </Container>
      </section>

      <Section>
        <Container>
          <div className="grid gap-12 lg:grid-cols-[15.5rem_minmax(0,68ch)] lg:gap-16">
            <nav
              aria-label="Contents"
              className="m-card rounded-3xl p-5 shadow-[0_24px_44px_-34px_rgb(80_40_20_/_0.55)] lg:sticky lg:top-28 lg:self-start"
            >
              <p className="m-eyebrow">Contents</p>
              <ol className="mt-4 space-y-0.5 border-t border-[var(--m-line)] pt-3">
                {sections.map((s) => (
                  <li key={s.text}>
                    <a
                      href={`#${sectionId(s.text)}`}
                      className="m-dim -mx-2 block rounded-xl px-2 py-1.5 t-3 transition hover:bg-[var(--m-bg)] hover:text-[var(--m-ink)]"
                    >
                      {s.text}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    href="#questions"
                    className="m-dim -mx-2 block rounded-xl px-2 py-1.5 t-3 transition hover:bg-[var(--m-bg)] hover:text-[var(--m-ink)]"
                  >
                    Questions
                  </a>
                </li>
              </ol>
            </nav>

            <article className="min-w-0 max-w-[68ch] lg:max-w-none">
              {/*
                The answer first, in a box of its own, because it is what most
                readers came for and what an answer engine quotes. Everything
                below is the working.
              */}
              <div className="m-card rounded-3xl p-6 sm:p-7">
                <p className="m-eyebrow">The short answer</p>
                <p className="mt-3 t-4 text-[var(--m-ink)]">{guide.answer}</p>
              </div>

              <div className="mt-4">
                {guide.blocks.map((b, i) => (
                  <GuideBlock key={i} block={b} />
                ))}
              </div>

              <ToolCard guide={guide} />
            </article>
          </div>
        </Container>
      </Section>

      <Section id="questions" className="scroll-mt-20">
        <JsonLd data={faqLd(guide.faq)} />
        <Container>
          <Reveal>
            <Eyebrow>Questions</Eyebrow>
            <h2 className="m-display mt-4 t-h3">What people ask next.</h2>
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {guide.faq.map((f, i) => (
              <Reveal key={f.q} delay={Math.min(i, 4) * 40}>
                <div className="m-card h-full rounded-2xl px-5 py-5">
                  <h3 className="t-4 font-semibold text-[var(--m-ink)]">{f.q}</h3>
                  <p className="m-dim-2 mt-2 t-3">{f.a}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {related.length > 0 && (
        <Section>
          <Container>
            <Reveal>
              <Eyebrow>More guides</Eyebrow>
            </Reveal>
            <ul className="mt-6 grid gap-4 md:grid-cols-3">
              {related.map((g) => (
                <li key={g.slug}>
                  <Link href={`/guides/${g.slug}`} className="m-card block h-full rounded-2xl px-5 py-5 transition hover:-translate-y-0.5">
                    <p className="t-4 font-semibold text-[var(--m-ink)]">{g.title}</p>
                    <p className="m-dim-2 mt-2 t-3">{g.lead}</p>
                  </Link>
                </li>
              ))}
            </ul>
            <ArrowLink href="/guides" className="mt-8">
              All guides
            </ArrowLink>
          </Container>
        </Section>
      )}
    </>
  );
}

function GuideBlock({ block: b }: { block: Block }) {
  switch (b.t) {
    case 'h2':
      return (
        <h2 id={sectionId(b.text)} className="m-display mt-12 scroll-mt-28 t-5 sm:t-6">
          {b.text}
        </h2>
      );
    case 'p':
      return <p className="m-dim mt-4 t-3">{b.text}</p>;
    case 'ul':
      return (
        <ul className="m-dim mt-4 list-disc space-y-2 pl-5 t-3 marker:text-[var(--m-gold)]">
          {b.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol className="m-dim mt-4 list-decimal space-y-2 pl-5 t-3 marker:font-semibold marker:text-[var(--m-gold)]">
          {b.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
    case 'formula':
      return (
        <p className="m-mono mt-5 rounded-2xl border border-[var(--m-line)] bg-[var(--m-bg-2)] px-5 py-4 t-3 text-[var(--m-ink)]">
          {b.text}
        </p>
      );
    case 'table': {
      // A wide table scrolls sideways on a phone rather than squeezing every
      // cell into a column of single words; a two-column one simply wraps. The
      // caption sits outside the scrolling box so it is never cut off.
      const wide = b.head.length > 3;
      return (
        <figure className="mt-6 rounded-2xl border border-[var(--m-line)]">
          <figcaption className="m-eyebrow px-4 pt-4 pb-2">{b.caption}</figcaption>
          <div className="overflow-x-auto">
            <table className={`w-full border-collapse t-3 ${wide ? 'min-w-[40rem] whitespace-nowrap' : ''}`}>
              <thead>
                <tr className="border-b border-[var(--m-line)]">
                  {b.head.map((h, i) => (
                    <th
                      key={i}
                      scope="col"
                      className={`px-4 py-2.5 font-semibold text-[var(--m-ink)] ${i === 0 ? 'text-left' : 'text-right'}`}
                    >
                      {h || <span className="sr-only">Item</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r} className="border-b border-[var(--m-line)] last:border-0">
                    {row.map((cell, c) =>
                      c === 0 ? (
                        <th key={c} scope="row" className="m-dim px-4 py-2.5 text-left font-normal">
                          {cell}
                        </th>
                      ) : (
                        <td key={c} className="px-4 py-2.5 text-right align-top text-[var(--m-ink)] tabular-nums">
                          {cell}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      );
    }
    case 'note':
      return (
        <aside className="m-card mt-6 rounded-2xl px-5 py-5">
          <p className="t-3 font-semibold text-[var(--m-ink)]">{b.title}</p>
          <p className="m-dim mt-2 t-3">{b.text}</p>
        </aside>
      );
  }
}

/** Where the guide leads: the tool that does what it describes. */
function ToolCard({ guide }: { guide: Guide }) {
  const tool = agentBySlug(guide.tool)!;
  return (
    <div className="m-card mt-12 rounded-3xl p-6 sm:p-8">
      <p className="m-eyebrow">Do it with {tool.name}</p>
      <p className="mt-3 t-4 text-[var(--m-ink)]">{tool.summary}</p>
      <CTA href={`/tools/${tool.slug}`} className="mt-6">
        See {tool.name}
      </CTA>
    </div>
  );
}
