'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Copy, UserPlus } from 'lucide-react';
import { inviteUser } from '@/app/actions/admin';
import { emailInvite } from '@/app/actions/invites';
import { ROLE_META, USER_ROLES, type UserRole } from '@/lib/domain/workflow';
import { Button, Card, CardTitle, Input, Select } from '@/components/ui/primitives';

const INVITABLE_ROLES = USER_ROLES.filter((r) => r !== 'owner');

/**
 * Creating an invite — and, where email is configured, sending it.
 *
 * The link is only as sensitive as its token: accept_invite checks it against
 * the accepting person's own verified address, so whoever ends up holding it
 * cannot join as somebody else. That is why copy-a-link is safe to offer even
 * when mail is working, and it stays the fallback when it is not.
 *
 * `emailEnabled` comes from the server, because whether mail can be sent depends
 * on environment variables this component cannot see. It changes what the card
 * promises rather than what it does: claiming an email had been sent on a
 * deployment with no provider would be the worst of the three states.
 */
export function InviteForm({ emailEnabled }: { emailEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLink(null);
    setCopied(false);

    const res = await inviteUser({ email, role });

    if (!res.ok) {
      setBusy(false);
      toast.error(res.error);
      return;
    }

    setLink(res.data.link);

    if (emailEnabled) {
      const sent = await emailInvite(res.data.inviteId);
      toast[sent.ok ? 'success' : 'warning'](
        sent.ok
          ? `Invite emailed to ${res.data.email}.`
          : `Invite created for ${res.data.email}, but the email did not go. Copy the link below.`,
      );
    } else {
      toast.success(`Invite created for ${res.data.email}. Copy the link and send it on.`);
    }

    setBusy(false);
    setEmail('');
    // So the waiting-invites list below picks the new one up.
    router.refresh();
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="overflow-hidden">
      <CardTitle
        icon={<UserPlus className="size-4" />}
        title="Invite a teammate"
        description={
          emailEnabled
            ? 'Emails them a link that joins your organisation. The link only works for the address you enter, and lasts fourteen days.'
            : 'Generates a link that joins your organisation. Copy it and send it however you like — it only works for the address you enter, and lasts fourteen days.'
        }
      />
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 px-5 py-4">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="invite_email" className="text-subtle mb-1.5 block text-xs font-medium">
            Email
          </label>
          <Input
            id="invite_email"
            type="email"
            required
            placeholder="teammate@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="w-44">
          <label htmlFor="invite_role" className="text-subtle mb-1.5 block text-xs font-medium">
            Role
          </label>
          <Select
            id="invite_role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {INVITABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_META[r].label}
              </option>
            ))}
          </Select>
          {/*
            What the chosen role actually permits, in the same words Settings
            and the account menu use. The select offered three bare nouns, so
            the person handing out authority had nothing to compare — and
            "Approver" does not say that an approver also sees the whole queue.
          */}
          <p className="text-subtle mt-1.5 text-xs leading-snug">{ROLE_META[role].grants}</p>
        </div>
        <Button type="submit" variant="primary" loading={busy} disabled={!email.trim()}>
          Create invite link
        </Button>
      </form>

      {link && (
        <div className="flex items-center gap-2 border-t px-5 py-3">
          <code className="text-subtle numeric flex-1 truncate text-xs">{link}</code>
          <Button type="button" variant="ghost" size="sm" onClick={copy}>
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      )}
    </Card>
  );
}
