'use client';

import { useId, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { FIELDS, defaults, run, type Field, type Kind, type Unit, type Values } from '@/lib/calculators/fields';

/**
 * A free calculator: the fields on the left, the answer on the right, worked
 * out as you type.
 *
 * It opens on the guide's worked example, and it is rendered on the server
 * with those figures, so the page's HTML already carries a complete answer for
 * anybody (or anything) that reads it without running a line of script. Typing
 * changes the answer in place.
 *
 * Rupee amounts are shown in Indian digit grouping once a field is left
 * (₹60,00,000) and taken back to plain digits while it is being edited, so
 * the cursor never jumps over a comma.
 */

const PREFIX: Partial<Record<Unit, string>> = { inr: '₹', crore: '₹' };
const SUFFIX: Partial<Record<Unit, string>> = {
  pct: '%',
  sqft: 'sq ft',
  sqm: 'sq m',
  months: 'months',
  years: 'years',
  crore: 'crore',
  times: 'x',
};

const grouped = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** What a reader typed, as a number: commas, spaces and the rupee sign ignored. */
function parse(raw: string): number {
  const clean = raw.replace(/[₹,\s]/g, '');
  return clean === '' ? NaN : Number(clean);
}

export function Calculator({ kind }: { kind: Kind }) {
  const fields = FIELDS[kind];
  const [text, setText] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.filter((f) => f.kind === 'number').map((f) => [f.id, grouped(f.value as number)])),
  );
  const [toggles, setToggles] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(fields.filter((f) => f.kind === 'toggle').map((f) => [f.id, f.value as boolean])),
  );

  const values: Values = useMemo(
    () => ({ ...Object.fromEntries(Object.entries(text).map(([k, v]) => [k, parse(v)])), ...toggles }),
    [text, toggles],
  );
  const result = useMemo(() => run(kind, values), [kind, values]);

  const reset = () => {
    const d = defaults(kind);
    setText(Object.fromEntries(fields.filter((f) => f.kind === 'number').map((f) => [f.id, grouped(d[f.id] as number)])));
    setToggles(Object.fromEntries(fields.filter((f) => f.kind === 'toggle').map((f) => [f.id, d[f.id] as boolean])));
  };

  return (
    <div className="m-card overflow-hidden rounded-[2rem] shadow-[0_30px_60px_-36px_rgb(60_30_15_/_0.55)]">
      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form className="space-y-5 p-6 sm:p-8" onSubmit={(e) => e.preventDefault()} aria-label="Your figures">
          {fields.map((f) =>
            f.kind === 'number' ? (
              <NumberInput
                key={f.id}
                field={f}
                value={text[f.id] ?? ''}
                onChange={(v) => setText((t) => ({ ...t, [f.id]: v }))}
              />
            ) : (
              <Toggle
                key={f.id}
                field={f}
                on={toggles[f.id] ?? false}
                onChange={(on) => setToggles((t) => ({ ...t, [f.id]: on }))}
              />
            ),
          )}
          <button
            type="button"
            onClick={reset}
            className="m-mono m-dim inline-flex items-center gap-2 t-2 t-caps uppercase transition hover:text-[var(--m-ink)]"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Back to the example
          </button>
        </form>

        <div className="border-t border-[var(--m-line)] bg-[var(--m-bg)] p-6 sm:p-8 md:border-t-0 md:border-l">
          <p className="m-eyebrow">The answer</p>
          <div aria-live="polite">
            {result.lines.length > 0 && (
              <dl className="mt-4 divide-y divide-[var(--m-line)]">
                {result.lines.map((l) => (
                  <div key={l.label} className="flex items-baseline justify-between gap-4 py-3">
                    <dt className={l.strong ? 't-3 font-semibold text-[var(--m-ink)]' : 'm-dim t-3'}>{l.label}</dt>{' '}
                    <dd
                      className={
                        l.strong
                          ? 'm-display shrink-0 text-right t-h4 text-[var(--m-gold)] tabular-nums'
                          : 'shrink-0 text-right t-4 font-semibold text-[var(--m-ink)] tabular-nums'
                      }
                    >
                      {l.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {result.note && <p className="m-dim mt-5 t-3">{result.note}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

const INPUT =
  'w-full rounded-xl border border-[var(--m-line)] bg-[var(--m-card)] py-3 t-4 text-[var(--m-ink)] tabular-nums transition hover:border-[var(--m-line-2)] focus:border-[var(--m-gold)] focus:ring-4 focus:ring-[color-mix(in_oklab,var(--m-gold)_14%,transparent)] focus:outline-none';

function NumberInput({ field: f, value, onChange }: { field: Extract<Field, { kind: 'number' }>; value: string; onChange: (v: string) => void }) {
  const id = useId();
  const prefix = PREFIX[f.unit];
  const suffix = SUFFIX[f.unit];
  return (
    <div>
      <label htmlFor={id} className="m-eyebrow block">
        {f.label}
      </label>
      <div className="relative mt-2.5">
        {prefix && (
          <span aria-hidden className="m-dim pointer-events-none absolute inset-y-0 left-4 flex items-center t-4">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => {
            const n = parse(e.target.value);
            if (Number.isFinite(n)) onChange(String(n));
          }}
          onBlur={(e) => {
            const n = parse(e.target.value);
            if (Number.isFinite(n)) onChange(grouped(n));
          }}
          aria-describedby={f.hint ? `${id}-hint` : undefined}
          className={`${INPUT} ${prefix ? 'pl-9' : 'pl-4'} ${suffix ? 'pr-20' : 'pr-4'}`}
        />
        {suffix && (
          <span aria-hidden className="m-dim-2 pointer-events-none absolute inset-y-0 right-4 flex items-center t-3">
            {suffix}
          </span>
        )}
      </div>
      {f.hint && (
        <p id={`${id}-hint`} className="m-dim-2 mt-1.5 t-2">
          {f.hint}
        </p>
      )}
    </div>
  );
}

function Toggle({ field: f, on, onChange }: { field: Extract<Field, { kind: 'toggle' }>; on: boolean; onChange: (on: boolean) => void }) {
  const id = useId();
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <span id={`${id}-label`} className="m-eyebrow">
          {f.label}
        </span>{' '}
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={`${id}-label`}
          aria-describedby={f.hint ? `${id}-hint` : undefined}
          onClick={() => onChange(!on)}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--m-ink)] ${
            on ? 'border-transparent bg-[var(--m-ink)]' : 'border-[var(--m-line-2)] bg-[var(--m-card)]'
          }`}
        >
          <span
            aria-hidden
            className={`absolute size-5 rounded-full transition-transform duration-200 ${on ? 'translate-x-6 bg-[var(--m-sun)]' : 'translate-x-1 bg-[var(--m-line-2)]'}`}
          />
          <span className="sr-only">{on ? 'Yes' : 'No'}</span>
        </button>
      </div>
      {f.hint && (
        <p id={`${id}-hint`} className="m-dim-2 mt-1.5 t-2">
          {f.hint}
        </p>
      )}
    </div>
  );
}
