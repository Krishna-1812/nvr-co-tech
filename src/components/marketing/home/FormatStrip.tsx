import { FORMATS } from '@/lib/marketing/content';
import { Container } from '../bits';

/**
 * The formats a finance team in India already works in.
 *
 * The point of this strip is recognition rather than information. Someone should
 * scan it and think "these people know what my week looks like" before they read
 * a single feature. The list is doubled and translated exactly -50% so the loop
 * has no seam.
 */
export function FormatStrip() {
  const doubled = [...FORMATS, ...FORMATS];

  return (
    <section className="border-y border-[var(--m-line)] bg-white/[0.015] py-8">
      <Container wide>
        <p className="m-eyebrow text-center">Works with what your team already uses</p>
      </Container>

      <div className="m-marquee-mask relative mt-7 overflow-hidden">
        <div className="m-marquee flex w-max items-center gap-3 will-change-transform">
          {doubled.map((f, i) => (
            <span
              key={`${f}-${i}`}
              className="m-mono shrink-0 rounded-md border border-[var(--m-line)] px-4 py-2 text-[12px] tracking-[0.06em] whitespace-nowrap"
              // The second half is a duplicate of the first, so it must not be
              // read out twice.
              aria-hidden={i >= FORMATS.length}
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
