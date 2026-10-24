import { isSealed } from '@/lib/wealth/lock';

/**
 * Whether a tool's text may be stored in an account.
 *
 * Every tool but one may be stored as it is. A will may not: it is only ever
 * stored as the sealed blob the browser made with the person's passcode
 * (lib/wealth/lock), so what the server holds is ciphertext it cannot read.
 * This is the server's half of that promise; the browser's half is that it
 * only sends a locked draft, and the database's is constraint
 * `tool_saves_will_is_sealed` (migration 0038). Any one of the three failing
 * must not be enough to store a readable will.
 *
 * Here and not in actions/saves.ts because a 'use server' file may export only
 * async functions, and because it is a rule worth testing on its own.
 */
export function acceptsBody(tool: string, body: string): boolean {
  if (tool !== 'will-maker') return true;
  try {
    return isSealed(JSON.parse(body));
  } catch {
    return false;
  }
}
