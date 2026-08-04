import { avatarAtSize, initialsFrom } from '@/lib/avatar';
import { cn } from '@/lib/utils';

/**
 * One person, drawn one way.
 *
 * The initials tile and the picture are the same object rather than two branches,
 * which is what makes the fallback free. The initials are always rendered; the
 * photograph, when there is one, sits on top of them and covers them completely.
 * If it fails to load — a revoked Google account, a broken CDN, someone offline —
 * an `<img>` with an empty `alt` renders as nothing at all, and what is underneath
 * is already the right answer. No state, no error handler, no client component.
 *
 * `aria-hidden` throughout, because in both places this appears the person is
 * named in text beside it or the control has its own label. An avatar that also
 * announces itself just makes a screen reader say the name twice.
 */
export function Avatar({
  name,
  email,
  url,
  px,
  className,
}: {
  /** Preferred source for the initials. */
  name?: string | null;
  /** Fallback for the initials, and what a person has if they never set a name. */
  email: string;
  /** The photograph, if this account has one. */
  url?: string | null;
  /**
   * The size the image is fetched at, in device pixels — so pass double the box
   * for a sharp result on a retina screen. It cannot be derived from `className`,
   * because Tailwind has to see that as a literal.
   */
  px: number;
  /** The box: size, radius and the type size of the initials. */
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'gradient-brand relative grid shrink-0 place-items-center overflow-hidden font-bold text-white',
        className,
      )}
    >
      {initialsFrom(name, email)}
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- see below
        <img
          src={avatarAtSize(url, px)}
          alt=""
          width={px}
          height={px}
          loading="lazy"
          decoding="async"
          /*
           * No referrer: fetching this should not tell Google which page of this
           * app the person is on.
           *
           * A plain img rather than next/image, deliberately. next/image would put
           * a 64px avatar through the optimiser — a round-trip to our own server to
           * re-encode something Google's CDN already serves at whatever size we ask
           * for — and would need this host allow-listed in next.config. Nothing else
           * in this project loads a remote image.
           */
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}
