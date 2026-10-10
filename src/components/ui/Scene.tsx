import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The arch every tool's hero stands beside.
 *
 * The public site keeps returning to one shape, a window with the sun rising in
 * it, and True Property Cost brought it inside: a tower going up in the arch,
 * the figure that matters set on a seal at its foot. This is that picture made
 * into a set, one scene per tool, so that every tool opens the same way and each
 * still says what it is for.
 *
 * Every scene is drawn in the page's own tokens — ink, sand, sun and terracotta —
 * so both themes come for free, and every scene is decoration: hidden from
 * assistive technology, with anything it might seem to say said in text beside
 * it. The seal is the one place a caller puts a figure, and that figure must be
 * in the hero's text as well.
 */
export type SceneMotif =
  | 'tower'
  | 'voucher'
  | 'scales'
  | 'columns'
  | 'seekers'
  | 'sundial'
  | 'owl'
  | 'doorways'
  | 'ledger'
  | 'gate';

const INK = 'var(--text-c)';
const SUN = 'var(--scene-sun)';
const CLAY = 'var(--lc-carry)';
const PAPER = 'var(--surface-raised)';
const DUNE = 'var(--border-strong)';

/** The ground every scene stands on. */
function Dune() {
  return (
    <>
      <path d="M0 196 C 50 178, 120 186, 200 172 L200 220 L0 220 Z" fill={DUNE} opacity="0.55" />
      <path d="M0 206 C 60 196, 130 204, 200 194 L200 220 L0 220 Z" fill={DUNE} opacity="0.35" />
    </>
  );
}

/** Lets an SVG group animate about its own box rather than the drawing's origin. */
const BOX = { transformBox: 'fill-box' } as const;

function Tower() {
  return (
    <g className="animate-[rise_1.2s_cubic-bezier(0.22,1,0.36,1)_0.5s_backwards]">
      <rect x="66" y="78" width="62" height="122" rx="2" fill={INK} opacity="0.9" />
      {Array.from({ length: 7 }, (_, row) =>
        Array.from({ length: 3 }, (_, col) => (
          <rect
            key={`${row}-${col}`}
            x={74 + col * 17}
            y={88 + row * 15}
            width="10"
            height="8"
            rx="1"
            fill={SUN}
            opacity={row < 2 ? 0.25 : 0.85}
          />
        )),
      )}
      <rect x="128" y="120" width="30" height="80" rx="2" fill={INK} opacity="0.7" />
      <rect x="40" y="134" width="26" height="66" rx="2" fill={INK} opacity="0.6" />
      {/* The crane: it is still going up. */}
      <path d="M120 78 V 34 M 92 38 H 168 M120 38 L 160 38 L 120 52" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M160 38 V 60" stroke={INK} strokeWidth="1.5" />
      <rect x="155" y="60" width="10" height="7" fill={CLAY} />
    </g>
  );
}

