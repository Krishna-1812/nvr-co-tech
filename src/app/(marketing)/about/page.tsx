import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { AGENTS, BRAND, ROSTER, STAGE_LABEL } from '@/lib/marketing/content';
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
import { Roost } from '@/components/brand/Owl';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Why a team of chartered accountants is building software for finance teams, why the rules sit in the database, and how we go from one working tool to several.',
};

const HOW_WE_BUILD = [
  {
    title: 'One thing at a time, and finish it',
    body: 'A half-built tool is worse than none, because somebody still has to do the work and now they have to check the software as well. Voucher Desk was deployed and being used before we started on the second one.',
  },
  {
    title: 'The rule goes into the database first',
    body: 'If we cannot write a rule down as code the database will enforce, we take that as a sign we do not understand the rule well enough yet to automate it.',
  },
  {
    title: 'Your existing paperwork wins',
    body: 'We match the format your team already works from, right down to the order of the columns. Whether people actually use a new tool comes down to how little has to change on the first day.',
  },
  {
    title: 'You see the real error message',
    body: 'When the database refuses something, the sentence it gives back is the sentence you read. Turning it into something friendlier but vaguer helps nobody at the end of a quarter.',
  },
];

/**
 * The stages that actually have an agent in them, in words.
 *
 * "in build or on the roadmap" was written when something was in build. A stage
 * with nothing in it reads to a buyer as a gap in the plan rather than as a
 * label nobody happens to need this month.
 */
