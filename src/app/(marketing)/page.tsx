import type { Metadata } from 'next';
import { BRAND } from '@/lib/marketing/content';
import { siteLd } from '@/lib/marketing/seo';
import { JsonLd } from '@/components/marketing/JsonLd';
import { Hero } from '@/components/marketing/home/Hero';
import { FormatStrip } from '@/components/marketing/home/FormatStrip';
import { WorkCalendar } from '@/components/marketing/home/WorkCalendar';
import { RulesPlayground } from '@/components/marketing/home/RulesPlayground';
import { ProductShowcase } from '@/components/marketing/home/ProductShowcase';
import { Platform } from '@/components/marketing/home/Platform';
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
 * hands on them, here is a tool that is live, and here is what they stand on.
 *
 * The calendar comes first of the three Voucher Desk sections deliberately.
 * Everything from RulesPlayground to ProductShowcase is Voucher Desk, because
 * it is the one most people arrive for, and a reader who meets that first comes
 * away thinking we sell one thing. The calendar sets the scope, so the detail
 * that follows reads as one worked example of something wider.
 *
 * ── What used to sit between them ──────────────────────────────────────────
 *
 * A section called Journey: the same voucher followed through four steps, each
 * with a panel drawing the state it was in. It was the longest thing on the
 * page by some way, it was a third telling of Voucher Desk between two others,
 * and every claim in it is made again either in the playground below, where the
 * reader can move the numbers themselves, or on the product tour after it.
 * Removed rather than shortened, because the page did not need it said a third
 * time.
 *
 * ── Why the roster is named once ───────────────────────────────────────────
 *
 * It used to be named three times on this one page: the calendar mapped eight
 * jobs onto it, AgentGrid then dealt the same six out as product cards, and
 * Platform lined the same six up again as chips on a rail. The second was
 * /agents rebuilt in place two screens further down, and it argued the weaker
 * way round — product first, work second — against a section that had just
 * argued the better way. The third was decoration standing in for a claim.
 *
 * So the calendar owns the roster and carries the link to the rest of it, and
 * Platform is now about the foundation rather than the count.
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
      <FormatStrip />
      <WorkCalendar />
      <RulesPlayground />
      <ProductShowcase />
      <Platform />
      <FinalCTA />
    </>
  );
}
