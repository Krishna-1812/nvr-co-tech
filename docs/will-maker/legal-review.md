# Will Maker: legal review packet

**Packet digest: `71def5d4c3b281c7`**

Generated from the code (`npm run will:packet`); do not edit by hand. Rules last read against published sources on 2026-10-24. The digest covers these files, which carry every legal sentence the product says:

- `src/lib/will/law.ts`
- `src/lib/will/checks.ts`
- `src/lib/will/clauses.ts`
- `src/lib/will/document.ts`
- `src/lib/will/guide.ts`
- `src/lib/will/faq.ts`
- `src/lib/will/register.ts`

## 1. What you are being asked to do

Will Maker is a drafting aid for an Indian will. A person answers a short interview; the tool assembles a will from a fixed library of clauses (no text is generated, and nothing a person types becomes a clause), checks it against the rules below, and produces a print-ready PDF, an editable Word file and a signing guide. The person signs on paper with two witnesses. The tool does not give legal advice, does not file or register anything, and does not store a will on any server in readable form.

Please read this whole packet and answer §3. We are asking you to confirm, or to correct, each of the following: (a) that every statement of law below is right for the cases the tool accepts; (b) that the cases the tool turns away or cautions (§4) are the right ones; (c) that each clause (§5) does what it says and is safe to print for a person who has not seen a lawyer; (d) that the signing guidance (§8) is correct and complete; (e) that the questions and answers we publish on the public page (§9) are right and say nothing the guidance does not.

Anything you correct will be changed in the code and this packet regenerated. A sign-off applies to exactly the digest above; any later change to these files invalidates it and needs a fresh review.

## 2. How a sign-off is recorded

1. You send the owner a written sign-off that names this packet digest, with your name, enrolment number and firm.
2. The owner fills `SIGN_OFF` in `src/lib/will/signoff.ts` as `{ by, on, packet }`, with this digest. (That file is deliberately outside the digest, so recording the sign-off does not change what it signs.)
3. The build checks that the digest still matches the files. Change any of them and the build fails until a new packet is reviewed.
4. Even with a sign-off, the tool opens to the public only when the owner also turns on `NEXT_PUBLIC_WILL_MAKER=1`.

## 3. Questions that rest on your judgement

1. **fallback.** Is “to my heirs under the law that would have applied to me had I died without a will” the right last-resort gift for every religion in scope, and is it safe when the testator has no heirs?
   - Answer: _______________________________________________

2. **debts.** Is directing debts and funeral costs to come first out of “everything else” correct where a gifted asset carries a loan (a flat with a home loan)?
   - Answer: _______________________________________________

3. **guardian.** Is the guardian clause (conditional on the other parent not surviving) correct for each religion in scope, and for a testator with no spouse?
   - Answer: _______________________________________________

4. **digital.** Is authorising the executor to deal with online accounts enforceable against platform terms, or should the wording be softer?
   - Answer: _______________________________________________

5. **joint.** Is “my interest in” the right phrase for a jointly held asset, and should the draft say more where survivorship may apply?
   - Answer: _______________________________________________

6. **attestation.** Does the attestation wording satisfy s.63(c) as read with the Bharatiya Sakshya Adhiniyam, 2023 proof-of-execution provisions?
   - Answer: _______________________________________________

7. **identification.** Is the last four digits plus institution enough to identify an account in a will, or should the full number be the default?
   - Answer: _______________________________________________

8. **Probate.** One 2026 article states that the Repealing and Amending Act, 2025 omitted s.213 of the Indian Succession Act. We have not repeated it anywhere in the product because we could not verify it. Is it correct, and should the guidance say anything about probate?
   - Answer: _______________________________________________

9. **Electronic signatures.** The tool tells people a will is signed on paper, in ink, and that "an electronic or typed signature" is not how a will is signed. We understand wills fall outside the electronic signature provisions of the Information Technology Act, 2000 (First Schedule). Is that statement right?
   - Answer: _______________________________________________

## 4. Who the tool turns away, and who it cautions

The first step reads the answers and shows the reason in words. **Out** stops the interview. **Caution** lets it continue and keeps the reason on screen.

**Under 18** → **OUT**

> **Only an adult can make a will**
> A will can be made by a person of sound mind who is not a minor. At 14 the law does not let you make one yet.
> _Indian Succession Act, 1925, s.59_

**No date of birth** → **caution**

