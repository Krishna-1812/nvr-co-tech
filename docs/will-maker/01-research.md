# Will Maker — research

*24 October 2026. Written for the owner and for whoever builds this next. Companion to
`02-plan.md`. Every claim below is tagged with where it came from; anything I could not confirm
from a primary source is marked **(unverified)**.*

## 1. What WillJini is

WillJini Succession Services Pvt. Ltd. (Mumbai; offices in Delhi, Noida, Bengaluru) is a
**succession-services business with a self-serve will wizard on top**. It is not primarily a
software company: the wizard is the cheap front door; the money is in lawyer-drafted wills,
registration, trusts, probate and the bank channels that sell it.

| Fact | Source |
|---|---|
| Started 2013/14 when co-founder Jatin Popat (a lawyer / company secretary) began treating CEOs' requests for wills as a business. Co-founders Jugal Popat (ex-Swiggy, SPJIMR MBA, full-time since 2022), Rahul Shah, Jatin Popat | willjini.com/press |
| "20,000+ customers, 480 cities, 32 countries, 12+ years" (the homepage counters show different, smaller numbers; the press page is the newer claim) | willjini.com/press, /about-us |
| First external round (Oct 2026), US$3.5M post-money, from SPJIMR batchmates, five wealth-management companies, friends and channel partners; no VC. Monthly revenue grew from ~₹3 lakh to ~₹50 lakh while bootstrapped. Funds go to advisory team, sales, technology, new geographies | willjini.com/press (their own press release; treat as a company claim) |
| **Distribution is the moat**: HDFC Group tie-up (2015), 10 more institutions (2017), "Express Will" launched 2018 (15-minute online will), BCG/HPCL employee programmes (2019), Tata AIA, Union Bank, Muthoot bulk-buy and bundle wills with their products (2021). Press page lists HDFC Group, Tata Group, Yes Group, IIFL, Incred Wealth as partners | willjini.com/about-us, /press |
| Reviews: "500+ Google reviews" on the homepage | willjini.com |

## 2. Product catalogue

All prices ₹, **+ GST**, from `willjini.com/pricing-and-packages` (checked 24 Oct 2026; a "Diwali
offer" ends 8 Nov, so list prices will move). Third-party sources quote older numbers (₹1,500–20,000
range, ₹4,000 in 2016, ₹4,999 / ₹7,499 on a distributor page); the site is the authority.

| Product | What it is | Price (offer / "list") |
|---|---|---|
| **Legal Will, online (DIY)** | Self-serve wizard, "60 mins", "detailed mention of all assets", save and resume. Output is a **Word file by email** to print and sign | ₹7,499 / ₹10,000 |
| Customized Will | Lawyer-drafted, single point of contact, video/audio calls, multiple drafts | ₹14,999 / ₹20,000 |
| Joint Will / Mirror Will (couples) | Lawyer-drafted; mirror = two reciprocal wills | ₹19,999 / ₹30,000 each |
| Signature Will | Lawyer-drafted premium (page exists; price not on the pricing page) | not published |
| Private Family Trust | New legal entity; "no probate after demise"; recommended for business owners, NRIs, Muslims, special-needs children, divorce cases | from ₹2,00,000 / ₹2,50,000 |
| Value-added | Will custody (their vault), executorship (they act as executor), business succession, door-step consultation | from ₹1,999 |
| Post-death legalities | Succession certificate, probate, legal-heir certificate, inheritance assistance, family settlement, litigation support, property transfer | from ₹24,999 |
| Other deeds | Gift deed, power of attorney (incl. vetting), HUF, relinquishment/release deed | enquiry |
| Will registration | Visit to the Sub-Registrar with two witnesses; sold as a service | enquiry |

Homepage plan cards say: "All plans come with a personal lawyer whom you can reach by calls,
emails or WhatsApp."

## 3. How the online will is made (the wizard)

Found by reading the public site and the public JavaScript of `app.willjini.com` (page text,
route names, enum labels). I did not log in or call any API. The wizard has **nine steps**, each
labelled with a time estimate:

