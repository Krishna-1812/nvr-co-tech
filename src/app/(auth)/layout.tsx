import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/marketing/Logo';
import { Aurora } from '@/components/marketing/bits';
import { BRAND } from '@/lib/marketing/content';

/**
 * Shell for /login and /signup.
 *
 * One canvas, one column, one light source. The previous version put a brand
 * panel on the left and the form on the right; two lit surfaces meeting at a
 * hairline never stopped reading as two screens bolted together, and the panel
 * spent half a page explaining database internals to someone who only wanted to
 * type a password.
 *
 * So the argument is gone from here — it belongs on the marketing pages, which
 * is where the reader has just come from. What is left is the mark, a greeting,
 * and the form, sitting in the middle of a single continuous field of light.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-skin="night"
      className="relative grid min-h-dvh place-items-center px-5 py-14 sm:px-6"
    >
      <Backdrop />

      <div className="relative w-full max-w-[26.5rem]">
        <Link
          href="/"
          className="mx-auto mb-9 flex w-fit rounded-lg transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--m-indigo)] focus-visible:outline-none"
        >
          <Logo id="auth-mark" />
        </Link>

        {children}

        <p className="mt-8 text-center">
          <Link
            href="/"
            className="m-dim-2 inline-flex items-center gap-1.5 text-xs transition hover:text-[var(--m-ink)]"
          >
            <ArrowLeft className="size-3" aria-hidden />
            Back to {BRAND.name}
          </Link>
        </p>
      </div>
    </div>
  );
}

/**
 * Everything behind the card.
 *
 * `fixed` rather than absolute, and clipped here rather than on the content
 * wrapper: the blurred fields are far larger than the viewport, and clipping
 * them on an ancestor of the form would make that ancestor the scroll container
 * instead of the viewport. A decorative layer that scrolls nothing is the safe
 * place to put an overflow rule.
 */
function Backdrop() {
  const hairline =
    'linear-gradient(to bottom, transparent, var(--m-line) 22%, var(--m-line) 78%, transparent)';

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {/*
        One primary source, sitting behind the top of the card. Everything else
        is falloff. The first attempt used four large fields at once, which lit
        the whole viewport to an even purple — the card then read as a hole in a
        flat panel rather than an object with light behind it.
      */}
      <span
        className="absolute top-[-14rem] left-1/2 h-[34rem] w-[46rem] -translate-x-1/2 rounded-[50%] blur-[100px]"
        style={{ backgroundImage: 'var(--m-grad)', opacity: 0.38 }}
      />

      {/* Colour at the far edges only, so the corners are not simply black. */}
      <Aurora
        color="var(--m-violet)"
        opacity={0.16}
        className="top-[-6rem] right-[-14rem] size-[30rem] animate-[drift_28s_ease-in-out_infinite_alternate-reverse] motion-reduce:animate-none"
      />
      <Aurora
        color="var(--m-cyan)"
        opacity={0.1}
        className="bottom-[-16rem] left-[-10rem] size-[30rem] animate-[drift_36s_ease-in-out_infinite_alternate] motion-reduce:animate-none"
      />

      <div className="m-grid absolute inset-0 opacity-70 [mask-image:radial-gradient(62%_55%_at_50%_42%,#000,transparent)]" />

      {/*
        Two hairlines on the card's own edges, running the full height. They are
        what stops the card reading as a rectangle dropped onto a background —
        the page and the card share the same two lines. Offset from the centre by
        half the column width (26.5rem ÷ 2 = 212px), and hidden below sm, where
        the gutters make the column narrower than that.
      */}
      <span
        className="absolute inset-y-0 left-1/2 hidden w-px -translate-x-[212px] sm:block"
        style={{ background: hairline }}
      />
      <span
        className="absolute inset-y-0 left-1/2 hidden w-px translate-x-[212px] sm:block"
        style={{ background: hairline }}
      />

      {/*
        Vignette, last so it sits over every light source. This is what turns an
        evenly lit rectangle into a pool of light: it starts closing in just
        outside the card and reaches near-opaque at the edges of the viewport.
      */}
      <span
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(86% 68% at 50% 34%, transparent 12%, oklch(0.128 0.019 274 / 0.62) 52%, oklch(0.105 0.014 274 / 0.94) 100%)',
        }}
      />
    </div>
  );
}
