import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, BookOpen } from 'lucide-react';
import { ArchScene, ArrowLink, Container, Eyebrow, LineRise, Rise, Section } from '@/components/marketing/bits';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { JsonLd } from '@/components/marketing/JsonLd';
import { Reveal } from '@/components/marketing/Reveal';
import { Letters } from '@/components/marketing/play/Letters';
import { Springy } from '@/components/marketing/play/Springy';
import { DuneCta } from '@/components/marketing/rich/DuneCta';
import { FaqAccordion } from '@/components/marketing/rich/FaqAccordion';
import { Calculator } from '@/components/marketing/calculators/Calculator';
import { CALCULATORS, calculatorBySlug, workedExample } from '@/lib/calculators';
import { FIELDS, shownValue } from '@/lib/calculators/fields';
import { guideBySlug } from '@/lib/guides';
import { glossary } from '@/lib/guides/glossary';
import { agentBySlug, BRAND } from '@/lib/marketing/content';
import { calculatorLd, faqLd, pageMeta } from '@/lib/marketing/seo';

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return CALCULATORS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const c = calculatorBySlug((await params).slug);
  if (!c) return { title: 'Calculator not found' };
  return pageMeta({ title: c.search.title, description: c.search.description, path: `/calculators/${c.slug}` });
}

const date = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * A free calculator: the sum, worked on your own figures, then why it is done
 * that way.
 *
 * The calculator sits straight under the heading, because it is what the page
 * is for. Under it, in this order: the short answer (the paragraph an assistant
 * quotes), the formulas, the opening figures written out as a worked example
 * (in the HTML as text, for anything that reads the page without running it),
 * the terms it uses with their definitions, and the questions. Then the guide
 * that explains it in full and the tool that does it on a whole schedule.
 */
