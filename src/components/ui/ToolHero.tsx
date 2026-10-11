import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Letters } from '@/components/marketing/play/Letters';
import { Odometer } from '@/components/marketing/play/Odometer';
import { Springy } from '@/components/marketing/play/Springy';
import { HeroStage } from '@/components/marketing/play/HeroStage';

/**
 * How every tool opens.
 *
 * True Property Cost set the pattern: the answer as the largest thing on the
 * screen, one line under it saying what it is the answer to, the working beneath
 * that, and an arch with a scene in it standing alongside. Each tool fills it
 * with its own answer — the state of the desk, the difference between two
 * ledgers, a company's value — so the tools read as one family without any of
 * them pretending to be another.
 *
 * `variant` is the only real choice. A figure is a number set large and tight;
 * a headline is a sentence in the display face. The arch is hidden below `lg`,
 * where there is no room beside the text for it to stand in.
 */
export function ToolHero({
  label,
  pill,
  title,
  as: Heading = 'h1',
  variant = 'headline',
  sub,
  children,
  scene,
  glow = 'var(--lc-carry)',
  mark,
  id,
  className,
}: {
  label: ReactNode;
  pill?: { icon?: LucideIcon; text: ReactNode; tone?: string; live?: boolean };
  title: ReactNode;
  as?: 'h1' | 'h2';
  variant?: 'figure' | 'headline';
  sub?: ReactNode;
  children?: ReactNode;
  scene?: ReactNode;
  /** The colour of the light behind the title. */
  glow?: string;
  /**
   * A word or phrase in a headline title to draw the sun behind once the line
   * is in — the name in a greeting, the one word that is the answer. Must be
   * a substring of `title`; ignored otherwise.
   */
  mark?: string;
  id?: string;
  className?: string;
}) {
  const PillIcon = pill?.icon;
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'surface-lit a-ring relative isolate animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_backwards] overflow-hidden rounded-[2rem]',
        className,
      )}
      // Held behind the workspace's welcome while it plays (--intro-wait is
      // only set then; see play/IntroCurtain).
      style={{ animationDelay: 'var(--intro-wait, 0ms)' }}
    >
      <span
        aria-hidden
        className="a-orb -top-40 -left-24 size-[34rem] opacity-[0.16]"
        style={{ background: `radial-gradient(circle, ${glow}, transparent 66%)` }}
      />
      <span
        aria-hidden
        className="a-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(60%_70%_at_15%_0%,#000,transparent)]"
      />

      <div
        className={cn(
          'relative grid gap-8 p-6 sm:p-9',
          scene && 'lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_19rem]',
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="a-label" data-decode>
              {label}
            </span>
            {pill && (
              <span
                style={{ '--tone': pill.tone ?? 'var(--lc-carry)' } as CSSProperties}
                className="tinted inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold"
              >
                {pill.live && <span aria-hidden className="a-blip size-1.5 rounded-full bg-current" />}
                {PillIcon && <PillIcon className="size-3" aria-hidden />}
                {pill.text}
              </span>
            )}
          </div>

          {/*
            The play the public site's hero has, brought in here. A headline
            given as plain text is set letter by letter: the letters rise into
            place one after another, then lean up towards the pointer and warm
            to terracotta as it passes (Springy). A figure given as plain text
            rolls into place digit by digit like a counter (Odometer). Anything
            richer than a string is rendered as it was, untouched.
          */}
          {variant === 'figure' ? (
            <Heading
              id={id}
              className="mt-4 animate-[settle_0.9s_cubic-bezier(0.22,1,0.36,1)_backwards] text-[clamp(2.6rem,7vw,4.6rem)] leading-[0.95] font-semibold tracking-[-0.035em] text-balance tabular-nums"
            >
              {typeof title === 'string' || typeof title === 'number' ? (
                <Odometer value={String(title)} roll="load" delay={250} />
              ) : (
                title
              )}
            </Heading>
          ) : typeof title === 'string' ? (
            <Springy
              as={Heading}
              id={id}
              className="p-letters m-display mt-4 text-[clamp(2rem,4.8vw,3.25rem)] leading-[1.02] text-balance"
            >
              <HeadlineLetters title={title} mark={mark} />
            </Springy>
          ) : (
            <Heading id={id} className="m-display mt-4 text-[clamp(2rem,4.8vw,3.25rem)] leading-[1.02] text-balance">
              {title}
            </Heading>
          )}
          {sub && <div className="text-muted mt-3 max-w-2xl text-[15px] leading-relaxed text-pretty sm:text-base">{sub}</div>}

          {children}
        </div>

        {/* The arch grows with the hero but stops at 26rem and stays centred
            beside the text: in a tall hero, an arch stretched to full height
            left a long empty sky between the sun and the scene. */}
        {/* HeroStage: the arch's sun drifts with the pointer across the hero
            and its scene against it, so the window has depth. */}
        {scene && (
          <HeroStage className="hidden lg:flex lg:flex-col lg:justify-center [&>*]:max-h-[26rem]">{scene}</HeroStage>
        )}
      </div>
    </section>
  );
}

/**
 * A headline set letter by letter, with the marked phrase (if any) wrapped in
 * the sun highlighter. The letters are numbered straight through, so the
 * entrance runs left to right across the mark rather than restarting in it.
 */
function HeadlineLetters({ title, mark }: { title: string; mark?: string }) {
  const at = mark ? title.indexOf(mark) : -1;
  if (!mark || at < 0) return <Letters text={title} />;
  const before = title.slice(0, at);
  const after = title.slice(at + mark.length);
  const count = (s: string) => s.replace(/\s+/g, '').length;
  return (
    <>
      {before && <Letters text={before} />}
      <span className="m-mark [--mark-delay:900ms]">
        <Letters text={mark} start={count(before)} />
      </span>
      {after && <Letters text={after} start={count(before) + count(mark)} />}
    </>
  );
}

/**
 * A figure in a tile, for the working under a hero: Paid + Carrying = True cost.
 * `strong` is the one tile that holds the answer, in the action fill.
 */
export function HeroStat({
  label,
  value,
  note,
  tone,
  strong,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  /** A dot beside the label, in the colour this figure has in the charts. */
  tone?: string;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        strong
          ? 'min-w-0 rounded-2xl bg-[var(--action)] px-4 py-3.5 text-[var(--on-action)] shadow-[var(--elev-brand)]'
          : 'surface-sunken min-w-0 rounded-2xl border px-4 py-3.5',
        className,
      )}
    >
      {/* Wraps rather than truncates: truncation on a flex child cuts the
          label mid-word with no ellipsis, and on a phone tiles get narrow. */}
      <p
        className={cn(
          'flex items-baseline gap-1.5 leading-snug',
          strong ? 'text-[10px] font-semibold tracking-[0.12em] uppercase opacity-75' : 'a-label',
        )}
      >
        {tone && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: tone }} />}
        <span className="min-w-0 break-words">{label}</span>
      </p>
      <div className="mt-1.5 truncate text-[1.15rem] font-semibold tracking-tight tabular-nums">
        {typeof value === 'string' || typeof value === 'number' ? (
          <Odometer value={String(value)} roll="view" />
        ) : (
          value
        )}
      </div>
      {note && (
        <p className={strong ? 'mt-0.5 text-[12px] leading-snug opacity-75' : 'text-subtle mt-0.5 text-[12px] leading-snug'}>{note}</p>
      )}
    </div>
  );
}

/** A fact about the answer, set as a pill under it. */
export function HeroChip({ icon: Icon, children, className }: { icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'surface-sunken text-muted inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px]',
        className,
      )}
    >
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
      {children}
    </span>
  );
}
