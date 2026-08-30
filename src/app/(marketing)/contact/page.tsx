import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND, CONTACT } from '@/lib/marketing/content';
import { Aurora, Container, Eyebrow, Rise, Section } from '@/components/marketing/bits';
import { Reveal } from '@/components/marketing/Reveal';
import { RequestForm } from '@/components/marketing/RequestForm';

export const metadata: Metadata = {
  title: 'Book a walkthrough',
  description:
    'Thirty minutes with the people who built it. Tell us which agent interests you and what your month currently looks like.',
};

/**
 * There is a handler behind this page now.
 *
 * It used to compose a mailto: and say so, which was the right thing to do while
 * nothing was listening: a form that silently does nothing is worse than no
 * form, and a fake success message is worse than both. Migration 0023 gave it
 * somewhere to go, so the request is recorded, searchable, and visible on an
 * internal screen where somebody can see whether it has been answered. Writing
 * to the address directly is still offered beside the button, because a person
 * whose submission fails should not be left with nowhere to go.
 */

const NEXT_STEPS = [
  'A person writes back within one working day. Not a ticket number.',
  'Half an hour on a shared screen, using the tool that is actually running.',
  'Bring the case that broke your last system. We will answer it, or say we cannot.',
  'Nothing to pay for a trial, and nothing to install before the call.',
];

export default function ContactPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <Aurora color="var(--m-indigo)" opacity={0.16} className="-top-48 -left-28 size-[42rem]" />
        <Aurora color="var(--m-gold)" opacity={0.05} className="-top-16 right-0 size-[28rem]" />
        <div
          aria-hidden
          className="m-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(65%_55%_at_50%_0%,#000,transparent)]"
        />

        <Container wide className="relative pt-16 pb-14 sm:pt-24 sm:pb-16">
          <Rise>
            <Eyebrow>Contact</Eyebrow>
          </Rise>

          <Rise delay={60}>
            <h1 className="m-display mt-5 max-w-3xl text-[clamp(2.4rem,5.8vw,4.25rem)]">
              Book a <span className="m-serif m-grad-text pr-1">walkthrough.</span>
            </h1>
          </Rise>

          <Rise delay={120}>
            <p className="m-dim mt-7 max-w-2xl text-[15px] leading-relaxed sm:text-[17px]">
              Half an hour with the people who built it, using the tool that is actually running.
              Tell us which part of your month is the worst and we will show you whether we have
              anything for it yet.
            </p>
          </Rise>
        </Container>
      </section>

      <Section divider={false} className="pt-4 sm:pt-6">
        <Container wide>
          <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-14">
            <Reveal>
              <RequestForm />
            </Reveal>

            <div className="space-y-4">
              <Reveal delay={80}>
                <div className="m-card p-6 sm:p-7">
                  <h2 className="m-eyebrow">What happens next</h2>
                  <ol className="mt-5 space-y-4">
                    {NEXT_STEPS.map((step, i) => (
                      <li key={step} className="flex gap-3.5">
                        <span
                          className="m-mono mt-0.5 shrink-0 text-[11px] tracking-[0.1em] text-[var(--m-cyan)] tabular-nums"
                          aria-hidden
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <p className="m-dim text-[13.5px] leading-relaxed">{step}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </Reveal>

              <Reveal delay={140}>
                <div className="m-card p-6 sm:p-7">
                  <h2 className="m-eyebrow">Already using it</h2>
                  <p className="m-dim mt-4 text-[13.5px] leading-relaxed">
                    If your firm is already on {BRAND.name} you do not need a call. Sign in, or ask
                    whoever set your organisation up to send you an invite link. Following one puts
                    you straight into their workspace with the role they chose for you.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/login"
                      className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--m-line-2)] px-5 text-sm font-semibold transition hover:border-[var(--m-ink)] hover:bg-white/5 sm:flex-1"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/signup"
                      className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--m-line)] px-5 text-sm font-semibold transition hover:border-[var(--m-line-2)] hover:bg-white/5 sm:flex-1"
                    >
                      Create an account
                    </Link>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={200}>
                <div className="m-card p-6 sm:p-7">
                  <h2 className="m-eyebrow">Elsewhere</h2>
                  <dl className="mt-5 space-y-4 text-[13.5px]">
                    <div>
                      <dt className="m-dim-2">Built by</dt>
                      <dd className="mt-1">Chartered accountants, in Mumbai</dd>
                    </div>
                    <div>
                      <dt className="m-dim-2">Security reports</dt>
                      <dd className="mt-1">
                        <a
                          href={`mailto:${CONTACT.security}`}
                          className="m-mono text-[13px] text-[var(--m-cyan)] underline underline-offset-4 transition hover:text-[var(--m-ink)]"
                        >
                          {CONTACT.security}
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt className="m-dim-2">Hosting</dt>
                      <dd className="mt-1">Mumbai · ap-south-1</dd>
                    </div>
                  </dl>
                </div>
              </Reveal>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
