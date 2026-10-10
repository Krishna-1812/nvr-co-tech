import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowRight, Check, CircleDashed, Hammer } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AGENTS,
  LIVE_AGENTS,
  STAGE_NOTE,
  agentBySlug,
  type Agent,
} from '@/lib/marketing/content';
import {
  ACCENT,
  ACCENT_TEXT,
  Container,
  CTA,
  Eyebrow,
  Section,
  StageBadge,
} from '@/components/marketing/bits';
import { serviceLd } from '@/lib/marketing/seo';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { JsonLd } from '@/components/marketing/JsonLd';
import { Reveal } from '@/components/marketing/Reveal';
import { FlowDiagram } from '@/components/marketing/agents/FlowDiagram';
import { Roost } from '@/components/brand/Owl';

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return AGENTS.map((agent) => ({ slug: agent.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const agent = agentBySlug((await params).slug);
  if (!agent) return { title: 'Agent not found' };

  return {
    title: agent.name,
    description: agent.summary,
    alternates: { canonical: `/agents/${agent.slug}` },
  };
}

export default async function AgentPage({ params }: Params) {
  const agent = agentBySlug((await params).slug);
  if (!agent) notFound();

  const accent = ACCENT[agent.accent];
  const index = AGENTS.findIndex((a) => a.slug === agent.slug);
  const next = AGENTS[(index + 1) % AGENTS.length];

  const trail = [
    { label: 'Home', href: '/' },
    { label: 'Agents', href: '/agents' },
    { label: agent.name, href: `/agents/${agent.slug}` },
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

        <Container wide className="relative pt-10 pb-16 sm:pt-14 sm:pb-24">
          {/* This used to be a lone "All agents" link, which told you one way
              out but not where you were standing. The trail says both, and it is
              the same array the BreadcrumbList is built from. */}
          <Reveal>
            <Breadcrumbs trail={trail} />
          </Reveal>

          <div className="mt-10 grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-16">
            <div>
              <Reveal delay={60}>
                <div className="flex flex-wrap items-center gap-3">
                  <StageBadge stage={agent.stage} />
                  <span className="m-mono t-1 t-caps text-[var(--m-olive)] uppercase">
                    {agent.category}
                  </span>
                </div>
              </Reveal>

              <Reveal delay={110}>
                <h1 className="m-display mt-6 t-h1">{agent.name}</h1>
              </Reveal>

              <Reveal delay={160}>
                <p className="m-dim mt-6 max-w-xl t-4 sm:t-5">
                  {agent.summary}
                </p>
              </Reveal>

              <Reveal delay={210}>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <StageActions agent={agent} />
                </div>
              </Reveal>

              <Reveal delay={260}>
                <StageNote agent={agent} className="mt-8 max-w-lg" />
              </Reveal>
            </div>

            {/*
              The case for it, standing in the agent's own doorway.

              The same window as the home page's hero, walled in this agent's
              colour, so eight pages built from one template open on eight
              different arches rather than one page with the name swapped. The
              sun comes up behind the card; the card is what the door opens on.
            */}
            <Reveal delay={200}>
              <div
                className="m-arch m-arch-open relative overflow-hidden px-4 pt-40 pb-5 sm:px-7 sm:pt-48 sm:pb-8"
                style={{ background: accent }}
              >
                {/* Sun on a sun-coloured wall is one value against itself, so
                    the one agent walled in sun gets a terracotta disc. */}
                <span
                  aria-hidden
                  className="m-sun absolute top-12 left-1/2 size-36 -translate-x-1/2 sm:size-44"
                  style={agent.accent === 'amber' ? { background: 'var(--m-gold)' } : undefined}
                />
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-32 bg-[var(--m-bg-3)]"
                  style={{ borderRadius: '60% 40% 0 0 / 30% 25% 0 0' }}
                />
                <figure className="m-card relative p-7 shadow-[var(--m-shadow)] sm:p-9">
                  <Eyebrow>The case for it</Eyebrow>
                  <blockquote className="mt-5">
                    <p className="t-4 text-[var(--m-ink)] sm:t-5">
                      {agent.pitch}
                    </p>
                  </blockquote>
                  <figcaption className="m-dim-2 m-mono mt-7 border-t border-[var(--m-line)] pt-5 t-1 t-caps uppercase">
                    {agent.name} · {agent.category}
                  </figcaption>
                </figure>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      <Section>
        <Container wide>
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.4fr] lg:gap-16">
            <Reveal>
              <div className="lg:sticky lg:top-28">
                <Eyebrow>What it does</Eyebrow>
                <h2 className="m-display mt-4 t-h3">
                  The specifics.
                </h2>
                {/* A live agent's list is a description, not a plan, and saying
                    so is the point of writing these down to this level. */}
                <p className="m-dim mt-5 max-w-sm t-3">
                  {agent.stage === 'live'
                    ? 'Every line here is something it does today. If it were only planned, it would be on a page marked as planned.'
                    : 'Every line here is something it is being built to do. None of it is a vague area we are thinking about looking at.'}
                </p>
              </div>
            </Reveal>

            <ol className="border-t border-[var(--m-line)]">
              {agent.does.map((item, i) => (
                <Reveal as="li" key={item} delay={i * 55} className="border-b border-[var(--m-line)]">
                  <div className="flex gap-5 py-5">
                    <span
                      className="m-mono mt-0.5 shrink-0 t-2 t-caps tabular-nums"
                      style={{ color: ACCENT_TEXT[agent.accent] }}
                      aria-hidden
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="t-3 text-[var(--m-ink)]">{item}</p>
                  </div>
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
            <h2 className="m-display mt-4 t-h3">
              What goes in, and what you get back.
            </h2>
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

      <Section>
        <Container wide>
          <Reveal>
            <div className="m-card relative overflow-hidden px-6 py-14 sm:px-12 sm:py-18">

              <div className="relative grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
                <div className="max-w-xl">
                  <h2 className="m-display t-h3">
                    {agent.stage === 'live'
                      ? 'It is running. Go and use it.'
                      : `Talk to us about ${agent.name}.`}
                  </h2>
                  <p className="m-dim mt-5 t-4">
                    {agent.stage === 'live'
                      ? 'Sign in and it is there. If you would rather somebody showed you round first, we are happy to do that instead.'
                      : 'A walkthrough covers what you can use today, what this one will do, and where it sits in the queue. We will not give you a date on the call that we are not sure of.'}
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <StageActions agent={agent} />
                  </div>
                </div>

                <div className="lg:justify-self-end">
                  <StageNote agent={agent} className="max-w-sm" />
                </div>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <Reveal>
            <Link
              href={`/agents/${next.slug}`}
              className="group flex flex-col gap-4 border-t border-[var(--m-line)] pt-8 sm:flex-row sm:items-end sm:justify-between"
            >
              <span>
                <span className="m-eyebrow block">Next agent</span>
                <span className="m-display mt-3 block t-h4 transition-colors group-hover:text-[var(--m-cyan)]">
                  {next.name}
                </span>
                <span className="m-dim-2 mt-2 block t-3">{next.category}</span>
              </span>
              <ArrowRight
                aria-hidden
                className="m-dim-2 size-6 transition-transform group-hover:translate-x-1.5"
              />
            </Link>
          </Reveal>
        </Container>
      </Section>
    </>
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
        <CTA href={agent.href}>Open {agent.name}</CTA>
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
  const elsewhere = LIVE_AGENTS.length === 1 ? `/agents/${first.slug}` : '/agents';

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
