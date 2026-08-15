import type { Metadata } from 'next';
import { BRAND, CONTACT } from '@/lib/marketing/content';
import { Aurora, Container, Eyebrow, Rise, Section } from '@/components/marketing/bits';
import { Reveal } from '@/components/marketing/Reveal';

export const metadata: Metadata = {
  title: 'Privacy',
  description: `How ${BRAND.name} handles information, in plain terms.`,
};

const LAST_UPDATED = '16 August 2026';

const SECTIONS = [
  {
    title: 'Information we collect',
    body: `We collect basic information about how our website and platform are used — things like pages visited, general device and browser information, and account details you provide when you sign up, such as your name and email. If your organisation uses the platform, we also store the records your organisation creates while using it.`,
  },
  {
    title: 'Cookies',
    body: `We use a small number of cookies to keep the site working properly and to understand overall usage. You're always in control of these through your browser settings, and where it matters, we ask first.`,
  },
  {
    title: 'How we use it',
    body: `Information is used to operate and improve the platform, to keep accounts and records secure, to respond when you contact us, and to understand how the product is used so we can make it better.`,
  },
  {
    title: 'Who we share it with',
    body: `We work with a small number of trusted service providers — for hosting, infrastructure, and similar operational needs — who process information on our behalf and only for that purpose. We do not sell personal information, to anyone, for any reason.`,
  },
  {
    title: 'How long we keep it',
    body: `We keep information for as long as it's needed for the purposes described here, or as long as we're required to for legal and accounting reasons. You can ask us to delete what isn't required to be kept.`,
  },
  {
    title: 'Your choices',
    body: `You can ask what information we hold about you, ask us to correct it, or ask us to delete it. You can also manage cookie preferences at any time through your browser.`,
  },
  {
    title: 'Security',
    body: `We take reasonable technical and organisational steps to protect information against unauthorised access, loss, or misuse.`,
  },
  {
    title: 'Changes to this policy',
    body: `We may update this policy from time to time. The date at the top will always reflect the most recent version.`,
  },
];

export default function PrivacyPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <Aurora color="var(--m-cyan)" opacity={0.16} className="-top-44 -left-24 size-[36rem]" />
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
              How we handle information.
            </h1>
          </Rise>
          <Rise delay={120}>
            <p className="m-dim mt-7 max-w-2xl text-[15px] leading-relaxed sm:text-[17px]">
              A short summary of what we collect, why, and how to reach us if you have a question.
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
                Questions about this policy, or a request about your information, can go to{' '}
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
