'use client';

import { ArrowRight, Ban, Check, FileText, Lock, Scan, ShieldCheck } from 'lucide-react';
import { fmtRupees } from '@/lib/domain/voucher';
import { STEPS } from '@/lib/marketing/content';
import { cn } from '@/lib/utils';
import { Container, Eyebrow } from '../bits';
import { Reveal } from '../Reveal';
import { ScrollStage, StageFallback } from '../motion';

/**
 * One voucher, followed from the invoice landing to the record closing.
 *
 * This is the section the page is built around. On a wide screen it pins: the
 * heading holds still while four scenes advance in place, so the reader spends
 * their scroll on one idea developing rather than on four separate cards going
 * past. Below `lg` it unpins and becomes four stacked cards — a pinned section on
 * a phone fights the browser's own address-bar collapse and commandeers the one
 * gesture the reader has.
 *
 * Both layouts render the same four scene components. There is exactly one
 * definition of what step three looks like.
 */

const BASIC = 184_000;
const IGST = 33_120;
const NET = BASIC + IGST;
const TDS = 3_680;
const GRAND = NET - TDS;

const SCENES = [ArriveScene, RulesScene, DecideScene, CloseScene] as const;

export function Journey() {
  return (
    <section id="how" className="relative border-t border-[var(--m-line)]">
      <Container wide className="relative pt-20 sm:pt-28">
        <Reveal>
          <Eyebrow className="mb-4">How it works</Eyebrow>
          <h2 className="m-display max-w-3xl text-[clamp(1.9rem,4.2vw,3.25rem)]">
            One voucher, <span className="m-serif m-grad-text">start to finish.</span>
          </h2>
          <p className="m-dim mt-5 max-w-2xl text-[15px] leading-relaxed sm:text-base">
            Four steps. The software does the first two, because they are only rules. A person does
            the third, because it is a decision. The fourth is the record, and after that nobody can
            change it.
          </p>
        </Reveal>
      </Container>

      {/* ── Wide: pinned ── */}
      <ScrollStage steps={SCENES.length} className="mt-4">
        {(step) => (
          <Container wide>
            <div className="grid items-center gap-16 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
              <div>
                <StepRail active={step} />
                {/*
                  Keyed on the step so the copy re-mounts and replays its
                  entrance. Without the key React would reconcile the text in
                  place and the change would happen with no motion at all.
                */}
                <div key={step} className="mt-8 animate-[rise_0.55s_cubic-bezier(0.22,1,0.36,1)]">
                  <p className="m-mono text-[11px] tracking-[0.2em] text-[var(--m-cyan)]">
                    {STEPS[step].n}
                  </p>
                  <h3 className="m-display mt-3 text-[clamp(1.6rem,2.6vw,2.4rem)]">
                    {STEPS[step].title}
                  </h3>
                  <p className="m-dim mt-4 max-w-md text-[15px] leading-relaxed">
                    {STEPS[step].body}
                  </p>
                </div>
              </div>

              <div key={`panel-${step}`} className="animate-[pop_0.5s_cubic-bezier(0.22,1,0.36,1)]">
                {SCENES.map((Scene, i) => (i === step ? <Scene key={i} /> : null))}
              </div>
            </div>

            {/* Consumes --stage-progress directly, so it tracks the scroll
                continuously rather than snapping between the four steps. */}
            <div className="mt-14 h-px w-full overflow-hidden bg-[var(--m-line)]">
              <span
                aria-hidden
                className="block h-px origin-left"
                style={{
                  backgroundImage: 'var(--m-grad)',
                  transform: 'scaleX(var(--stage-progress, 0))',
                }}
              />
            </div>
          </Container>
        )}
      </ScrollStage>

      {/* ── Narrow: stacked ── */}
      <StageFallback>
        <Container className="space-y-14 pt-12 pb-20">
          {SCENES.map((Scene, i) => (
            <Reveal key={i} className="border-t border-[var(--m-line)] pt-8 first:border-0 first:pt-0">
              <p className="m-mono text-[11px] tracking-[0.2em] text-[var(--m-cyan)]">{STEPS[i].n}</p>
              <h3 className="m-display mt-3 text-[1.65rem]">{STEPS[i].title}</h3>
              <p className="m-dim mt-3.5 text-[14.5px] leading-relaxed">{STEPS[i].body}</p>
              <div className="mt-7">
                <Scene />
              </div>
            </Reveal>
          ))}
        </Container>
      </StageFallback>
    </section>
  );
}

