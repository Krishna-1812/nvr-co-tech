'use client';

import type { Person } from '@/lib/analytics/report';
import { duration } from '@/lib/analytics/report';
import type { AdminAccountRow } from '@/lib/supabase/types';
import { isAdminEmail } from '@/lib/access';
import { ago, stamp } from './when';
import { useDrill } from './Drill';

/**
 * Every account there is, whether or not it was used in the range, with when
 * it was made, the last sign-in and how, and the time it spent in the range.
 */
export function Accounts({ accounts, people, now }: { accounts: AdminAccountRow[]; people: Person[]; now: number }) {
  const { open } = useDrill();
  if (accounts.length === 0) return <p className="text-subtle px-6 py-12 text-center text-sm">No accounts yet.</p>;
  const byKey = new Map(people.map((p) => [p.key, p]));
  return (
    <div className="scroll-x-hint overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left text-[13px]">
        <thead className="surface-sunken">
          <tr className="a-label">
            <th className="px-5 py-2.5 font-medium sm:px-6">Account</th>
            <th className="px-3 py-2.5 font-medium">Created</th>
            <th className="px-3 py-2.5 font-medium">Last sign-in</th>
            <th className="px-3 py-2.5 font-medium">Method</th>
            <th className="px-3 py-2.5 text-right font-medium">Visits</th>
            <th className="px-5 py-2.5 text-right font-medium sm:px-6">Time spent</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {accounts.map((a) => {
            const p = byKey.get(`u:${a.id}`);
            return (
              <tr
                key={a.id}
                onClick={() => open({ t: 'account', id: a.id })}
                className="cursor-pointer transition hover:bg-[color-mix(in_oklab,var(--surface-sunken)_60%,transparent)]"
              >
                <td className="max-w-[18rem] px-5 py-3 sm:px-6">
                  <button type="button" className="block min-w-0 text-left focus-visible:underline focus-visible:outline-none">
                    <span className="block truncate font-semibold">
                      {a.full_name ?? a.email ?? 'No name'}
                      {isAdminEmail(a.email) && (
                        <span className="tinted ml-2 rounded-full border px-1.5 py-px align-middle text-[9.5px] font-bold tracking-wide uppercase [--tone:var(--color-brand-500)]">
                          Admin
                        </span>
                      )}
                    </span>
                    {a.full_name && <span className="text-subtle block truncate text-[12px]">{a.email}</span>}
                  </button>
                </td>
                <td className="text-muted px-3 py-3 whitespace-nowrap">{stamp(a.created_at, false)}</td>
                <td className="text-muted px-3 py-3 whitespace-nowrap" title={a.last_sign_in_at ? stamp(a.last_sign_in_at) : undefined}>
                  {a.last_sign_in_at ? ago(a.last_sign_in_at, now) : 'Never'}
                </td>
                <td className="text-muted px-3 py-3">{a.provider === 'google' ? 'Google' : a.provider === 'email' ? 'Email' : (a.provider ?? '—')}</td>
                <td className="px-3 py-3 text-right tabular-nums">{p?.visits ?? 0}</td>
                <td className="px-5 py-3 text-right tabular-nums sm:px-6">{p ? duration(p.seconds) : '0s'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
