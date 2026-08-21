'use client';

import { useState } from 'react';
import { Check, Hand } from 'lucide-react';
import { requestFeature } from '@/app/actions/access';

/**
 * Putting your hand up for a tool that is not built yet.
 *
 * The card this sits in was deliberately written without a button, and the
 * reasoning was good: five confident tiles that all lead nowhere is the fastest
 * way to make a workspace feel like a mockup. A *disabled* button would have been
 * exactly that.
 *
 * This is the other thing. It does something real — the ask is recorded, appears
 * on an internal screen, and is what decides which tool gets built next — so it
 * earns its place where a fake one would not. It also answers the question the
 * card could previously only deflect with a link to a plan: not "when do I get
 * this" but "does wanting it count for anything".
 *
 * Deduplicated in the database on (person, tool), so pressing it twice is one
 * row. The second press is therefore not an error, and the button says so
 * rather than complaining.
 */
export function WantThis({ slug, asked }: { slug: string; asked: boolean }) {
  const [done, setDone] = useState(asked);
  const [busy, setBusy] = useState(false);

  if (done) {
    return (
      <span className="text-subtle inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
        <Check className="size-3.5" aria-hidden />
        Asked for
      </span>
    );
  }

  const ask = async () => {
    setBusy(true);
    const result = await requestFeature(slug);
    setBusy(false);
    // Either outcome leaves the ask on file, so both settle the button. A
    // failure is the only case worth leaving pressable.
    if (result.ok) setDone(true);
  };

  return (
    <button
      type="button"
      onClick={ask}
      disabled={busy}
      className="a-ring group/w inline-flex shrink-0 items-center gap-1 text-xs font-semibold transition hover:text-brand-600 disabled:opacity-60 dark:hover:text-brand-300"
    >
      <Hand className="size-3.5" aria-hidden />
      {busy ? 'Noting it' : 'I want this'}
    </button>
  );
}
