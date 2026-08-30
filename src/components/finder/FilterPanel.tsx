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
    <span className="group/note inline-flex">
      <Info className="text-subtle size-3.5 cursor-help" aria-hidden />
      <span className="sr-only">{text}</span>
      {/*
        Positioned against the whole ROW, not against this icon.

        Anchoring it to the icon cannot be made to fit. The icon sits wherever
        its control ends, the rail is about 294px wide and scrolls, and a 256px
        note is nearly the width of the rail — so centred it hung 119px off the
        right edge and right-aligned it hung 81px off the left, and either way
        half of it was clipped away. The notes are the part of this panel that
        says what Apollo really does with a filter, so a clipped one is the one
        failure this panel must not have.

        Spanning the row instead means the note is exactly as wide as the space
        there is, at every width, with no arithmetic. `Fieldset` supplies the
        `relative` these coordinates resolve against.
      */}
      <span
        role="tooltip"
        className="a-ring elev-4 pointer-events-none absolute inset-x-0 top-full z-50 mt-1.5 rounded-lg border bg-[var(--surface-raised)] px-2.5 py-2 text-xs leading-relaxed opacity-0 transition group-hover/note:opacity-100"
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
                  ? 'gradient-brand border-transparent shadow-[inset_0_1px_0_oklch(1_0_0_/_0.22)]'
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
        <div
          key={row.map((f) => f.key).join('|')}
          // `relative` so a Note in this row hangs off the row rather than off
          // its own icon. See the comment in Note for why that is the only
          // anchor that fits.
          className="relative flex flex-wrap items-center gap-2"
        >
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
  showFields = true,
  wide = false,
}: {
  entity: Entity;
  values: PanelValues;
  set: (key: string, value: unknown) => void;
  onClear: () => void;
  onSearch: () => void;
  loading: boolean;
  count: { value: number | null; approx: boolean; reason?: string } | null;
  counting: boolean;
  /**
   * Whether the fields have been opened on a narrow screen.
   *
   * False only hides them **below** the width where the rail becomes a column
   * of its own; at `xl` and above they are always shown, because there the rail
   * sits beside the results rather than on top of them and a collapse would be
   * a click for nothing.
   *
   * The **footer** is deliberately outside this: it holds the count and the
   * Search button, and a collapsed panel with no way to search from it is a
   * panel somebody has to open only in order to close again.
   */
  showFields?: boolean;
  /**
   * Whether the panel has the whole screen rather than a 26rem rail.
   *
   * True before the first search, when there are no results to sit beside and
   * the rail spans the results column too. In a rail there is only ever room
   * for one column of controls, and forty of them in one column is a scroll
   * bar between somebody and half their own filters — the long tail of the
   * panel is invisible, so it goes unused. Given the width, the same fields
   * lay out in three or four columns and the whole panel is on screen at once,
   * which is the difference between filters you can browse and filters you
   * have to remember are there.
   */
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const groups = groupsFor(entity);
  const advanced = advancedCount(entity, values);

  /*
   * One column in a rail, two or three across a page.
   *
   * Container queries rather than viewport ones, because the viewport is not
   * what decides this. The panel is the full width at `xl` and three fifths of
   * it at `2xl`, where the conversation takes the rest — so the same 1536px
   * screen wants three columns in one state and two in the other, and a
   * `lg:grid-cols-3` cannot tell those apart. `@container` asks the panel how
   * wide it actually is, which is the only question that matters here.
   *
   * The thresholds are set by the controls, not by the grid: a track under
   * about 280px puts a "50 to 100" range pair back in the squeeze the 26rem
   * rail had, and the point of the wide layout is to stop cramping them.
   *
   * `items-start` matters: without it every group in a row stretches to the
   * tallest one, and a two-field group beside Location & company size gets
   * fifteen dead pixels under its last control.
   */
  const layout = wide
    ? 'grid items-start gap-x-5 gap-y-4 @xl:grid-cols-2 @4xl:grid-cols-3'
    : 'space-y-4';

  return (
    // `flex-1`: this is a direct flex child of the `aside` in Workspace, which
    // is a fixed height from `xl` up. Without it the panel sizes to its own
    // content and the leftover height sits as dead space below the footer
    // instead of going to the one region here built to use it — the fields.
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          // `@container` so the fieldsets below can lay themselves out against
          // this element's width rather than the window's. See `layout`.
          '@container min-h-0 pr-0.5',
          // Scrolls only when it has to. In a rail it always has to; across the
          // page it does not, and an inner scroll region there would be a second
          // scroll bar over content that already fits.
          wide ? 'space-y-4' : 'flex-1 space-y-4 overflow-y-auto',
          // `hidden` rather than a height of zero: a control nobody can see must
          // not still be reachable by keyboard.
          !showFields && 'hidden xl:block',
        )}
      >
        <div className={layout}>
          {groups
            .filter((g) => !g.advanced)
            .map((g) => (
              <Fieldset key={g.title} title={g.title} fields={g.fields} values={values} set={set} />
            ))}
        </div>

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
              <span className="gradient-brand ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                {advanced}
              </span>
            )}
          </button>

          {open && (
            <div className={cn('mt-3 border-l-2 pl-3', layout)}>
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

      <div
        className={cn(
          'mt-3 shrink-0 space-y-2 border-t pt-3',
          /*
            Pinned to the bottom edge once the panel has the page.

            In a rail the footer is already always visible: the fields scroll
            inside a fixed-height panel and this sits under them. Across the
            page there is no such box — the panel is as long as it needs to be,
            which past "More filters" is longer than the screen. Search is the
            one control here that must never be the thing you have to go
            looking for, so it rides the bottom of the viewport instead.

            The negative margins take it out to the panel's own edges so its
            background actually covers the fields passing underneath; without
            them it would be a floating strip with filters visible either side.

            From `xl` only, because below it the bottom of the viewport is not
            ours: the phone dock is fixed there at a higher layer and would
            simply cover this. And between `xl` and `2xl` the floating Ask
            button is still on screen at the bottom right, which is exactly
            where Search would otherwise sit — hence the extra right padding
            until the width where that button is gone.
          */
          wide &&
            'xl:sticky xl:bottom-0 xl:z-20 xl:-mx-3.5 xl:-mb-3.5 xl:rounded-b-2xl xl:bg-[var(--surface-raised)] xl:px-3.5 xl:pr-28 xl:pb-3.5 2xl:pr-3.5',
        )}
      >
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
            className="gradient-brand elev-brand inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition hover:brightness-110 disabled:opacity-60"
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
