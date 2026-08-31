'use client';

import { ArrowRight, Ban, Check, Lock, ShieldCheck } from 'lucide-react';
import { fmtRupees } from '@/lib/domain/voucher';
import { STEPS } from '@/lib/marketing/content';
import { cn } from '@/lib/utils';
import { Container, Eyebrow } from '../bits';
import { Reveal } from '../Reveal';
import { Roost } from '@/components/brand/Owl';

/**
 * One voucher, followed from the invoice landing to the record closing.
 *
 * This is the section the page is built around, and it is four rows of ordinary
 * page — copy on the left, the scene it describes on the right.
 *
 * ── Why it no longer pins ───────────────────────────────────────────────────
 *
 * It used to be a pinned stage on wide screens: a tall track, a sticky child one
 * viewport high, and four scenes advancing in place while the page appeared to
 * stop. It read well in a screenshot and badly in use. Pinning takes over the
 * reader's only gesture — the scrollbar stops corresponding to the page, four
 * viewport-heights of travel produce one screen of movement, and somebody
 * skimming for the third step has no way to get to it except by scrolling
 * through the first two at the pace the section chooses. It also meant the
 * section had two layouts, a pinned one and a stacked one below `lg`, which is
 * two things to keep true about the same four steps.
 *
 * Unpinned, the reader scrolls at their own speed, every step has a real
 * position on the page, and there is one layout at every width. The scenes are
 * unchanged; only the frame around them is gone.
 *
 * ── Why scene one was replaced ──────────────────────────────────────────────
 *
 * It used to be an invoice being read: a document with a scanning line across
 * it, fields arriving already filled in, and a tick saying the GSTIN had been
 * checked before the reader ever saw the draft. That is Invoice Intake, which is
 * on the roadmap, sitting inside a section whose own standfirst says it is
 * showing you the tool you can use today.
 *
 * What replaced it is the thing that does happen: somebody types the voucher,
 * and the form argues with them as they go. It is a less impressive picture and
 * a much better one, because every line in it can be reproduced by a reader with
 * an account, including the refusal, whose wording is the wording the product
 * actually uses.
 */

const BASIC = 184_000;
const IGST = 33_120;
const NET = BASIC + IGST;
const TDS = 3_680;
const GRAND = NET - TDS;

const SCENES = [DraftScene, RulesScene, DecideScene, CloseScene] as const;

