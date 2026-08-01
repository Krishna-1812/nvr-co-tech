'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, Pencil, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { createChapter, renameChapter, setChapterActive } from '@/app/actions/admin';
import { Button, Field, Input } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';

export type AdminChapter = {
  id: string;
  name: string;
  code: string;
  is_head_office: boolean;
  is_active: boolean;
  voucherCount?: number;
};

export function ChaptersManager({ chapters }: { chapters: AdminChapter[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        setAdding(false);
        setName('');
        setCode('');
        setEditingId(null);
        router.refresh();
      } else {
        toast.error(res.error ?? 'That did not work.');
      }
    });

  const startEdit = (c: AdminChapter) => {
    setEditingId(c.id);
    setEditName(c.name);
  };

  return (
    <>
      <div className="flex items-center justify-between border-b px-5 py-3.5">
        <div>
          <h2 className="font-semibold">Chapters</h2>
          <p className="text-muted mt-0.5 text-sm">
            {chapters.filter((c) => c.is_active).length} active of {chapters.length}
          </p>
        </div>
        <Button variant="primary" onClick={() => setAdding(true)} disabled={busy}>
          <Plus className="size-4" aria-hidden />
          Add chapter
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="surface-sunken text-subtle text-xs">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">Chapter</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Code</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">Vouchers</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {chapters.map((c) => (
              <tr key={c.id} className="transition hover:bg-[var(--surface-sunken)]">
                <td className="px-4 py-3">
                  {editingId === c.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-9"
                        aria-label={`Rename ${c.name}`}
                        autoFocus
                      />
                      <button
                        onClick={() => run(() => renameChapter({ id: c.id, name: editName }), 'Renamed.')}
                        disabled={busy || editName.trim().length < 2}
                        className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-40 dark:hover:bg-emerald-950/40"
                        aria-label="Save name"
                      >
                        <Check className="size-4" aria-hidden />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-muted rounded-lg p-1.5 transition hover:bg-[var(--surface-sunken)]"
                        aria-label="Cancel"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </div>
                  ) : (
                    <span className="flex items-center gap-2 font-medium">
                      {c.name}
                      {c.is_head_office && (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                          Head office
                        </span>
                      )}
                    </span>
                  )}
                </td>

                <td className="numeric text-muted px-4 py-3">{c.code}</td>
                <td className="numeric text-muted px-4 py-3 text-right">
                  {c.voucherCount || '—'}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={
                      c.is_active
                        ? 'inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'text-muted inline-flex rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-xs font-semibold'
                    }
                  >
                    {c.is_active ? 'Active' : 'Retired'}
                  </span>
                </td>

                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    {editingId !== c.id && (
                      <button
                        onClick={() => startEdit(c)}
                        disabled={busy}
                        className="text-muted rounded-lg p-1.5 transition hover:bg-[var(--surface-sunken)] disabled:opacity-40"
                        aria-label={`Rename ${c.name}`}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                    )}
                    {!c.is_head_office && (
                      <Button
                        onClick={() =>
                          run(
                            () => setChapterActive({ id: c.id, active: !c.is_active }),
                            c.is_active ? `${c.name} retired.` : `${c.name} reactivated.`,
                          )
                        }
                        disabled={busy}
                        className="h-8 px-2.5 text-xs"
                      >
                        {c.is_active ? 'Retire' : 'Reactivate'}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-subtle border-t px-5 py-3 text-xs">
        Chapters are retired rather than deleted — past vouchers reference them, and their history
        has to stay intact. A retired chapter disappears from new vouchers but every existing one
        keeps working.
      </p>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a chapter"
        description="The code appears in every voucher number this chapter issues, and cannot be changed afterwards."
      >
        <div className="space-y-4">
          <Field label="Chapter name" htmlFor="ch-name" required>
            <Input
              id="ch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CIO Association Indore"
              autoFocus
            />
          </Field>
          <Field
            label="Code"
            htmlFor="ch-code"
            required
            hint="2–6 letters or numbers. Used in voucher numbers: NVR/CODE/25-26/0001"
          >
            <Input
              id="ch-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="IDR"
              maxLength={6}
              className="numeric uppercase"
            />
          </Field>

          <div className="flex items-center gap-2 rounded-lg border border-dashed p-3">
            <Building2 className="text-subtle size-4 shrink-0" aria-hidden />
            <p className="text-muted text-xs">
              Vouchers will be numbered{' '}
              <span className="numeric font-semibold">NVR/{code || 'CODE'}/25-26/0001</span>
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={name.trim().length < 2 || code.length < 2}
              onClick={() => run(() => createChapter({ name, code }), `${name} added.`)}
            >
              Add chapter
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
