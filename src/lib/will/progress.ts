import type { WillRecord } from './model';

/**
 * Whether a draft has anything of the person's in it yet.
 *
 * `blankWill(selfName)` starts with the account's name filled in, so a name alone
 * does not count: a draft is blank until somebody has told us something, a date
 * of birth, an address, a religion, anybody they want to name, anything they own.
 * The workbench uses it to show a welcome instead of a half-empty form, and to stay
 * quiet about what is missing until the person has had a chance to fill it in.
 */
export function isBlank(r: WillRecord): boolean {
  const t = r.testator;
  return (
    r.people.length === 0 &&
    r.assets.length === 0 &&
    r.gifts.length === 0 &&
    r.residue.length === 0 &&
    !t.dob &&
    !t.address.trim() &&
    !t.religion &&
    !t.maritalStatus &&
    !t.state.trim() &&
    !t.soundMind &&
    !t.voluntary
  );
}
