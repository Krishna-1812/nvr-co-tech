import type { Metadata } from 'next';
import { BRAND } from '@/lib/marketing/content';
import { Hero } from '@/components/marketing/home/Hero';
import { FormatStrip } from '@/components/marketing/home/FormatStrip';
import { Journey } from '@/components/marketing/home/Journey';
import { RulesPlayground } from '@/components/marketing/home/RulesPlayground';
import { ProductShowcase } from '@/components/marketing/home/ProductShowcase';
import { Refusals } from '@/components/marketing/home/Refusals';
import { StatsBand } from '@/components/marketing/home/StatsBand';
import { AgentGrid } from '@/components/marketing/home/AgentGrid';
import { Controls } from '@/components/marketing/home/Controls';
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
 * the product, here is what it refuses to do, here is how it is built, here is
 * what else is coming.
 *
 * Two of these sections are interactive rather than illustrative — the
 * playground runs the application's own arithmetic, and the refusals quote the
 * database's own error strings. They are placed either side of the product tour
 * on purpose: the demonstrations are what make the tour believable.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <FormatStrip />
      <Journey />
      <RulesPlayground />
      <ProductShowcase />
      <Refusals />
      <StatsBand />
      <AgentGrid />
      <Controls />
      <FinalCTA />
    </>
  );
}
