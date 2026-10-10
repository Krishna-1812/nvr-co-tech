'use client';

import { ArrowLeft, ArrowRight, Columns3, Info, Lock } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Field,
  Input,
  Select,
} from '@/components/ui/primitives';
import {
  FIELDS,
  FIELD_EFFECT,
  FIELD_LABEL,
  REQUIRED_FIELDS,
  type Field as ColumnField,
} from '@/lib/recon/parse/columns';
import type { LedgerKey } from '@/lib/recon/types';
import { cn } from '@/lib/utils';
import { LEDGER_TONE } from './tone';

/**
 * Step two: what each column is.
 *
 * The step nobody expects, and the one that makes the tool work on real files.
 * The two ledgers are written by two different systems and almost never agree on
 * what to call anything — one says Particular and the other Narration, one says
 * Debit and the other Withdrawal, one says Voucher No and the other Reference No.
 * Guessing gets most of it right; this screen is where the reader confirms the
 * guess and fixes the rest.
 *
 * It is deliberately not the design the original tool used, which asked you to
 * LINK a column in one file to a column in the other and then inferred what the
 * pair meant from the two names. That is two steps of indirection to express one
 * fact. Here each column simply says what it is, on its own, and two columns
 * that both say "Reference" are matched on for that reason and no other.
 */

export type ColumnPanel = {
  key: LedgerKey;
  name: string;
  headers: string[];
  headerDetected: boolean;
  mapping: Record<ColumnField, number | null>;
};

/**
 * Point one column at one field.
 *
 * Two things have to be cleared, not one: whatever this column used to be, and
 * whatever other column was already claiming this field. A field held by two
 * columns at once is not a state the parser can act on, so it is not a state the
 * screen allows.
 */
export function assignRole(
  mapping: Record<ColumnField, number | null>,
  column: number,
  field: ColumnField | null,
): Record<ColumnField, number | null> {
  const next = { ...mapping };
  for (const f of FIELDS) if (next[f] === column) next[f] = null;
  if (field) next[field] = column;
  return next;
}

/** Which fields still have nobody pointing at them. */
export function missingFields(mapping: Record<ColumnField, number | null>): ColumnField[] {
  return REQUIRED_FIELDS.filter((f) => mapping[f] === null || mapping[f] === undefined);
}

