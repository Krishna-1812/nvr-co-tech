import { newId } from '../wealth/model';
import { assetLabel } from './clauses';
import { findAsset, type Asset, type Gift, type Person, type Share, type WillRecord } from './model';

/**
 * Changes to a will record, as pure functions.
 *
 * The screens never reach into a record and rearrange it. Every change goes
 * through here, so the rules that keep a record coherent live in one place and
 * have tests: taking a person off the list also takes them out of every gift,
 * every backup, and every role (executor, guardian, witness), because a will
 * that still names someone who is gone is worse than one that visibly lacks
 * them.
 *
 * Each function returns a new record and leaves the one it was given alone.
 */

const upsert = <T extends { id: string }>(list: T[], item: T): T[] =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

export function setPerson(r: WillRecord, person: Person): WillRecord {
  return { ...r, people: upsert(r.people, person) };
}

/**
 * Removes a person and everything that pointed at them: roles, shares they
 * were to receive, and the places they were named as somebody's backup.
 * A gift left with no recipients is dropped, so the asset reads as "not given
 * by name" again rather than as a gift to nobody.
 */
export function removePerson(r: WillRecord, id: string): WillRecord {
  const clean = (shares: Share[]): Share[] =>
    shares.filter((s) => s.personId !== id).map((s) => (s.alternateId === id ? { ...s, alternateId: '' } : s));
  return {
    ...r,
    people: r.people.filter((p) => p.id !== id),
    gifts: r.gifts.map((g) => ({ ...g, shares: clean(g.shares) })).filter((g) => g.shares.length > 0),
    residue: clean(r.residue),
    executorIds: r.executorIds.filter((x) => x !== id),
    guardianIds: r.guardianIds.filter((x) => x !== id),
    witnessIds: r.witnessIds.filter((x) => x !== id),
  };
}

export function setAsset(r: WillRecord, asset: Asset): WillRecord {
  return { ...r, assets: upsert(r.assets, asset) };
}

/** Removes an asset and the gift of it. */
export function removeAsset(r: WillRecord, id: string): WillRecord {
  return { ...r, assets: r.assets.filter((a) => a.id !== id), gifts: r.gifts.filter((g) => g.assetId !== id) };
}

/** Sets who gets an asset. No shares means it is no longer given by name. */
export function setGift(r: WillRecord, assetId: string, shares: Share[]): WillRecord {
  const others = r.gifts.filter((g) => g.assetId !== assetId);
  if (shares.length === 0) return { ...r, gifts: others };
  const existing = r.gifts.find((g) => g.assetId === assetId);
  const gift: Gift = { id: existing?.id ?? newId(), assetId, shares };
  // Keep the asset's place in the list, so a re-edited gift does not jump to the end.
  return { ...r, gifts: existing ? r.gifts.map((g) => (g.assetId === assetId ? gift : g)) : [...others, gift] };
}

export const setResidue = (r: WillRecord, shares: Share[]): WillRecord => ({ ...r, residue: shares });

export type Role = 'executorIds' | 'guardianIds' | 'witnessIds';

/** Sets the people in a role, in order, once each, dropping blanks. */
export function setRole(r: WillRecord, role: Role, ids: string[]): WillRecord {
  const seen = new Set<string>();
  const clean = ids.filter((id) => id && !seen.has(id) && !!seen.add(id));
  return { ...r, [role]: clean };
}

/**
 * Shares that split a gift equally and add to exactly 100: 3 people get
 * 33.34, 33.33 and 33.33, never 33.33 three times and a 0.01 hole that the
 * checks would then (rightly) complain about.
 */
export function equalPercents(n: number): number[] {
  if (n <= 0) return [];
  const each = Math.floor(10000 / n) / 100;
  const out = Array.from({ length: n }, () => each);
  out[0] = Math.round((100 - each * (n - 1)) * 100) / 100;
  return out;
}

/** Gives the shares an equal split, keeping each one's person and backup. */
export function splitEqually(shares: Share[]): Share[] {
  const p = equalPercents(shares.length);
  return shares.map((s, i) => ({ ...s, percent: p[i] }));
}

/**
 * Where a person is named, in words, so removing them can say what will change:
 * "executor", "gift of Flat in Pune", "backup for everything else".
 */
export function usesOf(r: WillRecord, id: string): string[] {
  const out: string[] = [];
  if (r.executorIds.includes(id)) out.push('executor');
  if (r.guardianIds.includes(id)) out.push('guardian');
  if (r.witnessIds.includes(id)) out.push('witness');
  const label = (assetId: string) => {
    const a = findAsset(r, assetId);
    return a ? assetLabel(a) : 'an asset';
  };
  for (const g of r.gifts) {
    for (const s of g.shares) {
      if (s.personId === id) out.push(`gets ${label(g.assetId)}`);
      if (s.alternateId === id) out.push(`backup for ${label(g.assetId)}`);
    }
  }
  for (const s of r.residue) {
    if (s.personId === id) out.push('gets everything else');
    if (s.alternateId === id) out.push('backup for everything else');
  }
  return out;
}
