import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  History,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { createClient, getViewer } from '@/lib/supabase/server';
import { isAnalyticsAdmin } from '@/lib/analytics/admin';
import { canApprove, isAdmin, isOwner, ROLE_META } from '@/lib/domain/workflow';
import { deskBrief } from '@/lib/domain/desk';
import { fiscalYear, istParts, istToday } from '@/lib/fiscal';
import { SOLUTIONS } from '@/lib/solutions';
import { buildNoticesView } from '@/lib/notices/view';
import { LiveSolutionCard, type Reading } from '@/components/hub/LiveSolutionCard';
import { LandedPanel } from '@/components/landed/LandedPanel';
import { WealthPanel } from '@/components/wealth/WealthPanel';
import { RequestCard } from '@/components/hub/RequestCard';
import { RosterMeter } from '@/components/hub/RosterMeter';
import { SetupChecklist, type SetupState } from '@/components/hub/SetupChecklist';
import { SolutionCard } from '@/components/hub/SolutionCard';
import { AskCard, remaining } from '@/components/hub/AskCard';
import { cn } from '@/lib/utils';
import { Figure } from '@/components/app/Figure';
import { buttonClass } from '@/components/ui/primitives';
import { ArchScene, SealFigure } from '@/components/ui/Scene';
import { HeroChip, HeroStat, ToolHero } from '@/components/ui/ToolHero';
import { IntroCurtain } from '@/components/marketing/play/IntroCurtain';
import { myFeatureRequests } from '@/app/actions/access';
import { OpenHub } from '@/components/hub/OpenHub';

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
 * The screen is a handful of live cards and a roadmap of the rest, and it says
 * which is which in three separate ways (the meter, the badge, the footer
 * note). Somebody who reads only the colours should not come away confused
 * about how many tools they actually have.
 *
 * The live cards are hardcoded lookups by slug, not a loop over
 * `SOLUTIONS.filter(stage === 'live')`, because each one's instrument panel
 * reads different tables — Voucher Desk's queue is not shaped like Ledger
 * Reconciliation's tie-out, which is not shaped like Valuation Desk's
 * registry counts. The cost of that is real and already paid for once: flip a
 * fourth tool's stage to 'live' in content.ts without adding its card here
 * and it silently disappears from the workspace, counted by the roster meter
 * but shown nowhere. See the comment on `rest` below.
 */
