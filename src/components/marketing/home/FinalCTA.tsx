import { CTA, Container } from '../bits';
import { Reveal } from '../Reveal';
import { Roost } from '@/components/brand/Owl';

/**
 * The last thing on the home page: one terracotta panel with the sun going
 * down into it.
 *
 * The hero opens on the sun coming up behind an arch; this closes on the same
 * disc setting at the foot of the panel. It is the one place the accent is
 * used as a ground rather than as a word, which is why it can carry the page's
 * last instruction without anything around it shouting.
 *
 * The buttons are inverted for the ground: a bone pill for the main action and
 * a bone outline for the second, so neither is ink on terracotta (2.7:1).
 */
export function FinalCTA() {
  return (
    <section className="relative px-3 pb-3 sm:px-5 sm:pb-5">
      <Roost seed="cta-spire" band="top-left" />

      <div className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[2.25rem] bg-[var(--m-gold)] py-24 text-[var(--m-on-grad)] sm:py-32">
        <span
          aria-hidden
          className="m-sun absolute bottom-[-14rem] left-1/2 size-[28rem] -translate-x-1/2 opacity-90"
          style={{ background: '#B9542F', '--sun-from': '-60px' } as React.CSSProperties}
        />
        <span
          aria-hidden
          className="m-arch absolute right-[7%] bottom-0 hidden h-56 w-36 bg-[#B9542F] md:block"
        />
        <span
          aria-hidden
          className="m-arch absolute bottom-0 left-[6%] hidden h-40 w-24 bg-[#8E3A22] md:block"
        />

        <Container className="relative text-center">
          <Reveal>
            <h2 className="m-display s-settle mx-auto max-w-3xl t-h1">
              Start with the worst job on your desk.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="mx-auto mt-6 max-w-xl t-4 text-[#F6E3D6]">
              Tell us which one it is. Give us half an hour and we will show you the tool that covers
              it, set up with your own people and your own approval steps. If it is not built yet we
              will say so, and tell you what is.
            </p>
          </Reveal>
          <Reveal delay={140}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <CTA
                href="/contact"
                className="bg-[var(--m-on-grad)] text-[var(--m-ink)] hover:bg-[var(--m-ink)] hover:text-[var(--m-on-grad)]"
                data={{ 'data-demo': '', 'data-interest': 'Final call to action' }}
              >
                Book a walkthrough
              </CTA>
              <CTA
                href="/signup"
                variant="ghost"
                className="border-[var(--m-on-grad)] text-[var(--m-on-grad)] hover:border-[var(--m-on-grad)] hover:bg-[var(--m-on-grad)] hover:text-[var(--m-ink)]"
                data={{ 'data-signup': '' }}
              >
                Create an account
              </CTA>
            </div>
          </Reveal>
        </Container>
      </div>
    </section>
  );
}
