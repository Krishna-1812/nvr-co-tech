import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STAGE_LABEL, type Agent, type AgentStage } from '@/lib/marketing/content';
import { ArchScene as SceneArch, type SceneMotif } from '@/components/ui/Scene';

/**
 * The vocabulary the public site is built from. Every marketing page composes
 * these rather than restyling from scratch, which is what keeps six pages
 * looking like one site.
 */

/** Accent name → the token it resolves to. Agents each own one. */
export const ACCENT: Record<Agent['accent'], string> = {
  indigo: 'var(--m-indigo)',
  violet: 'var(--m-violet)',
  cyan: 'var(--m-cyan)',
  emerald: 'var(--m-emerald)',
  amber: 'var(--m-amber)',
  rose: 'var(--m-rose)',
  lime: 'var(--m-lime)',
  magenta: 'var(--m-magenta)',
};

/**
 * An agent's colour when it is used *as* type on the page ground.
 *
 * The same eight, except where the hue is too light to read at text sizes:
 * sun (1.8:1) and sage (2.5:1) give way to ochre and olive, the nearest of
 * the darker earths. Every other hue is its own colour, at 4.5:1 or better on
 * bone.
 */
export const ACCENT_TEXT: Record<Agent['accent'], string> = {
  ...ACCENT,
  amber: 'var(--m-violet)',
  lime: 'var(--m-emerald)',
};

/**
 * What to set type in when it sits on an agent's own colour.
 *
 * Six of the eight earth hues are dark enough for bone type; sun and sage are
 * not (1.8:1 and 2.5:1) and take ink instead (8.3:1 and 5.9:1). Kept beside
 * ACCENT so a hue cannot be added to one without being seen in the other.
 */
export const ON_ACCENT: Record<Agent['accent'], string> = {
  indigo: 'var(--m-on-grad)',
  violet: 'var(--m-on-grad)',
  cyan: 'var(--m-on-grad)',
  emerald: 'var(--m-on-grad)',
  amber: 'var(--m-ink)',
  rose: 'var(--m-on-grad)',
  lime: 'var(--m-ink)',
  magenta: 'var(--m-on-grad)',
};

/**
 * A headline line that rises into place from behind a clip.
 *
 * Pure CSS and therefore not waiting on hydration, which is the whole point
 * above the fold — see the note on Rise. Each line is its own clipping box, so
 * the type appears to be revealed by the layout rather than faded in.
 *
 * `overflow-hidden` on the outer span would clip descenders, so the box is given
 * a little vertical breathing room and pulled back with a negative margin.
 *
 * 0.3em, not the 0.18em it was. The clip box is one line-height tall and the
 * display line-height is 0.94, so the box is shorter than the em square before
 * any descender is considered — a "y" in the last line was being cut through.
 * The margin cancels the padding exactly, so the extra room costs no space
 * between lines, which is why it is set generously rather than to the minimum
 * that happens to work at today's line-height.
 */
export function LineRise({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'm-line -mt-[0.08em] -mb-[0.3em] block overflow-hidden pt-[0.08em] pb-[0.3em]',
        className,
      )}
    >
      <span
        className="block animate-[lift_0.95s_cubic-bezier(0.16,1,0.3,1)_backwards] motion-reduce:animate-none"
        style={{ animationDelay: introDelay(delay) }}
      >
        {children}
      </span>
    </span>
  );
}

/**
 * An above-the-fold entrance delay, plus however long the opening sequence is
 * still covering the page. `--intro-wait` is only set while the home page's
 * curtain is up (see play/IntroCurtain), so everywhere else this is the delay
 * as given.
 */
function introDelay(delay: number) {
  return `calc(var(--intro-wait, 0ms) + ${delay}ms)`;
}

export function Container({
  children,
  className,
  wide = false,
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div className={cn('mx-auto w-full px-5 sm:px-8', wide ? 'max-w-[1400px]' : 'max-w-6xl', className)}>
      {children}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('m-eyebrow', className)}>{children}</p>;
}

/**
 * Entrance animation for content that is already on screen at load.
 *
 * Pure CSS, and therefore not waiting on hydration — unlike <Reveal>, which
 * cannot un-hide anything until its effect runs. Below the fold that wait is
 * invisible; above it, it is the difference between a page that appears
 * instantly and a blank screen until the JavaScript lands. Use Rise for the
 * hero, Reveal for everything the reader has to scroll to.
 */
export function Rise({
  children,
  delay = 0,
  className,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'p' | 'h1';
}) {
  return (
    <Tag
      className={cn('animate-[rise_0.7s_cubic-bezier(0.22,1,0.36,1)_backwards]', className)}
      style={{ animationDelay: introDelay(delay) }}
    >
      {children}
    </Tag>
  );
}

