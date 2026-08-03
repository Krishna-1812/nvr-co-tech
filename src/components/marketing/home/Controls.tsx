import { Database, FileLock2, MapPin, UserRoundX } from 'lucide-react';
import { CONTROLS } from '@/lib/marketing/content';
import { ArrowLink, Container, Section, SectionHeading } from '../bits';
import { Reveal } from '../Reveal';

const ICONS = [Database, UserRoundX, FileLock2, MapPin];

/**
 * The controls section.
 *
 * Every one of these is a claim about where enforcement lives, which is the only
 * security claim worth making to an accountant. Not "we take security seriously"
 * but "here is the layer that would have to be defeated".
 */
export function Controls() {
  return (
    <Section id="controls">
      <Container wide>
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading
              eyebrow="Controls"
              title={
                <>
                  The database says no,
                  <br />
                  <span className="m-serif m-dim">so the app does not have to.</span>
                </>
              }
              lead="An approval rule that only exists in the app is a suggestion. Anyone with the API key can walk around it. Ours sit in the database instead, so they hold whoever is asking and whatever the app happens to believe."
            />
            <ArrowLink href="/security" className="mt-8">
              Security &amp; trust
            </ArrowLink>
          </div>

          <ul className="space-y-px overflow-hidden rounded-2xl border border-[var(--m-line)] bg-[var(--m-line)]">
            {CONTROLS.map((c, i) => {
              const Icon = ICONS[i] ?? Database;
              return (
                <Reveal
                  as="li"
                  key={c.title}
                  delay={i * 70}
                  className="flex gap-5 bg-[var(--m-bg)] p-6 transition-colors hover:bg-white/[0.025]"
                >
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--m-line)] bg-white/[0.03]">
                    <Icon className="size-4 text-[var(--m-cyan)]" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold">{c.title}</h3>
                    <p className="m-dim mt-2 text-[13px] leading-relaxed">{c.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
