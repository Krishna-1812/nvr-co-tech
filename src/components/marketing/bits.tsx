import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STAGE_LABEL, type Agent, type AgentStage } from '@/lib/marketing/content';

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
 * display line-height is now 0.9, so the box is a tenth of an em *shorter* than
 * the em square before any descender is considered — a "y" in the last line was
 * being cut through. The margin cancels it exactly, so the extra room costs no
 * space between lines.
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
        '-mt-[0.08em] -mb-[0.3em] block overflow-hidden pt-[0.08em] pb-[0.3em]',
        className,
      )}
    >
      <span
        className="block animate-[lift_0.95s_cubic-bezier(0.16,1,0.3,1)_backwards] motion-reduce:animate-none"
        style={delay ? { animationDelay: `${delay}ms` } : undefined}
      >
        {children}
      </span>
    </span>
  );
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
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
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
      {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
      <h2 className="m-display text-[clamp(1.9rem,4.2vw,3.25rem)]">{title}</h2>
      {lead && <p className="m-dim mt-5 text-[15px] leading-relaxed sm:text-base">{lead}</p>}
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
 * A blurred colour field. Purely decorative light, positioned by the caller —
 * these are what stop a near-black page reading as flat.
 */
export function Aurora({
  color,
  className,
  opacity = 0.5,
}: {
  color: string;
  className?: string;
  opacity?: number;
}) {
  return (
    <span
      aria-hidden
      className={cn('m-aurora', className)}
      style={{ background: color, opacity }}
    />
  );
}

export function StageBadge({ stage, className }: { stage: AgentStage; className?: string }) {
  const tone =
    stage === 'live'
      ? 'text-[var(--m-emerald)] border-[color-mix(in_oklab,var(--m-emerald)_36%,transparent)] bg-[color-mix(in_oklab,var(--m-emerald)_12%,transparent)]'
      : stage === 'building'
        ? 'text-[var(--m-amber)] border-[color-mix(in_oklab,var(--m-amber)_32%,transparent)] bg-[color-mix(in_oklab,var(--m-amber)_10%,transparent)]'
        : 'm-dim-2 border-[var(--m-line)]';

  return (
    <span
      className={cn(
        'm-mono inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-[0.1em] uppercase',
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
    'group inline-flex h-12 items-center justify-center gap-2.5 rounded-[4px] px-6 text-[13px] font-semibold tracking-[0.01em] transition-[transform,background-color,border-color,color] duration-200 active:scale-[0.985]';

  /*
   * Primary is the bone slab — the strongest thing available on this ground,
   * and the owl's own contrast. It used to be a violet→cyan gradient under a
   * 30px violet glow, which is the single most recognisable button on the
   * internet right now.
   *
   * Secondary is a hairline box that fills with the ink on hover rather than
   * lightening, so the pair reads as one control in two states.
   */
  const look =
    variant === 'primary'
      ? 'bg-[var(--m-ink)] text-[var(--m-on-grad)] shadow-[0_1px_0_oklch(1_0_0_/_0.6)_inset,0_10px_28px_oklch(0_0_0_/_0.45)] hover:bg-[oklch(1_0_0)]'
      : 'border border-[var(--m-line-2)] text-[var(--m-ink)] hover:border-[var(--m-gold)] hover:text-[var(--m-gold)]';

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
        'group m-mono inline-flex items-center gap-1.5 text-[11px] font-medium tracking-[0.12em] text-[var(--m-ink)] uppercase transition hover:text-[var(--m-gold)]',
        className,
      )}
    >
      {children}
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
    </Link>
  );
}

/** A single large figure with a caption. Used in the stats band. */
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
    <div>
      <p className="m-display text-[clamp(2.2rem,5vw,3.4rem)] leading-none">{value}</p>
      <p className="m-eyebrow mt-3">{label}</p>
      {hint && <p className="m-dim-2 mt-1.5 text-xs">{hint}</p>}
    </div>
  );
}
