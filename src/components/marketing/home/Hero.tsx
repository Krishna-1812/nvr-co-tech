import { ShieldCheck, Sparkles } from 'lucide-react';
import { Aurora, CTA, Container, Rise } from '../bits';
import { VoucherPanel } from './VoucherPanel';

/**
 * Above the fold: one claim, one sentence of substantiation, two buttons, and
 * the product itself. The panel on the right is not a screenshot — it is the
 * real component vocabulary, which is why it can say something specific.
 *
 * Everything here animates with Rise, not Reveal: this is the first thing anyone
 * sees, and it must not wait for hydration to become visible.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Light sources. Placed off-centre so the page is lit from one direction. */}
      <Aurora color="var(--m-indigo)" opacity={0.32} className="-top-40 -left-32 size-[42rem]" />
      <Aurora color="var(--m-violet)" opacity={0.24} className="-top-24 right-0 size-[34rem]" />
      <Aurora color="var(--m-cyan)" opacity={0.14} className="top-72 left-1/3 size-[30rem]" />

      {/* Hairline grid, faded out before it reaches the copy. */}
      <div
        aria-hidden
        className="m-grid pointer-events-none absolute inset-0 opacity-[0.55] [mask-image:radial-gradient(70%_60%_at_50%_0%,#000,transparent)]"
      />

      <Container wide className="relative pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div>
            <Rise>
              <span className="m-mono inline-flex items-center gap-2 rounded-full border border-[var(--m-line)] bg-white/[0.03] px-3 py-1.5 text-[10px] font-medium tracking-[0.16em] uppercase">
                <Sparkles className="size-3 text-[var(--m-cyan)]" aria-hidden />
                Agentic AI for finance teams
              </span>
            </Rise>

            <Rise delay={70}>
              <h1 className="m-display mt-7 text-[clamp(2.6rem,6.4vw,4.75rem)]">
                The parts of finance
                <br />
                that are <span className="m-serif m-grad-text pr-1">rules,</span>
                <br />
                not judgement.
              </h1>
            </Rise>

            <Rise delay={140}>
              <p className="m-dim mt-7 max-w-lg text-[15px] leading-relaxed sm:text-[17px]">
                Agents that raise, check and route the routine work — then hand a person the
                decision, with the reasoning attached. Every approval recorded, attributable, and
                enforced by the database rather than promised by the interface.
              </p>
            </Rise>

            <Rise delay={200}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <CTA href="/contact">Book a walkthrough</CTA>
                <CTA href="/agents" variant="ghost">
                  See the agents
                </CTA>
              </div>
            </Rise>

            <Rise delay={260}>
              <p className="m-dim-2 mt-8 flex items-center gap-2 text-xs">
                <ShieldCheck className="size-3.5 shrink-0 text-[var(--m-emerald)]" aria-hidden />
                Built and operated by N V R &amp; Co, Chartered Accountants · Hosted in Mumbai
              </p>
            </Rise>
          </div>

          <Rise delay={160} className="lg:pl-4">
            <VoucherPanel />
          </Rise>
        </div>
      </Container>
    </section>
  );
}
