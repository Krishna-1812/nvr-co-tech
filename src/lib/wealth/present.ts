import { fieldsFor, head } from './heads';
import { parseMoney, rupees } from './money';
import { itemName, mask, memberName, type Item, type WealthRecord } from './model';

/**
 * An entry's details as label and value, the way a person would read them.
 *
 * Shared by the PDF and the workbook so the two print the same words. Only the
 * fields that apply to the entry as it stands and that have something in them;
 * money as rupees, dates as dd/mm/yyyy, a linked entry by its name, and
 * identifying numbers masked to their last four digits when `masked` is set.
 */

/** DD/MM/YYYY. */
export function ddmmyyyy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function detailRows(item: Item, record: WealthRecord, masked: boolean): [string, string][] {
  const spec = head(item.head);
  const out: [string, string][] = [];
  for (const f of fieldsFor(spec, item.kind, item.fields)) {
    const raw = (item.fields[f.key] ?? '').trim();
    if (!raw) continue;
    let value = raw;
    switch (f.kind) {
      case 'money': {
        const n = parseMoney(raw);
        value = typeof n === 'number' ? rupees(n) : raw;
        break;
      }
      case 'date':
        value = ddmmyyyy(raw);
        break;
      case 'percent':
        value = `${raw.replace(/%$/, '')}%`;
        break;
      case 'secret':
        value = masked ? mask(raw) : raw;
        break;
      case 'lastFour':
        value = `ending ${raw}`;
        break;
      case 'link': {
        const target = record.items.find((i) => i.id === raw);
        value = target ? itemName(target) : 'An entry no longer in the record';
        break;
      }
    }
    out.push([f.label, value]);
  }
  return out;
}

/** "Meera (daughter, 60%; guardian Ravi)", for one line in a table. */
export function nomineeLine(item: Item): string {
  const s = item.nominee.status;
  if (s === 'no') return 'No nominee';
  if (s === 'unsure') return 'Not sure';
  if (s === '') return 'Not answered';
  const people = item.nominee.people.filter((p) => p.name.trim());
  if (people.length === 0) return 'Yes (name not recorded)';
  return people
    .map((p) => {
      const bits = [p.relation.toLowerCase(), people.length > 1 && p.share.trim() ? `${p.share.replace('%', '')}%` : '', p.guardian.trim() ? `guardian ${p.guardian.trim()}` : '']
        .filter(Boolean)
        .join(', ');
      return bits ? `${p.name.trim()} (${bits})` : p.name.trim();
    })
    .join('; ');
}

export function holderLine(item: Item, record: WealthRecord): string {
  return memberName(record.profile, item.holder);
}
