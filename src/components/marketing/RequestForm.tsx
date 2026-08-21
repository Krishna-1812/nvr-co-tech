'use client';

import { useState } from 'react';
import { ArrowRight, Check, Mail } from 'lucide-react';
import { requestAccess } from '@/app/actions/access';
import { AGENTS, CONTACT, STAGE_LABEL } from '@/lib/marketing/content';

/**
 * The walkthrough request, as a form that actually goes somewhere.
 *
 * It used to compose a mailto: and say so plainly, which was the honest thing to
 * do while there was no handler behind it. There is one now, so the promise
 * changes: the request is recorded, it is searchable, and it shows up on an
 * internal screen where somebody can see whether it has been answered. The
 * mailto: stays as the fallback beside the button, because a person whose
 * submission fails should not be left with nowhere to go.
 *
 * Styled in the marketing skin's own tokens rather than the app's. This page
 * lives on the dark public site and the two palettes are deliberately scoped
 * apart.
 */
export function RequestForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    const form = new FormData(event.currentTarget);
    const result = await requestAccess({
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      company: String(form.get('company') ?? '') || undefined,
      interest: String(form.get('interest') ?? '') || undefined,
      message: String(form.get('message') ?? '') || undefined,
    });

    setBusy(false);
    if (result.ok) setDone(true);
    else setError(result.error);
  };

  if (done) {
    return (
      <div className="m-card p-6 sm:p-9">
        <span
          aria-hidden
          className="grid size-11 place-items-center rounded-full"
          style={{ backgroundImage: 'var(--m-grad)' }}
        >
          <Check className="size-5 text-white" />
        </span>
        <h2 className="m-display mt-5 text-xl">That is with us</h2>
        <p className="m-dim mt-3 text-[14.5px] leading-relaxed">
          A person writes back within one working day, not a ticket number. If it is urgent, or if
          you would rather not wait, write straight to{' '}
          <a
            href={`mailto:${CONTACT.email}`}
            className="m-mono text-[var(--m-ink)] underline decoration-dotted underline-offset-4"
          >
            {CONTACT.email}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} data-lead-form="" className="m-card p-6 sm:p-9">
      <h2 className="m-display text-xl">Your details</h2>
      <p className="m-dim mt-3 text-[13.5px] leading-relaxed">
        This comes straight to us. Nothing is shared with anybody else, and there is no mailing
        list to be added to.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <Field id="req-name" name="name" label="Your name" autoComplete="name" placeholder="Priya Nair" required />
        <Field
          id="req-email"
          name="email"
          label="Work email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="priya@yourfirm.in"
          required
        />
        <Field
          id="req-company"
          name="company"
          label="Organisation"
          autoComplete="organization"
          placeholder="Firm, chapter or company"
          className="sm:col-span-2"
        />

        <div className="sm:col-span-2">
          <label htmlFor="req-interest" className="m-eyebrow block">
            Which one are you interested in
          </label>
          <select
            id="req-interest"
            name="interest"
            defaultValue="Not sure yet"
            // Without this the native dropdown renders as a white sheet over a
            // near-black page in Chromium.
            style={{ colorScheme: 'dark' }}
            className="mt-2.5 w-full appearance-none rounded-xl border border-[var(--m-line)] bg-white/[0.03] px-4 py-3 text-base lg:text-[15px] text-[var(--m-ink)] transition hover:border-[var(--m-line-2)]"
          >
            <option value="Not sure yet">Not sure yet</option>
            <option value="Build something custom">Something built for us</option>
            {AGENTS.map((agent) => (
              <option key={agent.slug} value={agent.name}>
                {agent.name} ({STAGE_LABEL[agent.stage].toLowerCase()})
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="req-message" className="m-eyebrow block">
            What would you like us to cover
          </label>
          <textarea
            id="req-message"
            name="message"
            rows={5}
            placeholder="How many vouchers you do in a month, who approves them at the moment, and what tends to go wrong."
            className="mt-2.5 w-full resize-y rounded-xl border border-[var(--m-line)] bg-white/[0.03] px-4 py-3 text-base lg:text-[15px] leading-relaxed text-[var(--m-ink)] transition placeholder:text-[var(--m-dim-2)] hover:border-[var(--m-line-2)]"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-6 text-[13.5px] leading-relaxed text-[var(--m-rose)]">
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="group inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white shadow-[0_10px_30px_oklch(0.64_0.18_274_/_0.35)] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          style={{ backgroundImage: 'var(--m-grad)' }}
        >
          {busy ? 'Sending' : 'Send it'}
          {!busy && (
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          )}
        </button>

        <a
          href={`mailto:${CONTACT.email}`}
          className="m-mono m-dim inline-flex items-center gap-2 text-[11px] tracking-[0.12em] uppercase transition hover:text-[var(--m-ink)]"
        >
          <Mail className="size-3.5" aria-hidden />
          Or write to us directly
        </a>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  className,
  ...input
}: React.ComponentProps<'input'> & { id: string; label: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="m-eyebrow block">
        {label}
        {input.required && (
          <span aria-hidden className="ml-1 text-[var(--m-dim-2)]">
            *
          </span>
        )}
      </label>
      <input
        id={id}
        className="mt-2.5 w-full rounded-xl border border-[var(--m-line)] bg-white/[0.03] px-4 py-3 text-base lg:text-[15px] text-[var(--m-ink)] transition placeholder:text-[var(--m-dim-2)] hover:border-[var(--m-line-2)]"
        {...input}
      />
    </div>
  );
}
