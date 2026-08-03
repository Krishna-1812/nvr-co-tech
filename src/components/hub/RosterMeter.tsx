import { STAGE_LABEL } from '@/lib/marketing/content';
import { SOLUTIONS, stageCounts } from '@/lib/solutions';

/**
 * The whole roster as one instrument: a cell per tool, lit if you can use it,
 * tinted if it is being built, hatched if it is only written down.
 *
 * It answers the question the grid below takes six cards to answer — how much of
 * this platform actually exists — in about a centimetre of screen. It is also the
 * honest way to show that one of six is live, which is the sort of thing a launcher
 * usually tries to hide behind uniform tiles.
 */
export function RosterMeter() {
  const counts = stageCounts();

  return (
    <div className="w-full sm:w-72">
      <p className="a-label">The roster</p>

      <div className="mt-2.5 flex gap-1.5">
        {SOLUTIONS.map((s, i) => (
          <span
            key={s.slug}
            title={`${s.name} — ${STAGE_LABEL[s.stage]}`}
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
        <span className="font-semibold text-[var(--text-c)]">{counts.live} live</span>
        <span className="px-1.5 opacity-50">·</span>
        {counts.building} in build
        <span className="px-1.5 opacity-50">·</span>
        {counts.planned} on the roadmap
      </p>
    </div>
  );
}