/** The four steps as a horizontal rail, with the reached ones filled. */
function StepRail({ active }: { active: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const reached = i <= active;
        return (
          <li key={s.n} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'grid size-7 shrink-0 place-items-center rounded-full border text-[10px] font-semibold transition-all duration-500',
                reached
                  ? 'border-transparent text-[var(--m-bg)]'
                  : 'm-dim-2 border-[var(--m-line-2)]',
              )}
              style={reached ? { backgroundImage: 'var(--m-grad)' } : undefined}
            >
              {i + 1}
            </span>
            {i < STEPS.length - 1 && (
              <span className="h-px flex-1 overflow-hidden bg-[var(--m-line)]">
                <span
                  className="block h-px origin-left transition-transform duration-700 ease-out"
                  style={{
                    backgroundImage: 'var(--m-grad)',
                    transform: `scaleX(${i < active ? 1 : 0})`,
                  }}
                />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ── Scene chrome ────────────────────────────────────────────────────────── */

function Panel({
  title,
  meta,
  children,
  accent = 'var(--m-indigo)',
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="absolute -inset-5 rounded-[26px] opacity-25 blur-3xl"
        style={{ background: accent }}
      />
      <div className="m-card m-ring relative overflow-hidden rounded-2xl">
        <div className="flex items-center gap-3 border-b border-[var(--m-line)] px-5 py-3.5">
          <span className="m-mono text-[11px] tracking-[0.14em] uppercase">{title}</span>
          {meta && <span className="m-dim-2 m-mono ml-auto text-[10px]">{meta}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}

/** A single label→value line, the unit most of these scenes are built from. */
function Line({
  label,
  value,
  tone = 'plain',
  delay = 0,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'plain' | 'good' | 'accent';
  delay?: number;
}) {
  return (
    <div
      className="flex animate-[ticker_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] items-baseline justify-between gap-4"
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <span className="m-dim-2 text-[12.5px]">{label}</span>
      <span
        className={cn(
          'm-tabular text-[13px] font-medium',
          tone === 'good' && 'text-[var(--m-emerald)]',
          tone === 'accent' && 'text-[var(--m-cyan)]',
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* ── 01 · The work arrives ───────────────────────────────────────────────── */

function ArriveScene() {
  return (
    <Panel title="Invoice intake" meta="read from the invoice" accent="var(--m-magenta)">
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-5">
        {/* The document, abstracted to the shape of one. */}
        <div className="relative mx-auto w-[7.5rem] shrink-0 rounded-lg border border-[var(--m-line-2)] bg-white/[0.03] p-3">
          <FileText className="size-4 text-[var(--m-magenta)]" aria-hidden />
          <div className="mt-2.5 space-y-1.5" aria-hidden>
            {[100, 78, 92, 60, 84, 46].map((w, i) => (
              <span
                key={i}
                className="block h-1 rounded-full bg-white/[0.09]"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
          <span
            aria-hidden
            className="absolute inset-x-0 top-3 h-8 animate-[sweep_2.8s_ease-in-out_infinite] motion-reduce:hidden"
            style={{
              background:
                'linear-gradient(to bottom, transparent, color-mix(in oklab, var(--m-magenta) 40%, transparent), transparent)',
            }}
          />
          <span className="m-mono m-dim-2 mt-3 flex items-center gap-1 text-[9px] tracking-[0.1em] uppercase">
            <Scan className="size-2.5" aria-hidden />
            PDF
          </span>
        </div>

        <div className="space-y-2.5">
          <Line label="Supplier" value="Meridian Events Pvt Ltd" delay={80} />
          <Line label="GSTIN" value="29AABCM1234K1ZQ" tone="good" delay={160} />
          <Line label="Invoice no." value="MER/24-25/0881" delay={240} />
          <Line label="Basic value (A)" value={fmtRupees(BASIC)} delay={320} />
          <p
            className="m-dim-2 flex animate-[ticker_0.5s_backwards] items-start gap-2 pt-1.5 text-[11px] leading-relaxed"
            style={{ animationDelay: '420ms' }}
          >
            <Check className="mt-px size-3 shrink-0 text-[var(--m-emerald)]" aria-hidden />
            The GSTIN is valid and the PAN inside it matches the one on file. Both checked before you
            see the draft.
          </p>
        </div>
      </div>
    </Panel>
  );
}

/* ── 02 · The rules run ──────────────────────────────────────────────────── */

function RulesScene() {
  return (
    <Panel title="Rules applied" meta="before anyone looks" accent="var(--m-cyan)">
      <div className="space-y-3 px-5 py-5">
        <Rule
          input="Supplier in Karnataka · chapter in Maharashtra"
          decision="Between states, so IGST"
          detail="CGST and SGST stay empty. A voucher with both is refused before you can submit it."
        />
        <Rule
          input="Payment to an event contractor, and the payee is a company"
          decision="TDS 194C at 2%"
          detail={`That is ${fmtRupees(TDS)} deducted. You are told now, while the voucher is still a draft, not next quarter.`}
          delay={110}
        />
        <Rule
          input="Chapter CIO · date 14 Aug 2025"
          decision="FY 25-26, number 0042"
          detail="The database hands out the number when you submit. One run per chapter per year, and nobody types it by hand."
          delay={220}
        />

        <div
          className="mt-4 flex animate-[settle_0.7s_ease-out_backwards] items-center justify-between gap-4 rounded-xl border border-[var(--m-line)] bg-white/[0.03] px-4 py-3.5"
          style={{ animationDelay: '340ms' }}
        >
          <span className="m-eyebrow">Issued</span>
          <span className="m-mono text-[13px] tracking-[0.04em] text-[var(--m-lime)]">
            NVR/CIO/25-26/0042
          </span>
        </div>
      </div>
    </Panel>
  );
}

function Rule({
  input,
  decision,
  detail,
  delay = 0,
}: {
  input: string;
  decision: string;
  detail: string;
  delay?: number;
}) {
  return (
    <div
      className="animate-[ticker_0.55s_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-xl border border-[var(--m-line)] bg-white/[0.02] px-4 py-3"
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="m-dim-2 text-[11.5px]">{input}</span>
        <ArrowRight className="size-3 shrink-0 text-[var(--m-cyan)]" aria-hidden />
        <span className="text-[12.5px] font-semibold text-[var(--m-cyan)]">{decision}</span>
      </div>
      <p className="m-dim-2 mt-1.5 text-[11px] leading-relaxed">{detail}</p>
    </div>
  );
}

/* ── 03 · A person decides ───────────────────────────────────────────────── */

function DecideScene() {
  return (
    <Panel title="Approvals" meta="two people needed" accent="var(--m-indigo)">
      <div className="px-5 py-5">
        <div className="space-y-2.5">
          <Line label="Net total (A + B + C)" value={fmtRupees(NET)} delay={60} />
          <Line label="(−) TDS 194C" value={`− ${fmtRupees(TDS)}`} delay={120} />
          <div className="flex items-end justify-between border-t border-[var(--m-line)] pt-3.5">
            <span className="m-eyebrow">Grand total</span>
            <span className="m-display m-tabular text-2xl">{fmtRupees(GRAND)}</span>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <Node name="R. Menon" caption="Raised" state="done" />
          <Connector filled />
          <Node name="A. Shah" caption="1st approval" state="done" />
          <Connector />
          <Node name="Waiting" caption="2nd approval" state="waiting" />
        </div>

        <p
          className="m-dim-2 mt-5 flex animate-[ticker_0.5s_backwards] items-start gap-2 text-[11px] leading-relaxed"
          style={{ animationDelay: '280ms' }}
        >
          <Ban className="mt-px size-3.5 shrink-0 text-[var(--m-rose)]" aria-hidden />
          <span>
            R. Menon raised this one, so the database will not take their approval. A. Shah has
            already given the first, so it will not take theirs again. The second approval has to come
            from somebody else.
          </span>
        </p>
      </div>
    </Panel>
  );
}

function Node({
  name,
  caption,
  state,
}: {
  name: string;
  caption: string;
  state: 'done' | 'waiting';
}) {
  const done = state === 'done';
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <span
        className={
          done
            ? 'grid size-8 place-items-center rounded-full border border-[color-mix(in_oklab,var(--m-emerald)_45%,transparent)] bg-[color-mix(in_oklab,var(--m-emerald)_16%,transparent)]'
            : 'relative grid size-8 place-items-center rounded-full border border-dashed border-[var(--m-line-2)]'
        }
      >
        {done ? (
          <Check className="size-4 text-[var(--m-emerald)]" aria-hidden />
        ) : (
          <>
            <span
              aria-hidden
              className="absolute inset-0 animate-[halo_2.6s_ease-out_infinite] rounded-full border border-[var(--m-amber)] motion-reduce:hidden"
            />
            <span className="size-1.5 rounded-full bg-[var(--m-amber)]" />
          </>
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-medium">{name}</span>
        <span className="m-dim-2 mt-0.5 block text-[10px]">{caption}</span>
      </span>
    </div>
  );
}

function Connector({ filled }: { filled?: boolean }) {
  return (
    <span
      aria-hidden
      className="relative -mt-6 h-px flex-1 overflow-hidden"
      style={{
        background: filled
          ? 'color-mix(in oklab, var(--m-emerald) 45%, transparent)'
          : 'var(--m-line-2)',
      }}
    >
      {!filled && (
        <span
          className="absolute inset-y-0 w-1/3 animate-[sweep_3.2s_ease-in-out_infinite] motion-reduce:hidden"
          style={{ background: 'linear-gradient(90deg, transparent, var(--m-amber), transparent)' }}
        />
      )}
    </span>
  );
}

/* ── 04 · The record closes ──────────────────────────────────────────────── */

const TRAIL = [
  { at: '14 Aug · 10:12', who: 'R. Menon', what: 'Raised the voucher' },
  { at: '14 Aug · 10:14', who: 'R. Menon', what: 'Submitted. Given number NVR/CIO/25-26/0042' },
  { at: '14 Aug · 11:40', who: 'A. Shah', what: 'First approval' },
  { at: '15 Aug · 09:05', who: 'P. Iyer', what: 'Second approval. Record locked' },
] as const;

function CloseScene() {
  return (
    <Panel title="The history" meta="nothing can be edited" accent="var(--m-emerald)">
      <div className="px-5 py-5">
        <div className="flex items-center gap-3 rounded-xl border border-[color-mix(in_oklab,var(--m-emerald)_28%,transparent)] bg-[color-mix(in_oklab,var(--m-emerald)_9%,transparent)] px-4 py-3">
          <Lock className="size-4 shrink-0 text-[var(--m-emerald)]" aria-hidden />
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold">Approved and locked</p>
            <p className="m-dim-2 mt-0.5 text-[11px]">
              The amounts, the payee and the voucher number cannot be changed by anyone now.
            </p>
          </div>
        </div>

        <ol className="mt-4 space-y-0">
          {TRAIL.map((row, i) => (
            <li
              key={row.at}
              className="flex animate-[ticker_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] items-start gap-3 border-t border-[var(--m-line)] py-2.5 first:border-0"
              style={{ animationDelay: `${120 + i * 110}ms` }}
            >
              <span className="m-mono m-dim-2 w-[6.5rem] shrink-0 pt-px text-[10px]">{row.at}</span>
              <span className="min-w-0">
                <span className="block text-[12px] font-medium">{row.who}</span>
                <span className="m-dim-2 text-[11px]">{row.what}</span>
              </span>
            </li>
          ))}
        </ol>

        <p className="m-dim-2 mt-4 flex items-start gap-2 border-t border-[var(--m-line)] pt-3.5 text-[11px] leading-relaxed">
          <ShieldCheck className="mt-px size-3.5 shrink-0 text-[var(--m-emerald)]" aria-hidden />
          <span>
            Nobody can edit or delete a line here, whatever their role, including the owner of the
            account. Putting something right adds a new line. It never changes an old one.
          </span>
        </p>
      </div>
    </Panel>
  );
}
