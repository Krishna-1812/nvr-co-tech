/**
 * The handful of constants the browser needs: the name, the navigation, the
 * contact address and the stage labels.
 *
 * Split out of content.ts (which re-exports all of it) so that a client
 * component can import these without pulling the whole roster into the page's
 * JavaScript. content.ts carries every tool's description, the finance month,
 * the home questions and, through the Will Maker FAQ, a page of law; when the
 * header, the logo and the footer toys imported their few strings from it, all
 * of that was downloaded and parsed on every public page. Anything a client
 * component needs from the roster is passed to it as props by a server
 * component instead (see Ticker, KineticBand, WorkCalendar, PageCurtain).
 *
 * Keep this file free of imports.
 */

export const BRAND = {
  /** The platform. */
  name: 'The Finance Intelligence',
  /** Shortened for tight spaces (nav mark, footer). */
  short: 'FI',
  tagline: 'AI tools for finance teams',
  /** One sentence, used in metadata and the footer. */
  blurb:
    'Tools that take care of the routine parts of finance work and keep a clear record of who approved what, and when.',
  /**
   * What it is, as one sentence that names it: the sentence an assistant asked
   * "what is The Finance Intelligence" should be able to lift whole. Said the
   * same way everywhere it appears (the footer, the Organization data, the
   * llms files, the about page), because a name is learned from the sentence
   * that keeps coming back with it.
   */
  definition:
    'The Finance Intelligence is a set of web tools, free calculators and guides for finance work in India, built by chartered accountants.',
} as const;

export type AgentStage = 'live' | 'building' | 'planned';

export const STAGE_LABEL: Record<AgentStage, string> = {
  live: 'Live',
  building: 'In build',
  planned: 'On the roadmap',
};

/**
 * What a client component may know about a tool: enough to name it and link
 * to it. Built on the server from the roster (content.ts `toolBriefs`) and
 * passed down, so the roster's text stays out of the browser bundle.
 */
export type ToolBrief = { slug: string; name: string; category: string; stage: AgentStage; href?: string };

/** Primary navigation for the public site. */
export const NAV = [
  { href: '/tools', label: 'Tools' },
  { href: '/guides', label: 'Guides' },
  { href: '/calculators', label: 'Calculators' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;

export const CONTACT = {
  email: 'team@thefinanceintelligence.com',
  security: 'team@thefinanceintelligence.com',
} as const;
