import { Ban, Check, FileText } from 'lucide-react';
import { fmtRupees } from '@/lib/domain/voucher';

/**
 * The hero's product panel: one voucher, mid-approval.
 *
 * Deliberately not a screenshot. The amounts are run through the product's own
 * `fmtRupees`, and the ladder is the real one (A + B + C, then the deductions),
 * so this cannot quietly drift out of step with what the app actually shows.
 *
 * It also earns its space by showing the rule that is hardest to explain in
 * prose: the person who raised the voucher is blocked from approving it, and the
 * interface says so in words rather than just greying a button out.
 *
 * The number is FI/BLR/26-27/0042 for two reasons. BLR because the chapter under
 * it is Bengaluru, and the pair used to disagree: every worked example on the
 * site carried CIO, the chapter code of the single client this was built for
 * before it became multi-tenant. And 26-27 because the desk refuses any voucher
 * dated before 1 April 2026, so a 25-26 example was one a reader could not
 * reproduce even if they signed up to try.
 */

const BASIC = 184_000;
const IGST = 33_120;
const NET = BASIC + IGST;
const TDS = 3_680;
const GRAND = NET - TDS;

export function VoucherPanel() {
  return (
    <div className="relative">
      {/* The card sits in light rather than glow: a faint cool bloom, and one
          lit edge along the top. */}
      <div
        aria-hidden
        className="absolute -inset-8 rounded-3xl opacity-50 blur-3xl"
        style={{
          background:
            'radial-gradient(60% 60% at 30% 20%, var(--m-indigo), transparent 70%)',
        }}
      />

      <div className="m-card relative overflow-hidden rounded-2xl">
        {/*
          The lit edge. Brightest at the middle and gone by both corners, so it
          reads as light landing on the card rather than as a stripe drawn on
          it. This is what separates the panel from its ground now that the
          blurred bloom behind it has been pulled back to a whisper.
        */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-10 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, var(--m-gold), transparent)',
            opacity: 0.55,
          }}
        />

        {/*
          ── Card head ──

          Stacked below sm, a row above it. In one row at 375px the status pill
          took enough of the width to truncate the voucher number to
          "FI/BLR/26-2…", which is the one string on the card that identifies
          what you are looking at. The pill can afford to drop to its own line.
        */}
        <div className="flex flex-col gap-3 border-b border-[var(--m-line)] px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-lg"
              style={{ background: 'color-mix(in oklab, var(--m-indigo) 22%, transparent)' }}
            >
              <FileText className="size-4 text-[var(--m-indigo)]" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="m-mono truncate text-[12px] tracking-[0.06em]">FI/BLR/26-27/0042</p>
              <p className="m-dim-2 mt-0.5 text-[11px]">Bengaluru Chapter · Annual Summit</p>
            </div>
          </div>
          <span className="m-mono self-start shrink-0 rounded-full border border-[color-mix(in_oklab,var(--m-amber)_32%,transparent)] bg-[color-mix(in_oklab,var(--m-amber)_10%,transparent)] px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase text-[var(--m-amber)] sm:ml-auto sm:self-auto">
            Awaiting approval
          </span>
        </div>

        {/* ── Amount ladder ── */}
        <div className="space-y-2.5 px-5 py-5">
          <Row label="Basic value (A)" value={fmtRupees(BASIC)} />
          <Row label="IGST (B)" value={fmtRupees(IGST)} />
          <Row label="Net total (A + B + C)" value={fmtRupees(NET)} />
          <Row label="(−) TDS 194C" value={`− ${fmtRupees(TDS)}`} muted />

          <div className="mt-3 flex items-end justify-between border-t border-[var(--m-line)] pt-4">
            <span className="m-eyebrow">Grand total</span>
            <span className="m-display numeric text-2xl tracking-tight">{fmtRupees(GRAND)}</span>
          </div>
        </div>

        {/* ── Approval rail ── */}
        <div className="border-t border-[var(--m-line)] bg-white/[0.02] px-5 py-5">
          <div className="flex items-center gap-2">
            <Node name="R. Menon" caption="Raised" state="done" />
            <Connector />
            <Node name="Waiting" caption="Approval" state="waiting" />
          </div>

          {/* The rule, stated rather than implied. */}
          <p className="m-dim-2 mt-4 flex items-start gap-2 text-[11px] leading-relaxed">
            <Ban className="mt-px size-3.5 shrink-0 text-[var(--m-rose)]" aria-hidden />
            <span>
              R. Menon raised this voucher, so the database will not take their approval too. It
              has to come from somebody else.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={muted ? 'm-dim-2 text-[13px]' : 'm-dim text-[13px]'}>{label}</span>
      <span className="numeric text-[13px] tabular-nums">{value}</span>
    </div>
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
          <span className="size-1.5 animate-[breathe_4.5s_ease-in-out_infinite] rounded-full bg-[var(--m-amber)]" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-medium">{name}</span>
        <span className="m-dim-2 mt-0.5 block text-[10px]">{caption}</span>
      </span>
    </div>
  );
}

/** The segment between two nodes. The unfilled one carries a travelling highlight. */
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
          className="absolute inset-y-0 w-1/3 animate-[sweep_3.2s_ease-in-out_infinite]"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--m-amber), transparent)',
          }}
        />
      )}
    </span>
  );
}
