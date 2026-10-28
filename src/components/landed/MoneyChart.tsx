'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { dayNumber, isoFromDay, type InstalmentResult, type TimelinePoint } from '@/lib/landed/calc';
import { formatINR } from '@/lib/recon/amount';
import { TONE, compactINR, longDate, monthYear } from './shared';

/**
 * Money tied up, over time.
 *
 * Three stacked layers on one rupee axis: own funds paid, borrowed funds paid,
 * and the carrying cost building on top of both. The paid layers rise in steps
 * on payment days; the carrying layer grows in between, which is the whole
 * point of the tool made visible — the cost is not an event, it is a slope.
 *
 * Read with a crosshair: the pointer finds the nearest day, and the readout
 * gives every layer at that day. The same readout follows the arrow keys when
 * the chart has focus. Payment days are marked on the baseline in the colour of
 * their source, and the OC date is a rule, because that is where the carrying
 * cost stops.
 *
 * Everything the chart shows is also in the payment-by-payment table below it,
 * so nothing is reachable only by hovering.
 */

const H = 300;
const PAD = { top: 18, right: 18, bottom: 34, left: 64 };

type Layer = 'self' | 'borrowed' | 'carry';
const LAYERS: { key: Layer; label: string }[] = [
  { key: 'self', label: 'Own funds paid' },
  { key: 'borrowed', label: 'Borrowed funds paid' },
  { key: 'carry', label: 'Carrying cost' },
];

/** A clean axis maximum and its tick step: 1, 2 or 5 times a power of ten. */
function niceScale(max: number, ticks = 4) {
  if (max <= 0) return { top: 1, step: 1 };
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  return { top: Math.ceil(max / step) * step, step };
}

