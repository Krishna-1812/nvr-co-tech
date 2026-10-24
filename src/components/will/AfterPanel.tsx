'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowRight, CircleCheck, HandHelping, Wallet } from 'lucide-react';
import { Button, Field, Input, Textarea } from '@/components/ui/primitives';
import { SEVERITY_LABEL, SEVERITY_TONE, Tag } from '@/components/wealth/shared';
import type { WealthRecord } from '@/lib/wealth/model';
import type { WillRecord, Register } from '@/lib/will/model';
import { afterPrompts, applyWriteBack, writeBackPlan } from '@/lib/will/register';
import { HelpRequest } from './HelpRequest';
import { Notice } from './shared';

/**
 * After the will is signed: where it is, who knows, and what has changed since.
 *
 * Most of what goes wrong with a will happens after it is written: the original
 * cannot be found, nobody was told, or life moved on and the will did not. This
 * tab is the part of Will Maker that keeps working then. It records the facts
 * about the signed will (never printed in it), checks the will against the
 * person's Wealth Tracker record (new assets, assets that are gone, family not
 * in the will, nominees that changed), and can write the will's status, place
 * and executor back to Wealth Tracker so the two stay true together.
 */
export function AfterPanel({
  record,
  update,
  wealth,
  wealthLocked,
  onWriteBack,
  today,
  name,
  email,
}: {
  record: WillRecord;
  update: (fn: (r: WillRecord) => WillRecord) => void;
  /** The person's Wealth Tracker record, or null when there is none to read (none yet, or locked). */
  wealth: WealthRecord | null;
  wealthLocked: boolean;
  /** Saves a changed Wealth Tracker household profile. */
  onWriteBack: (profile: WealthRecord['profile']) => void;
  today: string;
  name: string;
  email: string;
}) {
  const g = record.register;
  const set = (patch: Partial<Register>) => update((r) => ({ ...r, register: { ...r.register, ...patch } }));
  const prompts = useMemo(() => afterPrompts(record, wealth, today), [record, wealth, today]);
  const plan = useMemo(() => (wealth ? writeBackPlan(wealth, record) : []), [wealth, record]);
  const [written, setWritten] = useState(false);
  const [help, setHelp] = useState(false);

  return (
    <div className="space-y-5">
      <section className="surface-lit a-ring rounded-[1.75rem] p-5 sm:p-8" aria-labelledby="after-record">
        <h2 id="after-record" className="text-xl font-semibold tracking-tight sm:text-2xl">
          Your signed will
        </h2>
        <p className="text-muted mt-1.5 max-w-2xl text-sm leading-relaxed text-pretty sm:text-[15px]">
          Fill this in after you sign. It is not part of the will and is never printed in it: it is so you, and the people
          who will need it, can find the will and know when to look at it again.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Signed on" htmlFor="g-signed" hint="The day you and your witnesses signed. Leave blank until you have.">
            <Input id="g-signed" type="date" max={today} value={g.signedOn} onChange={(e) => set({ signedOn: e.target.value })} />
          </Field>
          <Field label="Read it again by" htmlFor="g-review" hint="A date you will see here.">
            <Input id="g-review" type="date" min={today} value={g.reviewBy} onChange={(e) => set({ reviewBy: e.target.value })} />
          </Field>
          <Field label="Where the signed original is kept" htmlFor="g-kept" className="sm:col-span-2" hint="For example: bank locker, Pune main branch; or the steel almirah, second shelf.">
            <Input id="g-kept" value={g.originalKept} onChange={(e) => set({ originalKept: e.target.value })} />
          </Field>
          <label className="surface-sunken flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm sm:col-span-2">
            <input type="checkbox" checked={g.executorTold} onChange={(e) => set({ executorTold: e.target.checked })} className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
            <span>My executor knows there is a will and where it is.</span>
          </label>
          <Field label="Anyone else who knows" htmlFor="g-knows" className="sm:col-span-2" hint="Names and how to reach them.">
            <Textarea id="g-knows" rows={2} value={g.alsoKnows} onChange={(e) => set({ alsoKnows: e.target.value })} />
          </Field>
          <label className="surface-sunken flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm sm:col-span-2">
            <input type="checkbox" checked={g.registered} onChange={(e) => set({ registered: e.target.checked })} className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
            <span>
              I registered the will with the Sub-Registrar.
              <span className="text-muted mt-0.5 block text-[13px]">Optional. It makes the will harder to dispute.</span>
            </span>
          </label>
          {g.registered && (
            <Field label="Which office, and the registration number" htmlFor="g-reg" className="sm:col-span-2">
              <Input id="g-reg" value={g.registeredAt} onChange={(e) => set({ registeredAt: e.target.value })} />
            </Field>
          )}
        </div>
      </section>

      <section aria-label="What to look at" className="space-y-2.5">
        <h3 className="a-label px-1">What to look at</h3>
        {wealthLocked && (
          <Notice tone="var(--status-draft)">
            Your Wealth Tracker record is locked, so this cannot compare the will with what you own. Unlock it in Wealth
            Tracker and come back.
          </Notice>
        )}
        {!wealth && !wealthLocked && (
          <Notice tone="var(--status-draft)">
            With a Wealth Tracker record, this also checks the will against what you own and who is in your household.
          </Notice>
        )}
        {prompts.length === 0 ? (
          <div className="surface-lit a-ring flex items-center gap-3 rounded-2xl border p-5 text-sm">
            <CircleCheck className="size-5 shrink-0 text-[var(--status-approved)]" aria-hidden />
            Nothing to look at. That does not mean it has been read by a lawyer.
          </div>
        ) : (
          <ul className="space-y-2.5">
            {prompts.map((p) => (
              <li
                key={p.id}
                style={{ '--tone': SEVERITY_TONE[p.severity] } as CSSProperties}
                className={p.severity === 'note' ? 'surface-sunken rounded-2xl border p-4' : 'tinted rounded-2xl border p-4'}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone={SEVERITY_TONE[p.severity]}>{SEVERITY_LABEL[p.severity]}</Tag>
                  <span className="text-sm font-semibold">{p.title}</span>
                </div>
                <p className="text-muted mt-1.5 text-[13px] leading-relaxed text-pretty">{p.detail}</p>
                {p.cite && <p className="text-subtle mt-1 text-[11.5px]">{p.cite}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {wealth && plan.length > 0 && (
        <section className="surface-lit a-ring rounded-2xl border p-5" aria-label="Update Wealth Tracker">
          <div className="flex items-center gap-2">
            <Wallet className="size-4" aria-hidden />
            <h3 className="text-sm font-semibold">Keep Wealth Tracker true</h3>
          </div>
          <p className="text-muted mt-1 text-[13.5px]">Wealth Tracker’s household page would change like this. Nothing else in it is touched.</p>
          <ul className="mt-3 space-y-2 text-[13.5px]">
            {plan.map((c) => (
              <li key={c.field} className="flex flex-wrap items-center gap-x-2">
                <span className="text-muted w-44 shrink-0">{c.label}</span>
                <span className="text-subtle line-through decoration-1">{c.from}</span>
                <ArrowRight className="size-3.5 shrink-0" aria-hidden />
                <span className="font-medium">{c.to}</span>
              </li>
            ))}
          </ul>
          <Button
            className="mt-4"
            variant="primary"
            onClick={() => {
              onWriteBack(applyWriteBack(wealth, record, plan));
              setWritten(true);
            }}
          >
            Update Wealth Tracker
          </Button>
        </section>
      )}
      {written && <Notice tone="var(--status-approved)">Wealth Tracker’s household page now matches.</Notice>}

      <section className="surface-lit a-ring flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center sm:gap-4" aria-label="Help from an advocate">
        <HandHelping className="size-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Want an advocate to look at it?</h3>
          <p className="text-muted mt-1 text-[13.5px] leading-relaxed text-pretty">
            We are setting up advocate review, registration help and full drafting. Tell us what you need and we will write
            back. Only what you type in the request is sent, with the usual details of a visit to this site. Never your will.
          </p>
        </div>
        <Button className="self-start sm:self-auto" onClick={() => setHelp(true)}>Ask for help</Button>
      </section>

      <HelpRequest open={help} onClose={() => setHelp(false)} name={name} email={email} />
    </div>
  );
}
