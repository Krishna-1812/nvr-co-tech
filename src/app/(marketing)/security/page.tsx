import type { Metadata } from 'next';
import { Check, Lock, Minus, ServerCog, ShieldCheck, X } from 'lucide-react';
import { CONTACT, CONTROLS } from '@/lib/marketing/content';
import {
  Aurora,
  CTA,
  Container,
  Eyebrow,
  Rise,
  Section,
  SectionHeading,
} from '@/components/marketing/bits';
import { Reveal } from '@/components/marketing/Reveal';
import { PermissionMatrix } from '@/components/marketing/security/PermissionMatrix';

export const metadata: Metadata = {
  title: 'Security',
  description:
    'How permissions, the history and data location actually work. Row-level security in Postgres, a history nobody can edit or delete, and hosting in Mumbai.',
};

/**
 * The policy matrix, transcribed from supabase/migrations/0003_rls.sql.
 *
 * It is here rather than in content.ts because it is a description of the
 * schema, and if the schema changes this page is exactly where it should be
 * corrected. "None" means there is no policy at all — under row-level security
 * an absent policy is a closed door, not an open one.
 */
const MATRIX = [
  {
    table: 'vouchers',
    select: 'Raiser, approvers, admin',
    insert: 'Yourself only',
    update: 'While draft or rejected',
    remove: 'Admin, soft only',
  },
  {
    table: 'voucher_attachments',
    select: 'With the voucher',
    insert: 'On your own drafts',
    update: 'None',
    remove: 'While draft or rejected',
  },
  {
    table: 'voucher_audit',
    select: 'With the voucher',
    insert: 'Append only',
    update: 'None',
    remove: 'None',
  },
] as const;

const RESIDENCY = [
  {
    term: 'Region',
    def: 'Mumbai, ap-south-1. The database, the files and the backups all sit in the same place, and none of it is copied out of the country.',
  },
  {
    term: 'On the way in',
    def: 'Every connection is encrypted, including the one between the app and the database. Nothing travels in plain text at any point.',
  },
  {
    term: 'While it sits there',
    def: 'The database and the file storage are both encrypted. That is where your invoice scans and the PDFs we generate live.',
  },
  {
    term: 'Who can get at it',
    def: 'People and code both get the least access they need to do the job. The app connects using an account that cannot skip the row-level security rules.',
  },
];

const NOT_DOING = [
  {
    title: 'We do not claim certificates we do not have',
    body: 'There is no SOC 2 report and no ISO 27001 certificate. None of this has been through an outside audit yet. What we can give you instead is the database structure, the rules, and someone to walk you through both.',
  },
  {
    title: 'We do not train models on your data',
    body: 'Your vouchers, invoices and ledgers are not used to train or tune anything, ours or anybody else’s.',
  },
  {
    title: 'We do not let software have the last word',
    body: 'Nothing here approves a voucher, posts a journal or releases a payment on its own. It gets things ready, checks them and explains them. A named person decides.',
  },
  {
    title: 'We do not use shared logins',
    body: 'Every change is saved against one person’s name, so “the system did it” is never an answer anyone can give during a review.',
  },
  {
    title: 'We do not really delete your records',
    body: 'Deleting is a flag with a reason and a name against it. An admin can see it and put it back. The history behind it stays exactly where it was.',
  },
  {
    title: 'We do not send your data abroad to process it',
    body: 'The processing happens in the same place as the storage. There is no overnight job that leaves the country and comes back.',
  },
];

