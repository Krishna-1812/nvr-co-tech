import Link from 'next/link';
import { LogIn, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { MotionTitle } from '@/components/marketing/rich/MotionTitle';
import { StepRail } from '@/components/marketing/rich/StepRail';
import { JsonLd } from '@/components/marketing/JsonLd';
import { pageMeta, profilePageLd } from '@/lib/marketing/seo';
import { CONTACT, WALKTHROUGH_STEPS } from '@/lib/marketing/content';
import { ArchScene, Container, Eyebrow, Rise, Section, SectionHeading } from '@/components/marketing/bits';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { Reveal } from '@/components/marketing/Reveal';
import { RequestForm } from '@/components/marketing/RequestForm';
import { Roost } from '@/components/brand/Owl';

const DESCRIPTION =
  'Thirty minutes with the people who built it. Tell us which tool interests you and what your month currently looks like.';

export const metadata: Metadata = pageMeta({ title: 'Book a walkthrough', description: DESCRIPTION, path: '/contact' });

const TRAIL = [
  { label: 'Home', href: '/' },
  { label: 'Book a walkthrough', href: '/contact' },
] as const;

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

export default function ContactPage() {
  return (
    <>
      <JsonLd data={profilePageLd({ type: 'ContactPage', path: '/contact', name: 'Book a walkthrough', description: DESCRIPTION })} />
      <section className="relative overflow-hidden">
        <ArchScene motif="sundial" />

        <Roost seed="contact-sill" band="top-right" />

        <Container wide className="relative pt-16 pb-14 sm:pt-24 sm:pb-16 lg:pr-[25rem] xl:pr-[28rem]">
          <Rise>
            <Breadcrumbs trail={TRAIL} className="mb-7" />
          </Rise>

          <Rise>
            <Eyebrow>Contact</Eyebrow>
          </Rise>

          <MotionTitle
            className="mt-5 max-w-3xl t-h1"
            lines={[[{ text: 'Book a' }, { text: 'walkthrough.', mark: true }]]}
          />

          <Rise delay={120}>
            <p className="m-dim mt-7 max-w-2xl t-4 sm:t-5">
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

              <Reveal delay={140}>
                <div className="m-card p-6 sm:p-7">
                  <PanelHead icon={LogIn} title="Already using it" />
                  <p className="m-dim mt-4 t-3">
                    You do not need a call to start. The workspace is open without an account, and True
                    Property Cost and Wealth Tracker work straight away. Sign in to keep your work in an
                    account; the other tools are opened on request from their own pages.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/login"
                      className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--m-line-2)] px-5 t-3 font-semibold transition hover:border-[var(--m-ink)] hover:bg-[var(--m-bg-2)] sm:flex-1"
                    >
                      Sign in
                    </Link>{' '}
                    <Link
                      href="/signup"
                      className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--m-line)] px-5 t-3 font-semibold transition hover:border-[var(--m-line-2)] hover:bg-[var(--m-bg-2)] sm:flex-1"
                    >
                      Create an account
                    </Link>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={200}>
                <div className="m-card p-6 sm:p-7">
                  <PanelHead icon={ShieldCheck} title="Elsewhere" />
                  {/*
                    Two rows removed: "Built by — Chartered accountants, in
                    Mumbai" and "Hosting — Mumbai · ap-south-1". Both named the
                    location, which the site no longer does anywhere, and each
                    was a dt/dd pair rather than a line, so both halves go
                    together — a term with nothing defining it is worse than
                    neither.
                  */}
                  <dl className="mt-5 space-y-4 t-3">
                    <div>
                      <dt className="m-dim-2">Security reports</dt>
                      <dd className="mt-1">
                        <a
                          href={`mailto:${CONTACT.security}`}
                          className="m-mono t-3 text-[var(--m-cyan)] underline underline-offset-4 transition hover:text-[var(--m-ink)]"
                        >
                          {CONTACT.security}
                        </a>
                      </dd>
                    </div>
                  </dl>
                </div>
              </Reveal>
            </div>
          </div>
        </Container>
      </Section>
      <Section>
        <Container wide>
          <SectionHeading eyebrow="What happens next" title="Four stops, then you decide." center />
          <div className="mt-14">
            <StepRail stops={WALKTHROUGH_STEPS} />
          </div>
        </Container>
      </Section>
    </>
  );
}

/**
 * A side panel's header: the label beside a small tile with its icon, the
 * public site's version of the app's panel header. The tile is the arch, so the
 * three panels down the side read as three small doorways rather than three
 * boxes with a caption on top.
 */
function PanelHead({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--m-line)] pb-4">
      <span
        aria-hidden
        className="m-arch grid h-10 w-8 shrink-0 place-items-center bg-[var(--m-bg-2)] pt-1 text-[var(--m-gold)]"
      >
        <Icon className="size-4" />
      </span>
      <h2 className="m-eyebrow">{title}</h2>
    </div>
  );
}
