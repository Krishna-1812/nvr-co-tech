'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { updateFullName } from '@/app/actions/profile';
import { Button, Field, Input } from '@/components/ui/primitives';

export function NameForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [busy, startTransition] = useTransition();

  const dirty = name.trim() !== initial.trim();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateFullName({ fullName: name });
      if (res.ok) {
        toast.success('Name updated.');
        router.refresh();
      } else {
        toast.error(res.error ?? 'Could not save that name.');
      }
    });
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <Field
        label="Full name"
        htmlFor="full_name"
        className="flex-1"
        hint="Printed on every voucher you raise or approve."
      >
        <Input
          id="full_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
        />
      </Field>

      <Button
        type="submit"
        variant="primary"
        loading={busy}
        disabled={!dirty || name.trim().length < 2}
        className="shrink-0"
      >
        {!busy && <Check className="size-4" aria-hidden />}
        Save
      </Button>
    </form>
  );
}
