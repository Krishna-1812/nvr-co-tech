'use client';

import { useEffect } from 'react';
import { useTheme } from '@/lib/theme';

/**
 * Keeps the phone's address bar the colour of the page under it.
 *
 * The root layout declares one theme-color, bone, because the public site is
 * the light desert always. Inside the app the theme is the person's choice,
 * and a bone bar over the night ground read as a strip of the wrong page
 * stuck to the top of the screen.
 *
 * It follows the painted ground rather than the stored choice, so 'system'
 * resolves itself and nothing here has to repeat the theme rules. Mounted in
 * the signed-in shell only; leaving it restores the layout's bone.
 */
export function ThemeColor() {
  const theme = useTheme();

  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const original = meta.content;
    const paint = () => {
      meta.content = getComputedStyle(document.body).backgroundColor || original;
    };
    paint();
    // 'system' can change under us when the OS switches at dusk.
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', paint);
    return () => {
      media.removeEventListener('change', paint);
      meta.content = original;
    };
  }, [theme]);

  return null;
}
