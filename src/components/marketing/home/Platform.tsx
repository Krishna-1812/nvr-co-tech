import { AGENTS, SHARED } from '@/lib/marketing/content';
import { ACCENT, Container, Section, SectionHeading } from '../bits';
import { Reveal } from '../Reveal';

/**
 * Why six tools from one place, rather than six tools.
 *
 * This is the section that has to earn the roster above it. A finance team can
 * buy a GST matcher from one company and a voucher system from another, and the
 * honest answer to why they should not is not a bundle price: it is that the
 * second vendor's records are a copy of the first vendor's records, and copies
 * drift. So the diagram puts the six tools on one rail and names the four things
 * under it in plain words.
 */
export function Platform() {
  return (
    <Section id="platform" className="overflow-hidden">
      <Container wide>
        <SectionHeading
          eyebrow="One platform"
          title={
            <>
              Six tools.
              <br />
              <span className="m-serif m-dim">One set of records.</span>
            </>
          }
          lead="Buy these from six different companies and you get six logins, six lists of who is allowed to approve things, and six copies of the same supplier that slowly stop agreeing. Ours sit on one foundation, so the GST match, the TDS working and the payment are all looking at the same invoice."
        />

        <Reveal delay={80} className="mt-16">
          <Spine />
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SHARED.map((s, i) => (
            <Reveal key={s.title} delay={i * 70}>
              <div className="m-card h-full rounded-2xl p-6">
                <p className="m-mono text-[11px] tracking-[0.16em] text-[var(--m-cyan)]">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{s.title}</h3>
                <p className="m-dim mt-2.5 text-[13px] leading-relaxed">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/**
 * Six tools, each dropping a stem onto one rail.
 *
 * The stems are what make the point: without them it is a row of names above a
 * gradient, and the gradient could be decoration. With them it is plainly one
 * thing they are all standing on.
 */
function Spine() {
  return (
    <div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
        {AGENTS.map((a) => (
          <li key={a.slug} className="flex flex-col items-center">
            <span className="m-card m-ring flex w-full items-center gap-2 rounded-xl px-3 py-2.5">
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: ACCENT[a.accent] }}
              />
              <span className="truncate text-[12px] font-medium">{a.name}</span>
              {a.stage === 'live' && (
                <span
                  className="m-mono ml-auto shrink-0 text-[9px] tracking-[0.1em] uppercase"
                  style={{ color: 'var(--m-emerald)' }}
                >
                  live
                </span>
              )}
            </span>
            {/*
              Only once all six are on one row. Below lg the grid wraps, and a
              stem on a chip in the first row would drop into the gap above the
              second row rather than onto the rail, which is worse than no stem.
            */}
            <span
              aria-hidden
              className="hidden h-7 w-px lg:block"
              style={{
                background: `linear-gradient(to bottom, transparent, ${ACCENT[a.accent]})`,
              }}
            />
          </li>
        ))}
      </ul>

      {/* The rail. One travelling highlight, so it reads as something running
          underneath rather than a painted stripe. */}
      <div className="relative mt-7 h-[3px] overflow-hidden rounded-full lg:mt-0">
        <span aria-hidden className="absolute inset-0" style={{ backgroundImage: 'var(--m-grad)' }} />
        <span
          aria-hidden
          className="absolute inset-y-0 w-1/4 animate-[sweep_5s_ease-in-out_infinite] motion-reduce:hidden"
          style={{ background: 'linear-gradient(90deg, transparent, white, transparent)', opacity: 0.5 }}
        />
      </div>

      <p className="m-mono m-dim-2 mt-4 text-center text-[10px] tracking-[0.18em] uppercase">
        One sign-in · one set of roles · one set of records · one history
      </p>
    </div>
  );
}
