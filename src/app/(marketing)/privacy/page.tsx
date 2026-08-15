import type { Metadata } from 'next';
import { BRAND, CONTACT } from '@/lib/marketing/content';
import {
  Aurora,
  Container,
  CTA,
  Eyebrow,
  Rise,
  Section,
  SectionHeading,
  Stat,
} from '@/components/marketing/bits';
import { Reveal } from '@/components/marketing/Reveal';

export const metadata: Metadata = {
  title: 'Privacy',
  description: `What ${BRAND.name} collects, why, who sees it, and how long it's kept — for a first visit to the site and for a signed-in account.`,
};

/**
 * Bump this whenever a change here is more than wording — a new processor, a
 * changed retention window, anything that would actually affect what someone
 * agreed to.
 */
const LAST_UPDATED = '16 August 2026';

const VISITOR_FACTS = [
  {
    title: 'One cookie, first-party',
    body: `fi_vid holds a random ID and nothing else — no name, no email, nothing you typed. Its whole job is to recognise Tuesday's visit and Thursday's sign-in as one journey. Set for a year, read by nobody but us.`,
  },
  {
    title: 'Asked, where the law expects it',
    body: `A browser reporting a European time zone sees a card before anything is tracked: allow or decline, remembered for a year. Elsewhere, tracking runs by default — the way a shop notices footfall without asking each visitor — but the next rule still applies to everyone.`,
  },
  {
    title: 'Do Not Track is obeyed, not just logged',
    body: `Either Do Not Track or Global Privacy Control switches the tracker off before it does anything at all — no card, no exception, nothing left running in the background.`,
  },
  {
    title: 'An identity is evidence, never a guess',
    body: `You become a named person in our records only when you do something deterministic — submit the contact form, sign up, sign in. Two people on the same office WiFi are never merged into one record just because they share an address.`,
  },
];

const PROCESSORS = [
  {
    name: 'Vercel',
    body: 'Hosts the website and the application. Sees traffic the way any host does.',
  },
  {
    name: 'Supabase',
    body: `The database and file storage, in Mumbai. Your account, your vouchers, and everything you upload live here and nowhere else.`,
  },
  {
    name: 'Anthropic',
    body: `Only when you use the in-app assistant. Sees what you type into that conversation, plus your first name and role — never your stored files or another firm's records.`,
  },
  {
    name: 'IPinfo and Apollo.io',
    body: `Optional, and off unless switched on for your account. Used only to put a company name to a business visitor's IP address — never for anyone on a home or mobile connection.`,
  },
];