export function ColumnStep({
  panels,
  onRole,
  onName,
  onBack,
  onContinue,
  error,
}: {
  panels: ColumnPanel[];
  onRole: (key: LedgerKey, column: number, field: ColumnField | null) => void;
  onName: (key: LedgerKey, name: string) => void;
  onBack: () => void;
  onContinue: () => void;
  error: string | null;
}) {
  const blocked = panels.some((p) => p.headerDetected && missingFields(p.mapping).length > 0);

  return (
    <Card>
      <CardTitle
        icon={<Columns3 className="size-4" />}
        title="What each column is"
        description="Read from the headers. Change anything that was guessed wrongly, and give the two files the same names where they mean the same thing."
      />

      <CardBody className="space-y-5 py-5 sm:py-6">
        <div className="grid gap-4 lg:grid-cols-2">
          {panels.map((panel) => (
            <LedgerColumns
              key={panel.key}
              panel={panel}
              onRole={(column, field) => onRole(panel.key, column, field)}
              onName={(name) => onName(panel.key, name)}
            />
          ))}
        </div>

        <p className="text-subtle flex items-start gap-2 text-xs leading-relaxed text-pretty">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            The four in bold are needed. Everything else changes the answer only if both files have
            it: a Reference on both sides becomes the strongest match there is, a Clearing date
            decides timing in place of the posting date, and a line marked reversed is left out
            altogether.
          </span>
        </p>

        {error && (
          <p
            role="alert"
            className="text-sm font-medium text-[color-mix(in_oklab,var(--status-rejected)_82%,var(--text-c))]"
          >
            {error}
          </p>
        )}

        <div className="surface-sunken flex items-center justify-between gap-3 rounded-2xl border p-3">
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Button>
          <Button variant="primary" onClick={onContinue} disabled={blocked}>
            Continue
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function LedgerColumns({
  panel,
  onRole,
  onName,
}: {
  panel: ColumnPanel;
  onRole: (column: number, field: ColumnField | null) => void;
  onName: (name: string) => void;
}) {
  const tone = LEDGER_TONE[panel.key];
  const missing = missingFields(panel.mapping);

  /** The field this column is currently standing for, if any. */
  const roleOf = (column: number): ColumnField | '' =>
    FIELDS.find((f) => panel.mapping[f] === column) ?? '';

  return (
    <div
      className="surface-sunken relative min-w-0 overflow-hidden rounded-2xl border"
      style={{ '--tone': tone } as React.CSSProperties}
    >
      {/* The ledger's colour, as light along the top edge, as on step one. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${tone}, transparent)` }}
      />
      <div className="surface-lit border-b px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="tinted grid size-9 shrink-0 place-items-center rounded-xl border text-sm font-bold"
          >
            {panel.key}
          </span>
          <div className="min-w-0">
            <p className="a-label" style={{ color: tone }}>
              Ledger {panel.key}
            </p>
            {panel.headerDetected && (
              <p className="text-subtle mt-0.5 text-xs">
                {panel.headers.length} {panel.headers.length === 1 ? 'column' : 'columns'}
                {missing.length === 0
                  ? ', all four needed ones found'
                  : `, ${missing.length} needed ${missing.length === 1 ? 'one' : 'ones'} still to assign`}
              </p>
            )}
          </div>
        </div>
        {/*
          The name is an input, not a caption. It is what the statement calls this
          book on every line of the output — "Balance as per Company books" reads
          as a reconciliation and "Balance as per Ledger A" reads as a test file.
        */}
        <div className="mt-3.5">
          <Field label="Name on the statement" htmlFor={`name-${panel.key}`}>
            <Input
              id={`name-${panel.key}`}
              value={panel.name}
              onChange={(e) => onName(e.target.value)}
              maxLength={60}
              placeholder={`Ledger ${panel.key}`}
            />
          </Field>
        </div>
      </div>

      {!panel.headerDetected ? (
        <p className="text-muted px-4 py-5 text-sm leading-relaxed text-pretty">
          No header row was found in this file, so the columns are being read by position: date,
          description, debit, credit. There is nothing to change here.
        </p>
      ) : (
        <>
          <ul className="divide-y">
            {panel.headers.map((header, column) => {
              const role = roleOf(column);
              const required = role !== '' && (REQUIRED_FIELDS as readonly string[]).includes(role);

              return (
                <li key={column} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium">
                      {/* Lit in the ledger's colour once the column stands for something. */}
                      <span
                        aria-hidden
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: role === '' ? 'var(--border-strong)' : tone }}
                      />
                      <span className="truncate">{header || `Column ${column + 1}`}</span>
                    </span>
                    {role !== '' && (
                      <span className="text-subtle mt-0.5 block truncate pl-3.5 text-[11px]">
                        {FIELD_EFFECT[role]}
                      </span>
                    )}
                  </span>

                  <Select
                    aria-label={`What ${header || `column ${column + 1}`} is`}
                    value={role}
                    onChange={(e) =>
                      onRole(column, e.target.value === '' ? null : (e.target.value as ColumnField))
                    }
                    className={cn(
                      // text-base while the dock is showing, or iOS zooms the page
                      // in when the picker opens and leaves it there.
                      'w-40 shrink-0 py-2.5 text-base lg:py-1.5 lg:text-[13px]',
                      required && 'font-semibold',
                      role === '' && 'text-[var(--text-subtle)]',
                    )}
                  >
                    <option value="">Not used</option>
                    {FIELDS.map((field) => (
                      <option key={field} value={field}>
                        {FIELD_LABEL[field]}
                        {(REQUIRED_FIELDS as readonly string[]).includes(field) ? ' *' : ''}
                      </option>
                    ))}
                  </Select>
                </li>
              );
            })}
          </ul>

          <p
            className={cn(
              'flex items-start gap-2 border-t px-4 py-3 text-xs sm:px-5',
              missing.length
                ? 'font-medium text-[color-mix(in_oklab,var(--status-rejected)_82%,var(--text-c))]'
                : 'text-subtle',
            )}
          >
            <Lock className="mt-px size-3.5 shrink-0" aria-hidden />
            {missing.length === 0
              ? 'All four required columns are accounted for.'
              : `Still needed: ${missing.map((f) => FIELD_LABEL[f]).join(', ')}.`}
          </p>
        </>
      )}
    </div>
  );
}