> **Add your date of birth**
> A will can only be made by an adult. We need your date of birth to confirm that and to say how old you are in the will.
> _Indian Succession Act, 1925, s.59_

**Religion: Hindu** → **no objection**

**Religion: Buddhist** → **no objection**

**Religion: Jain** → **no objection**

**Religion: Sikh** → **no objection**

**Religion: Christian** → **no objection**

**Religion: Parsi** → **no objection**

**Religion: Muslim** → **OUT**

> **Muslim personal law decides how much a will can give**
> The will provisions of the Indian Succession Act do not apply to a Muslim, and under the personal law the usual understanding is that no more than one-third of the estate can be left by will to anyone when there are heirs, unless the heirs agree after death. A questionnaire cannot work that out safely. Please see an advocate.
> _Indian Succession Act, 1925, s.58(1)_

**Religion: Other** → **caution**

> **Check your personal law with an advocate**
> This tool is built on the Indian Succession Act, which governs wills for most people who are not Muslim. If another personal law applies to you, have an advocate read the draft.

**Religion not given** → **caution**

> **Say which religion’s law applies to you**
> The rules on wills and on who inherits differ by religion. Choose one so we can tell whether this tool fits.

**State: Goa** → **OUT**

> **Goa has its own succession law**
> Goa follows the Portuguese Civil Code and its own succession statute, which reserve parts of an estate for certain heirs. This tool is not built for it. Please see an advocate in Goa.

**Ticked: "Someone who depends on me cannot manage money themselves"** → **caution**

> **A trust may suit a dependant better than a gift**
> A gift made directly to someone who cannot manage money, or who relies on benefits, can do them harm. A private trust is usually the safer way. An advocate can set one up; this tool cannot.

**Ticked: "I own a share in a business, partnership or company"** → **caution**

> **Business interests have their own rules**
> A partnership deed, a company’s articles or a shareholders’ agreement can limit who may take your share. Have an advocate or your company secretary check before you sign.

**Ticked: "I have children from more than one marriage"** → **caution**

> **Families from more than one marriage are where wills are most often challenged**
> Name everyone clearly, give each person’s share in numbers, and consider registering the will. An advocate’s read-through is worth it.

**Ticked: "I want to leave a close relative out"** → **caution**

> **Leaving a close relative out invites a challenge**
> You are free to do it in many cases, but how it is worded matters. Have an advocate look at the draft, and consider registering the will.

**Ticked: "I expect someone to challenge this will"** → **caution**

> **If you expect a challenge, register the will and use an advocate**
> Registration with the Sub-Registrar is optional, but it makes it much harder to say the will is a forgery or not the latest one.
> _Registration Act, 1908, s.18_

**Ticked: "I own property or accounts outside India"** → **caution**

> **Property outside India needs a will under that country’s law**
> This will can cover what you own in India. For property or accounts abroad, make a separate will in that country, so the two do not contradict each other.


## 5. The clause library

Every sentence the tool can write into a will. Names, addresses and descriptions are slotted into fixed sentences; the three free-text wishes (funeral, online accounts, pets) are printed under their own headings and are never merged into a clause. The worked example below uses invented names.

### The worked example, in full

