import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, CircleDashed, Hammer } from 'lucide-react';
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
  Aurora,
  CTA,
  Container,
  Eyebrow,
  Section,
  StageBadge,
} from '@/components/marketing/bits';
import { Reveal } from '@/components/marketing/Reveal';
import { FlowDiagram } from '@/components/marketing/agents/FlowDiagram';

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return AGENTS.map((agent) => ({ slug: agent.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const agent = agentBySlug((await params).slug);
  if (!agent) return { title: 'Agent not found' };

  return { title: agent.name, description: agent.summary };
}

export default async function AgentPage({ params }: Params) {
  const agent = agentBySlug((await params).slug);
  if (!agent) notFound();

  const accent = ACCENT[agent.accent];
  const index = AGENTS.findIndex((a) => a.slug === agent.slug);
  const next = AGENTS[(index + 1) % AGENTS.length];

  return (
    <>
      <section className="relative overflow-hidden">
        {/* The agent's own colour lights its page. Six pages built from one
            template have to feel like six places, not one with the name swapped. */}
        <Aurora color={accent} opacity={0.3} className="-top-44 -left-24 size-[40rem]" />
        <Aurora color="var(--m-violet)" opacity={0.16} className="-top-24 right-0 size-[28rem]" />
        <div
          aria-hidden
          className="m-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(65%_55%_at_40%_0%,#000,transparent)]"
        />

        <Container wide className="relative pt-10 pb-16 sm:pt-14 sm:pb-24">
          <Reveal>
            <Link
              href="/agents"
              className="group m-mono m-dim-2 inline-flex items-center gap-2 text-[11px] tracking-[0.12em] uppercase transition hover:text-[var(--m-ink)]"
            >
              <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-1" aria-hidden />
              All agents
            </Link>
          </Reveal>

          <div className="mt-10 grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-16">
            <div>
              <Reveal delay={60}>
                <div className="flex flex-wrap items-center gap-3">
                  <StageBadge stage={agent.stage} />
                  <span
                    className="m-mono text-[10px] tracking-[0.14em] uppercase"
                    style={{ color: accent }}
                  >
                    {agent.category}
                  </span>
                </div>
              </Reveal>

              <Reveal delay={110}>
                <h1 className="m-display mt-6 text-[clamp(2.4rem,6vw,4.25rem)]">{agent.name}</h1>
              </Reveal>

              <Reveal delay={160}>
                <p className="m-dim mt-6 max-w-xl text-[15px] leading-relaxed sm:text-[17px]">
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

            <Reveal delay={200}>
              <figure className="m-card relative overflow-hidden p-7 sm:p-9">
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-px"
                  style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
                />
                <Eyebrow>The case for it</Eyebrow>
                <blockquote className="mt-5">
                  <p className="text-[16px] leading-relaxed text-[var(--m-ink)] sm:text-[17px]">
                    {agent.pitch}
                  </p>
                </blockquote>
                <figcaption className="m-dim-2 m-mono mt-7 border-t border-[var(--m-line)] pt-5 text-[10px] tracking-[0.12em] uppercase">
                  {agent.name} · {agent.category}
                </figcaption>
              </figure>
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
                <h2 className="m-display mt-4 text-[clamp(1.8rem,3.6vw,2.7rem)]">
                  The specifics.
                </h2>
                <p className="m-dim mt-5 max-w-sm text-sm leading-relaxed">
                  Every line here is something it either does today or is being built to do. None of
                  it is a vague area we are thinking about looking at.
                </p>
              </div>
            </Reveal>

            <ol className="border-t border-[var(--m-line)]">
              {agent.does.map((item, i) => (
                <Reveal as="li" key={item} delay={i * 55} className="border-b border-[var(--m-line)]">
                  <div className="flex gap-5 py-5">
                    <span
                      className="m-mono mt-0.5 shrink-0 text-[11px] tracking-[0.1em] tabular-nums"
                      style={{ color: accent }}
                      aria-hidden
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="text-[14.5px] leading-relaxed text-[var(--m-ink)]">{item}</p>
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
            <h2 className="m-display mt-4 text-[clamp(1.8rem,3.6vw,2.7rem)]">
              What goes in, and what you get back.
            </h2>
          </Reveal>

          <Reveal delay={70}>
            <div className="mt-8">
              <FlowDiagram agent={agent} />
            </div>
          </Reveal>

          <Reveal delay={130}>
            <p className="m-dim-2 mt-6 max-w-2xl text-[13px] leading-relaxed">
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
              <Aurora
                color={accent}
                opacity={0.22}
                className="-top-28 left-1/3 size-[26rem] -translate-x-1/2"
              />

              <div className="relative grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
                <div className="max-w-xl">
                  <h2 className="m-display text-[clamp(1.7rem,3.6vw,2.6rem)]">
                    {agent.stage === 'live'
                      ? 'It is running. Go and use it.'
                      : `Talk to us about ${agent.name}.`}
                  </h2>
                  <p className="m-dim mt-5 text-[15px] leading-relaxed">
                    {agent.stage === 'live'
                      ? 'Sign in and raise a voucher. If you would rather someone showed you round first, we are happy to do that instead.'
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
                <span className="m-display mt-3 block text-[clamp(1.5rem,3vw,2.1rem)] transition-colors group-hover:text-[var(--m-cyan)]">
                  {next.name}
                </span>
                <span className="m-dim-2 mt-2 block text-[13px]">{next.category}</span>
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
  const live = LIVE_AGENTS[0];

  if (agent.stage === 'live' && agent.href) {
    return (
      <>
        <CTA href={agent.href}>Open {agent.name}</CTA>
        <CTA href="/contact" variant="ghost">
          Book a walkthrough
        </CTA>
      </>
    );
  }

  return (
    <>
      <CTA href="/contact">Book a walkthrough</CTA>
      {live && (
        <CTA href={`/agents/${live.slug}`} variant="ghost">
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
    <p className={cn('m-dim-2 flex items-start gap-2.5 text-[13px] leading-relaxed', className)}>
      <Icon className="mt-0.5 size-3.5 shrink-0" style={{ color: tone }} aria-hidden />
      <span>{STAGE_NOTE[agent.stage]}</span>
    </p>
  );
}
