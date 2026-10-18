'use client';

import { useRef, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  HardDrive,
  KeyRound,
  LockKeyhole,
  ScrollText,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Button, Card, CardTitle, Field, Input, Select } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { RELATIONS, SELF, newId, type Profile, type WealthRecord, type WillStatus } from '@/lib/wealth/model';
import { shortDate } from '@/lib/wealth/checks';
import { passcodeStrength } from '@/lib/wealth/lock';
import { readBackup, type WealthActions } from '@/lib/wealth/store';
import { cn } from '@/lib/utils';
import { MoneyInput } from './shared';

/**
 * The household, the will, the people who should know, and the record's own
 * data: backup, restore, exports, the passcode, and deleting it.
 *
 * Profile changes save as they are typed. There is nothing to submit on a
 * name, and a "Save" button on a card nobody thinks of as a form is a button
 * people forget to press.
 */

export function Household({
  record,
  actions,
  hasLock,
  onExport,
  selfName,
}: {
  record: WealthRecord;
  actions: WealthActions;
  hasLock: boolean;
  onExport: (kind: 'pdf-full' | 'pdf-masked' | 'excel') => Promise<void>;
  selfName: string;
}) {
  const p = record.profile;
  const setProfile = (patch: Partial<Profile>) => actions.setProfile({ ...p, ...patch });
  const setMember = (id: string, patch: { name?: string; relation?: string }) =>
    setProfile({ members: p.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const holders = (id: string) => record.items.filter((i) => i.holder === id).length;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <Card>
          <CardTitle
            icon={<Users className="size-4" />}
            title="Your household"
            description="Add the people whose things you are recording, so each entry can say whose it is."
          />
          <div className="space-y-3 px-5 py-5 sm:px-6">
            {p.members.map((m) => (
              <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)_auto] items-end gap-2">
                <Field label={m.id === SELF ? 'You' : 'Name'} htmlFor={`mm-${m.id}`}>
                  <Input
                    id={`mm-${m.id}`}
                    value={m.name}
                    placeholder={m.id === SELF ? 'Your name' : 'Their name'}
                    onChange={(e) => setMember(m.id, { name: e.target.value })}
                  />
                </Field>
                {m.id === SELF ? (
                  <p className="text-subtle pb-2.5 text-sm">Self</p>
                ) : (
                  <Field label="Relation" htmlFor={`mr-${m.id}`}>
                    <Select id={`mr-${m.id}`} value={m.relation} onChange={(e) => setMember(m.id, { relation: e.target.value })}>
                      <option value="">Choose…</option>
                      {RELATIONS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </Select>
                  </Field>
                )}
                {m.id === SELF ? (
                  <span className="size-9" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setProfile({ members: p.members.filter((x) => x.id !== m.id) })}
                    title={holders(m.id) > 0 ? `Their ${holders(m.id)} entries are kept; the checks will ask who holds them now.` : undefined}
                    aria-label={`Remove ${m.name || 'this member'}`}
                    className="text-subtle mb-0.5 grid size-9 place-items-center rounded-lg transition hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            ))}
            <Button size="sm" onClick={() => setProfile({ members: [...p.members, { id: newId(), name: '', relation: '' }] })}>
              <UserPlus className="size-3.5" aria-hidden />
              Add a family member
            </Button>
          </div>
        </Card>

        <Card>
          <CardTitle
            icon={<ScrollText className="size-4" />}
            title="Will"
            description="Nominees receive the money. A will decides who it finally belongs to, and covers everything without a nominee."
          />
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <fieldset>
              <legend className="text-sm font-medium">Is there a will?</legend>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:max-w-md">
                {(
                  [
                    ['yes', 'Yes, signed'],
                    ['drafting', 'Being drafted'],
                    ['no', 'No'],
                  ] as [WillStatus, string][]
                ).map(([s, label]) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={p.will === s}
                    onClick={() => setProfile({ will: s })}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
                      p.will === s ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]' : 'hover:bg-[var(--surface-sunken)]',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            {p.will !== 'no' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Signed original kept at" htmlFor="wk" hint="So someone can find it">
                  <Input id="wk" value={p.willKept} onChange={(e) => setProfile({ willKept: e.target.value })} placeholder="e.g. with the lawyer, in the locker" />
                </Field>
                <Field label="Executor" htmlFor="we" hint="Who will carry it out">
                  <Input id="we" value={p.executor} onChange={(e) => setProfile({ executor: e.target.value })} />
                </Field>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle icon={<KeyRound className="size-4" />} title="People who should know" description="This record only helps if someone can find it when it matters." />
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
            <Field label="Someone who knows this record exists" htmlFor="wtr" hint="And where the backup is kept">
              <Input id="wtr" value={p.trusted} onChange={(e) => setProfile({ trusted: e.target.value })} placeholder="Name and phone" />
            </Field>
            <Field label="Emergency contact" htmlFor="wem">
              <Input id="wem" value={p.emergency} onChange={(e) => setProfile({ emergency: e.target.value })} placeholder="Name and phone" />
            </Field>
            <Field label="Monthly household spending" htmlFor="wex" hint="Optional. Shows how long liquid money would last." className="sm:col-span-2">
              <MoneyInput id="wex" value={p.monthlyExpenses} onChange={(v) => setProfile({ monthlyExpenses: v })} placeholder="e.g. 60,000" />
            </Field>
          </div>
        </Card>
      </div>

      <DataPanel record={record} actions={actions} hasLock={hasLock} onExport={onExport} selfName={selfName} />
    </div>
  );
}

// ── Your data ───────────────────────────────────────────────────────────────

function DataPanel({
  record,
  actions,
  hasLock,
  onExport,
  selfName,
}: {
  record: WealthRecord;
  actions: WealthActions;
  hasLock: boolean;
  onExport: (kind: 'pdf-full' | 'pdf-masked' | 'excel') => Promise<void>;
  selfName: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<'set' | 'remove' | 'wipe' | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle
          icon={<HardDrive className="size-4" />}
          title="Your data"
          description="Kept in this browser on this device, under your sign-in. It is never sent to a server, ours included."
        />
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="surface-sunken rounded-2xl border px-4 py-3 text-[13px]">
            <p>
              <span className="text-muted">Last backup:</span>{' '}
              <strong>{record.lastBackupAt ? shortDate(record.lastBackupAt.slice(0, 10)) : 'never'}</strong>
            </p>
            <p className="text-muted mt-1">
              Clearing this browser’s data, or losing the device, loses the record. A backup file is the only copy
              anywhere else. Keep it somewhere safe{hasLock ? '; it is locked with your passcode' : ''}.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="primary"
              loading={busy === 'backup'}
              onClick={() =>
                run('backup', async () => {
                  const text = await actions.backup();
                  const { backupFileName } = await import('@/lib/wealth/store');
                  saveFile(new Blob([text], { type: 'application/json' }), backupFileName());
                })
              }
            >
              <Download className="size-4" aria-hidden />
              Download a backup
            </Button>
            <Button onClick={() => setRestoreOpen(true)}>
              <Upload className="size-4" aria-hidden />
              Restore from a backup
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle
          icon={<FileText className="size-4" />}
          title="Print or share"
          description="A PDF of the whole record, or an Excel workbook with a sheet for each part. Made in your browser."
        />
        <div className="grid gap-2 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <Button loading={busy === 'pdf-full'} onClick={() => run('pdf-full', () => onExport('pdf-full'))}>
            <FileText className="size-4" aria-hidden />
            PDF for your family
          </Button>
          <Button loading={busy === 'pdf-masked'} onClick={() => run('pdf-masked', () => onExport('pdf-masked'))}>
            <FileText className="size-4" aria-hidden />
            PDF with numbers hidden
          </Button>
          <Button loading={busy === 'excel'} onClick={() => run('excel', () => onExport('excel'))} className="sm:col-span-2">
            <FileSpreadsheet className="size-4" aria-hidden />
            Excel workbook
          </Button>
          <p className="text-subtle text-xs sm:col-span-2">
            The family copy prints account numbers in full, for whoever has to make a claim. The other shows only the
            last four digits, for sharing with an adviser.
          </p>
        </div>
      </Card>

      <Card>
        <CardTitle
          icon={<LockKeyhole className="size-4" />}
          title="Passcode"
          description={
            hasLock
              ? 'This record is locked with a passcode. It is asked for each time the page opens.'
              : 'Anyone who can open this browser can read the record. A passcode encrypts it on this device.'
          }
        />
        <div className="flex flex-wrap gap-2 px-5 py-5 sm:px-6">
          {hasLock ? (
            <>
              <Button onClick={() => run('lock', () => actions.lockNow())} loading={busy === 'lock'}>
                <LockKeyhole className="size-4" aria-hidden />
                Lock now
              </Button>
              <Button onClick={() => setModal('set')}>Change passcode</Button>
              <Button variant="ghost" onClick={() => setModal('remove')}>
                Remove passcode
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => setModal('set')}>
              <LockKeyhole className="size-4" aria-hidden />
              Set a passcode
            </Button>
          )}
        </div>
      </Card>

      <div className="rounded-3xl border border-dashed px-5 py-4">
        <p className="text-sm font-semibold">Delete everything</p>
        <p className="text-muted mt-0.5 text-[13px]">Removes every entry from this device. Backups you have downloaded are not touched.</p>
        <Button size="sm" variant="ghost" className="mt-2 text-[var(--status-rejected)]" onClick={() => setModal('wipe')}>
          <Trash2 className="size-3.5" aria-hidden />
          Delete the record
        </Button>
      </div>

      <PasscodeModal
        open={modal === 'set'}
        changing={hasLock}
        onClose={() => setModal(null)}
        onSet={async (code) => {
          await actions.setPasscode(code);
          setModal(null);
        }}
      />
      <Modal
        open={modal === 'remove'}
        onClose={() => setModal(null)}
        title="Remove the passcode?"
        description="The record will be stored on this device as plain text again, readable by anyone who can open this browser."
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setModal(null)}>Keep it</Button>
          <Button
            variant="danger"
            onClick={async () => {
              await actions.removePasscode();
              setModal(null);
            }}
          >
            Remove passcode
          </Button>
        </div>
      </Modal>
      <WipeModal
        open={modal === 'wipe'}
        count={record.items.length}
        onClose={() => setModal(null)}
        onWipe={() => {
          actions.wipe(selfName);
          setModal(null);
        }}
      />
      <RestoreModal open={restoreOpen} current={record.items.length} onClose={() => setRestoreOpen(false)} onRestore={(r) => actions.replace(r)} />
    </div>
  );
}

export function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function PasscodeModal({
  open,
  changing,
  onClose,
  onSet,
}: {
  open: boolean;
  changing: boolean;
  onClose: () => void;
  onSet: (code: string) => Promise<void>;
}) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const strength = passcodeStrength(a);
  const match = a === b;
  const ready = strength.ok && match && ack;

  const reset = () => {
    setA('');
    setB('');
    setAck(false);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={changing ? 'Change the passcode' : 'Lock the record with a passcode'}
      description="The record is encrypted on this device with it. You will be asked for it each time this page opens."
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ready) return;
          setBusy(true);
          try {
            await onSet(a);
            reset();
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-4"
      >
        <Field label="Passcode" htmlFor="pc1" hint={a ? strength.note : 'At least 8 characters. A short sentence is easy to remember and hard to guess.'}>
          <Input id="pc1" type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} />
        </Field>
        <Field label="Type it again" htmlFor="pc2" error={b && !match ? 'The two do not match.' : undefined}>
          <Input id="pc2" type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />
        </Field>
        <label
          style={{ '--tone': 'var(--status-rejected)' } as React.CSSProperties}
          className="tinted flex cursor-pointer gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed"
        >
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 accent-[var(--status-rejected)]" />
          <span className="text-[var(--text-c)]">
            I understand that <strong>a forgotten passcode cannot be recovered</strong>, by The Finance Intelligence or
            anyone else, and the record would be lost unless I have an unlocked backup.
          </span>
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!ready} loading={busy}>
            {changing ? 'Change passcode' : 'Lock with this passcode'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function WipeModal({ open, count, onClose, onWipe }: { open: boolean; count: number; onClose: () => void; onWipe: () => void }) {
  const [typed, setTyped] = useState('');
  return (
    <Modal
      open={open}
      onClose={() => {
        setTyped('');
        onClose();
      }}
      title="Delete the whole record?"
      description={`All ${count} ${count === 1 ? 'entry' : 'entries'} and the household details are removed from this device. This cannot be undone here.`}
    >
      <Field label='Type "delete" to confirm' htmlFor="wipe">
        <Input id="wipe" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </Field>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="danger"
          disabled={typed.trim().toLowerCase() !== 'delete'}
          onClick={() => {
            setTyped('');
            onWipe();
          }}
        >
          Delete everything
        </Button>
      </div>
    </Modal>
  );
}

export function RestoreModal({
  open,
  current,
  onClose,
  onRestore,
}: {
  open: boolean;
  current: number;
  onClose: () => void;
  onRestore: (r: WealthRecord) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<WealthRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setText(null);
    setName('');
    setNeedsCode(false);
    setCode('');
    setError(null);
    setFound(null);
    if (file.current) file.current.value = '';
  };

  const tryRead = async (t: string, passcode?: string) => {
    setBusy(true);
    const r = await readBackup(t, passcode);
    setBusy(false);
    if (r.ok) {
      setFound(r.record);
      setError(null);
      setNeedsCode(false);
    } else {
      setNeedsCode(!!r.needsPasscode);
      setError(passcode || !r.needsPasscode ? r.reason : null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Restore from a backup"
      description="Choose a backup file downloaded from Wealth Tracker."
    >
      <div className="space-y-4">
        <label className="surface-sunken flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-4 text-sm transition hover:border-[var(--border-strong)]">
          <Upload className="text-subtle size-5" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{name || 'Choose the .json backup file'}</span>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setName(f.name);
              setFound(null);
              const t = await f.text();
              setText(t);
              await tryRead(t);
            }}
          />
        </label>

        {needsCode && text && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void tryRead(text, code);
            }}
            className="space-y-3"
          >
            <Field label="This backup is locked. Its passcode:" htmlFor="rc">
              <Input id="rc" type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Button type="submit" loading={busy}>
              Open the backup
            </Button>
          </form>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-[var(--status-rejected)]">
            {error}
          </p>
        )}

        {found && (
          <div className="space-y-3">
            <div className="surface-sunken rounded-xl border px-4 py-3 text-[13px]">
              <p>
                This backup holds <strong>{found.items.length} {found.items.length === 1 ? 'entry' : 'entries'}</strong>, last changed{' '}
                {shortDate(found.updatedAt.slice(0, 10))}.
              </p>
              {current > 0 && (
                <p className="mt-1 font-medium text-[var(--status-rejected)]">
                  Restoring replaces the {current} {current === 1 ? 'entry' : 'entries'} on this device now.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={onClose}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => {
                  onRestore(found);
                  reset();
                  onClose();
                }}
              >
                Restore {found.items.length} {found.items.length === 1 ? 'entry' : 'entries'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
