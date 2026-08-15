import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/marketing/content';
import { INK } from '@/lib/brand/mark';

/**
 * What Android and Chrome read when somebody adds this to a home screen.
 *
 * Not an attempt at a progressive web app. There is no service worker and
 * nothing here works offline; `browser` display keeps the address bar, because
 * a finance tool that hides which site it is on is a phishing lesson waiting to
 * happen. What this actually buys is a proper icon and a proper name on the
 * home screen instead of a screenshot and a truncated URL.
 *
 * Nothing is declared maskable. A maskable icon has to bleed to the edges so a
 * launcher can crop it to its own shape, and this mark is a round bird on a
 * transparent ground: cropping it would only cut the halo. Without the hint,
 * Android puts it on a plate of its own instead, which is the right outcome.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.short,
    description: BRAND.blurb,
    start_url: '/',
    display: 'browser',
    background_color: INK.navy,
    theme_color: INK.navy,
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
