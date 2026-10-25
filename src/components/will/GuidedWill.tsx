'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, FileText, HandHelping, ListChecks, Scale } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { SEVERITY_TONE } from '@/components/wealth/shared';
import { readiness, type Finding, type Step } from '@/lib/will/checks';
import { GUIDE } from '@/lib/will/guide';
import { isAnswered, questionsFor, REQUIRED, resumeAt, type QuestionId } from '@/lib/will/guided';
import { isBlank } from '@/lib/will/progress';
import { scopeOf } from '@/lib/will/law';
import type { WillRecord } from '@/lib/will/model';
import type { WealthRecord } from '@/lib/wealth/model';
import { ExportBar } from './ExportBar';
import {
  BornQ,
  ConfirmQ,
  EverythingQ,
  ExecutorQ,
  FamilyQ,
  GiftsQ,
  GuardianQ,
  HomeQ,
  NameQ,
  outOfScopeReasons,
  WitnessesQ,
  type QProps,
} from './GuidedQuestions';
import { HelpRequest } from './HelpRequest';
import { WillPaper } from './Preview';
import { Notice } from './shared';

/**
 * The guided way through a will: one plain question at a time, the will taking shape beside
 * it, and at the end a screen that says what to do on the day.
 *
 * It edits the same record as the detailed form and answers to the same checks, so the two
 * views can be swapped at any point and nothing is lost. Everything it knows about what an
 * answer means is in lib/will/guided; this file is the order, the navigation and the chrome.
 */

/** Where each check's step sends you in the guided questions, so "Fix" lands on a question and not a form. */
const STEP_TO_QUESTION: Record<Step, QuestionId> = {
  you: 'name',
  family: 'family',
  assets: 'gifts',
  gifts: 'gifts',
  residue: 'everything',
  people: 'executor',
  extras: 'confirm',
  sign: 'confirm',
};

