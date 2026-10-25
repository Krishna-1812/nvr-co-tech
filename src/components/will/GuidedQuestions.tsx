'use client';

import { useState } from 'react';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { assetLabel, describeAsset } from '@/lib/will/clauses';
import { removePerson, setAsset, setPerson, setResidue, setRole, type Role } from '@/lib/will/edit';
import { fromWealth, importFromWealth } from '@/lib/will/fromWealth';
import {
  applyResiduePreset,
  currentResiduePreset,
  giveTo,
  recipientOf,
  setSoleBackup,
  residueOptions,
  type ResiduePreset,
} from '@/lib/will/guided';
import { RELIGIONS, scopeOf, type Religion } from '@/lib/will/law';
import { ASSET_KIND_LABELS, ASSET_KINDS, blankAsset, blankPerson, isMinor, personName, RELATIONS, type AssetKind, type Person, type Relation, type WillRecord } from '@/lib/will/model';
import type { WealthRecord } from '@/lib/wealth/model';
import { SharesEditor } from './SharesEditor';
import { Choice, Notice, PersonSelect } from './shared';

/**
 * One file for the guided questions, each a small component over the same record the detailed
 * form edits. A question asks for one thing in plain words, says why, and saves as you go.
 * What each answer means for the will is decided in lib/will/guided and lib/will/edit, not here.
 */

export type QProps = {
  record: WillRecord;
  update: (fn: (r: WillRecord) => WillRecord) => void;
  today: string;
  /** Jump to another question (a hint that says "add your family first" takes you there). */
  go: (id: 'family' | 'everything') => void;
};

const RELIGION_OPTIONS = RELIGIONS.map((r) => ({ value: r, label: r }));

/** A question's heading and the one sentence of why. */
export function Ask({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-5">
      <h2 className="text-[1.45rem] leading-tight font-semibold tracking-tight text-balance sm:text-[1.7rem]">{title}</h2>
      {children && <p className="text-muted mt-2 max-w-xl text-[15px] leading-relaxed text-pretty">{children}</p>}
    </header>
  );
}

// ── About you ───────────────────────────────────────────────────────────────

export function NameQ({ record, update }: QProps) {
  const t = record.testator;
  return (
    <div>
      <Ask title="What is your full name?">As it appears on your identity documents. The will opens with it.</Ask>
      <Field label="Full name" htmlFor="g-name" required>
        <Input id="g-name" value={t.name} autoComplete="name" onChange={(e) => update((r) => ({ ...r, testator: { ...r.testator, name: e.target.value } }))} />
      </Field>
    </div>
  );
}

export function BornQ({ record, update, today }: QProps) {
  const t = record.testator;
  const set = (patch: Partial<typeof t>) => update((r) => ({ ...r, testator: { ...r.testator, ...patch } }));
  return (
    <div>
      <Ask title="When were you born, and which religion’s law applies to you?">
        Only an adult can make a will, and the rules differ by religion, so we ask both before anything else.
      </Ask>
      <div className="space-y-5">
        <Field label="Date of birth" htmlFor="g-dob">
          <Input id="g-dob" type="date" max={today} value={t.dob} autoComplete="bday" onChange={(e) => set({ dob: e.target.value })} className="sm:max-w-xs" />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium">Religion</p>
          <Choice name="g-religion" label="Religion" value={t.religion} options={RELIGION_OPTIONS} onChange={(v: Religion) => set({ religion: v })} />
        </div>
      </div>
    </div>
  );
}

export function HomeQ({ record, update }: QProps) {
  const t = record.testator;
  const set = (patch: Partial<typeof t>) => update((r) => ({ ...r, testator: { ...r.testator, ...patch } }));
  return (
    <div>
      <Ask title="Where do you live?">The will says where you live, so whoever reads it can tell you from someone with the same name.</Ask>
      <div className="space-y-4">
        <Field label="Your address" htmlFor="g-address">
          <Textarea id="g-address" rows={3} value={t.address} autoComplete="street-address" onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <Field label="State" htmlFor="g-state" hint="Goa follows its own succession law.">
          <Input id="g-state" value={t.state} autoComplete="address-level1" onChange={(e) => set({ state: e.target.value })} className="sm:max-w-xs" />
        </Field>
      </div>
    </div>
  );
}

// ── Your family ─────────────────────────────────────────────────────────────

const ADDABLE: { relation: Relation; label: string }[] = [
  { relation: 'Spouse', label: 'My husband or wife' },
  { relation: 'Son', label: 'A son' },
  { relation: 'Daughter', label: 'A daughter' },
  { relation: 'Mother', label: 'My mother' },
  { relation: 'Father', label: 'My father' },
  { relation: 'Other', label: 'Someone else' },
];

