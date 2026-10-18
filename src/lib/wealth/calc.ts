import { GROUPS, HEADS, head, type GroupId, type HeadId } from './heads';
import { parseMoney } from './money';
import type { Item, WealthRecord } from './model';

/**
 * Net worth, and the handful of figures that explain it.
 *
 * The rules, each of which the screen and both exports say in words:
 *
 *   - An entry counts at **your share** of its value. A flat owned half-and-half
 *     with a spouse adds half its value; a joint home loan where you carry half
 *     adds half the outstanding. The share defaults to 100%.
 *   - An entry with **no value yet** adds nothing and is listed, never guessed.
 *   - **Term and health cover** have no value while you are alive and so add
 *     nothing to net worth. They stay in the record, and in the nominee checks,
 *     because they are exactly what a family needs to know about.
 *   - **Liquid** means it could be cash within days without a meaningful
 *     penalty: bank balances, most deposits, listed shares, most mutual funds
 *     and cash at home. Everything else is not, even if it is valuable.
 *
 * Nothing is converted, projected or adjusted for tax. These are the figures as
 * entered, added up.
 */

export type HeadTotal = {
  id: HeadId;
  total: number;
  count: number;
  /** Entries with no value entered yet. */
  unvalued: number;
};

export type Summary = {
  assets: number;
  liabilities: number;
  net: number;
  liquid: number;
  secured: number;
  unsecured: number;
  heads: HeadTotal[];
  groups: { id: GroupId; total: number }[];
  /** Entries with no value: listed so nobody mistakes a gap for a zero. */
  unvalued: Item[];
  /** Term and health policies: in the record, not in the total. */
  cover: Item[];
  /** The EMIs entered on loans, a month. */
  monthlyEmi: number;
  /** Liabilities as a share of assets, as a percentage. Null with no assets. */
  debtToAssets: number | null;
  /** Months of spending the liquid assets would cover. Null without expenses entered. */
  monthsCovered: number | null;
  /** Nominee coverage over the entries that take one. */
  nominees: { applicable: number; yes: number; no: number; unsure: number; unanswered: number };
};

/** What one entry adds to its side: its value at the household's share, or nothing. */
export function counted(item: Item): number {
  const spec = head(item.head);
  if (item.value === null || !spec.counts(item.kind)) return 0;
  return round2((item.value * item.share) / 100);
}

export function isLiquid(item: Item): boolean {
  const spec = head(item.head);
  return spec.side === 'asset' && spec.liquid(item.kind);
}

/** Whether the nominee question applies to this entry as it stands. */
export function takesNominee(item: Item): boolean {
  return head(item.head).nominee(item.kind, item.fields);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Sums a record. `holder` narrows it to one member of the household; omitted,
 * it is everyone's together.
 */
export function summarise(record: WealthRecord, holder?: string): Summary {
  const items = holder ? record.items.filter((i) => i.holder === holder) : record.items;

  let assets = 0;
  let liabilities = 0;
  let liquid = 0;
  let secured = 0;
  let unsecured = 0;
  let monthlyEmi = 0;
  const headTotals = new Map<HeadId, HeadTotal>();
  const groupTotals = new Map<GroupId, number>();
  const unvalued: Item[] = [];
  const cover: Item[] = [];
  const nominees = { applicable: 0, yes: 0, no: 0, unsure: 0, unanswered: 0 };

  for (const item of items) {
    const spec = head(item.head);
    const amount = counted(item);
    const t = headTotals.get(spec.id) ?? { id: spec.id, total: 0, count: 0, unvalued: 0 };
    t.count += 1;
    t.total = round2(t.total + amount);

    if (!spec.counts(item.kind)) cover.push(item);
    else if (item.value === null) {
      unvalued.push(item);
      t.unvalued += 1;
    }
    headTotals.set(spec.id, t);
    groupTotals.set(spec.group, round2((groupTotals.get(spec.group) ?? 0) + amount));

    if (spec.side === 'asset') {
      assets += amount;
      if (spec.liquid(item.kind)) liquid += amount;
    } else {
      liabilities += amount;
      if (spec.group === 'secured') secured += amount;
      else unsecured += amount;
      const emi = parseMoney(item.fields.emi ?? '');
      if (typeof emi === 'number') monthlyEmi += (emi * item.share) / 100;
    }

    if (takesNominee(item)) {
      nominees.applicable += 1;
      const s = item.nominee.status;
      if (s === 'yes') nominees.yes += 1;
      else if (s === 'no') nominees.no += 1;
      else if (s === 'unsure') nominees.unsure += 1;
      else nominees.unanswered += 1;
    }
  }

  assets = round2(assets);
  liabilities = round2(liabilities);
  liquid = round2(liquid);
  const expenses = record.profile.monthlyExpenses;

  return {
    assets,
    liabilities,
    net: round2(assets - liabilities),
    liquid,
    secured: round2(secured),
    unsecured: round2(unsecured),
    heads: HEADS.map((h) => headTotals.get(h.id)).filter((t): t is HeadTotal => !!t),
    groups: (Object.keys(GROUPS) as GroupId[])
      .map((id) => ({ id, total: groupTotals.get(id) ?? 0 }))
      .filter((g) => g.total > 0),
    unvalued,
    cover,
    monthlyEmi: round2(monthlyEmi),
    debtToAssets: assets > 0 ? round2((liabilities / assets) * 100) : null,
    monthsCovered: expenses && expenses > 0 ? Math.floor((liquid / expenses) * 10) / 10 : null,
    nominees,
  };
}
