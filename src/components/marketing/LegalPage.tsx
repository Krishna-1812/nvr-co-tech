import Link from 'next/link';
import { ArchScene, Container, Eyebrow, Rise, Section } from './bits';
import { Breadcrumbs } from './Breadcrumbs';
import { Reveal } from './Reveal';
import { Roost } from '@/components/brand/Owl';
import type { Crumb } from '@/lib/marketing/seo';
import type { SceneMotif } from '@/components/ui/Scene';

/**
 * The shape both /privacy and /terms are built from.
 *
 * They were two files with the same hero, the same list of headings and
 * paragraphs, and the same nothing-else. The duplication was cheap to live with
 * until the one improvement they both needed turned out to be structural: eight
 * or nine numbered clauses with no way to see the shape of them and no way to
 * send somebody to one. Adding that twice, to two copies that had already
 * drifted apart in small ways, is how the second copy ends up the worse one.
 *
 * ── Why the clauses are numbered ────────────────────────────────────────────
 *
 * Because a legal document is one of the few things on this site where the
 * ordering carries real information: people cite clause four, and a link to
 * clause four has to land on it. Numbers here are not a visual device borrowed
 * from a design that needed one. Everywhere else on the site that wanted a
 * sequence already had one.
 *
 * ── Why the rail does not follow the scroll ─────────────────────────────────
 *
 * A highlight that tracks the reader's position needs an observer, a client
 * component and a hydration boundary, on two pages that are otherwise entirely
 * static and are read perhaps twice a month. Plain anchors do the part that
 * matters, which is getting somebody to the clause and giving them a link they
 * can send.
 */

export type Clause = {
  title: string;
  /** One paragraph, or several. An array renders as separate paragraphs. */
  body: string | string[];
};

