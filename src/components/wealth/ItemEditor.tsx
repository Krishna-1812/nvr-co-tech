'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, ChevronDown, Info, Plus, ShieldAlert, Trash2, UserRound, X } from 'lucide-react';
import { CenterPanel } from '@/components/ui/Drawer';
import { Modal } from '@/components/ui/Modal';
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { fieldsFor, head, type FieldSpec, type Fields } from '@/lib/wealth/heads';
import { parseMoney, rupees } from '@/lib/wealth/money';
import {
  RELATIONS,
  blankNominee,
  itemName,
  memberName,
  todayIso,
  type Item,
  type Nominee,
  type NomineeStatus,
  type WealthRecord,
} from '@/lib/wealth/model';
import { ageOn, type Area } from '@/lib/wealth/checks';
import { keepLastFour, looksSecret } from '@/lib/wealth/validate';
import { takesNominee } from '@/lib/wealth/calc';
import { cn } from '@/lib/utils';
import { HeadTile, MoneyInput, SecretInput } from './shared';

/**
 * Adding or changing one entry.
 *
 * Written for somebody sitting with a passbook, a statement or nothing at all,
 * filling this in for the first time. So:
 *
 *   - The few things almost everyone knows come first (what it is, who holds
 *     it, roughly what it is worth). The rest of the head's details follow,
 *     and the ones people rarely have to hand are folded under "More details".
 *   - Nothing is required. A half-filled entry is saved as it is, and the
 *     checks list what is missing, rather than a form refusing to close.
 *   - A detail that looks wrong (an IFSC with a letter O, a PIN one digit
 *     short) is pointed out beside the box, in words, and does not stop a save.
 *   - The nominee question is asked as a question, with "not sure" as a
 *     proper answer, because most people genuinely do not know.
 *   - Closing with unsaved changes asks first.
 */

type Guide = { step: number; total: number; onSkip: () => void };