```text
LAST WILL

I, Rohan Mehta, son of Suresh Mehta, aged about 48 years, Hindu by religion, consultant, living at 14 Example Lane, Sample Nagar, Pune 411001, make this will of my own free will, while of sound mind and not under pressure from anyone.

1. Earlier wills
I cancel every will and codicil I have made before this one.

2. My family
My spouse is Nisha Mehta.
My children are Aarav Mehta and Anaya Mehta.

3. My executor
I appoint Nisha Mehta (my spouse) as executor of this will.
If Nisha Mehta dies before me, or cannot or will not act, I appoint Kavita Rao (my sister), of 9 Sample Road, Mumbai 400001, as executor in that person’s place.

4. Debts and funeral costs
My executor is to pay my funeral costs, my debts and the cost of carrying out this will out of what I leave, before the property described under “Everything else” is shared.

5. Gifts of particular things
I make these gifts. Each item is described in the Schedule at the end of this will.
(a) I give item 1 of the Schedule (Flat in Pune) to Nisha Mehta (my spouse). If Nisha Mehta does not survive me, I give it to Aarav Mehta (my son).
(b) I give item 2 of the Schedule (State Bank of India savings account) to Nisha Mehta (my spouse). If Nisha Mehta does not survive me, I give it to Kavita Rao (my sister).
(c) I give item 3 of the Schedule (Mutual fund folio) to the following people, in these shares: Aarav Mehta (50%) and Anaya Mehta (50%). If Aarav Mehta does not survive me, that share goes to Anaya Mehta (my daughter). If Anaya Mehta does not survive me, that share goes to Aarav Mehta (my son).

6. Everything else
I give everything else I own, of every kind and wherever it is, including anything I get after I sign this will and any gift above that cannot take effect, to Nisha Mehta (my spouse).
If Nisha Mehta does not survive me, I give it to Kavita Rao (my sister).

7. If nobody can take
If none of the people named under “Everything else” can take, I give that property to my heirs, in the shares the law that applies to me would give them had I died without a will.

8. Guardian for my children
If, when I die, a child of mine is under 18 and the child’s other parent has not survived me, I appoint Kavita Rao (my sister), of 9 Sample Road, Mumbai 400001, as the child’s guardian.

9. How to read this will
A person named as executor or guardian includes the person named in that person’s place. Headings are for ease of reading and do not change what a clause means. If any part of this will cannot be carried out, the rest still stands.

SCHEDULE

1. Flat in Pune (Property): Flat 402, Example Heights, Sample Road, Pune 411001, area 1,050 sq ft carpet, sale deed no. 1234/2019. The whole.
2. State Bank of India savings account (Bank account): State Bank of India, no. ending 8901, Sample Nagar branch. The whole.
3. Mutual fund folio (Shares, funds and bonds): Sample Asset Management, no. ending 8776. The whole.
4. Life policy (Insurance policy): Sample Life Insurance, no. ending 0987. The whole.

Signed by me, Rohan Mehta, at Pune on 24 October 2026, as my last will, in front of the two witnesses named below, who have each signed in my presence.

Signature: ______________________
Rohan Mehta

We each saw Rohan Mehta sign this will, or received from that person a personal acknowledgement of their signature. We have each signed below as a witness, in that person’s presence.

Witness 1: Dev Kulkarni
Address: 21 Example Society, Pune 411002
Signature: ______________________

Witness 2: Smita Joshi
Address: 5 Sample Colony, Pune 411003
Signature: ______________________
```

### Variants: a share of a shared asset, a joint holding, three executors, wishes, no “pay debts” clause, no “everything else”

```text
LAST WILL

I, Rohan Mehta, son of Suresh Mehta, aged about 48 years, Hindu by religion, consultant, living at 14 Example Lane, Sample Nagar, Pune 411001, make this will of my own free will, while of sound mind and not under pressure from anyone.

1. Earlier wills
I cancel every will and codicil I have made before this one.

2. My family
My spouse is Nisha Mehta.
My children are Aarav Mehta and Anaya Mehta.

3. My executor
I appoint Nisha Mehta (my spouse) as executor of this will.
If Nisha Mehta dies before me, or cannot or will not act, I appoint Kavita Rao (my sister), of 9 Sample Road, Mumbai 400001, as executor in that person’s place.
If Kavita Rao dies before me, or cannot or will not act, I appoint Dev Kulkarni (my friend), of 21 Example Society, Pune 411002, as executor in that person’s place.

4. Gifts of particular things
I make these gifts. Each item is described in the Schedule at the end of this will.
(a) I give my 50% share in item 1 of the Schedule (Flat in Pune) to Nisha Mehta (my spouse). If Nisha Mehta does not survive me, I give it to Aarav Mehta (my son).
(b) I give my interest in item 2 of the Schedule (State Bank of India savings account) to Nisha Mehta (my spouse). If Nisha Mehta does not survive me, I give it to Kavita Rao (my sister).
(c) I give item 3 of the Schedule (Mutual fund folio) to the following people, in these shares: Aarav Mehta (50%) and Anaya Mehta (50%). If Aarav Mehta does not survive me, that share goes to Anaya Mehta (my daughter). If Anaya Mehta does not survive me, that share goes to Aarav Mehta (my son).

5. Guardian for my children
If, when I die, a child of mine is under 18 and the child’s other parent has not survived me, I appoint Kavita Rao (my sister), of 9 Sample Road, Mumbai 400001, as the child’s guardian.

6. My wishes for my funeral
These are my wishes. I ask my family to follow them; carrying out this will does not wait on them.
(the person’s wish, printed as typed)

7. My online accounts
I authorise my executor to deal with, close or pass on my online accounts, as set out below, as far as the law and the providers allow.
(the person’s wish, printed as typed)

8. My pets
This is what I want for my pets. I ask my family to follow it.
(the person’s wish, printed as typed)

9. How to read this will
A person named as executor or guardian includes the person named in that person’s place. Headings are for ease of reading and do not change what a clause means. If any part of this will cannot be carried out, the rest still stands.

SCHEDULE

1. Flat in Pune (Property): Flat 402, Example Heights, Sample Road, Pune 411001, area 1,050 sq ft carpet, sale deed no. 1234/2019. My 50% share.
2. State Bank of India savings account (Bank account): State Bank of India, no. ending 8901, Sample Nagar branch. My interest.
3. Mutual fund folio (Shares, funds and bonds): Sample Asset Management, no. ending 8776. The whole.
4. Life policy (Insurance policy): Sample Life Insurance, no. ending 0987. The whole.

Signed by me, Rohan Mehta, at Pune on 24 October 2026, as my last will, in front of the two witnesses named below, who have each signed in my presence.

Signature: ______________________
Rohan Mehta

We each saw Rohan Mehta sign this will, or received from that person a personal acknowledgement of their signature. We have each signed below as a witness, in that person’s presence.

Witness 1: Dev Kulkarni
Address: 21 Example Society, Pune 411002
Signature: ______________________

Witness 2: Smita Joshi
Address: 5 Sample Colony, Pune 411003
Signature: ______________________
```

