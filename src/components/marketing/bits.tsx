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
};

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
    <section
      id={id}
      className={cn(
        'relative py-20 sm:py-28',
        divider && 'border-t border-[var(--m-line)]',
        className,
      )}
    >
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
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'ghost';
  className?: string;
  external?: boolean;
}) {
  const base =
    'group inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition active:scale-[0.98]';

  const look =
    variant === 'primary'
      ? 'text-white shadow-[0_10px_30px_oklch(0.64_0.18_274_/_0.35)] hover:brightness-110'
      : 'border border-[var(--m-line-2)] text-[var(--m-ink)] hover:border-[var(--m-ink)] hover:bg-white/5';

  return (
    <Link
      href={href}
      className={cn(base, look, className)}
      style={variant === 'primary' ? { backgroundImage: 'var(--m-grad)' } : undefined}
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
        'group m-mono inline-flex items-center gap-1.5 text-[11px] font-medium tracking-[0.12em] uppercase text-[var(--m-ink)] transition hover:text-[var(--m-cyan)]',
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
