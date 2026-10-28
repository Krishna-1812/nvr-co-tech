import { Plus } from 'lucide-react';
import { Reveal } from '../Reveal';

/**
 * Questions that open and close with their height animated (CSS, `.g-faq`).
 * The first is open. Every answer is in the HTML whether open or not, so search
 * engines and the FAQ structured data see the same words a reader does.
 */
export function FaqAccordion({ faq }: { faq: readonly { q: string; a: string }[] }) {
  return (
    <div className="space-y-3">
      {faq.map((f, i) => (
        <Reveal key={f.q} delay={Math.min(i, 4) * 60}>
          <details className="g-faq m-card group rounded-2xl" open={i === 0}>
            <summary className="flex items-center justify-between gap-6 px-6 py-5">
              <span className="t-4 font-semibold text-[var(--m-ink)]">{f.q}</span>
              <span
                aria-hidden
                className="g-plus grid size-9 shrink-0 place-items-center rounded-full border border-[var(--m-line-2)] text-[var(--m-ink)]"
              >
                <Plus className="size-4" />
              </span>
            </summary>
            <p className="m-dim px-6 pb-6 t-3">{f.a}</p>
          </details>
        </Reveal>
      ))}
    </div>
  );
}
