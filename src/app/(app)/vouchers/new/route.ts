import { redirect } from 'next/navigation';
import { createDraft } from '@/app/actions/voucher';

/**
 * "New voucher" is not a form — it creates an empty draft row and sends you to
 * its editor. That gives autosave a stable target from the very first keystroke,
 * which is what makes losing a half-filled 32-field voucher impossible.
 *
 * A Route Handler, not a page. createDraft() calls revalidatePath(), which Next
 * only permits from a Server Action invocation or a Route Handler — not from a
 * Server Component's own render, which is what a GET to a page is. This used
 * to be a page.tsx doing exactly that render-time call, and Next 16 now flags
 * it as an error ("used revalidatePath during render which is unsupported").
 */
export async function GET() {
  const res = await createDraft();
  if (!res.ok) redirect('/vouchers?error=create');
  redirect(`/vouchers/${res.data.id}/edit`);
}
