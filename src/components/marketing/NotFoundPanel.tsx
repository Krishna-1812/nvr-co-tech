import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LIVE_AGENTS } from '@/lib/marketing/content';
import { ACCENT, Container, CTA } from './bits';
import { Roost } from '@/components/brand/Owl';

/**
 * The body of the public 404, on its own so that two routes can render it.
 *
 * `(marketing)/not-found.tsx` catches the notFound() that /tools/[slug] throws
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
          className="m-arch m-arch-open relative mx-auto mb-10 h-72 w-60 overflow-hidden border-[10px] border-b-0 border-[var(--m-gold)] bg-[var(--m-bg-2)] shadow-[var(--m-shadow)]"
        >
          <span
            className="m-sun absolute bottom-6 left-1/2 size-28 -translate-x-1/2"
            style={{ '--sun-from': '-120px' } as React.CSSProperties}
          />
          <span
            className="absolute inset-x-0 bottom-0 h-16 bg-[var(--m-bg-3)]"
            style={{ borderRadius: '60% 40% 0 0 / 34% 28% 0 0' }}
          />
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
          <CTA href="/tools" variant="ghost">
            See what we build
          </CTA>
          <CTA href="/contact" variant="ghost">
            Book a walkthrough
          </CTA>
        </div>

        {/*
          The working tools, by name and in their own doorways. A stale link
          into this site was most often a link to one of these, and naming them
          here turns a dead end into a choice. Live ones only: offering a
          roadmap page to somebody who is already lost is a second dead end.
        */}
        <div className="mx-auto mt-20 max-w-4xl text-left">
          <div className="flex items-center justify-center gap-3.5">
            <span aria-hidden className="h-px w-10 bg-[var(--m-gold)]" />
            <p className="m-eyebrow">Or go straight to a tool</p>
            <span aria-hidden className="h-px w-10 bg-[var(--m-gold)]" />
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LIVE_AGENTS.map((agent) => (
              <li key={agent.slug}>
                <Link
                  href={`/tools/${agent.slug}`}
                  className="group m-card m-card-lift flex items-center gap-4 rounded-2xl p-4 transition-[transform,box-shadow] duration-300"
                >
                  <span
                    aria-hidden
                    className="m-arch relative h-12 w-10 shrink-0 overflow-hidden"
                    style={{ background: ACCENT[agent.accent] }}
                  >
                    <span className="absolute bottom-0 left-1/2 size-6 -translate-x-1/2 translate-y-1/3 rounded-full bg-[var(--m-sun)] transition-transform duration-500 group-hover:translate-y-0" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="m-display block t-5">{agent.name}</span>
                    <span className="m-mono m-dim-2 mt-1 block truncate t-1 t-caps uppercase">
                      {agent.category}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="m-dim-2 size-4 shrink-0 transition-transform group-hover:translate-x-1"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
