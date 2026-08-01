'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createEvent } from '@/app/actions/voucher';
import type { Chapter } from '@/lib/domain/voucher';
import { Button, Field, Input, Select } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import type { EventOption } from './VoucherForm';

const NEW = '__new__';

/**
 * Event select with inline creation, carried over from v1 — staff genuinely do
 * discover a missing event mid-voucher, and making them leave the form to add
 * one would be worse. Unlike v1, events are org-level, so everyone sees the
 * same list rather than each person building their own.
 */
export function EventPicker({
  events,
  chapters,
  value,
  onPick,
  onCreated,
}: {
  events: EventOption[];
  chapters: Chapter[];
  value: string;
  onPick: (ev: EventOption | null) => void;
  onCreated: (ev: EventOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [date, setDate] = useState('');
  const [busy, startTransition] = useTransition();

  const handleChange = (v: string) => {
    if (v === NEW) {
      setOpen(true);
      return;
    }
    onPick(events.find((e) => e.id === v) ?? null);
  };

  const submit = () =>
    startTransition(async () => {
      const res = await createEvent({
        name,
        chapter_id: chapterId || null,
        date_of_event: date,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onCreated(res.data);
      toast.success(`“${res.data.name}” created.`);
      setOpen(false);
      setName('');
      setChapterId('');
      setDate('');
    });

  return (
    <>
      <Field label="Event" htmlFor="f-event_id">
        <Select id="f-event_id" value={value} onChange={(e) => handleChange(e.target.value)}>
          <option value="">Select event</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
          <option value={NEW}>＋ Create new event…</option>
        </Select>
      </Field>

      <Modal open={open} onClose={() => setOpen(false)} title="Create new event">
        <div className="space-y-4">
          <Field label="Name of event" htmlFor="ev-name" required>
            <Input
              id="ev-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Annual Summit"
              autoFocus
            />
          </Field>
          <Field label="Chapter" htmlFor="ev-chapter">
            <Select id="ev-chapter" value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
              <option value="">Select chapter</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date of event" htmlFor="ev-date">
            <Input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <Button onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submit}
              loading={busy}
              disabled={name.trim().length < 2}
            >
              Create event
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
