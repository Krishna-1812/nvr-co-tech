import type { Metadata } from 'next';
import { BRAND } from '@/lib/marketing/content';
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
