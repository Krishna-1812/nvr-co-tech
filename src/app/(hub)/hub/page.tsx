import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { History } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { canApprove, isOwner, ROLE_META } from '@/lib/domain/workflow';
import { deskBrief } from '@/lib/domain/desk';
import { fiscalYear, istParts, istToday } from '@/lib/fiscal';
import { ROSTER } from '@/lib/marketing/content';
import { SOLUTIONS } from '@/lib/solutions';
import { LiveSolutionCard, type Reading } from '@/components/hub/LiveSolutionCard';
import { RequestCard } from '@/components/hub/RequestCard';
import { RosterMeter } from '@/components/hub/RosterMeter';
import { SetupChecklist, type SetupState } from '@/components/hub/SetupChecklist';
import { SolutionCard } from '@/components/hub/SolutionCard';
import { myFeatureRequests } from '@/app/actions/access';

export const metadata: Metadata = { title: 'Workspace' };

/** The two statuses that mean "somebody has to look at this". */
const PENDING = ['pending_first', 'pending_second'] as const;

/**
 * The workspace.
 *
 * What signing in now lands on, instead of the voucher dashboard. The reason is not
 * decoration: The Finance Intelligence is a set of tools of which Voucher Desk is the first,
 * and landing straight inside one of them made the platform look like a single
 * application that happened to have an ambitious marketing site attached. A person
 * signing in should see what the firm runs, then choose.
 *
 * The screen is one live card and five cards for tools that do not exist yet, and it
 * says which is which in three separate ways (the meter, the badge, the footer note).
 * Somebody who reads only the colours should not come away thinking they have six
 * tools.
 */
