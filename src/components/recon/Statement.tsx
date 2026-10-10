'use client';

import type { CSSProperties } from 'react';
import { Check, Scale, TriangleAlert } from 'lucide-react';
import { Card, CardBody, CardTitle } from '@/components/ui/primitives';
import { formatINR } from '@/lib/recon/amount';
import { formatLedgerDate } from '@/lib/recon/dates';
import type { Statement as StatementData, StatementLine } from '@/lib/recon/types';
import { cn } from '@/lib/utils';
import { RECON_TONE } from './ReconBadge';
import { LEDGER_TONE } from './tone';

/**
 * The reconciliation statement.
 *
 * The centrepiece, and deliberately the most conservative thing on the screen.
 * Everywhere else this tool can be a product; here it has to be a document,
 * because this is the part that gets printed, attached to a file and shown to an
 * auditor. So it is the textbook shape — a balance, an Add block, a Less block,
 * the balance you arrive at — with no chrome that would look out of place beside
 * a working paper.
 *
 * The one liberty taken is colour on the amounts: additions read one way and
 * deductions the other, which is the only thing a person scanning forty
 * reconciling items actually needs to see at a glance.
 */
export function Statement({ statement }: { statement: StatementData }) {
  const adds = statement.lines.filter((l) => l.operation === 'add');
  const deducts = statement.lines.filter((l) => l.operation === 'less');
  const settled = Math.abs(statement.variance) < 0.01;

  return (
    <Card className="overflow-hidden">
      <CardTitle
        icon={<Scale className="size-4" />}
        title="Reconciliation statement"
        description={
          <>
            as at {formatLedgerDate(statement.reconciliationDate)}
            {statement.toleranceDays !== null && (
              <> · {statement.toleranceDays}-day timing tolerance</>
            )}
          </>
        }
      />

      <CardBody className="px-0 py-0">
        <table className="w-full text-sm">
          <tbody>
            {/* Where it starts. */}
            <BalanceRow
              label={`Balance as per ${statement.startingLedgerName}`}
              side={statement.startingBalanceType}
              amount={statement.startingBalance}
              tone={LEDGER_TONE[statement.startingLedger]}
            />

            <Block label="Add" lines={adds} empty="Nothing to add" />
            <Block label="Less" lines={deducts} empty="Nothing to deduct" />

            {/* Where it lands. */}
            <BalanceRow
              label={`Balance as per ${statement.otherLedgerName}`}
              side={statement.targetClosingType}
              amount={statement.calculatedClosing}
              tone={LEDGER_TONE[statement.otherLedger]}
              emphasis
            />

            {/*
              Only when they disagree. Printing the stated figure beside the
              arrived-at one is what turns "there is a variance of 1,350" into
              something a person can act on, because the two numbers are then
              side by side and one of them is wrong.
            */}
            {!settled && (
              <tr className="border-t border-dashed">
                <td className="text-muted px-5 py-2.5 text-[13px] sm:px-6">
                  {statement.otherLedgerName}, as that file states it
                </td>
                <td className="text-muted px-5 py-2.5 text-right text-[13px] whitespace-nowrap tabular-nums sm:px-6">
                  {formatINR(statement.targetClosing)}
                  <span className="text-subtle ml-1">{statement.targetClosingType}</span>
                </td>
              </tr>
            )}

            {/* The line the whole statement exists to arrive at. */}
            <tr
              style={{ '--tone': RECON_TONE[statement.status] } as CSSProperties}
              className="tinted border-t"
            >
              <td className="px-5 py-3.5 sm:px-6">
                <span className="flex items-center gap-2 text-[13px] font-semibold">
                  {settled ? (
                    <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
                  ) : (
                    <TriangleAlert className="size-4 shrink-0" aria-hidden />
                  )}
                  {settled ? 'Ties out: nothing left unexplained' : 'Left unexplained'}
                </span>
              </td>
              <td className="px-5 py-3.5 text-right font-semibold whitespace-nowrap tabular-nums sm:px-6">
                {settled ? 'Nil' : formatINR(Math.abs(statement.variance))}
              </td>
            </tr>
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

function BalanceRow({
  label,
  side,
  amount,
  tone,
  emphasis,
}: {
  label: string;
  side: string;
  amount: number;
  tone: string;
  emphasis?: boolean;
}) {
  return (
    <tr
      className={cn('border-b', emphasis && 'border-t-2 border-b-0')}
      style={{ '--tone': tone } as CSSProperties}
    >
      <td className={cn('px-5 sm:px-6', emphasis ? 'py-4' : 'py-3.5')}>
        <span className="flex items-center gap-2.5">
          <span aria-hidden className="h-4 w-[3px] shrink-0 rounded-full bg-[var(--tone)]" />
          <span className="font-semibold text-pretty">{label}</span>
        </span>
      </td>
      <td
        className={cn(
          'amount px-5 text-right font-semibold whitespace-nowrap sm:px-6',
          emphasis ? 'py-4 text-lg' : 'py-3.5',
        )}
      >
        {formatINR(amount)}
        <span className="text-muted ml-1.5 text-xs font-medium">{side}</span>
      </td>
    </tr>
  );
}

function Block({
  label,
  lines,
  empty,
}: {
  label: 'Add' | 'Less';
  lines: StatementLine[];
  empty: string;
}) {
  const isAdd = label === 'Add';
  const total = Math.round(lines.reduce((sum, l) => sum + l.amount, 0) * 100) / 100;

  return (
    <>
      <tr>
        <td className="a-label px-5 pt-5 pb-1.5 sm:px-6">{label}</td>
        {/* The block's total, so the two blocks can be weighed against each
            other without adding them up by eye. */}
        <td className="text-subtle px-5 pt-5 pb-1.5 text-right text-[11.5px] whitespace-nowrap tabular-nums sm:px-6">
          {lines.length > 0 && (
            <>
              {lines.length} {lines.length === 1 ? 'item' : 'items'} ·{' '}
              <span className="font-semibold text-[var(--text-c)]">
                {isAdd ? '+' : '−'}
                {formatINR(total)}
              </span>
            </>
          )}
        </td>
      </tr>

      {lines.length === 0 ? (
        <tr>
          <td colSpan={2} className="text-subtle py-1.5 pr-5 pl-9 text-[13px] italic sm:pl-10">
            {empty}
          </td>
        </tr>
      ) : (
        lines.map((line, i) => (
          <tr key={i} className="border-b border-dashed last:border-0">
            <td className="text-muted py-2.5 pr-4 pl-9 text-[13px] leading-relaxed text-pretty sm:pl-10">
              {line.description}
            </td>
            <td
              className={cn(
                'px-5 py-2.5 text-right text-[13px] font-medium whitespace-nowrap tabular-nums sm:px-6',
                isAdd
                  ? 'text-[color-mix(in_oklab,var(--status-approved)_82%,var(--text-c))]'
                  : 'text-[color-mix(in_oklab,var(--status-rejected)_82%,var(--text-c))]',
              )}
            >
              {isAdd ? '+' : '−'}
              {formatINR(line.amount)}
            </td>
          </tr>
        ))
      )}
    </>
  );
}
