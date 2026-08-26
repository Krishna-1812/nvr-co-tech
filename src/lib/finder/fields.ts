import type { ApolloRecord } from './apollo/types';

/**
 * Small readers for fields Apollo spells more than one way.
 *
 * Their own module so that both the row builders and the verification pass can
 * use them without either importing the other, and so there is exactly one
 * answer to "where does a company's phone number live".
 */

/** A company's phone number, from whichever of Apollo's three shapes it used. */
export function orgPhone(o: ApolloRecord | null | undefined): string {
  const record = o ?? {};
  const primary = record.primary_phone;
  const nested =
    primary && typeof primary === 'object' ? (primary as { number?: unknown }).number : null;
  return String(record.phone ?? nested ?? record.sanitized_phone ?? '') || '';
}
