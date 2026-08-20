'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { renameOrganization } from '@/app/actions/admin';
import { Button, Card, CardBody, CardTitle, Field, Input } from '@/components/ui/primitives';

/**
 * The organisation you are in, and its name.
 *
 * Here rather than on the admin screen because this is the one screen everybody
 * can reach. The name was typed once at onboarding and then never shown again
 * anywhere in the signed-in app, which made a typo in it both permanent and
 * invisible: the only person who ever saw it again was whoever followed an
 * invite link.
 *
 * Renaming is owner-only, enforced in rename_organization (0021), so everybody
 * else gets the name and a line saying who to ask. A disabled input with a Save
 * button that always fails would be the same information told worse.
 */
export function OrganizationForm({ name, canRename }: { name: string; canRename: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [busy, startTransition] = useTransition();

  const dirty = value.trim() !== name.trim();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await renameOrganization(value);
      if (res.ok) {
        toast.success('Organisation renamed.');
        router.refresh();
      } else {
        toast.error(res.error ?? 'Could not rename your organisation.');
      }
    });
  };

  return (
    <Card className="overflow-hidden">
      <CardTitle
        icon={<Building2 className="size-4" />}
        title="Organisation"
        description="Your vouchers, chapters and people all belong to this one. Nothing is shared with another."
      />
      <CardBody>
        {canRename ? (
          <form onSubmit={save}>
            <Field
              label="Organisation name"
              htmlFor="org_name"
              hint="What anyone following an invite link from you is asked to join."
              action={
                <Button
                  type="submit"
                  variant="primary"
                  loading={busy}
                  disabled={!dirty || value.trim().length < 2}
                >
                  {!busy && <Check className="size-4" aria-hidden />}
                  Save
                </Button>
              }
            >
              <Input
                id="org_name"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="organization"
                required
              />
            </Field>
          </form>
        ) : (
          <>
            <p className="font-semibold tracking-tight">{name}</p>
            <p className="text-muted mt-1 text-sm text-pretty">
              Only an owner can change the name.
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
