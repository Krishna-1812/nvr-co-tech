import { head, HEADS } from './heads';
import { parseMoney, rupees } from './money';
import { itemName, memberName, type Item, type WealthRecord } from './model';
import { counted, takesNominee } from './calc';
import { looksSecret } from './validate';

/**
 * What in a wealth record needs looking at, said plainly.
 *
 * A record like this is mostly written for a day nobody wants to think about:
 * when somebody else has to find and claim what is in it. So the checks are
 * about what would make that day harder. A bank account with no nominee, a
 * minor nominated without a guardian, a deposit that matured a year ago and is
 * still listed, a loan nobody else knows about. Then the ordinary
 * housekeeping: values never entered or long out of date, and dates coming up.
 *
 * Three levels, and the words matter more than the colour:
 *
 *   - `act`: something that could cost the family money or months.
 *   - `review`: something missing or that looks wrong.
 *   - `note`: worth knowing, nothing wrong.
 *
 * No check gives investment advice. They say what is missing or due, never
 * what to buy, sell or hold. Every check points at the entry and the part of it
 * to open, so "Fix" can take the person straight there.
 */

export type Severity = 'act' | 'review' | 'note';

/** Which part of the entry editor a fix opens at. */
export type Area = 'value' | 'details' | 'nominee' | 'notes';

export type Finding = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  /** The entry this is about. Absent for checks about the household as a whole. */
  itemId?: string;
  area?: Area;
  /** For household checks: which part of the household panel to open. */
  profile?: 'will' | 'trusted' | 'backup' | 'members' | 'expenses';
};

const DAY = 86_400_000;

/** Whole days from `a` to `b`, both ISO dates, by the calendar. */
export function daysUntil(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

const isIso = (s: string | undefined): s is string =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Age in completed years on `today`. */
export function ageOn(dob: string, today: string): number | null {
  if (!isIso(dob)) return null;
  const [y, m, d] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age -= 1;
  return age;
}

/** "14 Mar 2026". */
export function shortDate(iso: string): string {
  if (!isIso(iso)) return iso;
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < fd) months -= 1;
  return months;
}

/** "PIN code" stays "PIN code"; "Account number" becomes "account number". */
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/** Characters that only make a number look different: spaces, dashes, slashes. */
const normal = (s: string) => s.replace(/[\s/-]/g, '').toUpperCase();

