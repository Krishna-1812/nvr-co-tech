'use client';

import { createContext, useContext, useId, useState, type CSSProperties } from 'react';

/**
 * Whether the person is signed in, so the record's copy is also in their
 * account (lib/cloud). Every sentence on these screens that says where the
 * record is kept reads it, so none of them can claim "this device only" for a
 * record that is in an account too, or the other way round.
 */
export const SignedInContext = createContext(false);
export const useSignedIn = () => useContext(SignedInContext);
import {
  Banknote,
  Briefcase,
  Building2,
  Car,
  ChartCandlestick,
  ChartPie,
  CreditCard,
  Eye,
  EyeOff,
  Gem,
  GraduationCap,
  HandCoins,
  House,
  Landmark,
  LockKeyhole,
  PiggyBank,
  Receipt,
  ScrollText,
  Shapes,
  ShieldCheck,
  Sprout,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { GROUPS, head, type HeadId } from '@/lib/wealth/heads';
import { compact, inWords, parseMoney, rupees } from '@/lib/wealth/money';
import { cn } from '@/lib/utils';

/** A mark per head. Kept out of lib/wealth, which has no business holding components. */
export const HEAD_ICON: Record<HeadId, LucideIcon> = {
  bank: Landmark,
  deposit: PiggyBank,
  demat: ChartCandlestick,
  mutual_fund: ChartPie,
  retirement: Sprout,
  insurance: ShieldCheck,
  property: House,
  gold: Gem,
  vehicle: Car,
  bonds: ScrollText,
  business: Briefcase,
  receivable: HandCoins,
  other_asset: Shapes,
  home_loan: Building2,
  vehicle_loan: Car,
  personal_loan: Banknote,
  education_loan: GraduationCap,
  secured_loan: LockKeyhole,
  credit_card: CreditCard,
  informal_loan: Users,
  other_liability: Receipt,
};

/** A head's colour is its group's, so the allocation bar and the lists agree. */
export const headTone = (id: HeadId) => GROUPS[head(id).group].tone;

/** The masked stand-in for an amount when amounts are hidden. */
export const HIDDEN = '₹ ••••';

/**
 * An amount, or the stand-in when the person has hidden amounts (to show the
 * screen to someone, or on a train). `short` uses lakh/crore abbreviations.
 */
export function Amount({
  value,
  hide,
  short = false,
  className,
}: {
  value: number;
  hide: boolean;
  short?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('tabular-nums', className)} title={hide ? undefined : rupees(value)}>
      {hide ? HIDDEN : short ? compact(value) : rupees(value)}
    </span>
  );
}

/** A head's icon in a tile tinted with its group's colour. */
export function HeadTile({ id, size = 'md' }: { id: HeadId; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = HEAD_ICON[id];
  return (
    <span
      aria-hidden
      style={{ '--tone': headTone(id) } as CSSProperties}
      className={cn(
        'tinted grid shrink-0 place-items-center border',
        size === 'sm' && 'size-7 rounded-lg',
        size === 'md' && 'size-9 rounded-xl',
        size === 'lg' && 'size-11 rounded-2xl',
      )}
    >
      <Icon className={size === 'lg' ? 'size-5' : size === 'md' ? 'size-[18px]' : 'size-3.5'} />
    </span>
  );
}

/**
 * A money box that understands "85 lakh", "1.2 cr", "45k" and "12,50,000",
 * and says back what it read in words, so a slipped zero is caught at once.
 *
 * Holds the text as typed while it has focus and tidies it to plain digits on
 * blur, so nothing is reformatted under somebody's fingers. Reports a number,
 * `null` for "nothing entered", or leaves the value alone and shows why when
 * the text cannot be read.
 */
export function MoneyInput({
  id,
  value,
  onChange,
  placeholder = 'e.g. 12,50,000 or 12.5 lakh',
  className,
  'aria-describedby': describedBy,
}: {
  id?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  className?: string;
  'aria-describedby'?: string;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const [focused, setFocused] = useState(false);
  const [seen, setSeen] = useState(value);
  const noteId = useId();

  // Follow the value when it changes from outside (a "work it out" button),
  // but never while the person is typing in the box. Done while rendering,
  // which is how React wants state derived from a prop to be kept in step.
  if (value !== seen) {
    setSeen(value);
    if (!focused) setText(value === null ? '' : String(value));
  }

  const parsed = parseMoney(text);
  const bad = parsed === null;

  return (
    <div>
      <div className="relative">
        <span aria-hidden className="text-subtle pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
          ₹
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          placeholder={placeholder}
          aria-invalid={bad || undefined}
          aria-describedby={[noteId, describedBy].filter(Boolean).join(' ')}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            const p = parseMoney(text);
            if (typeof p === 'number') setText(String(p));
          }}
          onChange={(e) => {
            setText(e.target.value);
            const p = parseMoney(e.target.value);
            if (p === undefined) onChange(null);
            else if (p !== null) onChange(p);
          }}
          className={cn(
            'w-full rounded-lg border bg-[var(--surface-raised)] py-2 pr-3 pl-7 text-base tabular-nums shadow-[var(--elev-1)] transition lg:text-sm',
            'placeholder:text-[var(--text-subtle)] hover:border-[var(--border-strong)]',
            'focus:border-brand-500 focus:ring-brand-500/15 focus:ring-4 focus:outline-none',
            bad && 'border-[var(--status-rejected)]',
            className,
          )}
        />
      </div>
      <p id={noteId} aria-live="polite" className={cn('mt-1 min-h-4 text-xs', bad ? 'font-medium text-[var(--status-rejected)]' : 'text-subtle')}>
        {bad
          ? 'Could not read that. Try 1250000, 12,50,000 or 12.5 lakh.'
          : typeof parsed === 'number' && parsed >= 1000
            ? `${rupees(parsed)} · ${inWords(parsed)}`
            : ''}
      </p>
    </div>
  );
}

/**
 * An identifying number (account, folio, policy, PRAN), masked as dots until
 * the eye is pressed. Not a password field, on purpose: that would set every
 * browser offering to save it as a login.
 */
export function SecretInput({
  id,
  value,
  onChange,
  placeholder,
  inputMode,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: 'numeric' | 'text' | 'decimal' | 'email' | 'tel';
  invalid?: boolean;
  describedBy?: string;
}) {
  const [shown, setShown] = useState(value === '');
  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={false}
        data-1p-ignore
        data-lpignore="true"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full rounded-lg border bg-[var(--surface-raised)] py-2 pr-10 pl-3 font-mono text-base tracking-wide shadow-[var(--elev-1)] transition lg:text-sm',
          'placeholder:font-sans placeholder:tracking-normal placeholder:text-[var(--text-subtle)] hover:border-[var(--border-strong)]',
          'focus:border-brand-500 focus:ring-brand-500/15 focus:ring-4 focus:outline-none',
          invalid && 'border-[var(--status-rejected)]',
          !shown && '[-webkit-text-security:disc]',
        )}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Hide the number' : 'Show the number'}
        aria-pressed={shown}
        className="text-subtle absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md transition hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]"
      >
        {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

/** A small tinted label. */
export function Tag({ tone, children, className }: { tone: string; children: React.ReactNode; className?: string }) {
  return (
    <span
      style={{ '--tone': tone } as CSSProperties}
      className={cn('tinted inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', className)}
    >
      {children}
    </span>
  );
}

export const SEVERITY_TONE = {
  act: 'var(--status-rejected)',
  review: 'var(--status-warn)',
  note: 'var(--status-draft)',
} as const;

export const SEVERITY_LABEL = { act: 'Act on this', review: 'Review', note: 'Good to know' } as const;
