import { checkWill, type Finding, type Severity } from './checks';
import { ADVOCATE_QUESTIONS } from './clauses';
import { buildWill, plainText } from './document';
import { EXAMPLE_TODAY, exampleWill } from './example';
import { FAQ } from './faq';
import { GUIDE, GUIDE_CLOSING, NOT_NEEDED } from './guide';
import { CIRCUMSTANCES, CIRCUMSTANCE_LABELS, CITE, LAW, RELIGIONS, scopeOf, type Circumstance, type Religion } from './law';
import { blankAsset, blankPerson, blankWill, type WillRecord } from './model';
import { registerPrompts, reviewPrompts, type Prompt } from './register';
import { blankItem, blankNominee, blankRecord } from '../wealth/model';
import { importFromWealth } from './fromWealth';

/**
 * The document an advocate reads before signing the rules off.
 *
 * Generated from the code, never written by hand, so it cannot describe a
 * rule the product does not follow or miss one it does. It prints every
 * sentence the tool says about the law: who it turns away, every clause it can
 * write, every check with the section it rests on, the guidance on signing,
 * and the open questions that rest on judgement rather than a section number.
 *
 * Two controls tie it to the code (docs/will-maker/launch-runbook.md):
 *
 *   - `REVIEWED_FILES` are the files that carry legal text. A digest of them is
 *     printed at the top of the packet and recorded in `LAW.advocateSignOff`.
 *   - A test regenerates this packet and fails if the committed copy is stale,
 *     and fails if a sign-off exists whose digest no longer matches the files.
 *     So changing a rule after sign-off cannot go unnoticed or unreviewed.
 *
 * Pure: the digest is passed in (review-digest.ts reads the files), so this
 * module has no file access and can run anywhere.
 */

/** The files whose text is what an advocate approves. Changing any of them invalidates a sign-off. */
export const REVIEWED_FILES = [
  'src/lib/will/law.ts',
  'src/lib/will/checks.ts',
  'src/lib/will/clauses.ts',
  'src/lib/will/document.ts',
  'src/lib/will/guide.ts',
  'src/lib/will/faq.ts',
  'src/lib/will/register.ts',
] as const;

type Variant = [label: string, edit: (w: WillRecord) => void];

/** Each way of bending the worked example that makes a check speak. */
const VARIANTS: Variant[] = [
  ['no name, declarations unticked', (w) => Object.assign(w.testator, { name: '', soundMind: false, voluntary: false, address: '' })],
  ['a minor', (w) => (w.testator.dob = '2012-01-01')],
  ['Muslim', (w) => (w.testator.religion = 'Muslim')],
  ['Goa', (w) => (w.testator.state = 'Goa')],
  ['religion not given', (w) => (w.testator.religion = '')],
  ['every circumstance ticked', (w) => (w.testator.circumstances = [...CIRCUMSTANCES])],
  ['a person with no name, and a duplicate', (w) => w.people.push(blankPerson('Brother'), { ...w.people[0], id: 'twin' })],
  ['no assets', (w) => ((w.assets = []), (w.gifts = []))],
  ['an asset described by nothing', (w) => w.assets.push({ ...blankAsset('bank'), id: 'vague', title: 'Some account' })],
  ['a shared asset', (w) => ((w.assets[1].holding = 'joint'), (w.assets[0].percent = 50))],
  ['a gift that does not add up', (w) => (w.gifts[2].shares[0].percent = 40)],
  ['a gift to nobody, and to someone not listed', (w) => ((w.gifts[0].shares = []), (w.gifts[1].shares[0].personId = 'ghost'))],
  ['an asset given twice', (w) => w.gifts.push({ id: 'again', assetId: 'flat', shares: [{ personId: 'kavita', percent: 100, alternateId: '' }] })],
  ['a backup that is the same person', (w) => (w.gifts[0].shares[0].alternateId = 'nisha')],
  ['a gift of an asset that was removed', (w) => (w.assets = w.assets.filter((a) => a.id !== 'flat'))],
  ['a backup who is not on the list', (w) => (w.gifts[0].shares[0].alternateId = 'ghost')],
  ['a residue recipient and backup not on the list', (w) => ((w.residue[0].personId = 'ghost'), (w.residue[0].alternateId = 'ghost'))],
  ['an executor and a guardian not on the list', (w) => ((w.executorIds = ['ghost']), (w.guardianIds = ['ghost']))],
  ['no residue', (w) => (w.residue = [])],
  ['residue that does not add up', (w) => w.residue.push({ personId: 'kavita', percent: 10, alternateId: '' })],
  ['no backups', (w) => ((w.gifts[0].shares[0].alternateId = ''), (w.residue[0].alternateId = ''))],
  ['spouse given nothing', (w) => ((w.gifts = []), (w.residue = [{ personId: 'kavita', percent: 100, alternateId: '' }]))],
  ['a minor child and no guardian', (w) => (w.guardianIds = [])],
  ['no executor / one executor', (w) => (w.executorIds = [])],
  ['one executor only', (w) => (w.executorIds = ['nisha'])],
  ['witness who also receives a gift', (w) => (w.gifts[1].shares[0].personId = 'dev')],
  ['one witness, then none', (w) => (w.witnessIds = ['dev'])],
  ['no witnesses named', (w) => (w.witnessIds = [])],
  ['no place or date', (w) => (w.signing = { place: '', date: '' })],
];

