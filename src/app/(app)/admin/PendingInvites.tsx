'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Mail, MailPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { revokeInvite, emailInvite, type PendingInvite } from '@/app/actions/invites';
import { ROLE_META } from '@/lib/domain/workflow';
import { Button, Card, CardTitle, EmptyState } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';

/** "23 August" — the year is only worth saying if it is not this one. */
function shortDate(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const sameYear = at.getFullYear() === new Date().getFullYear();
  return at.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/**
 * Invites that are still open, and what can be done about them.
 *
 * The gap this fills: a created invite used to exist only in the tab that made
 * it. The link was shown once, refreshing the page lost it, and nothing in the
 * product ever read the invites table — so an admin who closed the tab could
 * neither resend nor cancel, only mint a second live token for the same person.
 *
 * `emailEnabled` is threaded in rather than read here because it depends on
 * server-side environment variables. Without it the Send button would be a
 * button that always fails, so it simply is not offered.
 */
export function PendingInvites({
  invites,
  emailEnabled,
}: {
  invites: PendingInvite[];
  emailEnabled: boolean;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<PendingInvite | null>(null);

  const copy = async (invite: PendingInvite) => {
    await navigator.clipboard.writeText(invite.link);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const send = (invite: PendingInvite) =>
    startTransition(async () => {
      const res = await emailInvite(invite.id);
      if (res.ok) toast.success(`Invite emailed to ${res.data.to}.`);
      else toast.error(res.error);
    });

  const revoke = (invite: PendingInvite) =>
    startTransition(async () => {
      const res = await revokeInvite(invite.id);
      setRevoking(null);
      if (res.ok) {
        toast.success(`The invite for ${invite.email} has been withdrawn.`);
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <Card className="overflow-hidden">
      <CardTitle
        icon={<Mail className="size-4" />}
        title="Invites waiting"
        description={
          invites.length === 0
            ? 'Nobody has an invite outstanding.'
            : `${invites.length} ${invites.length === 1 ? 'person has' : 'people have'} been invited and not joined yet.`
        }
      />

      {invites.length === 0 ? (
        <EmptyState
          icon={<Mail className="size-5" aria-hidden />}
          title="No invites outstanding"
          description="An invite appears here until the person accepts it, or until it expires fourteen days after you create it."
        />
      ) : (
        <ul className="divide-y">
          {invites.map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
              <div className="min-w-[12rem] flex-1">
                <p className="truncate text-sm font-medium">{invite.email}</p>
                <p className="text-subtle mt-0.5 text-xs">
                  {ROLE_META[invite.role].label} · expires {shortDate(invite.expiresAt)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => copy(invite)}>
                  {copiedId === invite.id ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    <Copy className="size-4" aria-hidden />
                  )}
                  {copiedId === invite.id ? 'Copied' : 'Copy link'}
                </Button>

                {emailEnabled && (
                  <Button variant="ghost" size="sm" onClick={() => send(invite)} disabled={busy}>
                    <MailPlus className="size-4" aria-hidden />
                    Send again
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRevoking(invite)}
                  disabled={busy}
                  aria-label={`Withdraw the invite for ${invite.email}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Withdraw
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!emailEnabled && invites.length > 0 && (
        <p className="text-subtle border-t px-5 py-3 text-xs text-pretty">
          No email is sent from this deployment, so the link has to be passed on by hand. It can be
          copied again from here at any time until it expires.
        </p>
      )}

      <Modal
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title="Withdraw this invite?"
        description={
          revoking
            ? `The link sent to ${revoking.email} stops working straight away. You can invite them again afterwards.`
            : undefined
        }
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={() => setRevoking(null)} disabled={busy}>
            Keep it
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={() => revoking && revoke(revoking)}
          >
            <Trash2 className="size-4" aria-hidden />
            Withdraw invite
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
