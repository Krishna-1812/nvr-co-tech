'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, Pencil, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { createChapter, renameChapter, setChapterActive } from '@/app/actions/admin';
import {
  Button,
  CardTitle,
  DataTable,
  EmptyState,
  Field,
  Input,
  Td,
  Th,
  Thead,
  Tr,
} from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { fiscalYear, istToday } from '@/lib/fiscal';

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

  // The current financial year, so the worked example in the Add dialog cannot
  // drift out of step with the voucher form the way a hard-coded one did.
  const fy = fiscalYear(istToday()).label;

  return (
    <>
      <CardTitle
        icon={<Building2 className="size-4" />}
        title="Chapters"
        description={`${chapters.filter((c) => c.is_active).length} active of ${chapters.length}`}
        action={
          <Button variant="primary" size="sm" onClick={() => setAdding(true)} disabled={busy}>
            <Plus className="size-4" aria-hidden />
            Add chapter
          </Button>
        }
      />

      {/*
        Every voucher needs a chapter, so an organisation with none cannot raise
        anything at all — and this screen used to render its five column headers
        over nothing, above a footnote about retiring chapters that did not
        exist. It is the one screen where an empty table was actively misleading.
      */}
      {chapters.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-5" aria-hidden />}
          title="No chapters yet"
          description="Every voucher belongs to a chapter, so nothing can be raised until one exists. Most organisations start with a head office and add branches as they need them."
          action={
            <Button variant="primary" onClick={() => setAdding(true)} disabled={busy}>
              <Plus className="size-4" aria-hidden />
              Add the first chapter
            </Button>
          }
        />
      ) : (
      <DataTable>
        <Thead className="hidden sm:table-header-group">
          <tr>
            <Th>Chapter</Th>
            <Th className="hidden sm:table-cell">Code</Th>
            <Th align="right" className="hidden sm:table-cell">
              Vouchers
            </Th>
            <Th>Status</Th>
            <Th align="right">
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </Thead>
        <tbody className="divide-y">
          {chapters.map((c) => (
            <Tr
              key={c.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 sm:table-row sm:gap-0 sm:px-0 sm:py-0"
            >
              <Td className="col-start-1 row-span-2 row-start-1 px-0 py-0 sm:table-cell sm:px-4 sm:py-3">
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
                      onClick={() =>
                        run(() => renameChapter({ id: c.id, name: editName }), 'Renamed.')
                      }
                      disabled={busy || editName.trim().length < 2}
                      className="rounded-lg p-1.5 text-[var(--status-approved)] transition hover:bg-[var(--surface-sunken)] disabled:opacity-40"
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
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {c.name}
                    {c.is_head_office && (
                      <span
                        style={{ '--tone': 'var(--color-brand-500)' } as CSSProperties}
                        className="tinted rounded-full border px-2 py-0.5 text-xs font-semibold"
                      >
                        Head office
                      </span>
                    )}
                    {/*
                      Four columns do not fit a phone. The code is three letters and
                      belongs to the name anyway, so below `sm` it sits under it and
                      gives its column back — without that, every chapter name broke
                      across three lines and the Retire button sat off the screen edge.
                    */}
                    <span className="numeric text-subtle block w-full text-xs font-normal sm:hidden">
                      {c.code}
                    </span>
                  </span>
                )}
              </Td>

              <Td className="numeric text-muted hidden sm:table-cell">{c.code}</Td>
              <Td align="right" className="numeric text-muted hidden sm:table-cell">
                {c.voucherCount || '—'}
              </Td>

              <Td className="col-start-2 row-start-1 justify-self-end px-0 py-0 sm:table-cell sm:px-4 sm:py-3 sm:justify-self-auto">
                <span
                  style={
                    {
                      '--tone': c.is_active ? 'var(--status-approved)' : 'var(--status-draft)',
                    } as CSSProperties
                  }
                  className="tinted inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold"
                >
                  {c.is_active ? 'Active' : 'Retired'}
                </span>
              </Td>

              <Td
                align="right"
                className="col-start-2 row-start-2 justify-self-end px-0 py-0 sm:table-cell sm:px-4 sm:py-3 sm:justify-self-auto"
              >
                <div className="inline-flex items-center gap-1">
                  {editingId !== c.id && (
                    <button
                      onClick={() => startEdit(c)}
                      disabled={busy}
                      className="text-muted grid size-10 place-items-center rounded-lg transition hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)] disabled:opacity-40 sm:size-7"
                      aria-label={`Rename ${c.name}`}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                  )}
                  {!c.is_head_office && (
                    <Button
                      size="sm"
                      onClick={() =>
                        run(
                          () => setChapterActive({ id: c.id, active: !c.is_active }),
                          c.is_active ? `${c.name} retired.` : `${c.name} reactivated.`,
                        )
                      }
                      disabled={busy}
                      className="h-10 sm:h-8"
                    >
                      {c.is_active ? 'Retire' : 'Reactivate'}
                    </Button>
                  )}
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </DataTable>
      )}

      {/* Only worth saying once there is something that could be retired. */}
      {chapters.length > 0 && (
        <p className="text-subtle border-t px-5 py-3 text-xs text-pretty">
          Chapters are retired rather than deleted. Past vouchers reference them and their history
          has to stay intact, so a retired chapter disappears from new vouchers while every existing
          one keeps working.
        </p>
      )}

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a chapter"
        description="The code is what the suggested voucher number is built from, and it cannot be changed afterwards."
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
            hint={`2–6 letters or numbers. Used in voucher numbers: FI/CODE/${fy}/0001`}
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

          {/*
            Says "suggested", because since 0019 the number is typed by hand and
            this is what the Suggest button on the voucher form will offer. The
            year is computed rather than written down: the old hard-coded 25-26
            disagreed with the form's own hint the moment the year turned.
          */}
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-3">
            <Building2 className="text-subtle size-4 shrink-0" aria-hidden />
            <p className="text-muted text-xs">
              Vouchers will be suggested as{' '}
              <span className="numeric font-semibold">
                FI/{code || 'CODE'}/{fy}/0001
              </span>
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
