'use client';

import type { CSSProperties } from 'react';
import { Scale } from 'lucide-react';
import { Card, CardBody, CardTitle } from '@/components/ui/primitives';
import { formatINR } from '@/lib/recon/amount';
import { formatLedgerDate } from '@/lib/recon/dates';
import type { Statement as StatementData, StatementLine } from '@/lib/recon/types';
import { cn } from '@/lib/utils';
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
                <td className="text-muted px-5 py-2.5 text-[13px]">
                  {statement.otherLedgerName}, as that file states it
                </td>
                <td className="text-muted numeric px-5 py-2.5 text-right text-[13px]">
                  {formatINR(statement.targetClosing)}
                  <span className="text-subtle ml-1">{statement.targetClosingType}</span>
                </td>
              </tr>
            )}
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
      <td className={cn('px-5', emphasis ? 'py-4' : 'py-3.5')}>
        <span className="flex items-center gap-2.5">
          <span aria-hidden className="h-4 w-[3px] shrink-0 rounded-full bg-[var(--tone)]" />
          <span className="font-semibold text-pretty">{label}</span>
        </span>
      </td>
      <td
        className={cn(
          'amount px-5 text-right font-semibold whitespace-nowrap',
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

  return (
    <>
      <tr>
        <td colSpan={2} className="a-label px-5 pt-4 pb-1.5">
          {label}
        </td>
      </tr>

      {lines.length === 0 ? (
        <tr>
          <td colSpan={2} className="text-subtle px-5 py-1.5 pl-9 text-[13px] italic">
            {empty}
          </td>
        </tr>
      ) : (
        lines.map((line, i) => (
          <tr key={i} className="border-b border-dashed last:border-0">
            <td className="text-muted py-2.5 pr-4 pl-9 text-[13px] leading-relaxed text-pretty">
              {line.description}
            </td>
            <td
              className={cn(
                'numeric px-5 py-2.5 text-right text-[13px] font-medium whitespace-nowrap',
                isAdd
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400',
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
