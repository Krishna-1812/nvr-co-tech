'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Download, Inbox } from 'lucide-react';
import {
  Card,
  CardBody,
  CardTitle,
  DataTable,
  EmptyState,
  Td,
  Th,
  Thead,
  Tr,
} from '@/components/ui/primitives';
import { formatINR } from '@/lib/recon/amount';
import { formatLedgerDate } from '@/lib/recon/dates';
import type { DifferenceItem, DifferenceType, ReconResult } from '@/lib/recon/types';
import { cn } from '@/lib/utils';
import { CATEGORY_LABEL, CATEGORY_NOTE, CATEGORY_TONE, LEDGER_TONE } from './tone';

/**
 * Every line the two books had between them, and what became of it.
 *
 * Matched entries are in here as well as differences, which is the decision
 * worth defending. A table that lists only problems reads as though nothing else
 * was examined, and the question an auditor asks is not "what did you find" but
 * "what did you look at". Showing all of it, filterable, answers both.
 *
 * It opens on the differences rather than on everything, because on a real
 * month's data the matched rows outnumber the rest by twenty to one and nobody
 * needs to scroll past them to reach the work.
 */

type Filter = DifferenceType | 'ALL' | 'DIFFERENCES';

export function DifferenceTable({ result }: { result: ReconResult }) {
  const [filter, setFilter] = useState<Filter>('DIFFERENCES');

  const all = useMemo(
    () => [...result.differences, ...result.matched],
    [result.differences, result.matched],
  );

  const rows = useMemo(() => {
    if (filter === 'ALL') return all;
    if (filter === 'DIFFERENCES') return result.differences;
    return all.filter((item) => item.category === filter);
  }, [all, filter, result.differences]);

  const chips: { id: Filter; label: string; count: number; tone?: string; note: string }[] = [
    {
      id: 'DIFFERENCES',
      label: 'Needs a look',
      count: result.differences.length,
      note: 'Everything that is not a clean match.',
    },
    { id: 'ALL', label: 'Everything', count: all.length, note: 'Every line, matched or not.' },
    ...(['MATCHED', 'TIMING', 'ONE_SIDED', 'AMOUNT_DIFF'] as const).map((category) => ({
      id: category as Filter,
      label: CATEGORY_LABEL[category],
      count: result.counts[category],
      tone: CATEGORY_TONE[category],
      note: CATEGORY_NOTE[category],
    })),
  ];

  return (
    <Card>
      <CardTitle
        icon={<Inbox className="size-4" />}
        title="Line by line"
        description={`${all.length} ${all.length === 1 ? 'line' : 'lines'} across both books, and what happened to each.`}
        action={
          <button
            type="button"
            onClick={() => downloadCsv(rows, result)}
            disabled={rows.length === 0}
            title="Download what is shown, as a CSV"
            className="text-subtle inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition hover:border-[var(--border-strong)] hover:text-[var(--text-c)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="size-3.5" aria-hidden />
            CSV
          </button>
        }
      />

      <CardBody className="px-0 py-0">
        <div className="scroll-x-hint flex gap-1.5 overflow-x-auto border-b px-5 py-3">
          {chips.map((chip) => {
            const active = filter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                title={chip.note}
                onClick={() => setFilter(chip.id)}
                style={{ '--tone': chip.tone ?? 'var(--color-brand-600)' } as CSSProperties}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition',
                  active
                    ? 'tinted border-[var(--tone)]'
                    : 'text-muted surface hover:border-[var(--border-strong)]',
                )}
              >
                {chip.tone && (
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full"
                    style={{ background: chip.tone }}
                  />
                )}
                {chip.label}
                <span className="numeric opacity-60">{chip.count}</span>
              </button>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-6" />}
            title="Nothing in this category"
            description={
              filter === 'DIFFERENCES'
                ? 'Every line in both books matched. That is the best outcome this screen has.'
                : 'Try another filter.'
            }
          />
        ) : (
          <DataTable className="min-w-[52rem]">
            <Thead>
              <tr>
                <Th>Type</Th>
                <Th>Particular</Th>
                <Th align="right">
                  <LedgerHead ledger="A" name={result.summaryA.name} />
                </Th>
                <Th align="right">
                  <LedgerHead ledger="B" name={result.summaryB.name} />
                </Th>
                <Th align="right">Difference</Th>
                <Th>What it is</Th>
              </tr>
            </Thead>
            <tbody className="divide-y">
              {rows.map((item, i) => (
                <Row key={`${item.category}-${item.particular}-${i}`} item={item} />
              ))}
            </tbody>
          </DataTable>
        )}
      </CardBody>
    </Card>
  );
}

