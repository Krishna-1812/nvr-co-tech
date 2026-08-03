import type { Metadata } from 'next';
import { BRAND } from '@/lib/marketing/content';
import { Hero } from '@/components/marketing/home/Hero';
import { FormatStrip } from '@/components/marketing/home/FormatStrip';
import { WorkCalendar } from '@/components/marketing/home/WorkCalendar';
import { Journey } from '@/components/marketing/home/Journey';
import { RulesPlayground } from '@/components/marketing/home/RulesPlayground';
import { ProductShowcase } from '@/components/marketing/home/ProductShowcase';
import { AgentGrid } from '@/components/marketing/home/AgentGrid';
import { Platform } from '@/components/marketing/home/Platform';
import { FinalCTA } from '@/components/marketing/home/FinalCTA';

export const metadata: Metadata = {
  // `absolute` opts out of the root layout's "%s · NVR Intelligence" template,
  // which would otherwise render the brand name twice on the home page.
  title: { absolute: `${BRAND.name} · ${BRAND.tagline}` },
  description: BRAND.blurb,
};

/*
 * The order is an argument, in this sequence: here is the claim, here is the
 * whole month of work and who takes each job, here is one of those jobs in
 * detail, here are the rules with your hands on them, here is the tool that is
 * live, here is the rest of the roster, and here is what they have in common.
 *
 * WorkCalendar comes before Journey deliberately. Everything from Journey to
 * ProductShowcase is Voucher Desk, because Voucher Desk is the one that exists,
 * and a reader who meets that first comes away thinking we sell one thing. The
 * calendar sets the scope first, so the deep dive reads as one worked example of
 * something wider.
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
      <AgentGrid />
      <Platform />
      <FinalCTA />
    </>
  );
}
