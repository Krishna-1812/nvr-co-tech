import { clearSave } from '@/app/actions/saves';

/**
 * Removes the encrypted copy of the will from the account, when the reason it
 * may be there has gone.
 *
 * The copy is only allowed while the draft is locked with a passcode and the
 * person wants it. So it is removed when they delete the draft, remove the
 * passcode (a draft with no passcode cannot be kept in the account), or start
 * over after forgetting the passcode. Skipping this would be worse than it
 * sounds: a deleted draft would come back the next time the page opened, taken
 * from the account as the newer copy.
 *
 * Fire and forget: it never blocks or fails the thing the person asked for. A
 * failure leaves the copy where it is, which the next successful save or
 * deletion deals with, and it is only ever ciphertext meanwhile.
 */
export async function forgetAccountCopy(): Promise<boolean> {
  try {
    const r = await clearSave('will-maker');
    // "Not signed in" and "not switched on yet" both mean there is no copy to remove.
    return r.ok;
  } catch {
    return false;
  }
}