export default async function HubPage() {
  /*
   * Since the workspace opened (lib/access), only a platform admin gets the
   * screen below, with every tool's figures read from its tables. Everybody
   * else — a visitor, or anybody signed in without admin standing — gets the
   * open workspace, which reads no table at all.
   */
  const viewer = await getViewer();
  if (!viewer.admin || !viewer.user) {
    const asked = viewer.user ? new Set(await myFeatureRequests()) : new Set<string>();
    return <OpenHub user={viewer.user} asked={asked} grants={viewer.grants} />;
  }
  const user = viewer.user;
  const supabase = await createClient();

  // Whether Contact Finder is openable by this person. Asked of the same
  // Postgres function its own layout and every one of its routes asks, so the
  // card and the screen behind it cannot disagree.
  const finderOpen = await isAnalyticsAdmin();

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
    count()
      .eq('created_by', user.id)
      .in('status', [...PENDING]),
    // You can never approve your own voucher, so it must not appear in your queue.
    approver
      ? count()
          .in('status', [...PENDING])
          .neq('created_by', user.id)
      : null,
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

  /*
   * Valuation Desk's own instrumentation, and it reads differently from the
   * two above it on purpose. A voucher and a reconciliation are yours; a
   * comparable set today is not — there is no save button yet, so "peer sets
   * you have made" would be a counter that can never move off zero, which
   * reads as broken rather than as new. What is real and worth showing is the
   * registry itself: how much of it exists, and how much of that is listed
   * and can actually be picked as a subject on `/comps`.
   */
  const [companiesTotal, companiesListed] = await Promise.all([
    supabase.from('companies').select('id', { count: 'exact', head: true }),
    supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('listing_status', 'listed'),
  ]);

  const n2 = {
    companiesTotal: companiesTotal.count ?? 0,
    companiesListed: companiesListed.count ?? 0,
  };

  /*
   * Contact Finder's instrumentation, and it reads differently again.
   *
   * There is no "searches you have run" figure worth showing, because a search
   * is free and repeating one costs nothing: a counter of them would measure
   * activity rather than anything a person needs to decide about. What is worth
   * showing is the only thing here that is finite — the credits this tool has
   * spent on your behalf.
   *
   * Summed in JavaScript rather than in Postgres because supabase-js has no
   * aggregate without an RPC and the row count involved is tiny. Tolerant of the
   * table not existing yet, the same way the reconciliation counts above are:
   * migration 0031 has to be applied first, and a workspace must not fall over
   * because a tool has not been switched on.
   */
  const monthStart = `${today.slice(0, 7)}-01T00:00:00+05:30`;
  const dayStart = `${today}T00:00:00+05:30`;
  const { data: creditRows } = await supabase
    .from('finder_credit_ledger')
    .select('credits, created_at')
    .eq('user_id', user.id)
    .gte('created_at', monthStart);

  const n3 = (creditRows ?? []).reduce(
    (acc, row) => ({
      month: acc.month + (row.credits ?? 0),
      today: acc.today + (row.created_at >= dayStart ? (row.credits ?? 0) : 0),
    }),
    { month: 0, today: 0 },
  );

  /*
   * Tax Notice Watch's figures (migration 0037). Its tables are readable by
   * the same admin list as Contact Finder's, which is also who sees its card,
   * and a missing table means the migration has not been run: the card then
   * says so rather than the workspace falling over.
   */
  const noticeView = finderOpen
    ? await Promise.all([
        supabase.from('itd_accounts').select('*'),
        supabase.from('itd_proceedings').select('*').is('gone_at', null).limit(5000),
        supabase.from('itd_alerts').select('*').gte('at', `${daysBefore(today, 14)}T00:00:00+05:30`).limit(1000),
        supabase.from('itd_runs').select('*').order('started_at', { ascending: false }).limit(5),
      ]).then(([a, p, al, r]) =>
        a.error
          ? null
          : buildNoticesView({
              accounts: a.data ?? [],
              proceedings: p.data ?? [],
              documents: [],
              alerts: al.data ?? [],
              runs: r.data ?? [],
              today,
              now: readClock(),
            }),
      )
    : null;

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

  const valuationReadings: Reading[] = [
    {
      label: 'Companies in the registry',
      value: n2.companiesTotal,
      hint: 'Shared across every workspace on the platform, not just yours.',
    },
    {
      label: 'Ready to be a subject',
      value: n2.companiesListed,
      hint: 'Listed, so the market has already priced them and a peer set can be checked against it.',
    },
  ];

  const valuationBrief =
    n2.companiesTotal === 0
      ? {
          text: 'Nothing in the registry yet. Seed a few companies to get started.',
          tone: 'var(--status-draft)',
        }
      : {
          text: `${n2.companiesTotal} ${plural(n2.companiesTotal, 'company', 'companies')} on file, ${n2.companiesListed} ready to be a subject.`,
          tone: undefined,
        };

  const finderReadings: Reading[] = [
    {
      label: 'Credits spent this month',
      value: n3.month,
      hint: 'By you, on this tool. Finding people is free; describing their employers is what spends.',
    },
    {
      label: 'Spent today',
      value: n3.today,
      tone: n3.today > 0 ? 'var(--status-pending)' : undefined,
      hint: 'A page of employers costs one credit however many companies are on it, and is then free for thirty days.',
    },
  ];

  /*
   * Deliberately never says "remaining". No endpoint reachable with this key
   * reports the account total, and the same key funds other things, so a
   * balance would be a guess dressed as a figure.
   */
  const finderBrief =
    n3.month === 0
      ? {
          text: 'Nothing spent yet. Searching for people costs nothing at all.',
          tone: 'var(--status-draft)',
        }
      : {
          text: `${n3.month} ${plural(n3.month, 'credit', 'credits')} spent this month. That is what this tool has used, not what is left.`,
          tone: undefined,
        };

  const noticeReadings: Reading[] = noticeView
    ? [
        {
          label: 'Need a look',
          value: noticeView.attention.length,
          tone: 'var(--status-warn)',
          hint: 'New in the last fortnight, or a response due within a week, and not marked handled.',
        },
        {
          label: 'Due this week',
          value: noticeView.tiles.due,
          tone: 'var(--status-rejected)',
          hint: 'Responses due in the next seven days that nobody has marked handled.',
        },
        {
          label: 'Not checked',
          value: noticeView.tiles.notChecked,
          tone: 'var(--status-rejected)',
          hint: 'Accounts in the sheet the morning check could not get into: a new notice on them would be missed.',
        },
      ]
    : [];
  const noticeBrief = !noticeView
    ? { text: 'Not switched on yet: migration 0037 has to be run first.', tone: 'var(--status-draft)' }
    : !noticeView.lastRun
      ? { text: 'Ready. The morning check has not run yet, so there is nothing to show.', tone: 'var(--status-draft)' }
      : noticeView.stale
        ? { text: 'The morning check has stopped running, so nothing new is being found.', tone: 'var(--status-rejected)' }
        : noticeView.attention.length
          ? { text: `${noticeView.attention.length} ${plural(noticeView.attention.length, 'proceeding needs', 'proceedings need')} a look.`, tone: 'var(--status-warn)' }
          : { text: 'Nothing new or due. Every client was checked this morning.', tone: undefined };

  const voucherDesk = SOLUTIONS.find((s) => s.slug === 'voucher-desk');
  const reconciliation = SOLUTIONS.find((s) => s.slug === 'ledger-reconciliation');
  const valuationDesk = SOLUTIONS.find((s) => s.slug === 'valuation-desk');
  const contactFinder = SOLUTIONS.find((s) => s.slug === 'contact-finder');
  const taxNotices = SOLUTIONS.find((s) => s.slug === 'tax-notices');
  const landedCost = SOLUTIONS.find((s) => s.slug === 'true-property-cost');
  const wealthTracker = SOLUTIONS.find((s) => s.slug === 'wealth-tracker');
  /*
   * `rest` is every non-live tool, so it stays a roadmap and never gets a
   * live tool mislabelled "Not started yet". The other side of that contract
   * is this file's to keep: the day a fourth tool's stage becomes 'live' in
   * content.ts, it needs a card of its own above, in the same breath — this
   * filter alone cannot tell the difference between "no card yet" and
   * "correctly on the roadmap", and a live tool with no card here simply
   * vanishes from the workspace rather than showing up in the wrong place.
   * That is exactly what happened to this one.
   */
  const rest = SOLUTIONS.filter((s) => s.stage !== 'live');
  const firstName = (user.full_name ?? user.email).split(/[\s@.]+/)[0];

  /*
   * The hero's figures, all counted from what this page already has.
   *
   * "Open to you" counts the live cards actually rendered below, not every live
   * tool on the roster: Contact Finder is live and still closed to anybody off
   * its allowlist, and a figure that promised them a door they cannot find
   * would be the first untrue thing on the screen. The pill says how many are
   * live on the platform, which is a different and also true number.
   *
   * "Waiting on you" is the three states nobody else can clear for you — a
   * voucher sent back, a queue you can approve, a reconciliation that does not
   * tie out. Only an approver has a queue, for the same reason the brief only
   * ranks one for them.
   */
  const liveTotal = SOLUTIONS.filter((s) => s.stage === 'live').length;
  const openToYou = [
    voucherDesk,
    reconciliation,
    valuationDesk,
    landedCost,
    wealthTracker,
    finderOpen ? contactFinder : undefined,
    finderOpen ? taxNotices : undefined,
  ].filter(Boolean).length;
  const waiting = n.sentBack + (approver ? n.queue : 0) + n.reconOpen;

  return (
    <div className="space-y-8">
      {/*
        The welcome: once a session, the first time the workspace opens after
        signing in, the greeting drops in over the four bands and they sweep
        away to the hero underneath. Shown only when the <head> script decided
        so before first paint; otherwise it is never displayed. The greeting is
        the hero's own, by the person's own name.
      */}
      <IntroCurtain
        text={`Good ${partOfDay}, ${firstName}.`}
        tag={`${weekday} · FY ${fiscal.label}`}
        storageKey="tfi-welcome"
      />

      {/* ── Who you are, when it is, and how much of this exists ──
          The workspace's one signature moment, in the same frame every tool
          opens with: the greeting as the headline, the doorways — one per tool,
          the middle one lit — standing beside it, and the working under it. */}
      <ToolHero
        id="hub-greeting"
        label={`${weekday} ${partOfDay} · FY ${fiscal.label} · India`}
        pill={{ text: `${liveTotal} live`, tone: 'var(--status-approved)', live: true }}
        title={`Good ${partOfDay}, ${firstName}.`}
        mark={firstName}
        glow="var(--color-brand-500)"
        /*
          Two corrections, both about not saying more than is true.

          This claimed the rest were "being built in the order below", which
          everything under it contradicted: nothing is in build and all four
          roadmap cards say Not started yet. The order is real, so the order
          is what it claims.

          And the count is counted rather than written. It said "Two of these"
          in prose, a few pixels from a meter that works the same number out
          for itself.
        */
        sub="Everything the firm runs is here. The ones open for work today are marked, and the rest are written down in the order they will be built."
        scene={
          <ArchScene
            motif="doorways"
            className="h-full min-h-[19rem]"
            seal={
              <SealFigure
                value={openToYou}
                note={openToYou === 1 ? 'tool open to you' : 'tools open to you'}
              />
            }
          />
        }
      >
        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          {/* The desk's own recommendation, from the same ranking the dashboard
              uses, so the first button on the first screen is the thing most
              likely to need you. */}
          <Link
            href={brief.cta.href}
            className={buttonClass({ variant: 'primary', className: 'group' })}
          >
            {brief.cta.label}
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
          <Link href="/ask" className={buttonClass({ className: 'group' })}>
            <Sparkles className="size-4 transition-transform group-hover:scale-110" aria-hidden />
            Ask which tool fits
          </Link>
        </div>

        {/*
          The working: what you can open, what is waiting, what is still to
          come, and the roster bar that shows all three at once. Every figure
          is a count this page already made, and the bar is drawn from the same
          SOLUTIONS list the cards below are.
        */}
        <div className="surface-sunken a-inner mt-8 rounded-2xl border p-4 sm:p-5">
          <div className="grid gap-2.5 sm:grid-cols-3">
            <HeroStat
              strong
              label="Open to you"
              value={<Figure value={openToYou} delay={120} />}
              note={`Of ${SOLUTIONS.length} on the roster`}
            />
            <HeroStat
              label="Waiting on you"
              tone={waiting > 0 ? 'var(--status-pending)' : undefined}
              value={<Figure value={waiting} delay={200} />}
              note={
                approver
                  ? 'Sent back, yours to approve, or not tying out'
                  : 'Sent back to you, or not tying out'
              }
            />
            <HeroStat
              label="On the way"
              tone="var(--status-draft)"
              value={<Figure value={rest.length} delay={280} />}
              note="Written down, in build order"
            />
          </div>

          <p className="a-label mt-5">The roster</p>
          <RosterMeter className="mt-2.5" />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <HeroChip icon={ShieldCheck} className="max-w-full">
            <span className="min-w-0" title={ROLE_META[user.role].grants}>
              <span className="font-semibold text-[var(--text-c)]">
                {ROLE_META[user.role].label}
              </span>
              <span className="px-1.5 opacity-50">·</span>
              {ROLE_META[user.role].grants}
            </span>
          </HeroChip>
          <HeroChip icon={CalendarDays}>
            <span>
              <span className="numeric font-semibold text-[var(--text-c)]">{fiscal.daysLeft}</span>{' '}
              {fiscal.daysLeft === 1 ? 'day' : 'days'} left in FY {fiscal.label}
            </span>
          </HeroChip>
        </div>
      </ToolHero>

      {/* ── What is not set up yet, while any of it is not ──
          Above the tools rather than below them, because the tools are what it is
          about: an owner who scrolls past this to open Voucher Desk and finds a
          chapter dropdown with nothing in it has been told nothing. It removes
          itself once there is nothing left to say. */}
      {setup && <SetupChecklist state={setup} />}

      {/*
        ── The ones you can use ──

        Three abreast, not one per row.

        These were full-width slabs stacked vertically, which made the answer to
        the only question this page asks — which of my tools needs me — four
        screens of scrolling. Three to a row puts every live tool above the fold
        on a laptop and lets the four instrument panels be compared at a glance,
        which is the whole point of putting figures on the front of them.

        `items-stretch` and `h-full` on each cell so a row of cards is one row of
        equal-height objects rather than four ragged ones; the cards themselves
        push their panels to the foot to make that alignment mean something.

        The wrapper divs stay individual rather than becoming a `.stagger`,
        because these are load-time entrances above the fold: `.stagger` is now
        scroll-driven, and an element that is already on screen at load has
        nothing to scroll into.
      */}
      <section aria-labelledby="hub-live">
        <SectionHead
          id="hub-live"
          count={openToYou}
          title="Open for work"
          note="The figures are live, read from each tool as this page opens."
        />
        <div className="mt-5 grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
          {voucherDesk && (
            <div className="h-full animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_60ms_backwards]">
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
            <div className="h-full animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_120ms_backwards]">
              <LiveSolutionCard
                solution={reconciliation}
                readings={reconReadings}
                note={reconBrief.text}
                noteTone={reconBrief.tone}
                shortcut={{ href: '/reconcile/history', label: 'History', icon: History }}
              />
            </div>
          )}

          {valuationDesk && (
            <div className="h-full animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_180ms_backwards]">
              <LiveSolutionCard
                solution={valuationDesk}
                readings={valuationReadings}
                note={valuationBrief.text}
                noteTone={valuationBrief.tone}
                // Seeding writes into data every workspace on the platform reads,
                // so the shortcut that does it is for an admin only — see
                // src/app/actions/valuationIngest.ts for why. Anybody else has no
                // second reason to come here beyond opening Comparables, which
                // the card itself already is.
                shortcut={
                  isAdmin(user.role)
                    ? { href: '/comps/ingest', label: 'Seed the registry', icon: UploadCloud }
                    : undefined
                }
              />
            </div>
          )}

          {/*
          Shown to whoever can actually open it, which today is the platform
          allowlist rather than every signed-in person.

          Not a contradiction with its being 'live' on the public roster: it is
          built and running, and who may spend from a shared credit pool is a
          commercial question rather than a claim about whether the tool exists.
          A card every tenant could see and only two people could open would be
          the dishonest version of this.

          Opening it wider is real work rather than a flag: the shared caches in
          migration 0031 are readable only by that same list, and one of them
          holds revealed email addresses and phone numbers.
        */}
          {landedCost && (
            <div className="h-full animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_240ms_backwards]">
              <LiveSolutionCard
                solution={landedCost}
                readings={[]}
                note=""
                // Counted in the browser, where the schedules are. See LandedPanel.
                panel={<LandedPanel userId={user.id} />}
              />
            </div>
          )}

          {wealthTracker && (
            <div className="h-full animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_240ms_backwards]">
              <LiveSolutionCard
                solution={wealthTracker}
                readings={[]}
                note=""
                // Counted in the browser, where the record is. See WealthPanel.
                panel={<WealthPanel userId={user.id} />}
              />
            </div>
          )}

          {contactFinder && finderOpen && (
            <div className="h-full animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_240ms_backwards]">
              <LiveSolutionCard
                solution={contactFinder}
                readings={finderReadings}
                note={finderBrief.text}
                noteTone={finderBrief.tone}
              />
            </div>
          )}

          {taxNotices && finderOpen && (
            <div className="h-full animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_240ms_backwards]">
              <LiveSolutionCard solution={taxNotices} readings={noticeReadings} note={noticeBrief.text} noteTone={noticeBrief.tone} />
            </div>
          )}

          {/*
          The last cell of the grid, and the one place on the screen that
          answers "which of these do I want" for somebody who does not know
          yet. Spans whatever the row has left, so the live tools never end
          on a hole; see AskCard for why it is a door rather than a filler.
        */}
          <AskCard liveCount={openToYou} />
        </div>
      </section>

      {/* ── The rest of the roster ── */}
      <section aria-labelledby="hub-roadmap">
        <SectionHead
          id="hub-roadmap"
          count={rest.length}
          title="On the way"
          note="Not switched on yet. Each one says where it has got to, and asking for one counts."
        />

        <ul className="stagger mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((solution) => (
            <li key={solution.slug} className="h-full">
              <SolutionCard solution={solution} asked={askedSet.has(solution.slug)} />
            </li>
          ))}
          {/* Closes the row rather than leaving a hole after the last roadmap
              card, the same way AskCard closes the live grid. */}
          <li
            className={cn(
              'h-full',
              SM_SPAN[remaining(rest.length, 2) as 1 | 2],
              LG_SPAN[remaining(rest.length, 3) as 1 | 2 | 3],
            )}
          >
            <RequestCard />
          </li>
        </ul>
      </section>
    </div>
  );
}

