import { head } from '../wealth/heads';
import { SELF, type Item, type WealthRecord } from '../wealth/model';
import { checkWill, readiness, type Severity } from './checks';
import { fromWealth, relationOf } from './fromWealth';
import { findPerson, isMinor, nameKey, personName, type WillRecord } from './model';

/**
 * After the will is signed: what to keep true, and what to look at again.
 *
 * A will is made once and read years later, usually by someone who cannot ask
 * the person what they meant. Most of what goes wrong then is not the drafting:
 * the original cannot be found, nobody was told, or life moved on (a child, a
 * new flat, a loan closed, a nominee changed) and the will did not. This module
 * is the part of Will Maker that keeps working after the document is done.
 *
 * Everything here is a pure function of the will record, optionally the
 * person's Wealth Tracker record, and today's date. That is the point of
 * building the will inside the same product: Wealth Tracker already knows what
 * the person owns now, so the will can be checked against it, which a service
 * that deletes your data after sixty days cannot do.
 *
 * Same three levels as the other checks. No prompt gives advice about what to
 * leave to whom; they say what no longer matches, and what is missing.
 */

export type Prompt = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  cite?: string;
};

const ORDER: Record<Severity, number> = { act: 0, review: 1, note: 2 };
const sorted = (ps: Prompt[]) => [...ps].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

const DAY = 86_400_000;
/** Whole days from `from` to `to` (ISO dates), or null if either is unreadable. */
function daysBetween(from: string, to: string): number | null {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / DAY) : null;
}

/** What is missing from the record of where the will is and who knows. */
export function registerPrompts(r: WillRecord, today: string): Prompt[] {
  const g = r.register;
  const out: Prompt[] = [];
  const push = (p: Prompt) => out.push(p);

  if (!g.signedOn) {
    push({
      id: 'unsigned',
      severity: 'note',
      title: 'Not signed yet',
      detail: 'Once you have signed, come back and enter the date. Then you can record where the original is kept and who has been told.',
    });
    return out;
  }

  const ago = daysBetween(g.signedOn, today);
  if (ago === null) {
    push({ id: 'signed-date', severity: 'review', title: 'The signed date is not a date', detail: 'Enter the day you signed.' });
  } else if (ago < 0) {
    push({ id: 'signed-future', severity: 'review', title: 'The signed date is in the future', detail: 'Enter the day you actually signed, once you have signed.' });
  }

  const open = readiness(checkWill(r, today)).act;
  if (open > 0) {
    push({
      id: 'signed-with-open-fixes',
      severity: 'review',
      title: 'You recorded this will as signed, but the draft here still has things to fix',
      detail:
        'The signed paper is the will, not this screen. If the paper differs from this draft, either the paper stands as it is or you make a new will. Do not alter a signed will by hand.',
    });
  }

  if (!g.originalKept.trim()) {
    push({
      id: 'where-kept',
      severity: 'review',
      title: 'Say where the signed original is kept',
      detail: 'Only the signed original counts. If your family cannot find it, they may have to treat you as having made no will.',
    });
  }
  if (r.executorIds.length > 0 && !g.executorTold) {
    push({
      id: 'tell-executor',
      severity: 'review',
      title: 'Tell your executor where the will is',
      detail: 'An executor who does not know there is a will, or where it is, cannot act on it. Tick it once they know.',
    });
  }
  if (g.registered && !g.registeredAt.trim()) {
    push({ id: 'registered-where', severity: 'note', title: 'Note where it was registered', detail: 'The office and the registration number help your executor ask for a certified copy.' });
  }
  if (!g.reviewBy) {
    push({ id: 'review-date', severity: 'note', title: 'Choose a date to read it again', detail: 'A date you will see in this record is easier to keep than a promise to remember.' });
  }
  return sorted(out);
}

type Source = { item: Item; will: WillRecord['assets'][number] };

/**
 * What no longer matches between the will and what the person has told
 * Wealth Tracker since. `w` is null when they have no readable Wealth Tracker
 * record (none, or locked), and then only the will's own dates are checked.
 */
