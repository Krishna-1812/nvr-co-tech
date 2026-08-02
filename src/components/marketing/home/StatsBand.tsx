import { Container, Stat } from '../bits';
import { Reveal } from '../Reveal';

/**
 * Four figures about how the thing is built, not four figures about how well it
 * is selling. A brand-new platform quoting adoption numbers is either lying or
 * quoting something meaningless, and a finance audience can tell.
 */
const FIGURES = [
  { value: '2', label: 'Approvals required', hint: 'From two different people, neither the initiator' },
  { value: '0', label: 'Ways to alter history', hint: 'The audit table has no update or delete path' },
  { value: '32', label: 'Fields preserved', hint: "The firm's original voucher, unchanged" },
  { value: 'ap-south-1', label: 'Where your data sits', hint: 'Mumbai, on managed Postgres' },
];

export function StatsBand() {
  return (
    <section className="relative border-y border-[var(--m-line)] bg-white/[0.015] py-16">
      <Container wide>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {FIGURES.map((f, i) => (
            <Reveal key={f.label} delay={i * 70}>
              <Stat value={f.value} label={f.label} hint={f.hint} />
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
