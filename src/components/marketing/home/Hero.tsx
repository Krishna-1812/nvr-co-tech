import { ArrowDown } from 'lucide-react';
import { CTA, Container, LineRise, Rise } from '../bits';
import { HeroVisual } from './HeroVisual';
import { HeroStage } from '../play/HeroStage';
import { IntroCurtain } from '../play/IntroCurtain';
import { Letters } from '../play/Letters';
import { Springy } from '../play/Springy';
import { Roost } from '@/components/brand/Owl';

/**
 * Above the fold: one claim, one sentence of substantiation, two buttons, and
 * the product itself.
 *
 * Every entrance here is CSS: LineRise and Rise, never Reveal.
 * This is the first thing anyone sees, and a JavaScript-driven entrance means a
 * blank screen until the bundle lands. Below the fold that wait is invisible;
 * here it is the whole first impression.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <IntroCurtain />
      <HeroBackdrop />

      {/* Two, and both in the vertical padding rather than the gutter, because
          the hero is the one section whose content runs the full width. */}
      <Roost seed="hero-rafter" band="top-right" />
      <Roost seed="hero-truss" band="bottom-left" />

      <Container wide className="relative pt-14 pb-20 sm:pt-20 sm:pb-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1.06fr_1fr] lg:gap-16">
          <div>
            {/*
              A label with a rule, not a chip.

              This was a bordered pill with a sparkle icon in it — the two most
              copied ornaments on any product page, and the sparkle in
              particular says "this is an AI site" in a way that has stopped
              meaning anything. A short gold rule and a mono label say the same
              words and belong to the rest of the page, where every section is
              introduced exactly this way.
            */}
            <Rise>
              <span className="flex items-center gap-3.5">
                <span aria-hidden className="h-px w-10 bg-[var(--m-gold)]" />
                <span className="m-mono t-1 font-medium t-caps text-[var(--m-gold)] uppercase">
                  AI tools for finance teams
                </span>
              </span>
            </Rise>

            {/*
              Three clipping boxes rather than one heading with <br>: each line
              is revealed by its own box, which is what makes the type look like
              it is being uncovered rather than fading in.
            */}
            {/*
              Set letter by letter (Letters) so the line can answer the
              pointer (Springy): letters near it lean up and turn terracotta,
              and spring back when it moves on. The last line gets the sun
              drawn behind it once it has risen — the claim the page is making,
              marked the way a reader marks the line that matters.
            */}
            <Springy as="h1" className="m-display mt-7 t-hero" delay={1500}>
              <LineRise delay={60}>
                <Letters text="We handle the" />
              </LineRise>
              <LineRise delay={150}>
                <span className="m-serif m-grad-text pr-1">
                  <Letters text="repetitive" start={13} />
                </span>{' '}
                <Letters text="work." start={23} />
              </LineRise>
              <LineRise delay={240}>
                <span className="m-mark">
                  <Letters text="You make the calls." start={28} />
                </span>
              </LineRise>
            </Springy>

            <Rise delay={380}>
              <p className="m-dim mt-7 max-w-lg t-4 sm:t-5">
                One tool for each job your team repeats every month. Raising payments, agreeing the
                bank, matching GST, working out TDS. They fill in the forms, do the arithmetic and
                pass the work to the right person, then you decide.
              </p>
            </Rise>

            <Rise delay={450}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <CTA href="/contact" data={{ 'data-demo': '', 'data-interest': 'Hero' }}>
                  Book a walkthrough
                </CTA>
                <CTA href="/tools" variant="ghost">
                  See what we build
                </CTA>
              </div>
            </Rise>
          </div>

          {/*
            The arch window. The product sits in a doorway with the sun coming
            up behind it: the one image on the site that says what kind of
            place this is before a word of it is read. The sun is a plain disc
            rising on load, and the dune is a second, lower arch-shaped floor,
            so the card stands on something rather than floating in a frame.

            pt is what makes room for the sun above the card. Below lg the
            window narrows to the column and the sun scales down with it.
          */}
          <Rise delay={200} className="lg:pl-4">
            {/*
              HeroStage: the sun drifts with the pointer and the card against
              it, and the card can be picked up and thrown back on a spring.
            */}
            <HeroStage className="m-arch m-arch-open relative overflow-hidden bg-[var(--sky-wash,var(--m-bg-2))] px-4 pt-44 pb-5 transition-colors duration-[4s] sm:px-7 sm:pt-56 sm:pb-8">
              {/* The sky follows the hour in India (lib/sky): dawn and dusk
                  warm it, night darkens it, lets the stars out and turns the
                  sun into the moon. */}
              <span aria-hidden className="m-stars" />
              <span aria-hidden className="m-drift-far absolute inset-0">
                <span className="m-sun absolute top-12 left-1/2 size-40 -translate-x-1/2 sm:top-16 sm:size-56" />
              </span>
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-40 bg-[var(--m-bg-3)]"
                style={{ borderRadius: '60% 40% 0 0 / 30% 25% 0 0' }}
              />
              <div className="m-drift-near relative">
                <div data-grab>
                  <HeroVisual />
                </div>
              </div>
            </HeroStage>
          </Rise>
        </div>

        {/*
          What used to be an index — a hairline and three counts set like the
          masthead figures on a contents page, one for live, one for in build,
          one for the whole roster — is now the hairline and the cue that sat at
          the end of it.

          The counts are gone from the site entirely, so the figures went with
          them. The cue stays because it is not a count: it is the one thing on
          the first screen that tells a reader there is a page below this. It
          loses its `ml-auto` and its `lg:` gate along with the figures — pushed
          right and hidden on small screens made sense while it was the tail of
          a row, and neither does now that it is the row.
        */}
        <Rise delay={620}>
          <div className="mt-16 border-t border-[var(--m-line)] pt-6">
            <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
              <p className="m-mono m-dim-2 flex items-center gap-2.5 t-1 t-caps uppercase">
                <ArrowDown
                  className="size-3 animate-[breathe_3.4s_ease-in-out_infinite] motion-reduce:animate-none"
                  aria-hidden
                />
                See the whole month of work
              </p>
            </div>
          </div>
        </Rise>
      </Container>
    </section>
  );
}

/**
 * What the hero stands on.
 *
 * ── What was here ─────────────────────────────────────────────────────────
 *
 * On the night skin: one blurred indigo field from the top left, a faint gold
 * one opposite, and a hairline grid on a slow parallax, all there to give a
 * near-black page something to recede into. On sand every one of them read as
 * a stain or as graph paper, and the skin now hides both devices site-wide.
 *
 * ── What replaced it ──────────────────────────────────────────────────────
 *
 * The arch window beside the headline does the job the light was doing, so
 * what is left here is the horizon: a single terracotta rule along the foot of
 * the section, drawn by the scroll. The ground the arch stands on.
 */
function HeroBackdrop() {
  return (
    <span
      aria-hidden
      className="s-rule pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[var(--m-gold)] opacity-40"
    />
  );
}