export default function PrivacyPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <Aurora color="var(--m-cyan)" opacity={0.18} className="-top-44 -left-24 size-[36rem]" />
        <div
          aria-hidden
          className="m-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(65%_55%_at_50%_0%,#000,transparent)]"
        />

        <Container wide className="relative pt-16 pb-14 sm:pt-24 sm:pb-16">
          <Rise>
            <Eyebrow>Privacy</Eyebrow>
          </Rise>
          <Rise delay={60}>
            <h1 className="m-display mt-5 max-w-3xl text-[clamp(2.2rem,5vw,3.6rem)]">
              What we collect, and why.
            </h1>
          </Rise>
          <Rise delay={120}>
            <p className="m-dim mt-7 max-w-2xl text-[15px] leading-relaxed sm:text-[17px]">
              Written to be read, not skimmed past. It says plainly what happens on a first visit
              to the site, and what changes once you have an account — because those are two
              different things, and most policies pretend they are one.
            </p>
          </Rise>
          <Rise delay={170}>
            <p className="m-mono m-dim-2 mt-6 text-[11px] tracking-[0.1em] uppercase">
              Last updated {LAST_UPDATED}
            </p>
          </Rise>
        </Container>
      </section>

      <Section divider={false} className="pt-2 sm:pt-4">
        <Container wide>
          <Reveal>
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              <Stat value="1" label="Cookie" hint="First-party, no ad networks" />
              <Stat value="400" label="Days" hint="Analytics kept, then auto-deleted" />
              <Stat value="1" label="Place" hint="Mumbai, ap-south-1 — where it lives" />
              <Stat value="0" label="Times sold" hint="To anyone, for any reason" />
            </div>
          </Reveal>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <Reveal>
              <div className="lg:sticky lg:top-28">
                <Eyebrow>Who&rsquo;s responsible</Eyebrow>
                <h2 className="m-display mt-4 text-[clamp(1.8rem,3.6vw,2.7rem)]">
                  Not yet a registered company.
                </h2>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div className="space-y-5 text-[15px] leading-relaxed">
                <p className="text-[var(--m-ink)]">
                  {BRAND.name}{' '}
                  is currently built and run by its founding team, ahead of formal incorporation.
                  We&rsquo;re saying that here rather than letting the page imply otherwise with a
                  registered-sounding &ldquo;we.&rdquo;
                </p>
                <p className="m-dim">
                  Nothing about this changes the commitment: every request in this policy —
                  access, correction, deletion — reaches the same people, at the address at the
                  bottom of this page, whether or not a company name sits above it yet.
                  We&rsquo;ll update this section the day incorporation happens.
                </p>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <Reveal>
            <SectionHeading
              eyebrow="Before you have an account"
              title="Visiting the site."
              lead="Four things are true of every visit, before anyone signs up for anything."
            />
          </Reveal>

          <ul className="mt-12 grid gap-4 sm:grid-cols-2">
            {VISITOR_FACTS.map((item, i) => (
              <Reveal as="li" key={item.title} delay={i * 70} className="h-full">
                <div className="m-card flex h-full flex-col p-6 sm:p-7">
                  <h3 className="m-display text-lg">{item.title}</h3>
                  <p className="m-dim mt-3 text-[14px] leading-relaxed">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </ul>

          <Reveal delay={80}>
            <div className="mt-10 space-y-5 text-[15px] leading-relaxed">
              <p className="m-dim">
                What a visit itself records: the page and how you got there, how long you stayed
                and how far you scrolled, which buttons you used, how fast the page loaded, and
                the broad shape of your device — browser, operating system, screen size. All of it
                is tied to the one anonymous cookie above, not to you by name.
              </p>
              <div className="m-card border-l-2 border-l-[var(--m-cyan)] px-6 py-6">
                <h3 className="m-display text-base">If your company&rsquo;s name shows up</h3>
                <p className="m-dim mt-3 text-[14px] leading-relaxed">
                  We can sometimes tell which company a visit came from, from its IP address alone
                  — but only when that address looks like a workplace, a university, or a
                  government network. A home broadband connection, a mobile carrier, a VPN, or a
                  hosting provider is refused outright, regardless of how confident anything looks.
                  Nobody&rsquo;s home connection is ever named. Only a short, named list of people at{' '}
                  {BRAND.name}{' '}
                  can open the screen that shows any of this, and the database enforces that list
                  itself — the page isn&rsquo;t the only thing standing guard.
                </p>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <Reveal>
            <SectionHeading
              eyebrow="Once you have an account"
              title="Using the product."
              lead="Signing up changes what's stored, because there's now a firm's actual work in the picture."
            />
          </Reveal>

          <Reveal delay={80}>
            <div className="mt-10 space-y-5 text-[15px] leading-relaxed">
              <p className="text-[var(--m-ink)]">
                We keep your name, your email, your role, and whatever your firm uploads or
                creates while using a tool — vouchers, ledgers, GST and reconciliation files, and
                the record of who approved what and when. That approval trail can&rsquo;t be edited by
                anyone after the fact, including us: the database only allows it to be added to,
                never rewritten.
              </p>
              <p className="m-dim">
                Who can see or change a record is a rule the database enforces directly, not a
                check the website happens to make. A small, fixed set of database functions is the
                only way any of it moves forward — deleting the website tomorrow wouldn&rsquo;t change
                who&rsquo;s allowed to approve what.
              </p>
              <div className="m-card border-l-2 border-l-[var(--m-violet)] px-6 py-6">
                <h3 className="m-display text-base">The in-app assistant</h3>
                <p className="m-dim mt-3 text-[14px] leading-relaxed">
                  Ask it something, and what you typed — including any figures you paste in — is
                  sent to Anthropic, whose model writes the answer, along with your first name and
                  your role so it can address you properly. It is never handed your firm&rsquo;s stored
                  vouchers or files directly; it only ever sees what&rsquo;s actually written in that
                  conversation, plus our own fixed how-to documentation.
                </p>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <Reveal>
            <SectionHeading
              eyebrow="Who else sees it"
              title="A short list, and nobody buys it."
              lead="Everything above is stored with one of a handful of named processors, each doing exactly one job."
            />
          </Reveal>

          <ul className="mt-12 grid gap-4 sm:grid-cols-2">
            {PROCESSORS.map((p, i) => (
              <Reveal as="li" key={p.name} delay={i * 70} className="h-full">
                <div className="m-card flex h-full flex-col p-6 sm:p-7">
                  <h3 className="m-display text-lg">{p.name}</h3>
                  <p className="m-dim mt-3 text-[14px] leading-relaxed">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </ul>

          <Reveal delay={80}>
            <p className="m-dim-2 mt-8 max-w-2xl text-[13.5px] leading-relaxed">
              We don&rsquo;t sell data — yours, your firm&rsquo;s, or a visitor&rsquo;s — to anyone, for any reason.
              There&rsquo;s no line item in this business that depends on it.
            </p>
          </Reveal>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <div>
                <Eyebrow>How long</Eyebrow>
                <h2 className="m-display mt-4 text-[clamp(1.6rem,3vw,2.2rem)]">
                  Kept only as long as it&rsquo;s useful.
                </h2>
                <div className="mt-6 space-y-4 text-[14px] leading-relaxed">
                  <p className="m-dim">
                    <span className="text-[var(--m-ink)]">Analytics</span> — 400 days, then removed
                    automatically by a scheduled cleanup. Nobody has to remember to do it.
                  </p>
                  <p className="m-dim">
                    <span className="text-[var(--m-ink)]">Your consent decision</span> — remembered
                    for a year, then asked again.
                  </p>
                  <p className="m-dim">
                    <span className="text-[var(--m-ink)]">Account and financial records</span>{' '}
                    — kept for as long as your account is open. Accounting records commonly need to be kept
                    for several years for your own firm&rsquo;s compliance, so these aren&rsquo;t deleted on a
                    timer — ask, and we&rsquo;ll remove what isn&rsquo;t legally required to be kept.
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div>
                <Eyebrow>Your rights</Eyebrow>
                <h2 className="m-display mt-4 text-[clamp(1.6rem,3vw,2.2rem)]">
                  Ask, and a person answers.
                </h2>
                <div className="mt-6 space-y-4 text-[14px] leading-relaxed">
                  <p className="m-dim">
                    Ask what we hold on you, ask us to correct it, ask us to delete what isn&rsquo;t
                    legally required to be kept, or withdraw analytics consent at any time — decline
                    the card again, or clear your browser&rsquo;s storage for this site.
                  </p>
                  <p className="m-dim">
                    Every one of those goes to{' '}
                    <a
                      href={`mailto:${CONTACT.email}`}
                      className="m-mono text-[13px] text-[var(--m-cyan)] underline underline-offset-4 transition hover:text-[var(--m-ink)]"
                    >
                      {CONTACT.email}
                    </a>
                    . One inbox, a person answers within one working day — not a ticket number.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <Reveal>
            <div className="m-card relative overflow-hidden px-6 py-14 text-center sm:px-12 sm:py-20">
              <Aurora
                color="var(--m-indigo)"
                opacity={0.22}
                className="-top-24 left-1/2 size-[28rem] -translate-x-1/2"
              />
              <div className="relative mx-auto max-w-2xl">
                <Eyebrow>Changes to this policy</Eyebrow>
                <h2 className="m-display mt-4 text-[clamp(1.6rem,3.4vw,2.4rem)]">
                  We&rsquo;ll date it, not bury it.
                </h2>
                <p className="m-dim mt-5 text-[15px] leading-relaxed">
                  When something material here changes — a new processor, a different retention
                  window — the date at the top moves with it. A rewording doesn&rsquo;t get to hide
                  behind the same excuse.
                </p>
                <div className="mt-9 flex flex-wrap justify-center gap-3">
                  <CTA href="/contact" data={{ 'data-demo': '', 'data-interest': 'Privacy' }}>
                    Ask us anything here
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
