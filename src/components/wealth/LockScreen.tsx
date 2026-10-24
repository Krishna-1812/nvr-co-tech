'use client';

import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';

/**
 * A locked record. The passcode is asked for here, each time the page opens.
 *
 * "Forgot it?" is answered honestly: nothing can recover it. The one way
 * forward without it is to start again, or to restore a backup taken before
 * the passcode was set, and both are offered rather than hidden.
 */
export function LockScreen({
  onUnlock,
  onStartOver,
  subject = 'wealth record',
}: {
  onUnlock: (code: string) => Promise<boolean>;
  onStartOver: () => void;
  /** What is locked, as it reads in "Your … is locked". */
  subject?: string;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [typed, setTyped] = useState('');

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!code) return;
          setBusy(true);
          const ok = await onUnlock(code);
          setBusy(false);
          if (!ok) setError('That passcode does not open it.');
        }}
        className="surface-lit a-ring w-full max-w-md animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-[2rem] p-7 sm:p-9"
      >
        <span className="surface-sunken a-ring mx-auto grid size-14 place-items-center rounded-2xl border">
          <LockKeyhole className="size-6" aria-hidden />
        </span>
        <h1 className="mt-5 text-center text-xl font-semibold tracking-tight">Your {subject} is locked</h1>
        <p className="text-muted mt-2 text-center text-sm text-pretty">
          It is encrypted on this device. Enter the passcode to open it.
        </p>
        <div className="mt-6 space-y-3">
          <Field label="Passcode" htmlFor="unlock" error={error ?? undefined}>
            <Input
              id="unlock"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
            />
          </Field>
          <Button type="submit" variant="primary" className="w-full" loading={busy}>
            {busy ? 'Opening…' : 'Unlock'}
          </Button>
          <button type="button" onClick={() => setForgot(true)} className="text-muted mx-auto block text-[13px] underline-offset-2 hover:underline">
            Forgotten the passcode?
          </button>
        </div>
      </form>

      <Modal
        open={forgot}
        onClose={() => setForgot(false)}
        title="A forgotten passcode cannot be recovered"
        description="It was encrypted with the passcode on this device, and nobody, including us, holds a copy. If you have a backup taken before the passcode was set, you can start again and restore it."
      >
        <Field label='To delete this locked record and start again, type "start again"' htmlFor="startover">
          <Input id="startover" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setForgot(false)}>Keep trying</Button>
          <Button
            variant="danger"
            disabled={typed.trim().toLowerCase() !== 'start again'}
            onClick={() => {
              setForgot(false);
              onStartOver();
            }}
          >
            Delete and start again
          </Button>
        </div>
      </Modal>
    </div>
  );
}
