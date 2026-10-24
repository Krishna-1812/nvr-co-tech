'use client';

import { Field, Input } from '@/components/ui/primitives';
import { readiness } from '@/lib/will/checks';
import { LAW } from '@/lib/will/law';
import { StepFindings, StepHead, type StepProps } from './shared';

/**
 * Step eight: where and when, and how a will is signed.
 *
 * Place and date can be left blank to write by hand at signing; the date
 * matters when there is ever more than one will. The how-to is short and says
 * only what the Succession Act asks, with no promise about what a court will
 * do with a particular will.
 */
export function SignStep({ record, update, findings, today }: StepProps) {
  const s = record.signing;
  const set = (patch: Partial<typeof s>) => update((r) => ({ ...r, signing: { ...r.signing, ...patch } }));
  const ready = readiness(findings);

  return (
    <div>
      <StepHead title="Signing">
        Fill these in now, or leave them blank and write them by hand when you sign.
      </StepHead>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Place" htmlFor="s-place" hint="The city or town where you will sign.">
          <Input id="s-place" value={s.place} onChange={(e) => set({ place: e.target.value })} />
        </Field>
        <Field label="Date" htmlFor="s-date" hint="The day you will actually sign.">
          <Input id="s-date" type="date" min={today} value={s.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
      </div>

      <section aria-label="Where you stand" className="surface-sunken mt-7 rounded-2xl border p-5">
        <h3 className="text-sm font-semibold">
          {ready.ready ? 'Nothing is holding this draft back.' : `${ready.act} thing${ready.act === 1 ? '' : 's'} to fix before this draft is ready.`}
        </h3>
        <p className="text-muted mt-1 text-[13px]">
          {ready.review > 0 ? `${ready.review} more to review. ` : ''}Open the Checks tab for the full list, each with the fix one tap away.
        </p>
      </section>

      <section aria-label="How a will is signed" className="mt-7">
        <h3 className="a-label mb-3">How a will is signed</h3>
        <ol className="text-muted list-decimal space-y-2 pl-5 text-[14px] leading-relaxed">
          <li>Print the final will and read every page. Initial each page.</li>
          <li>Sign it on paper, in ink, at the end, with two witnesses watching you do it.</li>
          <li>
            Each witness then signs in your presence. They need at least {LAW.witnessesNeeded}; they do not have to sign
            together.
          </li>
          <li>Choose witnesses who get nothing under the will, and who are not related to anyone who does.</li>
          <li>Keep the original somewhere safe, and tell your executor where.</li>
        </ol>
        <p className="text-subtle mt-3 text-xs">
          Registering the will with the Sub-Registrar is optional, and makes it harder to dispute. A will does not need
          stamp paper.
        </p>
      </section>

      <StepFindings findings={findings} step="sign" />
    </div>
  );
}