1. **Get started** (2 min) — accept terms; declare sound mind.
2. **Your details** (3) — identity, marital status, occupation, religion, residence. Religion options include Parsi, Indian Christian, Sikh, Jain, Buddhist, Muslim. ID types: Aadhaar, Driving Licence, Passport, OCI. Occupation: salaried, self-employed, homemaker, retired.
3. **Your loved ones** (3) — people with a relation type: Spouse, Children, Grandchildren, Others, Executor, Backup Executor, Witness, Guardian (+ parents/siblings on the family side).
4. **Assets and liabilities** (3) — pick which of ~25 asset types you have, then fill each: business assets (sole proprietorship / partnership / company / LLP), insurance (life, health, vehicle), bank accounts, FDs, demat, mutual funds, bonds, physical shares, PMS, safe-deposit lockers, jewellery, PF, post-office deposits, company PF, gratuity, pension, vehicles, personal loans given, electronics, digital assets (Google / Yahoo / social / online drives), IP (patents / domains / copyrights), HUF coparcenary, pets, cash, other; **real estate** (flat, bungalow, row house, plot, land, shop, office, warehouse, factory; area units incl. sq. m, cent, guntha, acres); **liabilities** (home loan, vehicle loan, credit card). Assets can be marked "non-disclosed".
5. **Distribution** (3) — asset-wise beneficiaries *and* a "residual assets" split that must total 100%.
6. **Additional clauses** (3) — includes "alternate beneficiaries" (skippable).
7. **Executors** (3) — executor and backup; an option to name **WillJini itself as backup executor** (an upsell).
8. **Review & Submit** (3).
9. **Draft & Generate Will** (3) — preview, then generate within 60 days; Word document by email.

Terms of use (willjini.com/terms-of-use) add the operating limits that shape the product:

- The DIY app **keeps your data until the will is generated or 60 days from payment, whichever is
  earlier, then erases it**; they say they cannot retrieve a generated will. (Privacy by deletion.)
- Refund only if you cannot generate/print/save due to a technical fault, within 48 hours; none once
  the will is generated.
- **Not suitable for Muslims** (personal law limits; they point such users to a trust). Foreign
  assets: make a separate will abroad "at your own risk".
- Explicit "not legal advice"; no guarantee the law is current.
- No scrapers/robots; copy for personal use only. *So: write our own clauses; copy nothing.*

## 4. How it is built (inferred from public signals)

| Layer | Observation |
|---|---|
| Marketing site | **WordPress** (Elementor-style builder with "ThePlus" add-ons, LiteSpeed cache, Gravity-style enquiry forms, Google Tag Manager, `wp-json` open). Content marketing: long, lawyer-reviewed explainer posts ("Legally reviewed by Jatin S. Popat… last updated…") with statute citations, state-wise registration guides (Mumbai, Bangalore), FAQ and videos. This is their SEO engine |
| Will app | **Next.js (App Router, Turbopack)** at `app.willjini.com`; Tailwind; Playfair Display + Manrope; client state in a Zustand store; REST-style API (`/api/register`, `/api/otp/verify`, `/api/wills`, `/api/wills/quote`, `/api/wills/buy`, `/api/wills/generate-draft`, `/api/wills/generate-will`, `/api/assets`, `/api/relations`, `/api/orders`, `/api/billing/*`) |
| Identity | Phone + email registration with **OTP verification** |
| Payments | **Razorpay**. Product codes `ONLINE_WILL`, `WILL_PROTECTION_PLAN` (a **subscription** you can cancel/resume), `SAFE_CUSTODY`, `WILL_REGISTRATION` (add-ons) — i.e. recurring revenue on top of the one-off will |
| Security headers | Strict CSP, HSTS preload, frame-ancestors none. Competent baseline |
| Document | Template-driven generation server-side, delivered as `.docx` (editable, so a lawyer can finish it). Signed-URL download endpoint |
| Review | Lawyers vet online drafts only in the paid-up assisted tiers; the DIY tier is a questionnaire → template |

