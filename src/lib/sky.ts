/**
 * Where the sun is over India right now, for the sun drawn across the site.
 *
 * Every page has a sun — the public hero's, the one in each tool's arch — and
 * it now stands where the real one does in Indian Standard Time: low and
 * warm at dawn, high at midday, sinking and turning to a deep orange through
 * the evening, and at night giving way to a pale crescent moon. It is the same
 * idea as the rail's FiscalMeter, which already draws the financial year as
 * the sun crossing the sky, applied to the day.
 *
 * ── One function, run in two places ──────────────────────────────────────
 *
 * `skyAt` decides. It runs in the root layout's <head> before the first paint
 * (as its own source text, see SKY_SCRIPT), so the sun is drawn in the right
 * place from the first frame instead of jumping there after hydration; and it
 * runs again every few minutes from the page (Play), so a tab left open over
 * sunset sees the sun go down. Because the head copy is this function's own
 * text, it must stay self-contained: no imports, no helpers outside it, nothing
 * a bundler would need to rewrite.
 *
 * The hours are fixed civil times for India rather than a sunrise calculation
 * for a city, which is honest for a country one time zone wide: roughly six to
 * half past six, the year round, give or take half an hour.
 */
export type Sky = 'dawn' | 'day' | 'dusk' | 'night';

export function skyAt(now: Date): { sky: Sky; dy: string } {
  // IST is UTC+5:30 with no daylight saving, so it is arithmetic on UTC.
  const h = (now.getUTCHours() + now.getUTCMinutes() / 60 + 5.5) % 24;
  const rise = 6;
  const set = 18.5;
  const sky: Sky =
    h >= 5.5 && h < 7.5 ? 'dawn' : h >= 7.5 && h < 16.5 ? 'day' : h >= 16.5 && h < 19 ? 'dusk' : 'night';
  // How high the body that is up stands: the sun by day, the moon by night,
  // each 0 on the horizon and 1 at the top of its arc.
  let alt =
    h >= rise && h < set
      ? Math.sin((Math.PI * (h - rise)) / (set - rise))
      : Math.sin((Math.PI * (((h - set + 24) % 24))) / (24 - (set - rise)));
  if (alt < 0) alt = 0;
  // Drawn as a drop below its highest place, as a share of its own size.
  const dy = Math.round((1 - alt) * 42) + '%';
  return { sky: sky, dy: dy };
}

/** Writes the sky onto <html>, where the CSS reads it. */
export function applySky(now = new Date()) {
  const { sky, dy } = skyAt(now);
  const root = document.documentElement;
  root.dataset.sky = sky;
  root.style.setProperty('--sun-dy', dy);
}

/**
 * The <head> copy. `skyAt` is inlined as its own source, so the script and the
 * module cannot disagree about where the sun is.
 */
export const SKY_SCRIPT = `try{var s=(${skyAt.toString()})(new Date()),r=document.documentElement;r.setAttribute('data-sky',s.sky);r.style.setProperty('--sun-dy',s.dy)}catch(e){}`;
