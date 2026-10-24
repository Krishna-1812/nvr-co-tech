'use client';

import { useRef, useState, type CSSProperties } from 'react';
import { Download, HardDrive, LockKeyhole, Trash2, Upload } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { saveFile } from '@/components/wealth/Household';
import { passcodeStrength } from '@/lib/wealth/lock';
import type { WillRecord } from '@/lib/will/model';
import { readWillBackup, willBackupFileName, type WillActions } from '@/lib/will/store';
import { Notice } from './shared';

/**
 * Where the draft is kept, and the controls over it: back it up, restore a
 * backup, lock it with a passcode, delete it.
 *
 * The first sentence on this screen says where the draft lives, because for a
 * will that is the first question a careful person asks. The honest answer is
 * "only in this browser", so a backup file is not an extra here: it is the only
 * other copy there is.
 */
export function DataPanel({
  record,
  actions,
  hasLock,
  selfName,
}: {
  record: WillRecord;
  actions: WillActions;
  hasLock: boolean;
  selfName: string;
}) {
  const [passcodeOpen, setPasscodeOpen] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [restore, setRestore] = useState<{ text: string; needsPasscode: boolean; error: string | null } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const people = record.people.length;
  const assets = record.assets.length;

  return (
    <div className="space-y-4">
      <section className="surface-lit a-ring flex gap-3 rounded-2xl border p-5">
        <HardDrive className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div>
          <h3 className="text-sm font-semibold">Kept only in this browser</h3>
          <p className="text-muted mt-1 text-[13.5px] leading-relaxed text-pretty">
            Your draft is not sent to a server, not saved to your account, and not counted in our statistics. Clearing this
            browser’s site data, or using another device, means it is gone. Download a backup to keep a copy.
            {hasLock ? ' It is locked with a passcode, so it is stored encrypted.' : ''}
          </p>
        </div>
      </section>

      {message && <Notice tone="var(--status-approved)">{message}</Notice>}

      <section className="surface-lit a-ring rounded-2xl border p-5">
        <h3 className="text-sm font-semibold">Backup</h3>
        <p className="text-muted mt-1 text-[13.5px]">
          A file you keep. {hasLock ? 'It is locked with the same passcode.' : 'It is not locked; anyone who has the file can read it.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              saveFile(new Blob([await actions.backup()], { type: 'application/json' }), willBackupFileName());
              setMessage('Backup downloaded.');
            }}
          >
            <Download className="size-4" aria-hidden />
            Download a backup
          </Button>
          <Button
            onClick={() => file.current?.click()}
          >
            <Upload className="size-4" aria-hidden />
            Restore from a backup
          </Button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Choose a backup file"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const text = await f.text();
              const r = await readWillBackup(text);
              setRestore({ text, needsPasscode: !r.ok && !!r.needsPasscode, error: r.ok || r.needsPasscode ? null : r.reason });
            }}
          />
        </div>
      </section>

      <section className="surface-lit a-ring rounded-2xl border p-5">
        <h3 className="text-sm font-semibold">Passcode</h3>
        <p className="text-muted mt-1 text-[13.5px] leading-relaxed">
          {hasLock
            ? 'This draft is encrypted on this device. You are asked for the passcode each time the page opens.'
            : 'Optional. A passcode encrypts the draft before it is stored here, so someone using this browser cannot read it.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => setPasscodeOpen(true)}>
            <LockKeyhole className="size-4" aria-hidden />
            {hasLock ? 'Change the passcode' : 'Lock with a passcode'}
          </Button>
          {hasLock && (
            <>
              <Button onClick={() => void actions.lockNow()}>Lock now</Button>
              <Button variant="ghost" onClick={async () => (await actions.removePasscode(), setMessage('Passcode removed. The draft is stored as plain text again.'))}>
                Remove the passcode
              </Button>
            </>
          )}
        </div>
      </section>

      <section className="surface-lit a-ring rounded-2xl border p-5">
        <h3 className="text-sm font-semibold">Delete</h3>
        <p className="text-muted mt-1 text-[13.5px]">Removes this draft from this browser. Anything you backed up stays in the file.</p>
        <Button className="mt-3" variant="danger" onClick={() => setWipeOpen(true)} disabled={people === 0 && assets === 0 && !record.testator.name}>
          <Trash2 className="size-4" aria-hidden />
          Delete this draft
        </Button>
      </section>

      <PasscodeModal
        open={passcodeOpen}
        changing={hasLock}
        onClose={() => setPasscodeOpen(false)}
        onSet={async (code) => {
          await actions.setPasscode(code);
          setPasscodeOpen(false);
          setMessage('Locked. You will be asked for the passcode next time.');
        }}
      />

      <RestoreModal
        pending={restore}
        current={`${people} ${people === 1 ? 'person' : 'people'} and ${assets} ${assets === 1 ? 'asset' : 'assets'}`}
        onClose={() => setRestore(null)}
        onRestore={(r) => {
          actions.replace(r);
          setRestore(null);
          setMessage('Restored from the backup.');
        }}
      />

      <Modal
        open={wipeOpen}
        onClose={() => setWipeOpen(false)}
        title="Delete this draft?"
        description={`The ${people} ${people === 1 ? 'person' : 'people'}, ${assets} ${assets === 1 ? 'asset' : 'assets'} and everything else are removed from this browser. This cannot be undone here.`}
      >
        <WipeConfirm
          onCancel={() => setWipeOpen(false)}
          onWipe={() => {
            actions.wipe(selfName);
            setWipeOpen(false);
            setMessage('The draft was deleted from this browser.');
          }}
        />
      </Modal>
    </div>
  );
}

