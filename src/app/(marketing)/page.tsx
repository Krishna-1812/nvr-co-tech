import type { Metadata } from 'next';
import { BRAND } from '@/lib/marketing/content';
import { siteLd } from '@/lib/marketing/seo';
import { JsonLd } from '@/components/marketing/JsonLd';
import { Hero } from '@/components/marketing/home/Hero';
import { WorkCalendar } from '@/components/marketing/home/WorkCalendar';
import { RulesPlayground } from '@/components/marketing/home/RulesPlayground';
import { FinalCTA } from '@/components/marketing/home/FinalCTA';

export const metadata: Metadata = {
  // `absolute` opts out of the root layout's "%s · The Finance Intelligence" template,
  // which would otherwise render the brand name twice on the home page.
  title: { absolute: `${BRAND.name} · ${BRAND.tagline}` },
  description: BRAND.blurb,
  /*
   * This page answers on more than one URL. The apex and the www host both
   * resolve, a preview deployment serves the whole site under its own name, and
   * anything with a campaign parameter on the end is a fourth. Without this,
   * each of those is a separate page as far as a search engine is concerned,
   * competing with the others for the same words. metadataBase makes the path
   * absolute against the real production origin.
   */
  alternates: { canonical: '/' },
};

/*
 * The order is an argument, in this sequence: here is the claim, here is the
 * whole month of work and who takes each job, here are the rules with your
 * hands on them, and here is the way in.
 *
 * The calendar comes before the playground deliberately. The playground is
 * Voucher Desk, which is the one most people arrive for, and a reader who meets
 * it first comes away thinking we sell one thing. The calendar sets the scope,
 * so the detail that follows reads as one worked example of something wider.
 *
 * ── What used to sit here ──────────────────────────────────────────────────
 *
 * Four sections, removed over time, and worth listing because the same three
 * ideas keep proposing themselves back:
 *
 * Journey followed one voucher through four steps with a panel per state. It
 * was the longest thing on the page and a third telling of Voucher Desk.
 *
 * AgentGrid dealt the roster out as product cards — /agents rebuilt in place
 * two screens down, arguing product first and work second against a section
 * that had just argued the better way round.
 *
 * ProductShowcase was a representative view of the application with four cards
 * under it, and Platform was four cards about the shared foundation. Both are
 * gone.
 *
 * The thread through all four: this page kept wanting to say the same things a
 * second time in a different shape. The calendar owns the roster and carries
 * the link to the rest of it, the playground owns the rules, and each is said
 * once.
 */
export default function HomePage() {
  return (
    <>
      {/*
        Who is behind this, said once, on the one page that is about the whole
        of it. The Organization, the business and the site are three nodes
        rather than one because they answer three different questions, and the
        inner pages point back at these by id rather than repeating them.
      */}
      <JsonLd data={siteLd()} />

      <Hero />
      <WorkCalendar />
      <RulesPlayground />
      <FinalCTA />
    </>
  );
}
