/**
 * Field checks for Wealth Tracker, each one returning a sentence or null.
 *
 * Every check here is about the *shape* of what was typed, never about whether
 * the thing exists: an IFSC can be well formed and still not be a branch, and
 * no rule here pretends otherwise. They are written to catch the slips people
 * actually make (a letter O where a zero belongs in an IFSC, a PIN code one
 * digit short, a full card number pasted where four digits were asked for),
 * and to say what is wrong in words, so nobody is left guessing why a box is
 * red.
 *
 * A check never blocks saving. A record half filled in with one odd field is
 * still worth keeping, and the person may know something the rule does not.
 * The editor shows the sentence beside the field and saves anyway.
 */

export type Check = (value: string) => string | null;

const digitsOnly = (v: string) => v.replace(/[\s-]/g, '');

/** IFSC: four letters, a zero, then six letters or digits (RBI's format). */
export const ifsc: Check = (raw) => {
  const v = raw.trim().toUpperCase();
  if (!v) return null;
  if (v.length !== 11) return 'An IFSC has 11 characters, like SBIN0001234.';
  if (!/^[A-Z]{4}/.test(v)) return 'An IFSC starts with four letters, the bank’s code.';
  if (v[4] !== '0') return 'The fifth character of an IFSC is always the digit zero.';
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v)) return 'The last six characters of an IFSC are letters or digits.';
  return null;
};

/** Indian PIN code: six digits, not starting with zero. */
export const pin: Check = (raw) => {
  const v = digitsOnly(raw);
  if (!v) return null;
  if (!/^\d+$/.test(v)) return 'A PIN code is digits only.';
  if (v.length !== 6) return 'A PIN code has six digits.';
  if (v[0] === '0') return 'A PIN code does not start with 0.';
  return null;
};

/** Twelve digits: the EPF Universal Account Number and the NPS PRAN are both this shape. */
export const twelveDigits =
  (what: string): Check =>
  (raw) => {
    const v = digitsOnly(raw);
    if (!v) return null;
    if (!/^\d+$/.test(v)) return `A ${what} is digits only.`;
    if (v.length !== 12) return `A ${what} has 12 digits; this has ${v.length}.`;
    return null;
  };

/** An account number of some kind: digits, and a sensible length. */
export const accountNumber: Check = (raw) => {
  const v = digitsOnly(raw);
  if (!v) return null;
  if (!/^[0-9A-Za-z]+$/.test(v)) return 'Use only the letters and digits of the number.';
  if (v.length < 4) return 'That looks too short to be the full number.';
  if (v.length > 20) return 'That is longer than any Indian account number. Check for extra digits.';
  return null;
};

/**
 * Exactly the last four digits of a card, and never more.
 *
 * The editor stops more than four digits ever reaching the record (it keeps the
 * last four of whatever is pasted), so this mainly speaks up when fewer were
 * given.
 */
export const lastFour: Check = (raw) => {
  const v = digitsOnly(raw);
  if (!v) return null;
  if (!/^\d+$/.test(v)) return 'Only the four digits, please.';
  if (v.length !== 4) return 'Enter the last four digits of the card.';
  return null;
};

/** Keeps the last four digits of whatever was typed or pasted into a card box. */
export function keepLastFour(raw: string): string {
  return raw.replace(/\D/g, '').slice(-4);
}

/**
 * An Indian vehicle registration, loosely: state code, district number, series,
 * number (MH 12 AB 1234), or the newer Bharat series (22 BH 1234 AA). Loose on
 * purpose; older and special registrations vary.
 */
export const vehicleReg: Check = (raw) => {
  const v = raw.replace(/[\s-]/g, '').toUpperCase();
  if (!v) return null;
  if (/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(v)) return null;
  if (/^\d{2}BH\d{4}[A-Z]{1,2}$/.test(v)) return null;
  return 'That does not look like a registration number, which reads like MH 12 AB 1234.';
};

export const percent: Check = (raw) => {
  const v = raw.trim().replace(/%$/, '');
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return 'Enter a number, like 7.1.';
  if (n < 0 || n > 100) return 'A percentage is between 0 and 100.';
  return null;
};

export const year: Check = (raw) => {
  const v = raw.trim();
  if (!v) return null;
  const n = Number(v);
  if (!/^\d{4}$/.test(v) || n < 1900 || n > 2100) return 'Enter a four-digit year, like 2019.';
  return null;
};

export const dayOfMonth: Check = (raw) => {
  const v = raw.trim();
  if (!v) return null;
  const n = Number(v);
  if (!/^\d{1,2}$/.test(v) || n < 1 || n > 31) return 'A day of the month, 1 to 31.';
  return null;
};

export const phone: Check = (raw) => {
  const v = raw.replace(/[\s()+-]/g, '');
  if (!v) return null;
  if (!/^\d+$/.test(v)) return 'Digits only, with an optional + in front.';
  if (v.length < 10 || v.length > 13) return 'A phone number has 10 digits, or 12 with the country code.';
  return null;
};

export const email: Check = (raw) => {
  const v = raw.trim();
  if (!v) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'That does not look like an email address.';
};

/**
 * Something that should never be written into a record like this.
 *
 * A wealth record is exactly where people are tempted to jot "net banking
 * password: ..." or the card's full number "so it is all in one place". Doing so
 * turns a list of where your money is into the keys to it. This looks for the
 * telltale words and for a full 15–16 digit card number, and the editor warns
 * (it does not delete: the person may be writing *about* a PIN, not one).
 */
export function looksSecret(text: string): string | null {
  const t = text.toLowerCase();
  if (/\b(pass ?word|passcode|pwd|mpin|t ?pin|upi ?pin|atm ?pin|cvv|cvc|otp)\b/.test(t)) {
    return 'This looks like it may hold a password, PIN, CVV or OTP. Never keep those here: anyone who opens this record would have the keys to your money.';
  }
  // Card numbers carry a Luhn check digit and most account numbers do not, so
  // a run of 15 or 16 digits is only called a card when it passes the check.
  // Without that, an account number written into the notes would set this off.
  for (const m of text.matchAll(/(?:\d[ -]?){14,15}\d/g)) {
    const digits = m[0].replace(/\D/g, '');
    if ((digits.length === 15 || digits.length === 16) && luhn(digits)) {
      return 'This looks like a full card number. Keep only the last four digits here.';
    }
  }
  return null;
}

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}
