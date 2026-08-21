import { STAGE_LABEL, type AgentStage } from '@/lib/marketing/content';
import { SOLUTIONS } from '@/lib/solutions';

/**
 * The whole roster as one instrument: a cell per tool, lit if you can use it,
 * tinted if it is being built, hatched if it is only written down.
 *
 * It answers the question the grid below takes six cards to answer — how much of
 * this platform actually exists — in about a centimetre of screen. It is also the
 * honest way to show how few of the six are live, which is the sort of thing a
 * launcher usually tries to hide behind uniform tiles.
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
  live: 'live',
  building: 'in build',
  planned: 'on the roadmap',
};

export function RosterMeter() {
  const parts = legend();

  return (
    <div className="w-full sm:w-72">
      <p className="a-label">The roster</p>

      <div className="mt-2.5 flex gap-1.5">
        {SOLUTIONS.map((s, i) => (
          <span
            key={s.slug}
            title={`${s.name}: ${STAGE_LABEL[s.stage]}`}
            className="a-track relative h-2 flex-1 overflow-hidden rounded-full"
          >
            {s.stage === 'live' ? (
              <span
                className="a-fill absolute inset-0"
                style={{
                  background: `linear-gradient(90deg, ${s.tone}, color-mix(in oklab, ${s.tone} 45%, transparent))`,
                  animationDelay: `${i * 60}ms`,
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

      <p className="text-subtle mt-2.5 text-[11px]">
        {parts.map(({ stage, n }, i) => (
          <span key={stage}>
            {i > 0 && <span className="px-1.5 opacity-50">·</span>}
            {/* Only the live count is emphasised: it is the one figure here
                somebody can act on today. */}
            <span className={stage === 'live' ? 'font-semibold text-[var(--text-c)]' : undefined}>
              {n} {SHORT[stage]}
            </span>
          </span>
        ))}
      </p>
    </div>
  );
}
