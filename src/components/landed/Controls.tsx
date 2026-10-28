'use client';

import { useState, type CSSProperties } from 'react';
import { Input } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { parseAmount, type FundSource } from '@/lib/landed/calc';
import { SOURCE_ICON, SOURCE_TONE } from './shared';

/**
 * A number field that shows Indian grouping when you are not typing in it.
 *
 * Text rather than type="number", because a number input cannot hold "12,50,000"
 * and silently empties itself on a pasted figure with commas in it, which is how
 * every amount on a demand letter is written. Text that is not a number keeps
 * the last good value and marks the field invalid rather than quietly ignoring it.
 */
export function NumberInput({
  value,
  onCommit,
  prefix,
  suffix,
  className,
  inputClassName,
  ...rest
}: {
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
  prefix?: string;
  suffix?: string;
  className?: string;
  inputClassName?: string;
  id?: string;
  placeholder?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}) {
  const show = (v: number | undefined) =>
    v === undefined ? '' : v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const [text, setText] = useState(() => show(value));
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);

  return (
    <div className={cn('relative', className)}>
      {prefix && (
        <span aria-hidden className="text-subtle pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm">
          {prefix}
        </span>
      )}
      <Input
        {...rest}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={editing ? text : show(value)}
        onFocus={() => {
          // The field keeps the figure exactly as shown, commas and all, when
          // it is focused (parseAmount reads commas). Rewriting it to bare
          // digits on focus replaced the text under the browser's selection:
          // reached by Tab, the whole figure is selected so that typing
          // replaces it, and after the rewrite the new digits were added to
          // the end of the old ones instead (7,50,000 then 900000 became
          // 7,50,00,09,00,000).
          setText(show(value));
          setEditing(true);
        }}
        onBlur={() => {
          setEditing(false);
          setInvalid(false);
        }}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const n = parseAmount(raw);
          setInvalid(n === null);
          if (n !== null) onCommit(Number.isNaN(n) ? undefined : n);
        }}
        aria-invalid={invalid || undefined}
        className={cn(
          'numeric text-right',
          prefix && 'pl-7',
          suffix && 'pr-8',
          // `color:` tells the class merger this is a border colour; a bare
          // var() reads to it as a width and the class was being dropped.
          invalid &&
            'border-[color:var(--status-rejected)] hover:border-[color:var(--status-rejected)] focus:border-[color:var(--status-rejected)]',
          inputClassName,
        )}
      />
      {suffix && (
        <span aria-hidden className="text-subtle pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm">
          {suffix}
        </span>
      )}
    </div>
  );
}

/** Own funds or borrowed, as a two-way switch rather than a dropdown of two. */
export function SourceToggle({
  value,
  onChange,
  label,
}: {
  value: FundSource;
  onChange: (v: FundSource) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="surface-sunken grid grid-cols-2 gap-1 rounded-full border p-1"
      // A radio group is one tab stop, moved through with the arrow keys.
      onKeyDown={(e) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault();
        const next: FundSource = value === 'self' ? 'borrowed' : 'self';
        onChange(next);
        e.currentTarget.querySelector<HTMLButtonElement>(`[data-source="${next}"]`)?.focus();
      }}
    >
      {(['self', 'borrowed'] as const).map((s) => {
        const on = value === s;
        const Icon = SOURCE_ICON[s];
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-source={s}
            onClick={() => onChange(s)}
            style={on ? ({ '--tone': SOURCE_TONE[s] } as CSSProperties) : undefined}
            className={cn(
              'inline-flex h-8 items-center justify-center gap-1.5 rounded-full border text-[13px] font-semibold transition',
              on ? 'tinted shadow-[var(--elev-1)]' : 'text-muted border-transparent hover:text-[var(--text-c)]',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {s === 'self' ? 'Own' : 'Borrowed'}
          </button>
        );
      })}
    </div>
  );
}

/** A row of pills for a small closed choice, as a radio group. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const index = options.findIndex((o) => o.value === value);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="surface-sunken grid gap-1 rounded-full border p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      onKeyDown={(e) => {
        const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const next = options[(index + step + options.length) % options.length];
        onChange(next.value);
        e.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus();
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-value={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-8 truncate rounded-full px-2 text-[12.5px] font-semibold transition',
              on
                ? 'bg-[var(--surface-raised)] text-[var(--text-c)] shadow-[var(--elev-1)]'
                : 'text-muted hover:text-[var(--text-c)]',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A range input in a series colour. The native control, so it keeps keyboard
 * stepping, touch dragging and its accessible value for free.
 */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  tone,
  label,
  valueText,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  tone: string;
  label: string;
  valueText?: string;
}) {
  const fill = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <input
      type="range"
      aria-label={label}
      aria-valuetext={valueText}
      min={min}
      max={max}
      step={step}
      value={Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min}
      onChange={(e) => onChange(Number(e.target.value))}
      className="lc-range w-full"
      style={{ '--tone': tone, '--fill': `${fill}%` } as CSSProperties}
    />
  );
}
