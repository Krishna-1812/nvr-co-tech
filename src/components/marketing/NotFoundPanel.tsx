import { Aurora, CTA, Container } from './bits';
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
    <section className="relative overflow-hidden py-32 sm:py-44">
      <Aurora color="var(--m-indigo)" opacity={0.15} className="-top-36 left-1/3 size-[38rem]" />
      <div
        aria-hidden
        className="m-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(55%_60%_at_50%_30%,#000,transparent)]"
      />

      {/* Two on the 404, where there is nothing else to look at and nothing to
          get in the way of. */}
      <Roost seed="lost-hollow" band="top-right" />
      <Roost seed="lost-bough" band="bottom-left" />

      <Container className="relative text-center">
        <p className="m-eyebrow">Error 404</p>
        <h1 className="m-display mt-5 text-[clamp(2.2rem,5.5vw,3.6rem)]">
          Nothing filed <span className="m-serif m-grad-text">here.</span>
        </h1>
        <p className="m-dim mx-auto mt-6 max-w-md text-[15px] leading-relaxed">
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
