import type { Metadata } from 'next';
import { BRAND } from '@/lib/marketing/content';
import { Hero } from '@/components/marketing/home/Hero';
import { FormatStrip } from '@/components/marketing/home/FormatStrip';
import { Journey } from '@/components/marketing/home/Journey';
import { RulesPlayground } from '@/components/marketing/home/RulesPlayground';
import { ProductShowcase } from '@/components/marketing/home/ProductShowcase';
import { AgentGrid } from '@/components/marketing/home/AgentGrid';
import { FinalCTA } from '@/components/marketing/home/FinalCTA';

export const metadata: Metadata = {
  // `absolute` opts out of the root layout's "%s · NVR Intelligence" template,
  // which would otherwise render the brand name twice on the home page.
  title: { absolute: `${BRAND.name} · ${BRAND.tagline}` },
  description: BRAND.blurb,
};

/*
 * The order is an argument, in this sequence: here is the claim, here is the
 * work moving through it, here are the rules with your hands on them, here is
 * the product, here is what else is coming.
 *
 * The playground is the one section that is interactive rather than
 * illustrative, and it runs the application's own arithmetic. It sits just
 * before the product tour on purpose: the demonstration is what makes the tour
 * believable.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <FormatStrip />
      <Journey />
      <RulesPlayground />
      <ProductShowcase />
      <AgentGrid />
      <FinalCTA />
    </>
  );
}
