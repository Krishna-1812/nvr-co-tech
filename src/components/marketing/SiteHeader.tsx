'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV } from '@/lib/marketing/content';
import { Container } from './bits';
import { Logo } from './Logo';
import { ScrollProgressBar } from './motion';

/**
 * The public site's header.
 *
 * Transparent over the hero and only growing a hairline and a blur once the
 * page has moved — a border that is there from the first pixel cuts the hero
 * off from the top of the window, which is the one place it should feel open.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /*
   * A menu left open across a navigation covers the page you just asked for.
   *
   * Adjusting state during render rather than in an effect: React re-runs this
   * component immediately with the corrected value, before anything is painted,
   * so the menu is never briefly visible over the new page. Doing it in an
   * effect would paint the stale open menu first, and closing it from each
   * link's onClick would miss the back and forward buttons.
   */
  const [menuRoute, setMenuRoute] = useState(pathname);
  if (menuRoute !== pathname) {
    setMenuRoute(pathname);
    setOpen(false);
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300',
        scrolled || open
          ? 'm-glass border-b border-[var(--m-line)]'
          : 'border-b border-transparent',
      )}
    >
      {/*
        How far through the page the reader is, drawn on the header's own bottom
        edge rather than as a separate bar above it. It only appears once the
        page has moved, because at the top it would be a 0-width line under a
        transparent header — visual noise reporting nothing.
      */}
      {scrolled && <ScrollProgressBar />}
      <Container wide>
        <div className="flex h-[68px] items-center gap-4 lg:gap-6">
          <Link href="/" className="shrink-0 transition hover:opacity-85">
            <Logo />
          </Link>

          {/*
            No pills.

            A row of rounded-full chips is the default navigation of every
            component library, and it puts four competing shapes across the top
            of a page whose whole vocabulary below is hairlines and right
            angles. The current page is marked by a gold rule under the label
            instead — the same rule that separates every section further down,
            doing the same job at a smaller size.
          */}
          <nav className="ml-2 hidden items-center gap-7 md:flex lg:ml-8">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative py-2 t-3 font-medium transition-colors duration-200',
                    active ? 'text-[var(--m-ink)]' : 'm-dim hover:text-[var(--m-ink)]',
                  )}
                >
                  {item.label}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute inset-x-0 -bottom-0.5 h-px origin-left bg-[var(--m-gold)] transition-transform duration-300 ease-out',
                      active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100',
                    )}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/login"
              data-signin=""
              className="m-dim hidden px-1 py-2 t-3 font-medium whitespace-nowrap transition-colors hover:text-[var(--m-ink)] sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/contact"
              data-demo=""
              data-interest="Header"
              className="hidden h-9 items-center rounded-lg bg-[var(--m-ink)] px-4 t-2 font-semibold whitespace-nowrap text-[var(--m-on-grad)] transition-colors duration-200 hover:bg-[oklch(1_0_0)] active:scale-[0.985] sm:inline-flex"
            >
              Book a walkthrough
            </Link>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? 'Close menu' : 'Open menu'}
              className="grid size-9 place-items-center rounded-lg border border-[var(--m-line-2)] transition-colors hover:border-[var(--m-gold)] hover:text-[var(--m-gold)] md:hidden"
            >
              {open ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
            </button>
          </div>
        </div>
      </Container>

      {open && (
        <div className="border-t border-[var(--m-line)] md:hidden">
          <Container wide>
            <nav className="flex flex-col py-3">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="m-dim rounded-lg px-2 py-3 t-4 font-medium transition hover:bg-white/5 hover:text-[var(--m-ink)]"
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-3 flex gap-2 border-t border-[var(--m-line)] pt-4 pb-2">
                <Link
                  href="/login"
                  data-signin=""
                  className="flex h-11 flex-1 items-center justify-center rounded-lg border border-[var(--m-line-2)] t-3 font-semibold"
                >
                  Sign in
                </Link>
                <Link
                  href="/contact"
                  data-demo=""
                  data-interest="Phone menu"
                  className="flex h-11 flex-1 items-center justify-center rounded-lg bg-[var(--m-ink)] t-3 font-semibold text-[var(--m-on-grad)]"
                >
                  Book a walkthrough
                </Link>
              </div>
            </nav>
          </Container>
        </div>
      )}
    </header>
  );
}