## 6. Every check the tool makes before a will is final

**Act on this** holds the final copy (every file is marked DRAFT while one stands). **Review** and **Good to know** never block. The right-hand column is the situation that raises it.

| Level | Check | What it says | Section | Raised when |
|---|---|---|---|---|
| act | Confirm you are making this will freely | A will made under pressure, fraud or undue influence can be set aside. Tick it only if it is true. |  | no name, declarations unticked |
| act | Confirm you are of sound mind | A will is valid only if the person making it understands what they are doing. The draft says you are; tick it only if it is true. | Indian Succession Act, 1925, s.59 | no name, declarations unticked |
| act | An executor is not on your list | Choose the executor again. |  | an executor and a guardian not on the list |
| act | The backup for Flat in Pune is not on your list | Choose the backup again or remove it. |  | a backup who is not on the list |
| act | Who gets Flat in Pune? | This gift has no one to receive it. |  | a gift to nobody, and to someone not listed |
| act | A gift refers to an asset that is no longer listed | Remove the gift or add the asset back. |  | a gift of an asset that was removed |
| act | Choose who gets State Bank of India savings account | A share points at someone who is not on your list. |  | a gift to nobody, and to someone not listed |
| act | Shares of Mutual fund folio add up to 90% | The shares of one gift must add up to exactly 100%. Anything short is not given by this clause; anything over cannot be given. |  | a gift that does not add up |
| act | Flat in Pune is given more than once | Each asset can have one gift. To split it, give it in shares to more than one person. |  | an asset given twice |
| act | A guardian is not on your list | Choose the guardian again. |  | an executor and a guardian not on the list |
| act | A backup is not on your list | Choose the backup again or remove it. |  | a residue recipient and backup not on the list |
| act | Say who gets everything else | Anything the will does not give by name, including what you buy after signing, would pass under the law of succession as if there were no will for that part. Naming people here is the single most useful clause in a will. |  | no residue |
| act | Choose who gets this share | A share points at someone who is not on your list. |  | a residue recipient and backup not on the list |
| act | Shares of everything else add up to 110% | They must add up to exactly 100%. |  | residue that does not add up |
| act | Goa has its own succession law | Goa follows the Portuguese Civil Code and its own succession statute, which reserve parts of an estate for certain heirs. This tool is not built for it. Please see an advocate in Goa. |  | Goa |
| act | Only an adult can make a will | A will can be made by a person of sound mind who is not a minor. At 14 the law does not let you make one yet. | Indian Succession Act, 1925, s.59 | a minor |
| act | Muslim personal law decides how much a will can give | The will provisions of the Indian Succession Act do not apply to a Muslim, and under the personal law the usual understanding is that no more than one-third of the estate can be left by will to anyone when there are heirs, unless the heirs agree after death. A questionnaire cannot work that out safely. Please see an advocate. | Indian Succession Act, 1925, s.58(1) | Muslim |
| act | Add your full name | The will opens with the name of the person making it, as it appears on your identity documents. |  | no name, declarations unticked |
| act | Dev Kulkarni is a witness and also receives a gift | A gift to a person who witnesses the will (or to their spouse) is void. Choose someone else as witness: a friend or colleague who gets nothing, ideally younger than you. | Indian Succession Act, 1925, s.67 | witness who also receives a gift |
| review | Some account is hard to identify | Say where it is held or what it is, in a few words: the bank and account number, the address, the folio. An executor has to be able to find it. |  | an asset described by nothing |
| review | Name an executor | An executor is the person who carries out the will. It is not compulsory, but without one, your family must apply to a court to be given the power to act. |  | no executor / one executor |
| review | The backup for Flat in Pune is the same person | If that person dies before you, the backup needs to be someone else. |  | a backup that is the same person |
| review | Name a guardian for a child under 18 | Aarav Mehta, Anaya Mehta are under 18. If you and the child’s other parent were both gone, nobody has been named to look after them or their money. | Hindu Minority and Guardianship Act, 1956, s.9 | a minor child and no guardian |
| review | Nisha Mehta is on your list twice | Two people with the same name make it unclear who is meant. If they are different people, add something that tells them apart (a middle name, a date of birth). If it is one person, remove the extra. |  | a person with no name, and a duplicate |
| review | Name your brother | Someone on your list has no name yet. A will that names “my son” without a name leaves room for argument. |  | a person with no name, and a duplicate |
| review | Property outside India needs a will under that country’s law | This will can cover what you own in India. For property or accounts abroad, make a separate will in that country, so the two do not contradict each other. |  | every circumstance ticked |
| review | Business interests have their own rules | A partnership deed, a company’s articles or a shareholders’ agreement can limit who may take your share. Have an advocate or your company secretary check before you sign. |  | every circumstance ticked |
| review | If you expect a challenge, register the will and use an advocate | Registration with the Sub-Registrar is optional, but it makes it much harder to say the will is a forgery or not the latest one. | Registration Act, 1908, s.18 | every circumstance ticked |
| review | Leaving a close relative out invites a challenge | You are free to do it in many cases, but how it is worded matters. Have an advocate look at the draft, and consider registering the will. |  | every circumstance ticked |
| review | Say which religion’s law applies to you | The rules on wills and on who inherits differ by religion. Choose one so we can tell whether this tool fits. |  | religion not given |
| review | Families from more than one marriage are where wills are most often challenged | Name everyone clearly, give each person’s share in numbers, and consider registering the will. An advocate’s read-through is worth it. |  | every circumstance ticked |
| review | A trust may suit a dependant better than a gift | A gift made directly to someone who cannot manage money, or who relies on benefits, can do them harm. A private trust is usually the safer way. An advocate can set one up; this tool cannot. |  | every circumstance ticked |
| review | Nisha Mehta is not given anything | Your spouse is on your list but receives nothing under this will. If that is deliberate, have an advocate read the draft before you sign. |  | spouse given nothing |
| review | Add your address | The will says where you live. It helps whoever reads it tell you from someone with the same name. |  | no name, declarations unticked |
| review | Only 1 witness named | At least 2 are needed. Name another, or leave the second line blank to fill in at signing. | Indian Succession Act, 1925, s.63(c) | one witness, then none |
| note | Life policy usually follows its nomination | Money from a policy or a provident fund normally goes to the nominee or beneficiary named with the provider. Make sure that nomination matches what you want. |  | no name, declarations unticked |
| note | Flat in Pune is shared | A will can pass only your own share, and how a jointly held asset passes after death depends on how it is held. The will here gives your share; check the rest with the bank, the registrar or an advocate. |  | a shared asset |
| note | Name a second executor in case the first cannot act | If the only executor dies before you or will not act, the family is back to asking a court. |  | an executor and a guardian not on the list |
| note | The nominee on Mutual fund folio is not who you give it to | The provider lists Nisha Mehta as nominee. A nominee often receives the money on behalf of the legal heirs rather than keeping it, but the difference causes arguments. Decide on purpose, and change the nomination if you want them to match. |  | no name, declarations unticked |
| note | A gift to a child under 18 is managed by someone else until they come of age | A minor cannot manage property. Money and property given to one is usually looked after by a guardian. For larger gifts, an advocate can arrange a trust. |  | no name, declarations unticked |
| note | No assets listed | You can still make a will without listing anything: the “everything else” clause covers all you own. Listing what you have lets you give particular things to particular people. |  | no assets |
| note | 1 share has no backup | If a person dies before you, their gift falls back into “everything else” and goes to the people named there. A backup says who should have it instead. | Indian Succession Act, 1925, s.105 | an asset given twice |
| note | Place and date | Leave them blank to write by hand when you sign. The date matters if there is ever more than one will: the latest one counts. | Indian Succession Act, 1925, s.63(a)–(b) | no place or date |
| note | 1 of 4 assets are not given by name | They fall into “everything else” and go to the people you name there. That is fine if it is what you want. |  | no name, declarations unticked |
| note | Two witnesses will sign with you | The will must be witnessed by at least 2 people who see you sign. You can name them now, or leave the lines blank and fill them in at signing. | Indian Succession Act, 1925, s.63(c) | no witnesses named |

