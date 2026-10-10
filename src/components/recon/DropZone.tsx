'use client';

import { useId, useRef, useState, type CSSProperties } from 'react';
import { Check, FileSpreadsheet, FileText, Loader2, TriangleAlert, Upload, X } from 'lucide-react';
import { ACCEPTED_EXTENSIONS } from '@/lib/recon/config';
import { cn } from '@/lib/utils';

/**
 * One ledger's file.
 *
 * A dropzone that is also a real file input, not a div pretending to be one. The
 * whole surface is a <label>, so it is keyboard-reachable, announces itself, and
 * opens the picker on Enter without a line of JavaScript. Drag and drop is added
 * on top for the mouse, which is the right way round: the accessible thing is
 * the mechanism and the pleasant thing is the enhancement.
 *
 * It is drawn as a whole panel rather than a dashed box, because the two of them
 * side by side are the first thing anybody sees of this tool, and a pair of grey
 * rectangles says "form". The panel carries the ledger's letter in its colour,
 * where it will keep appearing on every later screen, and says in words what
 * state it is in — waiting, reading, read, or refused — so the colour is never
 * the only thing saying it.
 */

const ACCEPT = ACCEPTED_EXTENSIONS.join(',');

/** ".xlsx" → "XLSX", for the format chips. */
const FORMATS = Array.from(
  new Set(ACCEPTED_EXTENSIONS.map((e) => (e === '.xlsm' ? 'XLSX' : e.slice(1).toUpperCase()))),
);

/**
 * A file's size, in a unit that is never zero.
 *
 * Rounding everything to whole kilobytes printed "0 KB" beside a small CSV,
 * which reads as an empty file at exactly the moment somebody is checking they
 * picked the right one.
 */
function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DropZone({
  letter,
  label,
  hint,
  file,
  lines,
  busy,
  error,
  onFile,
  onClear,
  accent,
}: {
  /** A or B: the name this book goes by until it has a better one. */
  letter: string;
  label: string;
  hint: string;
  file: File | null;
  /** How many lines were read out of the file, once it has been read. */
  lines?: number | null;
  busy?: boolean;
  error?: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
  /** The ledger's colour, so A and B are told apart before they are read. */
  accent: string;
}) {
  const id = useId();
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const Icon = file?.name.toLowerCase().endsWith('.pdf') ? FileText : FileSpreadsheet;
  const read = Boolean(file && !busy && !error);

  const status = busy
    ? { text: 'Reading', tone: accent, icon: Loader2, spin: true }
    : error
      ? { text: 'Not read', tone: 'var(--status-rejected)', icon: TriangleAlert, spin: false }
      : read
        ? { text: 'Read', tone: 'var(--status-approved)', icon: Check, spin: false }
        : null;
  const StatusIcon = status?.icon;

  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) onFile(dropped);
        }}
        style={{ '--tone': accent } as CSSProperties}
        className={cn(
          'group surface-lit a-ring relative flex min-h-60 cursor-pointer flex-col overflow-hidden rounded-3xl p-5 transition sm:p-6',
          'focus-within:ring-2 focus-within:ring-[var(--tone)]',
          over && 'ring-2 ring-[var(--tone)]',
          !file &&
            'hover:-translate-y-0.5 hover:shadow-[var(--elev-3)] motion-reduce:hover:translate-y-0',
        )}
      >
        {/* The ledger's colour, as light along the top edge. */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
        <span
          aria-hidden
          className="a-orb -top-24 -right-16 size-56 opacity-[0.14]"
          style={{ background: `radial-gradient(circle, ${accent}, transparent 68%)` }}
        />

        {/* Which book, and what state it is in. */}
        <span className="relative flex items-start justify-between gap-3">
          <span className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className="tinted grid size-10 shrink-0 place-items-center rounded-xl border text-sm font-bold"
            >
              {letter}
            </span>
            <span className="min-w-0">
              <span className="a-label block" style={{ color: accent }}>
                {label}
              </span>
              <span className="text-muted mt-1 block truncate text-[13px]">{hint}</span>
            </span>
          </span>
          {status && StatusIcon && (
            <span
              style={{ '--tone': status.tone } as CSSProperties}
              className="tinted inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold"
            >
              <StatusIcon className={cn('size-3', status.spin && 'animate-spin')} aria-hidden />
              {status.text}
            </span>
          )}
        </span>

        {/* The well the file goes into, and then the file. */}
        <span
          className={cn(
            'relative mt-5 flex flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border px-4 py-6 text-center transition',
            over
              ? 'border-solid border-[var(--tone)] bg-[color-mix(in_oklab,var(--tone)_8%,var(--surface-raised))]'
              : error
                ? 'border-solid border-[color-mix(in_oklab,var(--status-rejected)_45%,var(--border-c))] bg-[color-mix(in_oklab,var(--status-rejected)_5%,var(--surface-sunken))]'
                : file
                  ? 'surface-sunken a-inner border-solid'
                  : 'surface-sunken border-dashed border-[var(--border-strong)] group-hover:border-[var(--tone)]',
          )}
        >
          {/* The grid is what stops an empty well reading as a component that
              failed to load. It goes once there is a file to look at instead. */}
          {!file && (
            <span
              aria-hidden
              className="a-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(55%_65%_at_50%_50%,#000,transparent)]"
            />
          )}

          <span
            aria-hidden
            className={cn(
              'surface-lit elev-1 relative grid size-12 place-items-center rounded-2xl border transition',
              file ? 'text-[var(--tone)]' : 'text-subtle group-hover:text-[var(--tone)]',
            )}
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin" />
            ) : file ? (
              <Icon className="size-5" />
            ) : (
              <Upload className="size-5 transition-transform group-hover:-translate-y-0.5" />
            )}
          </span>

          <span className="relative block w-full min-w-0">
            <span className="block truncate text-sm font-semibold">
              {busy ? 'Reading…' : (file?.name ?? 'Drop a file, or choose one')}
            </span>
            <span className="text-subtle mt-1 block text-xs text-pretty">
              {file && !busy ? (
                <>
                  <span className="tabular-nums">{fileSize(file.size)}</span>
                  {read && typeof lines === 'number' && (
                    <>
                      {' · '}
                      <span className="tabular-nums">{lines.toLocaleString('en-IN')}</span>{' '}
                      {lines === 1 ? 'line' : 'lines'} read
                    </>
                  )}
                </>
              ) : (
                'Or drag it here from your desktop'
              )}
            </span>
          </span>

          {!file && (
            <span className="relative flex flex-wrap justify-center gap-1.5">
              {FORMATS.map((format) => (
                <span
                  key={format}
                  className="surface text-subtle rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide"
                >
                  {format}
                </span>
              ))}
            </span>
          )}
        </span>

        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            if (chosen) onFile(chosen);
          }}
        />
      </label>

      {file && !busy && (
        <button
          type="button"
          onClick={() => {
            onClear();
            // Without this the same file cannot be chosen again after removing
            // it, because the input's value never changed.
            if (inputRef.current) inputRef.current.value = '';
          }}
          className="text-subtle mt-2.5 ml-1 inline-flex max-w-full items-center gap-1.5 text-xs transition hover:text-[var(--text-c)]"
        >
          <X className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">Remove {file.name}</span>
        </button>
      )}

      {error && (
        <p
          role="alert"
          className="mt-2.5 ml-1 text-xs font-medium text-[color-mix(in_oklab,var(--status-rejected)_82%,var(--text-c))]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
