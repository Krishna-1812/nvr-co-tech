import { redirect } from 'next/navigation';
import { createDraft } from '@/app/actions/voucher';

/**
 * "New voucher" is not a form — it creates an empty draft row and sends you to
 * its editor. That gives autosave a stable target from the very first keystroke,
 * which is what makes losing a half-filled 32-field voucher impossible.
 */
export default async function NewVoucherPage() {
  const res = await createDraft();
  if (!res.ok) redirect('/vouchers?error=create');
  redirect(`/vouchers/${res.data.id}/edit`);
}
