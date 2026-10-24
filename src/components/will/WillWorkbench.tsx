'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, HardDrive, Scale, ShieldAlert } from 'lucide-react';
import { ArchScene } from '@/components/ui/Scene';
import { Button, Skeleton } from '@/components/ui/primitives';
import { LockScreen } from '@/components/wealth/LockScreen';
import { SEVERITY_TONE } from '@/components/wealth/shared';
import { checkWill, readiness, STEPS, type Finding, type Step } from '@/lib/will/checks';
import { LAW, scopeOf } from '@/lib/will/law';
import { todayIso } from '@/lib/wealth/model';
import { useWill, willActions } from '@/lib/will/store';
import { cn } from '@/lib/utils';
import { AssetsStep } from './AssetsStep';
import { ChecksPanel } from './ChecksPanel';
import { DataPanel } from './DataPanel';
import { ExtrasStep } from './ExtrasStep';
import { FamilyStep } from './FamilyStep';
import { GiftsStep, ResidueStep } from './GiftsStep';
import { PeopleStep } from './PeopleStep';
import { Preview } from './Preview';
import { SignStep } from './SignStep';
import { Notice, type StepProps } from './shared';
import { YouStep } from './YouStep';

/**
 * Will Maker: the whole tool, on one screen.
 *
 * Reads the person's draft from this browser (lib/will/store) and shows one of
 * four things: a moment of loading, the lock screen, a message that the browser
 * will not store anything, or the draft itself. The draft has four tabs:
 * the interview (eight short steps), a live preview of the will, the checks,
 * and the controls over where it is kept.
 *
 * Whether this tool can safely make this person's will at all is decided by the
 * answers on the first step (lib/will/law). When it cannot, the rest of the
 * interview and the preview are closed and the reason is shown instead of a
 * will that would mislead.
 */

type Tab = 'interview' | 'preview' | 'checks' | 'data';

const STEP_LABEL: Record<Step, string> = {
  you: 'About you',
  family: 'People',
  assets: 'What you own',
  gifts: 'Who gets what',
  residue: 'Everything else',
  people: 'Executor & witnesses',
  extras: 'Your wishes',
  sign: 'Signing',
};