function catalog(): { severity: Severity; id: string; title: string; detail: string; cite?: string; when: string }[] {
  const seen = new Map<string, { f: Finding; when: string }>();
  for (const [label, edit] of VARIANTS) {
    const w = structuredClone(exampleWill());
    edit(w);
    for (const f of checkWill(w, EXAMPLE_TODAY)) {
      const key = f.id.replace(/:.*$/, '');
      if (!seen.has(key)) seen.set(key, { f, when: label });
    }
  }
  for (const f of checkWill(exampleWill(), EXAMPLE_TODAY)) {
    const key = f.id.replace(/:.*$/, '');
    if (!seen.has(key)) seen.set(key, { f, when: 'the worked example' });
  }
  const order: Record<Severity, number> = { act: 0, review: 1, note: 2 };
  return [...seen.entries()]
    .map(([id, { f, when }]) => ({ severity: f.severity, id, title: f.title, detail: f.detail, cite: f.cite, when }))
    .sort((a, b) => order[a.severity] - order[b.severity] || a.id.localeCompare(b.id));
}

function afterCatalog(): { id: string; severity: Severity; title: string; detail: string }[] {
  const out = new Map<string, Prompt>();
  const add = (ps: Prompt[]) => ps.forEach((p) => out.has(p.id.replace(/:.*$/, '')) || out.set(p.id.replace(/:.*$/, ''), p));

  const signed = (): WillRecord => {
    const w = structuredClone(exampleWill());
    w.register = { signedOn: '2026-09-01', originalKept: '', executorTold: false, alsoKnows: '', registered: true, registeredAt: '', reviewBy: '' };
    return w;
  };
  add(registerPrompts(exampleWill(), EXAMPLE_TODAY));
  add(registerPrompts(signed(), EXAMPLE_TODAY));
  const open = signed();
  open.gifts[0].shares[0].percent = 40;
  add(registerPrompts(open, EXAMPLE_TODAY));
  const bad = signed();
  bad.register.signedOn = '01/09/2026';
  add(registerPrompts(bad, EXAMPLE_TODAY));
  const future = signed();
  future.register.signedOn = '2027-01-01';
  add(registerPrompts(future, EXAMPLE_TODAY));
  const due = signed();
  due.register.reviewBy = '2026-10-24';
  due.people.forEach((p) => (p.dob = p.relation === 'Son' || p.relation === 'Daughter' ? '2000-01-01' : p.dob));
  add(reviewPrompts(due, null, EXAMPLE_TODAY));
  due.register.reviewBy = '2026-11-10';
  add(reviewPrompts(due, null, EXAMPLE_TODAY));

  const wealth = blankRecord('Rohan Mehta');
  wealth.profile.members.push({ id: 'm1', name: 'Nisha Mehta', relation: 'Spouse' });
  const bank = { ...blankItem('bank'), id: 'i-bank', kind: 'Savings', value: 1, fields: { bank: 'State Bank of India', account: '12345678901' } };
  bank.nominee = { status: 'yes', people: [{ ...blankNominee(), id: 'n1', name: 'Nisha Mehta', relation: 'Spouse' }] };
  const flat = { ...blankItem('property'), id: 'i-flat', kind: 'Flat / apartment', value: 1, fields: { address: 'Flat 4' } };
  wealth.items = [bank, flat];
  const will = importFromWealth(blankWill('Rohan Mehta'), wealth).record;
  wealth.items.push({ ...blankItem('gold'), id: 'i-gold', value: 1 });
  wealth.items = wealth.items.filter((i) => i.id !== 'i-flat');
  wealth.items[0].nominee = { status: 'no', people: [] };
  wealth.profile.members.push({ id: 'm2', name: 'Aarav Mehta', relation: 'Son' });
  add(reviewPrompts(will, wealth, EXAMPLE_TODAY));

  const order: Record<Severity, number> = { act: 0, review: 1, note: 2 };
  return [...out.entries()].map(([id, p]) => ({ id, severity: p.severity, title: p.title, detail: p.detail })).sort((a, b) => order[a.severity] - order[b.severity] || a.id.localeCompare(b.id));
}

