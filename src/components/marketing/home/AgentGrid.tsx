import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AGENTS } from '@/lib/marketing/content';
import { ACCENT, ArrowLink, Container, Section, SectionHeading, StageBadge } from '../bits';
import { Spotlight } from '../motion';
import { Reveal } from '../Reveal';

/**
 * The roster.
 *
 * One agent is live and five are not, and the cards say so. The alternative —
 * six identical tiles implying six shipped products — buys a click and loses the
 * relationship on the next page, which is a bad trade with an audience that is
 * professionally suspicious.
 *
 * Each card carries its own accent and its own pointer-tracked light, so the
 * grid reads as six things rather than one thing repeated. That is also why the
 * accents span the full palette including lime and magenta: six hues inside a
 * 120° arc all look like "the purple one" from across a room.
 */
export function AgentGrid() {
  return (
    <Section id="agents">
      <Container wide>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="The agents"
            title={
              <>
                Six jobs off your desk.
                <br />
                <span className="m-serif m-dim">One is live. Five are coming.</span>
              </>
            }
            lead="Each one takes a job your team already does every month and carries it from the document arriving to the record closing. What goes in and what comes out is on every card, so you can tell straight away which one is worth a conversation."
            className="max-w-2xl"
          />
          <ArrowLink href="/agents" className="mb-2">
            All agents
          </ArrowLink>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((agent, i) => (
            <Reveal key={agent.slug} delay={(i % 3) * 70}>
              <Spotlight
                color={ACCENT[agent.accent]}
                className="m-card m-card-lift h-full overflow-hidden rounded-2xl"
              >
                <Link
                  href={`/agents/${agent.slug}`}
                  data-name={agent.name}
                  className="group relative flex h-full flex-col p-6"
                >
                  {/* Accent bloom in the corner, behind the content. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
                    style={{ background: ACCENT[agent.accent] }}
                  />

                  <div className="relative flex items-start justify-between gap-3">
                    <span
                      aria-hidden
                      className="mt-1 block h-6 w-1 rounded-full"
                      style={{ background: ACCENT[agent.accent] }}
                    />
                    <StageBadge stage={agent.stage} className="ml-auto" />
                  </div>

                  <h3 className="relative mt-5 text-[17px] font-semibold tracking-tight">
                    {agent.name}
                  </h3>
                  <p className="m-eyebrow relative mt-1.5">{agent.category}</p>

                  <p className="m-dim relative mt-4 flex-1 text-[13px] leading-relaxed">
                    {agent.summary}
                  </p>

                  {/* What goes in and what comes out, so six cards read as six
                      different jobs rather than six paragraphs of pitch. */}
                  <dl className="relative mt-5 space-y-2 border-t border-[var(--m-line)] pt-4">
                    <Flow label="In" value={agent.inputs} />
                    <Flow label="Out" value={agent.outputs} accent={ACCENT[agent.accent]} />
                  </dl>

                  <span
                    className="m-mono relative mt-6 inline-flex items-center gap-1.5 text-[10px] tracking-[0.14em] uppercase transition-colors"
                    style={{ color: 'inherit' }}
                  >
                    <span className="transition-colors group-hover:text-[var(--m-ink)]">
                      Explore
                    </span>
                    <ArrowRight
                      className="size-3 transition-transform group-hover:translate-x-1"
                      aria-hidden
                    />
                  </span>
                </Link>
              </Spotlight>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/** One side of an agent's job: what it is given, or what it hands back. */
function Flow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex gap-3">
      <dt
        className="m-mono w-7 shrink-0 pt-px text-[9px] tracking-[0.12em] uppercase"
        style={{ color: accent ?? 'var(--m-dim-2)' }}
      >
        {label}
      </dt>
      <dd className="m-dim-2 min-w-0 text-[11.5px] leading-relaxed">{value}</dd>
    </div>
  );
}
