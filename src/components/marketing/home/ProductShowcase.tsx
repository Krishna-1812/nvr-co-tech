import {
  FileText,
  Inbox,
  LayoutDashboard,
  Lock,
  Settings,
  Users,
} from 'lucide-react';
import { fmtRupees } from '@/lib/domain/voucher';
import { BRAND } from '@/lib/marketing/content';
import { Container, Section, SectionHeading } from '../bits';
import { Reveal } from '../Reveal';
import { LogoMark } from '../Logo';

/**
 * The product, at a glance.
 *
 * This is a representative view rather than a screenshot: screenshots go stale
 * the week after they are taken, and a real one of an empty new deployment
 * shows nothing worth looking at. Everything here is composed from the same
 * tokens and the same money formatter as the application, so it stays honest
 * about what the thing actually looks like.
 */

type Row = {
  no: string;
  payee: string;
  chapter: string;
  amount: number;
  status: 'Paid' | 'Approved' | '2nd approval' | '1st approval' | 'Sent back' | 'Draft';
};

const ROWS: Row[] = [
  { no: '0058', payee: 'Lumina Events Pvt Ltd', chapter: 'Hyderabad', amount: 61_800, status: '1st approval' },
  { no: '0057', payee: 'Grid & Co Printing', chapter: 'Bengaluru', amount: 18_450, status: '2nd approval' },
  { no: '0056', payee: 'Sarvodaya Caterers', chapter: 'Chennai', amount: 142_000, status: 'Approved' },
  { no: '0055', payee: 'Nirvana Travel Desk', chapter: 'Mumbai', amount: 27_300, status: 'Sent back' },
  { no: '0054', payee: 'Axis Sound Systems', chapter: 'Bengaluru', amount: 96_500, status: 'Paid' },
];

const STATUS_COLOR: Record<Row['status'], string> = {
  Paid: 'var(--m-cyan)',
  Approved: 'var(--m-emerald)',
  '2nd approval': 'var(--m-amber)',
  '1st approval': 'var(--m-amber)',
  'Sent back': 'var(--m-rose)',
  Draft: 'var(--m-dim-2)',
};

const PIPELINE = [
  { label: 'Draft', n: 6, color: 'var(--m-dim-2)' },
  { label: '1st approval', n: 4, color: 'var(--m-amber)' },
  { label: '2nd approval', n: 3, color: 'var(--m-amber)' },
  { label: 'Approved', n: 11, color: 'var(--m-emerald)' },
  { label: 'Paid', n: 34, color: 'var(--m-cyan)' },
];

const ANNOTATIONS = [
  {
    n: '01',
    title: 'Your queue is only your work',
    body: 'Vouchers you raised yourself never turn up in your own approval list, so the number on the badge is work you can actually get through.',
  },
  {
    n: '02',
    title: 'You can see where everything is',
    body: 'One bar shows how far along every voucher is. If something is stuck, you spot it before anyone has to come and ask.',
  },
  {
    n: '03',
    title: 'Numbers you can rely on',
    body: 'The database works out the totals, not the browser, so the figure you see on screen is the figure that is saved.',
  },
  {
    n: '04',
    title: 'Every row keeps its history',
    body: 'Open any voucher and the whole story is there. Who did what, when, and why it was sent back. Nothing can be edited out.',
  },
];

export function ProductShowcase() {
  return (
    <Section id="product" className="overflow-hidden">
      <Container wide>
        <SectionHeading
          eyebrow="Inside Voucher Desk"
          title={
            <>
              No dashboard to work out.
              <br />
              <span className="m-serif m-dim">Just a list you can get through.</span>
            </>
          }
          lead="This is the tool that is live. The others will arrive in the same window, in the same list, so there is nothing new to learn each time one lands."
        />

        <Reveal delay={80} className="mt-14">
          {/* Wide by nature: it scrolls inside its own frame rather than making
              the page scroll sideways on a phone. */}
          <div className="m-card overflow-hidden p-0">
            <Chrome />
            <div className="overflow-x-auto">
              <div className="flex min-w-[820px]">
                <Rail />
                <Board />
              </div>
            </div>
          </div>
        </Reveal>

        <ol className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {ANNOTATIONS.map((a, i) => (
            <Reveal as="li" key={a.n} delay={i * 70}>
              <span className="m-mono text-[11px] tracking-[0.16em] text-[var(--m-cyan)]">{a.n}</span>
              <h3 className="mt-3 text-[14px] font-semibold">{a.title}</h3>
              <p className="m-dim mt-2 text-[13px] leading-relaxed">{a.body}</p>
            </Reveal>
          ))}
        </ol>
      </Container>
    </Section>
  );
}

