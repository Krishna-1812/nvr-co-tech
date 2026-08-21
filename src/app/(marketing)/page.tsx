import type { Metadata } from 'next';
import { BRAND } from '@/lib/marketing/content';
import { Hero } from '@/components/marketing/home/Hero';
import { FormatStrip } from '@/components/marketing/home/FormatStrip';
import { WorkCalendar } from '@/components/marketing/home/WorkCalendar';
import { Journey } from '@/components/marketing/home/Journey';
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
 * whole month of work and who takes each job, here is one of those jobs in
 * detail, here are the rules with your hands on them, here is a tool that is
 * live, and here is what they stand on.
 *
 * WorkCalendar comes before Journey deliberately. Everything from Journey to
 * ProductShowcase is Voucher Desk, because Voucher Desk is the one most people
 * arrive for, and a reader who meets that first comes away thinking we sell one
 * thing. The calendar sets the scope first, so the deep dive reads as one worked
 * example of something wider.
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
      <Journey />
      <RulesPlayground />
      <ProductShowcase />
      <Platform />
      <FinalCTA />
    </>
  );
}
