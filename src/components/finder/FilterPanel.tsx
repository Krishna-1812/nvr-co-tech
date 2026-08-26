'use client';

import { useState } from 'react';
import { ChevronDown, Info, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Combobox } from './Combobox';
import { advancedCount, groupsFor, type Entity, type Field, type PanelValues } from './filters';

/**
 * The filter panel, rendered from the table rather than written out.
 *
 * Every control that Apollo treats differently from how it reads carries a note
 * saying so, right on the control. That is deliberate and it is most of what
 * makes this panel trustworthy: a person setting an industry filter should not
 * have to already know that Apollo has no industry filter.
 */

function Note({ text }: { text: string }) {
  return (
    <span className="group/note relative inline-flex">
      <Info className="text-subtle size-3.5 cursor-help" aria-hidden />
      <span className="sr-only">{text}</span>
      <span
        role="tooltip"
        className="a-ring elev-4 pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-64 -translate-x-1/2 rounded-lg border bg-[var(--surface-raised)] px-2.5 py-2 text-xs leading-relaxed opacity-0 transition group-hover/note:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

function Control({
  field,
  values,
  set,
}: {
  field: Field;
  values: PanelValues;
  set: (key: string, value: unknown) => void;
}) {
  const value = values[field.key];

  if (field.kind === 'combo') {
    return (
      <Combobox
        vocab={field.vocab ?? 'industry'}
        label={field.label}
        placeholder={field.placeholder ?? field.label}
        values={Array.isArray(value) ? (value as string[]) : []}
        onChange={(next) => set(field.key, next)}
      />
    );
  }

  if (field.kind === 'chips') {
    const on = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-wrap gap-1" role="group" aria-label={field.label}>
        {(field.options ?? []).map(([v, label]) => {
          const active = on.includes(v);
          return (
            <button
              key={v}
              type="button"
              aria-pressed={active}
              onClick={() => set(field.key, active ? on.filter((x) => x !== v) : [...on, v])}
              className={cn(
                'rounded-md border px-2 py-1 text-xs font-medium transition',
                active
                  ? 'gradient-brand border-transparent text-white shadow-[inset_0_1px_0_oklch(1_0_0_/_0.22)]'
                  : 'surface-sunken text-muted hover:text-[var(--text-c)]',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  if (field.kind === 'check') {
    return (
      <label className="text-muted flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => set(field.key, e.target.checked)}
          className="size-4 accent-[var(--color-brand-600)]"
        />
        {field.label}
      </label>
    );
  }

  if (field.kind === 'select') {
    return (
      <select
        aria-label={field.label}
        value={String(value ?? '')}
        onChange={(e) => set(field.key, e.target.value)}
        className="min-w-0 flex-1 rounded-lg border bg-[var(--surface-raised)] px-2.5 py-2 text-base shadow-[var(--elev-1)] transition hover:border-[var(--border-strong)] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 lg:text-sm"
      >
        {(field.options ?? []).map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    );
  }

  const isCsv = field.kind === 'csv';
  return (
    <input
      type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'}
      aria-label={field.label}
      placeholder={field.placeholder ?? field.label}
      value={isCsv && Array.isArray(value) ? (value as string[]).join(', ') : String(value ?? '')}
      onChange={(e) => set(field.key, e.target.value)}
      className={cn(
        'min-w-0 rounded-lg border bg-[var(--surface-raised)] px-2.5 py-2 text-base shadow-[var(--elev-1)] transition lg:text-sm',
        'placeholder:text-[var(--text-subtle)] hover:border-[var(--border-strong)]',
        'focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15',
        field.kind === 'number' || field.kind === 'date' ? 'w-full' : 'flex-1',
      )}
    />
  );
}

/** Consecutive `pair: start` / `pair: end` fields render as one range row. */
function rows(fields: readonly Field[]): Field[][] {
  const out: Field[][] = [];
  for (let i = 0; i < fields.length; i += 1) {
    const f = fields[i];
    if (f.pair === 'start' && fields[i + 1]?.pair === 'end') {
      out.push([f, fields[i + 1]]);
      i += 1;
    } else {
      out.push([f]);
    }
  }
  return out;
}

function Fieldset({
  title,
  fields,
  values,
  set,
}: {
  title: string;
  fields: readonly Field[];
  values: PanelValues;
  set: (key: string, value: unknown) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="a-label px-0.5">{title}</p>
      {rows(fields).map((row) => (
        <div key={row.map((f) => f.key).join('|')} className="flex flex-wrap items-center gap-2">
          {row.map((field, i) => (
            <div
              key={field.key}
              className={cn(
                'flex min-w-0 items-center gap-1.5',
                field.kind === 'chips' || field.kind === 'check' ? 'w-full' : 'flex-1',
              )}
            >
              {i === 1 && <span className="text-subtle -ml-1 text-xs">to</span>}
              <Control field={field} values={values} set={set} />
              {field.note && <Note text={field.note} />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function FilterPanel({
  entity,
  values,
  set,
  onClear,
  onSearch,
  loading,
  count,
  counting,
}: {
  entity: Entity;
  values: PanelValues;
  set: (key: string, value: unknown) => void;
  onClear: () => void;
  onSearch: () => void;
  loading: boolean;
  count: { value: number | null; approx: boolean; reason?: string } | null;
  counting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const groups = groupsFor(entity);
  const advanced = advancedCount(entity, values);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
        {groups
          .filter((g) => !g.advanced)
          .map((g) => (
            <Fieldset key={g.title} title={g.title} fields={g.fields} values={values} set={set} />
          ))}

        <div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="text-muted flex w-full items-center gap-2 rounded-lg border border-dashed px-2.5 py-2 text-sm transition hover:border-[var(--border-strong)] hover:text-[var(--text-c)]"
          >
            <ChevronDown className={cn('size-4 transition', open && 'rotate-180')} aria-hidden />
            More filters
            {/*
              The chip bar shows WHICH filters are set; this shows THAT some are,
              even when the panel is shut and the bar is scrolled past. Without
              it the long tail is invisible: a revenue floor set last week is
              still narrowing today's search with nothing on screen to say so.
            */}
            {advanced > 0 && (
              <span className="gradient-brand ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {advanced}
              </span>
            )}
          </button>

          {open && (
            <div className="mt-3 space-y-4 border-l-2 pl-3">
              {groups
                .filter((g) => g.advanced)
                .map((g) => (
                  <Fieldset
                    key={g.title}
                    title={g.title}
                    fields={g.fields}
                    values={values}
                    set={set}
                  />
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 shrink-0 space-y-2 border-t pt-3">
        {entity === 'people' && (
          /*
            Sits beside Search rather than among the filters, because it does not
            change WHO comes back, only how much is known about them — and
            because it is the one control here that decides whether a click
            spends anything.
          */
          <label className="text-muted flex cursor-pointer items-start gap-2 text-xs leading-relaxed">
            <input
              type="checkbox"
              checked={values.company_detail !== false}
              onChange={(e) => set('company_detail', e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand-600)]"
            />
            <span>
              Describe each employer
              <span className="text-subtle">
                {' '}
                · up to 1 credit per page, whatever the number of companies on it, cached 30 days
              </span>
            </span>
          </label>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="text-muted rounded-lg border px-2.5 py-2 text-sm transition hover:border-[var(--border-strong)] hover:text-[var(--text-c)]"
          >
            <X className="size-4" aria-hidden />
            <span className="sr-only">Clear filters</span>
          </button>

          <span className="numeric text-subtle min-w-0 flex-1 truncate text-xs" aria-live="polite">
            {counting && 'counting…'}
            {!counting && count?.value != null && (
              <>
                {/*
                  "about" whenever a re-checked filter is set: Apollo's count is
                  what IT matched, and the page will show this many or fewer.
                  Saying "2,400 matches" when 300 will appear is exactly the
                  claim this tool exists not to make.
                */}
                {count.approx ? 'about ' : ''}
                <span className="font-semibold text-[var(--text-c)]">
                  {count.value.toLocaleString('en-IN')}
                </span>
                {count.approx ? ' or fewer' : ' matches'}
              </>
            )}
            {!counting && count?.value == null && count?.reason && count.reason}
          </span>

          <button
            type="button"
            onClick={onSearch}
            disabled={loading}
            className="gradient-brand elev-brand inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            <Search className="size-4" aria-hidden />
            {loading ? 'Searching…' : 'Search'}
            {entity === 'companies' && (
              <span className="text-[10px] font-normal opacity-80">· 1 credit</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
