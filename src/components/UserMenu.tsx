'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LayoutGrid, LogOut, Moon, Sun, Monitor, Radar, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ROLE_META, type UserRole } from '@/lib/domain/workflow';
import { setTheme, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Avatar } from './Avatar';

export function UserMenu({
  user,
  analyticsAdmin = false,
}: {
  user: {
    email: string;
    full_name: string | null;
    role: UserRole;
    /** Their Google picture, if they signed in with Google. */
    avatarUrl?: string | null;
  };
  /**
   * Whether to offer visitor intelligence.
   *
   * Decided in AppShell by the same Postgres function the row-level policies
   * call, and passed down rather than worked out here — a second copy of that
   * judgement is how a menu item ends up pointing at a screen the database will
   * hand nothing to.
   *
   * Note this is not `isAdmin(user.role)`. Being able to approve a payment is a
   * different permission from being able to see who read the pricing page, and
   * the two lists are deliberately unrelated.
   */
  analyticsAdmin?: boolean;
}) {
  const router = useRouter();
  const theme = useTheme();

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="elev-1 grid size-8 shrink-0 place-items-center rounded-full transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]"
          aria-label="Account menu"
        >
          <Avatar
            name={user.full_name}
            email={user.email}
            url={user.avatarUrl}
            px={64}
            className="size-8 rounded-full text-[11px]"
          />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="surface elev-4 animate-[pop_0.15s_ease-out] z-50 min-w-60 rounded-xl p-1.5"
        >
          <div className="flex items-center gap-2.5 border-b px-3 py-2.5">
            <Avatar
              name={user.full_name}
              email={user.email}
              url={user.avatarUrl}
              px={72}
              className="size-9 rounded-full text-[11px]"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.full_name ?? user.email}</p>
              <p className="text-subtle truncate text-xs">{user.email}</p>
            </div>
          </div>

          <div className="border-b px-3 py-2">
            <span className="inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
              {ROLE_META[user.role].label}
            </span>
            <p className="text-subtle mt-1.5 text-xs leading-relaxed">
              {ROLE_META[user.role].grants}
            </p>
          </div>

          <div className="px-1 py-1.5">
            <p className="text-subtle px-2 pb-1.5 text-[10px] font-semibold tracking-wide uppercase">
              Theme
            </p>
            <div className="surface-sunken flex gap-1 rounded-lg p-1">
              {([
                ['light', Sun],
                ['dark', Moon],
                ['system', Monitor],
              ] as const).map(([value, Icon]) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  aria-pressed={theme === value}
                  className={cn(
                    'flex flex-1 items-center justify-center rounded-md py-1.5 transition',
                    theme === value
                      ? 'elev-1 bg-[var(--surface-raised)] text-brand-700 dark:text-brand-200'
                      : 'text-muted hover:text-[var(--text-c)]',
                  )}
                  title={value}
                >
                  <Icon className="size-4" aria-hidden />
                  <span className="sr-only">{value}</span>
                </button>
              ))}
            </div>
          </div>

          {/*
            The workspace. This menu is the one piece of chrome both shells share,
            which makes it the only place the door back up is guaranteed to be
            reachable — the rail carries it too, but the rail is gone below `lg`
            and hidden when collapsed.
          */}
          <DropdownMenu.Item asChild>
            <Link
              href="/hub"
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-[var(--surface-sunken)]"
            >
              <LayoutGrid className="size-4" aria-hidden />
              All solutions
            </Link>
          </DropdownMenu.Item>

          {analyticsAdmin && (
            <DropdownMenu.Item asChild>
              <Link
                href="/analytics"
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-[var(--surface-sunken)]"
              >
                <Radar className="size-4" aria-hidden />
                Analytics
              </Link>
            </DropdownMenu.Item>
          )}

          <DropdownMenu.Item asChild>
            <Link
              href="/settings"
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-[var(--surface-sunken)]"
            >
              <Settings className="size-4" aria-hidden />
              Settings
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={signOut}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-[var(--surface-sunken)]"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
