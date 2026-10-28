import type { Viewport } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/marketing/Logo';
import { AuthSignOut } from '@/components/auth/AuthSignOut';
import { BRAND } from '@/lib/marketing/content';
import { createClient } from '@/lib/supabase/server';
import { DESERT_FONTS } from '@/lib/brand/fonts';
import { ArchScene as SceneArch } from '@/components/ui/Scene';
import { HeroStage } from '@/components/marketing/play/HeroStage';
import { agentBySlug } from '@/lib/marketing/content';
import { OPEN_TOOLS } from '@/lib/access';

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
  /*
   * The gate stands in an arch window that answers the pointer (HeroStage):
   * the scene drifts against its frame, and two notes float either side of it
   * naming the tools that need no account, read from the same list the
   * workspace uses, so the picture never claims more is open than is.
   */
  const open = OPEN_TOOLS.map((slug) => agentBySlug(slug)?.name).filter(Boolean) as string[];
  return (
    <div className="hidden w-full max-w-[24rem] flex-col items-center text-center lg:flex">
      <div className="relative w-full animate-[rise_0.9s_cubic-bezier(0.22,1,0.36,1)_backwards]">
        <HeroStage className="m-arch m-arch-open w-full bg-[var(--m-gold)] p-3.5 shadow-[var(--m-shadow)]">
          <div aria-hidden className="m-drift-near">
            <SceneArch motif="gate" className="h-[min(30rem,58vh)] min-h-[20rem]" />
          </div>
        </HeroStage>
        {open.slice(0, 2).map((name, i) => (
          <span
            key={name}
            aria-hidden
            className={`a-float m-card absolute flex items-center gap-2 rounded-full px-3.5 py-2 t-2 font-semibold whitespace-nowrap text-[var(--m-ink)] shadow-[0_16px_30px_-18px_rgb(60_30_15_/_0.6)] ${
              i === 0 ? '-left-10 top-[38%]' : '-right-8 top-[62%]'
            }`}
            style={{ '--fd': `${i * 1.6}s`, animationDelay: `${0.6 + i * 0.25}s` } as React.CSSProperties}
          >
            <span className="size-2 rounded-full bg-[var(--m-emerald)]" />
            {name} · open
          </span>
        ))}
      </div>
      <p className="m-eyebrow mt-10 animate-[rise_0.8s_cubic-bezier(0.22,1,0.36,1)_0.35s_backwards]">Optional, and free</p>
      <p className="m-display mt-3 max-w-[20rem] animate-[rise_0.8s_cubic-bezier(0.22,1,0.36,1)_0.45s_backwards] text-[1.6rem] leading-[1.2] text-[var(--m-ink)]">
        The workspace is open without one. An account keeps your work.
      </p>
    </div>
  );
}

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="m-arch m-arch-open absolute top-[6vh] left-1/2 h-[120vh] w-[min(40rem,92vw)] -translate-x-1/2 overflow-hidden bg-[var(--m-bg-2)] lg:left-[calc(50%+min(19rem,25vw))] lg:w-[31rem]">
        {/* A sun climbs slowly behind the card as the page opens. */}
        <span className="a-sunrise absolute top-[30vh] left-1/2 size-56 -translate-x-1/2 rounded-full bg-[var(--m-sun)] opacity-35" />
      </div>
    </div>
  );
}
