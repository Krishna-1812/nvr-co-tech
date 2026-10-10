import { Figtree, Gloock } from 'next/font/google';

/**
 * The product's two faces, outside and in.
 *
 * Gloock is the display serif: one weight, high contrast, drawn for headlines
 * and nothing smaller; .m-display is the only thing that sets it. Figtree is
 * everything else, labels and figures included. There is no monospace: a mono
 * label is a dark-mode habit, and on sand it reads as a terminal. Figtree's
 * tabular figures are what keep a column of rupees aligned.
 *
 * The variables go on <html> in the root layout, so the @theme tokens that
 * name them resolve everywhere. PublicShell and the sign-in layout also carry
 * them, which is redundant now and harmless.
 *
 * Gloock ships a single weight. Anything that asks it for bold gets a
 * synthesised smear, which is why .m-display pins 400 and turns synthesis off.
 */
export const gloock = Gloock({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-gloock',
  display: 'swap',
});

export const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
});

/** Both variables, for the className of whatever element carries the skin. */
export const DESERT_FONTS = `${gloock.variable} ${figtree.variable}`;
