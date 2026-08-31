import { ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROSTER } from '@/lib/marketing/content';
import { Aurora, CTA, Container, LineRise, Rise } from '../bits';
import { Tilt } from '../motion';
import { VoucherPanel } from './VoucherPanel';
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
                <span className="m-mono text-[10px] font-medium tracking-[0.2em] text-[var(--m-gold)] uppercase">
                  AI tools for finance teams
                </span>
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
                One tool for each job your team repeats every month. Raising payments, agreeing the
                bank, matching GST, working out TDS. They fill in the forms, do the arithmetic and
                pass the work to the right person, then you decide.{' '}
                {ROSTER.liveOpen} of them {ROSTER.liveVerb} running today and the rest are on the
                way.
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

              Counted from the roster rather than written out. This line said
              "five more are on the way" for the whole of the month after Ledger
              Reconciliation shipped, which is the direction of that mistake that
              costs something: a live tool nobody was told about.
            */}
            <p className="m-dim-2 mt-5 text-center text-[11.5px] leading-relaxed">
              Above: Voucher Desk, one of the {ROSTER.liveWord} running today.{' '}
              {ROSTER.comingOpen} more are on the way.
            </p>
          </Rise>
        </div>

        {/*
          The index.

          A hairline and three counts, set like the masthead figures on a
          contents page. Every number is derived from the roster in
          lib/marketing/content — nothing here is typed, so it cannot say "four
          live" the month a fifth ships. That mattering is the whole reason it
          is on the page: an index is a claim about completeness, and one that
          drifts is worse than none.
        */}
        <Rise delay={620}>
          <div className="mt-16 border-t border-[var(--m-line)] pt-6">
            <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
              <IndexFigure value={ROSTER.live} label="Running today" lit />
              <IndexFigure value={ROSTER.coming} label="In build" />
              <IndexFigure value={ROSTER.total} label="On the roster" />

              <p className="m-mono m-dim-2 ml-auto hidden items-center gap-2.5 text-[10px] tracking-[0.18em] uppercase lg:flex">
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
 * A count, set as an index entry.
 *
 * Two-digit padded, because a column of figures where one is "4" and the next
 * is "12" reads as a list and a column where both are two digits reads as an
 * index. The label sits under a rule rather than beside the number, so three of
 * these across a row line up on two baselines instead of six.
 */
function IndexFigure({ value, label, lit = false }: { value: number; label: string; lit?: boolean }) {
  return (
    <div className="min-w-[7rem]">
      <p
        className={cn(
          'm-display m-tabular text-[clamp(2rem,3.4vw,2.75rem)] leading-none',
          lit && 'text-[var(--m-gold)]',
        )}
      >
        {String(value).padStart(2, '0')}
      </p>
      <p className="m-mono m-dim-2 mt-3 text-[9.5px] tracking-[0.16em] uppercase">{label}</p>
    </div>
  );
}

/**
 * The light behind the hero.
 *
 * ── What was here ─────────────────────────────────────────────────────────
 *
 * Three saturated blurred circles — indigo, violet and cyan — plus a
 * seventy-second rotating conic gradient behind the product panel. Four
 * overlapping coloured light sources is the backdrop of most of the internet
 * right now, and it was also doing real damage: the panel on the right had to
 * sit on whichever two colours happened to be overlapping behind it that
 * second, so its own edges never resolved.
 *
 * ── What replaced it ──────────────────────────────────────────────────────
 *
 * Structure instead of light. A hairline grid on a slow parallax, so the page
 * has a measurable ground that moves against the content and gives the depth
 * the blobs were being asked for; one very soft cool wash from the top left,
 * which is where the notional light is everywhere else in this design system;
 * and a single gold rule along the foot of the section, drawn by the scroll.
 *
 * The grid is the piece doing the work. It is what makes a page look set on
 * something rather than floating, and unlike a gradient it survives being
 * looked at twice.
 */
function HeroBackdrop() {
  return (
    <>
      {/*
        One light, from the top left. `.m-aurora` blurs it to 90px, so at this
        size and opacity it is a wash across the corner rather than a readable
        circle — which is the difference between lighting a page and decorating
        it.
      */}
      <Aurora
        color="var(--m-indigo)"
        opacity={0.16}
        className="-top-56 -left-40 size-[46rem]"
      />
      <Aurora color="var(--m-gold)" opacity={0.05} className="top-40 -right-32 size-[34rem]" />

      {/*
        The grid, on a parallax. `--s-lag` is percent of the element's own
        height, and this one is deliberately the largest lag on the site: it is
        the furthest thing back, and everything else is measured against it.

        Inset by more than the lag travel so the drifting edges never enter the
        section.
      */}
      <div
        aria-hidden
        className="s-lag m-grid pointer-events-none absolute -inset-y-24 inset-x-0 opacity-60 [mask-image:radial-gradient(78%_66%_at_50%_0%,#000,transparent)]"
        style={{ '--s-lag': 8 } as React.CSSProperties}
      />

      {/* The horizon. Drawn by the scroll rather than faded in — see the
          .s-rule note in globals.css. */}
      <span
        aria-hidden
        className="s-rule pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[var(--m-gold)] opacity-40"
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
