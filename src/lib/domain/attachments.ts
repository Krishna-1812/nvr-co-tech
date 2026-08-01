/**
 * Invoice attachments.
 *
 * v1 had nowhere to put the invoice at all — the entire product is driven by
 * invoices, and an approver was signing off on numbers with no source document
 * to check them against. This is the file that makes the approval queue
 * genuinely reviewable.
 */

export const BUCKET = 'invoices';

/** 10 MB. Scanned invoices are usually well under 2 MB; this leaves headroom. */
export const MAX_BYTES = 10 * 1024 * 1024;

export const MAX_FILES_PER_VOUCHER = 10;

/**
 * Deliberately narrow. Office documents are excluded: an invoice needs to be a
 * fixed rendition an approver and an auditor see identically, which a .docx is
 * not. Anything else should be printed to PDF first.
 */
export const ACCEPTED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

export const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.webp,.heic';

export type AttachmentInput = {
  name: string;
  size: number;
  type: string;
};

/** Human-readable size: 1536 → "1.5 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  // One decimal, but not a pointless ".0".
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

/**
 * Validate before uploading. Storage RLS decides *who* may write; this decides
 * *what* is worth accepting, and gives a usable message rather than a 400.
 */
export function validateFile(
  file: AttachmentInput,
  existingCount = 0,
): { ok: true } | { ok: false; error: string } {
  if (existingCount >= MAX_FILES_PER_VOUCHER) {
    return { ok: false, error: `A voucher can hold ${MAX_FILES_PER_VOUCHER} files.` };
  }
  if (file.size === 0) {
    return { ok: false, error: `“${file.name}” is empty.` };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `“${file.name}” is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_BYTES)}.`,
    };
  }
  if (!(ACCEPTED_MIME as readonly string[]).includes(file.type)) {
    return { ok: false, error: `“${file.name}” must be a PDF or an image.` };
  }
  return { ok: true };
}

/**
 * Build the storage path. The first segment MUST be the voucher id — the
 * storage policies in 0003_rls.sql read `(storage.foldername(name))[1]` to
 * decide access, so a different shape would silently break permissions.
 *
 * The stored name is sanitised and made unique; the original is kept in the
 * database column for display.
 */
export function storagePath(voucherId: string, fileName: string, unique: string): string {
  const dot = fileName.lastIndexOf('.');
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin';
  const stem = (dot > 0 ? fileName.slice(0, dot) : fileName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'file';

  return `${voucherId}/${unique}-${stem}.${ext}`;
}

/** Attachments an approver can preview inline rather than having to download. */
export function isPreviewable(mime: string | null): boolean {
  if (!mime) return false;
  return mime === 'application/pdf' || mime.startsWith('image/');
}
