import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { AGENTS, BRAND, STAGE_LABEL } from '@/lib/marketing/content';
import {
  ACCENT,
  Aurora,
  CTA,
  Container,
  Eyebrow,
  Rise,
  Section,
  SectionHeading,
  StageBadge,
  Stat,
} from '@/components/marketing/bits';
import { Reveal } from '@/components/marketing/Reveal';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Why a chartered accountancy firm is building agents for finance teams, why the controls live in the database, and how the roster grows from one live agent to a suite.',
};

const HOW_WE_BUILD = [
  {
    title: 'One agent at a time, finished',
    body: 'A half-built agent is worse than no agent, because someone still has to do the work and now they have to check the machine as well. Voucher Desk went into daily use before the second one was started.',
  },
  {
    title: 'The rule goes in the database first',
    body: 'If a constraint cannot be expressed as a policy, a check or a function, we treat that as a sign the rule is not yet understood well enough to automate.',
  },
  {
    title: 'The existing document wins',
    body: 'We match the format the team already reconciles against, down to the column order. Adoption is mostly a question of how little has to change on day one.',
  },
  {
    title: 'Errors are quotations, not codes',
    body: 'When the database refuses something, the sentence it raises is the sentence the user reads. Translating it into a friendlier lie helps nobody at quarter end.',
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <Aurora color="var(--m-violet)" opacity={0.24} className="-top-44 -left-24 size-[38rem]" />
        <Aurora color="var(--m-cyan)" opacity={0.14} className="-top-20 right-0 size-[30rem]" />
        <div
          aria-hidden
          className="m-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(65%_55%_at_50%_0%,#000,transparent)]"
        />

        <Container wide className="relative pt-16 pb-16 sm:pt-24 sm:pb-24">
          <Rise>
            <Eyebrow>About</Eyebrow>
          </Rise>

          <Rise delay={60}>
            <h1 className="m-display mt-5 max-w-4xl text-[clamp(2.4rem,5.8vw,4.25rem)]">
              An accounting firm{' '}
              <span className="m-serif m-grad-text pr-1">building its own tools.</span>
            </h1>
          </Rise>

          <Rise delay={120}>
            <p className="m-dim mt-7 max-w-2xl text-[15px] leading-relaxed sm:text-[17px]">
              {BRAND.name} is the software arm of {BRAND.firmLong}. Everything here started as work
              the firm was doing by hand, for clients, on deadlines. The agents exist because the
              same people who were doing that work wrote down which parts of it never actually
              needed a person.
            </p>
          </Rise>
        </Container>
      </section>

      <Section>
        <Container wide>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <Reveal>
              <div className="lg:sticky lg:top-28">
                <Eyebrow>Why us</Eyebrow>
                <h2 className="m-display mt-4 text-[clamp(1.8rem,3.6vw,2.7rem)]">
                  We know which parts are rules.
                </h2>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="space-y-5 text-[15px] leading-relaxed">
                <p className="text-[var(--m-ink)]">
                  Software companies building for finance have to be told what the work is. They
                  learn it from a specification, which is written by someone who is describing a
                  process rather than performing it, and the gap between those two things is where
                  most finance software goes wrong.
                </p>
                <p className="m-dim">
                  A practice does not have that gap. It knows that the TDS section for a payment is
                  a rule and the decision to pay early is a judgement. It knows that GST splits
                  intra-state or inter-state on a fact you can look up, and that whether an expense
                  belongs to this event or the next one is a conversation. It knows that
                  reconciliation is ninety per cent matching and ten per cent asking a question.
                </p>
                <p className="m-dim">
                  Drawing that line is the whole product. Automating the rules is ordinary
                  engineering. Knowing exactly where they end, and refusing to guess past that
                  point, is the part that requires having done the work.
                </p>

                <div className="m-card mt-8 border-l-2 border-l-[var(--m-violet)] px-6 py-6">
                  <p className="m-serif text-[19px] leading-snug text-[var(--m-ink)] sm:text-[21px]">
                    An agent that is confident about a judgement call is not a better agent. It is a
                    liability with good manners.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <Reveal>
              <div className="lg:sticky lg:top-28">
                <Eyebrow>What we believe</Eyebrow>
                <h2 className="m-display mt-4 text-[clamp(1.8rem,3.6vw,2.7rem)]">
                  Controls belong in the database.
                </h2>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="space-y-5 text-[15px] leading-relaxed">
                <p className="text-[var(--m-ink)]">
                  Most systems enforce their rules in the application. The button is hidden, the
                  form is validated, the route checks a role. All of that is real work and none of
                  it survives contact with a second client, a mobile app, a background job or a
                  script somebody wrote to fix a batch of records at eleven at night.
                </p>
                <p className="m-dim">
                  So we put the rules one layer down. Who may read a voucher, who may approve it,
                  what may still be edited and what has been frozen are all decided by Postgres,
                  through row-level security and a small set of SECURITY DEFINER functions that are
                  the only way to move a record. The front end is a good interface to those rules.
                  It has never been what enforces them.
                </p>
                <p className="m-dim">
                  The test we hold ourselves to is simple: if the interface were deleted tomorrow
                  and a determined person were handed a valid token, could they approve their own
                  voucher? The answer has to be no for a reason you can read in a migration file.
                </p>
                <p className="m-dim-2 pt-1 text-[13.5px]">
                  Read the specifics on the{' '}
                  <Link
                    href="/security"
                    className="text-[var(--m-cyan)] underline underline-offset-4 transition hover:text-[var(--m-ink)]"
                  >
                    security page
                  </Link>
                  .
                </p>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <Reveal>
            {/* Four figures that are all facts about the product rather than
                claims about the business. Nothing here needs a footnote. */}
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              <Stat value="32" label="Voucher fields" hint="The firm’s existing form, preserved" />
              <Stat value="2" label="Approvals required" hint="Never the same person twice" />
              <Stat value="0" label="Ways to edit history" hint="No update policy, no delete policy" />
              <Stat value="1" label="Region" hint="Mumbai, ap-south-1" />
            </div>
          </Reveal>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <Reveal>
            <SectionHeading
              eyebrow="The roadmap"
              title="One agent that works, then the next one."
              lead="The plan is a suite that covers a finance team’s recurring month. The order is deliberate: payments first, because that is where approval and evidence matter most, and assurance last, because it reads everything the others write."
            />
          </Reveal>

          <ol className="mt-12 border-t border-[var(--m-line)]">
            {AGENTS.map((agent, i) => (
              <Reveal
                as="li"
                key={agent.slug}
                delay={i * 45}
                className="border-b border-[var(--m-line)]"
              >
                <Link
                  href={`/agents/${agent.slug}`}
                  className="group flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:gap-6"
                >
                  <span
                    className="m-mono w-8 shrink-0 text-[11px] tracking-[0.1em] tabular-nums"
                    style={{ color: ACCENT[agent.accent] }}
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="m-display block text-lg transition-colors group-hover:text-[var(--m-cyan)]">
                      {agent.name}
                    </span>
                    <span className="m-dim-2 mt-1 block text-[13px]">{agent.category}</span>
                  </span>

                  <span className="m-dim hidden max-w-md flex-1 text-[13.5px] leading-relaxed lg:block">
                    {agent.summary}
                  </span>

                  <span className="flex shrink-0 items-center gap-4">
                    <StageBadge stage={agent.stage} />
                    <ArrowRight
                      aria-hidden
                      className="m-dim-2 size-4 transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </Link>
              </Reveal>
            ))}
          </ol>

          <Reveal delay={80}>
            <p className="m-dim-2 mt-8 max-w-2xl text-[13.5px] leading-relaxed">
              {AGENTS.filter((a) => a.stage === 'live').length} of {AGENTS.length} is in production
              today. The rest are marked {STAGE_LABEL.building.toLowerCase()} or{' '}
              {STAGE_LABEL.planned.toLowerCase()}, and we would rather carry that on the site than
              have the conversation after you have signed something.
            </p>
          </Reveal>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <Reveal>
            <SectionHeading
              eyebrow="How we build"
              title="Four habits, held to."
              lead="None of these are novel. They are simply the ones we have found are expensive to break."
            />
          </Reveal>

          <ul className="mt-12 grid gap-4 sm:grid-cols-2">
            {HOW_WE_BUILD.map((item, i) => (
              <Reveal as="li" key={item.title} delay={i * 70} className="h-full">
                <div className="m-card flex h-full flex-col p-6 sm:p-7">
                  <h3 className="m-display text-lg">{item.title}</h3>
                  <p className="m-dim mt-3 text-[14px] leading-relaxed">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <Reveal>
            <div className="m-card relative overflow-hidden px-6 py-14 text-center sm:px-12 sm:py-20">
              <Aurora
                color="var(--m-indigo)"
                opacity={0.24}
                className="-top-24 left-1/2 size-[28rem] -translate-x-1/2"
              />

              <div className="relative mx-auto max-w-2xl">
                <Eyebrow>Talk to the people who built it</Eyebrow>
                <h2 className="m-display mt-4 text-[clamp(1.8rem,4vw,2.9rem)]">
                  Bring the awkward question.
                </h2>
                <p className="m-dim mt-5 text-[15px] leading-relaxed">
                  A walkthrough is with someone who has both raised the voucher and written the
                  policy that governs it. Ask about the edge case that broke your last system.
                </p>
                <div className="mt-9 flex flex-wrap justify-center gap-3">
                  <CTA href="/contact">Book a walkthrough</CTA>
                  <CTA href="/agents" variant="ghost">
                    See the agents
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
