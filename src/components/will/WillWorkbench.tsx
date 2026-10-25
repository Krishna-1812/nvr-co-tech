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
import { useWill, useWillView, willActions, type WillActions, type WillState, type WillView } from '@/lib/will/store';
import { importFromWealth } from '@/lib/will/fromWealth';
import { isBlank } from '@/lib/will/progress';
import { forgetAccountCopy } from '@/lib/will/account';
import { afterPrompts } from '@/lib/will/register';
import { useWealth, wealthActions } from '@/lib/wealth/store';
import { cn } from '@/lib/utils';
import { AfterPanel } from './AfterPanel';
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
import { WillSave } from './WillSave';
import { GuidedWill } from './GuidedWill';
import { Welcome } from './Welcome';
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

type Tab = 'interview' | 'preview' | 'checks' | 'after' | 'data';

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

export function WillWorkbench({
  userId,
  selfName,
  signedIn = false,
  email = '',
}: {
  userId: string;
  selfName: string;
  /** Signed in, so an encrypted copy may also be kept in the account (once the draft is locked). */
  signedIn?: boolean;
  email?: string;
}) {
  const state = useWill(userId, selfName);
  const actions = useMemo(() => willActions(userId), [userId]);

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
    return <LockScreen
        subject="draft will"
        onUnlock={(code) => actions.unlock(code)}
        onStartOver={() => {
          // The encrypted copy in the account is locked with the same lost passcode: it goes too, or it would come back.
          void forgetAccountCopy();
          actions.startOver(selfName);
        }}
      />;
  }

  // The draft proper mounts only once it is loaded, so what it starts from (a blank draft, or one
  // somebody has already been working on) is known on its first render.
  return <Draft userId={userId} selfName={selfName} signedIn={signedIn} email={email} state={state} actions={actions} />;
}