## 7. After signing: what the tool asks and warns

| Level | Prompt | What it says |
|---|---|---|
| review | Aarav Mehta (son) is in your household but not in your will | If that is deliberate, nothing to do. If not, add them on the People step and decide what they should receive. |
| review | The nominee on State Bank of India savings account changed in Wealth Tracker | Your will was drafted with a different nominee on record. A nominee often receives on behalf of the legal heirs rather than keeping it, but check the will and the nomination still agree. |
| review | You chose today or earlier to read this will again | Read it as it stands, check it against what you own and who you love now, and set the next date. |
| review | The signed date is not a date | Enter the day you signed. |
| review | The signed date is in the future | Enter the day you actually signed, once you have signed. |
| review | You recorded this will as signed, but the draft here still has things to fix | The signed paper is the will, not this screen. If the paper differs from this draft, either the paper stands as it is or you make a new will. Do not alter a signed will by hand. |
| review | Tell your executor where the will is | An executor who does not know there is a will, or where it is, cannot act on it. Tick it once they know. |
| review | 1 thing in your will is no longer in Wealth Tracker | Flat / apartment. Sold, closed or deleted? A gift of something you no longer own does nothing, and the person meant to receive it gets nothing in its place. |
| review | 1 thing in Wealth Tracker is not in your will | jewellery. Anything not listed still passes under “everything else”, but check that is what you want. Add them on the “What you own” step. |
| review | Say where the signed original is kept | Only the signed original counts. If your family cannot find it, they may have to treat you as having made no will. |
| note | Everyone you named a guardian for is now an adult | The guardian clause may no longer be needed. It does no harm, but a new will can drop it. |
| note | Note where it was registered | The office and the registration number help your executor ask for a certified copy. |
| note | Choose a date to read it again | A date you will see in this record is easier to keep than a promise to remember. |
| note | Your review date is in 17 days | A good time to open Wealth Tracker and see what has changed. |
| note | Not signed yet | Once you have signed, come back and enter the date. Then you can record where the original is kept and who has been told. |

