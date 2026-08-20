import { BRAND, SITE_URL } from '@/lib/marketing/content';
import type { Mail } from './index';

/**
 * The four messages the product needs to send, as plain text.
 *
 * Plain text on purpose. These are short, they are read on a phone between
 * meetings, and every one of them exists to move somebody to one link — an HTML
 * version would be a second thing to keep in step with this one for no gain,
 * and finance teams' mail clients strip half of it anyway.
 *
 * Each ends with the same one-line sign-off rather than a footer: there is no
 * unsubscribe because none of these is marketing. They are the record of
 * something somebody did to your work.
 */

const signOff = `\n\n— ${BRAND.name}`;

/** "FI/HO/26-27/0001" when there is one, "A voucher" when there is not. */
const label = (voucherNo: string | null): string => voucherNo ?? 'A voucher';

export function awaitingApproval(input: {
  voucherNo: string | null;
  raisedBy: string;
  paidTo: string | null;
  amount: string;
}): Omit<Mail, 'to'> {
  return {
    subject: `${label(input.voucherNo)} needs your approval`,
    text:
      `${input.raisedBy} raised ${label(input.voucherNo)} and it is waiting for an approver.\n\n` +
      `Paid to: ${input.paidTo ?? 'not stated yet'}\n` +
      `Grand total: ${input.amount}\n\n` +
      `Open the queue: ${SITE_URL}/approvals\n\n` +
      `You cannot approve a voucher you raised yourself, so if this one is yours it will not be in your list.` +
      signOff,
  };
}

export function sentBack(input: {
  voucherNo: string | null;
  by: string;
  reason: string;
  id: string;
}): Omit<Mail, 'to'> {
  return {
    subject: `${label(input.voucherNo)} has come back to you`,
    text:
      `${input.by} sent ${label(input.voucherNo)} back for correction.\n\n` +
      `What needs fixing:\n${input.reason}\n\n` +
      `Correct and resubmit: ${SITE_URL}/vouchers/${input.id}/edit` +
      signOff,
  };
}

export function approved(input: {
  voucherNo: string | null;
  by: string;
  id: string;
}): Omit<Mail, 'to'> {
  return {
    subject: `${label(input.voucherNo)} has been approved`,
    text:
      `${input.by} approved ${label(input.voucherNo)}. It is locked now — the amounts, ` +
      `the payee and the number cannot be changed by anyone.\n\n` +
      `See it: ${SITE_URL}/vouchers/${input.id}` +
      signOff,
  };
}

export function invited(input: {
  organisation: string;
  invitedBy: string;
  role: string;
  link: string;
  expires: string;
}): Omit<Mail, 'to'> {
  return {
    subject: `${input.invitedBy} has invited you to ${input.organisation}`,
    text:
      `${input.invitedBy} has invited you to join ${input.organisation} on ${BRAND.name} ` +
      `as ${input.role}.\n\n` +
      `Accept the invite: ${input.link}\n\n` +
      `The link works until ${input.expires}, and only for this email address.` +
      signOff,
  };
}