/** An id a person could plausibly have typed, from a heading. */
export const slug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function LegalPage({
  eyebrow,
  title,
  lead,
  updated,
  clauses,
  trail,
  related,
  children,
  accent = 'var(--m-gold)',
  motif = 'ledger',
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead: string;
  updated: string;
  clauses: Clause[];
  trail: readonly Crumb[];
  /*
   * The other legal page.
   *
   * These two were the only pages on the site with no link at all in their own
   * content — everything that pointed anywhere lived in the header and footer.
   * Somebody who has just read the privacy policy is more likely to want the
   * terms than anything else on the site, and the footer is a long way down a
   * document this size.
   */
  related: { href: string; label: string };
  /** The closing block, which differs between the two pages. */
  children?: React.ReactNode;
  accent?: string;
  /** What stands in the hero's doorway. */
  motif?: SceneMotif;
}) {
  return (
    <>
      <section className="relative overflow-hidden">
        <ArchScene color={accent} motif={motif} />

        <Roost seed="legal-margin" band="top-right" />

        <Container className="relative pt-16 pb-14 sm:pt-24 sm:pb-16 lg:pr-[25rem] xl:pr-[28rem]">
          <Rise>
            <Breadcrumbs trail={trail} className="mb-7" />
          </Rise>
          <Rise>
            <Eyebrow>{eyebrow}</Eyebrow>
          </Rise>
          <Rise delay={60}>
            <h1 className="m-display mt-5 max-w-3xl t-h1">{title}</h1>
          </Rise>
          <Rise delay={120}>
            <p className="m-dim mt-7 max-w-2xl t-4 sm:t-5">{lead}</p>
          </Rise>
          <Rise delay={170}>
            {/* The two facts a reader of a policy checks first, set as plates
                rather than a run of caps, so they read as the document's
                particulars and not as a footnote to the standfirst. */}
            <dl className="mt-9 flex flex-wrap gap-3">
              <div className="m-card rounded-2xl px-4 py-3 shadow-[0_10px_24px_-18px_rgb(80_40_20_/_0.5)]">
                <dt className="m-eyebrow t-1">Last updated</dt>
                <dd className="mt-1 t-3 font-semibold text-[var(--m-ink)] tabular-nums">{updated}</dd>
              </div>
              <div className="m-card rounded-2xl px-4 py-3 shadow-[0_10px_24px_-18px_rgb(80_40_20_/_0.5)]">
                <dt className="m-eyebrow t-1">Length</dt>
                <dd className="mt-1 t-3 font-semibold text-[var(--m-ink)] tabular-nums">
                  {clauses.length} {clauses.length === 1 ? 'clause' : 'clauses'}
                </dd>
              </div>
            </dl>
          </Rise>
        </Container>
      </section>

      <Section>
        <Container>
          {/*
            Both columns are sized to their contents rather than stretched to the
            container, and the pair starts on the same left edge as the heading
            above it. In a wide grid the prose column came out at 1056px holding
            a 666px measure, which left four hundred pixels of nothing beside the
            document and no artwork to put in it.

            Ragged on the right rather than centred, deliberately: centring the
            pair would pull the body off the left edge the hero sets, and a
            document with two different left margins reads as a mistake.
          */}
          <div className="grid gap-12 lg:grid-cols-[15.5rem_minmax(0,64ch)] lg:gap-16">
            {/*
              Ordered, because it is a table of contents for a numbered
              document, and the number in each link is the clause number rather
              than a counter that happens to agree with it.
            */}
            <nav
              aria-label="Contents"
              className="m-card rounded-3xl p-5 shadow-[0_24px_44px_-34px_rgb(80_40_20_/_0.55)] lg:sticky lg:top-28 lg:self-start"
            >
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="m-arch h-5 w-4 shrink-0"
                  style={{ background: accent }}
                />
                <p className="m-eyebrow">Contents</p>
              </div>
              <ol className="mt-4 space-y-0.5 border-t border-[var(--m-line)] pt-3">
                {clauses.map((clause, i) => (
                  <li key={clause.title}>
                    <a
                      href={`#${slug(clause.title)}`}
                      className="group -mx-2 flex gap-3 rounded-xl px-2 py-1.5 transition hover:bg-[var(--m-bg)]"
                    >
                      <span
                        className="m-mono m-dim-2 shrink-0 pt-px t-1 t-caps tabular-nums transition-colors group-hover:text-[var(--m-gold)]"
                        aria-hidden
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="m-dim t-3 transition-colors group-hover:text-[var(--m-ink)]">
                        {clause.title}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            {/*
              The 64ch measure is a grid track from lg, but below it the column had
              no cap at all and the clauses ran to about 92 characters a line on a
              tablet. Same measure, stated twice, because only one of the two ways
              of saying it is in force at a time.
            */}
            <div className="min-w-0 max-w-[64ch] lg:max-w-none">
              <ol className="border-t border-[var(--m-line)]">
                {clauses.map((clause, i) => (
                  <Reveal
                    as="li"
                    key={clause.title}
                    delay={Math.min(i, 6) * 40}
                    className="border-b border-[var(--m-line)]"
                  >
                    {/* Clear of the sticky header, so a linked clause is not
                        sitting underneath it on arrival. */}
                    <div id={slug(clause.title)} className="scroll-mt-28 py-8">
                      <p
                        className="m-mono m-dim-2 t-1 t-caps tabular-nums"
                        aria-hidden
                      >
                        {String(i + 1).padStart(2, '0')}
                      </p>
                      <h2 className="m-display mt-3 t-5 sm:t-6">
                        {clause.title}
                      </h2>
                      {(Array.isArray(clause.body) ? clause.body : [clause.body]).map(
                        (para, j) => (
                          <p
                            key={j}
                            className="m-dim mt-3.5 t-3 first-of-type:mt-4"
                          >
                            {para}
                          </p>
                        ),
                      )}
                    </div>
                  </Reveal>
                ))}
              </ol>

              {children && <div className="mt-12">{children}</div>}

              <p className="m-dim-2 mt-12 border-t border-[var(--m-line)] pt-7 t-3">
                See also{' '}
                <Link
                  href={related.href}
                  className="text-[var(--m-dim)] underline underline-offset-4 transition hover:text-[var(--m-ink)]"
                >
                  {related.label}
                </Link>
                .
              </p>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
