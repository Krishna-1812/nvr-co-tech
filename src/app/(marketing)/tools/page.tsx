import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { AGENTS, OPEN_NAMES, STAGE_LABEL, type Agent, type AgentStage } from '@/lib/marketing/content';
import {
  ACCENT,
  ArchScene,
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
import { Reveal } from '@/components/marketing/Reveal';
import { Spotlight, Tilt } from '@/components/marketing/motion';
import { Roost } from '@/components/brand/Owl';

export const metadata: Metadata = {
  title: 'Tools',
  description:
    'Every tool in one place: what each one does, and whether you can use it today.',
  alternates: { canonical: '/tools' },
};

/**
 * Stage order is the reading order: what you can have, what is being built,
 * what is written down. Each group carries a line of its own, because a bare
 * "on the roadmap" lets the reader assume either the best or the worst.
 */
const TRAIL = [
  { label: 'Home', href: '/' },
  { label: 'Tools', href: '/tools' },
] as const;

const GROUPS: { stage: AgentStage; lead: string }[] = [
  {
    stage: 'live',
    lead: `Up and running. ${OPEN_NAMES} open to anybody, with no account; the others are opened on request.`,
  },
  {
    stage: 'building',
    lead: 'Being built now, ahead of a first trial. Not something you can switch on yet.',
  },
  {
    stage: 'planned',
    lead: 'Written up and in the queue. Listed here so you can hold us to the order rather than the ambition.',
  },
];

export default function AgentsPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <ArchScene motif="doorways" />

        <Roost seed="agents-roost" band="top-right" />

        <Container wide className="relative pt-16 pb-14 sm:pt-24 sm:pb-20 lg:pr-[25rem] xl:pr-[28rem]">
          <Rise>
            <Breadcrumbs trail={TRAIL} className="mb-7" />
          </Rise>

          <Rise>
            <Eyebrow>All tools</Eyebrow>
          </Rise>

          <Rise delay={60}>
            <h1 className="m-display mt-5 max-w-4xl t-h1">
              Every tool,{' '}
              <span className="m-serif m-grad-text pr-1">in one place.</span>
            </h1>
          </Rise>

          {/*
            Generic on purpose (17 Oct, at the owner's request): it used to list
            the jobs one by one, which dated the page every time a tool was
            added and read as a feature list before the reader had seen a tool.
            The cards below say what each one does.
          */}
          <Rise delay={120}>
            <p className="m-dim mt-7 max-w-2xl t-4 sm:t-5">
              Each one takes a routine part of the work off your desk, does the repetitive part, and
              leaves the decision with you. Pick one to see what it does.
            </p>
          </Rise>
        </Container>
      </section>

      {/* A "shipping order" rail of all nine, in build order, sat here until
          17 Oct; the owner asked for it to go. The grouped grid below already
          says which are live and which are on the roadmap. */}

      {GROUPS.map(({ stage, lead }) => {
        const agents = AGENTS.filter((a) => a.stage === stage);
        if (agents.length === 0) return null;

        return (
          <Section key={stage}>
            <Container wide>
              <Reveal>
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                  <h2 className="m-display t-h4">
                    {STAGE_LABEL[stage]}
                  </h2>
                  <StageBadge stage={stage} />
                </div>
                <p className="m-dim mt-3 max-w-xl t-3">{lead}</p>
              </Reveal>

              <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent, i) => (
                  <AgentCard key={agent.slug} agent={agent} delay={i * 70} />
                ))}
              </ul>
            </Container>
          </Section>
        );
      })}

      <Section>
        <Container wide>
          <Reveal>
            <div className="m-card relative overflow-hidden px-6 py-14 text-center sm:px-12 sm:py-20">

              <div className="relative mx-auto max-w-2xl">
                <Eyebrow>Where to start</Eyebrow>
                <h2 className="m-display mt-4 t-h2">
                  One of these is already costing you a day a month.
                </h2>
                <p className="m-dim mt-5 t-4">
                  Tell us which job is the worst one and we will show you the tool that covers it. If
                  it is not built yet, we will say so, and tell you when it should be.
                </p>
                <div className="mt-9 flex flex-wrap justify-center gap-3">
                  <CTA href="/contact" data={{ 'data-demo': '', 'data-interest': 'Tool index' }}>
                    Book a walkthrough
                  </CTA>
                  <CTA href="/about" variant="ghost">
                    How we build it
                  </CTA>
                </div>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>
    </>
  );
}