export function MoneyChart({
  points,
  rows,
  ocDate,
}: {
  points: TimelinePoint[];
  rows: InstalmentResult[];
  ocDate: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const first = points[0]?.day ?? 0;
    const last = points.at(-1)?.day ?? 1;
    const span = Math.max(1, last - first);
    const total = (p: TimelinePoint) => p.self + p.borrowed + p.carry;
    const { top, step } = niceScale(Math.max(...points.map(total), 1));
    const innerW = width - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const x = (day: number) => PAD.left + ((day - first) / span) * innerW;
    const y = (v: number) => PAD.top + innerH - (v / top) * innerH;

    // Each layer's top edge is the running sum of the layers beneath it.
    const stack = (p: TimelinePoint) => ({
      self: p.self,
      borrowed: p.self + p.borrowed,
      carry: p.self + p.borrowed + p.carry,
    });
    const tops = points.map(stack);
    const line = (k: Layer) => tops.map((t, i) => `${i ? 'L' : 'M'}${x(points[i].day).toFixed(1)},${y(t[k]).toFixed(1)}`).join('');
    const below: Record<Layer, Layer | null> = { self: null, borrowed: 'self', carry: 'borrowed' };
    const area = (k: Layer) => {
      const under = below[k];
      const upper = line(k);
      const lower = tops
        .map((t, i) => `L${x(points[i].day).toFixed(1)},${y(under ? t[under] : 0).toFixed(1)}`)
        .reverse()
        .join('');
      return `${upper}${lower}Z`;
    };

    const yTicks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

    // Roughly one x label per 110px, on the first of a month.
    const count = Math.max(2, Math.floor(innerW / 110));
    const xTicks: number[] = [];
    for (let i = 0; i <= count; i += 1) {
      const d = new Date((first + (span * i) / count) * 86_400_000);
      const snapped = Math.round(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 86_400_000);
      if (snapped >= first && snapped <= last && !xTicks.includes(snapped)) xTicks.push(snapped);
    }

    return { x, y, top, yTicks, xTicks, area, line, innerW, innerH, first, last };
  }, [points, width]);

  const oc = dayNumber(ocDate);
  const active = hover === null ? null : points[hover];

  const pick = (clientX: number) => {
    const rect = host.current?.getBoundingClientRect();
    if (!rect || points.length === 0) return;
    const px = clientX - rect.left;
    let best = 0;
    let bestD = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(geo.x(p.day) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    setHover((h) => {
      const n = points.length - 1;
      if (e.key === 'Home') return 0;
      if (e.key === 'End') return n;
      const cur = h ?? (e.key === 'ArrowLeft' ? n + 1 : -1);
      return Math.min(n, Math.max(0, cur + (e.key === 'ArrowRight' ? 1 : -1)));
    });
  };

  if (points.length < 2) return null;
  const end = points.at(-1)!;
  const endTotal = end.self + end.borrowed + end.carry;
  const tipLeft = active ? geo.x(active.day) : 0;
  const ocNearEnd = Number.isFinite(oc) && Math.abs(geo.x(oc) - geo.x(end.day)) < 150;
  const endLabelBelow = ocNearEnd || geo.y(endTotal) - 12 < PAD.top + 12;
  // Beside the crosshair, on whichever side has room, and never past either
  // edge: on a phone the chart is barely wider than the readout itself.
  const TIP_W = 216;
  const tipX = Math.min(
    Math.max(4, tipLeft > width - TIP_W - 24 ? tipLeft - 14 - TIP_W : tipLeft + 14),
    width - TIP_W - 4,
  );

  return (
    <figure className="m-0">
      {/* Legend: always present for three series, keyed with the area's own shape. */}
      <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 pt-4 text-[12.5px] sm:px-6">
        {LAYERS.map((l) => (
          <span key={l.key} className="text-muted inline-flex items-center gap-2">
            <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: TONE[l.key] }} />
            {l.label}{' '}
          </span>
        ))}
        <span className="text-subtle inline-flex items-center gap-2">
          <span aria-hidden className="h-3 w-px bg-[var(--text-subtle)]" />
          OC date
        </span>
      </figcaption>

      <div
        ref={host}
        role="img"
        tabIndex={0}
        aria-label={`Money tied up from ${longDate(isoFromDay(geo.first))} to ${longDate(isoFromDay(geo.last))}, ending at a true cost of ${formatINR(endTotal)}. Use the left and right arrow keys to read it day by day.`}
        onPointerMove={(e: PointerEvent<HTMLDivElement>) => pick(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
        className="relative mt-2 cursor-crosshair touch-pan-y rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <svg width={width} height={H} className="block overflow-visible" aria-hidden>
          {/* Grid: hairlines, solid, recessive. */}
          {geo.yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--border-c)" strokeWidth={1} />
              <text x={PAD.left - 10} y={geo.y(t)} dy="0.35em" textAnchor="end" className="fill-[var(--text-subtle)] text-[11px] tabular-nums">
                {t === 0 ? '0' : compactINR(t)}
              </text>
            </g>
          ))}
          {geo.xTicks.map((d) => (
            <text key={d} x={geo.x(d)} y={H - 12} textAnchor="middle" className="fill-[var(--text-subtle)] text-[11px]">
              {monthYear(d)}
            </text>
          ))}

          {/* The three layers: a wash, then a 2px top edge in the series colour. */}
          {LAYERS.map((l) => (
            <g key={l.key} className="animate-[fade_0.7s_ease-out_backwards]">
              <path d={geo.area(l.key)} fill={TONE[l.key]} fillOpacity={l.key === 'carry' ? 0.3 : 0.16} />
              <path d={geo.line(l.key)} fill="none" stroke={TONE[l.key]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          ))}

          {/* Possession. The carrying layer stops growing here. */}
          {Number.isFinite(oc) && oc >= geo.first && oc <= geo.last && (
            <g>
              <line x1={geo.x(oc)} x2={geo.x(oc)} y1={PAD.top - 6} y2={H - PAD.bottom} stroke="var(--text-subtle)" strokeWidth={1} />
              <text
                x={geo.x(oc)}
                y={PAD.top - 9}
                textAnchor={geo.x(oc) > width - 90 ? 'end' : 'middle'}
                className="fill-[var(--text-muted)] text-[10.5px] font-semibold tracking-[0.08em] uppercase"
              >
                OC · {monthYear(oc)}
              </text>
            </g>
          )}

          {/* Payment days on the baseline, ringed in the surface so they read over the fills. */}
          {rows.map((r) => (
            <circle
              key={r.id}
              cx={geo.x(dayNumber(r.date))}
              cy={geo.y(0)}
              r={4.5}
              fill={TONE[r.source]}
              stroke="var(--surface-raised)"
              strokeWidth={2}
            />
          ))}

          {/* End label: the one value the chart is about, said once. */}
          {!active && (
            <g>
              <circle cx={geo.x(end.day)} cy={geo.y(endTotal)} r={4.5} fill={TONE.carry} stroke="var(--surface-raised)" strokeWidth={2} />
              {/* Above the end point, unless that is where the OC label is: then
                  below it, inside the carrying layer, so the two never collide. */}
              <text
                x={geo.x(end.day) - 10}
                y={endLabelBelow ? geo.y(endTotal) + 20 : geo.y(endTotal) - 12}
                textAnchor="end"
                // A halo in the card colour, so it reads wherever a layer edge runs under it.
                stroke="var(--surface-raised)"
                strokeWidth={4}
                strokeLinejoin="round"
                paintOrder="stroke"
                className="fill-[var(--text-c)] text-[12px] font-semibold tabular-nums"
              >
                {compactINR(endTotal)} true cost
              </text>
            </g>
          )}

          {/* Crosshair. */}
          {active && (
            <g>
              <line x1={tipLeft} x2={tipLeft} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--text-c)" strokeOpacity={0.35} strokeWidth={1} />
              {(['self', 'borrowed', 'carry'] as const).map((k) => {
                const v = k === 'self' ? active.self : k === 'borrowed' ? active.self + active.borrowed : active.self + active.borrowed + active.carry;
                return <circle key={k} cx={tipLeft} cy={geo.y(v)} r={4} fill={TONE[k]} stroke="var(--surface-raised)" strokeWidth={2} />;
              })}
            </g>
          )}
        </svg>

        {active && (
          <div
            role="presentation"
            className="surface-lit elev-3 pointer-events-none absolute top-2 z-10 rounded-xl border px-3.5 py-3 text-[12.5px]"
            style={{ left: tipX, width: TIP_W }}
          >
            <p className="a-label">{longDate(isoFromDay(active.day))}</p>
            <dl className="mt-2 space-y-1.5">
              {LAYERS.map((l) => (
                <div key={l.key} className="flex items-center justify-between gap-3">
                  <dt className="text-muted inline-flex items-center gap-2">
                    <span aria-hidden className="h-[2px] w-3 rounded-full" style={{ background: TONE[l.key] }} />
                    {l.key === 'self' ? 'Own' : l.key === 'borrowed' ? 'Borrowed' : 'Carrying'}
                  </dt>
                  <dd className="font-semibold tabular-nums">{formatINR(active[l.key])}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 border-t pt-1.5">
                <dt className="text-muted">Tied up</dt>
                <dd className="font-bold tabular-nums">{formatINR(active.self + active.borrowed + active.carry)}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </figure>
  );
}
