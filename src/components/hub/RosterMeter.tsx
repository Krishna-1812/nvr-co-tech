import { STAGE_LABEL, type AgentStage } from '@/lib/marketing/content';
import { SOLUTIONS } from '@/lib/solutions';
import { cn } from '@/lib/utils';

/**
 * The whole roster as one instrument: a cell per tool, lit if you can use it,
 * tinted if it is being built, hatched if it is only written down.
 *
 * It answers the question the grid below takes six cards to answer — how much of
 * this platform actually exists — in about a centimetre of screen. It is also the
 * honest way to show how few of the six are live, which is the sort of thing a
 * launcher usually tries to hide behind uniform tiles.
 *
 * It now sits inside the workspace hero as the working under the greeting, the
 * way True Property Cost's split bar sits under its answer: cells two pixels
 * apart so each tool is its own segment, and a legend with a swatch beside every
 * label so the kinds of cell are named in words as well as in colour.
 */
/**
 * The legend under the bar, naming only the stages something is standing on.
 *
 * It used to read "2 live · 0 in build · 4 on the roadmap". Nothing has been in
 * build for months, and a zero in a legend does not describe the bar above it:
 * there is no cell of that kind to describe. It reads instead as a stall, which
 * is the opposite of what a roadmap meter is for. The same line on the public
 * roster page had the same problem and was fixed the same way.
 */
function legend(): { stage: AgentStage; n: number }[] {
  const order: AgentStage[] = ['live', 'building', 'planned'];
  return order
    .map((stage) => ({ stage, n: SOLUTIONS.filter((s) => s.stage === stage).length }))
    .filter(({ n }) => n > 0);
}

/** What the legend calls each stage here, which is terser than the public site's. */
const SHORT: Record<AgentStage, string> = {
  live: 'Live',
  building: 'In build',
  planned: 'On the roadmap',
};

/** The swatch beside each legend label, drawn the way that kind of cell is. */
function Swatch({ stage }: { stage: AgentStage }) {
  if (stage === 'live') {
    // Every live cell is in its own tool's colour, so the swatch is all of
    // them at once rather than any one of them.
    const tones = SOLUTIONS.filter((s) => s.stage === 'live').map((s) => s.tone);
    return (
      <span
        aria-hidden
        className="size-2.5 rounded-[3px]"
        style={{
          background: tones.length > 1 ? `linear-gradient(135deg, ${tones.join(', ')})` : tones[0],
        }}
      />
    );
  }
  if (stage === 'building') {
    return (
      <span
        aria-hidden
        className="size-2.5 rounded-[3px]"
        style={{ background: 'color-mix(in oklab, var(--status-warn) 55%, transparent)' }}
      />
    );
  }
  return <span aria-hidden className="a-track a-hatch relative size-2.5 rounded-[3px]" />;
}

export function RosterMeter({ className }: { className?: string }) {
  const parts = legend();

  return (
    <div className={cn('w-full', className)}>
      <div className="flex h-2.5 gap-[2px]">
        {SOLUTIONS.map((s, i) => (
          <span
            key={s.slug}
            title={`${s.name}: ${STAGE_LABEL[s.stage]}`}
            className={cn(
              'a-track relative h-full flex-1 overflow-hidden',
              i === 0 && 'rounded-l-full',
              i === SOLUTIONS.length - 1 && 'rounded-r-full',
            )}
          >
            {s.stage === 'live' ? (
              <span
                className="a-fill absolute inset-0"
                style={{
                  background: s.tone,
                  animationDelay: `${200 + i * 60}ms`,
                }}
              />
            ) : s.stage === 'building' ? (
              // Half weight, not a tint. At 30% the in-build cell was
              // indistinguishable from the hatched ones on a white ground, which
              // lost the only distinction this row exists to draw.
              <span
                className="absolute inset-0"
                style={{ background: `color-mix(in oklab, ${s.tone} 55%, transparent)` }}
              />
            ) : (
              <span className="a-hatch absolute inset-0" />
            )}
          </span>
        ))}
      </div>

      {/*
        A key, not a tally. The counts are in the figures beside this bar; the
        legend only names the kinds of cell in it, and lets the bar do the
        counting, which it was always doing better — one cell per tool, in
        order, is a count you can see.
      */}
      <p className="text-muted mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
        {parts.map(({ stage }) => (
          <span key={stage} className="inline-flex items-center gap-1.5">
            <Swatch stage={stage} />
            {/* Only live is emphasised: it is the one kind here somebody can act
                on today. */}
            <span className={stage === 'live' ? 'font-semibold text-[var(--text-c)]' : undefined}>
              {SHORT[stage]}
            </span>
          </span>
        ))}
      </p>
    </div>
  );
}
