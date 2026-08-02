import { AlertTriangle, Check, Paperclip, X } from 'lucide-react';
import { STEPS } from '@/lib/marketing/content';
import { fmtRupees } from '@/lib/domain/voucher';
import { Container, Section, SectionHeading } from '../bits';
import { Reveal } from '../Reveal';

/**
 * The four steps, then the moment they all lead to.
 *
 * The panel underneath is the honest centre of the pitch: the agents do not
 * decide anything. They compress a voucher into the one question a human has to
 * answer, attach what is needed to answer it, and stop.
 */
export function HowItWorks() {
  return (
    <Section id="how">
      <Container wide>
        <SectionHeading
          eyebrow="How it works"
          title={
            <>
              Automate the rules.
              <br />
              <span className="m-serif m-dim">Escalate the judgement.</span>
            </>
          }
          lead="Most finance work is not a decision. It is a rule someone has to remember to apply, on a deadline, without a mistake. That part is the agent's. The part that needs a person is handed over intact."
        />

        {/* ── The steps ── */}
        <ol className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-[var(--m-line)] bg-[var(--m-line)] sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <Reveal
              as="li"
              key={step.n}
              delay={i * 80}
              className="group relative bg-[var(--m-bg)] p-7 transition-colors hover:bg-white/[0.025]"
            >
              <span
                className="m-display block text-[2.6rem] leading-none opacity-25 transition-opacity group-hover:opacity-60"
                style={{ backgroundImage: 'var(--m-grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
              >
                {step.n}
              </span>
              <h3 className="mt-5 text-[15px] font-semibold">{step.title}</h3>
              <p className="m-dim mt-2.5 text-[13px] leading-relaxed">{step.body}</p>
            </Reveal>
          ))}
        </ol>

        {/* ── What an approver actually sees ── */}
        <Reveal delay={120} className="mt-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-center">
            <div>
              <p className="m-eyebrow">Step three, in full</p>
              <h3 className="m-display mt-4 text-[clamp(1.5rem,3vw,2.1rem)]">
                One question, everything needed to answer it.
              </h3>
              <p className="m-dim mt-5 text-[15px] leading-relaxed">
                An approver does not open a form. They get the amount, the payee, the supporting
                document, and anything the checks flagged — then approve or send it back with a
                reason. Rejection always requires one, because a voucher returned without an
                explanation just comes back unchanged.
              </p>
            </div>

            <ApproverPanel />
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

const AMOUNT = 61_800;

function ApproverPanel() {
  return (
    <div className="m-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--m-line)] px-5 py-3.5">
        <p className="m-eyebrow">Awaiting your first approval</p>
        <span className="m-mono text-[11px] tracking-[0.06em]">NVR/CIO/25-26/0058</span>
      </div>

      <div className="px-5 py-5">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">Lumina Events Pvt Ltd</p>
            <p className="m-dim-2 mt-1 text-[12px]">
              Venue and AV · Hyderabad Chapter · raised by S. Iyer, 2 days ago
            </p>
          </div>
          <p className="m-display numeric shrink-0 text-2xl tracking-tight">{fmtRupees(AMOUNT)}</p>
        </div>

        <div className="mt-5 space-y-2">
          <Flag tone="ok" icon={Paperclip}>
            Tax invoice attached · GSTIN validated against PAN
          </Flag>
          <Flag tone="warn" icon={AlertTriangle}>
            TDS not deducted. Section 194C applies above ₹30,000 — expected ₹1,236.
          </Flag>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-[13px] font-semibold text-white"
            style={{ background: 'color-mix(in oklab, var(--m-emerald) 82%, black)' }}
          >
            <Check className="size-4" aria-hidden />
            Approve
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="m-dim inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--m-line-2)] text-[13px] font-semibold"
          >
            <X className="size-4" aria-hidden />
            Send back
          </button>
        </div>

        <p className="m-dim-2 mt-3 text-center text-[11px]">
          Sending back requires a reason. It is recorded against the voucher.
        </p>
      </div>
    </div>
  );
}

function Flag({
  tone,
  icon: Icon,
  children,
}: {
  tone: 'ok' | 'warn';
  icon: typeof Check;
  children: React.ReactNode;
}) {
  const color = tone === 'ok' ? 'var(--m-emerald)' : 'var(--m-amber)';
  return (
    <p
      className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[12px] leading-relaxed"
      style={{
        borderColor: `color-mix(in oklab, ${color} 26%, transparent)`,
        background: `color-mix(in oklab, ${color} 8%, transparent)`,
      }}
    >
      <Icon className="mt-px size-3.5 shrink-0" style={{ color }} aria-hidden />
      <span className="m-dim">{children}</span>
    </p>
  );
}
