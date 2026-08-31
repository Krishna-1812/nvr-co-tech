import Link from 'next/link';
import { cn } from '@/lib/utils';
import { breadcrumbLd, ldJson, type Crumb } from '@/lib/marketing/seo';

/**
 * Where you are, and the way back out.
 *
 * Every inner page gets one. It replaces the lone "All agents" link the agent
 * pages used to carry, which told you one way back rather than where you were,
 * and it gives the legal pages the only internal links they had.
 *
 * ── Why the markup and the structured data are one component ────────────────
 *
 * Google's guidance is that a BreadcrumbList should describe the trail a reader
 * can actually see. Two separate call sites — a <nav> in the page and a
 * BreadcrumbList in its metadata — is an invitation for the two to drift, and a
 * trail that claims a path the page does not show is the kind of mismatch that
 * gets structured data ignored altogether. So one array goes in, and both the
 * visible trail and the machine-readable one come out of it.
 *
 * The last crumb is the current page. It is rendered as text rather than as a
 * link to itself, and marked `aria-current`, so a screen reader announces which
 * of the three names is the one you are standing on.
 */
export function Breadcrumbs({ trail, className }: { trail: readonly Crumb[]; className?: string }) {
  const last = trail.length - 1;

  return (
    <nav aria-label="Breadcrumb" className={cn('relative', className)}>
      <script
        type="application/ld+json"
        // Serialised by ldJson, which escapes the one character that could close
        // this tag early. Next has no other way to emit a JSON-LD block.
        dangerouslySetInnerHTML={{ __html: ldJson(breadcrumbLd(trail)) }}
      />

      <ol className="m-mono m-dim-2 flex flex-wrap items-center gap-x-2 gap-y-1 t-2 t-caps uppercase">
        {trail.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center gap-x-2">
            {i > 0 && (
              /* Decoration between two names a screen reader already reads as
                 separate list items. */
              <span aria-hidden className="text-[var(--m-line-2)]">
                /
              </span>
            )}

            {i === last ? (
              <span aria-current="page" className="text-[var(--m-dim)]">
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} className="transition hover:text-[var(--m-ink)]">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
