'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Input } from '@/components/ui/primitives';
import { blankShare, type Share, type WillRecord } from '@/lib/will/model';
import { splitEqually } from '@/lib/will/edit';
import { PersonSelect } from './shared';

/**
 * Who gets a thing, in what shares, and who takes a share if its owner does
 * not survive. Used for each gift and for "everything else".
 *
 * The total is shown as it is typed, in words, and the shares can be split
 * equally in one tap. The split gives the odd paisa to the first share so the
 * total is exactly 100 (lib/will/edit): three people get 33.34, 33.33, 33.33,
 * never three of 33.33 and a hole the checks would rightly complain about.
 */
export function SharesEditor({
  record,
  shares,
  onChange,
  onNeedPeople,
}: {
  record: WillRecord;
  shares: Share[];
  onChange: (shares: Share[]) => void;
  onNeedPeople: () => void;
}) {
  const total = Math.round(shares.reduce((n, s) => n + s.percent, 0) * 100) / 100;
  const patch = (i: number, p: Partial<Share>) => onChange(shares.map((s, k) => (k === i ? { ...s, ...p } : s)));
  const chosen = shares.map((s) => s.personId);

  if (record.people.length === 0) {
    return (
      <div className="surface-sunken rounded-2xl border px-4 py-5 text-center text-sm">
        <p className="text-muted">Add the people in your will first, then come back to choose who gets this.</p>
        <Button className="mt-3" variant="primary" size="sm" onClick={onNeedPeople}>
          Add people
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {shares.length > 0 && (
        <div className="hidden grid-cols-[minmax(0,1.3fr)_5.5rem_minmax(0,1.1fr)_2.25rem] gap-2 px-1 text-[11.5px] font-medium sm:grid">
          <span className="text-subtle">Gets</span>
          <span className="text-subtle">Share, %</span>
          <span className="text-subtle">If they are not alive, then</span>
          <span />
        </div>
      )}
      {shares.map((s, i) => (
        <div
          key={i}
          className="grid grid-cols-[minmax(0,1fr)_5.5rem_2.25rem] items-start gap-2 sm:grid-cols-[minmax(0,1.3fr)_5.5rem_minmax(0,1.1fr)_2.25rem]"
        >
          <PersonSelect
            record={record}
            value={s.personId}
            onChange={(personId) => patch(i, { personId, alternateId: s.alternateId === personId ? '' : s.alternateId })}
            exclude={chosen}
            aria-label={`Recipient ${i + 1}`}
          />
          <PercentInput value={s.percent} onChange={(percent) => patch(i, { percent })} label={`Share ${i + 1}, per cent`} />
          <div className="order-last col-span-2 sm:order-none sm:col-span-1">
            <PersonSelect
              record={record}
              value={s.alternateId}
              onChange={(alternateId) => patch(i, { alternateId })}
              exclude={[s.personId]}
              placeholder="No backup"
              aria-label={`Backup for recipient ${i + 1}`}
            />
          </div>
          <Button variant="ghost" size="sm" className="!px-2" aria-label={`Remove recipient ${i + 1}`} onClick={() => onChange(shares.filter((_, k) => k !== i))}>
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={() => {
            const next = [...shares, blankShare()];
            onChange(shares.length === 0 ? next : splitEqually(next));
          }}
          disabled={shares.length >= record.people.length}
        >
          <Plus className="size-3.5" aria-hidden />
          {shares.length === 0 ? 'Choose who gets it' : 'Add someone'}
        </Button>
        {shares.length > 1 && (
          <Button size="sm" variant="ghost" onClick={() => onChange(splitEqually(shares))}>
            Split equally
          </Button>
        )}
        {shares.length > 0 && (
          <span
            role="status"
            className={`ml-auto text-[13px] font-medium tabular-nums ${Math.abs(total - 100) < 0.01 ? 'text-[var(--status-approved)]' : 'text-[var(--status-warn)]'}`}
          >
            {Math.abs(total - 100) < 0.01 ? 'Adds up to 100%' : `Adds up to ${total}%. It needs to be 100%.`}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * A per-cent box that lets "33." be typed on the way to "33.5".
 *
 * Holds what is being typed as text and reports the number it reads; when the
 * number is changed from outside (Split equally) it shows the new figure. A
 * number input that rewrites its own value on every keystroke makes decimals
 * impossible to type.
 */
function PercentInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (Number(text) !== value) setText(String(value));
  }
  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const n = Number(raw);
        if (raw.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 100) {
          setSeen(n);
          onChange(n);
        }
      }}
      onBlur={() => setText(String(value))}
    />
  );
}