export function Journey() {
  return (
    <section id="how" className="relative border-t border-[var(--m-line)]">
      {/* The long section, so one at each end rather than one in the middle of
          three thousand pixels of scrolling. */}
      <Roost seed="journey-hollow" band="top-right" />
      <Roost seed="journey-branch" band="bottom-left" />
      <Container wide className="relative pt-20 sm:pt-28">
        <Reveal>
          <Eyebrow className="mb-4">How it works</Eyebrow>
          <h2 className="m-display s-settle max-w-3xl text-[clamp(1.9rem,4.2vw,3.25rem)]">
            One job, <span className="m-serif m-grad-text">start to finish.</span>
          </h2>
          <p className="m-dim mt-5 max-w-2xl text-[15px] leading-relaxed sm:text-base">
            A person starts it and a person signs it off. Everything in between is rules, and the
            rules are held by the database rather than by the page, so they hold whether the request
            came from this website, from a script, or from anywhere else.
          </p>
          <p className="m-dim-2 mt-4 max-w-2xl text-[13.5px] leading-relaxed">
            The example below is a payment going through Voucher Desk. Every tool after it is built
            the same way, with different rules in the middle.
          </p>
        </Reveal>
      </Container>

      {/*
        An ordered list, because these four are a sequence and the numbering is
        load-bearing rather than decorative — step three cannot happen before
        step two.
      */}
      <Container wide className="pb-20 sm:pb-28">
        <ol className="mt-14 space-y-16 sm:mt-20 sm:space-y-24">
          {SCENES.map((Scene, i) => (
            <li key={i}>
              {/*
                `items-center` rather than `items-start`: the copy is three or
                four lines and the panels run to roughly twice that, so aligning
                the tops would leave a short paragraph stranded against the top
                edge of a tall card.
              */}
              <Reveal className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] lg:gap-16">
                <div>
                  <div className="flex items-center gap-3.5">
                    <span className="m-mono text-[11px] tracking-[0.2em] text-[var(--m-gold)]">
                      {STEPS[i].n}
                    </span>
                    {/* A plain hairline, drawn nowhere. It is a rule beside a
                        number, and it holds the step numbers to the same optical
                        left edge as the eyebrow on the heading above. */}
                    <span aria-hidden className="h-px w-10 bg-[var(--m-line-2)]" />
                  </div>
                  <h3 className="m-display mt-4 text-[clamp(1.6rem,2.6vw,2.4rem)]">
                    {STEPS[i].title}
                  </h3>
                  <p className="m-dim mt-4 max-w-md text-[15px] leading-relaxed">{STEPS[i].body}</p>
                </div>

                <div>
                  <Scene />
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </Container>
    </section>
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
          tone === 'accent' && 'text-[var(--m-gold)]',
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* ── 01 · Somebody raises it ─────────────────────────────────────────────── */

/**
 * The draft, arguing back.
 *
 * Three checks that pass and one that does not, because a column of ticks is a
 * claim and a refusal is a demonstration. The sentence on the struck row is
 * copied from the product: it is the exact message `domain/schema.ts` produces
 * when a payment date pre-dates its invoice, so a reader who goes and tries it
 * gets the same words back.
 */
function DraftScene() {
  return (
    <Panel title="The draft" meta="checked as it is typed" accent="var(--m-gold)">
      <div className="space-y-2.5 px-5 py-5">
        <Line label="Paid to" value="Meridian Events Pvt Ltd" delay={60} />
        <Line label="PAN" value="AABCM1234K" tone="good" delay={130} />
        <Line label="GSTIN" value="29AABCM1234K1ZQ" tone="good" delay={200} />

        <p
          className="m-dim-2 flex animate-[ticker_0.5s_backwards] items-start gap-2 pt-1 text-[11px] leading-relaxed"
          style={{ animationDelay: '270ms' }}
        >
          <Check className="mt-px size-3 shrink-0 text-[var(--m-emerald)]" aria-hidden />
          The GSTIN passes its own checksum, and the PAN inside it is the PAN entered above it. Both
          checked here, and again by the database.
        </p>

        <div className="!mt-5 space-y-2.5 border-t border-[var(--m-line)] pt-4">
          <Line label="Invoice date" value="04 Aug 2026" delay={340} />
          <Line label="Voucher date" value="14 Aug 2026" delay={400} />
          <Refused label="Payment date" value="28 Jul 2026" />
        </div>

        <p
          className="m-dim-2 flex animate-[ticker_0.5s_backwards] items-start gap-2 pt-1 text-[11px] leading-relaxed"
          style={{ animationDelay: '540ms' }}
        >
          <Ban className="mt-px size-3.5 shrink-0 text-[var(--m-rose)]" aria-hidden />
          <span>Payment cannot pre-date the invoice.</span>
        </p>
      </div>
    </Panel>
  );
}

/** A line the form will not accept, struck through with its own reason beneath. */
function Refused({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex animate-[ticker_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] items-baseline justify-between gap-4"
      style={{ animationDelay: '470ms' }}
    >
      <span className="m-dim-2 text-[12.5px]">{label}</span>
      <span className="m-tabular text-[13px] font-medium text-[var(--m-rose)] line-through decoration-1">
        {value}
      </span>
    </div>
  );
}

/* ── 02 · The rules run ──────────────────────────────────────────────────── */

function RulesScene() {
  return (
    <Panel title="Rules applied" meta="by the database, not the page" accent="var(--m-gold)">
      <div className="space-y-3 px-5 py-5">
        <Rule
          input="Supplier in Karnataka · chapter in Maharashtra"
          decision="Between states, so IGST"
          detail="CGST and SGST stay empty. A voucher carrying IGST and CGST together is refused by a constraint on the table itself, so it fails whether or not the form was willing to send it."
        />
        <Rule
          input={`Basic value, IGST, and ${fmtRupees(TDS)} of TDS`}
          decision={`Net ${fmtRupees(NET)}, grand total ${fmtRupees(GRAND)}`}
          detail="Both totals are generated columns. The page cannot send a total at all: it sends the parts, and the database does the addition. So the figure on screen is the figure on record."
          delay={110}
        />
        <Rule
          input="Bengaluru chapter · voucher dated 14 Aug 2026"
          decision="FI/BLR/26-27/0042 offered"
          detail="The number is yours to type, and the desk works out what the next one for that chapter and that year should be and puts it in the field. You can overwrite it. The software does not get to overrule you on your own numbering."
          delay={220}
        />

        <div
          className="mt-4 flex animate-[settle_0.7s_ease-out_backwards] items-center justify-between gap-4 rounded-xl border border-[var(--m-line)] bg-white/[0.03] px-4 py-3.5"
          style={{ animationDelay: '340ms' }}
        >
          <span className="m-eyebrow">On the voucher</span>
          <span className="m-mono text-[13px] tracking-[0.04em] text-[var(--m-gold)]">
            FI/BLR/26-27/0042
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
        <ArrowRight className="size-3 shrink-0 text-[var(--m-gold)]" aria-hidden />
        <span className="text-[12.5px] font-semibold text-[var(--m-gold)]">{decision}</span>
      </div>
      <p className="m-dim-2 mt-1.5 text-[11px] leading-relaxed">{detail}</p>
    </div>
  );
}

/* ── 03 · A person decides ───────────────────────────────────────────────── */

function DecideScene() {
  return (
    <Panel title="Approvals" meta="not the person who raised it" accent="var(--m-indigo)">
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
          <Connector />
          <Node name="Waiting" caption="Approval" state="waiting" />
        </div>

        <p
          className="m-dim-2 mt-5 flex animate-[ticker_0.5s_backwards] items-start gap-2 text-[11px] leading-relaxed"
          style={{ animationDelay: '280ms' }}
        >
          <Ban className="mt-px size-3.5 shrink-0 text-[var(--m-rose)]" aria-hidden />
          <span>
            R. Menon raised this one, so the database will not take their approval. It has to come
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
  { at: '14 Aug · 10:14', who: 'R. Menon', what: 'Submitted as FI/BLR/26-27/0042. Figures locked' },
  { at: '14 Aug · 11:40', who: 'A. Shah', what: 'Approved, and marked paid' },
] as const;

function CloseScene() {
  return (
    <Panel title="The history" meta="nothing can be edited" accent="var(--m-emerald)">
      <div className="px-5 py-5">
        <div className="flex items-center gap-3 rounded-xl border border-[color-mix(in_oklab,var(--m-emerald)_28%,transparent)] bg-[color-mix(in_oklab,var(--m-emerald)_9%,transparent)] px-4 py-3">
          <Lock className="size-4 shrink-0 text-[var(--m-emerald)]" aria-hidden />
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold">Locked on submission</p>
            <p className="m-dim-2 mt-0.5 text-[11px]">
              The amounts, the payee and the number stopped being editable the moment it was
              submitted. Sending it back is the only way to reopen one.
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
