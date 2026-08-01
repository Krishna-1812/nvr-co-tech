'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { setTheme, useTheme, type Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const OPTIONS: { value: Theme; label: string; hint: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', hint: 'Always light', icon: Sun },
  { value: 'dark', label: 'Dark', hint: 'Always dark', icon: Moon },
  { value: 'system', label: 'System', hint: 'Follows your device', icon: Monitor },
];

/** Larger, labelled version of the switcher in the account menu. */
export function ThemeChoice() {
  const theme = useTheme();

  return (
    <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Colour theme">
      {OPTIONS.map((o) => {
        const active = theme === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(o.value)}
            className={cn(
              'hover-lift group flex flex-col items-start gap-3 rounded-xl border p-4 text-left',
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
              <span className="text-subtle mt-0.5 block text-xs">{o.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
