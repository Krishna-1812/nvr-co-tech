import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { Figure } from '@/components/app/Figure';
import { buttonClass } from '@/components/ui/primitives';
import { ToolHero } from '@/components/ui/ToolHero';
import { ArchScene, SealFigure } from '@/components/ui/Scene';
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
  registerValue,
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
  /** Value of everything this person has raised. Nothing to split when it is 0. */
  registerValue: number;
}) {
  const hasRegister = registerValue > 0;
  const settledShare = Math.round((1 - inFlight.share) * 100);

  return (
    <ToolHero
      label={`${when} · FY ${fiscal.label}`}
      pill={{
        text: 'Voucher Desk',
        tone: 'var(--status-approved)',
        live: true,
      }}
      title={title}
      sub={lead}
      scene={
        <ArchScene
          motif="voucher"
          className="h-full min-h-[18rem]"
          seal={
            hasRegister ? (
              <SealFigure value={`${settledShare}%`} note="of your register settled" />
            ) : undefined
          }
        />
      }
    >
      <div className="mt-7 flex flex-wrap items-center gap-2.5">
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
            <Plus className="size-4 transition-transform group-hover:rotate-90" aria-hidden />
            New voucher
          </Link>
        )}
      </div>

      {/*
        Money that has left somebody's desk and not yet arrived anywhere. Not one
        of the four cards below, which are all about counts of work; this is the
        exposure, which is the number a partner asks for.
      */}
      <div className="surface-sunken a-inner mt-8 max-w-xl rounded-2xl border p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <p className="a-label">In flight</p>
            <Figure
              value={inFlight.value}
              kind="rupees"
              delay={180}
              className="mt-2 block text-[1.6rem] font-semibold tracking-tight sm:text-[1.85rem]"
            />
          </div>
          <p className="text-subtle pb-1 text-xs">
            <span className="numeric font-medium">{inFlight.count}</span>{' '}
            {inFlight.count === 1 ? 'voucher' : 'vouchers'} not yet settled
            {hasRegister && <> · {settledShare}% of your register settled</>}
          </p>
        </div>
        {hasRegister && (
          <>
            <div className="mt-3.5 flex h-2.5 gap-[2px] overflow-hidden rounded-full">
              <span
                className="a-fill h-full rounded-l-full bg-[var(--status-approved)]"
                style={{
                  flexGrow: Math.max(0, 1 - inFlight.share),
                  flexBasis: 0,
                }}
              />
              <span
                className="a-fill h-full rounded-r-full bg-[var(--status-pending)]"
                style={{
                  flexGrow: Math.max(0.03, inFlight.share),
                  flexBasis: 0,
                  animationDelay: '150ms',
                }}
              />
            </div>
            <div className="text-muted mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-[3px] bg-[var(--status-approved)]" />{' '}
                Settled
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-[3px] bg-[var(--status-pending)]" />{' '}
                Still moving
              </span>
            </div>
          </>
        )}
      </div>
    </ToolHero>
  );
}
