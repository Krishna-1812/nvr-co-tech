import type { Viewport } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/marketing/Logo';
import { AuthSignOut } from '@/components/auth/AuthSignOut';
import { BRAND } from '@/lib/marketing/content';
import { createClient } from '@/lib/supabase/server';
import { DESERT_FONTS } from '@/lib/brand/fonts';
import { ArchScene as SceneArch } from '@/components/ui/Scene';

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
/** Bone browser chrome, as on the public pages these screens belong to. */
export const viewport: Viewport = {
  themeColor: '#F6EFE4',
};

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  /*
   * The auth session, not getCurrentUser(). A session whose `profiles` row
   * cannot be read is precisely the state that needs a way out, and
   * getCurrentUser() returns null for it — asking it whether anyone is signed
   * in would hide the sign-out control exactly when it matters.
   */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div
      data-skin="desert"
      className={`relative grid min-h-dvh place-items-center px-5 py-14 sm:px-6 ${DESERT_FONTS}`}
    >
      <Backdrop />

      <div className="relative grid w-full max-w-6xl items-center justify-items-center gap-16 lg:grid-cols-2">
        <Gate />

        <div className="relative w-full max-w-[26.5rem]">
          <Link
            href="/"
            className="mx-auto mb-9 flex w-fit rounded-lg transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--m-gold)] focus-visible:outline-none"
          >
            <Logo id="auth-mark" />
          </Link>

          {children}

          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <Link
              href="/"
              className="m-dim-2 inline-flex items-center gap-1.5 text-xs transition hover:text-[var(--m-ink)]"
            >
              <ArrowLeft className="size-3" aria-hidden />
              Back to {BRAND.name}
            </Link>

            {user && <AuthSignOut email={user.email ?? null} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The gate, beside the form, from lg up.
 *
 * This is not the split screen that was taken out. That put a lit brand panel
 * beside a flat form column, two grounds meeting at a seam, and spent its half
 * of the page explaining database internals. Here there is one ground and no
 * seam: the scene stands on the same bone as the form, the way the arches on
 * the public pages stand beside their headlines, and it says one thing.
 *
 * The scene is the gate from the tools' set (components/ui/Scene), framed in
 * terracotta like the doorways on the inner pages, so the last picture before
 * the product is the same family as the first one inside it. Below lg there is
 * no room beside the card, and the screen falls back to the single column
 * standing in its arch.
 */
function Gate() {
  return (
    <div className="hidden w-full max-w-[24rem] flex-col items-center text-center lg:flex">
      <div
        aria-hidden
        className="m-arch m-arch-open w-full p-3.5 shadow-[var(--m-shadow)]"
        style={{ background: 'var(--m-gold)' }}
      >
        <SceneArch motif="gate" className="h-[min(30rem,58vh)] min-h-[20rem]" />
      </div>
      <p className="m-eyebrow mt-10">Optional, and free</p>
      <p className="m-display mt-3 max-w-[20rem] text-[1.6rem] leading-[1.2] text-[var(--m-ink)]">
        The workspace is open without one. An account keeps your work.
      </p>
    </div>
  );
}

/**
 * What the sign-in card stands in front of: one tall arch, centred behind it.
 *
 * The card is the doorway's occupant, the same way the voucher is on the home
 * page, so arriving here from the public site is walking through the same
 * door rather than into a different building. The arch is wider than the card
 * by a little over its own margin, so its walls show either side of it and its
 * crown shows above it.
 *
 * No sun in this one. Every other arch on the site has one, but here the crown
 * is where the logo and the screen's title sit, and a disc behind a headline
 * is a disc through it.
 *
 * It replaced a blurred light source, two colour fields at the far corners, a
 * hairline grid and a vignette: five layers whose whole job was to stop a
 * near-black page reading as flat. Sand does not need lighting.
 */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="m-arch m-arch-open absolute top-[6vh] left-1/2 h-[120vh] w-[min(40rem,92vw)] -translate-x-1/2 bg-[var(--m-bg-2)] lg:left-[calc(50%+min(19rem,25vw))] lg:w-[31rem]" />
    </div>
  );
}
