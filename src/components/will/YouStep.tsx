'use client';

import { Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { SEVERITY_TONE, Tag } from '@/components/wealth/shared';
import { CIRCUMSTANCES, CIRCUMSTANCE_LABELS, RELIGIONS, scopeOf, type Circumstance, type Religion } from '@/lib/will/law';
import { KIN, MARITAL, type KinRelation, type MaritalStatus, type Testator } from '@/lib/will/model';
import { StepFindings, StepHead, type StepProps } from './shared';

/**
 * Step one: who is making the will, and the two things only they can say.
 *
 * The scope verdict (lib/will/law) is shown here, at the front door, in words.
 * A person who cannot safely use this tool is told so on the first screen and
 * with the reason, not after twenty minutes of typing. Cautions stay visible
 * and never block.
 */

const KIN_LABEL: Record<(typeof KIN)[number], string> = { son: 'Son of', daughter: 'Daughter of', wife: 'Wife of', husband: 'Husband of' };

export function YouStep({ record, update, findings, today }: StepProps) {
  const t = record.testator;
  const set = (patch: Partial<Testator>) => update((r) => ({ ...r, testator: { ...r.testator, ...patch } }));
  const scope = scopeOf(t, today);

  const toggle = (c: Circumstance) =>
    set({ circumstances: t.circumstances.includes(c) ? t.circumstances.filter((x) => x !== c) : [...t.circumstances, c] });

  return (
    <div>
      <StepHead title="About you">
        This is how the will introduces you. Use your name as it appears on your identity documents.
      </StepHead>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="w-name" required className="sm:col-span-2">
          <Input id="w-name" value={t.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" />
        </Field>

        <Field label="You are the…" htmlFor="w-kin" hint="Optional. It tells you apart from someone with the same name.">
          <Select id="w-kin" value={t.kinRelation} onChange={(e) => set({ kinRelation: e.target.value as KinRelation })}>
            <option value="">Skip</option>
            {KIN.map((k) => (
              <option key={k} value={k}>
                {KIN_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Of whom" htmlFor="w-kin-name">
          <Input id="w-kin-name" value={t.kinName} onChange={(e) => set({ kinName: e.target.value })} disabled={!t.kinRelation} />
        </Field>

        <Field label="Date of birth" htmlFor="w-dob" hint="Only an adult can make a will.">
          <Input id="w-dob" type="date" max={today} value={t.dob} onChange={(e) => set({ dob: e.target.value })} autoComplete="bday" />
        </Field>
        <Field label="Religion" htmlFor="w-religion" hint="The law that applies to you depends on it.">
          <Select id="w-religion" value={t.religion} onChange={(e) => set({ religion: e.target.value as Religion })}>
            <option value="">Choose one</option>
            {RELIGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Marital status" htmlFor="w-marital">
          <Select id="w-marital" value={t.maritalStatus} onChange={(e) => set({ maritalStatus: e.target.value as MaritalStatus })}>
            <option value="">Skip</option>
            {MARITAL.map((m) => (
              <option key={m} value={m}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="What you do" htmlFor="w-occupation" hint="Optional. For example: teacher, consultant, retired.">
          <Input id="w-occupation" value={t.occupation} onChange={(e) => set({ occupation: e.target.value })} />
        </Field>

        <Field label="Where you live" htmlFor="w-address" className="sm:col-span-2">
          <Textarea id="w-address" rows={2} value={t.address} onChange={(e) => set({ address: e.target.value })} autoComplete="street-address" />
        </Field>
        <Field label="State" htmlFor="w-state" hint="Goa follows its own succession law.">
          <Input id="w-state" value={t.state} onChange={(e) => set({ state: e.target.value })} autoComplete="address-level1" />
        </Field>
        <label className="flex cursor-pointer items-start gap-2.5 self-end pb-2 text-sm">
          <input
            type="checkbox"
            checked={t.residesAbroad}
            onChange={(e) => set({ residesAbroad: e.target.checked })}
            className="mt-0.5 size-4 accent-[var(--accent)]"
          />
          <span>I live outside India and own assets here</span>
        </label>
      </div>

      <fieldset className="mt-8">
        <legend className="a-label mb-3">Does any of this apply to you?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CIRCUMSTANCES.map((c) => (
            <label key={c} className="surface-sunken flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm">
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
        <p className="text-subtle mt-2 text-xs">None of these stops you. They tell us where a lawyer’s read-through is worth having.</p>
      </fieldset>

      {scope.reasons.length > 0 && (
        <section aria-label="Whether this tool fits you" className="mt-8 space-y-2">
          <h3 className="a-label">Whether this tool fits you</h3>
          {scope.reasons.map((r) => (
            <div
              key={r.id}
              style={{ '--tone': r.level === 'out' ? SEVERITY_TONE.act : SEVERITY_TONE.review } as React.CSSProperties}
              className="tinted rounded-2xl border px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone={r.level === 'out' ? SEVERITY_TONE.act : SEVERITY_TONE.review}>{r.level === 'out' ? 'This tool cannot do this' : 'Worth knowing'}</Tag>
                <span className="text-sm font-semibold">{r.title}</span>
              </div>
              <p className="text-muted mt-1.5 text-[13px] leading-relaxed text-pretty">{r.detail}</p>
              {r.cite && <p className="text-subtle mt-1 text-[11.5px]">{r.cite}</p>}
            </div>
          ))}
        </section>
      )}

      <fieldset className="mt-8">
        <legend className="a-label mb-3">Two things only you can say</legend>
        <div className="space-y-2">
          <label className="surface-sunken flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm">
            <input
              type="checkbox"
              checked={t.soundMind}
              onChange={(e) => set({ soundMind: e.target.checked })}
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span>I am of sound mind and understand what a will does.</span>
          </label>
          <label className="surface-sunken flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm">
            <input
              type="checkbox"
              checked={t.voluntary}
              onChange={(e) => set({ voluntary: e.target.checked })}
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span>I am making this will freely. Nobody is pressing me.</span>
          </label>
        </div>
      </fieldset>

      <StepFindings findings={findings.filter((f) => !f.id.startsWith('scope-'))} step="you" />
    </div>
  );
}
