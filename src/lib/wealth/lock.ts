/**
 * The optional passcode on a wealth record.
 *
 * Without one, the record sits in this browser's storage as plain text: safe
 * from the internet (it is never sent anywhere), but readable by anyone who can
 * use this browser profile, and by anything that can read its storage. On a
 * family computer that is a real exposure for a list of account numbers.
 *
 * With one, the record is encrypted before it is written. AES-GCM with a
 * 256-bit key derived from the passcode by PBKDF2-SHA-256 over 310,000 rounds
 * and a random 16-byte salt, all from the browser's own Web Crypto. The
 * passcode itself is never stored anywhere; the key lives in memory only for
 * as long as the tab is open, and a wrong passcode simply fails to decrypt
 * (AES-GCM authenticates, so there is no "almost right").
 *
 * The cost of that, which the screen says before anyone turns it on: **a
 * forgotten passcode cannot be recovered**, by us or anyone. A backup taken
 * while locked is encrypted with the same passcode.
 */

export type Sealed = {
  /** Marks this blob as ours and says how it was made. */
  sealed: 'aes-gcm-pbkdf2-sha256';
  iterations: number;
  salt: string;
  iv: string;
  data: string;
};

export const ITERATIONS = 310_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function random(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(n));
  crypto.getRandomValues(out);
  return out;
}

export async function deriveKey(passcode: string, salt: Uint8Array<ArrayBuffer>, iterations = ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** A key plus the salt it was made with, so it can seal again without re-deriving. */
export type Unlocked = { key: CryptoKey; salt: string; iterations: number };

export async function newLock(passcode: string): Promise<Unlocked> {
  const salt = random(16);
  return { key: await deriveKey(passcode, salt), salt: toB64(salt), iterations: ITERATIONS };
}

export async function seal(plain: string, lock: Unlocked): Promise<Sealed> {
  const iv = random(12);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, lock.key, enc.encode(plain)));
  return { sealed: 'aes-gcm-pbkdf2-sha256', iterations: lock.iterations, salt: lock.salt, iv: toB64(iv), data: toB64(data) };
}

/**
 * Opens a sealed blob with a passcode. Returns the plain text and the unlocked
 * key (for sealing later writes), or null if the passcode is wrong.
 */
export async function open(blob: Sealed, passcode: string): Promise<{ plain: string; lock: Unlocked } | null> {
  try {
    const salt = fromB64(blob.salt);
    const key = await deriveKey(passcode, salt, blob.iterations);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(blob.iv) }, key, fromB64(blob.data));
    return { plain: dec.decode(plain), lock: { key, salt: blob.salt, iterations: blob.iterations } };
  } catch {
    return null;
  }
}

export function isSealed(v: unknown): v is Sealed {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    o.sealed === 'aes-gcm-pbkdf2-sha256' &&
    typeof o.iterations === 'number' &&
    typeof o.salt === 'string' &&
    typeof o.iv === 'string' &&
    typeof o.data === 'string'
  );
}

/**
 * How strong a passcode is, in a word, for the hint under the box. Length and
 * variety only; it does not pretend to know about dictionaries.
 */
export function passcodeStrength(p: string): { ok: boolean; note: string } {
  if (p.length < 8) return { ok: false, note: 'At least 8 characters.' };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  if (p.length >= 14 || kinds >= 3) return { ok: true, note: 'Strong enough.' };
  return { ok: true, note: 'Fine. Longer is stronger; a short sentence works well.' };
}