export function GuidedWill({
  record,
  update,
  findings,
  today,
  wealth,
  name,
  email,
  onDetailed,
  fresh = false,
}: {
  record: WillRecord;
  update: QProps['update'];
  findings: Finding[];
  today: string;
  wealth: WealthRecord | null;
  name: string;
  email: string;
  /** Switch to the detailed form, optionally on a particular tab. */
  onDetailed: (tab?: 'after' | 'checks') => void;
  /** Just started from the welcome: begin at the first question, whatever the draft already holds (an import, the account's name). */
  fresh?: boolean;
}) {
  const qs = useMemo(() => questionsFor(record, today), [record, today]);
  const [at, setAt] = useState<QuestionId>(() => (fresh || isBlank(record) ? 'name' : resumeAt(record, today)));
  // A new draft starts at the first question even though the account's name is already in it, so the
  // person sees and confirms it; one with work in it picks up where it left off. A will whose
  // required questions are all answered opens on the ending.
  const [finished, setFinished] = useState(() => !fresh && REQUIRED.every((q) => isAnswered(q, record)));
  const [sheet, setSheet] = useState(false);
  const [help, setHelp] = useState(false);

  const idx = Math.max(0, qs.indexOf(at));
  const current = qs[idx];
  const scope = useMemo(() => scopeOf(record.testator, today), [record.testator, today]);
  const blocked = scope.level === 'out';
  // A refusal stops the questions that follow it, not the ones that could change it.
  const stopped = blocked && !['name', 'born', 'home'].includes(current);

  const headRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headRef.current?.querySelector<HTMLElement>('h2')?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [current, finished]);

  const go = (id: QuestionId) => {
    setFinished(false);
    setAt(id);
  };
  const q: QProps = { record, update, today, go: (id) => go(id) };
  const required = REQUIRED.includes(current);
  const answered = isAnswered(current, record);
  const canNext = !stopped && answered && !(blocked && (current === 'born' || current === 'home'));
  const last = idx === qs.length - 1;

  if (finished) {
    return (
      <Ready
        record={record}
        findings={findings}
        today={today}
        name={name}
        email={email}
        onChange={() => go('confirm')}
        onFix={(f) => go(STEP_TO_QUESTION[f.step])}
        onDetailed={onDetailed}
        sheet={sheet}
        setSheet={setSheet}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-8">
      <div className="min-w-0">
        <div className="mb-3 flex items-center gap-3 px-1">
          <p className="text-muted shrink-0 text-xs font-medium tabular-nums">
            Question {idx + 1} of {qs.length}
          </p>
          <div role="progressbar" aria-label="Progress through the questions" aria-valuemin={1} aria-valuemax={qs.length} aria-valuenow={idx + 1} className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300" style={{ width: `${((idx + 1) / qs.length) * 100}%` }} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => onDetailed()}>
            Detailed view
          </Button>
        </div>

        <section className="surface-lit a-ring rounded-[1.75rem] p-5 sm:p-8" aria-live="polite">
          <div ref={headRef}>
            {stopped ? (
              <OutOfScope reasons={outOfScopeReasons(record, today)} onChange={() => go('born')} onHelp={() => setHelp(true)} />
            ) : (
              <Question id={current} q={q} findings={findings} wealth={wealth} />
            )}
          </div>
          {blocked && !stopped && (
            <div className="mt-6">
              <OutOfScope reasons={outOfScopeReasons(record, today)} onChange={null} onHelp={() => setHelp(true)} />
            </div>
          )}
        </section>

        {!stopped && (
          // Sticky on a phone, above the app's bottom bar, so the way on is always under the thumb.
          <div className="sticky bottom-[5.25rem] z-10 mt-4 flex items-center justify-between gap-2 lg:static">
            <Button variant="ghost" className="bg-[var(--surface-raised)]/90 backdrop-blur lg:bg-transparent" disabled={idx === 0} onClick={() => go(qs[idx - 1])}>
              <ChevronLeft className="size-4" aria-hidden />
              Back
            </Button>
            <Button variant="secondary" className="lg:hidden" onClick={() => setSheet(true)} disabled={blocked}>
              <FileText className="size-4" aria-hidden />
              My will
            </Button>
            {last ? (
              <Button variant="primary" disabled={!canNext} onClick={() => setFinished(true)}>
                Finish
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button variant="primary" disabled={!canNext} onClick={() => go(qs[idx + 1])}>
                {!required && isOptionalEmpty(current, record) ? 'Skip' : 'Next'}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        )}
      </div>

      <aside aria-label="Your will so far" className="hidden lg:block">
        <div className="sticky top-24">
          <p className="a-label mb-2 px-1">Your will so far</p>
          <div className="max-h-[calc(100vh-9rem)] overflow-y-auto rounded-2xl" tabIndex={0} role="region" aria-label="Preview of your will">
            {blocked ? <p className="text-muted surface-sunken rounded-2xl border p-4 text-sm">There is no will to show while this tool cannot make yours.</p> : <WillPaper record={record} today={today} className="!px-5 !py-6 !text-[12.5px] !leading-[1.65]" />}
          </div>
        </div>
      </aside>

      <Modal open={sheet} onClose={() => setSheet(false)} title="Your will so far">
        <div className="max-h-[70vh] overflow-y-auto" tabIndex={0} role="region" aria-label="Preview of your will">
          <WillPaper record={record} today={today} className="!px-4 !py-5 !text-[12.5px] !leading-[1.65] !shadow-none" />
        </div>
      </Modal>
      <HelpRequest open={help} onClose={() => setHelp(false)} name={name} email={email} />
    </div>
  );
}

/** Whether an optional question has nothing in it yet, so the way on reads “Skip” and not “Next”. */
function isOptionalEmpty(id: QuestionId, r: WillRecord): boolean {
  switch (id) {
    case 'family':
      return r.people.length === 0;
    case 'gifts':
      return r.gifts.length === 0;
    case 'executor':
      return r.executorIds.length === 0;
    case 'guardian':
      return r.guardianIds.length === 0;
    case 'witnesses':
      return r.witnessIds.length === 0;
    default:
      return false;
  }
}

function Question({ id, q, findings, wealth }: { id: QuestionId; q: QProps; findings: Finding[]; wealth: WealthRecord | null }) {
  switch (id) {
    case 'name':
      return <NameQ {...q} />;
    case 'born':
      return <BornQ {...q} />;
    case 'home':
      return <HomeQ {...q} />;
    case 'family':
      return <FamilyQ {...q} />;
    case 'everything':
      return <EverythingQ {...q} />;
    case 'gifts':
      return <GiftsQ {...q} wealth={wealth} />;
    case 'executor':
      return <ExecutorQ {...q} />;
    case 'guardian':
      return <GuardianQ {...q} />;
    case 'witnesses':
      return <WitnessesQ {...q} findings={findings} />;
    case 'confirm':
      return <ConfirmQ {...q} />;
  }
}

/** A refusal in plain words, with the two ways forward: change an answer, or ask an advocate. */
function OutOfScope({ reasons, onChange, onHelp }: { reasons: ReturnType<typeof outOfScopeReasons>; onChange: (() => void) | null; onHelp: () => void }) {
  return (
    <div>
      <h2 tabIndex={-1} className="text-[1.45rem] leading-tight font-semibold tracking-tight outline-none">
        This tool cannot make your will
      </h2>
      <ul className="mt-4 space-y-2">
        {reasons.map((r) => (
          <li key={r.id} style={{ '--tone': SEVERITY_TONE.act } as React.CSSProperties} className="tinted rounded-2xl border px-4 py-3">
            <p className="text-sm font-semibold">{r.title}</p>
            <p className="text-muted mt-1 text-[13px] leading-relaxed text-pretty">{r.detail}</p>
            {r.cite && <p className="text-subtle mt-1 text-[11.5px]">{r.cite}</p>}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="primary" onClick={onHelp}>
          <HandHelping className="size-4" aria-hidden />
          Ask an advocate for help
        </Button>
        {onChange && <Button onClick={onChange}>Change my answers</Button>}
      </div>
    </div>
  );
}

// ── The ending ──────────────────────────────────────────────────────────────

function Ready({
  record,
  findings,
  today,
  name,
  email,
  onChange,
  onFix,
  onDetailed,
  sheet,
  setSheet,
}: {
  record: WillRecord;
  findings: Finding[];
  today: string;
  name: string;
  email: string;
  onChange: () => void;
  onFix: (f: Finding) => void;
  onDetailed: (tab?: 'after' | 'checks') => void;
  sheet: boolean;
  setSheet: (v: boolean) => void;
}) {
  const ready = readiness(findings);
  const todo = findings.filter((f) => f.severity !== 'note');
  const [help, setHelp] = useState(false);
  const rules = GUIDE.flatMap((p) => p.steps).filter((s) => s.kind === 'rule');
  // Focus lands on the heading once, when this screen appears, so a screen reader starts at "ready".
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => top.current?.focus(), []);

  return (
    <div className="space-y-5">
      <section className="surface-lit a-ring rounded-[1.75rem] p-5 sm:p-8">
        <div tabIndex={-1} className="outline-none" ref={top}>
          <h2 className="text-[1.6rem] leading-tight font-semibold tracking-tight text-balance sm:text-[1.9rem]">
            {ready.ready ? 'Your will is ready to print.' : `Nearly there: ${todo.length} ${todo.length === 1 ? 'thing' : 'things'} to look at.`}
          </h2>
          <p className="text-muted mt-2 max-w-xl text-[15px] leading-relaxed text-pretty">
            {ready.ready
              ? 'It is not a will until you sign it on paper with two witnesses. Here is what to do next.'
              : 'You can still print it, marked as a draft, and take it to an advocate. Fix these for a clean copy.'}
          </p>
        </div>

        {!ready.ready && (
          <ul className="mt-5 space-y-2">
            {todo.slice(0, 6).map((f) => (
              <li key={f.id} style={{ '--tone': SEVERITY_TONE[f.severity] } as React.CSSProperties} className="tinted flex items-start justify-between gap-3 rounded-2xl border px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-muted mt-0.5 text-[13px] leading-relaxed text-pretty">{f.detail}</p>
                </div>
                <Button size="sm" onClick={() => onFix(f)}>
                  Fix
                </Button>
              </li>
            ))}
            {todo.length > 6 && (
              <li>
                <Button size="sm" variant="ghost" onClick={() => onDetailed('checks')}>
                  See all {todo.length} in the detailed view
                </Button>
              </li>
            )}
          </ul>
        )}
      </section>

      <ExportBar record={record} today={today} />

      <section aria-label="On the day" className="surface-lit a-ring rounded-[1.75rem] p-5 sm:p-8">
        <div className="flex items-center gap-2">
          <ListChecks className="size-5" aria-hidden />
          <h3 className="text-lg font-semibold">On the day you sign</h3>
        </div>
        <ol className="mt-4 space-y-3">
          {rules.map((s, i) => (
            <li key={s.text} className="flex gap-3 text-[15px] leading-relaxed">
              <span aria-hidden className="surface-sunken grid size-6 shrink-0 place-items-center rounded-full border text-[12px] font-semibold tabular-nums">
                {i + 1}
              </span>
              <span>
                <span className="font-medium">{s.text}</span>
                {s.detail && <span className="text-muted block text-[13.5px]">{s.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-subtle mt-4 text-xs">The “How to sign” PDF above has the full list, including good practice. A will needs no stamp paper and no notary.</p>
      </section>

      <section className="surface-sunken flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center">
        <Scale className="size-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Want an advocate to read it first?</h3>
          <p className="text-muted mt-0.5 text-[13.5px]">Most useful if anything about your family or what you own is out of the ordinary.</p>
        </div>
        <Button onClick={() => setHelp(true)}>
          <HandHelping className="size-4" aria-hidden />
          Ask for help
        </Button>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={onChange}>
          Change my answers
        </Button>
        <Button variant="ghost" onClick={() => setSheet(true)}>
          <FileText className="size-4" aria-hidden />
          Read my will
        </Button>
        <Button variant="ghost" onClick={() => onDetailed('after')}>
          After you sign: record where it is kept
        </Button>
        <Button variant="ghost" onClick={() => onDetailed()}>
          Detailed view
        </Button>
      </div>

      <Modal open={sheet} onClose={() => setSheet(false)} title="Your will">
        <div className="max-h-[70vh] overflow-y-auto" tabIndex={0} role="region" aria-label="Preview of your will">
          <WillPaper record={record} today={today} className="!px-4 !py-5 !text-[12.5px] !leading-[1.65] !shadow-none" />
        </div>
      </Modal>
      <HelpRequest open={help} onClose={() => setHelp(false)} name={name} email={email} />
      {!ready.ready && todo.length === 0 && <Notice>Nothing to fix.</Notice>}
    </div>
  );
}
