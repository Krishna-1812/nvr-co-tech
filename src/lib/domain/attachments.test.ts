import { describe, it, expect } from 'vitest';
import {
  MAX_BYTES,
  MAX_FILES_PER_VOUCHER,
  formatBytes,
  validateFile,
  storagePath,
  isPreviewable,
} from './attachments';

const file = (over: Partial<{ name: string; size: number; type: string }> = {}) => ({
  name: 'invoice.pdf',
  size: 120_000,
  type: 'application/pdf',
  ...over,
});

describe('formatBytes', () => {
  it('reads naturally at each scale', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB');
  });

  it('drops a pointless trailing zero', () => {
    expect(formatBytes(2048)).toBe('2 KB');
  });
});

describe('validateFile', () => {
  it('accepts a normal PDF invoice', () => {
    expect(validateFile(file())).toEqual({ ok: true });
  });

  it('accepts photographed invoices', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/heic']) {
      expect(validateFile(file({ type })).ok, type).toBe(true);
    }
  });

  it('rejects office documents', () => {
    // An invoice must be a fixed rendition — a .docx renders differently for the
    // approver than for the auditor.
    const res = validateFile(
      file({ type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('PDF or an image');
  });

  it('rejects an empty file', () => {
    const res = validateFile(file({ size: 0 }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('empty');
  });

  it('rejects anything over the size limit and says how big it was', () => {
    const res = validateFile(file({ size: MAX_BYTES + 1 }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('10 MB');
      expect(res.error).toContain('invoice.pdf');
    }
  });

  it('accepts a file exactly at the limit', () => {
    expect(validateFile(file({ size: MAX_BYTES })).ok).toBe(true);
  });

  it('caps the number of files per voucher', () => {
    expect(validateFile(file(), MAX_FILES_PER_VOUCHER - 1).ok).toBe(true);
    expect(validateFile(file(), MAX_FILES_PER_VOUCHER).ok).toBe(false);
  });
});

describe('storagePath', () => {
  const id = '3f8a1c2e-0000-4000-8000-000000000001';

  /**
   * The storage policies read `(storage.foldername(name))[1]` to find the
   * voucher, so the first segment must be the voucher id. Any other shape would
   * silently break access control rather than erroring.
   */
  it('puts the voucher id in the first segment', () => {
    expect(storagePath(id, 'invoice.pdf', 'abc123').startsWith(`${id}/`)).toBe(true);
  });

  it('sanitises the filename', () => {
    const p = storagePath(id, 'Ravi & Co — Invoice #42 (final).pdf', 'abc123');
    expect(p).toBe(`${id}/abc123-ravi-co-invoice-42-final.pdf`);
  });

  it('keeps the extension lowercase', () => {
    expect(storagePath(id, 'SCAN.PDF', 'x')).toBe(`${id}/x-scan.pdf`);
  });

  it('stays unique for the same filename', () => {
    expect(storagePath(id, 'invoice.pdf', 'aaa')).not.toBe(storagePath(id, 'invoice.pdf', 'bbb'));
  });

  it('copes with a name that sanitises away entirely', () => {
    expect(storagePath(id, '???.pdf', 'x')).toBe(`${id}/x-file.pdf`);
  });

  it('copes with no extension', () => {
    expect(storagePath(id, 'scan', 'x')).toBe(`${id}/x-scan.bin`);
  });

  it('truncates an absurdly long name', () => {
    const p = storagePath(id, `${'a'.repeat(300)}.pdf`, 'x');
    expect(p.length).toBeLessThan(id.length + 60);
  });
});

describe('isPreviewable', () => {
  it('previews PDFs and images', () => {
    expect(isPreviewable('application/pdf')).toBe(true);
    expect(isPreviewable('image/png')).toBe(true);
  });

  it('does not claim to preview anything else', () => {
    expect(isPreviewable('application/zip')).toBe(false);
    expect(isPreviewable(null)).toBe(false);
  });
});
