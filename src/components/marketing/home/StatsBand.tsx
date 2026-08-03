import { Container } from '../bits';
import { Counter } from '../motion';
import { Reveal } from '../Reveal';

/**
 * Four figures about how the thing is built, not four figures about how well it
 * is selling. A brand-new platform quoting adoption numbers is either lying or
 * quoting something meaningless, and a finance audience can tell.
 *
 * Three of them count up; the fourth is a region name and stays put. A counter
 * animating a word would be a gimmick, and the mixed row reads better for it —
 * the eye notices the one that behaves differently.
 */
const FIGURES = [
  {
    to: 2,
    label: 'Approvals needed',
    hint: 'From two different people, and not the one who raised it',
  },
  {
    to: 0,
    label: 'Ways to change the history',
    hint: 'Nobody can edit or delete a line, at any level',
  },
  {
    to: 32,
    label: 'Fields kept',
    hint: 'Every one from the voucher your team already uses',
  },
  {
    text: 'ap-south-1',
    label: 'Where your data sits',
    hint: 'Mumbai, on managed Postgres',
  },
] as const;

export function StatsBand() {
  return (
    <section className="relative border-y border-[var(--m-line)] bg-white/[0.015] py-16">
      {/* One hairline sweeping the band, so it is not simply a lighter stripe. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--m-cyan) 35%, var(--m-violet) 65%, transparent)',
        }}
      />

      <Container wide>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {FIGURES.map((f, i) => (
            <Reveal key={f.label} delay={i * 70}>
              <p className="m-display m-tabular text-[clamp(2.2rem,5vw,3.4rem)] leading-none">
                {'text' in f ? (
                  <span className="m-mono text-[clamp(1.15rem,2.4vw,1.6rem)] tracking-tight">
                    {f.text}
                  </span>
                ) : (
                  <Counter to={f.to} duration={1100 + i * 220} />
                )}
              </p>
              <p className="m-eyebrow mt-3">{f.label}</p>
              <p className="m-dim-2 mt-1.5 text-xs">{f.hint}</p>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
