/**
 * A short reference printed on every page of a will.
 *
 * Derived from the text of the will, so two printouts of the same will carry
 * the same reference and a page from a different version, or one reprinted
 * after an edit, visibly does not. The signing guide tells the person to check
 * that every page agrees before they sign, which is the cheapest defence there
 * is against a page being swapped or a draft being signed by mistake.
 *
 * It is not a signature and not a security feature: anyone can compute it. It
 * catches slips, not forgery.
 */
export function documentRef(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(-6);
}
