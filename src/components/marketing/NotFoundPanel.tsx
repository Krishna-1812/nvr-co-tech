import { Container, CTA } from './bits';
import { Roost } from '@/components/brand/Owl';

/**
 * The body of the public 404, on its own so that two routes can render it.
 *
 * `(marketing)/not-found.tsx` catches the notFound() that /agents/[slug] throws
 * for an unknown slug. The root not-found catches everything else — every URL
 * on this origin that matches no route at all, which is where a stale link or a
 * typed address actually lands. Those are two different files in two different
 * layouts, and before this they showed two different pages: a visitor who
 * mistyped the address got the application's light-themed 404 offering them a
 * sign-in button, on a site they had never signed in to.
 */
export function NotFoundPanel() {
  return (
    <section className="relative overflow-hidden pt-16 pb-32 sm:pt-20 sm:pb-40">
      {/* Two on the 404, where there is nothing else to look at and nothing to
          get in the way of. */}
      <Roost seed="lost-hollow" band="top-right" />
      <Roost seed="lost-bough" band="bottom-left" />

      <Container className="relative text-center">
        {/*
          An empty doorway with the sun going down into it. Every other page on
          the site has something standing in its arch; this is the one where
          the door opens on nothing, which is the whole of what a 404 has to
          say before a word of it is read.
        */}
        <div
          aria-hidden
          className="m-arch m-arch-open relative mx-auto mb-10 h-64 w-52 overflow-hidden bg-[var(--m-bg-2)]"
        >
          <span
            className="m-sun absolute bottom-6 left-1/2 size-28 -translate-x-1/2"
            style={{ '--sun-from': '-120px' } as React.CSSProperties}
          />
          <span className="absolute inset-x-0 bottom-0 h-14 bg-[var(--m-bg-3)]" />
        </div>
        <p className="m-eyebrow">Error 404</p>
        <h1 className="m-display mt-5 t-h1">
          Nothing filed <span className="m-serif m-grad-text">here.</span>
        </h1>
        <p className="m-dim mx-auto mt-6 max-w-md t-4">
          This page does not exist. It may have been renamed, or the link that brought you here may
          be an old one.
        </p>

        {/*
          Three ways on rather than two. A 404 is the one page where the reader
          has told you they could not find what they wanted, so it is worth
          naming the roster as well as the home page — that is where most of the
          site is, and where a half-remembered URL was most likely heading.
        */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <CTA href="/">Back to the home page</CTA>
          <CTA href="/agents" variant="ghost">
            See what we build
          </CTA>
          <CTA href="/contact" variant="ghost">
            Book a walkthrough
          </CTA>
        </div>
      </Container>
    </section>
  );
}
