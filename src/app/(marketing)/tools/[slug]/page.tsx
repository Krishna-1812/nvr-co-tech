import Link from 'next/link';
import type { Metadata } from 'next';
import { faqLd, pageMeta, serviceLd } from '@/lib/marketing/seo';
import { guidesForTool, visibleGuides } from '@/lib/guides';
import { CALCULATORS } from '@/lib/calculators';
import { toCard } from '@/components/marketing/guides/summary';
import { FaqAccordion } from '@/components/marketing/rich/FaqAccordion';
import { MotionTitle } from '@/components/marketing/rich/MotionTitle';
import { Odometer } from '@/components/marketing/play/Odometer';
import { Tilt } from '@/components/marketing/motion';
import { notFound } from 'next/navigation';
import { ArrowRight, Check, CircleDashed, Hammer } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AGENTS,
  LIVE_AGENTS,
  STAGE_LABEL,
  STAGE_NOTE,
  agentBySlug,
  type Agent,
  toolFaq,
} from '@/lib/marketing/content';
import {
  ACCENT,
  ACCENT_TEXT,
  ON_ACCENT,
  Container,
  CTA,
  Eyebrow,
  Rise,
  Section,
  StageBadge,
  motifFor,
} from '@/components/marketing/bits';
import { ArchScene as SceneArch } from '@/components/ui/Scene';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { JsonLd } from '@/components/marketing/JsonLd';
import { Reveal } from '@/components/marketing/Reveal';
import { ReconDemo } from '@/components/marketing/agents/ReconDemo';
import { PropertyDemo } from '@/components/marketing/agents/PropertyDemo';
import { FlowDiagram } from '@/components/marketing/agents/FlowDiagram';
import { Roost } from '@/components/brand/Owl';
import { OPEN_TOOLS } from '@/lib/access';

type Params = { params: Promise<{ slug: string }> };

/**
 * The live tools that can be tried on their own public page. Each runs the
 * tool's real engine in the browser on the tool's own sample data; see the
 * components for what exactly they run.
 */
const DEMOS: Record<string, { title: string; demo: React.ReactNode }> = {
  'ledger-reconciliation': { title: 'Two books in. One statement out.', demo: <ReconDemo /> },
  'true-property-cost': { title: 'Move the dates. Watch the cost move.', demo: <PropertyDemo /> },
};

