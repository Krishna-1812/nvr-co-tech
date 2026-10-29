import type { Metadata } from 'next';
import { HOME_FAQ, HOME_SEARCH, LIVE_AGENTS, calendarJobs, toolBriefs } from '@/lib/marketing/content';
import { faqLd, pageMeta, siteLd } from '@/lib/marketing/seo';
import { Container, Section, SectionHeading } from '@/components/marketing/bits';
import { FaqAccordion } from '@/components/marketing/rich/FaqAccordion';
import { JsonLd } from '@/components/marketing/JsonLd';
import { Hero } from '@/components/marketing/home/Hero';
import { WorkCalendar } from '@/components/marketing/home/WorkCalendar';
import { FinalCTA } from '@/components/marketing/home/FinalCTA';
import { Ticker } from '@/components/marketing/play/Ticker';
import { KineticBand } from '@/components/marketing/play/KineticBand';

export const metadata: Metadata = pageMeta({
  /*
   * Absolute, because the title already carries the brand and the root layout's
   * template would add it again.
   *
   * The canonical matters more here than anywhere: this page answers on the
   * apex, on www, on every preview deployment and on anything with a campaign
   * parameter on the end, and without it each of those is a separate page as far
   * as a search engine is concerned.
   */
  title: HOME_SEARCH.title,
  absoluteTitle: true,
  description: HOME_SEARCH.description,
  path: '/',
});

/*
 * The order is an argument, in this sequence: here is the claim, here is the
 * whole month of work and who takes each job, and here is the way in.
 *
 * ── What used to sit here ──────────────────────────────────────────────────
 *
 * Six sections, removed over time, and worth listing because the same three
 * ideas keep proposing themselves back:
 *
 * Journey followed one voucher through four steps with a panel per state. It
 * was the longest thing on the page and a third telling of Voucher Desk.
 *
 * AgentGrid dealt the roster out as product cards — /tools rebuilt in place
 * two screens down, arguing product first and work second against a section
 * that had just argued the better way round.
 *
 * RulesPlayground ("Have a go: move the numbers") put a voucher's GST and TDS
 * sums under a slider. It was Voucher Desk again, on a page the owner wants to
 * name no single tool, and it came off on 17 Oct at their request.
 *
 * HowItMoves was a pinned scroll story: a drawn sheet travelling through four
 * doorways (comes in, worked out, checked, your call). Added and taken off on
 * 17 Oct at the owner's request; it said the hero card's four beats a second
 * time.
 *
 * ProductShowcase was a representative view of the application with four cards
 * under it, and Platform was four cards about the shared foundation. Both are
 * gone.
 *
 * The thread through all six: this page kept wanting to say the same things a
 * second time in a different shape. The calendar owns the roster and carries
 * the link to the rest of it, and each thing is said once.
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
      {/* The live tools running past like a station board, leaning into the
          scroll, and lower down the same names in display type sliding past
          each other: motion between the arguments, not in place of one. */}
      <Ticker tools={toolBriefs(LIVE_AGENTS)} />
      <WorkCalendar jobs={calendarJobs()} />
      <KineticBand tools={toolBriefs(LIVE_AGENTS)} />
      {/* The questions a first visit asks, answered in words an assistant can
          quote, with the same words as FAQ data (HOME_FAQ in content.ts). */}
      <Section>
        <Container>
          <SectionHeading
            eyebrow="Questions"
            title="Before you start."
            lead="What it is, what it costs, and what happens to what you type in."
            center
          />
          <div className="mx-auto mt-12 max-w-3xl">
            <FaqAccordion faq={HOME_FAQ} />
          </div>
        </Container>
      </Section>
      <JsonLd data={faqLd(HOME_FAQ)} />
      <FinalCTA />
    </>
  );
}
