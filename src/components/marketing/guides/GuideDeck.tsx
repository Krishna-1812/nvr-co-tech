import { HeroStage } from '../play/HeroStage';
import { Odometer } from '../play/Odometer';
import type { GuideCard } from './summary';

/*
 * Where each card lies in the stack, and where it goes when the pointer is over
 * the deck: the back two fan out to either side and the front one lifts.
 */
const LIE = [
  { x: '-1.5rem', y: '2.6rem', r: '-7deg', hx: '-7.5rem', hy: '3.2rem', hr: '-13deg', d: '420ms' },
  { x: '1.6rem', y: '1.4rem', r: '6deg', hx: '7.5rem', hy: '2.2rem', hr: '12deg', d: '560ms' },
  { x: '0', y: '0', r: '-1.5deg', hx: '0', hy: '-1rem', hr: '0deg', d: '700ms' },
];

/**
 * The index hero's picture: three guides as a hand of cards, dealt into the
 * arch window on load and fanned out when the pointer comes over them. The front
 * card's figure rolls in on the odometer as it lands.
 *
 * Decoration: the same guides are listed, as links, further down the page.
 */
export function GuideDeck({ cards }: { cards: GuideCard[] }) {
  const hand = cards.slice(0, 3).reverse();
  return (
    <HeroStage className="m-arch m-arch-open relative overflow-hidden bg-[var(--sky-wash,var(--m-bg-2))] px-4 pt-24 pb-6 transition-colors duration-[4s] sm:px-8 sm:pt-28">
      <span aria-hidden className="m-stars" />
      <span aria-hidden className="m-drift-far absolute inset-0">
        <span className="m-sun absolute top-10 left-1/2 size-44 -translate-x-1/2 sm:size-56" />
      </span>
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-36 bg-[var(--m-bg-3)]"
        style={{ borderRadius: '60% 40% 0 0 / 30% 25% 0 0' }}
      />
      <div aria-hidden className="m-drift-near relative">
        <div className="g-deck" data-grab>
          {hand.map((c, i) => {
            const lie = LIE[i];
            const front = i === hand.length - 1;
            return (
              <div
                key={c.slug}
                className="g-deck-card m-card rounded-3xl p-6"
                style={
                  {
                    '--x': lie.x, '--y': lie.y, '--r': lie.r,
                    '--hx': lie.hx, '--hy': lie.hy, '--hr': lie.hr, '--d': lie.d,
                  } as React.CSSProperties
                }
              >
                <div className="flex items-center justify-between">
                  <span className="m-eyebrow" style={{ color: c.colorText }}>
                    Guide {c.n}
                  </span>
                  <span className="m-arch h-6 w-5 overflow-hidden" style={{ background: c.color }}>
                    <span className="mx-auto mt-2.5 block size-3 rounded-full bg-[var(--m-sun)]" />
                  </span>
                </div>
                <p className="m-display mt-5 t-h3 tabular-nums" style={{ color: c.colorText }}>
                  {front ? <Odometer value={c.figure.value} roll="load" delay={1300} /> : c.figure.value}
                </p>
                <p className="m-dim-2 mt-1 t-2">{c.figure.label}</p>
                <p className="mt-5 border-t border-[var(--m-line)] pt-4 t-4 font-semibold text-[var(--m-ink)]">{c.title}</p>
              </div>
            );
          })}
        </div>
      </div>
    </HeroStage>
  );
}
