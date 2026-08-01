'use client';

import { useRef, useState, useTransition } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  ACCEPT_ATTR,
  BUCKET,
  formatBytes,
  storagePath,
  validateFile,
} from '@/lib/domain/attachments';
import {
  recordAttachment,
  deleteAttachment,
  getAttachmentUrl,
  type AttachmentRow,
} from '@/app/actions/attachments';
import { Button } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

/**
 * Invoice attachments.
 *
 * File bytes go straight from the browser to Supabase Storage under the user's
 * own session, so the storage policies authorise the write — nothing large is
 * routed through a server action.
 */
export function Attachments({
  voucherId,
  initial,
  canEdit,
}: {
  voucherId: string;
  initial: AttachmentRow[];
  canEdit: boolean;
}) {
  const [files, setFiles] = useState<AttachmentRow[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (list: FileList | File[]) => {
    const chosen = Array.from(list);
    if (chosen.length === 0) return;

    setUploading(true);
    const supabase = createClient();
    let count = files.length;

    for (const file of chosen) {
      const check = validateFile(file, count);
      if (!check.ok) {
        toast.error(check.error);
        continue;
      }

      const unique = crypto.randomUUID().slice(0, 8);
      const path = storagePath(voucherId, file.name, unique);

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

      if (upErr) {
        toast.error(`Could not upload “${file.name}”. ${upErr.message}`);
        continue;
      }

      const res = await recordAttachment({
        voucher_id: voucherId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      });

      if (!res.ok) {
        toast.error(res.error);
        continue;
      }

      setFiles((f) => [...f, res.data]);
      count += 1;
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const open = (id: string) => {
    setBusyId(id);
    startTransition(async () => {
      const res = await getAttachmentUrl(id);
      setBusyId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      window.open(res.data.url, '_blank', 'noopener');
    });
  };

  const remove = (row: AttachmentRow) => {
    setBusyId(row.id);
    startTransition(async () => {
      const res = await deleteAttachment(row.id);
      setBusyId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setFiles((f) => f.filter((x) => x.id !== row.id));
      toast.success(`“${row.file_name}” removed.`);
    });
  };

  return (
    <div className="space-y-3 p-5">
      {files.length === 0 && !canEdit && (
        <p className="text-subtle text-sm">No invoice was attached to this voucher.</p>
      )}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => {
            const isImage = f.mime_type?.startsWith('image/');
            const Icon = isImage ? ImageIcon : FileText;
            const busy = busyId === f.id;

            return (
              <li
                key={f.id}
                className="surface-sunken flex items-center gap-3 rounded-lg px-3 py-2.5"
              >
                <Icon className="text-muted size-4 shrink-0" aria-hidden />

                <button
                  onClick={() => open(f.id)}
                  disabled={busy}
                  className="min-w-0 flex-1 text-left disabled:opacity-60"
                >
                  <span className="flex items-center gap-1.5 truncate text-sm font-medium hover:text-brand-600 hover:underline">
                    {f.file_name}
                    {busy ? (
                      <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
                    ) : (
                      <ExternalLink className="size-3 shrink-0 opacity-50" aria-hidden />
                    )}
                  </span>
                  <span className="text-subtle text-xs">
                    {f.size_bytes ? formatBytes(f.size_bytes) : ''}
                  </span>
                </button>

                {canEdit && (
                  <button
                    onClick={() => remove(f)}
                    disabled={busy}
                    aria-label={`Remove ${f.file_name}`}
                    className="text-muted rounded-lg p-1.5 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void upload(e.dataTransfer.files);
          }}
          className={cn(
            'rounded-lg border border-dashed p-5 text-center transition',
            dragging
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30'
              : 'border-[var(--border-strong)]',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            className="sr-only"
            onChange={(e) => e.target.files && void upload(e.target.files)}
          />

          <Paperclip className="text-subtle mx-auto size-5" aria-hidden />
          <p className="text-muted mt-2 text-sm">
            Drop the invoice here, or{' '}
            <button
              onClick={() => inputRef.current?.click()}
              className="font-semibold text-brand-600 hover:underline"
            >
              choose a file
            </button>
          </p>
          <p className="text-subtle mt-1 text-xs">PDF or image, up to 10 MB each.</p>

          {uploading && (
            <Button variant="ghost" className="mx-auto mt-3" loading disabled>
              <Upload className="size-4" aria-hidden />
              Uploading…
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
