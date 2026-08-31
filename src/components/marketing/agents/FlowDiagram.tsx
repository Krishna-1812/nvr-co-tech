import { Bot, FileCheck2, Inbox, ScrollText } from 'lucide-react';
import type { Agent } from '@/lib/marketing/content';
import { ACCENT } from '../bits';

/**
 * What goes in, what the agent does with it, what comes out, and where it lands.
 *
 * Four stages rather than the two the copy used to show, because "inputs to
 * outputs" leaves out the part that matters to a finance reader: the output is
 * not a message, it is a record with its history attached. The fourth node is the
 * whole argument of the site, drawn.
 *
 * No JavaScript. The travelling dashes are a CSS animation on an SVG line, and
 * the layout turns from a row into a column with flex-direction — a diagram this
 * simple should not need a client bundle to appear.
 */
export function FlowDiagram({ agent }: { agent: Agent }) {
  const accent = ACCENT[agent.accent];

  const stages = [
    { icon: Inbox, label: 'Takes in', body: agent.inputs, tone: undefined },
    { icon: Bot, label: 'The agent', body: agent.name, tone: accent },
    { icon: FileCheck2, label: 'Gives back', body: agent.outputs, tone: undefined },
    {
      icon: ScrollText,
      label: 'Ends up as',
      body: 'A record with its full history',
      tone: 'var(--m-emerald)',
    },
  ];

  return (
    <div className="flex flex-col items-stretch gap-0 lg:flex-row lg:items-stretch">
      {stages.map((s, i) => (
        <div key={s.label} className="flex flex-col items-stretch lg:flex-1 lg:flex-row">
          <div
            className="m-card m-ring flex flex-1 flex-col rounded-2xl p-5"
            style={
              s.tone
                ? {
                    borderColor: `color-mix(in oklab, ${s.tone} 30%, transparent)`,
                    background: `color-mix(in oklab, ${s.tone} 7%, transparent)`,
                  }
                : undefined
            }
          >
            <span
              className="grid size-8 place-items-center rounded-lg border border-[var(--m-line)]"
              style={s.tone ? { background: `color-mix(in oklab, ${s.tone} 16%, transparent)` } : undefined}
            >
              <s.icon className="size-4" style={{ color: s.tone ?? 'var(--m-dim-2)' }} aria-hidden />
            </span>
            <p className="m-eyebrow mt-4">{s.label}</p>
            <p
              className="mt-1.5 t-3"
              style={{ color: s.tone ?? 'var(--m-ink)' }}
            >
              {s.body}
            </p>
          </div>

          {i < stages.length - 1 && <Connector accent={accent} delay={i * 0.4} />}
        </div>
      ))}
    </div>
  );
}

/**
 * The segment between two stages: a static rail with a travelling dash over it.
 *
 * Rotated a quarter turn below `lg`, where the diagram stacks. The SVG is drawn
 * horizontally once and turned with a transform rather than being authored twice.
 */
function Connector({ accent, delay }: { accent: string; delay: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center py-2.5 lg:px-2.5 lg:py-0"
      style={{ ['--flow-accent' as string]: accent }}
    >
      {/* 100 units long with a dasharray summing to 100 — see the note on the
          `flow` keyframe for why the period has to match exactly. */}
      <svg
        viewBox="0 0 100 8"
        className="h-2 w-11 rotate-90 lg:rotate-0"
        preserveAspectRatio="none"
        focusable="false"
      >
        <line x1="0" y1="4" x2="100" y2="4" stroke="var(--m-line-2)" strokeWidth="1.5" />
        <line
          x1="0"
          y1="4"
          x2="100"
          y2="4"
          stroke={accent}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="16 84"
          className="animate-[flow_2.6s_linear_infinite] motion-reduce:hidden"
          style={{ animationDelay: `${delay}s` }}
        />
      </svg>
    </span>
  );
}
