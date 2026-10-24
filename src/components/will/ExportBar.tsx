'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { FileText, FileType2, ListChecks, Printer } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { saveFile } from '@/components/wealth/Household';
import { SEVERITY_TONE, Tag } from '@/components/wealth/shared';
import { exportStatus, type WillFileKind } from '@/lib/will/exports';
import type { WillRecord } from '@/lib/will/model';
import { Notice } from './shared';

/**
 * Where a will leaves the screen: the PDF to print, the Word file to edit, the
 * guide to signing, and a sample to look at.
 *
 * The files are made in the browser, only when asked for (lib/will/exports
 * loads the PDF and Word libraries on the first click). What the bar says is
 * what the file will be: while anything is still to fix, every file is marked
 * DRAFT and the bar says so and how many things stand in the way; when nothing
 * is, the same buttons make the clean copy. Nothing is ever refused, because a
 * person should be able to take a half-made will to their advocate.
 */
export function ExportBar({ record, today }: { record: WillRecord; today: string }) {
  const status = useMemo(() => exportStatus(record, today), [record, today]);
  const [busy, setBusy] = useState<WillFileKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);

  const make = async (kind: WillFileKind) => {
    setBusy(kind);
    setError(null);
    setMade(null);
    try {
      const { willFile } = await import('@/lib/will/exports');
      const f = await willFile(kind, record, today);
      saveFile(f.blob, f.name);
      setMade(f.name);
    } catch {
      setError('The file could not be made. Try again; if it keeps failing, download a backup from “Where it is kept” so nothing is lost.');
    } finally {
      setBusy(null);
    }
  };

  const tone = status.draft ? SEVERITY_TONE.review : 'var(--status-approved)';

  return (
    <section aria-label="Download" className="surface-lit a-ring rounded-2xl border p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Take it with you</h2>
        <Tag tone={tone}>{status.draft ? 'Draft' : 'Clean copy'}</Tag>
        <span className="text-subtle text-xs">Reference {status.reference}</span>
      </div>
      <p className="text-muted mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-pretty">
        {status.draft
          ? `Every file is marked DRAFT, because ${status.blockers} ${status.blockers === 1 ? 'thing still needs' : 'things still need'} fixing (see Checks). Fix them for a clean copy.`
          : 'Nothing is marked. The reference is printed on every page: if you change anything, print every page again so they all match.'}{' '}
        Have an advocate read it before you sign.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" loading={busy === 'will-pdf'} disabled={busy !== null} onClick={() => make('will-pdf')}>
          <Printer className="size-4" aria-hidden />
          Will to print (PDF)
        </Button>
        <Button loading={busy === 'will-docx'} disabled={busy !== null} onClick={() => make('will-docx')}>
          <FileType2 className="size-4" aria-hidden />
          Word file to edit
        </Button>
        <Button loading={busy === 'guide-pdf'} disabled={busy !== null} onClick={() => make('guide-pdf')}>
          <ListChecks className="size-4" aria-hidden />
          How to sign (PDF)
        </Button>
        <Button variant="ghost" loading={busy === 'sample-pdf'} disabled={busy !== null} onClick={() => make('sample-pdf')}>
          <FileText className="size-4" aria-hidden />
          See a sample will
        </Button>
      </div>

      {made && (
        <p role="status" style={{ '--tone': 'var(--status-approved)' } as CSSProperties} className="tinted mt-3 rounded-xl border px-3.5 py-2 text-[13px]">
          Saved {made}
        </p>
      )}
      {error && (
        <div className="mt-3">
          <Notice tone="var(--status-rejected)">{error}</Notice>
        </div>
      )}
    </section>
  );
}
