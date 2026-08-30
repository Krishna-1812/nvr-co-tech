/**
 * The room the app is sitting in.
 *
 * Five layers, none of which the reader is ever meant to look at: a wash, two
 * coloured lights on slow independent orbits, a hairline grid, film grain, and a
 * vignette at the foot of the screen. Together they are the difference between
 * cards floating in a considered space and cards sitting on a flat grey rectangle.
 *
 * Two decisions worth keeping:
 *
 *   It is `fixed`, not scrolled. A gradient that travels up the screen behind a
 *   long register turns the backdrop into part of the content, and a table of
 *   two hundred rows would drag the whole atmosphere past you.
 *
 *   Only `transform` animates. The blurs are rasterised once and then moved, so
 *   the whole thing costs a compositor thread and nothing else — which matters
 *   because this is a screen somebody leaves open for a working day.
 *
 * Strength comes from the --a-glow-* tokens, which are about a third as strong in
 * the light theme. Coloured light on near-black reads as atmosphere; the same
 * light on white reads as a dirty screen.
 */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* The wash. Sits under everything and keeps the top of the page from
          being the same value as the bottom. */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--surface-sunken),var(--surface)_38%,var(--surface))]" />

      {/*
        Two lights — one cool, one warm, the only two hues in the system. There
        used to be a third, a cyan, and three saturated fields drifting behind a
        page of figures is both the most-copied backdrop on the web and enough
        colour to tint the paper the numbers are printed on.

        The durations are deliberately co-prime-ish and the second delay
        negative, so it starts mid-cycle and the pattern of their overlap never
        repeats on any timescale a person would notice.
      */}
      <span
        className="a-orb -top-[22vh] -left-[12vw] size-[min(60rem,78vw)]"
        style={{
          background: 'radial-gradient(circle, var(--a-glow-1), transparent 68%)',
          animation: 'aurora 34s ease-in-out infinite',
        }}
      />
      <span
        className="a-orb top-[6vh] -right-[14vw] size-[min(48rem,64vw)]"
        style={{
          background: 'radial-gradient(circle, var(--a-glow-2), transparent 68%)',
          animation: 'aurora 46s ease-in-out -11s infinite reverse',
        }}
      />
      {/* The grid, faded out radially so it never reaches an edge and read as a
          border. */}
      <div className="a-grid absolute inset-0 opacity-[0.45] [mask-image:radial-gradient(80%_60%_at_50%_0%,#000,transparent)]" />

      {/* Grain over the lights, so it textures them rather than sitting under. */}
      <div className="a-grain absolute inset-0" />

      {/* Vignette. Gives the page a floor, which is what stops a short screen
          from looking like it was cropped. */}
      <div className="absolute inset-x-0 bottom-0 h-64 bg-[linear-gradient(180deg,transparent,var(--surface-sunken))] opacity-70" />
    </div>
  );
}
