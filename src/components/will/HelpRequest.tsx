'use client';

import { useState, useSyncExternalStore } from 'react';
import { Check, Send } from 'lucide-react';
import { requestAccess } from '@/app/actions/access';
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';

/**
 * Asking for an advocate's help with a will.
 *
 * Goes through `requestAccess`, the same rate-limited path the contact form and
 * the locked tools use, so the ask lands on the Admin screen's access requests
 * (and in the team mailbox where email is set up) with "Will Maker" and what was
 * wanted in the interest line. There is no payment and no promise of a
 * particular lawyer: it says we are setting this up, because we are.
 *
 * What it sends is exactly what is typed here. The will is never read, attached
 * or summarised, and the form says so. It deliberately does not carry
 * `data-lead-form`, which the site's tracker watches.
 *
 * Remembered in this browser once sent, so the tab says "asked" rather than
 * inviting the same ask twice.
 */

const KEY = 'tfi:asked:will-maker-help';

export const HELP_KINDS = [
  'Read my draft before I sign',
  'Help me register my will',
  'Draft my will with me',
  'A family trust instead',
  'Something else',
] as const;

export function HelpRequest({ open, onClose, name, email }: { open: boolean; onClose: () => void; name: string; email: string }) {
  const askedOn = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem(KEY);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(event.currentTarget);
    const phone = String(f.get('phone') ?? '').trim();
    const note = String(f.get('note') ?? '').trim();
    const result = await requestAccess({
      name: String(f.get('name') ?? ''),
      email: String(f.get('email') ?? ''),
      company: String(f.get('city') ?? '') || undefined,
      interest: `Will Maker: ${String(f.get('kind') ?? HELP_KINDS[0])}`,
      message: [note, phone && `Phone: ${phone}`, 'Sent from Will Maker. No will content was sent.'].filter(Boolean).join('\n'),
    }).catch(() => ({ ok: false as const, error: 'Could not send that. Try again in a moment.' }));
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    try {
      localStorage.setItem(KEY, new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()));
    } catch {
      // Not remembered on this device; the request itself is recorded.
    }
    setDone(true);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={done || askedOn ? 'Your request is with us' : 'Ask for an advocate’s help'}
      description={
        done || askedOn
          ? `A person reads every one and writes back to the address you gave.${askedOn && !done ? ` You asked on ${askedOn}.` : ''}`
          : 'We are setting up advocate review, registration help and full drafting. Tell us what you need.'
      }
    >
      {done || askedOn ? (
        <div className="mt-2 flex items-center gap-3 text-sm">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--status-approved)] text-[var(--surface)]">
            <Check className="size-4" strokeWidth={3} />
          </span>
          <span className="text-muted">Nothing about your will was sent. Only what you typed.</span>
          <Button className="ml-auto" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" htmlFor="hr-name" required>
            <Input id="hr-name" name="name" autoComplete="name" defaultValue={name} required minLength={2} maxLength={120} />
          </Field>
          <Field label="Email" htmlFor="hr-email" required hint="Where we reply.">
            <Input id="hr-email" name="email" type="email" autoComplete="email" defaultValue={email} required maxLength={200} />
          </Field>
          <Field label="What do you need" htmlFor="hr-kind" className="sm:col-span-2">
            <Select id="hr-kind" name="kind" defaultValue={HELP_KINDS[0]}>
              {HELP_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </Select>
          </Field>
          <Field label="City" htmlFor="hr-city" hint="Registration happens at a local office.">
            <Input id="hr-city" name="city" autoComplete="address-level2" maxLength={160} />
          </Field>
          <Field label="Phone" htmlFor="hr-phone" hint="Optional.">
            <Input id="hr-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} />
          </Field>
          <Field label="Anything we should know" htmlFor="hr-note" className="sm:col-span-2" hint="Do not paste your will or account numbers here.">
            <Textarea id="hr-note" name="note" rows={3} maxLength={3000} />
          </Field>
          {error && (
            <p role="alert" className="text-sm font-medium text-[var(--status-rejected)] sm:col-span-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              {!busy && <Send className="size-4" aria-hidden />}
              Send the request
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
