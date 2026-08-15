'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { removeAllConversations } from '@/app/actions/assist';
import { Button } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';

/**
 * The retention control.
 *
 * Nothing here expires on its own, and the alternative to a button like this is
 * a rule invented on somebody's behalf about how long their questions are kept.
 * Given the choice between deciding that for them and giving them the switch,
 * the switch is the honest one. It says exactly what it will do first.
 */
export function ClearAll({ count }: { count: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, startTransition] = useTransition();

  const clear = () => {
    startTransition(async () => {
      const outcome = await removeAllConversations();
      if (outcome.ok) {
        toast.success('History cleared.');
        setConfirming(false);
        router.refresh();
      } else {
        toast.error(outcome.error);
      }
    });
  };

  return (
    <>
      <Button onClick={() => setConfirming(true)}>
        <Trash2 className="size-4" aria-hidden />
        Delete all
      </Button>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Delete all ${count} conversations?`}
        description="Every question you have asked the assistant, and every answer it gave, goes for good. This cannot be undone."
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirming(false)} disabled={busy}>
            Keep them
          </Button>
          <Button variant="danger" onClick={clear} loading={busy}>
            <Trash2 className="size-4" aria-hidden />
            Delete everything
          </Button>
        </div>
      </Modal>
    </>
  );
}