/** The check ids the packet's table covers, so a test can prove none was left out. */
export const reviewedCheckIds = () => catalog().map((c) => c.id);
/** The after-signing prompt ids the packet covers. */
export const reviewedPromptIds = () => afterCatalog().map((c) => c.id);

const quote = (s: string) => s.split('\n').map((l) => `> ${l}`.trimEnd()).join('\n');

export function buildReviewPacket(digest: string): string {
  const L: string[] = [];
  const h = (n: number, t: string) => L.push('', `${'#'.repeat(n)} ${t}`, '');

  L.push('# Will Maker: legal review packet', '');
  L.push(`**Packet digest: \`${digest}\`**`, '');
  L.push(`Generated from the code (\`npm run will:packet\`); do not edit by hand. Rules last read against published sources on ${LAW.rulesCheckedOn}. The digest covers these files, which carry every legal sentence the product says:`, '');
  REVIEWED_FILES.forEach((f) => L.push(`- \`${f}\``));

  h(2, '1. What you are being asked to do');
  L.push(
    'Will Maker is a drafting aid for an Indian will. A person answers a short interview; the tool assembles a will from a fixed library of clauses (no text is generated, and nothing a person types becomes a clause), checks it against the rules below, and produces a print-ready PDF, an editable Word file and a signing guide. The person signs on paper with two witnesses. The tool does not give legal advice, does not file or register anything, and does not store a will on any server in readable form.',
    '',
    'Please read this whole packet and answer §3. We are asking you to confirm, or to correct, each of the following: (a) that every statement of law below is right for the cases the tool accepts; (b) that the cases the tool turns away or cautions (§4) are the right ones; (c) that each clause (§5) does what it says and is safe to print for a person who has not seen a lawyer; (d) that the signing guidance (§8) is correct and complete; (e) that the questions and answers we publish on the public page (§9) are right and say nothing the guidance does not.',
    '',
    'Anything you correct will be changed in the code and this packet regenerated. A sign-off applies to exactly the digest above; any later change to these files invalidates it and needs a fresh review.',
  );

  h(2, '2. How a sign-off is recorded');
  L.push(
    '1. You send the owner a written sign-off that names this packet digest, with your name, enrolment number and firm.',
    '2. The owner fills `SIGN_OFF` in `src/lib/will/signoff.ts` as `{ by, on, packet }`, with this digest. (That file is deliberately outside the digest, so recording the sign-off does not change what it signs.)',
    '3. The build checks that the digest still matches the files. Change any of them and the build fails until a new packet is reviewed.',
    '4. Even with a sign-off, the tool opens to the public only when the owner also turns on `NEXT_PUBLIC_WILL_MAKER=1`.',
  );

  h(2, '3. Questions that rest on your judgement');
  ADVOCATE_QUESTIONS.forEach((q, i) => L.push(`${i + 1}. **${q.clause}.** ${q.question}`, '   - Answer: _______________________________________________', ''));
  L.push(
    `${ADVOCATE_QUESTIONS.length + 1}. **Probate.** One 2026 article states that the Repealing and Amending Act, 2025 omitted s.213 of the Indian Succession Act. We have not repeated it anywhere in the product because we could not verify it. Is it correct, and should the guidance say anything about probate?`,
    '   - Answer: _______________________________________________',
    '',
    `${ADVOCATE_QUESTIONS.length + 2}. **Electronic signatures.** The tool tells people a will is signed on paper, in ink, and that "an electronic or typed signature" is not how a will is signed. We understand wills fall outside the electronic signature provisions of the Information Technology Act, 2000 (First Schedule). Is that statement right?`,
    '   - Answer: _______________________________________________',
  );

  h(2, '4. Who the tool turns away, and who it cautions');
  L.push('The first step reads the answers and shows the reason in words. **Out** stops the interview. **Caution** lets it continue and keeps the reason on screen.', '');
  const today = EXAMPLE_TODAY;
  const base = { dob: '1978-04-12', religion: 'Hindu' as Religion, state: 'Maharashtra', circumstances: [] as Circumstance[] };
  const scopeCases: [string, Parameters<typeof scopeOf>[0]][] = [
    ['Under 18', { ...base, dob: '2012-01-01' }],
    ['No date of birth', { ...base, dob: '' }],
    ...RELIGIONS.map((r): [string, Parameters<typeof scopeOf>[0]] => [`Religion: ${r}`, { ...base, religion: r }]),
    ['Religion not given', { ...base, religion: '' }],
    ['State: Goa', { ...base, state: 'Goa' }],
    ...CIRCUMSTANCES.map((c): [string, Parameters<typeof scopeOf>[0]] => [`Ticked: "${CIRCUMSTANCE_LABELS[c]}"`, { ...base, circumstances: [c] }]),
  ];
  for (const [label, input] of scopeCases) {
    const s = scopeOf(input, today);
    L.push(`**${label}** → ${s.level === 'ok' ? '**no objection**' : s.level === 'out' ? '**OUT**' : '**caution**'}`);
    for (const r of s.reasons) L.push('', quote(`**${r.title}**\n${r.detail}${r.cite ? `\n_${r.cite}_` : ''}`));
    L.push('');
  }

  h(2, '5. The clause library');
  L.push('Every sentence the tool can write into a will. Names, addresses and descriptions are slotted into fixed sentences; the three free-text wishes (funeral, online accounts, pets) are printed under their own headings and are never merged into a clause. The worked example below uses invented names.', '');
  L.push('### The worked example, in full', '', '```text', plainText(buildWill(exampleWill(), EXAMPLE_TODAY)).trimEnd(), '```', '');
  const v = structuredClone(exampleWill());
  v.assets[0].percent = 50;
  v.assets[1].holding = 'joint';
  v.executorIds = ['nisha', 'kavita', 'dev'];
  v.extras = { funeral: '(the person’s wish, printed as typed)', digital: '(the person’s wish, printed as typed)', pets: '(the person’s wish, printed as typed)', payDebts: false };
  v.residue = [];
  L.push('### Variants: a share of a shared asset, a joint holding, three executors, wishes, no “pay debts” clause, no “everything else”', '', '```text', plainText(buildWill(v, EXAMPLE_TODAY)).trimEnd(), '```');

  h(2, '6. Every check the tool makes before a will is final');
  L.push('**Act on this** holds the final copy (every file is marked DRAFT while one stands). **Review** and **Good to know** never block. The right-hand column is the situation that raises it.', '');
  L.push('| Level | Check | What it says | Section | Raised when |', '|---|---|---|---|---|');
  for (const c of catalog()) {
    L.push(`| ${c.severity} | ${c.title.replace(/\|/g, '/')} | ${c.detail.replace(/\|/g, '/')} | ${c.cite ?? ''} | ${c.when} |`);
  }

  h(2, '7. After signing: what the tool asks and warns');
  L.push('| Level | Prompt | What it says |', '|---|---|---|');
  for (const p of afterCatalog()) L.push(`| ${p.severity} | ${p.title.replace(/\|/g, '/')} | ${p.detail.replace(/\|/g, '/')} |`);

  h(2, '8. The signing guidance');
  L.push('Printed in the product and as a separate PDF. “Required by law” and “good practice” are kept apart; please check each is in the right column.', '');
  for (const part of GUIDE) {
    L.push(`**${part.heading}**`, '');
    part.steps.forEach((s) => L.push(`- _${s.kind === 'rule' ? `Required by law${s.cite ? ` (${s.cite})` : ''}` : 'Good practice'}._ **${s.text}** ${s.detail ?? ''}`));
    L.push('');
  }
  L.push('**You do not need**', '', ...NOT_NEEDED.map((t) => `- ${t}`), '', `_Closing note printed with the guide:_ ${GUIDE_CLOSING}`);

  h(2, '9. What the public page says');
  L.push('Published on the tool\'s page and in the site\'s machine-readable summary, only once this review is recorded. Every legal sentence is taken from §8 and the references in §10 rather than written again. Please check that none says more than the law does.', '');
  FAQ.forEach((f) => L.push(`**${f.q}**`, '', f.a, ''));

  h(2, '10. Statutory references the tool cites');
  L.push(...Object.entries(CITE).map(([k, v]) => `- \`${k}\`: ${v}`));

  h(2, '11. Sign-off');
  L.push(
    'I have read this packet, digest above, and answered §3. Subject to the corrections I have listed, I confirm that the rules, clauses and guidance in it are correct for the cases the tool accepts, and that the cases it turns away or cautions are the right ones.',
    '',
    '- Name: ____________________________',
    '- Enrolment number and bar council: ____________________________',
    '- Firm: ____________________________',
    '- Date: ____________________________',
    '- Corrections required (attach if needed): ____________________________',
    '- Signature: ____________________________',
    '',
  );
  return L.join('\n');
}