/** A section's label, headline and standfirst, spaced consistently. */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  center = false,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(center && 'mx-auto text-center', 'max-w-3xl', className)}>
      {eyebrow && (
        // `justify-center` matters: the parent's `text-center` has no effect on
        // a flex row, so a centred section heading would otherwise keep its
        // label hard against the left edge.
        <div className={cn('mb-4 flex items-center gap-3.5', center && 'justify-center')}>
          <span aria-hidden className="s-rule h-px w-10 bg-[var(--m-gold)]" />
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
      )}
      {/*
        `.s-settle` opens the headline from `wdth` 72 to its drawn 86 as the
        section arrives — the one piece of motion on this site that could not
        exist without a variable typeface, and the reason the width axis was
        worth choosing a family for.

        It is also the clearest case for the stepped easing. Animating
        `font-variation-settings` means re-shaping the line, which is real work
        the compositor cannot skip; `steps(14)` means that happens fourteen
        times over the whole entrance instead of once a frame. The effect that
        reads as deliberate is also the one that is cheap.
      */}
      <h2 className="m-display s-settle t-h2">{title}</h2>
      {lead && <p className="m-dim mt-5 t-4 sm:t-4">{lead}</p>}
    </div>
  );
}

/** Vertical rhythm for a page section, with an optional hairline above. */
export function Section({
  children,
  id,
  className,
  divider = true,
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
  divider?: boolean;
}) {
  return (
    <section id={id} className={cn('relative py-20 sm:py-28', className)}>
      {/*
        The divider is an element rather than a border, so it can be drawn.

        A `border-t` is either there or it is not. This is a hairline that
        scales from its left edge as the section arrives, in the same held steps
        as everything else — so scrolling down the page draws each rule in turn,
        and scrolling back up unwrites them. It is the smallest possible piece
        of motion and it is on every section boundary on the site, which is what
        makes the page feel like one continuous object rather than a stack of
        blocks that each animate on their own.
      */}
      {divider && (
        <span
          aria-hidden
          className="s-rule absolute inset-x-0 top-0 h-px bg-[var(--m-line)]"
        />
      )}
      {children}
    </section>
  );
}

/**
 * Which of the tools' scenes stands in an agent's doorway.
 *
 * The live tools use the motif their own screen opens on (components/ui/Scene),
 * so the arch on /agents/true-property-cost is the same tower a visitor meets
 * after signing in, and the public page and the product read as one thing.
 * The roadmap ones borrow the nearest picture of the job: a ledger for matching
 * GST, a sundial for the TDS calendar, the gate for documents coming in, and
 * the owl for the one that answers questions.
 */
export const AGENT_MOTIF: Record<string, SceneMotif> = {
  'voucher-desk': 'voucher',
  'ledger-reconciliation': 'scales',
  'valuation-desk': 'columns',
  'contact-finder': 'seekers',
  'true-property-cost': 'tower',
  'gst-reconciliation': 'ledger',
  'tds-compliance': 'sundial',
  'invoice-intake': 'gate',
  'audit-copilot': 'owl',
};

/** A slug added to the roster without a motif still gets a doorway. */
export const motifFor = (slug: string): SceneMotif => AGENT_MOTIF[slug] ?? 'doorways';

/**
 * The arch every inner page stands in front of.
 *
 * A doorway at the right of a hero, framed in the page's colour, with one of
 * the tools' scenes standing inside it: the row of doorways on /agents, the owl
 * on /about, the sundial on /contact, a ledger and a balance on the two legal
 * pages. It used to be the same empty window with the sun in it on every page,
 * the site's one image said six times over; the frame keeps that image and the
 * scene says what this particular page is about.
 *
 * The frame is a second arch drawn round the scene's own. With a uniform inset
 * both semicircles share a centre, so the band between them is an even width
 * all the way over the crown, the way a stone surround is cut.
 *
 * Only from lg up: below that the hero's text takes the whole width, and a
 * doorway squeezed in beside it would be a sliver.
 *
 * It is absolutely placed, so the hero it sits in has to leave it room: each
 * one pads its text column by lg:pr-[25rem] xl:pr-[28rem], which is the arch's
 * width plus its inset from the edge plus a gutter.
 */
export function ArchScene({
  motif = 'doorways',
  color = 'var(--m-bg-3)',
  className,
}: {
  motif?: SceneMotif;
  /** The frame round the doorway. The legal pages pass their own earth hue. */
  color?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'm-arch m-arch-open pointer-events-none absolute right-[5%] bottom-0 hidden h-[min(31rem,calc(100%-3rem))] w-[20rem] p-3 lg:block xl:right-[8%]',
        className,
      )}
      style={{ background: color }}
    >
      <SceneArch motif={motif} className="h-full min-h-0" />
    </div>
  );
}

