'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV } from '@/lib/marketing/content';
import { Container } from './bits';
import { Logo } from './Logo';

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
      <Container wide>
        <div className="flex h-[68px] items-center gap-6">
          <Link href="/" className="shrink-0 transition hover:opacity-85">
            <Logo />
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-full px-3.5 py-2 text-[13px] font-medium transition',
                    active
                      ? 'bg-white/8 text-[var(--m-ink)]'
                      : 'm-dim hover:bg-white/5 hover:text-[var(--m-ink)]',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/login"
              className="m-dim hidden rounded-full px-4 py-2 text-[13px] font-medium transition hover:text-[var(--m-ink)] sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/contact"
              className="hidden h-9 items-center rounded-full px-4 text-[13px] font-semibold text-white transition hover:brightness-110 active:scale-[0.98] sm:inline-flex"
              style={{ backgroundImage: 'var(--m-grad)' }}
            >
              Book a walkthrough
            </Link>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? 'Close menu' : 'Open menu'}
              className="grid size-9 place-items-center rounded-full border border-[var(--m-line)] transition hover:border-[var(--m-line-2)] md:hidden"
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
                  className="m-dim rounded-lg px-2 py-3 text-[15px] font-medium transition hover:bg-white/5 hover:text-[var(--m-ink)]"
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-3 flex gap-2 border-t border-[var(--m-line)] pt-4 pb-2">
                <Link
                  href="/login"
                  className="flex h-11 flex-1 items-center justify-center rounded-full border border-[var(--m-line-2)] text-sm font-semibold"
                >
                  Sign in
                </Link>
                <Link
                  href="/contact"
                  className="flex h-11 flex-1 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundImage: 'var(--m-grad)' }}
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
