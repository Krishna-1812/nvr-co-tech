'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, UserPlus } from 'lucide-react';
import { inviteUser } from '@/app/actions/admin';
import { ROLE_META, USER_ROLES, type UserRole } from '@/lib/domain/workflow';
import { Button, Card, CardTitle, Input, Select } from '@/components/ui/primitives';

const INVITABLE_ROLES = USER_ROLES.filter((r) => r !== 'owner');

/**
 * A generated link, not a sent email.
 *
 * There is no transactional email provider wired into this project, so an
 * admin copies the link themselves and sends it however they already reach
 * people — email, chat, anything. The link is only as sensitive as its token:
 * accept_invite checks it against the accepting person's own verified address,
 * so whoever ends up holding it cannot join as someone else.
 */
export function InviteForm() {
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
    setBusy(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    setLink(res.data.link);
    setEmail('');
    toast.success(`Invite created for ${res.data.email}.`);
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
        description="Generates a link that joins your organisation. Copy it and send it however you like."
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
        <div className="w-36">
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
