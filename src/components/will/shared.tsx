"use client";

import type { CSSProperties, ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Select } from "@/components/ui/primitives";
import { SEVERITY_LABEL, SEVERITY_TONE, Tag } from "@/components/wealth/shared";
import type { Finding, Step } from "@/lib/will/checks";
import { personName, type Person, type WillRecord } from "@/lib/will/model";

/** What every step is handed. */
export type StepProps = {
  record: WillRecord;
  /** Applies a change from lib/will/edit (or any function from a record to a record). */
  update: (fn: (r: WillRecord) => WillRecord) => void;
  findings: Finding[];
  today: string;
  /** Jump to another step (a hint that says "add people first" links there). */
  go: (step: Step) => void;
  /** The person or asset a check sent us to; its card is scrolled into view and ringed. */
  focus: { personId?: string; assetId?: string } | null;
  /**
   * True until the person has been through this step once. A step is quiet while it is
   * still being filled in for the first time: `findings` is empty, so nothing red greets
   * somebody who has not had the chance to answer yet. The Checks tab is always complete.
   */
  quiet: boolean;
};

export function StepHead({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-5">
      <h2 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
        {title}
      </h2>
      {children && (
        <p className="text-muted mt-1.5 max-w-2xl text-sm leading-relaxed text-pretty sm:text-[15px]">
          {children}
        </p>
      )}
    </header>
  );
}

export function Notice({
  children,
  tone = "var(--status-warn)",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <div
      style={{ "--tone": tone } as CSSProperties}
      role="status"
      className="tinted flex gap-2.5 rounded-2xl border px-4 py-3 text-sm"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="text-[var(--text-c)]">{children}</div>
    </div>
  );
}

/**
 * What the checks say about the step you are on, right where you can fix it.
 * Things to act on and review come first; notes are quieter. Nothing here
 * blocks moving on: a person may know something the rule does not.
 */
export function StepFindings({
  findings,
  step,
}: {
  findings: Finding[];
  step: Step;
}) {
  const mine = findings.filter((f) => f.step === step);
  if (mine.length === 0) return null;
  return (
    <ul className="mt-6 space-y-2" aria-label="What to look at on this step">
      {mine.map((f) => (
        <li
          key={f.id}
          style={{ "--tone": SEVERITY_TONE[f.severity] } as CSSProperties}
          className={
            f.severity === "note"
              ? "surface-sunken rounded-2xl border px-4 py-3"
              : "tinted rounded-2xl border px-4 py-3"
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone={SEVERITY_TONE[f.severity]}>
              {SEVERITY_LABEL[f.severity]}
            </Tag>
            <span className="text-sm font-semibold">{f.title}</span>
          </div>
          <p className="text-muted mt-1.5 text-[13px] leading-relaxed text-pretty">
            {f.detail}
          </p>
          {f.cite && <p className="text-subtle mt-1 text-[11.5px]">{f.cite}</p>}
        </li>
      ))}
    </ul>
  );
}

/**
 * One answer chosen from a few, as large pills: easier to tap than a dropdown and
 * every option is visible at once. Native radios underneath, so the keyboard,
 * screen readers and form behaviour are the browser's own.
 */
export function Choice<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: T | "";
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o.value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="peer sr-only"
          />
          <span className="surface-sunken inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition peer-checked:border-transparent peer-checked:bg-[var(--accent)] peer-checked:text-[var(--on-action)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)] peer-focus-visible:ring-offset-2 hover:border-[var(--border-strong)]">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

/** A person chosen from the list, with a blank first option. */
export function PersonSelect({
  record,
  value,
  onChange,
  placeholder = "Choose a person",
  exclude = [],
  id,
  "aria-label": ariaLabel,
}: {
  record: WillRecord;
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** People not offered (already chosen in another row). The current value is always offered. */
  exclude?: string[];
  id?: string;
  "aria-label"?: string;
}) {
  const options: Person[] = record.people.filter(
    (p) => p.id === value || !exclude.includes(p.id),
  );
  const missing = value && !record.people.some((p) => p.id === value);
  return (
    <Select
      id={id}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {missing && <option value={value}>Someone removed from the list</option>}
      {options.map((p) => (
        <option key={p.id} value={p.id}>
          {personName(p)}
          {p.relation !== "Other" && p.name.trim()
            ? ` (${p.relation.toLowerCase()})`
            : ""}
        </option>
      ))}
    </Select>
  );
}

/** A card that can be the target of "Fix": ringed when it is. */
export function FocusCard({
  id,
  focused,
  children,
  className = "",
}: {
  id: string;
  focused: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      id={`f-${id}`}
      className={`surface-sunken scroll-mt-28 rounded-2xl border p-4 transition sm:p-5 ${focused ? "ring-2 ring-[var(--accent)]" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
