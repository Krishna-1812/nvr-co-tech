"use client";

import { ChevronDown } from "lucide-react";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import { SEVERITY_TONE, Tag } from "@/components/wealth/shared";
import {
  CIRCUMSTANCES,
  CIRCUMSTANCE_LABELS,
  RELIGIONS,
  scopeOf,
  type Circumstance,
  type Religion,
} from "@/lib/will/law";
import {
  KIN,
  MARITAL,
  type KinRelation,
  type MaritalStatus,
  type Testator,
} from "@/lib/will/model";
import { Choice, StepFindings, StepHead, type StepProps } from "./shared";

/**
 * Step one: who is making the will.
 *
 * Five things are asked here, the five the will cannot do without: a name, a date of
 * birth, a religion, where you live and which state. Everything else about you is
 * behind a disclosure, because it is optional and a screen of eighteen fields tells a
 * newcomer that this is going to be hard.
 *
 * The scope verdict (lib/will/law) is still shown here, at the front door, in words:
 * a person who cannot safely use this tool is told so at once, with the reason. A
 * caution ("add your date of birth") waits until the person has been through the step
 * once, so it is never the first thing said to somebody who has not had a go yet.
 * The two declarations (sound mind, free will) are on the last step, where the person
 * is about to sign and the words mean something.
 */

const KIN_LABEL: Record<(typeof KIN)[number], string> = {
  son: "Son of",
  daughter: "Daughter of",
  wife: "Wife of",
  husband: "Husband of",
};
const KIN_OPTIONS = KIN.map((k) => ({ value: k, label: KIN_LABEL[k] }));
const MARITAL_OPTIONS = MARITAL.map((m) => ({
  value: m,
  label: m.charAt(0).toUpperCase() + m.slice(1),
}));
const RELIGION_OPTIONS = RELIGIONS.map((r) => ({ value: r, label: r }));

