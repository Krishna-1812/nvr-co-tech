import { Aurora, CTA, Container } from '../bits';
import { Reveal } from '../Reveal';

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-t border-[var(--m-line)] py-24 sm:py-32">
      <Aurora color="var(--m-indigo)" opacity={0.3} className="-bottom-40 left-1/4 size-[38rem]" />
      <Aurora color="var(--m-violet)" opacity={0.2} className="-bottom-32 right-1/4 size-[30rem]" />
      <div
        aria-hidden
        className="m-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(60%_70%_at_50%_100%,#000,transparent)]"
      />

      <Container className="relative text-center">
        <Reveal>
          <h2 className="m-display mx-auto max-w-3xl text-[clamp(2rem,5vw,3.5rem)]">
            See it on <span className="m-serif m-grad-text">your</span> vouchers.
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="m-dim mx-auto mt-6 max-w-xl text-[15px] leading-relaxed sm:text-base">
            Half an hour, your own approval chain, and an honest answer about which parts of your
            month this can take off your desk today and which parts are still on the roadmap.
          </p>
        </Reveal>
        <Reveal delay={140}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <CTA href="/contact">Book a walkthrough</CTA>
            <CTA href="/signup" variant="ghost">
              Create an account
            </CTA>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