export default function SecurityPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <Aurora color="var(--m-emerald)" opacity={0.2} className="-top-44 -left-24 size-[38rem]" />
        <Aurora color="var(--m-indigo)" opacity={0.24} className="-top-20 right-0 size-[32rem]" />
        <div
          aria-hidden
          className="m-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(65%_55%_at_50%_0%,#000,transparent)]"
        />

        <Container wide className="relative pt-16 pb-16 sm:pt-24 sm:pb-24">
          <Rise>
            <Eyebrow>Security &amp; trust</Eyebrow>
          </Rise>

          <Rise delay={60}>
            <h1 className="m-display mt-5 max-w-4xl text-[clamp(2.4rem,5.8vw,4.25rem)]">
              Rules you can{' '}
              <span className="m-serif m-grad-text pr-1">read for yourself.</span>
            </h1>
          </Rise>

          <Rise delay={120}>
            <p className="m-dim mt-7 max-w-2xl text-[15px] leading-relaxed sm:text-[17px]">
              Most security pages tell you what a company intends to do. This one tells you where the
              rules actually live, which is inside the database, written in SQL your own technical
              person can read. If a rule is not written down there, we do not count it.
            </p>
          </Rise>

          <Rise delay={180}>
            <p className="m-dim-2 mt-8 flex max-w-2xl items-start gap-2.5 text-[13px] leading-relaxed">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--m-emerald)]" aria-hidden />
              <span>
                We have no outside certification and we are not going to imply that we do. You can
                check everything below by reading the code, or by asking us to talk you through it.
              </span>
            </p>
          </Rise>
        </Container>
      </section>

      <Section>
        <Container wide>
          <Reveal>
            <SectionHeading
              eyebrow="The four that matter"
              title="The four that matter most."
              lead="These four carry most of the weight. Each one is built into the database rather than being a habit the team has to keep up, which is why they still work in a busy quarter."
            />
          </Reveal>

          <ul className="mt-12 grid gap-4 sm:grid-cols-2">
            {CONTROLS.map((control, i) => (
              <Reveal as="li" key={control.title} delay={i * 70} className="h-full">
                <div className="m-card flex h-full flex-col p-6 sm:p-7">
                  <span
                    aria-hidden
                    className="m-mono text-[11px] tracking-[0.12em] text-[var(--m-cyan)]"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="m-display mt-4 text-lg">{control.title}</h3>
                  <p className="m-dim mt-3 text-[14px] leading-relaxed">{control.body}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </Container>
      </Section>

      {/*
        The role-level view, ahead of the table-level MATRIX further down. They
        answer different questions — "what can I do" versus "what is each table
        exposed for" — and a reader arriving from the home page has the first one.
      */}
      <PermissionMatrix />

      <Section>
        <Container wide>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-16">
            <Reveal>
              <div className="lg:sticky lg:top-28">
                <Eyebrow>Authorisation</Eyebrow>
                <h2 className="m-display mt-4 text-[clamp(1.8rem,3.6vw,2.7rem)]">
                  The website is not the lock.
                </h2>
                <p className="m-dim mt-5 text-[15px] leading-relaxed">
                  Your browser holds proof of who you are. It does not hold permission to do
                  anything. Every read and every change goes to the database with that identity
                  attached, and the database decides what you are allowed to see and touch. This is
                  switched on for every table that holds your data.
                </p>
                <p className="m-dim mt-4 text-[15px] leading-relaxed">
                  Moving a voucher along, whether that is submitting, approving, rejecting, reopening
                  or marking it paid, only happens through one set of database functions. They lock
                  the row while they work and check the rules against the record as it stands right
                  now, not as the browser last saw it. Somebody calling the API directly with a valid
                  login hits exactly the same checks as somebody clicking the button.
                </p>
              </div>
            </Reveal>

            <div className="space-y-4">
              <Reveal delay={70}>
                <div className="m-card p-6 sm:p-7">
                  <p className="m-eyebrow">What the database refuses</p>
                  <ul className="mt-5 space-y-4">
                    <Refusal
                      quote="You cannot approve a voucher you raised"
                      note="Checked against who raised it, before the status can change at all."
                    />
                    <Refusal
                      quote="This voucher already has your first approval — a second person must approve it"
                      note="The second approver is compared with the first, on the locked record."
                    />
                    <Refusal
                      quote="This voucher is approved and cannot be edited. Reopen it first."
                      note="Once approved, the amounts, the payee, the invoice number and the voucher number are all locked."
                    />
                  </ul>
                  <p className="m-dim-2 mt-6 text-[12.5px] leading-relaxed">
                    These are the database&apos;s own messages, quoted as they come back. The app
                    shows them to you because they happened, not in place of them happening.
                  </p>
                </div>
              </Reveal>

              <Reveal delay={140}>
                <div className="m-card overflow-hidden">
                  <p className="m-eyebrow border-b border-[var(--m-line)] px-6 py-4">
                    voucher_audit, in full
                  </p>
                  {/* The snippet is short enough to read and long enough to prove
                      the point: the absence at the bottom is the control. */}
                  <div className="overflow-x-auto px-6 py-5">
                    <pre className="m-mono text-[12px] leading-relaxed text-[var(--m-dim)]">
                      <code>{`create policy audit_read on voucher_audit
  for select using ( … visible with the voucher … );

create policy audit_append on voucher_audit
  for insert with check (auth.uid() is not null);

-- no update policy, for any role
-- no delete policy, for any role`}</code>
                    </pre>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <Reveal>
            <SectionHeading
              eyebrow="The history"
              title="A history with no way to edit it."
              lead="With row-level security, if a table has no rule allowing something, that thing simply cannot be done. The history table has no rule allowing an edit and no rule allowing a delete, for any role. There is nothing to set up wrongly, and nobody you have to take on trust."
            />
          </Reveal>

          <Reveal delay={80}>
            {/* Four operations across three tables is wider than a phone. It
                scrolls in its own box rather than pushing the page sideways. */}
            <div className="m-card mt-12 overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-left">
                <caption className="m-dim-2 px-6 pt-5 text-left text-[12.5px]">
                  What each table allows, and who it allows it for.
                </caption>
                <thead>
                  <tr className="border-b border-[var(--m-line)]">
                    <th scope="col" className="m-eyebrow px-6 py-4">
                      Table
                    </th>
                    <th scope="col" className="m-eyebrow px-6 py-4">
                      Select
                    </th>
                    <th scope="col" className="m-eyebrow px-6 py-4">
                      Insert
                    </th>
                    <th scope="col" className="m-eyebrow px-6 py-4">
                      Update
                    </th>
                    <th scope="col" className="m-eyebrow px-6 py-4">
                      Delete
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MATRIX.map((row) => (
                    <tr key={row.table} className="border-b border-[var(--m-line)] last:border-0">
                      <th
                        scope="row"
                        className="m-mono px-6 py-5 text-[12.5px] font-medium text-[var(--m-ink)]"
                      >
                        {row.table}
                      </th>
                      <Cell value={row.select} />
                      <Cell value={row.insert} />
                      <Cell value={row.update} />
                      <Cell value={row.remove} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>

          <Reveal delay={140}>
            <p className="m-dim mt-8 max-w-2xl text-[14px] leading-relaxed">
              Every step adds a line: who did it, what the status was before and after, when it
              happened, and any note they left. So putting something right is a new entry with a name
              against it, never a quiet overwrite. Even your own profile is locked down to one field.
              You can change the name that shows up next to you and nothing else, because the
              permission is on that single column rather than the whole table.
            </p>
          </Reveal>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
            <Reveal>
              <div>
                <Eyebrow>Residency</Eyebrow>
                <h2 className="m-display mt-4 text-[clamp(1.8rem,3.6vw,2.7rem)]">
                  Your books stay in India.
                </h2>
                <p className="m-dim mt-5 max-w-md text-[15px] leading-relaxed">
                  Managed Postgres in Mumbai, with the files and the backups in the same place. If a
                  regulator can ask to see your records, knowing which country holds them is not a
                  small detail.
                </p>
                <p className="m-mono m-dim-2 mt-7 inline-flex items-center gap-2 rounded-full border border-[var(--m-line)] px-3.5 py-2 text-[11px] tracking-[0.1em] uppercase">
                  <ServerCog className="size-3.5 text-[var(--m-cyan)]" aria-hidden />
                  Mumbai · ap-south-1
                </p>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <dl className="border-t border-[var(--m-line)]">
                {RESIDENCY.map((item) => (
                  <div
                    key={item.term}
                    className="grid gap-2 border-b border-[var(--m-line)] py-5 sm:grid-cols-[9rem_1fr] sm:gap-6"
                  >
                    <dt className="m-mono text-[11px] tracking-[0.12em] text-[var(--m-ink)] uppercase">
                      {item.term}
                    </dt>
                    <dd className="m-dim text-[14px] leading-relaxed">{item.def}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <Reveal>
            <SectionHeading
              eyebrow="Plainly"
              title="What we do not do."
              lead="A page like this is only worth reading if it says the awkward things too. Here are the limits, before you have to ask."
            />
          </Reveal>

          <ul className="mt-12 grid gap-x-10 gap-y-px sm:grid-cols-2 sm:gap-x-14">
            {NOT_DOING.map((item, i) => (
              <Reveal as="li" key={item.title} delay={(i % 2) * 60}>
                <div className="flex gap-4 border-b border-[var(--m-line)] py-6">
                  <X className="mt-1 size-4 shrink-0 text-[var(--m-rose)]" aria-hidden />
                  <div>
                    <h3 className="text-[15px] font-semibold">{item.title}</h3>
                    <p className="m-dim mt-2 text-[13.5px] leading-relaxed">{item.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <Reveal>
            <div className="m-card relative overflow-hidden px-6 py-14 sm:px-12 sm:py-18">
              <Aurora
                color="var(--m-emerald)"
                opacity={0.18}
                className="-top-24 left-1/4 size-[26rem]"
              />

              <div className="relative grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-center">
                <div className="max-w-xl">
                  <h2 className="m-display text-[clamp(1.7rem,3.6vw,2.6rem)]">
                    Bring your own security questions.
                  </h2>
                  <p className="m-dim mt-5 text-[15px] leading-relaxed">
                    We will go through the rules with your team, table by table. Where the answer is
                    no, we will say no. If your review needs paperwork we do not have yet, you will
                    hear that on the call and not after you have signed something.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <CTA href="/contact">Book a walkthrough</CTA>
                    <CTA href="/about" variant="ghost">
                      Who is behind it
                    </CTA>
                  </div>
                </div>

                <div className="m-card bg-white/[0.02] p-6">
                  <h3 className="m-eyebrow flex items-center gap-2">
                    <Lock className="size-3.5" aria-hidden />
                    Reporting a problem
                  </h3>
                  <p className="m-dim mt-4 text-[13.5px] leading-relaxed">
                    If you think you have found a security hole, write to us directly. We will reply
                    within two working days and tell you what we plan to do about it.
                  </p>
                  <a
                    href={`mailto:${CONTACT.security}`}
                    className="m-mono mt-5 inline-block text-[13px] text-[var(--m-cyan)] underline underline-offset-4 transition hover:text-[var(--m-ink)]"
                  >
                    {CONTACT.security}
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>
    </>
  );
}

/** "None" is the strongest cell in the table, so it is the one that is marked. */
function Cell({ value }: { value: string }) {
  const none = value === 'None';

  return (
    <td className="px-6 py-5 align-top">
      <span
        className={
          none
            ? 'inline-flex items-center gap-2 text-[13px] font-medium text-[var(--m-rose)]'
            : 'm-dim inline-flex items-center gap-2 text-[13px]'
        }
      >
        {none ? (
          <Minus className="size-3.5 shrink-0" aria-hidden />
        ) : (
          <Check className="size-3.5 shrink-0 text-[var(--m-emerald)]" aria-hidden />
        )}
        {none ? 'No policy exists' : value}
      </span>
    </td>
  );
}

function Refusal({ quote, note }: { quote: string; note: string }) {
  return (
    <li>
      <p className="m-mono text-[12.5px] leading-relaxed text-[var(--m-amber)]">“{quote}”</p>
      <p className="m-dim-2 mt-1.5 text-[12.5px] leading-relaxed">{note}</p>
    </li>
  );
}
