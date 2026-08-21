import Link from 'next/link';
import { AGENTS, BRAND, CONTACT, ROSTER } from '@/lib/marketing/content';
import { Container } from './bits';
import { Logo } from './Logo';

/**
 * The bottom of every public page.
 *
 * ── What was wrong with it ──────────────────────────────────────────────────
 *
 * The agents column was `AGENTS.slice(0, 5)`, which is five of six chosen by
 * arithmetic rather than by anybody. It dropped Audit Copilot for the whole life
 * of the site, and it would silently drop whichever agent happened to be last
 * the next time one was added. If a column is too long, the fix is a shorter
 * column and not a truncated one.
 *
 * There was also no closing bar at all. The page simply stopped, with the legal
 * links filed under "Company" between About and Contact, which is where you put
 * them if you do not want them found.
 */

const LEGAL = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const;

const ACCOUNT = [
  { href: '/login', label: 'Sign in' },
  { href: '/signup', label: 'Create an account' },
] as const;

const COMPANY = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Book a walkthrough' },
] as const;

/*
 * Stamped when the page is built.
 *
 * These pages are static, so this is the year of the last deploy rather than the
 * year the reader is in. That is the ordinary trade every site makes, and it is
 * the right way round: a copyright line that is one deploy stale is unremarkable,
 * while making the footer read the clock would make every public page dynamic.
 */
const YEAR = new Date().getFullYear();

export function SiteFooter() {
  return (
    <footer className="relative border-t border-[var(--m-line)]">
      <Container wide className="pt-16 pb-10">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo id="footer-mark" />
            <p className="m-dim-2 mt-5 text-[13px] leading-relaxed">{BRAND.blurb}</p>
            <a
              href={`mailto:${CONTACT.email}`}
              className="m-mono m-dim-2 mt-5 inline-block text-[12px] transition hover:text-[var(--m-ink)]"
            >
              {CONTACT.email}
            </a>
          </div>

          <FooterCol title="Agents">
            {/* All of them. A dot marks the ones you can open today, which is
                the only thing anybody scanning this column wants to know. */}
            {AGENTS.map((a) => (
              <FooterLink key={a.slug} href={`/agents/${a.slug}`}>
                {a.name}
                {a.stage === 'live' && (
                  <span
                    aria-label="live"
                    title="Live"
                    className="ml-2 inline-block size-1.5 rounded-full bg-[var(--m-emerald)] align-middle"
                  />
                )}
              </FooterLink>
            ))}
          </FooterCol>

          <FooterCol title="Company">
            {COMPANY.map((n) => (
              <FooterLink key={n.href} href={n.href}>
                {n.label}
              </FooterLink>
            ))}
          </FooterCol>

          <FooterCol title="Your account">
            {ACCOUNT.map((r) => (
              <FooterLink key={r.href} href={r.href}>
                {r.label}
              </FooterLink>
            ))}
          </FooterCol>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-[var(--m-line)] pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="m-dim-2 text-[12.5px]">
            © {YEAR} {BRAND.name}. Built by chartered accountants, in Mumbai.
          </p>

          <div className="m-dim-2 flex items-center gap-5 text-[12.5px]">
            {/* Figures, not words. This is a mono micro-label, where "two of 6"
                was the worst of both and "two of six" reads as prose in a slot
                that is not prose. */}
            <span className="m-mono text-[10px] tracking-[0.14em] uppercase tabular-nums">
              {ROSTER.live} of {ROSTER.total} live
            </span>
            <span aria-hidden className="h-3 w-px bg-[var(--m-line-2)]" />
            {LEGAL.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="transition hover:text-[var(--m-ink)]"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="m-eyebrow">{title}</p>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="m-dim text-[13px] transition hover:text-[var(--m-ink)]">
        {children}
      </Link>
    </li>
  );
}
