'use client';

import { Field, Input } from '@/components/ui/primitives';
import { readiness } from '@/lib/will/checks';
import { GUIDE, NOT_NEEDED } from '@/lib/will/guide';
import { ExportBar } from './ExportBar';
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
        Fill these in now, or leave them blank and write them by hand when you sign. Then take the will and the guide with
        you.
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

      <div className="mt-7">
        <ExportBar record={record} today={today} />
      </div>

      <section aria-label="How a will is signed" className="mt-8">
        {GUIDE.map((part) => (
          <div key={part.id} className="mb-6">
            <h3 className="a-label mb-3">{part.heading}</h3>
            <ul className="space-y-3">
              {part.steps.map((st) => (
                <li key={st.text} className="text-[14px] leading-relaxed">
                  <span className="font-semibold">{st.text}</span>
                  {st.detail && <span className="text-muted block">{st.detail}</span>}
                  <span className="text-subtle mt-0.5 block text-[11px] font-semibold tracking-wide uppercase">
                    {st.kind === 'rule' ? `Required by law${st.cite ? `: ${st.cite}` : ''}` : 'Good practice'}
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

      <StepFindings findings={findings} step="sign" />
    </div>
  );
}
