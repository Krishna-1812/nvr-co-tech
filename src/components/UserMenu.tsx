'use client';

import { useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogOut, Moon, Sun, Monitor } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/domain/workflow';
import { cn } from '@/lib/utils';

const ROLE_LABEL: Record<UserRole, string> = {
  member: 'Member',
  approver: 'Approver',
  admin: 'Admin',
  owner: 'Owner',
};

type Theme = 'light' | 'dark' | 'system';

/**
 * Theme preference lives in localStorage, which is external to React. Reading it
 * with useSyncExternalStore (rather than setState in an effect) gives a correct
 * server snapshot, so there is no hydration mismatch and no cascading render.
 * The inline script in the root layout applies it before first paint.
 */
const listeners = new Set<() => void>();

const themeStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    // Keep other tabs in sync.
    window.addEventListener('storage', cb);
    return () => {
      listeners.delete(cb);
      window.removeEventListener('storage', cb);
    };
  },
  getSnapshot: (): Theme => (localStorage.getItem('theme') as Theme) ?? 'system',
  // The server cannot know the preference; 'system' is the safe default.
  getServerSnapshot: (): Theme => 'system',
};

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  localStorage.setItem('theme', t);
  listeners.forEach((l) => l());
}

export function UserMenu({
  user,
}: {
  user: { email: string; full_name: string | null; role: UserRole };
}) {
  const router = useRouter();
  const theme = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  );

  const pick = (t: Theme) => applyTheme(t);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const initials =
    (user.full_name ?? user.email)
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join('') || '?';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="grid size-8 place-items-center rounded-full border bg-[var(--surface-sunken)] text-xs font-semibold transition hover:border-[var(--border-strong)]"
          aria-label="Account menu"
        >
          {initials}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="surface z-50 min-w-56 rounded-xl p-1.5 shadow-lg"
        >
          <div className="border-b px-3 py-2">
            <p className="truncate text-sm font-medium">{user.full_name ?? user.email}</p>
            <p className="text-subtle truncate text-xs">{user.email}</p>
            <span className="mt-1.5 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
              {ROLE_LABEL[user.role]}
            </span>
          </div>

          <div className="px-1 py-1.5">
            <p className="text-subtle px-2 pb-1 text-[10px] font-semibold tracking-wide uppercase">
              Theme
            </p>
            <div className="flex gap-1">
              {([
                ['light', Sun],
                ['dark', Moon],
                ['system', Monitor],
              ] as const).map(([value, Icon]) => (
                <button
                  key={value}
                  onClick={() => pick(value)}
                  aria-pressed={theme === value}
                  className={cn(
                    'flex flex-1 items-center justify-center rounded-md py-1.5 transition',
                    theme === value
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                      : 'text-muted hover:bg-[var(--surface-sunken)]',
                  )}
                  title={value}
                >
                  <Icon className="size-4" aria-hidden />
                  <span className="sr-only">{value}</span>
                </button>
              ))}
            </div>
          </div>

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
