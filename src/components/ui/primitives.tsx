import { cn } from '@/lib/utils';
import type { ComponentProps, ReactNode } from 'react';

// ─── Button ──────────────────────────────────────────────────────────────────

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
};

const BUTTON_VARIANTS = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  secondary:
    'surface text-[var(--text-c)] shadow-sm hover:bg-[var(--surface-sunken)] border-[var(--border-strong)]',
  ghost: 'text-muted hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800',
  success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800',
} as const;

const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
} as const;

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-60',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('surface rounded-xl shadow-sm', className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-start justify-between gap-4 border-b px-5 py-4', className)}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}

// ─── Field ───────────────────────────────────────────────────────────────────

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
};

export function Field({ label, hint, error, required, children, htmlFor, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-label="required">
            *
          </span>
        )}
      </label>
      {children}
      {/* Errors replace hints rather than stacking, so the layout never jumps. */}
      {error ? (
        <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p className="text-subtle text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

const CONTROL =
  'w-full rounded-lg border bg-[var(--surface-raised)] px-3 py-2 text-sm shadow-sm transition ' +
  'placeholder:text-[var(--text-subtle)] ' +
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ' +
  'disabled:cursor-not-allowed disabled:bg-[var(--surface-sunken)] disabled:text-[var(--text-subtle)]';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(CONTROL, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(CONTROL, 'min-h-20 resize-y', className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select className={cn(CONTROL, 'cursor-pointer', className)} {...props}>
      {children}
    </select>
  );
}

/** A read-only computed value (Net Total, Grand Total). Visibly not an input. */
export function ComputedField({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2',
        emphasis
          ? 'border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-900/30'
          : 'surface-sunken',
      )}
    >
      <div className="text-subtle text-xs font-medium">{label}</div>
      <div className={cn('numeric mt-0.5 font-semibold', emphasis ? 'text-lg' : 'text-sm')}>
        {value}
      </div>
    </div>
  );
}

// ─── Choice pills (radio group) ──────────────────────────────────────────────

export function ChoicePill({
  checked,
  disabled,
  children,
  ...props
}: ComponentProps<'input'> & { children: ReactNode }) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition',
        checked
          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
          : 'surface hover:bg-[var(--surface-sunken)]',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <input type="radio" checked={checked} disabled={disabled} className="sr-only" {...props} />
      {children}
    </label>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && <div className="text-subtle mb-3">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {description && <p className="text-muted mt-1 max-w-sm text-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Loading placeholder that matches the shape of what is coming. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-[var(--surface-sunken)]', className)}
    />
  );
}