There is **no AI** visible in the DIY flow. It is a deterministic questionnaire, which is the right
design for a legal document (see §7).

## 5. How they charge

1. DIY will, one-off: ₹7,499 + GST (list ₹10,000, perpetual "offer").
2. Assisted wills: ₹14,999–19,999 + GST.
3. Premium: trusts from ₹2 lakh; post-death services from ₹24,999.
4. Recurring: **Will Protection Plan** subscription, safe custody and executorship.
5. **B2B2C**: banks/insurers/wealth platforms buy wills in bulk and bundle them with their products;
   wealth managers are now also shareholders. This, not the website, is where volume comes from.
6. Partner programme (willjini.com/partner-with-us) for referrers.

## 6. Similar companies

Prices from a September 2026 comparison on setindiabiz.com (provider-published, may exclude GST /
state-specific charges) unless noted. **(unverified)** means I could not open the provider's own
page from this environment.

| Company | Offer | Notes |
|---|---|---|
| **Yellow** | ₹2,499; Pro ₹3,999; Elite ₹5,999; custom on request | Tiered DIY → assisted |
| **KustodianLife** | DIY ₹499 + optional expert consult | Cheapest DIY **(unverified)** |
| **AasaanWill** (AssetVault) | No DIY; notarised ₹4,999; registered ₹19,999; premium ₹29,999 | Founded for Indians + diaspora; registration-led; blockchain/AI story in press **(unverified)** |
| **Quikdox** | "100% automated, no calls, instant digital delivery"; Premium/On-behalf/Joint wills (2023) | No price found **(unverified)** |
| **Vakilsearch, LegalKart, ezyLegal, GetWills, law-firm portals** | Questionnaire-based; ~₹3,000–8,000 typical for a straightforward will, ₹10,000–25,000+ with trusts/business | Guides quote bands, not live prices |
| Lawyer-drafted offline | ₹15,000–50,000+ in tier-1 cities | |

**Market shape:** DIY ₹499–₹7,499; registered/assisted ₹5,000–₹20,000; trusts ₹2 lakh+. Everyone
sells the same document; they differ on *who reviews it* and *who helps you sign, register, store
and execute it*.

## 7. What the law actually requires (what a tool must get right)

Cross-checked between WillJini's own legally-reviewed explainer and the setindiabiz guide; **all of
this needs sign-off from an Indian advocate before launch** (see plan, Phase 5).

- **No prescribed format** (Indian Succession Act 1925, s.74). A will needs: a testator of sound
  mind who is not a minor (s.59); a signature placed to give effect to the writing (s.63(a)/(b));
  **two or more attesting witnesses**, each signing in the testator's presence (s.63(c)); witnesses
  need not sign together.
- **Wet-ink signing is the only safe route.** The IT Act 2000's First Schedule excludes wills from
  electronic records and signatures (I am confident of this, but counsel should confirm). So a
  "digital will" product is really *prepare online → print → sign with witnesses*.
- **Witness who is also a beneficiary is a trap** (s.67: a gift to an attesting witness or their
  spouse is void). Their FAQ says to avoid it. A tool can detect this exactly.
- **Stamp duty: none.** Registration is optional (Registration Act 1908, s.18) but makes a will
  harder to dispute; fee varies by state (e.g. ₹600 in Delhi per setindiabiz).
- **If a beneficiary dies first the gift lapses into the residue** (s.105) unless an alternate is named.
  Residuary clause + alternates are the highest-value drafting features.
- **Religion matters.** Muslims: the Succession Act's will provisions do not apply (s.58); the
  accepted rule is a **one-third cap** without heirs' consent. Goa has a separate forced-heirship
  regime **(confirm with counsel)**. Hindu joint-family (coparcenary) interest can be willed, but
  only the testator's own share.
- **Nominee ≠ owner.** A nominee often receives on behalf of legal heirs; a will and nominations
  should agree. (This is the overlap with our Wealth Tracker nominee check.)