export function FamilyQ({ record, update, today }: QProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const edit = (p: Person, patch: Partial<Person>) => update((r) => setPerson(r, { ...p, ...patch }));
  const hasSpouse = record.people.some((p) => p.relation === 'Spouse');
  return (
    <div>
      <Ask title="Who is in your family?">
        Add your husband or wife and your children, and anyone else you want to name. You can add more people later, wherever you need them.
      </Ask>

      <div className="flex flex-wrap gap-2">
        {ADDABLE.map((a) => (
          <Button key={a.relation} size="sm" variant={a.relation === 'Spouse' && !hasSpouse ? 'primary' : 'secondary'} disabled={a.relation === 'Spouse' && hasSpouse} onClick={() => update((r) => setPerson(r, blankPerson(a.relation)))}>
            <Plus className="size-3.5" aria-hidden />
            {a.label}
          </Button>
        ))}
      </div>

      {record.people.length === 0 ? (
        <p className="text-muted surface-sunken mt-5 rounded-2xl border px-4 py-6 text-center text-sm">
          Nobody yet. Tap who to add. If you have no family to name, you can skip this and choose someone else on the next question.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {record.people.map((p) => {
            const kid = p.relation === 'Son' || p.relation === 'Daughter' || p.relation === 'Grandchild';
            return (
              <li key={p.id} className="surface-sunken rounded-2xl border p-4">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                  <Field label={`${p.relation === 'Other' ? 'Name' : `${p.relation}’s name`}`} htmlFor={`g-p-${p.id}`}>
                    <Input id={`g-p-${p.id}`} value={p.name} autoComplete="off" onChange={(e) => edit(p, { name: e.target.value })} />
                  </Field>
                  {p.relation === 'Other' ? (
                    <Field label="Who they are to you" htmlFor={`g-r-${p.id}`}>
                      <Select id={`g-r-${p.id}`} value={p.relation} onChange={(e) => edit(p, { relation: e.target.value as Relation })}>
                        {RELATIONS.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </Select>
                    </Field>
                  ) : kid ? (
                    <Field label="Date of birth" htmlFor={`g-d-${p.id}`} hint={isMinor(p, today) ? 'Under 18: we will ask who looks after them.' : 'Optional'}>
                      <Input id={`g-d-${p.id}`} type="date" max={today} value={p.dob} onChange={(e) => edit(p, { dob: e.target.value })} />
                    </Field>
                  ) : null}
                </div>
                <div className="mt-2 flex justify-end">
                  {confirming === p.id ? (
                    <span className="flex items-center gap-2 text-[12.5px]">
                      <span className="text-muted">Remove them from the will?</span>
                      <Button size="sm" variant="danger" onClick={() => (update((r) => removePerson(r, p.id)), setConfirming(null))}>
                        Remove
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                        Keep
                      </Button>
                    </span>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(p.id)} aria-label={`Remove ${personName(p)}`}>
                      <Trash2 className="size-3.5" aria-hidden />
                      Remove
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Who gets everything ─────────────────────────────────────────────────────

export function EverythingQ({ record, update, go }: QProps) {
  const options = residueOptions(record);
  const current = currentResiduePreset(record);
  const spouse = record.people.find((p) => p.relation === 'Spouse');
  const kids = record.people.filter((p) => p.relation === 'Son' || p.relation === 'Daughter');
  const label = (id: ResiduePreset): { title: string; detail?: string } => {
    const sp = spouse ? personName(spouse) : '';
    switch (id) {
      case 'spouse':
        return { title: `Everything to ${sp || 'my husband or wife'}` };
      case 'spouse-children': {
        const n = kids.length + 1;
        return { title: `Share equally between ${sp || 'my husband or wife'} and my ${kids.length === 1 ? 'child' : 'children'}`, detail: `${n} people, about ${Math.round((100 / n) * 100) / 100}% each` };
      }
      case 'children':
        return { title: `Share equally between my ${kids.length === 1 ? 'child' : 'children'}`, detail: kids.length > 1 ? `${kids.length} people, about ${Math.round((100 / kids.length) * 100) / 100}% each` : undefined };
      case 'custom':
        return { title: 'Someone else, or a different split', detail: 'Choose the people and the shares yourself' };
    }
  };
  const choose = (id: ResiduePreset) => update((r) => (id === 'custom' ? (currentResiduePreset(r) === 'custom' ? r : setResidue(r, [])) : applyResiduePreset(r, id)));
  const sole = current === 'spouse' ? record.residue[0] : null;

  return (
    <div>
      <Ask title="Who gets everything you own?">
        This covers whatever you do not give to someone by name below: what you buy later, accounts you forget, and any gift that cannot go ahead.
      </Ask>

      {record.people.length === 0 && (
        <div className="mb-4">
          <Notice tone="var(--status-draft)">
            Add your family first, or pick “someone else” and add people there.{' '}
            <button type="button" className="font-semibold underline underline-offset-2" onClick={() => go('family')}>
              Add family
            </button>
          </Notice>
        </div>
      )}

      <div role="radiogroup" aria-label="Who gets everything" className="space-y-2.5">
        {options.map((o) => {
          const { title, detail } = label(o.id);
          const on = (o.id === 'custom' && current === 'custom') || current === o.id;
          return (
            <label key={o.id} className="cursor-pointer">
              <input type="radio" name="g-everything" className="peer sr-only" checked={on} onChange={() => choose(o.id)} />
              <span className="surface-sunken block rounded-2xl border px-4 py-3.5 transition peer-checked:border-[var(--accent)] peer-checked:bg-[var(--surface-raised)] peer-checked:ring-2 peer-checked:ring-[var(--accent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)] hover:border-[var(--border-strong)]">
                <span className="block text-[15px] font-medium">{title}</span>
                {detail && <span className="text-muted mt-0.5 block text-[13px]">{detail}</span>}
              </span>
            </label>
          );
        })}
      </div>

      {sole && (
        <div className="mt-5">
          <p className="mb-1.5 text-sm font-medium">If {personName(spouse)} is not alive when you die, who should get it instead?</p>
          <PersonSelect
            record={record}
            value={sole.alternateId}
            exclude={[sole.personId]}
            placeholder="Nobody chosen (optional)"
            aria-label="Who gets it instead"
            onChange={(id) => update((r) => setSoleBackup(r, id))}
          />
          <p className="text-subtle mt-1.5 text-xs">Without a backup, a gift to someone who dies before you simply fails.</p>
        </div>
      )}

      {current === 'custom' && (
        <div className="mt-5">
          <SharesEditor record={record} shares={record.residue} onChange={(s) => update((r) => setResidue(r, s))} onNeedPeople={() => go('family')} />
        </div>
      )}
    </div>
  );
}

// ── A particular thing for a particular person ──────────────────────────────

export function GiftsQ({ record, update, go, wealth }: QProps & { wealth: WealthRecord | null }) {
  const [kind, setKind] = useState<AssetKind>('property');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [note, setNote] = useState('');
  const add = () => {
    if (!title.trim()) return;
    update((r) => setAsset(r, { ...blankAsset(kind), title: title.trim(), details: details.trim() }));
    setTitle('');
    setDetails('');
  };
  const importable = wealth ? fromWealth(wealth).assets.filter((a) => !record.assets.some((x) => x.id === a.id)).length : 0;

  return (
    <div>
      <Ask title="Is there anything you want to give to someone in particular?">
        Optional. A flat to your daughter, a car to a friend. Anything you do not list goes as you chose on the last question. Skip this if you want everything to go as one.
      </Ask>

      {record.people.length === 0 && (
        <div className="mb-4">
          <Notice tone="var(--status-draft)">
            Add the people first.{' '}
            <button type="button" className="font-semibold underline underline-offset-2" onClick={() => go('family')}>
              Add family
            </button>
          </Notice>
        </div>
      )}

      {record.assets.length > 0 && (
        <ul className="mb-5 space-y-3">
          {record.assets.map((a) => {
            const who = recipientOf(record, a.id);
            return (
              <li key={a.id} className="surface-sunken rounded-2xl border p-4">
                <p className="text-[15px] font-medium">{assetLabel(a)}</p>
                {describeAsset(a) && <p className="text-muted text-[13px]">{describeAsset(a)}</p>}
                <div className="mt-2.5 flex items-center gap-2">
                  {who === 'many' ? (
                    <p className="text-muted text-[13px]">Shared between several people. Change this in the detailed view.</p>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <PersonSelect record={record} value={who} placeholder="Goes with everything else" aria-label={`Who gets ${assetLabel(a)}`} onChange={(id) => update((r) => giveTo(r, a.id, id))} />
                    </div>
                  )}
                  <Button size="sm" variant="ghost" aria-label={`Remove ${assetLabel(a)}`} onClick={() => update((r) => ({ ...r, assets: r.assets.filter((x) => x.id !== a.id), gifts: r.gifts.filter((g) => g.assetId !== a.id) }))}>
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {importable > 0 && wealth && (
        <div className="mb-4">
          <Button
            onClick={() => {
              let added = 0;
              update((r) => {
                const out = importFromWealth(r, wealth);
                added = out.added.assets;
                return out.record;
              });
              setNote(`Brought in ${added} from Wealth Tracker.`);
            }}
          >
            Bring in what I own from Wealth Tracker ({importable})
          </Button>
          {note && <p role="status" className="text-muted mt-2 text-[13px]">{note}</p>}
        </div>
      )}

      <fieldset className="surface-sunken rounded-2xl border p-4">
        <legend className="a-label px-1">Add something</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="What is it?" htmlFor="g-asset-title" className="sm:col-span-2">
            <Input id="g-asset-title" value={title} placeholder="For example: my flat in Pune" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
          </Field>
          <Field label="Kind" htmlFor="g-asset-kind">
            <Select id="g-asset-kind" value={kind} onChange={(e) => setKind(e.target.value as AssetKind)}>
              {ASSET_KINDS.map((k) => (
                <option key={k} value={k}>
                  {ASSET_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="How to find it" htmlFor="g-asset-details" hint="Address, bank and account number, folio.">
            <Input id="g-asset-details" value={details} onChange={(e) => setDetails(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
          </Field>
        </div>
        <Button className="mt-3" onClick={add} disabled={!title.trim()}>
          <Plus className="size-4" aria-hidden />
          Add it
        </Button>
      </fieldset>
    </div>
  );
}

// ── Who carries it out ──────────────────────────────────────────────────────

const NEW_RELATIONS: Relation[] = ['Friend', 'Brother', 'Sister', 'Father', 'Mother', 'Other relative', 'Professional', 'Other'];

/**
 * Choose a person from the list, or add somebody new on the spot. A will names people who may
 * not be family (a friend as executor, two neighbours as witnesses), so a question that sent
 * you back to a list to add them first would be where people stop.
 */
function PersonPicker({
  record,
  update,
  value,
  onChange,
  exclude,
  label,
  placeholder,
  newRelation = 'Friend',
}: {
  record: WillRecord;
  update: QProps['update'];
  value: string;
  onChange: (id: string) => void;
  exclude: string[];
  label: string;
  placeholder: string;
  newRelation?: Relation;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<Relation>(newRelation);
  const create = () => {
    if (!name.trim()) return;
    const p: Person = { ...blankPerson(relation), name: name.trim() };
    update((r) => setPerson(r, p));
    onChange(p.id);
    setName('');
    setAdding(false);
  };
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <PersonSelect record={record} value={value} exclude={exclude} placeholder={placeholder} aria-label={label} onChange={onChange} />
        </div>
        <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)} aria-expanded={adding} aria-label="Add someone new" title="Add someone new">
          <UserPlus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Add someone new</span>
        </Button>
      </div>
      {adding && (
        <div className="surface-sunken mt-2.5 grid gap-3 rounded-2xl border p-3.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-end">
          <Field label="Name" htmlFor={`g-new-${label}`}>
            <Input id={`g-new-${label}`} value={name} autoComplete="off" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), create())} />
          </Field>
          <Field label="Who they are to you" htmlFor={`g-newrel-${label}`}>
            <Select id={`g-newrel-${label}`} value={relation} onChange={(e) => setRelation(e.target.value as Relation)}>
              {NEW_RELATIONS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          </Field>
          <Button variant="primary" onClick={create} disabled={!name.trim()}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

/** Sets one place in a role (first, second, …), keeping the rest and dropping blanks and doubles. */
function setSlot(update: QProps['update'], role: Role, slot: number, id: string) {
  update((r) => {
    const ids = [...r[role]];
    while (ids.length < slot) ids.push('');
    ids[slot] = id;
    return setRole(r, role, ids);
  });
}

export function ExecutorQ({ record, update }: QProps) {
  const [a, b] = record.executorIds;
  return (
    <div>
      <Ask title="Who will carry out your will?">
        The executor finds what you own, settles what is owed and hands things on. It is not compulsory, but without one your family has to ask a court for the power to act.
      </Ask>
      <div className="space-y-5">
        <PersonPicker record={record} update={update} value={a ?? ''} exclude={b ? [b] : []} label="Executor" placeholder="Choose someone" onChange={(id) => setSlot(update, 'executorIds', 0, id)} />
        {a && <PersonPicker record={record} update={update} value={b ?? ''} exclude={[a]} label="If they cannot act, then (optional)" placeholder="Nobody chosen" onChange={(id) => setSlot(update, 'executorIds', 1, id)} />}
      </div>
    </div>
  );
}

export function GuardianQ({ record, update, today }: QProps) {
  const minors = record.people.filter((p) => isMinor(p, today));
  const [a, b] = record.guardianIds;
  return (
    <div>
      <Ask title={`Who will look after ${minors.length === 1 ? personName(minors[0]) : 'your children under 18'}?`}>
        If neither parent is alive, a guardian looks after a child who is still under 18. Optional, but without one a court decides.
      </Ask>
      <div className="space-y-5">
        <PersonPicker record={record} update={update} value={a ?? ''} exclude={b ? [b] : []} label="Guardian" placeholder="Choose someone" onChange={(id) => setSlot(update, 'guardianIds', 0, id)} />
        {a && <PersonPicker record={record} update={update} value={b ?? ''} exclude={[a]} label="If they cannot act, then (optional)" placeholder="Nobody chosen" onChange={(id) => setSlot(update, 'guardianIds', 1, id)} />}
      </div>
    </div>
  );
}

export function WitnessesQ({ record, update, findings }: QProps & { findings: { id: string; title: string; detail: string }[] }) {
  const [a, b] = record.witnessIds;
  const clash = findings.filter((f) => f.id.startsWith('witness-beneficiary:'));
  return (
    <div>
      <Ask title="Who will watch you sign?">
        Two adults who see you sign. They must not be anyone who gets something under the will, or married to one. You can leave this blank and write their names on the day.
      </Ask>
      <div className="space-y-5">
        <PersonPicker record={record} update={update} value={a ?? ''} exclude={b ? [b] : []} label="First witness" placeholder="Decide on the day" onChange={(id) => setSlot(update, 'witnessIds', 0, id)} />
        <PersonPicker record={record} update={update} value={b ?? ''} exclude={a ? [a] : []} label="Second witness" placeholder="Decide on the day" onChange={(id) => setSlot(update, 'witnessIds', 1, id)} />
      </div>
      {clash.map((f) => (
        <div key={f.id} className="mt-4">
          <Notice tone="var(--status-rejected)">
            <strong>{f.title}.</strong> {f.detail}
          </Notice>
        </div>
      ))}
    </div>
  );
}

// ── The last question ───────────────────────────────────────────────────────

export function ConfirmQ({ record, update }: QProps) {
  const t = record.testator;
  const set = (patch: Partial<typeof t>) => update((r) => ({ ...r, testator: { ...r.testator, ...patch } }));
  const everyone = (ids: string[]) => ids.map((id) => personName(record.people.find((p) => p.id === id))).join(' and ');
  const rows: [string, string][] = [
    ['Everything else goes to', record.residue.length > 0 ? record.residue.map((s) => personName(record.people.find((p) => p.id === s.personId))).join(', ') : 'nobody chosen yet'],
    ['Given by name', record.gifts.length > 0 ? `${record.gifts.length} ${record.gifts.length === 1 ? 'thing' : 'things'}` : 'nothing'],
    ['Executor', record.executorIds.length > 0 ? everyone(record.executorIds.slice(0, 1)) : 'not chosen'],
    ['Witnesses', record.witnessIds.length > 0 ? everyone(record.witnessIds) : 'to be decided on the day'],
  ];
  return (
    <div>
      <Ask title="One last thing, and it is yours to say.">Tick these only if they are true. They are what makes the will yours.</Ask>
      <fieldset>
        <legend className="sr-only">Two things only you can say</legend>
        <div className="space-y-2">
          <label className="surface-sunken flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3.5 text-[15px]">
            <input type="checkbox" checked={t.soundMind} onChange={(e) => set({ soundMind: e.target.checked })} className="mt-1 size-4 shrink-0 accent-[var(--accent)]" />
            <span>I am of sound mind and understand what a will does.</span>
          </label>
          <label className="surface-sunken flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3.5 text-[15px]">
            <input type="checkbox" checked={t.voluntary} onChange={(e) => set({ voluntary: e.target.checked })} className="mt-1 size-4 shrink-0 accent-[var(--accent)]" />
            <span>I am making this will freely. Nobody is pressing me.</span>
          </label>
        </div>
      </fieldset>

      <dl className="mt-6 space-y-1.5 text-[14px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-wrap gap-x-2">
            <dt className="text-muted">{k}:</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Why a will cannot be made here, in the person’s own terms, with the way forward. */
export function outOfScopeReasons(r: WillRecord, today: string) {
  return scopeOf(r.testator, today).reasons.filter((x) => x.level === 'out');
}

