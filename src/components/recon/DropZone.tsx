'use client';

import { useId, useRef, useState } from 'react';
import { FileSpreadsheet, FileText, Loader2, Upload, X } from 'lucide-react';
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
 */

const ACCEPT = ACCEPTED_EXTENSIONS.join(',');

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
  label,
  hint,
  file,
  busy,
  error,
  onFile,
  onClear,
  accent,
}: {
  label: string;
  hint: string;
  file: File | null;
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

  return (
    <div>
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
        style={{ '--tone': accent } as React.CSSProperties}
        className={cn(
          'group relative flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed p-6 text-center transition',
          over
            ? 'border-[var(--tone)] bg-[color-mix(in_oklab,var(--tone)_8%,var(--surface-raised))]'
            : error
              ? 'border-red-400 bg-red-50/40 dark:bg-red-950/20'
              : file
                ? 'surface border-solid'
                : 'surface-sunken hover:border-[var(--border-strong)]',
        )}
      >
        {/* The grid is what stops an empty panel reading as a component that
            failed to load. It goes once there is a file to look at instead. */}
        {!file && (
          <span
            aria-hidden
            className="a-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(50%_60%_at_50%_50%,#000,transparent)]"
          />
        )}

        <span
          aria-hidden
          className={cn(
            'relative grid size-11 place-items-center rounded-xl border transition',
            file ? 'tinted' : 'surface text-subtle group-hover:text-[var(--text-c)]',
          )}
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : file ? (
            <Icon className="size-5" />
          ) : (
            <Upload className="size-5" />
          )}
        </span>

        <span className="relative min-w-0">
          <span className="a-label block" style={{ color: accent }}>
            {label}
          </span>
          <span className="mt-1.5 block truncate text-sm font-semibold">
            {busy ? 'Reading…' : (file?.name ?? 'Drop a file, or choose one')}
          </span>
          <span className="text-subtle mt-1 block text-xs text-pretty">
            {file && !busy ? `${fileSize(file.size)} · ${hint}` : hint}
          </span>
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
          className="text-subtle mt-2 inline-flex items-center gap-1.5 text-xs transition hover:text-[var(--text-c)]"
        >
          <X className="size-3.5" aria-hidden />
          Remove {file.name}
        </button>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
