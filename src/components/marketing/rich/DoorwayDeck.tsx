import { ArchScene as SceneArch, type SceneMotif } from '@/components/ui/Scene';
import { HeroStage } from '../play/HeroStage';

const LIE = [
  { x: '-7rem', y: '2.2rem', r: '-9deg', hx: '-11rem', hy: '2.8rem', hr: '-14deg', d: '420ms' },
  { x: '7rem', y: '2.2rem', r: '9deg', hx: '11rem', hy: '2.8rem', hr: '14deg', d: '560ms' },
  { x: '0', y: '0', r: '0deg', hx: '0', hy: '-1.2rem', hr: '0deg', d: '700ms' },
];

/**
 * Three doorways, each in a tool's colour with that tool's scene standing in
 * it, dealt into the hero's arch window and fanned apart under the pointer.
 * Decoration: the same tools are listed as links further down the page.
 */
export function DoorwayDeck({ doors }: { doors: { name: string; color: string; motif: SceneMotif }[] }) {
  const hand = doors.slice(0, 3);
  // The middle of the hand is the last drawn, so it sits on top.
  const order = [hand[1], hand[2], hand[0]].filter(Boolean);
  return (
    <HeroStage className="m-arch m-arch-open relative overflow-hidden bg-[var(--sky-wash,var(--m-bg-2))] px-4 pt-20 pb-6 transition-colors duration-[4s] sm:px-8">
      <span aria-hidden className="m-stars" />
      <span aria-hidden className="m-drift-far absolute inset-0">
        <span className="m-sun absolute top-8 left-1/2 size-44 -translate-x-1/2 sm:size-56" />
      </span>
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-32 bg-[var(--m-bg-3)]"
        style={{ borderRadius: '60% 40% 0 0 / 30% 25% 0 0' }}
      />
      <div aria-hidden className="m-drift-near relative">
        <div className="g-deck !h-[24rem]" data-grab>
          {order.map((d, i) => {
            const lie = LIE[i];
            return (
              <div
                key={d.name}
                className="g-deck-card !w-[12rem] !rounded-none !bg-transparent !shadow-none"
                style={
                  {
                    marginLeft: '-6rem',
                    '--x': lie.x, '--y': lie.y, '--r': lie.r,
                    '--hx': lie.hx, '--hy': lie.hy, '--hr': lie.hr, '--d': lie.d,
                  } as React.CSSProperties
                }
              >
                <div className="m-arch p-2 shadow-[0_30px_50px_-28px_rgb(60_30_15_/_0.6)]" style={{ background: d.color }}>
                  <SceneArch motif={d.motif} sun={false} className="h-[15rem] min-h-0 sm:h-[17rem]" />
                </div>
                <p className="m-card mx-auto -mt-5 w-fit rounded-xl px-3 py-1.5 t-2 font-semibold whitespace-nowrap text-[var(--m-ink)] shadow-[0_12px_24px_-16px_rgb(60_30_15_/_0.6)]">
                  {d.name}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </HeroStage>
  );
}
