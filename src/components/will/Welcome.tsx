'use client';

import { ArrowRight, Clock, HardDrive, Printer } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { LAW } from '@/lib/will/law';
import { SampleLink } from './ExportBar';

/**
 * The first thing somebody sees: what they are about to do, in four lines, and one
 * button. Until they press it, no form is on the screen and nothing is flagged as
 * missing, because a blank draft has nothing wrong with it yet.
 *
 * If they keep a Wealth Tracker record, the faster way in is offered beside it: their
 * family and what they own come across, and the questions that follow only have to
 * be checked.
 */
export function Welcome({
  onStart,
  onStartFromWealth,
  onDetailed,
  wealthCount,
}: {
  onStart: () => void;
  onStartFromWealth: (() => void) | null;
  /** Start in the detailed form instead of the guided questions. */
  onDetailed: () => void;
  wealthCount: number;
}) {
  return (
    <section aria-labelledby="wm-welcome" className="surface-lit a-ring rounded-[1.75rem] p-6 sm:p-9">
      <h2 id="wm-welcome" className="text-xl font-semibold tracking-tight sm:text-2xl">
        Let’s write your will.
      </h2>
      <p className="text-muted mt-1.5 max-w-xl text-[15px] leading-relaxed text-pretty">Plain questions, one step at a time, then a will you can print and sign.</p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" onClick={onStart}>
          Start my will
          <ArrowRight className="size-4" aria-hidden />
        </Button>
        {onStartFromWealth && (
          <Button onClick={onStartFromWealth}>Start from my Wealth Tracker ({wealthCount} {wealthCount === 1 ? 'entry' : 'entries'})</Button>
        )}
        <SampleLink />
      </div>
      <p className="text-subtle mt-3 text-[13px]">
        Rather see every question at once?{' '}
        <button type="button" className="font-medium underline underline-offset-2 hover:text-[var(--text-c)]" onClick={onDetailed}>
          Use the detailed form
        </button>
        .
      </p>

      <ul className="mt-7 grid gap-4 sm:grid-cols-3">
        <Point icon={Clock} title="About ten minutes">
          It saves as you go, so you can stop and come back.
        </Point>
        <Point icon={HardDrive} title="Stays on your device">
          What you write is kept in this browser. We never see it.
        </Point>
        <Point icon={Printer} title="A will you can sign">
          A PDF to print, a Word copy to edit, and a short guide to signing it with two witnesses.
        </Point>
      </ul>
      <p className="text-subtle mt-5 text-xs">
        A drafting aid, not legal advice. If your situation is out of the ordinary, ask an advocate to read it before you sign.
        {!LAW.advocateSignOff && ' In testing: not yet reviewed by an advocate.'}
      </p>
    </section>
  );
}

function Point({ icon: Icon, title, children }: { icon: typeof Clock; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="surface-sunken grid size-9 shrink-0 place-items-center rounded-xl border">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-muted mt-0.5 text-[13px] leading-relaxed text-pretty">{children}</p>
      </div>
    </li>
  );
}
