import type { Metadata } from 'next';
import { BRAND, CONTACT } from '@/lib/marketing/content';
import { Aurora, Container, Eyebrow, Rise, Section } from '@/components/marketing/bits';
import { Reveal } from '@/components/marketing/Reveal';

export const metadata: Metadata = {
  title: 'Terms',
  description: `The terms that apply to using ${BRAND.name}.`,
};

const LAST_UPDATED = '16 August 2026';

const SECTIONS = [
  {
    title: 'Agreement to these terms',
    body: `By creating an account or otherwise using the platform, you agree to these terms. If you are using it on behalf of an organisation, you are confirming you have the authority to agree on its behalf, and "you" refers to that organisation as well as you personally.`,
  },
  {
    title: 'Using the platform',
    body: `You may use the platform only for its intended purpose and only in ways that are lawful. You are responsible for what happens under your account, so keep your credentials to yourself and let us know if you think someone else has access to them.`,
  },
  {
    title: 'Your account',
    body: `You need an account to use most of the platform, and the information you give us to create one should be accurate. We may suspend or close an account that is used in a way that breaches these terms or puts the platform or other users at risk.`,
  },
  {
    title: 'Your content and records',
    body: `Anything you or your organisation enters into the platform remains yours. We do not claim ownership of it. We use it only to provide the service back to you, in the ways described in our privacy policy.`,
  },
  {
    title: 'Availability',
    body: `We aim to keep the platform available and working as intended, but we do not promise it will be uninterrupted or error-free. From time to time it may be unavailable for maintenance or reasons outside our control.`,
  },
  {
    title: 'No guarantees',
    body: `The platform is provided as it stands, without guarantees beyond what is stated here or required by law. Where the law allows it, we are not liable for indirect or consequential loss arising from your use of the platform.`,
  },
  {
    title: 'Ending your use',
    body: `You may stop using the platform and close your account at any time. We may also end or suspend access where these terms have not been followed. Where reasonably possible, we will give notice first.`,
  },
  {
    title: 'Changes to these terms',
    body: `We may update these terms from time to time as the platform changes. The date at the top will always reflect the most recent version, and continuing to use the platform after a change means you accept the update.`,
  },
];

export default function TermsPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <Aurora color="var(--m-violet)" opacity={0.16} className="-top-44 -left-24 size-[36rem]" />
        <div
          aria-hidden
          className="m-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(65%_55%_at_50%_0%,#000,transparent)]"
        />

        <Container wide className="relative pt-16 pb-14 sm:pt-24 sm:pb-16">
          <Rise>
            <Eyebrow>Terms</Eyebrow>
          </Rise>
          <Rise delay={60}>
            <h1 className="m-display mt-5 max-w-3xl text-[clamp(2.2rem,5vw,3.6rem)]">
              The terms that apply here.
            </h1>
          </Rise>
          <Rise delay={120}>
            <p className="m-dim mt-7 max-w-2xl text-[15px] leading-relaxed sm:text-[17px]">
              A short, plain-language summary of what governs your use of the platform.
            </p>
          </Rise>
          <Rise delay={170}>
            <p className="m-mono m-dim-2 mt-6 text-[11px] tracking-[0.1em] uppercase">
              Last updated {LAST_UPDATED}
            </p>
          </Rise>
        </Container>
      </section>

      <Section>
        <Container wide className="max-w-3xl">
          <div className="space-y-10">
            {SECTIONS.map((s, i) => (
              <Reveal key={s.title} delay={i * 40}>
                <h2 className="m-display text-lg">{s.title}</h2>
                <p className="m-dim mt-3 text-[14.5px] leading-relaxed">{s.body}</p>
              </Reveal>
            ))}

            <Reveal delay={SECTIONS.length * 40}>
              <h2 className="m-display text-lg">Contact us</h2>
              <p className="m-dim mt-3 text-[14.5px] leading-relaxed">
                Questions about these terms can go to{' '}
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="m-mono text-[13px] text-[var(--m-cyan)] underline underline-offset-4 transition hover:text-[var(--m-ink)]"
                >
                  {CONTACT.email}
                </a>
                .
              </p>
            </Reveal>
          </div>
        </Container>
      </Section>
    </>
  );
}
