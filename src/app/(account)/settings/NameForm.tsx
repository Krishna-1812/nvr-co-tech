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
    <form onSubmit={save}>
      {/* Save is the field's own action, so the Field places it — on the input's
          line, not below the hint. See the note on `action` in primitives. */}
      <Field
        label="Full name"
        htmlFor="full_name"
        hint="Printed on every voucher you raise or approve."
        action={
          <Button
            type="submit"
            variant="primary"
            loading={busy}
            disabled={!dirty || name.trim().length < 2}
          >
            {!busy && <Check className="size-4" aria-hidden />}
            Save
          </Button>
        }
      >
        <Input
          id="full_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
        />
      </Field>
    </form>
  );
}