export function WillWorkbench({ userId, selfName }: { userId: string; selfName: string }) {
  const state = useWill(userId, selfName);
  const actions = useMemo(() => willActions(userId), [userId]);
  const today = useMemo(() => todayIso(), []);
  const [tab, setTab] = useState<Tab>('interview');
  const [step, setStep] = useState<Step>('you');
  const [focus, setFocus] = useState<StepProps['focus']>(null);

  const record = state.record;
  const findings = useMemo(() => checkWill(record, today), [record, today]);
  const ready = useMemo(() => readiness(findings), [findings]);
  const scope = useMemo(() => scopeOf(record.testator, today), [record.testator, today]);
  const blocked = scope.level === 'out';

  // A check's "Fix" sends us to a step and a card; scroll to the card once it is on screen.
  const focusId = focus?.personId ?? focus?.assetId;
  useEffect(() => {
    if (!focusId || tab !== 'interview') return;
    const t = window.setTimeout(() => document.getElementById(`f-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
    return () => window.clearTimeout(t);
  }, [focusId, step, tab]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'unavailable') {
    return (
      <Notice>
        This browser is not letting the page store anything, so there is nowhere to keep your draft. Private or incognito
        windows often do this; open Will Maker in an ordinary window.
      </Notice>
    );
  }
  if (state.status === 'locked') {
    return <LockScreen subject="draft will" onUnlock={(code) => actions.unlock(code)} onStartOver={() => actions.startOver(selfName)} />;
  }

  const stepProps: StepProps = {
    record,
    update: actions.update,
    findings,
    today,
    go: (s) => {
      setFocus(null);
      setStep(s);
      setTab('interview');
    },
    focus,
  };

  const fix = (f: Finding) => {
    setFocus(f.personId || f.assetId ? { personId: f.personId, assetId: f.assetId } : null);
    setStep(f.step);
    setTab('interview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const at = STEPS.indexOf(step);
  const perStep = (s: Step) => findings.filter((f) => f.step === s && f.severity !== 'note').length;

  return (
    <div className="space-y-5">
      <Hero ready={ready} blocked={blocked} />

      {state.saveError && <Notice tone="var(--status-rejected)">{state.saveError}</Notice>}

      <Tabs
        tab={tab}
        onTab={setTab}
        disabled={blocked ? ['preview'] : []}
        counts={{ checks: ready.act + ready.review }}
        alert={{ checks: ready.act > 0 }}
      />

      <div key={tab} className="animate-[rise_0.35s_cubic-bezier(0.22,1,0.36,1)_backwards]">
        {tab === 'interview' && (
          <div className="grid gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-8">
            <StepNav step={step} blocked={blocked} perStep={perStep} onStep={(s) => (setFocus(null), setStep(s))} />
            <div className="min-w-0">
              <section className="surface-lit a-ring rounded-[1.75rem] p-5 sm:p-8" aria-live="polite">
                {blocked && step !== 'you' ? <Blocked reasons={scope.reasons} onBack={() => setStep('you')} /> : <CurrentStep step={step} props={stepProps} userId={userId} selfName={selfName} />}
              </section>

              {!(blocked && step !== 'you') && (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <Button variant="ghost" onClick={() => (setFocus(null), setStep(STEPS[at - 1]))} disabled={at === 0}>
                    <ChevronLeft className="size-4" aria-hidden />
                    Back
                  </Button>
                  {at < STEPS.length - 1 ? (
                    <Button variant="primary" disabled={blocked} onClick={() => (setFocus(null), setStep(STEPS[at + 1]))}>
                      Next: {STEP_LABEL[STEPS[at + 1]]}
                      <ChevronRight className="size-4" aria-hidden />
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={() => setTab('checks')}>
                      Review the checks
                      <ChevronRight className="size-4" aria-hidden />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {tab === 'preview' && !blocked && <Preview record={record} findings={findings} today={today} />}
        {tab === 'checks' && <ChecksPanel findings={findings} onFix={fix} />}
        {tab === 'data' && <DataPanel record={record} actions={actions} hasLock={state.hasLock} selfName={selfName} />}
      </div>
    </div>
  );
}

function CurrentStep({ step, props, userId, selfName }: { step: Step; props: StepProps; userId: string; selfName: string }) {
  switch (step) {
    case 'you':
      return <YouStep {...props} />;
    case 'family':
      return <FamilyStep {...props} />;
    case 'assets':
      return <AssetsStep {...props} userId={userId} selfName={selfName} />;
    case 'gifts':
      return <GiftsStep {...props} />;
    case 'residue':
      return <ResidueStep {...props} />;
    case 'people':
      return <PeopleStep {...props} />;
    case 'extras':
      return <ExtrasStep {...props} />;
    case 'sign':
      return <SignStep {...props} />;
  }
}

function Hero({ ready, blocked }: { ready: ReturnType<typeof readiness>; blocked: boolean }) {
  return (
    <section aria-labelledby="wm-title" className="surface-lit a-ring relative isolate overflow-hidden rounded-[2rem]">
      <span
        aria-hidden
        className="a-orb -top-40 -left-24 size-[34rem] opacity-[0.16]"
        style={{ background: 'radial-gradient(circle, var(--h-amber), transparent 66%)' }}
      />
      <div className="relative grid gap-6 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12">
        <div className="min-w-0">
          <p className="a-label">Will Maker</p>
          <h1 id="wm-title" className="m-display mt-3 text-[clamp(1.8rem,4.2vw,2.9rem)] leading-[1.04] text-balance">
            Put in writing who gets what.
          </h1>
          <p className="text-muted mt-3 max-w-2xl text-[15px] leading-relaxed text-pretty">
            Answer a few short questions, and see your will take shape as you go. Checks tell you what could make it fail,
            with the section of the law behind each one.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            <Chip icon={HardDrive}>Kept only in this browser</Chip>
            <Chip icon={Scale}>A drafting aid, not legal advice</Chip>
            <Chip icon={ShieldAlert} warn={!LAW.advocateSignOff}>
              {LAW.advocateSignOff ? `Rules reviewed: ${LAW.advocateSignOff}` : 'In testing: not yet reviewed by an advocate'}
            </Chip>
          </ul>
          <p
            style={{ '--tone': blocked || ready.act > 0 ? SEVERITY_TONE.act : ready.review > 0 ? SEVERITY_TONE.review : 'var(--status-approved)' } as CSSProperties}
            className="tinted mt-5 inline-flex rounded-full border px-3.5 py-1.5 text-[13px] font-medium"
            role="status"
          >
            {blocked
              ? 'This tool cannot make your will. See the reason on the first step.'
              : ready.act > 0
                ? `${ready.act} to fix${ready.review > 0 ? `, ${ready.review} to review` : ''}`
                : ready.review > 0
                  ? `Nothing to fix. ${ready.review} to review.`
                  : 'Nothing to fix or review.'}
          </p>
        </div>
        <div className="hidden lg:flex lg:flex-col lg:justify-center [&>*]:max-h-[22rem]">
          <ArchScene motif="scales" className="h-full min-h-[17rem]" />
        </div>
      </div>
    </section>
  );
}

function Chip({ icon: Icon, children, warn = false }: { icon: typeof Scale; children: React.ReactNode; warn?: boolean }) {
  return (
    <li
      style={warn ? ({ '--tone': 'var(--status-warn)' } as CSSProperties) : undefined}
      className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px]', warn ? 'tinted' : 'surface-sunken text-muted')}
    >
      <Icon className="size-3.5" aria-hidden />
      {children}
    </li>
  );
}

function Tabs({
  tab,
  onTab,
  counts,
  alert,
  disabled,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  counts: Partial<Record<Tab, number>>;
  alert: Partial<Record<Tab, boolean>>;
  disabled: Tab[];
}) {
  const TABS: { id: Tab; label: string }[] = [
    { id: 'interview', label: 'Interview' },
    { id: 'preview', label: 'Preview' },
    { id: 'checks', label: 'Checks' },
    { id: 'data', label: 'Where it is kept' },
  ];
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div role="tablist" aria-label="Your will" className="surface-sunken inline-flex min-w-max gap-1 rounded-2xl border p-1">
        {TABS.map((t) => {
          const on = tab === t.id;
          const n = counts[t.id];
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              disabled={disabled.includes(t.id)}
              onClick={() => onTab(t.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-40',
                on ? 'bg-[var(--surface-raised)] text-[var(--text-c)] shadow-[var(--elev-1)]' : 'text-muted hover:text-[var(--text-c)]',
              )}
            >
              {t.label}
              {n !== undefined && n > 0 && (
                <span
                  style={alert[t.id] ? ({ '--tone': 'var(--status-warn)' } as CSSProperties) : undefined}
                  className={cn('min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums', alert[t.id] ? 'tinted border' : 'bg-[var(--surface-sunken)]')}
                >
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepNav({ step, blocked, perStep, onStep }: { step: Step; blocked: boolean; perStep: (s: Step) => number; onStep: (s: Step) => void }) {
  return (
    <nav aria-label="Steps" className="-mx-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0">
      <ol className="flex gap-1.5 lg:sticky lg:top-24 lg:flex-col">
        {STEPS.map((s, i) => {
          const on = s === step;
          const n = perStep(s);
          const locked = blocked && s !== 'you';
          return (
            <li key={s} className="shrink-0">
              <button
                type="button"
                disabled={locked}
                aria-current={on ? 'step' : undefined}
                onClick={() => onStep(s)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[13.5px] font-medium whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-40',
                  on ? 'surface-lit border-[var(--border-strong)] text-[var(--text-c)]' : 'text-muted border-transparent hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]',
                )}
              >
                <span
                  aria-hidden
                  className={cn('grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold tabular-nums', on ? 'bg-[var(--accent)] text-[var(--on-action)] border-transparent' : 'surface-sunken')}
                >
                  {i + 1}
                </span>
                <span className="flex-1">{STEP_LABEL[s]}</span>
                {n > 0 && !locked && (
                  <span
                    style={{ '--tone': 'var(--status-warn)' } as CSSProperties}
                    className="tinted min-w-5 rounded-full border px-1.5 text-center text-[11px] font-semibold tabular-nums"
                    aria-label={`${n} to look at`}
                  >
                    {n}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Blocked({ reasons, onBack }: { reasons: ReturnType<typeof scopeOf>['reasons']; onBack: () => void }) {
  const out = reasons.filter((r) => r.level === 'out');
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight">This tool cannot make your will</h2>
      <ul className="mt-4 space-y-2">
        {out.map((r) => (
          <li key={r.id} style={{ '--tone': SEVERITY_TONE.act } as CSSProperties} className="tinted rounded-2xl border px-4 py-3">
            <p className="text-sm font-semibold">{r.title}</p>
            <p className="text-muted mt-1 text-[13px] leading-relaxed text-pretty">{r.detail}</p>
            {r.cite && <p className="text-subtle mt-1 text-[11.5px]">{r.cite}</p>}
          </li>
        ))}
      </ul>
      <Button className="mt-5" onClick={onBack}>
        Change my answers
      </Button>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-6" aria-busy>
      <Skeleton className="h-64 rounded-[2rem]" />
      <Skeleton className="h-10 w-80 rounded-2xl" />
      <Skeleton className="h-96 rounded-3xl" />
    </div>
  );
}
