import { cn } from '@/lib/utils';
import type { ComponentProps, ReactNode } from 'react';

// ─── Button ──────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const BUTTON_VARIANTS = {
  /*
   * The gradient is the app's one signature. It belongs on the single most
   * important control on a screen, which is what `primary` means.
   *
   * The inset white hairline along the top edge is what makes a filled button look
   * like a physical key rather than a coloured rectangle — the same trick every
   * raised surface in this app uses, at button scale.
   */
  primary:
    'gradient-brand elev-brand shadow-[inset_0_1px_0_oklch(1_0_0_/_0.22),var(--elev-brand)] hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:shadow-none',
  secondary:
    'surface text-[var(--text-c)] elev-1 hover:bg-[var(--surface-sunken)] hover:border-[var(--border-strong)] border-[var(--border-strong)]',
  ghost: 'text-muted hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]',
  danger:
    'bg-red-600 text-white shadow-[inset_0_1px_0_oklch(1_0_0_/_0.2),var(--elev-1)] hover:bg-red-700 active:bg-red-800',
  success:
    'bg-emerald-600 text-white shadow-[inset_0_1px_0_oklch(1_0_0_/_0.2),var(--elev-1)] hover:bg-emerald-700 active:bg-emerald-800',
} as const;

const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
} as const;

/**
 * The button look, detached from the button element.
 *
 * Half the controls in this app are navigations — New voucher, Export, View PDF
 * — and must stay anchors. They were each re-typing the gradient and the height
 * by hand, which is how a 10px difference between two adjacent "buttons" gets
 * in. A link and a button that look the same now say so in one place.
 */
export function buttonClass({
  variant = 'secondary',
  size = 'md',
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    'inline-flex items-center justify-center rounded-lg font-semibold whitespace-nowrap',
    'transition duration-150 active:scale-[0.98]',
    'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100',
    'aria-disabled:pointer-events-none aria-disabled:opacity-50',
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  );
}

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
      className={buttonClass({ variant, size, className })}
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

/**
 * Every panel in the app.
 *
 * `.surface-lit` carries the material — a raised fill, a short top-lit sheen, a
 * hairline and a two-part shadow — so changing what a card is made of is one line
 * in globals.css rather than a sweep through forty components.
 */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('surface-lit rounded-2xl', className)} {...props} />;
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

/**
 * The tile an icon sits in.
 *
 * The rail, the palette and the stat cards all seat their icons this way, and it
 * is what makes a stack of cards read as one system rather than as a stack of
 * pages. Shared with the rows that are card headings in all but name — an icon
 * loose beside text next to an icon in a tile is the same page speaking in two
 * voices, which is exactly what the settings screen was doing.
 */
export function IconTile({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      aria-hidden
      className={cn(
        'surface-sunken text-subtle grid size-7 shrink-0 place-items-center rounded-lg border',
        className,
      )}
      {...props}
    />
  );
}

/**
 * The heading row a card opens with. Every screen was assembling the same
 * icon + title + sub-line by hand and landing on a slightly different type size
 * each time, which is what made a stack of cards look like a stack of pages.
 */
