import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Mail } from 'lucide-react';
import { AGENTS, BRAND, CONTACT, STAGE_LABEL } from '@/lib/marketing/content';
import { Aurora, Container, Eyebrow, Rise, Section } from '@/components/marketing/bits';
import { Reveal } from '@/components/marketing/Reveal';

export const metadata: Metadata = {
  title: 'Book a walkthrough',
  description:
    'Thirty minutes with the people who built it. Tell us which agent interests you and what your month currently looks like.',
};

/**
 * There is no form handler behind this page, and none is pretended.
 *
 * The form posts to a mailto: address with `text/plain`, which hands the whole
 * thing to the visitor's own mail client with the fields already written out.
 * That is why the input names are sentences rather than identifiers — they are
 * the labels in the email body, and someone has to read them. The page says
 * this plainly, because a form that silently does nothing is worse than no form
 * at all, and a fake success message is worse than both.
 */
const MAILTO = `mailto:${CONTACT.email}?subject=${encodeURIComponent('Walkthrough request')}`;

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
        <Aurora color="var(--m-indigo)" opacity={0.26} className="-top-44 -left-24 size-[38rem]" />
        <Aurora color="var(--m-violet)" opacity={0.18} className="-top-20 right-0 size-[30rem]" />
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
              <form
                action={MAILTO}
                method="post"
                encType="text/plain"
                aria-describedby="mailto-note"
                className="m-card p-6 sm:p-9"
              >
                <h2 className="m-display text-xl">Your details</h2>
                <p id="mailto-note" className="m-dim mt-3 text-[13.5px] leading-relaxed">
                  This opens your own email app with your answers already written out, addressed to{' '}
                  <span className="m-mono text-[var(--m-ink)]">{CONTACT.email}</span>. Nothing comes
                  to us until you press send there. If nothing opens, just write to that address
                  yourself.
                </p>

                <div className="mt-8 grid gap-5 sm:grid-cols-2">
                  <Field
                    id="contact-name"
                    name="Name"
                    label="Your name"
                    autoComplete="name"
                    placeholder="Priya Nair"
                    required
                  />
                  <Field
                    id="contact-email"
                    name="Work email"
                    label="Work email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="priya@yourfirm.in"
                    required
                  />
                  <Field
                    id="contact-org"
                    name="Organisation"
                    label="Organisation"
                    autoComplete="organization"
                    placeholder="Firm, chapter or company"
                    className="sm:col-span-2"
                  />

                  <div className="sm:col-span-2">
                    <label htmlFor="contact-agent" className="m-eyebrow block">
                      Which one are you interested in
                    </label>
                    <select
                      id="contact-agent"
                      name="Interested in"
                      defaultValue="Not sure yet"
                      // Without this the native dropdown renders as a white
                      // sheet over a near-black page in Chromium.
                      style={{ colorScheme: 'dark' }}
                      className="mt-2.5 w-full appearance-none rounded-xl border border-[var(--m-line)] bg-white/[0.03] px-4 py-3 text-[15px] text-[var(--m-ink)] transition hover:border-[var(--m-line-2)]"
                    >
                      <option value="Not sure yet">Not sure yet</option>
                      {AGENTS.map((agent) => (
                        <option key={agent.slug} value={`${agent.name} (${STAGE_LABEL[agent.stage]})`}>
                          {agent.name} ({STAGE_LABEL[agent.stage].toLowerCase()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="contact-message" className="m-eyebrow block">
                      What would you like us to cover
                    </label>
                    <textarea
                      id="contact-message"
                      name="Message"
                      rows={5}
                      placeholder="How many vouchers you do in a month, who approves them at the moment, and what tends to go wrong."
                      className="mt-2.5 w-full resize-y rounded-xl border border-[var(--m-line)] bg-white/[0.03] px-4 py-3 text-[15px] leading-relaxed text-[var(--m-ink)] transition placeholder:text-[var(--m-dim-2)] hover:border-[var(--m-line-2)]"
                    />
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <button
                    type="submit"
                    className="group inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white shadow-[0_10px_30px_oklch(0.64_0.18_274_/_0.35)] transition hover:brightness-110 active:scale-[0.98]"
                    style={{ backgroundImage: 'var(--m-grad)' }}
                  >
                    Compose the email
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </button>

                  <a
                    href={`mailto:${CONTACT.email}`}
                    className="m-mono m-dim inline-flex items-center gap-2 text-[11px] tracking-[0.12em] uppercase transition hover:text-[var(--m-ink)]"
                  >
                    <Mail className="size-3.5" aria-hidden />
                    Or write to us directly
                  </a>
                </div>
              </form>
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
                    If your firm is already on {BRAND.name} you do not need a call. Sign in, or create
                    an account and ask your administrator to add you to a chapter.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/login"
                      className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-[var(--m-line-2)] px-5 text-sm font-semibold transition hover:border-[var(--m-ink)] hover:bg-white/5"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/signup"
                      className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-[var(--m-line)] px-5 text-sm font-semibold transition hover:border-[var(--m-line-2)] hover:bg-white/5"
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
                      <dt className="m-dim-2">Operated by</dt>
                      <dd className="mt-1">{BRAND.firmLong}</dd>
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

function Field({
  id,
  name,
  label,
  className,
  ...input
}: {
  id: string;
  name: string;
  label: string;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label htmlFor={id} className="m-eyebrow block">
        {label}
        {input.required && (
          <span className="ml-1 text-[var(--m-rose)]" aria-hidden>
            *
          </span>
        )}
      </label>
      <input
        id={id}
        name={name}
        className="mt-2.5 w-full rounded-xl border border-[var(--m-line)] bg-white/[0.03] px-4 py-3 text-[15px] text-[var(--m-ink)] transition placeholder:text-[var(--m-dim-2)] hover:border-[var(--m-line-2)]"
        {...input}
      />
    </div>
  );
}