/** A voucher slip on its stack, with the approval stamp coming down on it. */
function Voucher() {
  return (
    <g>
      <g className="animate-[rise_1.1s_cubic-bezier(0.22,1,0.36,1)_0.45s_backwards]">
        <rect x="52" y="74" width="84" height="116" rx="5" fill={INK} opacity="0.16" transform="rotate(-7 94 132)" />
        <rect x="60" y="66" width="84" height="122" rx="5" fill={PAPER} stroke={INK} strokeWidth="2" />
        <rect x="70" y="78" width="34" height="6" rx="2" fill={INK} />
        <rect x="70" y="90" width="22" height="3" rx="1.5" fill={INK} opacity="0.35" />
        {[106, 116, 126].map((y) => (
          <g key={y}>
            <rect x="70" y={y} width="40" height="3" rx="1.5" fill={INK} opacity="0.3" />
            <rect x="118" y={y} width="16" height="3" rx="1.5" fill={INK} opacity="0.3" />
          </g>
        ))}
        <path d="M70 138 H134" stroke={INK} strokeWidth="1" opacity="0.4" strokeDasharray="3 3" />
        <rect x="70" y="146" width="26" height="5" rx="2" fill={INK} opacity="0.7" />
        <rect x="108" y="145" width="26" height="7" rx="2" fill={SUN} />
      </g>
      <g className="animate-[pop_0.5s_cubic-bezier(0.34,1.56,0.64,1)_1.35s_backwards] origin-center" style={BOX}>
        <circle cx="136" cy="118" r="19" fill={PAPER} stroke={CLAY} strokeWidth="3" />
        <circle cx="136" cy="118" r="13.5" fill="none" stroke={CLAY} strokeWidth="1" opacity="0.7" />
        <path d="M128.5 118.5 L134 124 L144 112.5" fill="none" stroke={CLAY} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
}

/** Two ledgers on a balance that comes to rest level. */
function Scales() {
  const pan = (cx: number, books: [string, string]) => (
    <g>
      <path d={`M${cx - 14} 76 L${cx - 18} 122 M${cx + 14} 76 L${cx + 18} 122`} stroke={INK} strokeWidth="1.3" opacity="0.7" />
      <rect x={cx - 13} y="111" width="26" height="9" rx="1.5" fill={books[0]} />
      <rect x={cx - 11} y="103" width="22" height="8" rx="1.5" fill={books[1]} />
      <path d={`M${cx - 22} 121 Q ${cx} 136 ${cx + 22} 121 Z`} fill={INK} />
    </g>
  );
  return (
    <g className="animate-[rise_1.1s_cubic-bezier(0.22,1,0.36,1)_0.45s_backwards]">
      <path d="M76 194 L124 194 L115 182 L85 182 Z" fill={INK} />
      <rect x="97" y="70" width="6" height="114" rx="2" fill={INK} />
      <g className="sc-tip" style={{ transformOrigin: '100px 73px' }}>
        <rect x="38" y="71" width="124" height="5" rx="2.5" fill={INK} />
        {pan(52, [CLAY, SUN])}
        {pan(148, [SUN, CLAY])}
      </g>
      <circle cx="100" cy="66" r="7" fill={SUN} stroke={INK} strokeWidth="2" />
    </g>
  );
}

/** Comparable companies as columns, the subject marked against their median. */
function Columns() {
  const heights = [58, 92, 74, 104, 50, 84];
  const median = 79;
  return (
    <g>
      {heights.map((h, i) => (
        <rect
          key={i}
          x={34 + i * 23}
          y={190 - h}
          width="16"
          height={h}
          rx="3"
          fill={INK}
          opacity={0.55 + (i % 3) * 0.15}
          className="animate-[rise-y_0.9s_cubic-bezier(0.22,1,0.36,1)_backwards] origin-bottom"
          style={{ ...BOX, animationDelay: `${450 + i * 90}ms` }}
        />
      ))}
      <path d={`M24 ${190 - median} H176`} stroke={SUN} strokeWidth="2.5" strokeDasharray="5 4" strokeLinecap="round" className="animate-[fade_0.6s_ease-out_1.1s_backwards]" />
      <g className="animate-[pop_0.5s_cubic-bezier(0.34,1.56,0.64,1)_1.3s_backwards] origin-center" style={BOX}>
        <path d={`M100 ${190 - median - 13} L113 ${190 - median} L100 ${190 - median + 13} L87 ${190 - median} Z`} fill={CLAY} stroke={PAPER} strokeWidth="2.5" />
      </g>
    </g>
  );
}

/** Three people on the ridge, and a glass finding the one being looked for. */
function Seekers() {
  const person = (x: number, y: number, s: number, fill: string, opacity = 1) => (
    <g opacity={opacity}>
      <circle cx={x} cy={y} r={9 * s} fill={fill} />
      <path d={`M${x - 17 * s} ${y + 34 * s} C ${x - 17 * s} ${y + 14 * s}, ${x + 17 * s} ${y + 14 * s}, ${x + 17 * s} ${y + 34 * s} Z`} fill={fill} />
    </g>
  );
  return (
    <g className="animate-[rise_1.1s_cubic-bezier(0.22,1,0.36,1)_0.45s_backwards]">
      {person(56, 146, 0.95, INK, 0.55)}
      {person(146, 148, 0.9, INK, 0.45)}
      {person(100, 128, 1.15, INK)}
      <g className="sc-seek">
        <circle cx="112" cy="118" r="30" fill={SUN} opacity="0.28" />
        <circle cx="112" cy="118" r="30" fill="none" stroke={INK} strokeWidth="5" />
        <path d="M134 140 L156 162" stroke={INK} strokeWidth="9" strokeLinecap="round" />
        <path d="M98 102 A 20 20 0 0 1 116 96" stroke={PAPER} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8" />
      </g>
    </g>
  );
}

/** A sundial: the oldest instrument there is for reading what has happened. */
function Sundial() {
  return (
    <g className="animate-[rise_1.1s_cubic-bezier(0.22,1,0.36,1)_0.45s_backwards]">
      <rect x="84" y="170" width="32" height="22" rx="2" fill={INK} opacity="0.8" />
      <ellipse cx="100" cy="170" rx="72" ry="17" fill={PAPER} stroke={INK} strokeWidth="2" />
      {Array.from({ length: 9 }, (_, i) => {
        const a = Math.PI * (0.06 + (i / 8) * 0.88);
        const x1 = 100 - Math.cos(a) * 60;
        const y1 = 170 - Math.sin(a) * 13;
        const x2 = 100 - Math.cos(a) * 68;
        const y2 = 170 - Math.sin(a) * 15;
        return <path key={i} d={`M${x1} ${y1} L${x2} ${y2}`} stroke={INK} strokeWidth="1.6" opacity="0.55" />;
      })}
      {/* The shadow, sweeping round as the sun moves. */}
      <path d="M100 170 L42 160 L46 172 Z" fill={INK} opacity="0.28" className="sc-shadow" style={{ transformOrigin: '100px 170px' }} />
      <path d="M100 170 L100 106 L140 170 Z" fill={CLAY} />
      <path d="M100 106 L100 170" stroke={INK} strokeWidth="2.5" />
    </g>
  );
}

/** The house owl, on a stack of books, awake. */
function OwlOnBooks() {
  return (
    <g className="animate-[rise_1.1s_cubic-bezier(0.22,1,0.36,1)_0.45s_backwards]">
      <rect x="56" y="176" width="88" height="14" rx="2" fill={INK} />
      <rect x="62" y="163" width="78" height="13" rx="2" fill={CLAY} />
      <rect x="66" y="152" width="70" height="11" rx="2" fill={SUN} />
      <path d="M70 158 H132" stroke={INK} strokeWidth="1" opacity="0.3" />
      <g className="animate-[float_5s_ease-in-out_infinite]">
        <path d="M72 82 L84 102 L66 100 Z M128 82 L116 102 L134 100 Z" fill="#862F1C" />
        <path d="M100 86 C 128 86, 136 112, 134 132 C 132 150, 118 154, 100 154 C 82 154, 68 150, 66 132 C 64 112, 72 86, 100 86 Z" fill="#862F1C" />
        <path d="M100 118 C 114 118, 122 130, 120 142 C 118 150, 108 152, 100 152 C 92 152, 82 150, 80 142 C 78 130, 86 118, 100 118 Z" fill="#A8492B" />
        <circle cx="86" cy="110" r="12" fill={SUN} />
        <circle cx="114" cy="110" r="12" fill={SUN} />
        <g className="sc-blink" style={{ transformOrigin: '100px 110px' }}>
          <circle cx="86" cy="110" r="5.5" fill="#2B211B" />
          <circle cx="114" cy="110" r="5.5" fill="#2B211B" />
        </g>
        <path d="M100 116 L94 124 L100 132 L106 124 Z" fill={SUN} />
      </g>
    </g>
  );
}

/** A row of doorways, one per tool, the middle one open and lit. */
function Doorways() {
  const door = (x: number, w: number, h: number, lit: boolean, delay: number) => {
    const r = w / 2;
    const top = 192 - h;
    return (
      <g className="animate-[rise_1.1s_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${delay}ms` }}>
        <path d={`M${x} 192 V${top + r} A${r} ${r} 0 0 1 ${x + w} ${top + r} V192 Z`} fill={INK} opacity={lit ? 0.92 : 0.6} />
        <path
          d={`M${x + 7} 192 V${top + r + 4} A${r - 7} ${r - 7} 0 0 1 ${x + w - 7} ${top + r + 4} V192 Z`}
          fill={lit ? SUN : CLAY}
          opacity={lit ? 0.95 : 0.55}
        />
      </g>
    );
  };
  return (
    <g>
      {door(22, 40, 74, false, 550)}
      {door(138, 40, 86, false, 650)}
      {door(70, 60, 122, true, 450)}
      <path d="M86 192 L100 178 L114 192" fill="none" stroke={INK} strokeWidth="1.5" opacity="0.45" />
    </g>
  );
}

/** An open ledger: two pages of entries and a pen across them. */
function Ledger() {
  return (
    <g className="animate-[rise_1.1s_cubic-bezier(0.22,1,0.36,1)_0.45s_backwards]">
      <path d="M100 106 C 80 96, 50 96, 30 102 V 182 C 50 176, 80 176, 100 186 Z" fill={PAPER} stroke={INK} strokeWidth="2" />
      <path d="M100 106 C 120 96, 150 96, 170 102 V 182 C 150 176, 120 176, 100 186 Z" fill={PAPER} stroke={INK} strokeWidth="2" />
      {[118, 130, 142, 154, 166].map((y, i) => (
        <g key={y} opacity="0.4">
          <path d={`M40 ${y - 2} C 60 ${y - 6}, 80 ${y - 6}, 92 ${y}`} stroke={INK} strokeWidth="2" fill="none" strokeDasharray={i === 2 ? '30 60' : undefined} />
          <path d={`M108 ${y} C 120 ${y - 6}, 140 ${y - 6}, 160 ${y - 2}`} stroke={INK} strokeWidth="2" fill="none" />
        </g>
      ))}
      <path d="M100 106 V186" stroke={INK} strokeWidth="2" />
      <g transform="rotate(-32 140 120)">
        <rect x="120" y="116" width="58" height="8" rx="4" fill={CLAY} />
        <path d="M120 116 L108 120 L120 124 Z" fill={INK} />
        <rect x="168" y="116" width="10" height="8" rx="2" fill={SUN} />
      </g>
    </g>
  );
}

/** A gate in a wall, standing open, with the path running through it. */
function Gate() {
  return (
    <g className="animate-[rise_1.1s_cubic-bezier(0.22,1,0.36,1)_0.45s_backwards]">
      <path d="M20 192 V120 H70 V192 Z M130 192 V120 H180 V192 Z" fill={INK} opacity="0.75" />
      <path d="M70 192 V110 A30 30 0 0 1 130 110 V192 Z" fill={INK} opacity="0.92" />
      <path d="M78 192 V112 A22 22 0 0 1 122 112 V192 Z" fill={SUN} opacity="0.9" />
      <path d="M78 192 L64 200 L64 124 L78 112 Z" fill={CLAY} />
      <path d="M92 192 L84 212 H116 L108 192 Z" fill={DUNE} opacity="0.6" />
    </g>
  );
}

const MOTIFS: Record<SceneMotif, () => ReactNode> = {
  tower: Tower,
  voucher: Voucher,
  scales: Scales,
  columns: Columns,
  seekers: Seekers,
  sundial: Sundial,
  owl: OwlOnBooks,
  doorways: Doorways,
  ledger: Ledger,
  gate: Gate,
};

export function ArchScene({
  motif,
  seal,
  sun = true,
  className,
}: {
  motif: SceneMotif;
  /** One figure, set on a card at the foot of the arch. Also say it in text. */
  seal?: ReactNode;
  sun?: boolean;
  className?: string;
}) {
  const Motif = MOTIFS[motif];
  return (
    <div aria-hidden className={cn('relative min-h-[17rem]', className)}>
      {/* With a seal the arch stops short, and the seal hangs half across its
          threshold: below the scene rather than over it, the way a seal hangs
          from the foot of a deed. */}
      <div
        className={cn(
          'm-arch m-arch-open absolute inset-x-0 top-0 overflow-hidden bg-[var(--surface-sunken)]',
          seal ? 'bottom-8' : 'bottom-0',
        )}
      >
        {/* The arch's own inner light, so it reads as a window and not a cut-out. */}
        <span className="absolute inset-0 bg-[radial-gradient(80%_55%_at_50%_30%,color-mix(in_oklab,var(--color-gold-400)_22%,transparent),transparent_70%)]" />
        {sun && (
          <span
            className="m-sun absolute top-[17%] left-1/2 size-32 -translate-x-1/2 xl:size-40"
            style={{ background: SUN, ['--sun-from' as string]: '90px' }}
          />
        )}
        <svg viewBox="0 0 200 220" className="absolute inset-x-0 bottom-0 w-full" preserveAspectRatio="xMidYMax meet">
          <Dune />
          <Motif />
        </svg>
      </div>
      {seal && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          <div className="surface-lit elev-3 animate-[pop_0.5s_cubic-bezier(0.22,1,0.36,1)_1s_backwards] rounded-2xl border px-4 py-2.5 text-center whitespace-nowrap">
            {seal}
          </div>
        </div>
      )}
    </div>
  );
}

/** The two lines a seal carries: a figure in the accent, and what it is. */
export function SealFigure({ value, note }: { value: ReactNode; note: ReactNode }) {
  return (
    <>
      <p className="text-[1.35rem] leading-none font-semibold tracking-tight tabular-nums" style={{ color: 'var(--accent)' }}>
        {value}
      </p>
      <p className="text-subtle mt-1 text-[11px]">{note}</p>
    </>
  );
}