export function reviewPrompts(r: WillRecord, w: WealthRecord | null, today: string): Prompt[] {
  const out: Prompt[] = [];
  const push = (p: Prompt) => out.push(p);
  const signed = !!r.register.signedOn;

  // ── The date the person set for looking again ──
  if (r.register.reviewBy) {
    const left = daysBetween(today, r.register.reviewBy);
    if (left !== null && left <= 0) {
      push({ id: 'review-due', severity: 'review', title: 'You chose today or earlier to read this will again', detail: 'Read it as it stands, check it against what you own and who you love now, and set the next date.' });
    } else if (left !== null && left <= 30) {
      push({ id: 'review-soon', severity: 'note', title: `Your review date is in ${left} ${left === 1 ? 'day' : 'days'}`, detail: 'A good time to open Wealth Tracker and see what has changed.' });
    }
  }

  // ── A guardian for children who have grown up ──
  const kids = r.people.filter((p) => p.relation === 'Son' || p.relation === 'Daughter');
  if (r.guardianIds.length > 0 && kids.length > 0 && kids.every((k) => k.dob && !isMinor(k, today)) && signed) {
    push({ id: 'guardian-stale', severity: 'note', title: 'Everyone you named a guardian for is now an adult', detail: 'The guardian clause may no longer be needed. It does no harm, but a new will can drop it.' });
  }

  if (!w) return sorted(out);

  const bySource = new Map<string, Source>();
  const items = new Map(w.items.map((i) => [i.id, i]));
  for (const a of r.assets) {
    const item = a.source === 'wealth' ? items.get(a.sourceId) : undefined;
    if (item) bySource.set(a.id, { item, will: a });
  }

  // ── Things you own that the will does not mention ──
  const have = new Set(r.assets.map((a) => a.id));
  const missing = fromWealth(w).assets.filter((a) => !have.has(a.id));
  if (missing.length > 0) {
    const named = missing.slice(0, 3).map((a) => a.title || a.kind);
    out.push({
      id: 'wealth-new',
      severity: 'review',
      title: `${missing.length} ${missing.length === 1 ? 'thing' : 'things'} in Wealth Tracker ${missing.length === 1 ? 'is' : 'are'} not in your will`,
      detail: `${named.join(', ')}${missing.length > 3 ? ` and ${missing.length - 3} more` : ''}. Anything not listed still passes under “everything else”, but check that is what you want. Add them on the “What you own” step.`,
    });
  }

  // ── Things the will gives that are gone ──
  const gone = r.assets.filter((a) => a.source === 'wealth' && !items.has(a.sourceId));
  if (gone.length > 0) {
    push({
      id: 'wealth-gone',
      severity: 'review',
      title: `${gone.length} ${gone.length === 1 ? 'thing' : 'things'} in your will ${gone.length === 1 ? 'is' : 'are'} no longer in Wealth Tracker`,
      detail: `${gone.map((a) => a.title || a.kind).slice(0, 3).join(', ')}. Sold, closed or deleted? A gift of something you no longer own does nothing, and the person meant to receive it gets nothing in its place.`,
    });
  }

  // ── Family in Wealth Tracker who are not in the will ──
  const names = new Set(r.people.map((p) => nameKey(p.name)).filter(Boolean));
  for (const m of w.profile.members) {
    if (m.id === SELF || !m.name.trim()) continue;
    const rel = relationOf(m.relation);
    if (!(rel === 'Spouse' || rel === 'Son' || rel === 'Daughter')) continue;
    if (names.has(nameKey(m.name))) continue;
    push({
      id: `member:${m.id}`,
      severity: 'review',
      title: `${m.name.trim()} (${rel.toLowerCase()}) is in your household but not in your will`,
      detail: 'If that is deliberate, nothing to do. If not, add them on the People step and decide what they should receive.',
    });
  }

  // ── Nominees that changed since the will was drafted ──
  const nomineeKey = (status: string, names: string[]) => `${status}|${[...names].map(nameKey).filter(Boolean).sort().join(',')}`;
  for (const { item, will } of bySource.values()) {
    if (!head(item.head).nominee(item.kind, item.fields)) continue;
    const now = nomineeKey(item.nominee.status, item.nominee.people.map((p) => p.name));
    const then = nomineeKey(will.nominee.status, will.nominee.names);
    if (now !== then) {
      push({
        id: `nominee-drift:${will.id}`,
        severity: 'review',
        title: `The nominee on ${will.title || will.kind} changed in Wealth Tracker`,
        detail: 'Your will was drafted with a different nominee on record. A nominee often receives on behalf of the legal heirs rather than keeping it, but check the will and the nomination still agree.',
      });
    }
  }

  return sorted(out);
}

/** Everything for the "After signing" tab, worst first. */
export function afterPrompts(r: WillRecord, w: WealthRecord | null, today: string): Prompt[] {
  return sorted([...registerPrompts(r, today), ...reviewPrompts(r, w, today)]);
}

// ── Keeping Wealth Tracker true ────────────────────────────────────────────

export type WriteBack = { field: 'will' | 'willKept' | 'executor'; label: string; from: string; to: string };

const WILL_WORDS: Record<string, string> = { yes: 'Yes, I have a will', drafting: 'I am drafting one', no: 'No will', '': 'Not answered' };

/**
 * What Wealth Tracker's household page should say, given the will: that there
 * is one, where it is, and who the executor is. Only changes what differs, and
 * never replaces something the person wrote there with a blank, nor downgrades
 * "I have a will" to "drafting". The person sees each change before it is made.
 */
export function writeBackPlan(w: WealthRecord, r: WillRecord): WriteBack[] {
  const p = w.profile;
  const out: WriteBack[] = [];

  const hasContent = !!r.testator.name.trim() && (r.people.length > 0 || r.assets.length > 0 || r.residue.length > 0);
  const status = r.register.signedOn ? 'yes' : hasContent ? 'drafting' : '';
  if (status && status !== p.will && !(p.will === 'yes' && status === 'drafting')) {
    out.push({ field: 'will', label: 'Do you have a will?', from: WILL_WORDS[p.will] ?? p.will, to: WILL_WORDS[status] });
  }

  const kept = r.register.originalKept.trim();
  if (kept && kept !== p.willKept.trim()) {
    out.push({ field: 'willKept', label: 'Where the will is kept', from: p.willKept.trim() || 'Blank', to: kept });
  }

  const exec = r.executorIds[0] ? personName(findPerson(r, r.executorIds[0])).trim() : '';
  if (exec && !exec.startsWith('Unnamed') && exec !== p.executor.trim()) {
    out.push({ field: 'executor', label: 'Executor', from: p.executor.trim() || 'Blank', to: exec });
  }
  return out;
}

/** The Wealth Tracker profile with the plan applied. The caller saves it. */
export function applyWriteBack(w: WealthRecord, r: WillRecord, plan: WriteBack[]): WealthRecord['profile'] {
  const p = { ...w.profile };
  const hasContent = !!r.testator.name.trim();
  for (const c of plan) {
    if (c.field === 'will') p.will = r.register.signedOn ? 'yes' : hasContent ? 'drafting' : p.will;
    if (c.field === 'willKept') p.willKept = c.to;
    if (c.field === 'executor') p.executor = c.to;
  }
  return p;
}
