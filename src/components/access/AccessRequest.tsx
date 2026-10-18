'use client';

import { useState, useSyncExternalStore } from 'react';
import { Check, Send } from 'lucide-react';
import { requestAccess } from '@/app/actions/access';
import { Button, Field, Input, Textarea } from '@/components/ui/primitives';

/**
 * Asking for a locked tool.
 *
 * Writes through `requestAccess`, the same SECURITY DEFINER path the public
 * contact form uses, so the ask lands in `access_requests` (on the Access
 * requests screen under Analytics) and, where email is set up, in the team
 * mailbox. The tool's name goes in `interest`, so the screen says which door
 * was knocked on.
 *
 * Open to a visitor with no account, which is why it asks for a name and an
 * address rather than taking them from a session; a signed-in person finds
 * both filled in. Remembered in this browser once sent, so coming back to the
 * tool says "asked" rather than inviting the same ask again.
 */
export function AccessRequest({
  slug,
  toolName,
  name = '',
  email = '',
}: {
  slug: string;
  toolName: string;
  name?: string;
  email?: string;
}) {
  const key = `tfi:asked:${slug}`;
  const askedOn = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (done || askedOn) {
    return (
      <div className="tinted flex items-start gap-3 rounded-2xl border p-4 [--tone:var(--status-approved)]">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--tone)] text-[var(--surface)]">
          <Check className="size-4" strokeWidth={3} />
        </span>
        <div className="min-w-0">
          <p className="font-semibold tracking-tight">Your request is with us</p>
          <p className="text-muted mt-1 text-sm text-pretty">
            A person reads every one and writes back to the address you gave, usually within a working day.
            {askedOn && !done ? ` You asked on ${askedOn}.` : ''}
          </p>
        </div>
      </div>
    );
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const result = await requestAccess({
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      company: String(form.get('company') ?? '') || undefined,
      interest: `Access to ${toolName}`,
      message: String(form.get('message') ?? '') || undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    try {
      localStorage.setItem(
        key,
        new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()),
      );
    } catch {
      // Not remembered on this device; the request itself is recorded.
    }
    setDone(true);
  };

  return (
    <form onSubmit={submit} data-lead-form="" className="grid gap-4 sm:grid-cols-2">
      <Field label="Your name" htmlFor={`ar-name-${slug}`} required>
        <Input id={`ar-name-${slug}`} name="name" autoComplete="name" defaultValue={name} required minLength={2} maxLength={120} />
      </Field>
      <Field label="Email" htmlFor={`ar-email-${slug}`} required hint="Where we reply.">
        <Input id={`ar-email-${slug}`} name="email" type="email" autoComplete="email" defaultValue={email} required maxLength={200} />
      </Field>
      <Field label="Firm or organisation" htmlFor={`ar-co-${slug}`} className="sm:col-span-2">
        <Input id={`ar-co-${slug}`} name="company" autoComplete="organization" maxLength={160} />
      </Field>
      <Field label="What would you use it for?" htmlFor={`ar-msg-${slug}`} className="sm:col-span-2">
        <Textarea id={`ar-msg-${slug}`} name="message" maxLength={4000} rows={3} />
      </Field>
      {error && (
        <p role="alert" className="text-sm font-medium text-[var(--status-rejected)] sm:col-span-2">
          {error}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary" loading={busy}>
          {!busy && <Send className="size-4" aria-hidden />}
          Request access
        </Button>
      </div>
    </form>
  );
}
