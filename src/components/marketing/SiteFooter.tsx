import Link from 'next/link';
import { AGENTS, BRAND, NAV } from '@/lib/marketing/content';
import { Container } from './bits';
import { Logo } from './Logo';

const RESOURCES = [
  { href: '/agents', label: 'All agents' },
  { href: '/login', label: 'Sign in' },
  { href: '/signup', label: 'Create an account' },
] as const;

const LEGAL = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const;

export function SiteFooter() {
  return (
    <footer className="relative border-t border-[var(--m-line)]">
      <Container wide className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo id="footer-mark" />
            <p className="m-dim-2 mt-5 text-[13px] leading-relaxed">{BRAND.blurb}</p>
          </div>

          <FooterCol title="Agents">
            {AGENTS.slice(0, 5).map((a) => (
              <FooterLink key={a.slug} href={`/agents/${a.slug}`}>
                {a.name}
              </FooterLink>
            ))}
          </FooterCol>

          <FooterCol title="Company">
            {NAV.map((n) => (
              <FooterLink key={n.href} href={n.href}>
                {n.label}
              </FooterLink>
            ))}
            {LEGAL.map((l) => (
              <FooterLink key={l.href} href={l.href}>
                {l.label}
              </FooterLink>
            ))}
          </FooterCol>

          <FooterCol title="Product">
            {RESOURCES.map((r) => (
              <FooterLink key={r.href} href={r.href}>
                {r.label}
              </FooterLink>
            ))}
          </FooterCol>
        </div>

        <div className="m-dim-2 mt-14 flex flex-col gap-3 border-t border-[var(--m-line)] pt-8 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="m-mono tracking-[0.08em]">Hosted in Mumbai · ap-south-1</p>
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
      <Link
        href={href}
        className="m-dim text-[13px] transition hover:text-[var(--m-ink)]"
      >
        {children}
      </Link>
    </li>
  );
}