/**
 * The heading over each half of the screen: a count in a tile, the title in
 * the display face, and one line saying what is under it. Local because the
 * hub is the only screen with two grids of tools to tell apart.
 */
function SectionHead({
  id,
  count,
  title,
  note,
}: {
  id: string;
  count: number;
  title: string;
  note: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 items-center gap-3">
        <span className="surface-sunken a-inner grid h-9 min-w-9 place-items-center rounded-xl border px-2 text-[15px] font-semibold tracking-tight tabular-nums">
          {count}
        </span>
        <h2 id={id} className="m-display text-[1.45rem] leading-tight">
          {title}
        </h2>
      </div>
      <p className="text-subtle text-[12px] text-pretty">{note}</p>
    </div>
  );
}

/** Whole class names, because Tailwind cannot see a class built at runtime. */
const SM_SPAN = { 1: 'sm:col-span-1', 2: 'sm:col-span-2' } as const;
const LG_SPAN = { 1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3' } as const;

/** Local because it is two words of grammar, not a utility. */
function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

/** The date `days` before an IST day, as YYYY-MM-DD. */
function daysBefore(day: string, days: number): string {
  return new Date(Date.parse(`${day}T12:00:00+05:30`) - days * 86_400_000).toISOString().slice(0, 10);
}

function readClock(): number {
  return Date.now();
}