function LedgerHead({ ledger, name }: { ledger: 'A' | 'B'; name: string }) {
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ background: LEDGER_TONE[ledger] }}
      />
      <span className="max-w-32 truncate">{name}</span>
    </span>
  );
}

function Row({ item }: { item: DifferenceItem }) {
  const tone = CATEGORY_TONE[item.category];

  return (
    <Tr>
      <Td>
        <span
          style={{ '--tone': tone } as CSSProperties}
          className="tinted inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
        >
          <span aria-hidden className="size-1.5 rounded-full bg-[var(--tone)]" />
          {CATEGORY_LABEL[item.category]}
        </span>
      </Td>

      <Td className="max-w-[18rem]">
        <span className="block truncate font-medium" title={item.particular}>
          {item.particular}
        </span>
        {/*
          Both dates only where there are two of them and they disagree, which
          is what makes a timing difference obvious without opening either file.
          A one-sided entry exists in one book, so it gets one date and no arrow
          pointing at a dash.
        */}
        <RowDates a={item.ledgerADate} b={item.ledgerBDate} />
      </Td>

      <Td align="right" className="numeric whitespace-nowrap">
        {item.ledgerAAmount !== null ? formatINR(item.ledgerAAmount) : <Absent />}
      </Td>
      <Td align="right" className="numeric whitespace-nowrap">
        {item.ledgerBAmount !== null ? formatINR(item.ledgerBAmount) : <Absent />}
      </Td>

      <Td align="right" className="numeric whitespace-nowrap">
        {item.difference != null ? (
          <>
            <span className="font-semibold">{formatINR(item.difference)}</span>
            {item.differenceClass && item.differenceClass !== 'None' && (
              <span
                className="text-subtle ml-1.5 text-[11px] font-normal"
                title="A guess at the cause, from the shape of the two figures"
              >
                {item.differenceClass.toLowerCase()}?
              </span>
            )}
          </>
        ) : (
          <Absent />
        )}
      </Td>

      <Td className="text-muted max-w-[22rem] text-xs leading-relaxed text-pretty">{item.note}</Td>
    </Tr>
  );
}

function RowDates({ a, b }: { a: string | null; b: string | null }) {
  if (!a && !b) return null;

  const both = a && b && a !== b;
  return (
    <span className="text-subtle mt-0.5 block text-[11px] whitespace-nowrap">
      {both ? (
        <>
          {formatLedgerDate(a)} <span aria-label="then">→</span> {formatLedgerDate(b)}
        </>
      ) : (
        formatLedgerDate(a ?? b)
      )}
    </span>
  );
}

/** Hatched rather than blank: this book does not have the line at all. */
function Absent() {
  return (
    <span
      aria-label="not in this ledger"
      className="a-hatch text-subtle inline-block w-8 rounded border text-center align-middle"
    >
      &nbsp;
    </span>
  );
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Whatever is on screen, as a spreadsheet.
 *
 * Raw numbers and ISO dates rather than the formatted ₹ figures, because this is
 * going into a spreadsheet to be sorted and totalled, not read. The filter is
 * respected: exporting everything when the screen shows the twelve rows you
 * filtered down to would be exporting something you did not ask for.
 */
function downloadCsv(rows: DifferenceItem[], result: ReconResult) {
  const header = [
    'Type',
    'Particular',
    `${result.summaryA.name} amount`,
    `${result.summaryA.name} date`,
    `${result.summaryB.name} amount`,
    `${result.summaryB.name} date`,
    'Difference',
    'Likely cause',
    'Note',
  ];

  const body = rows.map((item) =>
    [
      CATEGORY_LABEL[item.category],
      item.particular,
      item.ledgerAAmount ?? '',
      item.ledgerADate ?? '',
      item.ledgerBAmount ?? '',
      item.ledgerBDate ?? '',
      item.difference ?? '',
      item.differenceClass && item.differenceClass !== 'None' ? item.differenceClass : '',
      item.note,
    ]
      .map(csvCell)
      .join(','),
  );

  // The byte order mark is what makes Excel read this as UTF-8, without which
  // every ₹ and every accented payee name arrives as mojibake.
  const blob = new Blob(['﻿', [header.join(','), ...body].join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reconciliation-${result.reconciliationDate}-lines.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
