import Link from 'next/link';
import { ArrowLeft, ChevronRight, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Section } from '@/lib/nav';
import { BRAND } from '@/lib/marketing/content';
import { SOLUTIONS } from '@/lib/solutions';
import { LogoMark } from '../marketing/Logo';

/**
 * The way back out of a tool, at the top left of every tool.
 *
 * A tool used to say only its own name, and the only door back to the workspace
 * was a 15px grid icon in the rail — which disappeared when the rail collapsed,
 * and was never there at all on a phone. Somebody deep in the voucher register
 * had no way of knowing there was anything above them.
 *
 * So this is a breadcrumb rather than a back button, because the missing idea was
 * hierarchy, not history. "The Finance Intelligence › Voucher Desk" says both where
 * you are and that there is a level above it, and both crumbs are real links: the
 * platform to the hub, the tool to its own front door. A back button would only
 * have said "somewhere else", and would have lied the moment somebody arrived
 * here from a bookmark.
 *
 * The mark turns into an arrow on hover. It is the one piece of theatre in here,
 * and it earns its place: at rest the mark identifies the destination, and on
 * approach it says what will happen when you click.
 */
export function HomeCrumb({ section }: { section: Section }) {
  // The tool's own mark and accent, from the roster the hub renders. The
  // assistant is deliberately not on the roster — it is a way of asking about the
  // tools rather than one of them — so it falls back to its own mark and the
  // house colour.
  const solution = SOLUTIONS.find((entry) => entry.slug === section.slug);
  const Icon = solution?.icon ?? Sparkles;
  const tone = solution?.tone ?? 'var(--color-brand-600)';

  // The nav may shrink, and when it does it is the tool's name that gives way,
  // cut short with an ellipsis: the marks and the search box keep their size,
  // because an icon squeezed narrower than itself is no icon at all. The cap on
  // the tool crumb is what stops a long name pushing the account menu off the
  // screen.
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center sm:shrink-0">
      <ol className="flex min-w-0 items-center gap-0.5">
        {/* ── The platform, which is the way home ── */}
        <li className="shrink-0">
          <Link
            href="/hub"
            title="All solutions"
            aria-label={`${BRAND.name}, all solutions`}
            className="group/home flex h-9 items-center gap-2.5 rounded-xl border border-transparent px-1.5 transition duration-200 hover:border-[var(--border-c)] hover:bg-[var(--surface-sunken)] lg:pr-3"
          >
            <span className="relative grid size-7 shrink-0 place-items-center">
              <LogoMark
                id="crumb-mark"
                className="size-7 transition duration-200 ease-out group-hover/home:scale-90 group-hover/home:opacity-0"
              />
              {/*
                Sitting on top of the mark rather than replacing it, so the pill
                never changes width and the two never reflow past each other.
                It slides the way it is pointing.
              */}
              <ArrowLeft
                aria-hidden
                className="absolute size-[17px] translate-x-1 opacity-0 transition duration-200 ease-out group-hover/home:translate-x-0 group-hover/home:opacity-100"
              />
            </span>
            {/* Below lg the rail is gone and the bar is carrying the tool's name,
                the palette and the account menu. The platform's name is the first
                thing that can be spared, and the mark still says it. */}
            <span className="hidden text-[13px] font-semibold tracking-tight lg:block">
              {BRAND.name}
            </span>
          </Link>
        </li>

        <li aria-hidden className="text-subtle hidden shrink-0 sm:block">
          <ChevronRight className="size-3.5" />
        </li>

        {/* ── Where you actually are ── */}
        <li className="min-w-0">
          <Link
            href={section.home}
            style={{ '--tone': tone } as CSSProperties}
            className="group/tool flex h-9 min-w-0 max-w-[15rem] items-center gap-2 rounded-xl border border-transparent px-2 transition duration-200 hover:border-[var(--border-c)] hover:bg-[var(--surface-sunken)]"
          >
            <span
              aria-hidden
              className="tinted grid size-6 shrink-0 place-items-center rounded-lg border transition duration-200 group-hover/tool:scale-105"
            >
              <Icon className="size-[13px]" />
            </span>
            {/*
              On a phone too, cut short if it must (and left out below 360px, where the marks are all that fits): with only the two marks the
              bar did not say which tool this was, and the hairline under it is
              not a name. The platform's name is what gives way, not this.
            */}
            <span className="max-w-[6.5rem] truncate text-[13px] font-semibold tracking-tight max-[359px]:hidden sm:max-w-none">
              {section.name}
            </span>
          </Link>
        </li>
      </ol>
    </nav>
  );
}
