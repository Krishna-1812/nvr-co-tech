"use client";

import { ChevronDown } from "lucide-react";
import { Field, Input } from "@/components/ui/primitives";
import { readiness } from "@/lib/will/checks";
import { GUIDE, NOT_NEEDED } from "@/lib/will/guide";
import { ExportBar } from "./ExportBar";
import { StepFindings, StepHead, type StepProps } from "./shared";

/**
 * Step eight: the two things only you can say, where and when, and how a will is signed.
 *
 * The declarations (sound mind, free will) are here and not on the first step: this is
 * where the person is about to sign, so the words mean something, and the first
 * screen is spared two boxes that read like a legal test before anything has begun.
 *
 * Place and date can be left blank to write by hand at signing; the date
 * matters when there is ever more than one will. The how-to is short and says
 * only what the Succession Act asks, with no promise about what a court will
 * do with a particular will.
 */
export function SignStep({ record, update, findings, today }: StepProps) {
  const s = record.signing;
  const t = record.testator;
  const setTestator = (patch: Partial<typeof t>) =>
    update((r) => ({ ...r, testator: { ...r.testator, ...patch } }));
  const set = (patch: Partial<typeof s>) =>
    update((r) => ({ ...r, signing: { ...r.signing, ...patch } }));
  const ready = readiness(findings);

  return (
    <div>
      <StepHead title="Signing">
        Fill these in now, or leave them blank and write them by hand when you
        sign. Then take the will and the guide with you.
      </StepHead>

      <fieldset>
        <legend className="a-label mb-3">Two things only you can say</legend>
        <div className="space-y-2">
          <label className="surface-sunken flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm">
            <input
              type="checkbox"
              checked={t.soundMind}
              onChange={(e) => setTestator({ soundMind: e.target.checked })}
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span>I am of sound mind and understand what a will does.</span>
          </label>
          <label className="surface-sunken flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm">
            <input
              type="checkbox"
              checked={t.voluntary}
              onChange={(e) => setTestator({ voluntary: e.target.checked })}
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span>I am making this will freely. Nobody is pressing me.</span>
          </label>
        </div>
      </fieldset>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <Field
          label="Place"
          htmlFor="s-place"
          hint="The city or town where you will sign."
        >
          <Input
            id="s-place"
            value={s.place}
            onChange={(e) => set({ place: e.target.value })}
          />
        </Field>
        <Field
          label="Date"
          htmlFor="s-date"
          hint="The day you will actually sign."
        >
          <Input
            id="s-date"
            type="date"
            min={today}
            value={s.date}
            onChange={(e) => set({ date: e.target.value })}
          />
        </Field>
      </div>

      <section
        aria-label="Where you stand"
        className="surface-sunken mt-7 rounded-2xl border p-5"
      >
        <h3 className="text-sm font-semibold">
          {ready.ready
            ? "Nothing is holding this draft back."
            : `${ready.act} thing${ready.act === 1 ? "" : "s"} to fix before this draft is ready.`}
        </h3>
        <p className="text-muted mt-1 text-[13px]">
          {ready.review > 0 ? `${ready.review} more to review. ` : ""}Open the
          Checks tab for the full list, each with the fix one tap away.
        </p>
      </section>

      <div className="mt-7">
        <ExportBar record={record} today={today} />
      </div>

      <details className="surface-sunken group mt-8 rounded-2xl border" open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          How to sign it
          <ChevronDown
            className="size-4 shrink-0 transition group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <section aria-label="How a will is signed" className="px-4 pb-4">
          {GUIDE.map((part) => (
            <div key={part.id} className="mb-6">
              <h3 className="a-label mb-3">{part.heading}</h3>
              <ul className="space-y-3">
                {part.steps.map((st) => (
                  <li key={st.text} className="text-[14px] leading-relaxed">
                    <span className="font-semibold">{st.text}</span>
                    {st.detail && (
                      <span className="text-muted block">{st.detail}</span>
                    )}
                    <span className="text-subtle mt-0.5 block text-[11px] font-semibold tracking-wide uppercase">
                      {st.kind === "rule"
                        ? `Required by law${st.cite ? `: ${st.cite}` : ""}`
                        : "Good practice"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <h3 className="a-label mb-2">You do not need</h3>
          <ul className="text-muted list-disc space-y-1 pl-5 text-[14px]">
            {NOT_NEEDED.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      </details>

      <StepFindings findings={findings} step="sign" />
    </div>
  );
}