function WipeConfirm({ onCancel, onWipe }: { onCancel: () => void; onWipe: () => void }) {
  const [typed, setTyped] = useState('');
  return (
    <>
      <Field label='Type "delete" to confirm' htmlFor="w-wipe">
        <Input id="w-wipe" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </Field>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="danger" disabled={typed.trim().toLowerCase() !== 'delete'} onClick={onWipe}>
          Delete everything
        </Button>
      </div>
    </>
  );
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
  const ready = strength.ok && a === b && ack;
  const reset = () => (setA(''), setB(''), setAck(false));

  return (
    <Modal
      open={open}
      onClose={() => (reset(), onClose())}
      title={changing ? 'Change the passcode' : 'Lock the draft with a passcode'}
      description="The draft is encrypted on this device with it. You will be asked for it each time this page opens."
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
        <Field label="Passcode" htmlFor="w-pc1" hint={a ? strength.note : 'At least 8 characters. A short sentence is easy to remember and hard to guess.'}>
          <Input id="w-pc1" type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} />
        </Field>
        <Field label="Type it again" htmlFor="w-pc2" error={b && a !== b ? 'The two do not match.' : undefined}>
          <Input id="w-pc2" type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />
        </Field>
        <label style={{ '--tone': 'var(--status-rejected)' } as CSSProperties} className="tinted flex cursor-pointer gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 accent-[var(--status-rejected)]" />
          <span className="text-[var(--text-c)]">
            I understand that <strong>a forgotten passcode cannot be recovered</strong>, by The Finance Intelligence or
            anyone else, and the draft would be lost unless I have an unlocked backup.
          </span>
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={() => (reset(), onClose())}>
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

function RestoreModal({
  pending,
  current,
  onClose,
  onRestore,
}: {
  pending: { text: string; needsPasscode: boolean; error: string | null } | null;
  current: string;
  onClose: () => void;
  onRestore: (r: WillRecord) => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open={pending !== null}
      onClose={() => (setCode(''), setError(null), onClose())}
      title="Restore from a backup?"
      description={`This replaces your current draft (${current}) with what is in the file.`}
    >
      {pending?.error && <Notice tone="var(--status-rejected)">{pending.error}</Notice>}
      <form
        className="mt-3 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!pending) return;
          setBusy(true);
          const r = await readWillBackup(pending.text, code || undefined);
          setBusy(false);
          if (r.ok) {
            setCode('');
            setError(null);
            onRestore(r.record);
          } else setError(r.reason);
        }}
      >
        {pending?.needsPasscode && (
          <Field label="Passcode of the backup" htmlFor="w-rcode" error={error ?? undefined}>
            <Input id="w-rcode" type="password" autoFocus autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
        )}
        {!pending?.needsPasscode && error && <Notice tone="var(--status-rejected)">{error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={() => (setCode(''), setError(null), onClose())}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!!pending?.error}>
            Replace my draft
          </Button>
        </div>
      </form>
    </Modal>
  );
}
