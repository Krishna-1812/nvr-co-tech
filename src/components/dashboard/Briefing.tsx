import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { Figure } from '@/components/app/Figure';
import { buttonClass } from '@/components/ui/primitives';
import type { Fiscal } from '@/lib/fiscal';

/**
 * The top of the dashboard: what the day is, where you stand, and the one thing
 * to do about it.
 *
 * This replaced a plain title and a sentence. The case for giving it a whole
 * panel is that the sentence underneath is the most useful thing on the screen.
 * It is the difference between a dashboard you read and a dashboard you act on,
 * and a 14px line of grey text above four cards was not being read.
 *
 * `title` was `greeting` and held "Good morning, Vivek". The workspace one click
 * earlier says exactly that, so this said it twice; the headline is now the state
 * of the desk, which is the thing somebody opened this screen to learn. Both it
 * and `lead` are decided by lib/domain/desk rather than here, because which of
 * six facts matters most is a business judgement and not a layout one.
 */
export function Briefing({
  title,
  when,
  lead,
  cta,
  fiscal,
  inFlight,
}: {
  /** The state of the desk in one sentence: "3 vouchers need your approval." */
  title: string;
  /** "Tuesday morning" */
  when: string;
  lead: string;
  cta: { href: string; label: string; primary: boolean };
  fiscal: Fiscal;
  /** Value and count of this person's vouchers that have not settled yet. */
  inFlight: { value: number; count: number; share: number };
}) {
  return (
    <section className="surface-lit a-ring animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_backwards] relative overflow-hidden rounded-3xl">
      {/* Two lights and a grid inside the panel, brighter than the page backdrop.
          This is the one surface on the screen allowed to look like weather. */}
      <span
        aria-hidden
        className="a-orb -top-32 -left-16 size-96"
        style={{
          background: 'radial-gradient(circle, color-mix(in oklab, var(--color-brand-500) 34%, transparent), transparent 70%)',
          animation: 'aurora 30s ease-in-out infinite',
        }}
      />
      <span
        aria-hidden
        className="a-orb -top-24 right-1/4 size-80"
        style={{
          background: 'radial-gradient(circle, color-mix(in oklab, var(--color-accent-500) 26%, transparent), transparent 70%)',
          animation: 'aurora 42s ease-in-out -9s infinite reverse',
        }}
      />
      <span
        aria-hidden
        className="a-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(70%_80%_at_20%_0%,#000,transparent)]"
      />

      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-12">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2.5">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="a-blip size-1.5 rounded-full bg-[var(--status-approved)]"
              />
              <span className="a-label">{when}</span>
            </span>
            <span aria-hidden className="text-subtle text-[10px]">
              ·
            </span>
            <span className="a-label">FY {fiscal.label}</span>
          </p>

          <h1 className="m-display mt-4 text-[clamp(1.75rem,4.4vw,2.75rem)] text-balance">
            {title}
          </h1>

          <p className="text-muted mt-3 max-w-xl text-[15px] leading-relaxed text-pretty sm:text-base">
            {lead}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <Link
              href={cta.href}
              className={buttonClass({
                variant: cta.primary ? 'primary' : 'secondary',
                className: 'group',
              })}
            >
              {cta.label}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            {/* The default action is always reachable, even when it is not the
                thing being recommended. */}
            {cta.href !== '/vouchers/new' && (
              <Link href="/vouchers/new" className={buttonClass({ className: 'group' })}>
                <Plus
                  className="size-4 transition-transform group-hover:rotate-90"
                  aria-hidden
                />
                New voucher
              </Link>
            )}
          </div>
        </div>

        {/*
          Money that has left somebody's desk and not yet arrived anywhere. Not one
          of the four cards below, which are all about counts of work; this is the
          exposure, which is the number a partner asks for.
        */}
        <div className="shrink-0 lg:w-64">
          <div className="surface-sunken rounded-2xl border p-4">
            <p className="a-label">In flight</p>
            <Figure
              value={inFlight.value}
              kind="rupees"
              delay={180}
              className="mt-2.5 block text-2xl sm:text-[1.75rem]"
            />
            <div className="a-track relative mt-3.5 h-1 overflow-hidden rounded-full">
              <span
                className="a-fill gradient-brand absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(3, inFlight.share * 100))}%`,
                  animationDelay: '300ms',
                }}
              />
            </div>
            <p className="text-subtle mt-2.5 text-xs">
              <span className="numeric font-medium">{inFlight.count}</span>{' '}
              {inFlight.count === 1 ? 'voucher' : 'vouchers'} not yet settled
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
