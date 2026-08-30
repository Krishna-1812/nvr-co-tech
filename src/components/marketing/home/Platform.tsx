import { ROSTER, SHARED } from '@/lib/marketing/content';
import { Container, Section, SectionHeading } from '../bits';


/**
 * Why these should come from one place, rather than from four vendors.
 *
 * This is the section that has to earn the roster above it. A finance team can
 * buy a reconciliation tool from one company and a voucher system from another,
 * and the honest answer to why they should not is not a bundle price: it is that
 * the second vendor's records are a copy of the first vendor's records, and
 * copies drift.
 *
 * ── What was cut ────────────────────────────────────────────────────────────
 *
 * A diagram of all six names on one gradient rail, each dropping a stem onto it.
 * It was the third time the same six were listed on this page, and the argument
 * it illustrated was one the four cards below already make in words. It also
 * quietly depended on there being six things to put on the rail: four of them
 * are not built, so most of that diagram was a picture of a plan.
 *
 * The heading no longer counts them either. "Six tools, one set of records" is a
 * sentence that goes stale in both directions, and it was already stale in the
 * expensive one.
 */
export function Platform() {
  return (
    <Section id="platform">
      <Container wide>
        <SectionHeading
          eyebrow="One foundation"
          title={
            <>
              Different jobs.
              <br />
              <span className="m-serif m-dim">One account underneath them.</span>
            </>
          }
          lead={
            `Buy ${ROSTER.totalWord} tools from ${ROSTER.totalWord} companies and you get `
            + `${ROSTER.totalWord} logins, ${ROSTER.totalWord} lists of who is allowed to approve `
            + `things, and ${ROSTER.totalWord} copies of the same supplier that slowly stop `
            + 'agreeing. Ours are one application with one door into it, so the reconciliation and '
            + 'the payment it clears are looking at the same chapter, the same people and the same '
            + 'history.'
          }
        />

        {/*
          `.s-deal` rather than four <Reveal>s with increasing delays.

          These four are a numbered sequence — 01 to 04 — and they sit in one
          row at `lg`, which is exactly the case a scroll timeline handles badly
          on its own: four elements at the same height reach the fold at the
          same moment and arrive together. `.s-deal` gives each child its own
          slice of the shared range, so they deal out left to right as the row
          is scrolled in, and deal back as it is scrolled out.

          It is also one component fewer per card. Reveal exists to run an
          observer, and there is nothing here for an observer to decide.
        */}
        <div className="s-deal mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SHARED.map((s, i) => (
            <div key={s.title} className="m-card h-full rounded-2xl p-6">
              <p className="m-mono text-[11px] tracking-[0.16em] text-[var(--m-gold)]">
                {String(i + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{s.title}</h3>
              <p className="m-dim mt-2.5 text-[13px] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
