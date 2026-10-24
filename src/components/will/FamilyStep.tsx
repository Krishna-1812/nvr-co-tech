'use client';

import { useState } from 'react';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { removePerson, setPerson, usesOf } from '@/lib/will/edit';
import { blankPerson, isMinor, RELATIONS, type Person, type Relation } from '@/lib/will/model';
import { FocusCard, StepFindings, StepHead, type StepProps } from './shared';

/**
 * Step two: everyone the will will name.
 *
 * People are entered once, here, and chosen from this list everywhere else:
 * as someone who gets a gift, an executor, a guardian or a witness. That is
 * what lets the checks say "your witness is also getting a gift" without
 * guessing from how a name was spelled.
 */
export function FamilyStep({ record, update, findings, today, focus }: StepProps) {
  const [confirming, setConfirming] = useState<string | null>(null);

  const add = (relation: Relation) => update((r) => setPerson(r, blankPerson(relation)));
  const edit = (p: Person, patch: Partial<Person>) => update((r) => setPerson(r, { ...p, ...patch }));

  return (
    <div>
      <StepHead title="The people in your will">
        Add everyone who will be named: family, the person who will carry out the will, someone to look after your
        children, and your two witnesses. You will choose from this list on the next steps.
      </StepHead>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => add('Spouse')} disabled={record.people.some((p) => p.relation === 'Spouse')}>
          <UserPlus className="size-4" aria-hidden />
          Spouse
        </Button>
        <Button onClick={() => add('Son')}>
          <Plus className="size-4" aria-hidden />
          Son
        </Button>
        <Button onClick={() => add('Daughter')}>
          <Plus className="size-4" aria-hidden />
          Daughter
        </Button>
        <Button onClick={() => add('Other')}>
          <Plus className="size-4" aria-hidden />
          Someone else
        </Button>
      </div>

      {record.people.length === 0 ? (
        <p className="text-muted surface-sunken mt-5 rounded-2xl border px-4 py-6 text-center text-sm">
          Nobody added yet. Start with your spouse and children, then add anyone else you want to name.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {record.people.map((p) => {
            const uses = usesOf(record, p.id);
            const minor = isMinor(p, today);
            return (
              <li key={p.id}>
                <FocusCard id={p.id} focused={focus?.personId === p.id}>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <Field label="Name" htmlFor={`p-${p.id}-n`}>
                      <Input id={`p-${p.id}-n`} value={p.name} onChange={(e) => edit(p, { name: e.target.value })} autoComplete="off" />
                    </Field>
                    <Field label="Who they are to you" htmlFor={`p-${p.id}-r`}>
                      <Select id={`p-${p.id}-r`} value={p.relation} onChange={(e) => edit(p, { relation: e.target.value as Relation })}>
                        {RELATIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Date of birth" htmlFor={`p-${p.id}-d`} hint={minor ? 'Under 18' : undefined}>
                      <Input id={`p-${p.id}-d`} type="date" max={today} value={p.dob} onChange={(e) => edit(p, { dob: e.target.value })} />
                    </Field>
                    <Field
                      label="Address"
                      htmlFor={`p-${p.id}-a`}
                      hint="Needed for an executor, guardian or witness, so they can be found."
                      className="sm:col-span-3"
                    >
                      <Textarea id={`p-${p.id}-a`} rows={2} value={p.address} onChange={(e) => edit(p, { address: e.target.value })} />
                    </Field>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]">
                    <span className="text-muted min-w-0 flex-1">
                      {uses.length > 0 ? `Named in this will as: ${uses.join(', ')}.` : 'Not named anywhere in the will yet.'}
                    </span>
                    {confirming === p.id ? (
                      <>
                        <span className="text-muted">
                          {uses.length > 0 ? 'Removing them also removes those.' : 'Remove them?'}
                        </span>
                        <Button size="sm" variant="danger" onClick={() => (update((r) => removePerson(r, p.id)), setConfirming(null))}>
                          Remove
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                          Keep
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setConfirming(p.id)} aria-label={`Remove ${p.name || 'this person'}`}>
                        <Trash2 className="size-3.5" aria-hidden />
                        Remove
                      </Button>
                    )}
                  </div>
                </FocusCard>
              </li>
            );
          })}
        </ul>
      )}

      <StepFindings findings={findings} step="family" />
    </div>
  );
}