function itemChecks(item: Item, record: WealthRecord, today: string, out: Finding[]) {
  const spec = head(item.head);
  const name = itemName(item);
  const f = item.fields;
  const push = (key: string, finding: Omit<Finding, 'id' | 'itemId'>) =>
    out.push({ id: `${item.id}:${key}`, itemId: item.id, ...finding });

  // ── Nominee ──
  if (takesNominee(item)) {
    const { status, people } = item.nominee;
    if (status === '') {
      push('nominee-unanswered', {
        severity: 'review',
        title: `Is there a nominee on ${name}?`,
        detail: 'Answer yes, no or not sure. It is the first thing your family would be asked when claiming it.',
        area: 'nominee',
      });
    } else if (status === 'no') {
      push('nominee-none', {
        severity: 'act',
        title: `No nominee on ${name}`,
        detail:
          'Without one, the money is usually released only once your family proves they are your legal heirs, which can take months, and for larger amounts a succession certificate from a court. Adding a nominee is a short form with the ' +
          (spec.id === 'bank' || spec.id === 'deposit' ? 'bank' : spec.id === 'insurance' ? 'insurer' : 'provider') +
          ', often online.',
        area: 'nominee',
      });
    } else if (status === 'unsure') {
      push('nominee-unsure', {
        severity: 'review',
        title: `Find out whether ${name} has a nominee`,
        detail:
          'The provider’s app, net banking or the account statement usually shows it. If there is none, adding one is a short form.',
        area: 'nominee',
      });
    } else {
      const named = people.filter((p) => p.name.trim());
      if (named.length === 0) {
        push('nominee-unnamed', {
          severity: 'review',
          title: `Who is the nominee on ${name}?`,
          detail: 'You said there is a nominee. Add their name and relation, so whoever reads this knows who it is.',
          area: 'nominee',
        });
      }
      const shares = named.map((p) => p.share.trim()).filter(Boolean);
      if (named.length > 1 && shares.length > 0) {
        const total = Math.round(shares.reduce((s, x) => s + (Number(x.replace('%', '')) || 0), 0) * 100) / 100;
        if (shares.length < named.length || total !== 100) {
          push('nominee-shares', {
            severity: 'act',
            title: `Nominee shares on ${name} add up to ${total}%`,
            detail:
              shares.length < named.length
                ? 'Some nominees have a share and some do not. Give every nominee a share, adding up to 100%, or leave them all blank.'
                : 'Shares between nominees should add up to exactly 100%. Check what is registered with the provider.',
            area: 'nominee',
          });
        }
      }
      for (const p of named) {
        const age = ageOn(p.dob, today);
        if (age !== null && age < 18 && !p.guardian.trim()) {
          push(`nominee-minor-${p.id}`, {
            severity: 'act',
            title: `${p.name.trim()} is a minor with no guardian named`,
            detail: `A nominee under 18 needs a guardian to receive the money on their behalf. Check one is registered on ${name}, and note who.`,
            area: 'nominee',
          });
        }
      }
    }
  }

  // ── Value ──
  if (spec.counts(item.kind) && item.value === null) {
    push('no-value', {
      severity: 'review',
      title: `No value for ${name}`,
      detail: 'It is not in your net worth until it has one. An estimate is fine; you can update it later.',
      area: 'value',
    });
  } else if (spec.counts(item.kind) && isIso(item.asOf)) {
    const months = monthsBetween(item.asOf, today);
    if (months >= spec.staleAfter) {
      push('stale', {
        severity: 'note',
        title: `${name}: value is ${months} month${months === 1 ? '' : 's'} old`,
        detail: `Last updated ${shortDate(item.asOf)}. ${spec.side === 'asset' ? 'Markets and balances move' : 'Outstanding amounts fall with every EMI'}; update it when you next look.`,
        area: 'value',
      });
    }
  }

  // ── Dates ──
  for (const w of spec.watch ?? []) {
    const when = f[w.key];
    if (!isIso(when) || (w.when && !w.when(f, item.kind))) continue;
    const days = daysUntil(today, when);
    if (days < 0) {
      push(`date-${w.key}`, { severity: 'review', title: `${name}: the ${w.noun} has passed (${shortDate(when)})`, detail: w.passed, area: 'details' });
    } else if (days <= w.ahead) {
      push(`date-${w.key}`, {
        severity: 'note',
        title: `${name}: ${w.verb.toLowerCase()} ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}`,
        detail: `${w.verb} on ${shortDate(when)}.`,
        area: 'details',
      });
    }
  }

  // ── Details that look wrong ──
  for (const field of spec.fields) {
    const val = f[field.key];
    if (!val || !field.check) continue;
    if (field.showIf && !field.showIf(f, item.kind)) continue;
    const problem = field.check(val);
    if (problem) {
      push(`field-${field.key}`, {
        severity: 'review',
        title: `${name}: check the ${lowerFirst(field.label)}`,
        detail: problem,
        area: 'details',
      });
    }
  }

  if (spec.side === 'liability') {
    const sanctioned = parseMoney(f.sanctioned ?? '');
    if (typeof sanctioned === 'number' && item.value !== null && item.value > sanctioned * 1.02 && sanctioned > 0) {
      push('over-sanctioned', {
        severity: 'review',
        title: `${name}: more is owed than was borrowed`,
        detail: `The outstanding (${rupees(item.value)}) is more than the amount borrowed (${rupees(sanctioned)}). That can happen with unpaid interest, but it is usually a typo.`,
        area: 'value',
      });
    }
  }

  if (spec.id === 'property' && (f.coOwners ?? '').trim() && item.share === 100) {
    push('co-owner-share', {
      severity: 'review',
      title: `${name}: co-owners named, but your share is 100%`,
      detail: 'If the property is jointly owned, set your share, so only your part counts towards your net worth.',
      area: 'value',
    });
  }

  if (spec.id === 'bank' && f.holding === 'Joint' && f.mode === 'Jointly') {
    push('jointly', {
      severity: 'note',
      title: `${name} needs every holder to sign`,
      detail:
        'An account operated “jointly” cannot be used by one holder alone. If a holder dies, the others usually cannot operate it until the bank settles the claim. “Either or survivor” avoids that.',
      area: 'details',
    });
  }

  if ((spec.id === 'receivable' || spec.id === 'informal_loan') && f.written === 'No' && (item.value ?? 0) > 0) {
    push('unwritten', {
      severity: 'note',
      title: `${name} is not written down`,
      detail:
        spec.id === 'receivable'
          ? 'Your family can usually only recover money lent if there is something in writing. Even a signed note or a message thread helps.'
          : 'Writing down what you owe protects the person who lent it, and your family, from a dispute later.',
      area: 'details',
    });
  }

  if (spec.id === 'property' && !(f.documents ?? '').trim()) {
    push('papers', {
      severity: 'note',
      title: `Where are the papers for ${name}?`,
      detail: 'Note where the original sale deed and documents are kept. Without them, selling or transferring the property is slow.',
      area: 'details',
    });
  }

  if (!record.profile.members.some((m) => m.id === item.holder)) {
    push('orphan-holder', {
      severity: 'review',
      title: `${name} is held by someone no longer in the household list`,
      detail: 'Choose who holds it now.',
      area: 'value',
    });
  }

  // ── Things that must never be written down here ──
  const texts = [item.notes, ...spec.fields.filter((x) => x.kind === 'text' || x.kind === 'textarea').map((x) => f[x.key] ?? '')];
  for (const text of texts) {
    const secret = looksSecret(text);
    if (secret) {
      push('secret', { severity: 'act', title: `${name}: remove what looks like a password or card number`, detail: secret, area: 'notes' });
      break;
    }
  }
}