export function YouStep({ record, update, findings, today, quiet }: StepProps) {
  const t = record.testator;
  const set = (patch: Partial<Testator>) =>
    update((r) => ({ ...r, testator: { ...r.testator, ...patch } }));
  const scope = scopeOf(t, today);
  // A refusal is always said. A caution waits for the second look.
  const reasons = scope.reasons.filter((r) => r.level === "out" || !quiet);

  const toggle = (c: Circumstance) =>
    set({
      circumstances: t.circumstances.includes(c)
        ? t.circumstances.filter((x) => x !== c)
        : [...t.circumstances, c],
    });

  const moreFilled = !!(
    t.kinRelation ||
    t.maritalStatus ||
    t.occupation.trim() ||
    t.residesAbroad
  );

  return (
    <div>
      <StepHead title="About you">
        This is how the will introduces you. Use your name as it appears on your
        identity documents.
      </StepHead>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Full name"
          htmlFor="w-name"
          required
          className="sm:col-span-2"
        >
          <Input
            id="w-name"
            value={t.name}
            onChange={(e) => set({ name: e.target.value })}
            autoComplete="name"
          />
        </Field>

        <Field
          label="Date of birth"
          htmlFor="w-dob"
          hint="Only an adult can make a will."
          className="sm:col-span-2"
        >
          <Input
            id="w-dob"
            type="date"
            max={today}
            value={t.dob}
            onChange={(e) => set({ dob: e.target.value })}
            autoComplete="bday"
            className="sm:max-w-xs"
          />
        </Field>

        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium" id="w-religion-l">
            Religion
          </p>
          <Choice
            name="w-religion"
            label="Religion"
            value={t.religion}
            options={RELIGION_OPTIONS}
            onChange={(v: Religion) => set({ religion: v })}
          />
          <p className="text-subtle mt-1.5 text-xs">
            The law that applies to you depends on it.
          </p>
        </div>

        <Field
          label="Where you live"
          htmlFor="w-address"
          className="sm:col-span-2"
        >
          <Textarea
            id="w-address"
            rows={2}
            value={t.address}
            onChange={(e) => set({ address: e.target.value })}
            autoComplete="street-address"
          />
        </Field>
        <Field
          label="State"
          htmlFor="w-state"
          hint="Goa follows its own succession law."
        >
          <Input
            id="w-state"
            value={t.state}
            onChange={(e) => set({ state: e.target.value })}
            autoComplete="address-level1"
          />
        </Field>
      </div>

      <Disclosure
        title="A little more about you"
        hint="Optional"
        open={moreFilled}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium">Marital status</p>
            <Choice
              name="w-marital"
              label="Marital status"
              value={t.maritalStatus}
              options={MARITAL_OPTIONS}
              onChange={(v: MaritalStatus) => set({ maritalStatus: v })}
            />
          </div>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium">You are the…</p>
            <Choice
              name="w-kin"
              label="You are the"
              value={t.kinRelation}
              options={KIN_OPTIONS}
              onChange={(v: KinRelation) => set({ kinRelation: v })}
            />
            <p className="text-subtle mt-1.5 text-xs">
              It tells you apart from someone with the same name.
            </p>
          </div>
          <Field label="Of whom" htmlFor="w-kin-name">
            <Input
              id="w-kin-name"
              value={t.kinName}
              onChange={(e) => set({ kinName: e.target.value })}
              disabled={!t.kinRelation}
            />
          </Field>
          <Field
            label="What you do"
            htmlFor="w-occupation"
            hint="For example: teacher, consultant, retired."
          >
            <Input
              id="w-occupation"
              value={t.occupation}
              onChange={(e) => set({ occupation: e.target.value })}
            />
          </Field>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={t.residesAbroad}
              onChange={(e) => set({ residesAbroad: e.target.checked })}
              className="mt-0.5 size-4 accent-[var(--accent)]"
            />
            <span>I live outside India and own assets here</span>
          </label>
        </div>
      </Disclosure>

      <Disclosure
        title="Is anything unusual about your situation?"
        hint="Six quick yes or no"
        open={t.circumstances.length > 0}
      >
        <fieldset>
          <legend className="sr-only">Does any of this apply to you?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CIRCUMSTANCES.map((c) => (
              <label
                key={c}
                className="surface-sunken flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={t.circumstances.includes(c)}
                  onChange={() => toggle(c)}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                />
                <span>{CIRCUMSTANCE_LABELS[c]}</span>
              </label>
            ))}
          </div>
          <p className="text-subtle mt-2 text-xs">
            None of these stops you. They tell us where a lawyer’s read-through
            is worth having. Leave them all unticked if none apply.
          </p>
        </fieldset>
      </Disclosure>

      {reasons.length > 0 && (
        <section
          aria-label="Whether this tool fits you"
          className="mt-8 space-y-2"
        >
          <h3 className="a-label">Whether this tool fits you</h3>
          {reasons.map((r) => (
            <div
              key={r.id}
              style={
                {
                  "--tone":
                    r.level === "out"
                      ? SEVERITY_TONE.act
                      : SEVERITY_TONE.review,
                } as React.CSSProperties
              }
              className="tinted rounded-2xl border px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Tag
                  tone={
                    r.level === "out" ? SEVERITY_TONE.act : SEVERITY_TONE.review
                  }
                >
                  {r.level === "out"
                    ? "This tool cannot do this"
                    : "Worth knowing"}
                </Tag>
                <span className="text-sm font-semibold">{r.title}</span>
              </div>
              <p className="text-muted mt-1.5 text-[13px] leading-relaxed text-pretty">
                {r.detail}
              </p>
              {r.cite && (
                <p className="text-subtle mt-1 text-[11.5px]">{r.cite}</p>
              )}
            </div>
          ))}
        </section>
      )}

      <StepFindings
        findings={findings.filter((f) => !f.id.startsWith("scope-"))}
        step="you"
      />
    </div>
  );
}

/** A folded-away section: the question is visible, the answers are not, until somebody asks or has already answered. */
function Disclosure({
  title,
  hint,
  open,
  children,
}: {
  title: string;
  hint: string;
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={open}
      className="surface-sunken group mt-5 rounded-2xl border"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span>
          {title} <span className="text-subtle font-normal">· {hint}</span>
        </span>
        <ChevronDown
          className="size-4 shrink-0 transition group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}