const STAGES_IN_WAITING = [
  ...new Set(
    AGENTS.filter((a) => a.stage !== 'live').map((a) => STAGE_LABEL[a.stage].toLowerCase()),
  ),
].join(' or ');

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <Aurora color="var(--m-indigo)" opacity={0.16} className="-top-48 -left-28 size-[42rem]" />
        <Aurora color="var(--m-gold)" opacity={0.05} className="-top-16 right-0 size-[28rem]" />
        <div
          aria-hidden
          className="m-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(65%_55%_at_50%_0%,#000,transparent)]"
        />

        <Roost seed="about-attic" band="top-right" />

        <Container wide className="relative pt-16 pb-16 sm:pt-24 sm:pb-24">
          <Rise>
            <Eyebrow>About</Eyebrow>
          </Rise>

          <Rise delay={60}>
            <h1 className="m-display mt-5 max-w-4xl text-[clamp(2.4rem,5.8vw,4.25rem)]">
              Accountants{' '}
              <span className="m-serif m-grad-text pr-1">building their own tools.</span>
            </h1>
          </Rise>

          <Rise delay={120}>
            <p className="m-dim mt-7 max-w-2xl text-[15px] leading-relaxed sm:text-[17px]">
              {BRAND.name} is built by chartered accountants. Everything here started out as work we
              were doing by hand, for clients, against deadlines. These tools exist because the
              people doing that work sat down and wrote out which parts of it never really needed a
              person.
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
                  A software company building for finance has to be told what the work is. They pick
                  it up from a written spec, and that spec was put together by somebody describing
                  the job rather than doing it. The gap between those two things is where most
                  finance software goes wrong.
                </p>
                <p className="m-dim">
                  A practice does not have that gap. We know the TDS section on a payment is a rule,
                  and the decision to pay early is a judgement. We know GST splits one way or the
                  other on a fact you can look up, and that whether a cost belongs to this event or
                  the next one is a conversation. We know a reconciliation is mostly matching, with a
                  handful of lines that need someone to ask a question.
                </p>
                <p className="m-dim">
                  Knowing where that line falls is the whole product. Automating a rule is normal
                  engineering work. Knowing exactly where the rules stop, and not guessing past that
                  point, is the part you only get from having done the job.
                </p>

                <div className="m-card mt-8 border-l-2 border-l-[var(--m-violet)] px-6 py-6">
                  <p className="m-serif text-[19px] leading-snug text-[var(--m-ink)] sm:text-[21px]">
                    Software that sounds confident about a judgement call is not better software. It
                    is a problem with good manners.
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
                  Rules belong in the database.
                </h2>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="space-y-5 text-[15px] leading-relaxed">
                <p className="text-[var(--m-ink)]">
                  Most systems keep their rules in the app. The button is hidden, the form checks
                  itself, the page checks your role. That is all real work, and none of it survives a
                  second app, a phone, a scheduled job, or a script somebody wrote at eleven at night
                  to fix a batch of records.
                </p>
                <p className="m-dim">
                  So we moved the rules a layer down. Who can read a voucher, who can approve it,
                  what can still be edited and what is locked are all decided by the database itself.
                  A small set of database functions is the only way to move a record along. The
                  website is a nice way to use those rules. It has never been the thing enforcing
                  them.
                </p>
                <p className="m-dim">
                  The test we hold ourselves to is a simple one. If you deleted the website tomorrow
                  and handed a determined person a valid login, could they approve their own voucher?
                  The answer has to be no, for a reason you can go and read in our code.
                </p>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <Reveal>
            {/*
              Four figures that are all facts about the product rather than
              claims about the business.

              The second one said 2 for months after the schema went down to a
              single signature, which is the trouble with a stats band: a figure
              in 3rem type is the most quotable thing on a page and the least
              likely thing on it to be revisited. Each of these four now has a
              line of SQL behind it — 32 columns in export/columns.ts, one
              signature in submit_voucher, no UPDATE grant at all on the audit
              table, and one region in vercel.json.
            */}
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              <Stat value="32" label="Voucher fields" hint="Every one from the form you already use" />
              <Stat value="1" label="Signature to approve" hint="And never the person who raised it" />
              <Stat value="0" label="Ways to edit the history" hint="Not for any role, at any level" />
              <Stat value="1" label="Place your data sits" hint="Mumbai, ap-south-1" />
            </div>
          </Reveal>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <Reveal>
            <SectionHeading
              eyebrow="The roadmap"
              title="One that works, then the next one."
              lead="The plan is a set of tools that covers the jobs your team does every month. The order is on purpose. Payments come first, because that is where approvals and proof matter most. The audit tool comes last, because it reads everything the others write."
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
              {/*
                Both halves are counted rather than written down. The verb has to
                agree as the roster ships, and the stage names have to be the ones
                somebody is actually standing on: this sentence promised the rest
                were marked "in build or on the roadmap" while nothing at all was
                in build, which is the same empty-stage claim the roster page was
                making in its own hero.
              */}
              {ROSTER.liveOpen} of {ROSTER.totalWord} {ROSTER.liveVerb} up and running today. The
              rest {ROSTER.comingVerb} marked {STAGES_IN_WAITING}. We would rather say that here
              than have the conversation after you have signed something.
            </p>
          </Reveal>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <Reveal>
            <SectionHeading
              eyebrow="How we build"
              title="Four habits we stick to."
              lead="None of these are clever. They are just the ones we have found are expensive to break."
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
                opacity={0.14}
                className="-top-24 left-1/2 size-[28rem] -translate-x-1/2"
              />

              <div className="relative mx-auto max-w-2xl">
                <Eyebrow>Talk to the people who built it</Eyebrow>
                <h2 className="m-display mt-4 text-[clamp(1.8rem,4vw,2.9rem)]">
                  Bring the awkward question.
                </h2>
                <p className="m-dim mt-5 text-[15px] leading-relaxed">
                  You will be talking to someone who has both raised the voucher and written the rule
                  that governs it. Ask us about the odd case that broke your last system.
                </p>
                <div className="mt-9 flex flex-wrap justify-center gap-3">
                  <CTA href="/contact" data={{ 'data-demo': '', 'data-interest': 'About' }}>
                    Book a walkthrough
                  </CTA>
                  <CTA href="/agents" variant="ghost">
                    See what we build
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