/** Two entries that are the same account entered twice. */
function duplicates(record: WealthRecord, out: Finding[]) {
  const seen = new Map<string, Item>();
  for (const item of record.items) {
    const key = head(item.head).number;
    const num = key ? normal(item.fields[key] ?? '') : '';
    if (num.length < 4 || head(item.head).id === 'credit_card') continue;
    const k = `${item.head}|${num}`;
    const first = seen.get(k);
    if (first) {
      out.push({
        id: `${item.id}:duplicate`,
        itemId: item.id,
        severity: 'review',
        title: `${itemName(item)} may be entered twice`,
        detail: `It has the same number as ${itemName(first)}, so it is counted twice in your net worth. Delete one, or correct the number.`,
        area: 'details',
      });
    } else seen.set(k, item);
  }
}

/** Loans with no protection, when the record has no term cover either. */
function unprotectedLoans(record: WealthRecord, out: Finding[]) {
  const hasTerm = record.items.some((i) => i.head === 'insurance' && i.kind === 'Term life');
  if (hasTerm) return;
  const loans = record.items.filter(
    (i) => (i.head === 'home_loan' || i.head === 'education_loan' || i.head === 'personal_loan') && counted(i) > 0 && i.fields.protected === 'No',
  );
  if (loans.length === 0) return;
  out.push({
    id: 'household:unprotected-loans',
    severity: 'note',
    title: loans.length === 1 ? `${itemName(loans[0])} is not covered by insurance` : `${loans.length} loans are not covered by insurance`,
    detail:
      'There is no loan insurance on them and no term policy in this record. If the borrower died, the loan would fall on the family. Worth a conversation with whoever advises you.',
    itemId: loans[0].id,
    area: 'details',
  });
}

function householdChecks(record: WealthRecord, today: string, out: Finding[]) {
  const p = record.profile;
  if (record.items.length === 0) return;

  if (p.will === '' || p.will === 'no') {
    out.push({
      id: 'household:will',
      severity: p.will === 'no' ? 'act' : 'review',
      title: p.will === 'no' ? 'There is no will' : 'Is there a will?',
      detail:
        'Nominees receive the money, but a will decides who it finally belongs to, and it is the only thing that covers property, jewellery and anything without a nominee.',
      profile: 'will',
    });
  } else if (p.will === 'drafting') {
    out.push({ id: 'household:will', severity: 'note', title: 'The will is still being drafted', detail: 'Note where it is kept once it is signed.', profile: 'will' });
  } else if (!p.willKept.trim()) {
    out.push({ id: 'household:will-kept', severity: 'review', title: 'Where is the will kept?', detail: 'A will nobody can find is no help. Note where the signed original is.', profile: 'will' });
  }

  if (!p.trusted.trim()) {
    out.push({
      id: 'household:trusted',
      severity: 'review',
      title: 'Does anyone know this record exists?',
      detail:
        'It is kept on this device, so it only helps if someone you trust knows about it and where the backup is. Name them here, and tell them.',
      profile: 'trusted',
    });
  }

  const backupAge = record.lastBackupAt ? daysUntil(record.lastBackupAt.slice(0, 10), today) : null;
  if (backupAge === null || backupAge > 30) {
    out.push({
      id: 'household:backup',
      severity: 'review',
      title: backupAge === null ? 'This record has never been backed up' : `Last backup was ${backupAge} days ago`,
      detail:
        'It lives only in this browser. Clearing the browser’s data or losing the device would lose it. Download a backup and keep it somewhere safe.',
      profile: 'backup',
    });
  }
}

const ORDER: Record<Severity, number> = { act: 0, review: 1, note: 2 };

/** Every finding on a record, most serious first, then in the order the record lists heads. */
export function checks(record: WealthRecord, today: string): Finding[] {
  const out: Finding[] = [];
  householdChecks(record, today, out);
  for (const item of record.items) itemChecks(item, record, today, out);
  duplicates(record, out);
  unprotectedLoans(record, out);

  const headOrder = new Map(HEADS.map((h, i) => [h.id, i]));
  const itemHead = new Map(record.items.map((i) => [i.id, headOrder.get(i.head) ?? 99]));
  return out.sort(
    (a, b) =>
      ORDER[a.severity] - ORDER[b.severity] ||
      (a.itemId ? (itemHead.get(a.itemId) ?? 99) : -1) - (b.itemId ? (itemHead.get(b.itemId) ?? 99) : -1),
  );
}

/** For a line under a member's name: "3 entries held by Asha". */
export function holderLine(record: WealthRecord, id: string): string {
  const n = record.items.filter((i) => i.holder === id).length;
  return `${n} entr${n === 1 ? 'y' : 'ies'} held by ${memberName(record.profile, id)}`;
}
