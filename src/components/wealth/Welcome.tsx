'use client';

import { useState } from 'react';
import { Check, EyeOff, HardDrive, LockKeyhole, Upload } from 'lucide-react';
import { ArchScene } from '@/components/ui/Scene';
import { Button, Field, Input } from '@/components/ui/primitives';
import { ASSET_HEADS, LIABILITY_HEADS, type HeadId } from '@/lib/wealth/heads';
import { cn } from '@/lib/utils';
import { HeadTile, useSignedIn } from './shared';

/**
 * The first screen of an empty record.
 *
 * The hardest part of a form like this is starting it, so the first thing it
 * asks is not a form at all: tick what you have. Ticking costs nothing, takes
 * a minute, and turns into a guided walk through each one in turn ("2 of 6"),
 * with "skip for now" on every step. Someone who would rather wander can add
 * things one at a time instead.
 *
 * It says where the record lives before anything is typed, because for this
 * kind of information that is the first question a careful person asks.
 */
export function Welcome({
  selfName,
  onStart,
  onRestore,
}: {
  selfName: string;
  onStart: (name: string, heads: HeadId[]) => void;
  onRestore: () => void;
}) {
  const signedIn = useSignedIn();
  const [name, setName] = useState(selfName);
  const [picked, setPicked] = useState<HeadId[]>([]);
  const toggle = (id: HeadId) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="wt-welcome"
        className="surface-lit a-ring relative isolate overflow-hidden rounded-[2rem]"
      >
        <span
          aria-hidden
          className="a-orb -top-40 -left-24 size-[34rem] opacity-[0.16]"
          style={{ background: 'radial-gradient(circle, var(--h-amber), transparent 66%)' }}
        />
        <div className="relative grid gap-8 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="min-w-0">
            <p className="a-label">Wealth Tracker</p>
            <h1 id="wt-welcome" className="m-display mt-4 text-[clamp(2rem,4.8vw,3.25rem)] leading-[1.02] text-balance">
              Everything you own and owe, in one place.
            </h1>
            <p className="text-muted mt-4 max-w-2xl text-[15px] leading-relaxed text-pretty sm:text-base">
              Write down your bank accounts, investments, property, gold, policies and loans once. See your net worth,
              check that every account has a nominee, and keep a record your family could use if they ever had to.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {(signedIn
                ? [
                    { icon: HardDrive, text: 'Saved to your account, readable only by you' },
                    { icon: EyeOff, text: 'With a passcode, encrypted before it is saved' },
                    { icon: LockKeyhole, text: 'Lock it with a passcode if you like' },
                  ]
                : [
                    { icon: HardDrive, text: 'Kept only in this browser' },
                    { icon: EyeOff, text: 'Never sent to a server, including ours' },
                    { icon: LockKeyhole, text: 'Lock it with a passcode if you like' },
                  ]
              ).map(({ icon: Icon, text }) => (
                <li key={text} className="surface-sunken text-muted inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px]">
                  <Icon className="size-3.5" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <div className="hidden lg:flex lg:flex-col lg:justify-center [&>*]:max-h-[22rem]">
            <ArchScene motif="nest" className="h-full min-h-[17rem]" />
          </div>
        </div>
      </section>

      <section aria-labelledby="wt-start" className="surface-lit a-ring rounded-[2rem] p-6 sm:p-9">
        <h2 id="wt-start" className="text-lg font-semibold tracking-tight">
          Start with what you have
        </h2>
        <p className="text-muted mt-1 text-sm text-pretty">
          Tick everything that applies. You will be taken through each one; skip anything you do not have to hand.
        </p>

        <div className="mt-6 max-w-sm">
          <Field label="Your name" htmlFor="wt-name" hint="Printed on the record. Optional.">
            <Input id="wt-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
        </div>

        {(
          [
            ['What you own', ASSET_HEADS],
            ['What you owe', LIABILITY_HEADS],
          ] as const
        ).map(([title, heads]) => (
          <fieldset key={title} className="mt-7">
            <legend className="a-label mb-3">{title}</legend>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {heads.map((h) => {
                const on = picked.includes(h.id);
                return (
                  <button
                    key={h.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(h.id)}
                    className={cn(
                      'flex items-start gap-3 rounded-2xl border p-3 text-left transition',
                      on
                        ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_8%,var(--surface-raised))] shadow-[var(--elev-1)]'
                        : 'hover:bg-[var(--surface-sunken)]',
                    )}
                  >
                    <HeadTile id={h.id} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{h.name}</span>
                      <span className="text-muted mt-0.5 block text-[12px] leading-snug">{h.examples}</span>
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition',
                        on ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-action)]' : 'bg-[var(--surface-raised)]',
                      )}
                    >
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="mt-8 flex flex-wrap items-center gap-3 border-t pt-6">
          <Button variant="primary" size="lg" disabled={picked.length === 0} onClick={() => onStart(name, picked)}>
            {picked.length === 0 ? 'Tick at least one to start' : `Start with these ${picked.length}`}
          </Button>
          <Button size="lg" onClick={() => onStart(name, [])}>
            Add things one at a time
          </Button>
          <Button variant="ghost" onClick={onRestore} className="sm:ml-auto">
            <Upload className="size-4" aria-hidden />
            Restore from a backup
          </Button>
        </div>
      </section>
    </div>
  );
}