/** Browser chrome. Just enough to read as "an application", not a skeuomorph. */
function Chrome() {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--m-line)] bg-white/[0.02] px-4 py-3">
      <span className="flex gap-1.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-white/12" />
        <span className="size-2.5 rounded-full bg-white/12" />
        <span className="size-2.5 rounded-full bg-white/12" />
      </span>
      <span className="m-mono m-dim-2 mx-auto flex items-center gap-2 rounded-full border border-[var(--m-line)] px-3 py-1 text-[10px]">
        <Lock className="size-2.5" aria-hidden />
        thefinanceintelligence.com/dashboard
      </span>
    </div>
  );
}

function Rail() {
  const items = [
    { icon: LayoutDashboard, label: 'Dashboard', active: true },
    { icon: FileText, label: 'Vouchers' },
    { icon: Inbox, label: 'Approvals', badge: 7 },
    { icon: Users, label: 'Admin' },
    { icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="w-48 shrink-0 border-r border-[var(--m-line)] bg-white/[0.015] p-3">
      <div className="flex items-center gap-2 px-2 py-2">
        <LogoMark id="showcase-mark" className="size-6" />
        <span className="m-display text-[12px]">{BRAND.name}</span>
      </div>

      <div className="mt-4 space-y-0.5">
        {items.map((it) => (
          <div
            key={it.label}
            className={
              it.active
                ? 'flex items-center gap-2.5 rounded-lg bg-white/[0.07] px-2.5 py-2 text-[12px] font-medium'
                : 'm-dim-2 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px]'
            }
          >
            <it.icon className="size-3.5 shrink-0" aria-hidden />
            {it.label}
            {it.badge && (
              <span
                className="m-mono ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-black"
                style={{ background: 'var(--m-amber)' }}
              >
                {it.badge}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Board() {
  return (
    <div className="min-w-0 flex-1 p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="m-display text-lg">Good morning, Anita</h3>
          <p className="m-dim-2 mt-1 text-[11px]">Seven vouchers are waiting on you.</p>
        </div>
        <span
          className="m-mono rounded-lg px-3 py-1.5 text-[10px] font-semibold text-white"
          style={{ backgroundImage: 'var(--m-grad)' }}
        >
          + New voucher
        </span>
      </div>

      {/* Stat tiles */}
      <div className="mt-5 grid grid-cols-4 gap-2.5">
        <Tile label="Awaiting you" value="7" accent="var(--m-amber)" />
        <Tile label="Raised this month" value="23" />
        <Tile label="Approved value" value={fmtRupees(2_847_500)} accent="var(--m-emerald)" />
        <Tile label="Average to approve" value="1.4 days" />
      </div>

      {/* Pipeline */}
      <div className="mt-4 rounded-xl border border-[var(--m-line)] p-4">
        <p className="m-eyebrow">Where everything sits</p>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full">
          {PIPELINE.map((p) => (
            <span
              key={p.label}
              style={{ flex: p.n, background: p.color, opacity: 0.85 }}
              className="first:rounded-l-full last:rounded-r-full"
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {PIPELINE.map((p) => (
            <span key={p.label} className="flex items-center gap-1.5 text-[10px]">
              <span className="size-1.5 rounded-full" style={{ background: p.color }} aria-hidden />
              <span className="m-dim-2">{p.label}</span>
              <span className="numeric font-semibold">{p.n}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--m-line)]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--m-line)] bg-white/[0.02]">
              <Th>Voucher</Th>
              <Th>Paid to</Th>
              <Th>Chapter</Th>
              <Th className="text-right">Grand total</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.no} className="border-b border-[var(--m-line)] last:border-0">
                <Td className="m-mono whitespace-nowrap">FI/CIO/25-26/{r.no}</Td>
                <Td className="font-medium">{r.payee}</Td>
                <Td className="m-dim-2">{r.chapter}</Td>
                <Td className="numeric text-right tabular-nums">{fmtRupees(r.amount)}</Td>
                <Td>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap"
                    style={{
                      color: STATUS_COLOR[r.status],
                      borderColor: `color-mix(in oklab, ${STATUS_COLOR[r.status]} 30%, transparent)`,
                      background: `color-mix(in oklab, ${STATUS_COLOR[r.status]} 10%, transparent)`,
                    }}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: STATUS_COLOR[r.status] }}
                      aria-hidden
                    />
                    {r.status}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-[var(--m-line)] p-3">
      <p className="m-dim-2 text-[10px] leading-tight">{label}</p>
      <p
        className="m-display numeric mt-2 text-base tracking-tight"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`m-eyebrow px-3 py-2.5 text-[9px] font-medium normal-case ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 text-[11px] ${className}`}>{children}</td>;
}