export function ItemEditor({
  open,
  initial,
  isNew,
  record,
  focus,
  guide,
  onSave,
  onSaveAnother,
  onDelete,
  onClose,
}: {
  open: boolean;
  initial: Item;
  isNew: boolean;
  record: WealthRecord;
  focus?: Area;
  guide?: Guide;
  onSave: (item: Item) => void;
  /** A new entry outside the guided run: save, then start another of the same kind. */
  onSaveAnother?: (item: Item) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Item>(initial);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moreOpen, setMoreOpen] = useState(focus === 'details');
  const today = useMemo(() => todayIso(), []);
  const spec = head(draft.head);

  // A new entry (or a different one) replaces the draft.
  const [shownId, setShownId] = useState(initial.id);
  if (initial.id !== shownId) {
    setShownId(initial.id);
    setDraft(initial);
    setMoreOpen(focus === 'details');
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const fields = fieldsFor(spec, draft.kind, draft.fields);
  const main = fields.filter((f) => !f.more);
  const more = fields.filter((f) => f.more);
  const moreFilled = more.filter((f) => (draft.fields[f.key] ?? '').trim()).length;
  const counts = spec.counts(draft.kind);
  const nominee = takesNominee(draft);

  const set = (patch: Partial<Item>) => setDraft((d) => ({ ...d, ...patch }));
  const setField = (key: string, value: string) => setDraft((d) => ({ ...d, fields: { ...d.fields, [key]: value } }));

  // Opening at a check's "fix" scrolls to the part it is about.
  const valueRef = useRef<HTMLElement>(null);
  const detailsRef = useRef<HTMLElement>(null);
  const nomineeRef = useRef<HTMLElement>(null);
  const notesRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open || !focus) return;
    const target = { value: valueRef, details: detailsRef, nominee: nomineeRef, notes: notesRef }[focus];
    const t = window.setTimeout(() => target.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 260);
    return () => window.clearTimeout(t);
  }, [open, focus, initial.id]);

  const close = () => (dirty ? setConfirmClose(true) : onClose());

  const finished = (): Item => {
    // The value's date follows the value: if the figure changed, it is as of today
    // unless the person set a date themselves.
    const valueChanged = draft.value !== initial.value;
    const asOf = draft.value === null ? '' : valueChanged && draft.asOf === initial.asOf ? today : draft.asOf || today;
    return {
      ...draft,
      asOf,
      // Nominee details only mean something with a "yes".
      nominee: draft.nominee.status === 'yes' ? draft.nominee : { status: draft.nominee.status, people: [] },
    };
  };
  const save = () => onSave(finished());

  // Gold: weight × rate, when both are there.
  const grams = Number(draft.fields.grams ?? draft.fields.units ?? '');
  const rate = parseMoney(draft.fields.rate ?? '');
  const goldEstimate = spec.id === 'gold' && grams > 0 && typeof rate === 'number' && rate > 0 ? Math.round(grams * rate) : null;

  return (
    <>
      <CenterPanel
        open={open}
        onClose={close}
        footer={
          <div className="flex flex-wrap items-center gap-2">
            {!isNew && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="text-[var(--status-rejected)]">
                <Trash2 className="size-3.5" aria-hidden />
                Delete
              </Button>
            )}
            {guide && (
              <Button type="button" variant="ghost" size="sm" onClick={guide.onSkip}>
                Skip for now
              </Button>
            )}
            <div className="ml-auto flex flex-wrap justify-end gap-2">
              <Button type="button" onClick={close}>
                Cancel
              </Button>
              {isNew && !guide && onSaveAnother && (
                <Button type="button" onClick={() => onSaveAnother(finished())}>
                  Save and add another
                </Button>
              )}
              <Button type="submit" form="we-form" variant="primary">
                {guide && guide.step < guide.total ? 'Save and next' : isNew ? 'Add to record' : 'Save'}
              </Button>
            </div>
          </div>
        }
        title={isNew ? `Add ${spec.one}` : itemName(draft)}
        header={
          <div className="mt-3 flex flex-col gap-3">
            {guide && (
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                  <span
                    className="block h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
                    style={{ width: `${(guide.step / guide.total) * 100}%` }}
                  />
                </div>
                <span className="text-subtle text-xs tabular-nums">
                  {guide.step} of {guide.total}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <HeadTile id={spec.id} size="sm" />
              <p className="text-muted text-[13px]">{spec.name}</p>
            </div>
            {spec.kinds.length > 1 && (
              <div role="radiogroup" aria-label="Type" className="flex flex-wrap gap-1.5">
                {spec.kinds.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={draft.kind === k}
                    onClick={() => set({ kind: k })}
                    className={cn(
                      'rounded-full border px-3 py-1 text-[12.5px] font-medium transition',
                      draft.kind === k
                        ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--text-c)]'
                        : 'text-muted hover:bg-[var(--surface-sunken)]',
                    )}
                  >
                    {k}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      >
        <form
          id="we-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex min-h-full flex-col"
        >
          <div className="flex-1 space-y-8 pb-6">
            {/* ── The essentials ── */}
            <section ref={valueRef} aria-labelledby="we-essentials" className="scroll-mt-4 space-y-4">
              <h3 id="we-essentials" className="a-label">
                The essentials
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="What you call it" htmlFor="we-label" hint="Leave blank to use the suggestion">
                  <Input
                    id="we-label"
                    value={draft.label}
                    placeholder={spec.suggest(draft.kind, draft.fields) || `My ${spec.one}`}
                    onChange={(e) => set({ label: e.target.value })}
                  />
                </Field>
                <Field label="Held by" htmlFor="we-holder" hint={record.profile.members.length < 2 ? 'Add family members under Household' : undefined}>
                  <Select id="we-holder" value={draft.holder} onChange={(e) => set({ holder: e.target.value })}>
                    {record.profile.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {memberName(record.profile, m.id)}
                        {m.relation && m.relation !== 'Self' ? ` (${m.relation.toLowerCase()})` : ''}
                      </option>
                    ))}
                    {!record.profile.members.some((m) => m.id === draft.holder) && (
                      <option value={draft.holder}>Someone removed from the household</option>
                    )}
                  </Select>
                </Field>
              </div>

              {counts ? (
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                  <Field label={spec.valueLabel} htmlFor="we-value" hint={spec.valueHint}>
                    <MoneyInput id="we-value" value={draft.value} onChange={(v) => set({ value: v })} />
                  </Field>
                  <Field label="Value as on" htmlFor="we-asof" hint="Set to today when you change the value">
                    <Input id="we-asof" type="date" value={draft.asOf} max={today} onChange={(e) => set({ asOf: e.target.value })} />
                  </Field>
                </div>
              ) : (
                <Note icon={Info}>
                  {draft.kind} cover pays out only on a claim, so it has no value to add to your net worth today. It
                  stays in your record, with its nominee, because it is exactly what your family needs to know about.
                </Note>
              )}

              {goldEstimate !== null && goldEstimate !== draft.value && (
                <div className="surface-sunken flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5">
                  <p className="text-muted text-[13px]">
                    {grams} g × {rupees(rate as number)} a gram = <strong className="text-[var(--text-c)]">{rupees(goldEstimate)}</strong>
                  </p>
                  <Button type="button" size="sm" onClick={() => set({ value: goldEstimate })}>
                    <Calculator className="size-3.5" aria-hidden />
                    Use this value
                  </Button>
                </div>
              )}

              {spec.shared && counts && <ShareControl share={draft.share} onChange={(share) => set({ share })} side={spec.side} value={draft.value} />}
            </section>

            {/* ── The details ── */}
            <section ref={detailsRef} aria-labelledby="we-details" className="scroll-mt-4 space-y-4">
              <h3 id="we-details" className="a-label">
                Details
              </h3>
              <FieldGrid specs={main} fields={draft.fields} onField={setField} record={record} self={draft.id} kind={draft.kind} />

              {more.length > 0 && (
                <div className="surface-sunken rounded-2xl border">
                  <button
                    type="button"
                    aria-expanded={moreOpen}
                    onClick={() => setMoreOpen((o) => !o)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <span>
                      <span className="text-sm font-semibold">More details</span>
                      <span className="text-subtle ml-2 text-xs">
                        {moreFilled > 0 ? `${moreFilled} of ${more.length} filled` : `${more.length} optional`}
                      </span>
                    </span>
                    <ChevronDown className={cn('text-subtle size-4 transition-transform', moreOpen && 'rotate-180')} aria-hidden />
                  </button>
                  {moreOpen && (
                    <div className="border-t px-4 pt-4 pb-4">
                      <FieldGrid specs={more} fields={draft.fields} onField={setField} record={record} self={draft.id} kind={draft.kind} />
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── Nominee ── */}
            {nominee && (
              <section ref={nomineeRef} aria-labelledby="we-nominee" className="scroll-mt-4 space-y-4">
                <h3 id="we-nominee" className="a-label">
                  Nominee
                </h3>
                <NomineeSection
                  what={spec.one}
                  status={draft.nominee.status}
                  people={draft.nominee.people}
                  today={today}
                  onChange={(n) => set({ nominee: n })}
                  isLocker={spec.id === 'gold' && draft.fields.kept === 'Bank locker'}
                />
              </section>
            )}

            {/* ── Notes ── */}
            <section ref={notesRef} aria-labelledby="we-notes" className="scroll-mt-4 space-y-3">
              <h3 id="we-notes" className="a-label">
                Notes for whoever reads this
              </h3>
              <Textarea
                aria-labelledby="we-notes"
                value={draft.notes}
                rows={3}
                placeholder="Anything that would help: who to call, where a document is, what was agreed."
                onChange={(e) => set({ notes: e.target.value })}
              />
              {looksSecret(draft.notes) ? (
                <Note icon={ShieldAlert} tone="var(--status-rejected)">
                  {looksSecret(draft.notes)}
                </Note>
              ) : (
                <p className="text-subtle text-xs">Never write passwords, PINs, OTPs or a card’s full number here.</p>
              )}
            </section>
          </div>

        </form>
      </CenterPanel>

      <Modal
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title="Close without saving?"
        description="The changes you made to this entry will be lost."
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirmClose(false)}>Keep editing</Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmClose(false);
              onClose();
            }}
          >
            Discard changes
          </Button>
        </div>
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${itemName(draft)}?`}
        description="It is removed from this record on this device. A backup you downloaded earlier still has it."
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirmDelete(false)}>Keep it</Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmDelete(false);
              onDelete(draft.id);
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}

function Note({ icon: Icon, tone = 'var(--status-draft)', children }: { icon: typeof Info; tone?: string; children: React.ReactNode }) {
  return (
    <div
      style={{ '--tone': tone } as React.CSSProperties}
      className="tinted flex gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed"
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 text-[var(--text-c)]">{children}</div>
    </div>
  );
}

/**
 * "Your share" for joint accounts, co-owned property and shared loans. Three
 * taps cover nearly everyone: all of it, half, or a number.
 */
function ShareControl({
  share,
  onChange,
  side,
  value,
}: {
  share: number;
  onChange: (n: number) => void;
  side: 'asset' | 'liability';
  value: number | null;
}) {
  const preset = share === 100 ? 'all' : share === 50 ? 'half' : 'other';
  const [other, setOther] = useState(preset === 'other');
  const choice = other ? 'other' : preset;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{side === 'asset' ? 'Your share of it' : 'Your share of the loan'}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['all', 'All of it', 100],
            ['half', 'Half', 50],
          ] as const
        ).map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            aria-pressed={choice === key}
            onClick={() => {
              setOther(false);
              onChange(n);
            }}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
              choice === key ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]' : 'hover:bg-[var(--surface-sunken)]',
            )}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={choice === 'other'}
          onClick={() => setOther(true)}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
            choice === 'other' ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]' : 'hover:bg-[var(--surface-sunken)]',
          )}
        >
          Another share
        </button>
        {choice === 'other' && (
          <span className="flex items-center gap-1.5">
            <Input
              aria-label="Your share, per cent"
              inputMode="decimal"
              className="w-20"
              value={String(share)}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n > 0 && n <= 100) onChange(n);
              }}
            />
            <span className="text-muted text-sm">%</span>
          </span>
        )}
      </div>
      <p className="text-subtle text-xs">
        {share === 100
          ? 'The whole value counts towards your net worth.'
          : value !== null
            ? `${share}% of it, ${rupees(Math.round((value * share) / 100))}, counts towards your net worth.`
            : `${share}% of the value will count towards your net worth.`}
      </p>
    </fieldset>
  );
}

function FieldGrid({
  specs,
  fields,
  onField,
  record,
  self,
  kind,
}: {
  specs: FieldSpec[];
  fields: Fields;
  onField: (key: string, value: string) => void;
  record: WealthRecord;
  self: string;
  kind: string;
}) {
  if (specs.length === 0) return <p className="text-subtle text-sm">Nothing more to add for {kind.toLowerCase()}.</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {specs.map((f) => (
        <FieldInput key={f.key} spec={f} value={fields[f.key] ?? ''} onChange={(v) => onField(f.key, v)} record={record} self={self} />
      ))}
    </div>
  );
}

function FieldInput({
  spec,
  value,
  onChange,
  record,
  self,
}: {
  spec: FieldSpec;
  value: string;
  onChange: (v: string) => void;
  record: WealthRecord;
  self: string;
}) {
  const id = `wf-${spec.key}`;
  const error = value && spec.check ? (spec.check(value) ?? undefined) : undefined;
  const wide = spec.wide || spec.kind === 'textarea';
  const common = { id, 'aria-invalid': error ? true : undefined };

  let control: React.ReactNode;
  switch (spec.kind) {
    case 'textarea':
      control = <Textarea {...common} rows={2} value={value} placeholder={spec.placeholder} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'select':
      control = (
        <Select {...common} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {spec.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      );
      break;
    case 'date':
      control = <Input {...common} type="date" value={value} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'money': {
      const n = parseMoney(value);
      control = (
        <MoneyInput
          id={id}
          value={typeof n === 'number' ? n : null}
          onChange={(v) => onChange(v === null ? '' : String(v))}
          placeholder={spec.placeholder ?? 'e.g. 25,000'}
        />
      );
      break;
    }
    case 'secret':
      control = (
        <SecretInput id={id} value={value} placeholder={spec.placeholder} inputMode={spec.inputMode} invalid={!!error} onChange={(v) => onChange(spec.upper ? v.toUpperCase() : v)} />
      );
      break;
    case 'lastFour':
      control = (
        <Input
          {...common}
          inputMode="numeric"
          autoComplete="off"
          maxLength={19}
          value={value}
          placeholder="1234"
          onChange={(e) => onChange(keepLastFour(e.target.value))}
          className="w-28 font-mono tracking-[0.2em]"
        />
      );
      break;
    case 'link': {
      const options = record.items.filter((i) => i.id !== self && spec.linkHeads?.includes(i.head));
      control = (
        <Select {...common} value={value} onChange={(e) => onChange(e.target.value)} disabled={options.length === 0}>
          <option value="">{options.length === 0 ? 'Nothing to link yet' : 'Choose…'}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {itemName(o)}
            </option>
          ))}
        </Select>
      );
      break;
    }
    case 'percent':
      control = (
        <div className="relative">
          <Input {...common} inputMode="decimal" value={value} placeholder={spec.placeholder} onChange={(e) => onChange(e.target.value)} className="pr-8" />
          <span aria-hidden className="text-subtle pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
            %
          </span>
        </div>
      );
      break;
    default:
      control = (
        <Input
          {...common}
          inputMode={spec.inputMode}
          value={value}
          placeholder={spec.placeholder}
          autoComplete="off"
          onChange={(e) => onChange(spec.upper ? e.target.value.toUpperCase() : e.target.value)}
        />
      );
  }

  return (
    <Field label={spec.label} htmlFor={id} hint={spec.hint} error={error} className={wide ? 'sm:col-span-2' : undefined}>
      {control}
    </Field>
  );
}

/**
 * Whether a nominee is registered, and who. "Not sure" is a real answer here:
 * most people do not know, and the checks then say how to find out.
 */
function NomineeSection({
  what,
  status,
  people,
  today,
  onChange,
  isLocker,
}: {
  what: string;
  status: NomineeStatus;
  people: Nominee[];
  today: string;
  onChange: (n: { status: NomineeStatus; people: Nominee[] }) => void;
  isLocker: boolean;
}) {
  const choose = (s: NomineeStatus) =>
    onChange({ status: s, people: s === 'yes' && people.length === 0 ? [blankNominee()] : people });
  const setPerson = (id: string, patch: Partial<Nominee>) =>
    onChange({ status, people: people.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  const named = people.filter((p) => p.name.trim() || p.share.trim());
  const shares = named.map((p) => p.share.trim()).filter(Boolean);
  const total = shares.reduce((s, x) => s + (Number(x.replace('%', '')) || 0), 0);
  const sharesOff = people.length > 1 && shares.length > 0 && (shares.length < named.length || Math.round(total * 100) / 100 !== 100);

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium">
          Is a nominee registered on this {isLocker ? 'locker' : what}?
        </legend>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:max-w-md">
          {(
            [
              ['yes', 'Yes'],
              ['no', 'No'],
              ['unsure', 'Not sure'],
            ] as const
          ).map(([s, label]) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => choose(s)}
              className={cn(
                'rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
                status === s
                  ? s === 'no'
                    ? 'border-[var(--status-rejected)] bg-[color-mix(in_oklab,var(--status-rejected)_10%,transparent)]'
                    : 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]'
                  : 'hover:bg-[var(--surface-sunken)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {status === 'no' && (
        <Note icon={ShieldAlert} tone="var(--status-rejected)">
          Without a nominee, your family usually has to prove they are your legal heirs before anything is released,
          which can take months. Adding one is a short form with the provider, often online, and costs nothing.
        </Note>
      )}
      {status === 'unsure' && (
        <Note icon={Info}>
          The provider’s app, net banking or the account statement usually shows the nominee. You can come back and
          answer this once you have looked.
        </Note>
      )}

      {status === 'yes' && (
        <div className="space-y-3">
          {people.map((p, i) => {
            const age = ageOn(p.dob, today);
            const minor = age !== null && age < 18;
            return (
              <div key={p.id} className="surface-sunken relative rounded-2xl border p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <UserRound className="text-subtle size-4" aria-hidden />
                    {people.length > 1 ? `Nominee ${i + 1}` : 'Nominee'}
                    {minor && (
                      <span className="text-subtle text-xs font-normal">· a minor, aged {age}</span>
                    )}
                  </p>
                  {people.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onChange({ status, people: people.filter((x) => x.id !== p.id) })}
                      className="text-subtle -m-1 rounded-md p-1 transition hover:bg-[var(--surface-raised)] hover:text-[var(--text-c)]"
                      aria-label={`Remove nominee ${i + 1}`}
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name" htmlFor={`nm-${p.id}`}>
                    <Input id={`nm-${p.id}`} value={p.name} onChange={(e) => setPerson(p.id, { name: e.target.value })} />
                  </Field>
                  <Field label="Relation" htmlFor={`nr-${p.id}`}>
                    <Select id={`nr-${p.id}`} value={p.relation} onChange={(e) => setPerson(p.id, { relation: e.target.value })}>
                      <option value="">Choose…</option>
                      {RELATIONS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Date of birth" htmlFor={`nd-${p.id}`} hint="Tells us if they are a minor">
                    <Input id={`nd-${p.id}`} type="date" max={today} value={p.dob} onChange={(e) => setPerson(p.id, { dob: e.target.value })} />
                  </Field>
                  {people.length > 1 && (
                    <Field label="Share" htmlFor={`ns-${p.id}`} hint="Per cent; all shares add to 100">
                      <Input id={`ns-${p.id}`} inputMode="decimal" value={p.share} onChange={(e) => setPerson(p.id, { share: e.target.value })} />
                    </Field>
                  )}
                  {minor && (
                    <Field
                      label="Guardian"
                      htmlFor={`ng-${p.id}`}
                      hint="Who receives it for them until they turn 18"
                      error={p.guardian.trim() ? undefined : 'A minor nominee needs a guardian named with the provider.'}
                      className="sm:col-span-2"
                    >
                      <Input id={`ng-${p.id}`} value={p.guardian} onChange={(e) => setPerson(p.id, { guardian: e.target.value })} />
                    </Field>
                  )}
                  <Field label="Phone" htmlFor={`np-${p.id}`} hint="Optional">
                    <Input id={`np-${p.id}`} type="tel" inputMode="tel" value={p.phone} onChange={(e) => setPerson(p.id, { phone: e.target.value })} />
                  </Field>
                </div>
              </div>
            );
          })}

          {sharesOff && (
            <p role="alert" className="text-sm font-medium text-[var(--status-rejected)]">
              {shares.length < named.length
                ? 'Give every nominee a share, or leave all the shares blank.'
                : `The shares add up to ${Math.round(total * 100) / 100}%. They should add up to 100%.`}
            </p>
          )}

          <Button type="button" size="sm" onClick={() => onChange({ status, people: [...people, blankNominee()] })}>
            <Plus className="size-3.5" aria-hidden />
            Add another nominee
          </Button>
        </div>
      )}
    </div>
  );
}
