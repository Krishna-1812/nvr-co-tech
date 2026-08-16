'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ShieldCheck, Users, Zap } from 'lucide-react';
import { setRequiresApproval } from '@/app/actions/admin';
import { Card, CardTitle } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

const OPTIONS = [
  {
    value: true,
    label: 'Two-person approval',
    hint: 'A voucher needs two different approvers before it can be paid. Nobody approves their own voucher.',
    icon: Users,
  },
  {
    value: false,
    label: 'Direct, no approval needed',
    hint: 'Submitting a voucher pays it immediately. Whoever raises it does not need anyone else to sign off.',
    icon: Zap,
  },
] as const;

/**
 * Owner-only. This is the one control that decides whether submit_voucher()
 * routes a draft through pending_first/pending_second or straight to paid —
 * see migration 0013. Every other organization defaults to approval on.
 */
export function ApprovalPolicyCard({ requiresApproval }: { requiresApproval: boolean }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [value, setValue] = useState(requiresApproval);

  const choose = (next: boolean) => {
    if (next === value) return;
    setValue(next);
    startTransition(async () => {
      const res = await setRequiresApproval(next);
      if (res.ok) {
        toast.success(
          next ? 'Vouchers now need two approvals.' : 'Vouchers are now paid on submission.',
        );
        router.refresh();
      } else {
        setValue(!next);
        toast.error(res.error ?? 'That did not work.');
      }
    });
  };

  return (
    <Card className="overflow-hidden">
      <CardTitle
        icon={<ShieldCheck className="size-4" />}
        title="Approval"
        description="Whether a voucher needs two people to sign off before it is paid."
      />
      <div className="grid gap-3 p-5 sm:grid-cols-2" role="radiogroup" aria-label="Approval requirement">
        {OPTIONS.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={busy}
              onClick={() => choose(o.value)}
              className={cn(
                'hover-lift group flex flex-col items-start gap-3 rounded-xl border p-4 text-left disabled:opacity-60',
                active
                  ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-900/30'
                  : 'surface hover:border-[var(--border-strong)]',
              )}
            >
              <span
                className={cn(
                  'grid size-9 place-items-center rounded-lg transition',
                  active
                    ? 'gradient-brand text-white'
                    : 'surface-sunken text-muted group-hover:text-[var(--text-c)]',
                )}
              >
                <o.icon className="size-4" aria-hidden />
              </span>
              <span>
                <span
                  className={cn(
                    'block text-sm font-semibold',
                    active && 'text-brand-700 dark:text-brand-200',
                  )}
                >
                  {o.label}
                </span>
                <span className="text-subtle mt-0.5 block text-xs text-pretty">{o.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
