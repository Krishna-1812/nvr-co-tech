import { todayIso } from '../wealth/model';
import { CITE, LAW, scopeOf } from './law';
import {
  ASSET_KIND_LABELS,
  findAsset,
  findPerson,
  isMinor,
  nameKey,
  personName,
  type Asset,
  type Person,
  type Share,
  type WillRecord,
} from './model';

/**
 * What in a will needs looking at before it is signed, said plainly.
 *
 * A will is read once, by people who are grieving, years after it was written,
 * and the person who could explain it is gone. So the checks are about the
 * mistakes that make a will fail or get fought: a gift to someone who also
 * witnessed it, shares that add up to 99, a child who is a minor and nobody
 * named to look after them, a gift that quietly falls away because the person
 * died first.
 *
 * Same three levels and the same voice as Wealth Tracker's checks, because
 * people meet both in one session:
 *
 *   - `act`: the will, as it stands, would fail or not do what was meant.
 *   - `review`: something missing or that looks wrong.
 *   - `note`: worth knowing, nothing wrong.
 *
 * `act` findings hold the final export (`readiness().ready`). The others never
 * block; a person may know something the rule does not.
 *
 * Every finding that rests on a statute carries the section, and has a test.
 * A check that is not certain is a `note`, never a pass.
 */

export type Severity = 'act' | 'review' | 'note';

/** The steps of the interview, in order. A fix points at one. */
export const STEPS = ['you', 'family', 'assets', 'gifts', 'residue', 'people', 'extras', 'sign'] as const;
export type Step = (typeof STEPS)[number];

export type Finding = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  /** The section of the statute this rests on, when it does. */
  cite?: string;
  step: Step;
  /** The person or asset to open at that step. */
  personId?: string;
  assetId?: string;
};

const EPS = 0.01;
const total = (shares: Share[]) => shares.reduce((n, s) => n + s.percent, 0);
const pct = (n: number) => `${Math.round(n * 100) / 100}%`;

const SEVERITY_ORDER: Record<Severity, number> = { act: 0, review: 1, note: 2 };

/** Everyone who takes anything under the will, by id. */
function beneficiaryIds(r: WillRecord): Set<string> {
  const ids = new Set<string>();
  const add = (shares: Share[]) =>
    shares.forEach((s) => {
      if (s.personId) ids.add(s.personId);
      if (s.alternateId) ids.add(s.alternateId);
    });
  r.gifts.forEach((g) => add(g.shares));
  add(r.residue);
  return ids;
}

const assetName = (a: Asset) => a.title.trim() || ASSET_KIND_LABELS[a.kind];