export default async function CalculatorPage({ params }: Params) {
  const c = calculatorBySlug((await params).slug);
  if (!c) notFound();

  const guide = guideBySlug(c.guide);
  const tool = agentBySlug(c.tool);
  const example = workedExample(c);
  const terms = glossary().filter((t) => c.terms.includes(t.id));
  const others = CALCULATORS.filter((o) => o.slug !== c.slug);

  const trail = [
    { label: 'Home', href: '/' },
    { label: 'Calculators', href: '/calculators' },
    { label: c.name, href: `/calculators/${c.slug}` },
  ];

  return (
    <>
      <JsonLd data={calculatorLd(c)} />

      <section className="relative overflow-hidden">
        <ArchScene motif={guide?.motif ?? 'doorways'} className="h-[min(24rem,calc(100%-3rem))]" />
        <Container wide className="relative pt-12 pb-10 sm:pt-16 sm:pb-12 lg:pr-[25rem] xl:pr-[28rem]">
          <Rise>
            <Breadcrumbs trail={trail} className="mb-8" />
          </Rise>
          <Rise>
            <span className="flex items-center gap-3.5">
              <span aria-hidden className="h-px w-10 bg-[var(--m-gold)]" />
              <span className="m-mono t-1 font-medium t-caps text-[var(--m-gold)] uppercase">
                Free calculator · {c.topic}
              </span>
            </span>
          </Rise>
          <Springy as="h1" className="m-display mt-6 t-h1" delay={1200}>
            <LineRise delay={60}>
              <Letters text={c.name} />
            </LineRise>
          </Springy>
          <Rise delay={160} solid>
            <p className="m-dim mt-7 max-w-2xl t-4 sm:t-5">{c.lead}</p>
          </Rise>
          <Rise delay={240}>
            <p className="m-mono m-dim-2 mt-6 t-2 t-caps uppercase">
              Free · No sign-up · Works on a phone
            </p>
          </Rise>
        </Container>
      </section>

      <section aria-label={c.name} className="relative">
        <Container wide>
          <Rise delay={200}>
            <Calculator kind={c.kind} />
          </Rise>
        </Container>
      </section>

      <Section>
        <Container>
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <div className="m-card relative overflow-hidden rounded-[2rem] p-7 sm:p-9">
                <p className="m-eyebrow">The short answer</p>
                <p className="mt-4 t-5 font-medium leading-snug text-[var(--m-ink)] sm:t-6">{c.answer}</p>
              </div>
            </Reveal>

            <Reveal>
              <h2 id="how" className="m-display s-settle mt-16 scroll-mt-28 t-h3">
                How it is worked out
              </h2>
            </Reveal>
            {c.formulas.map((f) => (
              <Reveal key={f}>
                <p className="g-formula m-mono mt-5 rounded-2xl bg-[var(--m-ink)] px-6 py-5 t-3 text-[var(--m-on-grad)] sm:t-4">{f}</p>
              </Reveal>
            ))}
            {c.blocks.map((b, i) =>
              b.t === 'p' ? (
                <Reveal key={i}>
                  <p className="m-dim mt-5 t-4">{b.text}</p>
                </Reveal>
              ) : b.t === 'note' ? (
                <Reveal key={i}>
                  <aside className="m-card mt-8 rounded-[1.75rem] px-6 py-6">
                    <p className="t-4 font-semibold text-[var(--m-ink)]">{b.title}</p>
                    <p className="m-dim mt-2 t-3">{b.text}</p>
                  </aside>
                </Reveal>
              ) : null,
            )}

            {/*
              The opening figures and their answer, as text. The calculator
              above shows the same thing, but in inputs, which a crawler or an
              assistant reading the HTML does not read as a worked example.
            */}
            <Reveal>
              <h2 id="example" className="m-display s-settle mt-16 scroll-mt-28 t-h3">
                A worked example
              </h2>
            </Reveal>
            <Reveal>
              <figure className="m-card mt-6 overflow-hidden rounded-[1.75rem]">
                <figcaption className="m-eyebrow px-5 pt-5 pb-3">The figures the calculator opens with</figcaption>
                <table className="w-full border-collapse t-3">
                  <tbody>
                    {FIELDS[c.kind].map((f) => (
                      <tr key={f.id} className="border-b border-[var(--m-line)]">
                        <th scope="row" className="m-dim px-5 py-3 text-left font-normal">
                          {f.label}
                        </th>
                        <td className="px-5 py-3 text-right text-[var(--m-ink)] tabular-nums">{shownValue(f)}</td>
                      </tr>
                    ))}
                    {example.lines.map((l) => (
                      <tr key={l.label} className={`border-b border-[var(--m-line)] last:border-0 ${l.strong ? 'bg-[var(--m-wait-wash)]' : ''}`}>
                        <th scope="row" className={`px-5 py-3 text-left ${l.strong ? 'font-semibold text-[var(--m-ink)]' : 'm-dim font-normal'}`}>
                          {l.label}
                        </th>
                        <td className={`px-5 py-3 text-right tabular-nums ${l.strong ? 'm-display t-4 text-[var(--m-ink)]' : 'font-semibold text-[var(--m-ink)]'}`}>
                          {l.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </figure>
            </Reveal>
            {example.note && (
              <Reveal>
                <p className="m-dim mt-5 t-4">{example.note}</p>
              </Reveal>
            )}

            {terms.length > 0 && (
              <>
                <Reveal>
                  <h2 id="terms" className="m-display s-settle mt-16 scroll-mt-28 t-h3">
                    The terms it uses
                  </h2>
                </Reveal>
                <dl className="mt-6 space-y-3">
                  {/* One wrapper per term, the Reveal itself: a <dl> allows a
                      single div round each dt/dd pair, and no deeper. */}
                  {terms.map((t) => (
                    <Reveal key={t.id} className="m-card rounded-2xl px-5 py-4">
                      <dt className="t-4 font-semibold text-[var(--m-ink)]">
                        <Link href={`/glossary#${t.id}`} className="underline decoration-[var(--m-line-2)] underline-offset-4 hover:decoration-current">
                          {t.term}
                        </Link>
                      </dt>{' '}
                      <dd className="m-dim mt-1.5 t-3">{t.definition}</dd>
                    </Reveal>
                  ))}
                </dl>
              </>
            )}

            {guide && (
              <Reveal>
                <Link
                  href={`/guides/${guide.slug}`}
                  className="g-card m-card mt-12 flex items-start gap-5 rounded-[1.75rem] p-6 transition hover:bg-[var(--m-bg-2)] sm:p-7"
                >
                  <BookOpen className="mt-1 size-6 shrink-0 text-[var(--m-gold)]" aria-hidden />
                  <span className="min-w-0">
                    <span className="m-eyebrow block">The guide behind it</span>{' '}
                    <span className="m-display mt-2 block t-5 text-[var(--m-ink)]">{guide.title}</span>{' '}
                    <span className="m-dim mt-2 block t-3">{guide.answer}</span>
                  </span>
                  <ArrowRight className="g-arrow mt-1 size-5 shrink-0 text-[var(--m-ink)]" aria-hidden />
                </Link>
              </Reveal>
            )}

            <Reveal>
              <aside className="m-card mt-8 rounded-[1.75rem] px-6 py-6 t-3">
                <p className="font-semibold text-[var(--m-ink)]">How this calculator is checked</p>
                <p className="m-dim mt-2">
                  Built by {BRAND.name}, which is built by chartered accountants. An automated test
                  works the guide’s example through this calculator every time the site changes, and
                  fails if a single rupee differs. Last checked on <time dateTime={c.updated}>{date(c.updated)}</time>.
                  Spotted something wrong?{' '}
                  <Link href="/contact" className="underline decoration-[var(--m-line-2)] underline-offset-4 hover:decoration-current">
                    Tell us
                  </Link>
                  .
                </p>
              </aside>
            </Reveal>
          </div>
        </Container>
      </Section>

      <Section id="questions" className="scroll-mt-20">
        <JsonLd data={faqLd(c.faq)} />
        <Container>
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <Eyebrow>Questions</Eyebrow>
              <h2 className="m-display s-settle mt-4 t-h2">What people ask next.</h2>
            </Reveal>
            <div className="mt-10">
              <FaqAccordion faq={c.faq} />
            </div>
          </div>
        </Container>
      </Section>

      <Section>
        <Container wide>
          {tool && (
            <DuneCta
              eyebrow={`Do it with ${tool.name}`}
              title="The whole picture, not one sum."
              body={tool.summary}
              href={`/tools/${tool.slug}`}
              label={`See ${tool.name}`}
            />
          )}

          <nav aria-label="More calculators" className="mt-14">
            <p className="m-eyebrow">More free calculators</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {others.map((o) => (
                <li key={o.slug}>
                  <Link
                    href={`/calculators/${o.slug}`}
                    className="m-card flex items-center justify-between gap-4 rounded-2xl px-5 py-4 t-4 font-semibold text-[var(--m-ink)] transition hover:bg-[var(--m-bg-2)]"
                  >
                    {o.name}
                    <ArrowRight className="size-4 shrink-0" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-10 text-center">
            <ArrowLink href="/calculators">All calculators</ArrowLink>
          </div>
        </Container>
      </Section>
    </>
  );
}
