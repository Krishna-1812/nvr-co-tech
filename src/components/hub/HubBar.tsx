import Link from 'next/link';
import type { UserRole } from '@/lib/domain/workflow';
import type { Fiscal } from '@/lib/fiscal';
import { BRAND } from '@/lib/marketing/content';
import { LogoMark } from '../marketing/Logo';
import { UserMenu } from '../UserMenu';
import { AssistPanel } from '../assist/AssistPanel';

/**
 * The bar across the top of the hub.
 *
 * Deliberately thinner than Voucher Desk's. There is no rail here and no queue
 * badge, because the hub has exactly one job — choose a tool — and a page with one
 * job should not arrive wearing the chrome of the tool you have not opened yet.
 *
 * The assistant is the exception, and it earns its place: "which of these should
 * I be using" is a question about the hub itself, asked by somebody who has just
 * arrived and is looking at six tiles.
 *
 * The name here is the platform, not the product. That is the whole point of the
 * screen: you have signed in to The Finance Intelligence, and Voucher Desk is something
 * inside it.
 */
export function HubBar({
  user,
  fiscal,
  today,
}: {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    role: UserRole;
    /** Their Google picture, if they signed in with Google. Passed to UserMenu. */
    avatarUrl?: string | null;
  };
  fiscal: Fiscal;
  today: string;
}) {
  return (
    <header className="a-glass sticky top-0 z-30 border-b">
      <div className="mx-auto flex h-16 max-w-[92rem] items-center gap-3 px-4 sm:px-6">
        <Link href="/hub" className="group flex min-w-0 items-center gap-2.5">
          <LogoMark
            id="hub-mark"
            className="size-8 shrink-0 transition group-hover:brightness-110"
          />
          <span className="min-w-0 leading-none">
            <span className="block truncate text-[13.5px] font-semibold tracking-tight">
              {BRAND.name}
            </span>
            <span className="text-subtle mt-1 hidden truncate text-[10px] sm:block">
              {BRAND.tagline}
            </span>
          </span>
        </Link>

        <div className="ml-auto hidden items-center gap-3 md:flex">
          <span className="text-subtle numeric text-xs">{today}</span>
          <span aria-hidden className="h-4 w-px bg-[var(--border-c)]" />
          <span className="a-label" title={`${fiscal.daysLeft} days left in this financial year`}>
            FY {fiscal.label}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-3">
          {/* No tool is open here, so nothing is pinned and the question alone
              decides what the answer is built from. */}
          <AssistPanel agent={null} agentName={null} />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
