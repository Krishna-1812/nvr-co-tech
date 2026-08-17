import { ArrowDown, Sparkles } from 'lucide-react';
import { Aurora, CTA, Container, LineRise, Rise } from '../bits';
import { Tilt } from '../motion';
import { VoucherPanel } from './VoucherPanel';

/**
 * Above the fold: one claim, one sentence of substantiation, two buttons, and
 * the product itself.
 *
 * Every entrance here is CSS — LineRise and Rise, never Reveal or WordReveal.
 * This is the first thing anyone sees, and a JavaScript-driven entrance means a
 * blank screen until the bundle lands. Below the fold that wait is invisible;
 * here it is the whole first impression.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <HeroBackdrop />

      <Container wide className="relative pt-14 pb-20 sm:pt-20 sm:pb-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1.06fr_1fr] lg:gap-16">
          <div>
            <Rise>
              <span className="m-mono m-ring inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-3.5 py-1.5 text-[10px] font-medium tracking-[0.16em] uppercase">
                <Sparkles className="size-3 text-[var(--m-lime)]" aria-hidden />
                AI tools for finance teams
              </span>
            </Rise>

            {/*
              Three clipping boxes rather than one heading with <br>: each line
              is revealed by its own box, which is what makes the type look like
              it is being uncovered rather than fading in.
            */}
            <h1 className="m-display mt-7 text-[clamp(2.6rem,6.6vw,5rem)]">
              <LineRise delay={60}>We handle the</LineRise>
              <LineRise delay={150}>
                <span className="m-serif m-grad-text pr-1">repetitive</span> work.
              </LineRise>
              <LineRise delay={240}>You make the calls.</LineRise>
            </h1>

            <Rise delay={380}>
              <p className="m-dim mt-7 max-w-lg text-[15px] leading-relaxed sm:text-[17px]">
                One tool for each job your team repeats every month. Raising payments, matching GST,
                working out TDS, agreeing the bank. They fill in the forms, do the arithmetic and
                pass the work to the right person, then you decide. One is live today and the rest
                are on the way.
              </p>
            </Rise>

            <Rise delay={450}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <CTA href="/contact" data={{ 'data-demo': '', 'data-interest': 'Hero' }}>
                  Book a walkthrough
                </CTA>
                <CTA href="/agents" variant="ghost">
                  See what we build
                </CTA>
              </div>
            </Rise>
          </div>

          <Rise delay={300} className="lg:pl-4">
            <Tilt>
              <VoucherPanel />
            </Tilt>
            {/*
              Names what the panel is. Without this line the page opens on a
              voucher and reads as a voucher product, which is one sixth of
              what it is.
            */}
            <p className="m-dim-2 mt-5 text-center text-[11.5px] leading-relaxed">
              Above: Voucher Desk, the one you can use today. Five more are on the way.
            </p>
          </Rise>
        </div>

        {/* Tells the reader there is a page below without shouting about it. */}
        <Rise delay={700}>
          <p className="m-mono m-dim-2 mt-16 hidden items-center gap-2.5 text-[10px] tracking-[0.18em] uppercase lg:flex">
            <ArrowDown
              className="size-3 animate-[breathe_3.4s_ease-in-out_infinite] motion-reduce:animate-none"
              aria-hidden
            />
            See the whole month of work
          </p>
        </Rise>
      </Container>
    </section>
  );
}

/**
 * The light behind the hero.
 *
 * The rotating conic ring is the one piece of decoration here that is not a
 * blurred blob: it sits behind the product panel and gives that side of the
 * page a centre, which three overlapping auroras never quite do.
 */
function HeroBackdrop() {
  return (
    <>
      <Aurora color="var(--m-indigo)" opacity={0.3} className="-top-40 -left-32 size-[42rem]" />
      <Aurora color="var(--m-violet)" opacity={0.22} className="-top-24 right-0 size-[34rem]" />
      <Aurora color="var(--m-cyan)" opacity={0.12} className="top-72 left-1/3 size-[30rem]" />

      <span
        aria-hidden
        className="pointer-events-none absolute top-[-18rem] right-[-22rem] hidden size-[54rem] animate-[orbit_70s_linear_infinite] rounded-full opacity-[0.30] blur-[70px] motion-reduce:animate-none lg:block"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0deg, var(--m-violet) 70deg, transparent 150deg, var(--m-cyan) 250deg, transparent 330deg)',
        }}
      />

      <div
        aria-hidden
        className="m-grid pointer-events-none absolute inset-0 opacity-[0.5] [mask-image:radial-gradient(72%_62%_at_50%_0%,#000,transparent)]"
      />

      {/* Seals the bottom edge so the hero's light does not bleed into the
          section below, which has its own. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{ background: 'linear-gradient(to bottom, transparent, var(--m-bg))' }}
      />
    </>
  );
}
