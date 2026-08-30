import { Aurora, CTA, Container } from '../bits';
import { Reveal } from '../Reveal';

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-t border-[var(--m-line)] py-24 sm:py-32">
      <Aurora color="var(--m-indigo)" opacity={0.16} className="-bottom-44 left-1/4 size-[42rem]" />
      <Aurora color="var(--m-gold)" opacity={0.06} className="-bottom-32 right-1/4 size-[28rem]" />
      <div
        aria-hidden
        className="m-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(60%_70%_at_50%_100%,#000,transparent)]"
      />

      <Container className="relative text-center">
        <Reveal>
          <h2 className="m-display s-settle mx-auto max-w-3xl text-[clamp(2rem,5vw,3.5rem)]">
            Start with the <span className="m-serif m-grad-text">worst</span> job on your desk.
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="m-dim mx-auto mt-6 max-w-xl text-[15px] leading-relaxed sm:text-base">
            Tell us which one it is. Give us half an hour and we will show you the tool that covers
            it, set up with your own people and your own approval steps. If it is not built yet we
            will say so, and tell you what is.
          </p>
        </Reveal>
        <Reveal delay={140}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <CTA href="/contact" data={{ 'data-demo': '', 'data-interest': 'Final call to action' }}>
              Book a walkthrough
            </CTA>
            <CTA href="/signup" variant="ghost" data={{ 'data-signup': '' }}>
              Create an account
            </CTA>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