export function StageBadge({ stage, className }: { stage: AgentStage; className?: string }) {
  const tone =
    stage === 'live'
      ? 'text-[var(--m-emerald)] border-[color-mix(in_oklab,var(--m-emerald)_36%,transparent)] bg-[color-mix(in_oklab,var(--m-emerald)_12%,transparent)]'
      : stage === 'building'
        ? 'text-[var(--m-wait)] border-[var(--m-wait-line)] bg-[var(--m-wait-wash)]'
        : 'm-dim-2 border-[var(--m-line)]';

  return (
    <span
      className={cn(
        'm-mono inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 t-1 font-medium t-caps uppercase',
        tone,
        className,
      )}
    >
      {stage === 'live' && (
        <span className="relative grid size-1.5 place-items-center">
          <span className="absolute size-1.5 animate-ping rounded-full bg-[var(--m-emerald)] opacity-70" />
          <span className="size-1.5 rounded-full bg-[var(--m-emerald)]" />
        </span>
      )}
      {STAGE_LABEL[stage]}
    </span>
  );
}

/** The site's primary and secondary buttons. */
export function CTA({
  href,
  children,
  variant = 'primary',
  className,
  external = false,
  data,
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'ghost';
  className?: string;
  external?: boolean;
  /**
   * Data attributes for the analytics tracker's call-to-action taxonomy.
   *
   * Attributes rather than matching on the href, deliberately. A taxonomy keyed
   * on URLs breaks silently the day somebody moves a page: the button keeps
   * working, the tracker stops recognising it, and the metric quietly goes to
   * zero with no error anywhere. An attribute travels with the button.
   */
  data?: Record<string, string>;
}) {
  /*
   * A rectangle, not a pill.
   *
   * The rounded-full button is the most-copied control on the web and it was
   * fighting the rest of the page: every other edge here is a hairline or a
   * right angle. A 4px radius keeps it from looking unfinished and nothing
   * more.
   */
  const base =
    'm-flood group inline-flex h-12 items-center justify-center gap-2.5 rounded-full px-7 t-3 font-semibold transition-[transform,background-color,border-color,color] duration-300 active:scale-[0.985]';

  /*
   * Primary is the bone slab — the strongest thing available on this ground,
   * and the owl's own contrast. It used to be a violet→cyan gradient under a
   * 30px violet glow, which is the single most recognisable button on the
   * internet right now.
   *
   * Secondary is a hairline box that fills with the ink on hover rather than
   * lightening, so the pair reads as one control in two states.
   *
   * Both fill by flooding (`.m-flood`): the hover colour spreads out from the
   * point the pointer came in at — terracotta over the ink slab, ink into the
   * hairline box — and drains back out the way it leaves. `--flood` is the
   * colour, so a call site on another ground changes one variable.
   */
  const look =
    variant === 'primary'
      ? 'bg-[var(--m-ink)] text-[var(--m-on-grad)] shadow-[0_14px_28px_-16px_rgb(43_33_27_/_0.7)]'
      : 'border-[1.5px] border-[var(--m-ink)] text-[var(--m-ink)] [--flood:var(--m-ink)] hover:text-[var(--m-on-grad)]';

  return (
    <Link
      href={href}
      className={cn(base, look, className)}
      {...data}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {children}
      {external ? (
        <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
      ) : (
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      )}
    </Link>
  );
}

/** Understated text link with a travelling arrow. */
export function ArrowLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group m-mono inline-flex items-center gap-1.5 t-2 font-medium t-caps text-[var(--m-ink)] uppercase transition hover:text-[var(--m-gold)]',
        className,
      )}
    >
      {children}
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
    </Link>
  );
}

/**
 * A single large figure with a caption, set as a plate. Used in the stats band.
 *
 * A plate rather than bare type on the ground: three figures in 3rem with
 * nothing round them read as a row of loose numbers, where on cards each reads
 * as a fact with its own edge. The arch in the corner, with the sun low in it,
 * is the site's mark at the size of a stamp.
 */
export function Stat({
  value,
  label,
  hint,
}: {
  value: React.ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <div className="m-card relative h-full overflow-hidden rounded-3xl p-7 sm:p-8">
      <span
        aria-hidden
        className="m-arch absolute top-6 right-6 h-14 w-11 overflow-hidden bg-[var(--m-bg-2)]"
      >
        <span className="absolute bottom-0 left-1/2 size-7 -translate-x-1/2 translate-y-1/3 rounded-full bg-[var(--m-sun)]" />
      </span>
      <p className="m-display t-h1 tabular-nums">{value}</p>
      <p className="m-eyebrow mt-4">{label}</p>
      {hint && <p className="m-dim-2 mt-1.5 t-3">{hint}</p>}
    </div>
  );
}
