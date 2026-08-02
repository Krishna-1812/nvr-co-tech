import type { Metadata } from 'next';
import { BRAND } from '@/lib/marketing/content';
import { Hero } from '@/components/marketing/home/Hero';
import { FormatStrip } from '@/components/marketing/home/FormatStrip';
import { HowItWorks } from '@/components/marketing/home/HowItWorks';
import { ProductShowcase } from '@/components/marketing/home/ProductShowcase';
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

export default function HomePage() {
  return (
    <>
      <Hero />
      <FormatStrip />
      <HowItWorks />
      <ProductShowcase />
      <StatsBand />
      <AgentGrid />
      <Controls />
      <FinalCTA />
    </>
  );
}