function AgentCard({ agent, delay }: { agent: Agent; delay: number }) {
  const accent = ACCENT[agent.accent];

  return (
    <Reveal as="li" delay={delay} className="h-full">
      {/* Tilt leans the whole card a few degrees towards the pointer, so the
          grid reads as objects on a table rather than boxes on a page.
          Spotlight owns the card surface so the pointer-tracked light can sit
          above the background and below the link's content. */}
      <Tilt className="h-full" max={4}>
        <Spotlight color={accent} className="m-card m-card-lift h-full overflow-hidden rounded-2xl">
          <Link href={`/tools/${agent.slug}`} className="group relative flex h-full flex-col p-6">
            {/*
              A live tool gets a window onto the scene its own screen opens on,
              so the roster shows each working tool as the thing you will meet
              after signing in rather than as a line of copy. Roadmap tools keep
              the plain doorway: there is no screen yet for a picture to promise.
            */}
            {agent.stage === 'live' && (
              <div
                aria-hidden
                className="relative -mx-2 -mt-2 mb-6 flex h-48 items-end justify-center overflow-hidden rounded-2xl"
                style={{ background: `color-mix(in oklab, ${accent} 14%, var(--m-bg))` }}
              >
                <div
                  className="m-arch relative p-2 transition-transform duration-500 group-hover:-translate-y-1"
                  style={{ background: accent }}
                >
                  <SceneArch motif={motifFor(agent.slug)} sun={false} className="h-[9.5rem] min-h-0 w-[8rem]" />
                </div>
              </div>
            )}

            <div className="relative flex items-start justify-between gap-3">
              {/*
                The agent's own doorway, in its colour, with the sun inside it.
                It is how eight cards in a grid are told apart before any of them
                is read, and the same doorway the tool's own page opens with.
                The sun climbs a little on hover.
              */}
              {agent.stage === 'live' ? (
                // The window above already carries the doorway; the name leads.
                <h3 className="m-display t-6">{agent.name}</h3>
              ) : (
                <span
                  aria-hidden
                  className="m-arch relative h-14 w-11 shrink-0 overflow-hidden"
                  style={{ background: accent }}
                >
                  <span className="absolute bottom-0 left-1/2 size-7 -translate-x-1/2 translate-y-1/3 rounded-full bg-[var(--m-sun)] transition-transform duration-500 group-hover:translate-y-0" />
                </span>
              )}
              <span className="flex items-center gap-3">
                <StageBadge stage={agent.stage} />
                <ArrowUpRight
                  aria-hidden
                  className="m-dim-2 size-4 shrink-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--m-ink)]"
                />
              </span>
            </div>

            {agent.stage !== 'live' && (
              <h3 className="m-display relative mt-5 t-6">{agent.name}</h3>
            )}
            {/* Olive rather than the agent's colour: two of the eight earth hues
                (sun and sage) are too light to set small type in. */}
            <p className="m-mono relative mt-2 t-1 t-caps text-[var(--m-olive)] uppercase">
              {agent.category}
            </p>

            <p className="m-dim relative mt-4 mb-6 t-3">{agent.summary}</p>

            {/* What goes in, then what comes out. These were truncated to one line
                each, which on a phone left a third of a sentence ("INSTALMENT
                DATES AND…"); they wrap now, stacked on a phone and side by side
                from sm up. */}
            <div className="relative mt-auto flex flex-col gap-1.5 border-t border-[var(--m-line)] pt-4 t-1 t-caps leading-snug uppercase sm:flex-row sm:items-start sm:gap-2">
              <span className="m-mono m-dim-2 min-w-0 flex-1">{agent.inputs}</span>
              <ArrowRight className="m-dim-2 mt-0.5 size-3 shrink-0 max-sm:rotate-90" aria-hidden />
              <span className="m-mono m-dim min-w-0 flex-1 sm:text-right">{agent.outputs}</span>
            </div>
          </Link>
        </Spotlight>
      </Tilt>
    </Reveal>
  );
}
