'use client';

import { useState } from 'react';
import { Check, Minus, ShieldOff } from 'lucide-react';
import { CAPABILITIES, ROLES, type Role } from '@/lib/marketing/content';
import { cn } from '@/lib/utils';
import { Container, Eyebrow } from '../bits';
import { Reveal } from '../Reveal';

/**
 * Who may do what, as a table you can put your own role into.
 *
 * The rest of this page describes the permission model in prose. This is the
 * model itself: eleven capabilities against four roles, with the predicate that
 * decides each one printed next to it so a reader can go and find it in the
 * repository. See the note on CAPABILITIES for where each row comes from.
 *
 * The last two rows are the reason it is worth building. Every cell in them is a
 * refusal, the owner's included — and a table is the only way to show that the
 * strongest role on the system still cannot approve its own voucher or touch the
 * audit trail. A paragraph claiming as much reads as marketing.
 *
 * All four columns are always in the DOM. Below `md` only the chosen one is
 * shown, because four columns of ticks on a phone is a horizontal scroll nobody
 * discovers, and the role chips are a better control than a scrollbar.
 */
export function PermissionMatrix() {
  const [role, setRole] = useState<Role>('approver');

  return (
    <section className="relative border-t border-[var(--m-line)] py-20 sm:py-28">
      <span
        aria-hidden
        className="m-dots pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(65%_55%_at_50%_40%,#000,transparent)]"
      />

      <Container className="relative">
        <Reveal>
          <Eyebrow className="mb-4">The permission model</Eyebrow>
          <h2 className="m-display max-w-3xl text-[clamp(1.9rem,4.2vw,3.25rem)]">
            Pick a role. <span className="m-serif m-grad-text">See exactly what it can do.</span>
          </h2>
          <p className="m-dim mt-5 max-w-2xl text-[15px] leading-relaxed sm:text-base">
            Four roles, eleven capabilities, and the predicate that decides each one. Every rule
            below is a policy or a function in the migrations, not a convention the interface
            follows.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div
            role="radiogroup"
            aria-label="Role"
            // Four equal columns on a phone rather than a wrapping row, where
            // "owner" would drop onto a line of its own and leave the group
            // looking broken.
            className="mt-10 grid w-full grid-cols-4 gap-1 rounded-xl border border-[var(--m-line)] bg-white/[0.03] p-1 sm:inline-flex sm:w-auto"
          >
            {ROLES.map((r) => {
              const on = r === role;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setRole(r)}
                  className={cn(
                    'm-mono rounded-lg px-2.5 py-2 text-[10.5px] tracking-[0.1em] uppercase transition sm:px-4 sm:text-[11px] sm:tracking-[0.12em]',
                    on ? 'text-white' : 'm-dim hover:text-[var(--m-ink)]',
                  )}
                  style={on ? { backgroundImage: 'var(--m-grad)' } : undefined}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </Reveal>

        <Reveal delay={140}>
          <div className="m-card m-ring mt-8 overflow-hidden rounded-2xl">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Capabilities by role. The selected role is {role}.
              </caption>
              <thead>
                <tr className="border-b border-[var(--m-line)]">
                  <th scope="col" className="m-eyebrow px-4 py-3.5 font-medium sm:px-6">
                    Can they…
                  </th>
                  {ROLES.map((r) => (
                    <th
                      key={r}
                      scope="col"
                      className={cn(
                        'm-mono w-[4.5rem] px-2 py-3.5 text-center text-[9.5px] tracking-[0.1em] uppercase transition-colors',
                        r === role ? 'text-[var(--m-ink)]' : 'm-dim-2',
                        // Only the chosen column survives on a phone.
                        r === role ? 'table-cell' : 'hidden md:table-cell',
                      )}
                    >
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {CAPABILITIES.map((cap) => {
                  const nobody = cap.who.length === 0;
                  return (
                    <tr
                      key={cap.action}
                      className={cn(
                        'border-b border-[var(--m-line)] last:border-0 transition-colors',
                        nobody
                          ? 'bg-[color-mix(in_oklab,var(--m-rose)_7%,transparent)]'
                          : 'hover:bg-white/[0.022]',
                      )}
                    >
                      <th scope="row" className="px-4 py-3.5 font-normal sm:px-6">
                        <span className="flex items-start gap-2.5">
                          {nobody && (
                            <ShieldOff
                              className="mt-0.5 size-3.5 shrink-0 text-[var(--m-rose)]"
                              aria-hidden
                            />
                          )}
                          <span className="min-w-0">
                            <span
                              className={cn(
                                'block text-[13.5px]',
                                nobody ? 'font-semibold text-[var(--m-ink)]' : 'text-[var(--m-ink)]',
                              )}
                            >
                              {cap.action}
                            </span>
                            <code className="m-mono m-dim-2 mt-1.5 block text-[10.5px] break-words">
                              {cap.sql}
                            </code>
                            {cap.note && (
                              <span className="m-dim-2 mt-1.5 block text-[11px] leading-relaxed">
                                {cap.note}
                              </span>
                            )}
                          </span>
                        </span>
                      </th>

                      {ROLES.map((r) => (
                        <td
                          key={r}
                          className={cn(
                            'px-2 py-3.5 text-center align-top transition-colors',
                            r === role ? 'table-cell bg-white/[0.03]' : 'hidden md:table-cell',
                          )}
                        >
                          <Cell allowed={cap.who.includes(r)} dimmed={r !== role} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Reveal>

        <Reveal delay={200}>
          <p className="m-dim-2 mt-6 text-[12px] leading-relaxed">
            The two shaded rows have no owner column worth reading, because there is no role that
            satisfies them. Segregation of duties is a check inside the approval function; the audit
            table simply has no UPDATE or DELETE policy for anyone to fall under.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}

function Cell({ allowed, dimmed }: { allowed: boolean; dimmed: boolean }) {
  if (!allowed) {
    return (
      <>
        <Minus
          className={cn('mx-auto size-3.5', dimmed ? 'text-[var(--m-line-2)]' : 'm-dim-2')}
          aria-hidden
        />
        <span className="sr-only">No</span>
      </>
    );
  }

  return (
    <>
      <span
        className={cn(
          'mx-auto grid size-5 place-items-center rounded-full transition-opacity',
          dimmed && 'opacity-45',
        )}
        style={{ background: 'color-mix(in oklab, var(--m-emerald) 20%, transparent)' }}
      >
        <Check className="size-3 text-[var(--m-emerald)]" aria-hidden />
      </span>
      <span className="sr-only">Yes</span>
    </>
  );
}