## 8. The signing guidance

Printed in the product and as a separate PDF. “Required by law” and “good practice” are kept apart; please check each is in the right column.

**Before you sign**

- _Good practice._ **Read every page once more.** If anything is wrong, change it in Will Maker and print the whole will again. Never correct a printed page by hand.
- _Good practice._ **Check that every page shows the same reference and “Page x of y”.** The reference is at the foot of each page. If you change anything, print every page again so they all match.
- _Required by law (Indian Succession Act, 1925, s.67)._ **Choose 2 witnesses.** Adults who will see you sign. They must not receive anything under the will, and must not be married to someone who does. It helps if they are younger than you, and are not your executor or close family.

**On the day**

- _Good practice._ **Sign with both witnesses in the room, in one sitting.** The law does not require the witnesses to be there at the same time, but one sitting is simplest and leaves the least to explain later.
- _Good practice._ **Initial each page at the foot, in ink.** Keep the pages fastened together.
- _Required by law (Indian Succession Act, 1925, s.63(a)–(b))._ **Sign at the end of the will, on paper, in ink.** Sign where the will says, with your usual signature. Write the place and the date if they are blank.
- _Required by law (Indian Succession Act, 1925, s.63(c))._ **Each witness signs in front of you.** They must each have seen you sign, or have heard you say the signature is yours. They then sign the attestation block, writing their name and address.

**After you sign**

