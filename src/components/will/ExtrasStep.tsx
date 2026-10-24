'use client';

import { Field, Textarea } from '@/components/ui/primitives';
import type { Extras } from '@/lib/will/model';
import { StepFindings, StepHead, type StepProps } from './shared';

/**
 * Step seven: anything else, none of it required.
 *
 * Whatever is typed here is printed under its own heading as the person's
 * wish. It is never merged into the legal clauses around it (lib/will/clauses),
 * so a careless sentence cannot change what a gift means.
 */
export function ExtrasStep({ record, update, findings }: StepProps) {
  const e = record.extras;
  const set = (patch: Partial<Extras>) => update((r) => ({ ...r, extras: { ...r.extras, ...patch } }));

  return (
    <div>
      <StepHead title="Anything else you want written down">
        All optional. What you write here is printed under its own heading, as your wish, apart from the parts of the will
        that give things away.
      </StepHead>

      <div className="space-y-5">
        <Field label="Your funeral" htmlFor="x-funeral" hint="For example how you would like it done, or where. Your family will be asked to follow it; the will does not wait on it.">
          <Textarea id="x-funeral" rows={3} value={e.funeral} onChange={(ev) => set({ funeral: ev.target.value })} />
        </Field>
        <Field label="Your online accounts" htmlFor="x-digital" hint="Email, social media, cloud storage: what should be closed, kept or passed on. Do not write passwords here.">
          <Textarea id="x-digital" rows={3} value={e.digital} onChange={(ev) => set({ digital: ev.target.value })} />
        </Field>
        <Field label="Your pets" htmlFor="x-pets" hint="Who should look after them.">
          <Textarea id="x-pets" rows={2} value={e.pets} onChange={(ev) => set({ pets: ev.target.value })} />
        </Field>

        <label className="surface-sunken flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm">
          <input
            type="checkbox"
            checked={e.payDebts}
            onChange={(ev) => set({ payDebts: ev.target.checked })}
            className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
          />
          <span>
            <span className="font-medium">Pay my funeral costs and debts first.</span>
            <span className="text-muted mt-0.5 block text-[13px]">
              The executor settles them out of what you leave before the rest is shared. Turn this off only if a lawyer has
              told you to.
            </span>
          </span>
        </label>
      </div>

      <StepFindings findings={findings} step="extras" />
    </div>
  );
}