export function generateStaticParams() {
  return AGENTS.map((agent) => ({ slug: agent.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const agent = agentBySlug((await params).slug);
  if (!agent) return { title: 'Tool not found' };

  return pageMeta({ title: agent.search.title, description: agent.search.description, path: `/tools/${agent.slug}` });
}

export default async function AgentPage({ params }: Params) {
  const agent = agentBySlug((await params).slug);
  if (!agent) notFound();

  const accent = ACCENT[agent.accent];
  const faq = toolFaq(agent);
  const index = AGENTS.findIndex((a) => a.slug === agent.slug);
  const next = AGENTS[(index + 1) % AGENTS.length];

  const trail = [
    { label: 'Home', href: '/' },
    { label: 'Tools', href: '/tools' },
    { label: agent.name, href: `/tools/${agent.slug}` },
  ];

  return (
    <>
      {/*
        A Service, but only for one that exists. Six of the eight on this
        template are not built, and describing an unbuilt one to a search engine
        as something we provide is a promise made where nobody can see it being
        made. `serviceLd` is only reached down the live branch.
      */}
      {agent.stage === 'live' && <JsonLd data={serviceLd(agent)} />}

      <section className="relative overflow-hidden">
        <Roost seed="agent-alcove" band="top-right" />

        <Container wide className="relative pt-10 pb-20 sm:pt-14 sm:pb-28">
          {/* This used to be a lone "All agents" link, which told you one way
              out but not where you were standing. The trail says both, and it is
              the same array the BreadcrumbList is built from. */}
          <Rise>
            <Breadcrumbs trail={trail} />
          </Rise>

          <div className="mt-10 grid gap-14 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-16">
            <div className="min-w-0">
              <Rise delay={60}>
                {/* The search title, under the name: what the tool is, in the
                    words people type, so the heading a reader meets says the same
                    thing as the title that brought them here. */}
                <div className="flex flex-wrap items-center gap-3">
                  <StageBadge stage={agent.stage} />
                  <span className="m-mono t-1 t-caps text-[var(--m-olive)] uppercase">
                    {agent.search.title}
                  </span>
                </div>
              </Rise>

              <MotionTitle className="mt-6 t-h1" delay={110} lines={[[{ text: agent.name }]]} />

              <Rise delay={160} solid>
                <p className="m-dim mt-6 max-w-xl t-4 sm:t-5">{agent.summary}</p>
              </Rise>

              <Rise delay={210}>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <StageActions agent={agent} />
                </div>
              </Rise>

              {/*
                What goes in and what comes back, as the two plates a reader
                scans before deciding whether to read on. The same two strings
                the flow diagram further down is drawn from, so the hero cannot
                describe the tool differently from the page under it.
              */}
              <Rise delay={250}>
                <dl className="mt-10 grid max-w-xl gap-3 sm:grid-cols-2">
                  <Plate label="Takes in" body={agent.inputs} />
                  <Plate label="Gives back" body={agent.outputs} tone={ACCENT_TEXT[agent.accent]} />
                </dl>
              </Rise>

              <Rise delay={290}>
                <StageNote agent={agent} className="mt-7 max-w-lg" />
              </Rise>
            </div>

            {/*
              The agent's own doorway: framed in its colour, with the scene its
              screen opens on standing inside. For a live tool that is the very
              picture a visitor meets after signing in, which says the product is
              real more plainly than a screenshot that dates the week it was
              taken.

              A plaque hangs across the threshold with the name and the stage in
              words, so nothing the arch implies is carried by the picture alone.
              Shown on phones too, smaller: this page has no other image.
            */}
            <Rise
              delay={180}
              className="relative mx-auto w-full max-w-[19rem] sm:max-w-[23rem] lg:max-w-[26rem]"
            >
              <div
                aria-hidden
                className="m-arch m-arch-open relative p-3 shadow-[var(--m-shadow)] sm:p-4"
                style={{ background: accent }}
              >
                <SceneArch
                  motif={motifFor(agent.slug)}
                  className="h-[19rem] min-h-0 sm:h-[25rem] lg:h-[30rem]"
                />
              </div>
              <div className="m-card absolute -bottom-6 left-1/2 flex max-w-[calc(100%+2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 whitespace-nowrap shadow-[0_18px_34px_-20px_rgb(80_40_20_/_0.6)]">
                <span aria-hidden className="m-arch h-6 w-5 shrink-0" style={{ background: accent }} />
                <span className="truncate t-3 font-semibold text-[var(--m-ink)]">{agent.name}</span>{' '}
                <span className="m-mono m-dim-2 t-1 t-caps uppercase">
                  {STAGE_LABEL[agent.stage]}
                </span>
              </div>
            </Rise>
          </div>
        </Container>
      </section>

      {/*
        The tool itself, working, for the live tools that can run without an
        account: the real engine on the tool's own sample data, in the
        visitor's browser. Placed straight after the hero because a thing you
        can try is the strongest argument this page has.
      */}
      {DEMOS[agent.slug] && (
        <Section>
          <Container wide>
            <Reveal>
              <div className="mb-8 max-w-3xl">
                <div className="mb-4 flex items-center gap-3.5">
                  <span aria-hidden className="s-rule h-px w-10 bg-[var(--m-gold)]" />
                  <Eyebrow>Try it on this page</Eyebrow>
                </div>
                <h2 className="m-display s-settle t-h2">{DEMOS[agent.slug].title}</h2>
              </div>
            </Reveal>
            <Reveal delay={80}>{DEMOS[agent.slug].demo}</Reveal>
          </Container>
        </Section>
      )}

      {/*
        The case for it, given a section of its own.

        It used to be a card standing inside the hero's arch, which made it the
        most important paragraph on the page and the hardest one to read: five
        lines of body type over a sun. Set in the display face across the page
        it reads as what it is, the argument, and the hero's arch is free to
        hold the picture.
      */}
      <Section>
        <Container wide>
          <Reveal>
            <figure className="m-card relative overflow-hidden rounded-[2rem] px-6 py-12 sm:px-12 sm:py-16 lg:px-16 lg:py-20">
              <span
                aria-hidden
                className="m-arch absolute -right-10 -bottom-10 hidden h-80 w-56 opacity-[0.14] md:block"
                style={{ background: accent }}
              />
              <span
                aria-hidden
                className="m-sun absolute top-10 right-24 hidden size-16 opacity-80 md:block"
                style={{ '--sun-from': '40px' } as React.CSSProperties}
              />

              <div className="relative max-w-4xl">
                <div className="flex items-center gap-3.5">
                  <span aria-hidden className="h-px w-10 bg-[var(--m-gold)]" />
                  <Eyebrow>The case for it</Eyebrow>
                </div>
                <blockquote className="mt-7">
                  <p className="m-display t-6 !leading-[1.3] text-[var(--m-ink)] sm:t-7 lg:t-8">
                    {agent.pitch}
                  </p>
                </blockquote>
                <figcaption className="m-mono m-dim-2 mt-9 flex items-center gap-3 t-1 t-caps uppercase">
                  <span aria-hidden className="m-arch h-5 w-4" style={{ background: accent }} />
                  {agent.name} · {agent.category}
                </figcaption>
              </div>
            </figure>
          </Reveal>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.5fr] lg:gap-16">
            <Reveal>
              <div className="lg:sticky lg:top-28">
                <Eyebrow>The specifics</Eyebrow>
                <h2 className="m-display mt-4 t-h3">What {agent.name} does.</h2>
                {agent.definition && <p className="mt-5 max-w-sm t-4 text-[var(--m-ink)]">{agent.definition}</p>}
                {/* A live agent's list is a description, not a plan, and saying
                    so is the point of writing these down to this level. */}
                <p className="m-dim mt-5 max-w-sm t-3">
                  {agent.stage === 'live'
                    ? 'Every line here is something it does today. If it were only planned, it would be on a page marked as planned.'
                    : 'Every line here is something it is being built to do. None of it is a vague area we are thinking about looking at.'}
                </p>
              </div>
            </Reveal>

            {/*
              Plates rather than ruled lines. A tool with eleven specifics was a
              long column of hairlines; two columns of cards halve its height and
              let each line read as one thing it does. The number stands in the
              agent's own doorway, so the list is visibly this agent's.
            */}
            <ol className="grid gap-4 sm:grid-cols-2">
              {agent.does.map((item, i) => (
                <Reveal
                  as="li"
                  key={item}
                  delay={Math.min(i, 6) * 55}
                  className="m-card flex gap-4 rounded-2xl p-5 sm:p-6"
                >
                  <span
                    aria-hidden
                    data-n={i + 1}
                    className="m-n m-arch m-mono grid h-9 w-7 shrink-0 place-items-center pt-1 t-1 font-bold tabular-nums"
                    style={{ background: accent, color: ON_ACCENT[agent.accent] }}
                  />
                  <p className="min-w-0 t-3 text-[var(--m-ink)]">{item}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <Reveal>
            <Eyebrow>Where it fits</Eyebrow>
            <h2 className="m-display mt-4 t-h3">What goes into {agent.name}, and what you get back.</h2>
          </Reveal>

          <Reveal delay={70}>
            <div className="mt-8">
              <FlowDiagram agent={agent} />
            </div>
          </Reveal>

          <Reveal delay={130}>
            <p className="m-dim-2 mt-6 max-w-2xl t-3">
              Whatever it produces ends up as a proper record with its history attached, not as a
              message in a chat window. You get something your reviewer already knows how to check.
            </p>
          </Reveal>
        </Container>
      </Section>

      {guidesForTool(agent.slug).length > 0 && (
        <Section>
          <Container wide>
            <Reveal>
              <Eyebrow>Guides</Eyebrow>
              <h2 className="m-display s-settle mt-4 t-h3">How to do it by hand, step by step.</h2>
            </Reveal>
            <ul className="mt-8 grid gap-4 md:grid-cols-2">
              {guidesForTool(agent.slug).map((g) => {
                const c = toCard(g, visibleGuides().indexOf(g));
                return (
                  <Reveal as="li" key={g.slug}>
                    <Tilt max={4} className="h-full">
                      <Link href={`/guides/${g.slug}`} className="g-card m-card relative block h-full overflow-hidden rounded-[1.75rem] p-6 sm:p-7">
                        <span className="m-eyebrow" style={{ color: c.colorText }}>
                          Guide {c.n} · {c.minutes} min
                        </span>
                        <p className="m-display mt-4 t-h3 tabular-nums" style={{ color: c.colorText }}>
                          <Odometer value={c.figure.value} />
                        </p>
                        <p className="m-dim-2 mt-1 t-2">{c.figure.label}</p>
                        <p className="m-display mt-5 t-5 text-[var(--m-ink)]">{g.title}</p>
                        <p className="m-dim-2 mt-2 t-3">{g.lead}</p>
                        <span aria-hidden className="g-foot-line absolute inset-x-0 bottom-0 h-1" style={{ background: c.color }} />
                      </Link>
                    </Tilt>
                  </Reveal>
                );
              })}
            </ul>
            {/* The one-sum versions of what this tool does, free and with no
                account: what a reader who is not ready for the tool can use today. */}
            {CALCULATORS.some((c) => c.tool === agent.slug) && (
              <div className="mt-10">
                <p className="m-eyebrow">Free calculators</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {CALCULATORS.filter((c) => c.tool === agent.slug).map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={`/calculators/${c.slug}`}
                        className="m-card inline-flex items-center gap-2 rounded-full px-4 py-2 t-3 font-medium text-[var(--m-ink)] transition hover:bg-[var(--m-bg-2)]"
                      >
                        {c.name}
                      </Link>{' '}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Container>
        </Section>
      )}

      {faq.length > 0 && (
        <Section>
          <JsonLd data={faqLd(faq)} />
          <Container wide>
            <Reveal>
              <Eyebrow>Questions</Eyebrow>
              <h2 className="m-display mt-4 t-h3">What people ask about {agent.name}.</h2>
            </Reveal>
            <div className="mt-8 max-w-3xl">
              <FaqAccordion faq={faq} />
            </div>
          </Container>
        </Section>
      )}

      <Section>
        <Container wide>
          <Reveal>
            <div className="m-card relative overflow-hidden rounded-[2rem] px-6 py-14 sm:px-12 sm:py-18">
              {/*
                A small skyline of doorways at the panel's foot, this agent's at
                the front with the sun behind it. Decoration only, and only where
                there is room for it beside the text.
              */}
              <div aria-hidden className="absolute right-10 bottom-0 hidden h-64 w-80 lg:block">
                <span className="m-arch absolute right-0 bottom-0 h-44 w-28 bg-[var(--m-bg-2)]" />
                <span
                  className="m-sun absolute right-[7.5rem] bottom-36 size-24"
                  style={{ '--sun-from': '60px' } as React.CSSProperties}
                />
                <span
                  className="m-arch absolute right-24 bottom-0 h-56 w-36"
                  style={{ background: accent }}
                />
                <span className="m-arch absolute right-[15rem] bottom-0 h-28 w-16 bg-[var(--m-bg-3)]" />
              </div>

              <div className="relative max-w-xl">
                <h2 className="m-display t-h3">
                  {agent.stage === 'live'
                    ? OPEN_TOOLS.includes(agent.slug)
                      ? 'It is running. Go and use it.'
                      : 'It is running. Ask for access.'
                    : `Talk to us about ${agent.name}.`}
                </h2>
                <p className="m-dim mt-5 t-4">
                  {agent.stage === 'live'
                    ? OPEN_TOOLS.includes(agent.slug)
                      ? 'Open it and start. No account is needed; sign in only if you want your work saved to an account.'
                      : 'Our own team uses it every day. Open it to see everything it does and ask for access there, and a person replies. Or have somebody show you round first.'
                    : 'A walkthrough covers what you can use today, what this one will do, and where it sits in the queue. We will not give you a date on the call that we are not sure of.'}
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <StageActions agent={agent} />
                </div>
                <StageNote agent={agent} className="mt-8 max-w-sm" />
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <Reveal>
            <Link
              href={`/tools/${next.slug}`}
              className="group m-card m-card-lift flex items-center gap-5 rounded-[1.75rem] p-5 transition-[transform,box-shadow] duration-300 sm:gap-7 sm:p-6"
            >
              <span
                aria-hidden
                className="m-arch relative h-20 w-16 shrink-0 overflow-hidden sm:h-24 sm:w-[4.5rem]"
                style={{ background: ACCENT[next.accent] }}
              >
                <span className="absolute bottom-0 left-1/2 size-10 -translate-x-1/2 translate-y-1/3 rounded-full bg-[var(--m-sun)] transition-transform duration-500 group-hover:translate-y-0" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="m-eyebrow block">Next tool</span>{' '}
                <span className="m-display mt-2 block t-h4 transition-colors group-hover:text-[var(--m-gold)]">
                  {next.name}
                </span>{' '}
                <span className="m-dim-2 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 t-3">
                  {next.category}{' '}
                  <StageBadge stage={next.stage} />
                </span>
              </span>
              <ArrowRight
                aria-hidden
                className="m-dim-2 size-6 shrink-0 transition-transform group-hover:translate-x-1.5"
              />
            </Link>
          </Reveal>
        </Container>
      </Section>
    </>
  );
}

/** One of the hero's two plates: a label and the line under it. */
function Plate({ label, body, tone }: { label: string; body: string; tone?: string }) {
  return (
    <div className="m-card min-w-0 rounded-2xl px-4 py-3.5 shadow-[0_14px_30px_-24px_rgb(80_40_20_/_0.55)]">
      <dt className="m-eyebrow t-1">{label}</dt>
      <dd className="mt-1.5 t-3 font-medium" style={{ color: tone ?? 'var(--m-ink)' }}>
        {body}
      </dd>
    </div>
  );
}

/**
 * The one place the stages genuinely diverge. A roadmap agent must never carry
 * a button that looks like it opens something, so the primary action changes
 * rather than being greyed out.
 */
function StageActions({ agent }: { agent: Agent }) {
  if (agent.stage === 'live' && agent.href) {
    return (
      <>
        <CTA href={agent.href}>{OPEN_TOOLS.includes(agent.slug) ? `Open ${agent.name}` : 'Request access'}</CTA>
        <CTA href="/contact" variant="ghost" data={{ 'data-demo': '', 'data-interest': agent.name }}>
          Book a walkthrough
        </CTA>
      </>
    );
  }

  /*
   * From a roadmap page, the second action points at something that exists. With
   * one live agent that is the agent itself; with more than one it has to be the
   * roster, because picking one of them here would be an arbitrary
   * recommendation made by a `[0]`.
   */
  const [first] = LIVE_AGENTS;
  const elsewhere = LIVE_AGENTS.length === 1 ? `/tools/${first.slug}` : '/tools';

  return (
    <>
      <CTA href="/contact" data={{ 'data-demo': '', 'data-interest': agent.name }}>
        Book a walkthrough
      </CTA>
      {first && (
        <CTA href={elsewhere} variant="ghost">
          See what is live today
        </CTA>
      )}
    </>
  );
}

function StageNote({ agent, className }: { agent: Agent; className?: string }) {
  const Icon = agent.stage === 'live' ? Check : agent.stage === 'building' ? Hammer : CircleDashed;
  const tone =
    agent.stage === 'live'
      ? 'var(--m-emerald)'
      : agent.stage === 'building'
        ? 'var(--m-amber)'
        : 'var(--m-dim-2)';

  return (
    <p className={cn('m-dim-2 flex items-start gap-2.5 t-3', className)}>
      <Icon className="mt-0.5 size-3.5 shrink-0" style={{ color: tone }} aria-hidden />
      <span>{STAGE_NOTE[agent.stage]}</span>
    </p>
  );
}