- _Good practice._ **Keep the signed original somewhere safe, and tell your executor where it is.** Only the signed original counts. Photocopies are for reference. Choose a place your executor can reach without waiting on anyone.
- _Good practice._ **Consider registering it.** Registration with the Sub-Registrar is optional (Registration Act, 1908, s.18). It means going to the office with both witnesses, and it makes the will harder to dispute. The fee depends on the state.
- _Good practice._ **Make a new will when your life changes.** Marriage, children, a death, a new property or a closed loan can all make a will out of date. Never write changes on a signed will: make a new one, or ask an advocate for a codicil.

**You do not need**

- Stamp paper. A will carries no stamp duty.
- A notary. A will is valid without one.
- An electronic or typed signature. A will is signed on paper, in ink.

_Closing note printed with the guide:_ This guide describes what the Indian Succession Act asks and some ordinary good practice. It is not legal advice. If your family, your property or your wishes are out of the ordinary, ask an advocate to read the will before you sign.

## 9. What the public page says

Published on the tool's page and in the site's machine-readable summary, only once this review is recorded. Every legal sentence is taken from §8 and the references in §10 rather than written again. Please check that none says more than the law does.

**Is a will made with Will Maker valid?**

It becomes a will when you sign it at the end, on paper, in ink, and 2 witnesses each sign in your presence (Indian Succession Act, 1925, s.63(a)–(b); Indian Succession Act, 1925, s.63(c)). Until then it is a draft. Will Maker writes the document and shows you how to sign it. It cannot make it valid for you, and it is not a substitute for an advocate if your affairs are out of the ordinary.

**Do I need stamp paper?**

No. A will carries no stamp duty.

**Do I need a notary?**

No. A will is valid without one.

**Do I have to register my will?**

No. Registration with the Sub-Registrar is optional (Registration Act, 1908, s.18). It means going to the office with both witnesses, and it makes the will harder to dispute. The fee depends on the state.

**Who can be my witness?**

Choose 2 witnesses. Adults who will see you sign. They must not receive anything under the will, and must not be married to someone who does. It helps if they are younger than you, and are not your executor or close family. They must each have seen you sign, or have heard you say the signature is yours. They then sign the attestation block, writing their name and address. (Indian Succession Act, 1925, s.67; Indian Succession Act, 1925, s.63(c)).

**Can I sign my will electronically?**

No. A will is signed on paper, in ink. The law on electronic signatures lists wills among the documents it does not cover (Information Technology Act, 2000, First Schedule).

**Who is Will Maker for?**

Adults of sound mind (18 or over) writing their own will, who are not Muslim and do not live in Goa, and whose families and property are ordinary. Muslim personal law limits what a will can give (Indian Succession Act, 1925, s.58(1)), Goa has its own rules, and a questionnaire cannot work either out safely, so Will Maker turns those cases away and says so. If something in your situation is out of the ordinary, it tells you to ask an advocate.

**Does anyone read my will?**

No. It is written in your browser and kept there, and Will Maker sends it nowhere. If you sign in and lock it with a passcode, an encrypted copy is saved to your account that we cannot read, and a forgotten passcode cannot be recovered. Keep a backup file.

**What if my life changes after I sign?**

Marriage, children, a death, a new property or a closed loan can all make a will out of date. Never write changes on a signed will: make a new one, or ask an advocate for a codicil.


## 10. Statutory references the tool cites

- `whoMayMake`: Indian Succession Act, 1925, s.59
- `signing`: Indian Succession Act, 1925, s.63(a)–(b)
- `witnesses`: Indian Succession Act, 1925, s.63(c)
- `witnessGift`: Indian Succession Act, 1925, s.67
- `revocation`: Indian Succession Act, 1925, s.70
- `wording`: Indian Succession Act, 1925, s.74
- `lapse`: Indian Succession Act, 1925, s.105
- `muslims`: Indian Succession Act, 1925, s.58(1)
- `registration`: Registration Act, 1908, s.18
- `noEsign`: Information Technology Act, 2000, First Schedule
- `guardian`: Hindu Minority and Guardianship Act, 1956, s.9

## 11. Sign-off

I have read this packet, digest above, and answered §3. Subject to the corrections I have listed, I confirm that the rules, clauses and guidance in it are correct for the cases the tool accepts, and that the cases it turns away or cautions are the right ones.

- Name: ____________________________
- Enrolment number and bar council: ____________________________
- Firm: ____________________________
- Date: ____________________________
- Corrections required (attach if needed): ____________________________
- Signature: ____________________________
