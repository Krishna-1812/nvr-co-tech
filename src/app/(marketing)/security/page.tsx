import type { Metadata } from 'next';
import { Check, Lock, Minus, ServerCog, ShieldCheck, X } from 'lucide-react';
import { CONTACT, CONTROLS } from '@/lib/marketing/content';
import {
  Aurora,
  CTA,
  Container,
  Eyebrow,
  Section,
  SectionHeading,
} from '@/components/marketing/bits';
import { Reveal } from '@/components/marketing/Reveal';

export const metadata: Metadata = {
  title: 'Security',
  description:
    'How authorisation, the audit trail and data residency actually work: row-level security in Postgres, an append-only history with no update or delete path, and hosting in Mumbai.',
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
    def: 'Mumbai, ap-south-1. Database, storage and backups all sit in the same region, and nothing is replicated out of it.',
  },
  {
    term: 'In transit',
    def: 'TLS on every connection, including the one between the application and the database. No plaintext hop anywhere in the path.',
  },
  {
    term: 'At rest',
    def: 'Volume-level encryption on the database and on object storage, where the invoice scans and generated PDFs live.',
  },
  {
    term: 'Access',
    def: 'Least privilege for people as well as for code. The application connects as a role that cannot bypass row-level security.',
  },
];

const NOT_DOING = [
  {
    title: 'We do not claim certifications we do not hold',
    body: 'There is no SOC 2 report and no ISO 27001 certificate. Nothing here has been through a third-party audit yet. What we can offer instead is the schema, the policies and a walkthrough of both.',
  },
  {
    title: 'We do not train models on your data',
    body: 'Your vouchers, invoices and ledgers are not used to train or fine-tune anything, ours or anyone else’s.',
  },
  {
    title: 'We do not let an agent be the last word',
    body: 'No agent approves a voucher, posts a journal or releases a payment. It prepares, checks and explains. A named person decides.',
  },
  {
    title: 'We do not use shared logins',
    body: 'Every write carries the identity of one person, so “the system did it” is never an available answer during a review.',
  },
  {
    title: 'We do not hard-delete your records',
    body: 'Deletion is a flag with a reason and an author, visible to an admin and reversible. The audit rows behind it stay exactly where they were.',
  },
  {
    title: 'We do not move your data to another country to process it',
    body: 'Processing happens in the same region as storage. There is no overnight batch that leaves the country and comes back.',
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
          <Reveal>
            <Eyebrow>Security &amp; trust</Eyebrow>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="m-display mt-5 max-w-4xl text-[clamp(2.4rem,5.8vw,4.25rem)]">
              Controls you can{' '}
              <span className="m-serif m-grad-text pr-1">read for yourself.</span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="m-dim mt-7 max-w-2xl text-[15px] leading-relaxed sm:text-[17px]">
              Most security pages describe intentions. This one describes where the rules live,
              which is inside Postgres, in policies and functions your own database person can
              read. If a control is not written down as SQL, we do not count it as a control.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <p className="m-dim-2 mt-8 flex max-w-2xl items-start gap-2.5 text-[13px] leading-relaxed">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--m-emerald)]" aria-hidden />
              <span>
                We hold no third-party certification and do not imply one. Everything below is
                verifiable by reading the migrations or by asking us to walk you through them.
              </span>
            </p>
          </Reveal>
        </Container>
      </section>

      <Section>
        <Container wide>
          <Reveal>
            <SectionHeading
              eyebrow="The four that matter"
              title="What holds, and what is holding it."
              lead="Four controls carry most of the weight. Each one is a property of the database rather than a habit of the team, which is what makes it survive a busy quarter."
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

      <Section>
        <Container wide>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-16">
            <Reveal>
              <div className="lg:sticky lg:top-28">
                <Eyebrow>Authorisation</Eyebrow>
                <h2 className="m-display mt-4 text-[clamp(1.8rem,3.6vw,2.7rem)]">
                  The front end is not the gate.
                </h2>
                <p className="m-dim mt-5 text-[15px] leading-relaxed">
                  A browser holds a token, not a permission. Every read and write arrives at
                  Postgres with that identity attached, and Postgres decides what it is allowed to
                  see and change. Row-level security is on for every table that carries your data.
                </p>
                <p className="m-dim mt-4 text-[15px] leading-relaxed">
                  The state transitions — submit, approve, reject, reopen, mark paid — are
                  SECURITY DEFINER functions. They are the only way to move a voucher, they take a
                  row lock while they work, and they re-check the rules against the row as it
                  stands rather than as the client last saw it. Someone calling the API directly
                  with a valid token meets exactly the same checks as someone clicking the button.
                </p>
              </div>
            </Reveal>

            <div className="space-y-4">
              <Reveal delay={70}>
                <div className="m-card p-6 sm:p-7">
                  <p className="m-eyebrow">Refused inside the transaction</p>
                  <ul className="mt-5 space-y-4">
                    <Refusal
                      quote="You cannot approve a voucher you raised"
                      note="Checked against initiated_by and created_by before any status changes."
                    />
                    <Refusal
                      quote="This voucher already has your first approval — a second person must approve it"
                      note="The second approver is compared to the first, on the locked row."
                    />
                    <Refusal
                      quote="This voucher is approved and cannot be edited. Reopen it first."
                      note="A trigger freezes the amounts, payee, invoice number and voucher number once approved."
                    />
                  </ul>
                  <p className="m-dim-2 mt-6 text-[12.5px] leading-relaxed">
                    These are database exceptions, quoted as they are raised. The interface shows
                    them because they happened, not instead of them happening.
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
              eyebrow="The audit trail"
              title="History that has no edit path."
              lead="Under row-level security, a table with no policy for an operation cannot have that operation performed on it. The audit table has no UPDATE policy and no DELETE policy for any role, so there is nothing to misconfigure and nobody to trust."
            />
          </Reveal>

          <Reveal delay={80}>
            {/* Four operations across three tables is wider than a phone. It
                scrolls in its own box rather than pushing the page sideways. */}
            <div className="m-card mt-12 overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-left">
                <caption className="m-dim-2 px-6 pt-5 text-left text-[12.5px]">
                  Row-level security policies, by table and operation.
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
              Every transition appends a row: who acted, what the status was before and after, when
              it happened, and any note they left. A correction is therefore a new event with an
              author, never a quiet overwrite. Even the profile table is narrowed to a single
              column of self-service — a person can change their own display name and nothing else,
              because the grant is on the column rather than the table.
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
                  Managed Postgres in Mumbai, with object storage and backups in the same region.
                  For a firm whose records may be called for by a regulator, knowing which
                  jurisdiction holds them is not a detail.
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
              lead="A trust page is only worth reading if it is willing to be unflattering. These are the limits, stated before you ask."
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
                    We will go through the policies with your team, table by table, and answer what
                    we cannot answer with a straight no. If your review needs evidence we do not
                    have yet, you will hear that on the call rather than after the contract.
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
                    If you believe you have found a vulnerability, write to us directly. We will
                    acknowledge within two working days and tell you what we intend to do about it.
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