function Draft({
  userId,
  selfName,
  signedIn,
  email,
  state,
  actions,
}: {
  userId: string;
  selfName: string;
  signedIn: boolean;
  email: string;
  state: WillState;
  actions: WillActions;
}) {
  // The person's Wealth Tracker record, to check the will against. Read-only here
  // apart from the household profile the "After signing" tab may update.
  const wealthState = useWealth(userId, selfName).state;
  const wealth = wealthState.status === 'ready' && (wealthState.record.items.length > 0 || wealthState.record.profile.members.length > 1) ? wealthState.record : null;
  const today = useMemo(() => todayIso(), []);
  const [tab, setTab] = useState<Tab>('interview');
  // Guided questions or the detailed form. What they chose last wins; otherwise a blank draft is guided
  // and one with work in it is detailed. Fixed when the draft opens, so typing the first answer does not
  // swap the screen out from under somebody.
  // Set when they press a start button on the welcome, so the guided questions begin at the first one.
  const [fresh, setFresh] = useState(false);
  const [saved, setSaved] = useWillView(userId);
  const [firstView] = useState<WillView>(() => (isBlank(state.record) ? 'guided' : 'full'));
  const view: WillView = saved ?? firstView;
  const toDetailed = (t?: Tab) => {
    setFresh(false);
    setSaved('full');
    setTab(t ?? 'interview');
  };
  const [step, setStep] = useState<Step>('you');
  const [focus, setFocus] = useState<StepProps['focus']>(null);
  // A blank draft opens on a welcome, not a form; one with work in it opens on the work.
  const [began, setBegan] = useState(() => !isBlank(state.record));
  // The steps the person has been through. A step stays quiet about what is missing until then, so
  // nothing red greets somebody who has not had the chance to answer; a draft with work in it
  // starts with every step counted, because its gaps are real.
  const [visited, setVisited] = useState<ReadonlySet<Step>>(() => (isBlank(state.record) ? new Set<Step>() : new Set<Step>(STEPS)));
  const seen = (s: Step) => setVisited((v) => (v.has(s) ? v : new Set(v).add(s)));

  const record = state.record;
  const findings = useMemo(() => checkWill(record, today), [record, today]);
  const ready = useMemo(() => readiness(findings), [findings]);
  const scope = useMemo(() => scopeOf(record.testator, today), [record.testator, today]);
  const blocked = scope.level === 'out';
  const prompts = useMemo(() => afterPrompts(record, wealth, today), [record, wealth, today]);
  const afterCount = prompts.filter((p) => p.severity !== 'note').length;

  // A check's "Fix" sends us to a step and a card; scroll to the card once it is on screen.
  const focusId = focus?.personId ?? focus?.assetId;
  useEffect(() => {
    if (!focusId || tab !== 'interview') return;
    const t = window.setTimeout(() => document.getElementById(`f-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
    return () => window.clearTimeout(t);
  }, [focusId, step, tab]);

  const quiet = !visited.has(step) && !focus;
  const goStep = (s: Step) => {
    seen(step);
    setFocus(null);
    setStep(s);
  };
  const onTab = (t: Tab) => {
    if (tab === 'interview' && t !== 'interview') seen(step);
    setTab(t);
  };

  const stepProps: StepProps = {
    record,
    update: actions.update,
    findings: quiet ? [] : findings,
    today,
    go: (s) => {
      goStep(s);
      setTab('interview');
    },
    focus,
    quiet,
  };

  const fix = (f: Finding) => {
    seen(step);
    seen(f.step);
    setFocus(f.personId || f.assetId ? { personId: f.personId, assetId: f.assetId } : null);
    setStep(f.step);
    setTab('interview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const at = STEPS.indexOf(step);
  const perStep = (s: Step) => (visited.has(s) ? findings.filter((f) => f.step === s && f.severity !== 'note').length : 0);
  // The tally of what is wrong waits until there is a draft to be wrong about: the final step, the other tabs, or a refusal.
  const showStatus = blocked || tab !== 'interview' || step === 'sign';

  if (!began) {
    return (
      <div className="space-y-5" data-private>
        <WillSave userId={userId} signedIn={signedIn} />
        <Hero ready={ready} blocked={blocked} signedIn={signedIn} showStatus={false} compact />
        <Welcome
          onStart={() => (setSaved('guided'), setFresh(true), setBegan(true))}
          onDetailed={() => (setSaved('full'), setBegan(true))}
          wealthCount={wealth ? wealth.items.length : 0}
          onStartFromWealth={
            wealth && wealth.items.length > 0
              ? () => {
                  actions.update((r) => importFromWealth(r, wealth).record);
                  setSaved('guided');
                  setFresh(true);
                  setBegan(true);
                }
              : null
          }
        />
      </div>
    );
  }

  if (view === 'guided') {
    return (
      <div className="space-y-5" data-private>
        <WillSave userId={userId} signedIn={signedIn} />
        <Hero ready={ready} blocked={blocked} signedIn={signedIn} showStatus={false} compact />
        {state.saveError && <Notice tone="var(--status-rejected)">{state.saveError}</Notice>}
        <GuidedWill record={record} update={actions.update} findings={findings} today={today} wealth={wealth} name={selfName} email={email} onDetailed={toDetailed} fresh={fresh} actions={actions} hasLock={state.hasLock} signedIn={signedIn} wealthLocked={wealthState.status === 'locked'} onWriteBack={(profile) => wealthActions(userId).setProfile(profile)} />
        <p className="text-subtle px-1 text-xs">
          {signedIn ? 'Kept in this browser, and encrypted in your account once you lock it.' : 'Kept only in this browser.'} A drafting aid, not legal advice.
          {!LAW.advocateSignOff && ' In testing: not yet reviewed by an advocate.'}
        </p>
      </div>
    );
  }

  return (
    // data-private: the site's field capture skips everything inside (and lib/analytics/private-paths
    // skips the whole path, which also covers the dialogs drawn outside this element).
    <div className="space-y-5" data-private>
      <WillSave userId={userId} signedIn={signedIn} />
      <Hero ready={ready} blocked={blocked} signedIn={signedIn} showStatus={showStatus} />
      <div className="-mb-2 flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setSaved('guided')}>
          Switch to the guided questions
        </Button>
      </div>

      {state.saveError && <Notice tone="var(--status-rejected)">{state.saveError}</Notice>}

      <Tabs
        tab={tab}
        onTab={onTab}
        disabled={blocked ? ['preview'] : []}
        counts={{ checks: visited.size > 0 ? ready.act + ready.review : 0, after: afterCount }}
        alert={{ checks: ready.act > 0 && visited.size > 0 }}
      />

      <div key={tab} id="wm-panel" role="tabpanel" aria-labelledby={`wm-tab-${tab}`} className="animate-[rise_0.35s_cubic-bezier(0.22,1,0.36,1)_backwards]">
        {tab === 'interview' && (
          <div className="grid gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-8">
            <StepNav step={step} blocked={blocked} perStep={perStep} onStep={goStep} />
            <div className="min-w-0">
              <Progress at={at} />
              <section className="surface-lit a-ring rounded-[1.75rem] p-5 sm:p-8" aria-live="polite">
                {blocked && step !== 'you' ? <Blocked reasons={scope.reasons} onBack={() => goStep('you')} /> : <CurrentStep step={step} props={stepProps} userId={userId} selfName={selfName} />}
              </section>

              {!(blocked && step !== 'you') && (
                // Sticky on a phone, above the app's bottom bar, so "Next" is always under the thumb.
                <div className="sticky bottom-[5.25rem] z-10 mt-4 flex items-center justify-between gap-3 lg:static">
                  <Button variant="ghost" className="bg-[var(--surface-raised)]/90 backdrop-blur lg:bg-transparent" onClick={() => goStep(STEPS[at - 1])} disabled={at === 0}>
                    <ChevronLeft className="size-4" aria-hidden />
                    Back
                  </Button>
                  {at < STEPS.length - 1 ? (
                    <Button variant="primary" disabled={blocked} onClick={() => goStep(STEPS[at + 1])}>
                      Next: {STEP_LABEL[STEPS[at + 1]]}
                      <ChevronRight className="size-4" aria-hidden />
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={() => onTab('checks')}>
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
        {tab === 'after' && (
          <AfterPanel
            record={record}
            update={actions.update}
            wealth={wealth}
            wealthLocked={wealthState.status === 'locked'}
            onWriteBack={(profile) => wealthActions(userId).setProfile(profile)}
            today={today}
            name={selfName}
            email={email}
          />
        )}
        {tab === 'data' && <DataPanel record={record} actions={actions} hasLock={state.hasLock} selfName={selfName} signedIn={signedIn} />}
      </div>
    </div>
  );
}

/** Where you are in the eight steps, as words and a bar. */
function Progress({ at }: { at: number }) {
  const n = STEPS.length;
  return (
    <div className="mb-3 flex items-center gap-3 px-1">
      <p className="text-muted shrink-0 text-xs font-medium tabular-nums">
        Step {at + 1} of {n}
      </p>
      <div role="progressbar" aria-label="Progress through the steps" aria-valuemin={1} aria-valuemax={n} aria-valuenow={at + 1} className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
        <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300" style={{ width: `${((at + 1) / n) * 100}%` }} />
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

function Hero({
  ready,
  blocked,
  signedIn,
  showStatus,
  compact = false,
}: {
  ready: ReturnType<typeof readiness>;
  blocked: boolean;
  signedIn: boolean;
  showStatus: boolean;
  /** The welcome screen: just the title, so the first screen of a phone holds the button. */
  compact?: boolean;
}) {
  return (
    <section aria-labelledby="wm-title" className="surface-lit a-ring relative isolate overflow-hidden rounded-[2rem]">
      <span
        aria-hidden
        className="a-orb -top-40 -left-24 size-[34rem] opacity-[0.16]"
        style={{ background: 'radial-gradient(circle, var(--h-amber), transparent 66%)' }}
      />
      <div className={cn('relative grid gap-4 p-5 sm:gap-6 sm:p-8', compact ? 'sm:py-6' : 'lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-12')}>
        <div className="min-w-0">
          <p className="a-label">Will Maker</p>
          <h1 id="wm-title" className="m-display mt-2 text-[clamp(1.6rem,4vw,2.6rem)] leading-[1.06] text-balance">
            Put in writing who gets what.
          </h1>
          {!compact && (
            <p className="text-muted mt-2.5 max-w-2xl text-[15px] leading-relaxed text-pretty">
              Answer a few plain questions and get a will you can print and sign. Every check names the section of the law behind it.
            </p>
          )}
          <ul className={cn('mt-4 flex-wrap gap-2', compact ? 'hidden' : 'flex')}>
            <Chip icon={HardDrive}>{signedIn ? 'In this browser; encrypted in your account once locked' : 'Kept only in this browser'}</Chip>
            <Chip icon={ShieldAlert} warn={!LAW.advocateSignOff}>
              {LAW.advocateSignOff ? `Drafting aid, not legal advice. Rules reviewed by ${LAW.advocateSignOff.by}, ${LAW.advocateSignOff.on}` : 'Drafting aid, not legal advice. In testing: not yet reviewed by an advocate'}
            </Chip>
          </ul>
          {showStatus && (
            <p
              style={{ '--tone': blocked || ready.act > 0 ? SEVERITY_TONE.act : ready.review > 0 ? SEVERITY_TONE.review : 'var(--status-approved)' } as CSSProperties}
              className="tinted mt-4 inline-flex rounded-full border px-3.5 py-1.5 text-[13px] font-medium"
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
          )}
        </div>
        {!compact && (
          <div className="hidden lg:flex lg:flex-col lg:justify-center [&>*]:max-h-[18rem]">
            <ArchScene motif="scales" className="h-full min-h-[14rem]" />
          </div>
        )}
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
    { id: 'after', label: 'After signing' },
    { id: 'data', label: 'Where it is kept' },
  ];
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div
        role="tablist"
        aria-label="Your will"
        className="surface-sunken inline-flex min-w-max gap-1 rounded-2xl border p-1"
        onKeyDown={(e) => {
          // The tabs pattern: arrows move between tabs (wrapping), Home and End go to the ends.
          const all = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]:not(:disabled)')];
          const i = all.indexOf(document.activeElement as HTMLButtonElement);
          if (i < 0) return;
          const to = e.key === 'ArrowRight' ? (i + 1) % all.length : e.key === 'ArrowLeft' ? (i - 1 + all.length) % all.length : e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : -1;
          if (to < 0) return;
          e.preventDefault();
          all[to].focus();
          all[to].click();
        }}
      >
        {TABS.map((t) => {
          const on = tab === t.id;
          const n = counts[t.id];
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`wm-tab-${t.id}`}
              aria-selected={on}
              aria-controls={on ? 'wm-panel' : undefined}
              tabIndex={on ? 0 : -1}
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
