import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { AGENTS, STAGE_LABEL, type Agent, type AgentStage } from '@/lib/marketing/content';
import {
  ACCENT,
  Aurora,
  CTA,
  Container,
  Eyebrow,
  Rise,
  Section,
  StageBadge,
} from '@/components/marketing/bits';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { Reveal } from '@/components/marketing/Reveal';
import { Spotlight } from '@/components/marketing/motion';
import { RoadmapRail } from '@/components/marketing/agents/RoadmapRail';
import { Roost } from '@/components/brand/Owl';

export const metadata: Metadata = {
  title: 'Agents',
  description:
    'Tools for finance teams: payments and approvals, closing the books, GST, TDS, reading '
    + 'invoices and answering audit questions. Every one says whether you can use it today.',
  alternates: { canonical: '/agents' },
};

/**
 * Stage order is the reading order: what you can have, what is being built,
 * what is written down. Each group carries a line of its own, because a bare
 * "on the roadmap" lets the reader assume either the best or the worst.
 */
const TRAIL = [
  { label: 'Home', href: '/' },
  { label: 'Agents', href: '/agents' },
] as const;

const GROUPS: { stage: AgentStage; lead: string }[] = [
  {
    stage: 'live',
    lead: 'Up and running, with the rules held in the database rather than in the screens. Sign in and you can raise a voucher or reconcile two ledgers today.',
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
        <Aurora color="var(--m-indigo)" opacity={0.16} className="-top-48 -left-28 size-[42rem]" />
        <Aurora color="var(--m-gold)" opacity={0.05} className="-top-16 right-0 size-[28rem]" />
        <div
          aria-hidden
          className="m-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(65%_55%_at_50%_0%,#000,transparent)]"
        />

        <Roost seed="agents-roost" band="top-right" />

        <Container wide className="relative pt-16 pb-14 sm:pt-24 sm:pb-20">
          <Rise>
            <Breadcrumbs trail={TRAIL} className="mb-7" />
          </Rise>

          <Rise>
            <Eyebrow>The roster</Eyebrow>
          </Rise>

          <Rise delay={60}>
            <h1 className="m-display mt-5 max-w-4xl t-h1">
              Tools for the work that{' '}
              <span className="m-serif m-grad-text pr-1">follows rules.</span>
            </h1>
          </Rise>

          <Rise delay={120}>
            <p className="m-dim mt-7 max-w-2xl t-4 sm:t-5">
              Payments and approvals, closing the books, GST, TDS, reading invoices, and answering
              questions about the record. Each one takes a job your team already does by hand, does
              the mechanical part of it, and then puts the decision in front of a person.
            </p>
          </Rise>
        </Container>
      </section>

      {/* The order they are being built in — which is the question five unbuilt
          tiles actually raise, and one the grouped grid below cannot answer. */}
      <RoadmapRail />

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
              <Aurora
                color="var(--m-indigo)"
                opacity={0.14}
                className="-top-24 left-1/2 size-[28rem] -translate-x-1/2"
              />

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
                  <CTA href="/contact" data={{ 'data-demo': '', 'data-interest': 'Agent index' }}>
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
      {/* Spotlight owns the card surface so the pointer-tracked light can sit
          above the background and below the link's content. */}
      <Spotlight color={accent} className="m-card m-card-lift h-full overflow-hidden rounded-2xl">
        <Link href={`/agents/${agent.slug}`} className="group relative flex h-full flex-col p-6">
          {/* The agent's colour, stated once at the top edge, so six cards in a
              grid are told apart before any of them is read. */}
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px opacity-70 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
          />
          <span
            aria-hidden
            className="absolute -top-20 left-1/2 size-40 -translate-x-1/2 rounded-full opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-30"
            style={{ background: accent }}
          />

          <div className="relative flex items-start justify-between gap-3">
            <StageBadge stage={agent.stage} />
            <ArrowUpRight
              aria-hidden
              className="m-dim-2 size-4 shrink-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--m-ink)]"
            />
          </div>

          <h3 className="m-display relative mt-5 t-6">{agent.name}</h3>
          <p
            className="m-mono relative mt-2 t-1 t-caps uppercase"
            style={{ color: accent }}
          >
            {agent.category}
          </p>

          <p className="m-dim relative mt-4 t-3">{agent.summary}</p>

          <div className="relative mt-auto flex items-center gap-2 border-t border-[var(--m-line)] pt-4 t-1 t-caps uppercase">
            <span className="m-mono m-dim-2 min-w-0 flex-1 truncate">{agent.inputs}</span>
            <ArrowRight className="m-dim-2 size-3 shrink-0" aria-hidden />
            <span className="m-mono m-dim min-w-0 flex-1 truncate text-right">{agent.outputs}</span>
          </div>
        </Link>
      </Spotlight>
    </Reveal>
  );
}
