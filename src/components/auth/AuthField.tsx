'use client';

import { useId, useState } from 'react';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Form controls for the sign-in screens.
 *
 * Purpose-built rather than the app's Field/Input. Those are tuned for a
 * thirty-two field voucher form, where compactness is the point; here there are
 * three fields on an otherwise empty half-screen, and they should feel like the
 * subject of the page rather than a row in a table.
 *
 * The icon sits after the input in the DOM so `peer-focus` can reach it — it is
 * absolutely positioned, so source order has no effect on where it lands.
 */

export function AuthField({
  label,
  htmlFor,
  hint,
  children,
  action,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
  /** Optional control on the label row, e.g. "Forgot password?". */
  action?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-[var(--m-ink)]">
          {label}
        </label>
        {action}
      </div>
      {children}
      {hint && <p className="m-dim-2 mt-1.5 text-[11.5px]">{hint}</p>}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { icon?: LucideIcon };

export function AuthInput({ icon: Icon, className, ...props }: InputProps) {
  /*
   * text-base below sm rather than 15px throughout: iOS Safari zooms the page
   * in whenever a field under 16px takes focus and never zooms back out, which
   * on a sign-in form leaves somebody panned sideways mid-password.
   */
  return (
    <div className="relative">
      <input
        {...props}
        className={cn(
          'peer h-12 w-full rounded-xl border border-[var(--m-line)] bg-white/[0.035] text-base sm:text-[15px] text-[var(--m-ink)] transition',
          'placeholder:text-[var(--m-dim-2)] placeholder:font-normal',
          'hover:border-[var(--m-line-2)]',
          // The ring replaces the border rather than sitting outside it, so the
          // control does not grow by 2px the moment it is focused.
          'focus:border-transparent focus:bg-white/[0.06] focus:ring-2 focus:ring-[var(--m-indigo)] focus:outline-none',
          Icon ? 'pr-4 pl-11' : 'px-4',
          className,
        )}
      />
      {Icon && (
        <Icon
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[var(--m-dim-2)] transition-colors peer-focus:text-[var(--m-indigo)]"
          aria-hidden
        />
      )}
    </div>
  );
}

/**
 * Password field with a reveal toggle.
 *
 * Not decoration: people mistype passwords far more often than they are
 * shoulder-surfed, and a login form that offers no way to check what was typed
 * turns one typo into a failed attempt and a guess at which field was wrong.
 */
export function AuthPassword({
  icon: Icon,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon?: LucideIcon }) {
  const [visible, setVisible] = useState(false);
  const describedBy = useId();

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn(
          'peer h-12 w-full rounded-xl border border-[var(--m-line)] bg-white/[0.035] text-base sm:text-[15px] text-[var(--m-ink)] transition',
          'placeholder:text-[var(--m-dim-2)]',
          'hover:border-[var(--m-line-2)]',
          'focus:border-transparent focus:bg-white/[0.06] focus:ring-2 focus:ring-[var(--m-indigo)] focus:outline-none',
          Icon ? 'pr-12 pl-11' : 'pr-12 pl-4',
          className,
        )}
      />
      {Icon && (
        <Icon
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[var(--m-dim-2)] transition-colors peer-focus:text-[var(--m-indigo)]"
          aria-hidden
        />
      )}

      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        aria-describedby={describedBy}
        className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-[var(--m-dim-2)] transition hover:bg-white/[0.06] hover:text-[var(--m-ink)]"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
      <span id={describedBy} className="sr-only">
        {visible ? 'Password is visible' : 'Password is hidden'}
      </span>
    </div>
  );
}