export function CardTitle({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b px-5 py-3.5', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <IconTile>{icon}</IconTile>}
        <div className="min-w-0 pt-0.5">
          <h2 className="font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-muted mt-1 text-sm text-pretty">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0 pt-0.5">{action}</div>}
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────

/**
 * One table treatment, shared by the voucher list, the people list, chapters and
 * the recycle bin. Those four had drifted apart on padding and header casing;
 * the point of centralising it is that a financial system should look like it
 * counts the same way everywhere.
 */
export function DataTable({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="scroll-x-hint overflow-x-auto">
      <table className={cn('w-full text-left text-sm', className)} {...props} />
    </div>
  );
}

export function Thead({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('surface-sunken text-subtle border-b', className)} {...props} />;
}

type Align = 'left' | 'right';

/**
 * Column headers are small, spaced and upper-case so they read as labels rather
 * than as a first row of data.
 */
export function Th({
  align = 'left',
  className,
  ...props
}: Omit<ComponentProps<'th'>, 'align'> & { align?: Align }) {
  return (
    <th
      scope="col"
      className={cn(
        'px-4 py-2.5 text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap uppercase',
        align === 'right' && 'text-right',
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  align = 'left',
  className,
  ...props
}: Omit<ComponentProps<'td'>, 'align'> & { align?: Align }) {
  return (
    <td
      className={cn('px-4 py-3 align-middle', align === 'right' && 'text-right', className)}
      {...props}
    />
  );
}

/** A body row. Hover is a reading aid on a wide table, not decoration. */
export function Tr({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'transition-colors hover:bg-[var(--surface-sunken)] focus-within:bg-[var(--surface-sunken)]',
        className,
      )}
      {...props}
    />
  );
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
  /**
   * A control that acts on this one field — a Save beside a name. It is placed on
   * the control's line, which is not somewhere a caller can reliably put it from
   * outside: see the note below.
   */
  action?: ReactNode;
};

export function Field({
  label,
  hint,
  error,
  required,
  children,
  htmlFor,
  className,
  action,
}: FieldProps) {
  const labelEl = (
    <label htmlFor={htmlFor} className="text-sm font-medium">
      {label}
      {required && (
        <span className="ml-0.5 text-red-500" aria-label="required">
          *
        </span>
      )}
    </label>
  );

  // Errors replace hints rather than stacking, so the layout never jumps.
  const note = error ? (
    <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
      {error}
    </p>
  ) : hint ? (
    <p className="text-subtle text-xs">{hint}</p>
  ) : null;

  if (!action) {
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        {labelEl}
        {children}
        {note}
      </div>
    );
  }

  /*
   * With an action, the field is a grid rather than a column.
   *
   * The obvious thing — field and button side by side in a flex row, aligned with
   * `items-end` — puts the button level with the bottom of the *field*, and a
   * field ends with its hint rather than with its control. The button lands a
   * whole line of helper text below the input and reads as floating loose.
   * Nudging it back up with a margin means hard-coding the label's height, which
   * is wrong the moment a label wraps.
   *
   * So the control keeps column one and the action takes column two on the
   * control's own row, which aligns the two structurally at any label height. The
   * hint stays directly under the control, where it describes it.
   *
   * On a phone the grid collapses to one column and source order applies: label,
   * control, hint, action. The action goes last there on purpose — it is the end
   * of the task, and putting it above the hint would separate the hint from the
   * input it belongs to.
   */
  return (
    <div className={cn('grid gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_auto]', className)}>
      <div className="sm:col-start-1 sm:row-start-1">{labelEl}</div>
      <div className="sm:col-start-1 sm:row-start-2">{children}</div>
      {note && <div className="sm:col-start-1 sm:row-start-3">{note}</div>}
      {/* `grid` on a phone so a lone button fills the width the way it would as a
          flex child; `block` from `sm` so it shrinks back to its own size. */}
      <div className="mt-1.5 grid sm:col-start-2 sm:row-start-2 sm:mt-0 sm:block sm:self-center">
        {action}
      </div>
    </div>
  );
}

/*
 * text-base below lg, text-sm from lg up.
 *
 * Not a design preference, and the breakpoint is not arbitrary. iOS Safari zooms
 * the whole page in when a field under 16px takes focus and never zooms back out,
 * leaving somebody panned sideways on a form they were halfway through filling.
 *
 * `lg` rather than `sm` because that is where MobileDock stops showing, which is
 * this app the only honest signal of whether it is being touched or pointed at.
 * A tablet at 768px gets the dock, so it is a thumb, so it gets the bigger box —
 * a 38px field under a bottom bar was the same mistake as a 32px button there.
 * From `lg` the 14px density is exactly what it always was.
 */
const CONTROL =
  'w-full rounded-lg border bg-[var(--surface-raised)] px-3 py-2 text-base transition lg:text-sm ' +
  'shadow-[var(--elev-1)] placeholder:text-[var(--text-subtle)] ' +
  'hover:border-[var(--border-strong)] ' +
  'focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 ' +
  'disabled:cursor-not-allowed disabled:bg-[var(--surface-sunken)] disabled:text-[var(--text-subtle)] ' +
  'disabled:hover:border-[var(--border-c)]';

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
    <div className="animate-[fade_0.4s_ease-out_backwards] relative flex flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
      {/* An empty table should read as a considered state, not as a component that
          failed to load. The grid and the halo are what do that. */}
      <span
        aria-hidden
        className="a-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(45%_60%_at_50%_45%,#000,transparent)]"
      />
      {icon && (
        <div className="text-subtle relative mb-5">
          <span
            aria-hidden
            className="absolute inset-0 -z-10 m-auto size-24 rounded-full bg-[radial-gradient(circle,var(--color-brand-500),transparent_70%)] opacity-15 blur-2xl"
          />
          <span className="a-ring surface-sunken grid size-14 place-items-center rounded-2xl border">
            {icon}
          </span>
        </div>
      )}
      <p className="relative font-semibold tracking-tight">{title}</p>
      {description && (
        <p className="text-muted relative mt-2 max-w-sm text-sm leading-relaxed text-pretty">
          {description}
        </p>
      )}
      {action && <div className="relative mt-6">{action}</div>}
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