- Probate: one 2026 article says the Repealing and Amending Act 2025 omitted s.213 of the Succession
  Act **(unverified; check the Gazette)**. Do not repeat it in product copy until verified.
- Foreign assets need a separate local will; NRIs with Indian assets are in scope.

## 8. Where they are strong, where we can be different

| Their strength | Our answer |
|---|---|
| Lawyers on staff, brand trust, bank channels | We cannot copy this fast. Partner with advocates for the assisted layer; start with the CA/finance audience we already serve |
| Mature SEO library | Write our own, shorter, accurate explainers (the site already has long-form content infrastructure) |
| Subscription & custody revenue | Phase 4 — but start with free safekeeping *pointers*, not custody of originals |

| Their gap | Our edge |
|---|---|
| The asset inventory is retyped from scratch (60 minutes) | **Pre-fill from Wealth Tracker** — we already hold the person's accounts, policies, property and nominees. A will in minutes, not an hour |
| Data deleted after 60 days; no living record, no reminder when life changes | A will that stays attached to a living record: nominee-vs-will mismatch checks, "your will names an executor who…" prompts, review reminders |
| Wizard is a form → template | **Readiness checks** (witness is a beneficiary, shares ≠ 100%, minor beneficiary with no guardian, lapse risk) with a plain reason and the section number |
| Word file emailed, then you are alone | Print-ready PDF + editable DOCX, a signing-day checklist, witness block, "where is the original kept" and "who must know" captured |
| Muslims excluded entirely | Honest, specific guidance (one-third rule) and a clear "see an advocate" hand-off, rather than silence |
| Opaque account creation (OTP) before value | Same as our other tools: **useful with no account**, runs in the browser, optional passcode encryption already built (`lock.ts`) |

## 9. Risks to design around

1. **Unauthorised practice / liability.** A will is a legal instrument. The product must say what it
   is (a drafting aid built on the statute, not legal advice), refuse out-of-scope cases rather than
   guess, and have an advocate review the clause library before launch.
2. **Copyright.** Their terms reserve their content and software. Our clauses are written from the
   statute and general practice, independently.
3. **Privacy.** A will plus an asset list is among the most sensitive documents a person has. Keep
   the browser-first model; never log will content; account sync only as ciphertext when a passcode
   is set (the existing `tool_saves` pattern). DPDP Act 2023 duties apply once we hold personal data
   server-side.
4. **Wrong law = a void gift.** Every rule in the engine ships with a citation in the code and a
   test. Rules that are not certain are `note`-level, never silent.
5. **Brand.** Our audience is chartered accountants and their clients; "accuracy in copy is a
   correctness concern" (HANDOFF §1). A will tool that overclaims would damage the whole site.

## Sources

- WillJini — [home](https://www.willjini.com/), [pricing](https://www.willjini.com/pricing-and-packages/), [detailed will](https://www.willjini.com/services/detailed-will-online-in-india/), [about](https://www.willjini.com/about-us/), [press](https://www.willjini.com/press/), [terms of use](https://www.willjini.com/terms-of-use/), [will custodianship](https://www.willjini.com/services/will-custodianship/), [will format guide](https://www.willjini.com/blog/will-format-india/), [app](https://app.willjini.com/registration) (public pages and public scripts only).
- [Online Will in India: Costs, Legal Validity and Key Considerations — SetIndiaBiz](https://www.setindiabiz.com/?p=26260)
- [Will Writing in India 2026 — RetireWise](https://retirewise.in/affordable-online-will-writing-services)
- [WillJini on Stanford Legal Tech Index](https://techindex.law.stanford.edu/companies/willjini), [The News Minute profile](https://www.thenewsminute.com/article/where-there-will-chennai-legal-startup-helps-customers-draft-document-minutes-72643), [Yesinvest listing](https://yesinvest.in/alternate-investment-solutions/willjini), [Muthoot Securities iWill release](https://www.muthootfinance.com/news-board/now-make-your-will-online-with-muthoot-securities-in-just-30-minutes) (search snippets only; those hosts did not open from this environment).