export default async function HubPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const today = istToday();
  const fiscal = fiscalYear(today);
  const { partOfDay, weekday } = istParts();

  /*
   * The start of this financial year as an instant, for the "yours this year"
   * figure. The offset is written out rather than left to the server's clock for
   * the same reason lib/fiscal exists at all: Vercel runs in UTC, and 1 April
   * midnight IST is 31 March 18:30 UTC.
   */
  const [y, m] = today.split('-').map(Number);
  const fyStart = `${m >= 4 ? y : y - 1}-04-01T00:00:00+05:30`;

  const approver = canApprove(user.role);
  const owner = isOwner(user.role);
  const count = () =>
    supabase.from('vouchers').select('id', { count: 'exact', head: true }).is('deleted_at', null);

  /*
   * Reconciliations are yours alone — 0008 gives that table no policy that would
   * let anybody read somebody else's — so all three of these are scoped to you
   * without needing to say so on the card.
   *
   * Counted separately from the vouchers because the table may not exist yet:
   * 0008 has to be applied to the project first, and until it is, every query
   * here fails. A missing history is not a reason for the workspace to fall
   * over, so the counts fall back to zero and the card still opens the tool.
   */
  const recon = () =>
    supabase
      .from('reconciliations')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', user.id);

  /*
   * Head counts, no rows fetched. Every figure that reaches the instrument panel
   * is deliberately scoped to "yours" except the approval queue, because the
   * register itself is scoped by RLS — a member sees only their own vouchers, an
   * approver sees every submitted one — and a figure whose meaning changes with
   * the reader's role is worse than no figure.
   *
   * The last four are not displayed as figures at all. They decide which of two
   * sentences the desk gets and whether the owner still needs a setup card, and
   * each says below why it is scoped the way it is.
   */
  const [
    drafts,
    sentBack,
    withApprovers,
    queue,
    thisYear,
    everRaised,
    reconciled,
    reconOpen,
    reconYear,
    chapters,
    people,
    org,
    // Which tools this person has already put their hand up for, so a card that
    // has been asked for says so rather than inviting the same ask again.
    asked,
  ] = await Promise.all([
    count().eq('created_by', user.id).eq('status', 'draft'),
    /*
     * Yours, sent back for correction.
     *
     * This card had no idea about rejections. Its sentence ran queue, drafts,
     * with-approvers, nothing, so a member with two vouchers returned to them
     * was told they had drafts to finish, or that the desk was clear. Sent back
     * is the one state nobody else can clear for you, which is why the shared
     * brief ranks it first, and it needed counting before it could be said.
     */
    count().eq('created_by', user.id).eq('status', 'rejected'),
    count().eq('created_by', user.id).in('status', [...PENDING]),
    // You can never approve your own voucher, so it must not appear in your queue.
    approver ? count().in('status', [...PENDING]).neq('created_by', user.id) : null,
    count().eq('created_by', user.id).gte('created_at', fyStart),
    /*
     * Everything, at any status, from anybody — the one figure here that is not
     * scoped to you, and the only thing that can tell a workspace nobody has
     * used yet from a quiet one. None of the four above can stand in for it: a
     * voucher raised and paid last March leaves no drafts and nothing pending,
     * and shows up in no financial year but its own.
     *
     * RLS still narrows what "everything" means — an owner or admin sees the
     * whole register, a member sees only their own — but zero reads the same
     * either way: nothing this person could act on has ever been raised.
     */
    count(),
    recon(),
    recon().neq('status', 'RECONCILED'),
    recon().gte('created_at', fyStart),
    /*
     * The last three are for the owner's setup checklist and nobody else's, so
     * they are skipped for everybody else rather than fetched and thrown away —
     * the same reason the approval queue above is only counted for an approver.
     * Both tables are organization-scoped by 0012, and an owner can read every
     * profile in their own organisation, so these are counts of the whole firm.
     */
    owner ? supabase.from('chapters').select('id', { count: 'exact', head: true }) : null,
    owner ? supabase.from('profiles').select('id', { count: 'exact', head: true }) : null,
    owner ? supabase.from('organizations').select('requires_approval').single() : null,
    myFeatureRequests(),
  ]);

  const askedSet = new Set(asked);

  const n = {
    drafts: drafts.count ?? 0,
    sentBack: sentBack.count ?? 0,
    withApprovers: withApprovers.count ?? 0,
    queue: queue?.count ?? 0,
    thisYear: thisYear.count ?? 0,
    everRaised: everRaised.count ?? 0,
    reconciled: reconciled.count ?? 0,
    reconOpen: reconOpen.count ?? 0,
    reconYear: reconYear.count ?? 0,
  };

  /*
   * Null for anybody who is not an owner, which is what keeps the card off their
   * screen: chapters, roles and the approval setting are all owner business, and
   * a member being shown a list of things they are not allowed to do would be
   * worse than the empty screen this replaces.
   *
   * requires_approval falls back to false rather than to true, because false is
   * what the column defaults to (0014) and because a failed read must not invent
   * a step telling the owner to go and find an approver they do not need. The
   * People screen, which warns about a real gap, is the one that errs the other
   * way.
   */
  const setup: SetupState | null = owner
    ? {
        chapters: chapters?.count ?? 0,
        people: people?.count ?? 0,
        requiresApproval: org?.data?.requires_approval ?? false,
      }
    : null;

  const readings: Reading[] = [
    {
      label: 'Drafts',
      value: n.drafts,
      tone: 'var(--status-warn)',
      hint: 'Started, not submitted. Only you can see these.',
    },
    approver
      ? {
          label: 'Waiting on you',
          value: n.queue,
          tone: 'var(--status-pending)',
          hint: 'Submitted vouchers you are allowed to approve.',
        }
      : {
          label: 'With approvers',
          value: n.withApprovers,
          tone: 'var(--status-pending)',
          hint: 'Yours, submitted and waiting on somebody else.',
        },
    {
      label: `Yours in FY ${fiscal.label}`,
      value: n.thisYear,
      hint: `Raised by you since 1 April ${m >= 4 ? y : y - 1}.`,
    },
  ];

  /*
   * Why you are here, in one sentence, from the same ranking the dashboard uses.
   *
   * "Nothing" has two meanings and used to be told as one. A clear desk on a
   * Friday afternoon is good news; a clear desk on the day the firm signs up is
   * an empty tool nobody has been shown how to start. Both sentences live in
   * lib/domain/desk now, along with the argument about which of six facts wins.
   */
  const brief = deskBrief({
    sentBack: n.sentBack,
    // Only an approver has a queue. Anybody else has a zero here, which is what
    // stops the shared ranking offering them a screen they cannot open.
    queue: approver ? n.queue : 0,
    drafts: n.drafts,
    withApprovers: n.withApprovers,
    everRaised: n.everRaised,
  });

  /*
   * The second tool's own instrumentation.
   *
   * Keyed by slug rather than shared across whatever happens to be live, because
   * the figures that matter differ per tool: a voucher is waiting on a person,
   * whereas a reconciliation is either finished or it is not.
   */
  const reconReadings: Reading[] = [
    {
      label: 'Reconciliations',
      value: n.reconciled,
      hint: 'Saved by you. Nobody else can see them.',
    },
    {
      label: 'Still unexplained',
      value: n.reconOpen,
      tone: 'var(--status-warn)',
      hint: 'Runs where a difference was left that the statement did not account for.',
    },
    {
      label: `Run in FY ${fiscal.label}`,
      value: n.reconYear,
      hint: `Since 1 April ${m >= 4 ? y : y - 1}.`,
    },
  ];

  const reconBrief =
    n.reconOpen > 0
      ? {
          text: `${n.reconOpen} ${plural(n.reconOpen, 'reconciliation does', 'reconciliations do')} not tie out yet.`,
          tone: 'var(--status-warn)',
        }
      : n.reconciled > 0
        ? {
            text: 'Everything you have reconciled ties out.',
            tone: 'var(--status-approved)',
          }
        : {
            text: 'Nothing reconciled yet. Two files is all it takes, and they stay on your machine.',
            tone: 'var(--status-draft)',
          };

  const voucherDesk = SOLUTIONS.find((s) => s.slug === 'voucher-desk');
  const reconciliation = SOLUTIONS.find((s) => s.slug === 'ledger-reconciliation');
  const rest = SOLUTIONS.filter((s) => s.stage !== 'live');
  const firstName = (user.full_name ?? user.email).split(/[\s@.]+/)[0];

  return (
    <div className="space-y-8">
      {/* ── Who you are, when it is, and how much of this exists ── */}
      <header className="animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] relative pb-6">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="min-w-0">
            <p className="flex items-center gap-2">
              <span
                aria-hidden
                className="a-blip size-1.5 rounded-full"
                style={{ background: 'var(--status-approved)' }}
              />
              <span className="a-label">
                {weekday} {partOfDay} · FY {fiscal.label} · India
              </span>
            </p>

            <h1 className="m-display mt-3 text-[clamp(1.9rem,4.4vw,2.85rem)] text-balance">
              Good {partOfDay}, {firstName}.
            </h1>

            {/*
              Two corrections, both about not saying more than is true.

              This claimed the rest were "being built in the order below", which
              everything under it contradicted: nothing is in build and all four
              roadmap cards say Not started yet. The order is real, so the order
              is what it claims.

              And the count is counted rather than written. It said "Two of
              these" in prose, a few pixels from a meter that works the same
              number out for itself.
            */}
            <p className="text-muted mt-3 max-w-xl text-[15px] text-pretty">
              Everything the firm runs is here. {ROSTER.liveOpen} of these {ROSTER.liveVerb} open for
              work today, and the rest are written down in the order they will be built.
            </p>

            <p className="mt-4">
              <span
                style={{ '--tone': 'var(--color-brand-600)' } as CSSProperties}
                className="tinted inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                title={ROLE_META[user.role].grants}
              >
                {ROLE_META[user.role].label}
                <span className="opacity-60">·</span>
                <span className="font-normal opacity-90">{ROLE_META[user.role].grants}</span>
              </span>
            </p>
          </div>

          <RosterMeter />
        </div>

        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,var(--border-strong),transparent_65%)]"
        />
      </header>

      {/* ── What is not set up yet, while any of it is not ──
          Above the tools rather than below them, because the tools are what it is
          about: an owner who scrolls past this to open Voucher Desk and finds a
          chapter dropdown with nothing in it has been told nothing. It removes
          itself once there is nothing left to say. */}
      {setup && <SetupChecklist state={setup} />}

      {/* ── The ones you can use ── */}
      <div className="space-y-5">
        {voucherDesk && (
          <div className="animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_60ms_backwards]">
            <LiveSolutionCard
              solution={voucherDesk}
              readings={readings}
              note={brief.note}
              noteTone={brief.tone}
              shortcut={{ href: '/vouchers/new', label: 'New voucher' }}
            />
          </div>
        )}

        {reconciliation && (
          <div className="animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_120ms_backwards]">
            <LiveSolutionCard
              solution={reconciliation}
              readings={reconReadings}
              note={reconBrief.text}
              noteTone={reconBrief.tone}
              shortcut={{ href: '/reconcile/history', label: 'History', icon: History }}
            />
          </div>
        )}
      </div>

      {/* ── The rest of the roster ── */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="m-display text-[1.35rem]">On the way</h2>
          <p className="text-subtle text-xs">
            Not switched on yet. Each one says where it has got to.
          </p>
        </div>

        <ul className="stagger mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((solution) => (
            <li key={solution.slug} className="h-full">
              <SolutionCard solution={solution} asked={askedSet.has(solution.slug)} />
            </li>
          ))}
          <li className="h-full">
            <RequestCard />
          </li>
        </ul>
      </section>
    </div>
  );
}

/** Local because it is two words of grammar, not a utility. */
function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}
