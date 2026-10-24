'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { setRole, type Role } from '@/lib/will/edit';
import { LAW } from '@/lib/will/law';
import { PersonSelect, StepFindings, StepHead, type StepProps } from './shared';

/**
 * Step six: the people who carry the will out.
 *
 * An executor acts on the will; a guardian looks after children who are still
 * minors; witnesses see the will signed. Each role is an ordered list: the
 * first person acts, and the next takes over if they cannot. Everyone is
 * chosen from the list on step two, so the checks know who they are.
 */
export function PeopleStep({ record, update, findings, go }: StepProps) {
  const noPeople = record.people.length === 0;

  return (
    <div>
      <StepHead title="Who carries it out">
        Choose from the people you added. If you have not added them yet, do that first.
      </StepHead>

      {noPeople && (
        <div className="surface-sunken mb-5 rounded-2xl border px-4 py-5 text-center text-sm">
          <p className="text-muted">There is nobody to choose from yet.</p>
          <Button className="mt-3" variant="primary" size="sm" onClick={() => go('family')}>
            Add people
          </Button>
        </div>
      )}

      <Role
        title="Executor"
        help="The person who carries out your will: they find what you own, settle what is owed and hand things on. Not compulsory, but without one your family must ask a court for the power to act."
        labels={['Executor', 'If they cannot act, then']}
        addLabel="Add a backup executor"
        role="executorIds"
        ids={record.executorIds}
        {...{ record, update }}
      />
      <Role
        title="Guardian for your children"
        help="Who looks after a child of yours who is under 18 if neither parent is alive. Skip this if you have no children, or they are all adults."
        labels={['Guardian', 'If they cannot act, then']}
        addLabel="Add a backup guardian"
        role="guardianIds"
        ids={record.guardianIds}
        {...{ record, update }}
      />
      <Role
        title="Witnesses"
        help={`Two people who watch you sign. They must not be anyone who receives a gift under the will, or married to one. You can leave this blank and write their names at signing.`}
        labels={['First witness', 'Second witness']}
        addLabel="Add another witness"
        role="witnessIds"
        ids={record.witnessIds}
        min={LAW.witnessesNeeded}
        {...{ record, update }}
      />

      <StepFindings findings={findings} step="people" />
    </div>
  );
}

function Role({
  title,
  help,
  labels,
  addLabel,
  role,
  ids,
  min = 1,
  record,
  update,
}: {
  title: string;
  help: string;
  labels: [string, string];
  addLabel: string;
  role: Role;
  ids: string[];
  /** How many selects to show before anybody has been added. */
  min?: number;
  record: StepProps['record'];
  update: StepProps['update'];
}) {
  // A row being added has no person yet, and a role never stores a blank, so it
  // lives here until somebody is chosen. At least `min` rows always show, so a
  // person sees where to choose.
  const [adding, setAdding] = useState(false);
  const rows = Math.max(ids.length + (adding ? 1 : 0), min);
  const slots = Array.from({ length: rows }, (_, i) => ids[i] ?? '');
  const save = (next: string[]) => update((r) => setRole(r, role, next));
  const label = (i: number) => (i === 0 ? labels[0] : i === 1 ? labels[1] : `${labels[1]} (${i})`);

  return (
    <section className="mt-6 first:mt-0">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-muted mt-1 max-w-2xl text-[13.5px] leading-relaxed text-pretty">{help}</p>
      <div className="mt-3 space-y-2">
        {slots.map((id, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-x-2 gap-y-1 sm:grid-cols-[9.5rem_minmax(0,22rem)_2.25rem]">
            <span className="text-muted col-span-2 text-[13px] sm:col-span-1">{label(i)}</span>
            <PersonSelect
              record={record}
              value={id}
              exclude={ids}
              onChange={(pid) => {
                const next = [...slots];
                next[i] = pid;
                save(next);
                setAdding(false);
              }}
              aria-label={label(i)}
            />
            {(id || i >= min) && (
              <Button
                variant="ghost"
                size="sm"
                className="!px-2"
                aria-label={`Clear ${label(i)}`}
                onClick={() => {
                  save(slots.filter((_, k) => k !== i));
                  setAdding(false);
                }}
              >
                <X className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        ))}
      </div>
      {ids.length >= min && !adding && (
        <Button size="sm" variant="ghost" className="mt-2" disabled={ids.length >= record.people.length} onClick={() => setAdding(true)}>
          <Plus className="size-3.5" aria-hidden />
          {addLabel}
        </Button>
      )}
    </section>
  );
}