export function checkWill(r: WillRecord, today: string = todayIso()): Finding[] {
  const out: Finding[] = [];
  const push = (f: Finding) => out.push(f);
  const t = r.testator;

  // ── You ──
  if (!t.name.trim()) {
    push({ id: 'testator-name', severity: 'act', step: 'you', title: 'Add your full name', detail: 'The will opens with the name of the person making it, as it appears on your identity documents.' });
  }
  if (!t.address.trim()) {
    push({ id: 'testator-address', severity: 'review', step: 'you', title: 'Add your address', detail: 'The will says where you live. It helps whoever reads it tell you from someone with the same name.' });
  }
  if (!t.soundMind) {
    push({ id: 'declare-mind', severity: 'act', step: 'you', cite: CITE.whoMayMake, title: 'Confirm you are of sound mind', detail: 'A will is valid only if the person making it understands what they are doing. The draft says you are; tick it only if it is true.' });
  }
  if (!t.voluntary) {
    push({ id: 'declare-free', severity: 'act', step: 'you', title: 'Confirm you are making this will freely', detail: 'A will made under pressure, fraud or undue influence can be set aside. Tick it only if it is true.' });
  }

  const scope = scopeOf(t, today);
  for (const reason of scope.reasons) {
    push({
      id: `scope-${reason.id}`,
      severity: reason.level === 'out' ? 'act' : 'review',
      step: 'you',
      title: reason.title,
      detail: reason.detail,
      cite: reason.cite,
    });
  }

  // ── People: blanks and doubles ──
  for (const p of r.people) {
    if (!p.name.trim()) {
      push({ id: `person-unnamed:${p.id}`, severity: 'review', step: 'family', personId: p.id, title: `Name your ${p.relation === 'Other' ? 'person' : p.relation.toLowerCase()}`, detail: 'Someone on your list has no name yet. A will that names “my son” without a name leaves room for argument.' });
    }
  }
  const seen = new Map<string, Person>();
  for (const p of r.people) {
    const k = nameKey(p.name);
    if (!k) continue;
    const first = seen.get(k);
    if (first) {
      push({ id: `person-double:${p.id}`, severity: 'review', step: 'family', personId: p.id, title: `${personName(p)} is on your list twice`, detail: 'Two people with the same name make it unclear who is meant. If they are different people, add something that tells them apart (a middle name, a date of birth). If it is one person, remove the extra.' });
    } else {
      seen.set(k, p);
    }
  }

  // ── Assets ──
  if (r.assets.length === 0) {
    push({ id: 'no-assets', severity: 'note', step: 'assets', title: 'No assets listed', detail: 'You can still make a will without listing anything: the “everything else” clause covers all you own. Listing what you have lets you give particular things to particular people.' });
  }
  for (const a of r.assets) {
    if (!a.institution.trim() && !a.identifier.trim() && !a.location.trim() && !a.details.trim()) {
      push({ id: `asset-vague:${a.id}`, severity: 'review', step: 'assets', assetId: a.id, title: `${assetName(a)} is hard to identify`, detail: 'Say where it is held or what it is, in a few words: the bank and account number, the address, the folio. An executor has to be able to find it.' });
    }
    if (a.holding === 'joint' || a.percent < 100 || a.coOwners.trim()) {
      push({ id: `asset-shared:${a.id}`, severity: 'note', step: 'assets', assetId: a.id, title: `${assetName(a)} is shared`, detail: 'A will can pass only your own share, and how a jointly held asset passes after death depends on how it is held. The will here gives your share; check the rest with the bank, the registrar or an advocate.' });
    }
    if (a.kind === 'insurance' || a.kind === 'retirement') {
      push({ id: `asset-nominated:${a.id}`, severity: 'note', step: 'assets', assetId: a.id, title: `${assetName(a)} usually follows its nomination`, detail: 'Money from a policy or a provident fund normally goes to the nominee or beneficiary named with the provider. Make sure that nomination matches what you want.' });
    }
  }

  // ── Gifts ──
  const gifted = new Map<string, number>();
  for (const g of r.gifts) {
    const asset = findAsset(r, g.assetId);
    gifted.set(g.assetId, (gifted.get(g.assetId) ?? 0) + 1);
    if (!asset) {
      push({ id: `gift-orphan:${g.id}`, severity: 'act', step: 'gifts', title: 'A gift refers to an asset that is no longer listed', detail: 'Remove the gift or add the asset back.' });
      continue;
    }
    const name = assetName(asset);
    if (g.shares.length === 0) {
      push({ id: `gift-nobody:${g.id}`, severity: 'act', step: 'gifts', assetId: asset.id, title: `Who gets ${name}?`, detail: 'This gift has no one to receive it.' });
      continue;
    }
    if (Math.abs(total(g.shares) - 100) > EPS) {
      push({ id: `gift-sum:${g.id}`, severity: 'act', step: 'gifts', assetId: asset.id, title: `Shares of ${name} add up to ${pct(total(g.shares))}`, detail: 'The shares of one gift must add up to exactly 100%. Anything short is not given by this clause; anything over cannot be given.' });
    }
    for (const s of g.shares) {
      if (!findPerson(r, s.personId)) {
        push({ id: `gift-person:${g.id}:${s.personId || 'blank'}`, severity: 'act', step: 'gifts', assetId: asset.id, title: `Choose who gets ${name}`, detail: 'A share points at someone who is not on your list.' });
      }
      if (s.alternateId && !findPerson(r, s.alternateId)) {
        push({ id: `gift-alt:${g.id}:${s.alternateId}`, severity: 'act', step: 'gifts', assetId: asset.id, title: `The backup for ${name} is not on your list`, detail: 'Choose the backup again or remove it.' });
      }
      if (s.alternateId && s.alternateId === s.personId) {
        push({ id: `gift-alt-same:${g.id}:${s.personId}`, severity: 'review', step: 'gifts', assetId: asset.id, title: `The backup for ${name} is the same person`, detail: 'If that person dies before you, the backup needs to be someone else.' });
      }
    }

    // A nominee who is not the beneficiary is the usual source of family argument.
    if (asset.nominee.status === 'yes' && asset.nominee.names.length > 0) {
      const nominees = asset.nominee.names.map(nameKey).filter(Boolean);
      const takers = g.shares.map((s) => nameKey(personName(findPerson(r, s.personId))));
      const overlap = takers.some((n) => nominees.includes(n));
      if (!overlap && nominees.length > 0) {
        push({ id: `gift-nominee:${g.id}`, severity: 'note', step: 'gifts', assetId: asset.id, title: `The nominee on ${name} is not who you give it to`, detail: `The provider lists ${asset.nominee.names.join(', ')} as nominee. A nominee often receives the money on behalf of the legal heirs rather than keeping it, but the difference causes arguments. Decide on purpose, and change the nomination if you want them to match.` });
      }
    }
  }
  for (const [assetId, n] of gifted) {
    if (n > 1) {
      const asset = findAsset(r, assetId);
      push({ id: `gift-twice:${assetId}`, severity: 'act', step: 'gifts', assetId, title: `${asset ? assetName(asset) : 'An asset'} is given more than once`, detail: 'Each asset can have one gift. To split it, give it in shares to more than one person.' });
    }
  }
  const ungifted = r.assets.filter((a) => !gifted.has(a.id));
  if (ungifted.length > 0 && r.assets.length > 0) {
    push({ id: 'ungifted', severity: 'note', step: 'gifts', title: `${ungifted.length} of ${r.assets.length} assets are not given by name`, detail: 'They fall into “everything else” and go to the people you name there. That is fine if it is what you want.' });
  }

  // ── Everything else (the residue) ──
  if (r.residue.length === 0) {
    push({ id: 'residue-none', severity: 'act', step: 'residue', title: 'Say who gets everything else', detail: 'Anything the will does not give by name, including what you buy after signing, would pass under the law of succession as if there were no will for that part. Naming people here is the single most useful clause in a will.' });
  } else {
    if (Math.abs(total(r.residue) - 100) > EPS) {
      push({ id: 'residue-sum', severity: 'act', step: 'residue', title: `Shares of everything else add up to ${pct(total(r.residue))}`, detail: 'They must add up to exactly 100%.' });
    }
    for (const s of r.residue) {
      if (!findPerson(r, s.personId)) {
        push({ id: `residue-person:${s.personId || 'blank'}`, severity: 'act', step: 'residue', title: 'Choose who gets this share', detail: 'A share points at someone who is not on your list.' });
      }
      if (s.alternateId && !findPerson(r, s.alternateId)) {
        push({ id: `residue-alt:${s.alternateId}`, severity: 'act', step: 'residue', title: 'A backup is not on your list', detail: 'Choose the backup again or remove it.' });
      }
    }
  }

  // ── If someone dies first ──
  const noBackup =
    r.gifts.reduce((n, g) => n + g.shares.filter((s) => s.personId && !s.alternateId).length, 0) +
    r.residue.filter((s) => s.personId && !s.alternateId).length;
  if (noBackup > 0) {
    push({ id: 'no-backup', severity: 'note', step: 'residue', cite: CITE.lapse, title: `${noBackup} ${noBackup === 1 ? 'share has' : 'shares have'} no backup`, detail: 'If a person dies before you, their gift falls back into “everything else” and goes to the people named there. A backup says who should have it instead.' });
  }

  // ── Spouse and children ──
  const spouse = r.people.find((p) => p.relation === 'Spouse');
  const takers = beneficiaryIds(r);
  if (spouse && !takers.has(spouse.id)) {
    push({ id: 'spouse-unnamed', severity: 'review', step: 'gifts', personId: spouse.id, title: `${personName(spouse)} is not given anything`, detail: 'Your spouse is on your list but receives nothing under this will. If that is deliberate, have an advocate read the draft before you sign.' });
  }

  // ── Minors ──
  const minorBeneficiaries = [...takers].map((id) => findPerson(r, id)).filter((p): p is Person => !!p && isMinor(p, today));
  const minorChildren = r.people.filter((p) => (p.relation === 'Son' || p.relation === 'Daughter') && isMinor(p, today));
  if ((minorChildren.length > 0 || minorBeneficiaries.length > 0) && r.guardianIds.length === 0) {
    const who = [...new Set([...minorChildren, ...minorBeneficiaries].map(personName))];
    push({ id: 'minor-no-guardian', severity: 'review', step: 'people', cite: CITE.guardian, title: 'Name a guardian for a child under 18', detail: `${who.join(', ')} ${who.length === 1 ? 'is' : 'are'} under 18. If you and the child’s other parent were both gone, nobody has been named to look after them or their money.` });
  }
  if (minorBeneficiaries.length > 0) {
    push({ id: 'minor-gift', severity: 'note', step: 'gifts', title: 'A gift to a child under 18 is managed by someone else until they come of age', detail: 'A minor cannot manage property. Money and property given to one is usually looked after by a guardian. For larger gifts, an advocate can arrange a trust.' });
  }

  // ── Executors ──
  if (r.executorIds.length === 0) {
    push({ id: 'executor-none', severity: 'review', step: 'people', title: 'Name an executor', detail: 'An executor is the person who carries out the will. It is not compulsory, but without one, your family must apply to a court to be given the power to act.' });
  } else if (r.executorIds.length === 1) {
    push({ id: 'executor-one', severity: 'note', step: 'people', title: 'Name a second executor in case the first cannot act', detail: 'If the only executor dies before you or will not act, the family is back to asking a court.' });
  }
  for (const id of r.executorIds) {
    if (!findPerson(r, id)) {
      push({ id: `executor-missing:${id}`, severity: 'act', step: 'people', title: 'An executor is not on your list', detail: 'Choose the executor again.' });
    }
  }
  for (const id of r.guardianIds) {
    if (!findPerson(r, id)) {
      push({ id: `guardian-missing:${id}`, severity: 'act', step: 'people', title: 'A guardian is not on your list', detail: 'Choose the guardian again.' });
    }
  }

  // ── Witnesses ──
  const witnesses = r.witnessIds.map((id) => findPerson(r, id)).filter((p): p is Person => !!p);
  for (const w of witnesses) {
    if (takers.has(w.id)) {
      push({ id: `witness-beneficiary:${w.id}`, severity: 'act', step: 'people', personId: w.id, cite: CITE.witnessGift, title: `${personName(w)} is a witness and also receives a gift`, detail: 'A gift to a person who witnesses the will (or to their spouse) is void. Choose someone else as witness: a friend or colleague who gets nothing, ideally younger than you.' });
    }
  }
  if (witnesses.length === 0) {
    push({ id: 'witness-later', severity: 'note', step: 'people', cite: CITE.witnesses, title: `Two witnesses will sign with you`, detail: `The will must be witnessed by at least ${LAW.witnessesNeeded} people who see you sign. You can name them now, or leave the lines blank and fill them in at signing.` });
  } else if (witnesses.length < LAW.witnessesNeeded) {
    push({ id: 'witness-short', severity: 'review', step: 'people', cite: CITE.witnesses, title: `Only ${witnesses.length} witness named`, detail: `At least ${LAW.witnessesNeeded} are needed. Name another, or leave the second line blank to fill in at signing.` });
  }

  // ── Signing ──
  if (!r.signing.place.trim() || !r.signing.date.trim()) {
    push({ id: 'sign-blank', severity: 'note', step: 'sign', cite: CITE.signing, title: 'Place and date', detail: 'Leave them blank to write by hand when you sign. The date matters if there is ever more than one will: the latest one counts.' });
  }

  out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || STEPS.indexOf(a.step) - STEPS.indexOf(b.step));
  return out;
}

export type Readiness = { act: number; review: number; note: number; ready: boolean };

/** How many of each. `ready` means nothing stops the final export. */
export function readiness(findings: Finding[]): Readiness {
  const n = (s: Severity) => findings.filter((f) => f.severity === s).length;
  return { act: n('act'), review: n('review'), note: n('note'), ready: n('act') === 0 };
}
