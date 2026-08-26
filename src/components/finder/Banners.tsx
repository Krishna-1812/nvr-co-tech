'use client';

import { AlertTriangle, Filter, Undo2, X } from 'lucide-react';
import { FIELD_BY_KEY, type Entity, type PanelValues } from './filters';
import { rejectFilterKeys } from './store';

/**
 * The two strips between the filters and the results.
 *
 * They carry most of what makes this screen trustworthy, and neither is an error
 * state: one says what was asked for, the other says what was removed and why.
 */

/**
 * Settings about HOW to search rather than part of what is being asked for.
 *
 * Kept out of the chip bar because showing them as removable chips invites
 * somebody to "remove" a checkbox, which is not a thing a checkbox does.
 */
const NOT_PART_OF_THE_QUESTION = new Set(['include_similar_titles', 'company_detail']);

function readable(key: string, value: unknown): string {
  const field = FIELD_BY_KEY.get(key);
  const label = field?.label ?? key.replace(/_/g, ' ');

  if (Array.isArray(value)) {
    const list = value.map(String).filter(Boolean);
    if (list.length === 0) return '';
    const shown = list.slice(0, 3).join(', ');
    return `${label}: ${shown}${list.length > 3 ? ` +${list.length - 3}` : ''}`;
  }
  if (value === true) return label;
  const text = String(value ?? '').trim();
  return text ? `${label}: ${text}` : '';
}

/**
 * The query, said back.
 *
 * Scattered across seven fieldsets the filters could not be read at a glance,
 * which is how a search once ran with a filter its owner had forgotten was set.
 * Each chip removes exactly its own filter.
 */
export function QueryBar({
  values,
  onRemove,
}: {
  values: PanelValues;
  onRemove: (key: string) => void;
}) {
  const chips = Object.entries(values)
    .filter(([key, value]) => {
      if (NOT_PART_OF_THE_QUESTION.has(key)) return false;
      if (value === undefined || value === null || value === '' || value === false) return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    })
    .map(([key, value]) => [key, readable(key, value)] as const)
    .filter(([, text]) => Boolean(text));

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Filter className="text-subtle size-3.5 shrink-0" aria-hidden />
      {chips.map(([key, text]) => (
        <span
          key={key}
          className="surface-lit inline-flex max-w-full items-center gap-1 rounded-lg px-2 py-1 text-xs"
        >
          <span className="truncate">{text}</span>
          <button
            type="button"
            onClick={() => onRemove(key)}
            aria-label={`Remove ${text}`}
            className="text-subtle shrink-0 transition hover:text-[var(--text-c)]"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
    </div>
  );
}

/**
 * What was removed, and the control that undoes it.
 *
 * This is the product's actual argument, so it is a first-class element rather
 * than an error state. Apollo returns rows that do not satisfy the filters it
 * was given; those rows are removed rather than shown, and this says how many
 * and why.
 *
 * Each reason is a **button** that drops the filter it blames and runs the
 * search again. An explanation somebody has to act on by hand is only half of
 * one, and the filter responsible is already known.
 */
export function RejectionBanner({
  shown,
  rejected,
  labels,
  total,
  unconfirmed,
  shownEntity,
  onRelax,
}: {
  shown: number;
  rejected: Record<string, number>;
  labels: Record<string, string>;
  total: number;
  unconfirmed: number;
  /** Reads what the ROWS are, not what the panel is set to. */
  shownEntity: Entity | null;
  onRelax: (keys: readonly string[]) => void;
}) {
  const reasons = Object.entries(rejected)
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a);

  if (reasons.length === 0 && unconfirmed === 0) return null;

  return (
    <div
      className="a-ring rounded-2xl border px-3.5 py-3"
      style={{ background: 'color-mix(in oklab, var(--h-amber) 7%, var(--surface-raised))' }}
    >
      {reasons.length > 0 && (
        <>
          <p className="text-sm">
            <AlertTriangle
              className="mr-1.5 inline size-3.5 align-[-2px]"
              style={{ color: 'var(--h-amber)' }}
              aria-hidden
            />
            Showing <span className="numeric font-semibold">{shown}</span> of{' '}
            <span className="numeric font-semibold">{shown + total}</span>. Apollo returned rows
            that do not actually match, so they were removed:
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {reasons.map(([reason, n]) => {
              const keys = rejectFilterKeys(reason, shownEntity);
              const words = `${n} ${labels[reason] ?? reason}`;
              if (keys.length === 0) {
                return (
                  <span key={reason} className="surface-lit rounded-lg px-2 py-1 text-xs">
                    {words}
                  </span>
                );
              }
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => onRelax(keys)}
                  title="Drop this filter and search again"
                  className="surface-lit inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition hover:border-[var(--border-strong)]"
                >
                  <Undo2 className="size-3" aria-hidden />
                  {words}
                </button>
              );
            })}
          </div>
        </>
      )}

      {unconfirmed > 0 && (
        /*
          Not a rejection: these rows ARE on screen. But saying so is the
          difference between "we checked all of them" and "Apollo did not give us
          enough to check some of them", and only one of those is true.
        */
        <p className="text-muted mt-2 text-xs leading-relaxed">
          <span className="numeric font-semibold">{unconfirmed}</span>{' '}
          {unconfirmed === 1 ? 'row is' : 'rows are'} shown but unconfirmed: Apollo returned no
          employer record to check them against, so they are kept and flagged rather than dropped.
        </p>
      )}
    </div>
  );
}

/** Codes Apollo would have rejected outright, named with the rule to fix them. */
export function InvalidCodes({
  codes,
}: {
  codes: Record<string, { codes: string[]; hint: string }>;
}) {
  return (
    <div
      className="a-ring rounded-2xl border px-3.5 py-3 text-sm"
      style={{ background: 'color-mix(in oklab, var(--h-rose) 7%, var(--surface-raised))' }}
    >
      {Object.entries(codes).map(([kind, { codes: bad, hint }]) => (
        <p key={kind} className="text-muted leading-relaxed">
          <span className="font-semibold text-[var(--text-c)]">
            {bad.join(', ')} {bad.length === 1 ? 'was' : 'were'} not sent.
          </span>{' '}
          {hint} The results below do not reflect that filter.
        </p>
      ))}
    </div>
  );
}
