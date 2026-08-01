import Link from 'next/link';
import { ShieldCheck, FileCheck2, History } from 'lucide-react';

/**
 * Shell for /login and /signup.
 *
 * The brand panel is not decoration: the one thing worth saying about this
 * system is that its approvals are enforced rather than typed, so that is what
 * the panel says. It is hidden below `lg` — on a phone the form should be the
 * whole screen, not a scroll past marketing.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      <main className="relative flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          {/* Compact mark, for the viewports where the brand panel is hidden. */}
          <Link href="/login" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Logo />
            <span className="text-lg font-semibold tracking-tight">N V R &amp; Co</span>
          </Link>

          {children}
        </div>
      </main>
    </div>
  );
}

function Logo({ className = '' }: { className?: string }) {
  return (
    <span
      className={`gradient-brand elev-brand grid size-9 shrink-0 place-items-center rounded-xl text-[11px] font-bold tracking-tight text-white ${className}`}
    >
      NVR
    </span>
  );
}

const POINTS = [
  {
    icon: ShieldCheck,
    title: 'Two approvals, two people',
    body: 'Postgres refuses to let anyone approve a voucher they raised, or give the second approval after giving the first.',
  },
  {
    icon: FileCheck2,
    title: 'Numbered on submission',
    body: 'Voucher numbers are issued by the database, unique per chapter per financial year. Never hand-typed, never duplicated.',
  },
  {
    icon: History,
    title: 'History that cannot be rewritten',
    body: 'Every transition is appended to an audit trail with no update or delete path — not even for an owner.',
  },
];

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-brand-900 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
      {/*
        Colour comes from three oversized radial blobs drifting on long, offset
        cycles, rather than a static gradient — it keeps the large flat area from
        looking like a solid block without ever pulling focus from the form.
      */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="animate-[drift_22s_ease-in-out_infinite_alternate] absolute -top-1/4 -left-1/4 size-[70%] rounded-full bg-[radial-gradient(circle,var(--color-brand-500),transparent_65%)] opacity-70 blur-3xl" />
        <div className="animate-[drift_28s_ease-in-out_infinite_alternate-reverse] absolute top-1/3 -right-1/4 size-[65%] rounded-full bg-[radial-gradient(circle,var(--color-accent-500),transparent_65%)] opacity-55 blur-3xl" />
        <div className="animate-[drift_34s_ease-in-out_infinite_alternate] absolute -bottom-1/4 left-1/4 size-[60%] rounded-full bg-[radial-gradient(circle,var(--color-brand-400),transparent_60%)] opacity-40 blur-3xl" />
      </div>

      {/* Hairline grid, barely visible — gives the blobs something to sit on. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:56px_56px]"
      />

      <div className="relative flex items-center gap-3">
        <Logo />
        <div className="leading-tight">
          <p className="font-semibold tracking-tight">N V R &amp; Co</p>
          <p className="text-xs text-white/60">Chartered Accountants</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <h1 className="text-4xl font-bold tracking-tight text-balance">
          Every voucher, properly approved.
        </h1>
        <p className="mt-4 text-white/70">
          Payment vouchers for the CIO Association — raised, reviewed and signed off through an
          approval chain the database itself enforces.
        </p>

        <ul className="mt-10 space-y-5">
          {POINTS.map((p) => (
            <li key={p.title} className="flex gap-3.5">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15 backdrop-blur">
                <p.icon className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">{p.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-white/60">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <WorkflowRail />
    </aside>
  );
}

/** The state machine, drawn small. It is the shape of the whole product. */
function WorkflowRail() {
  const steps = ['Draft', '1st approval', '2nd approval', 'Approved'];

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full bg-white/10 py-1.5 pr-3.5 pl-2 ring-1 ring-white/15 backdrop-blur">
              <span
                aria-hidden
                className={
                  i === steps.length - 1
                    ? 'size-1.5 rounded-full bg-emerald-300'
                    : 'size-1.5 rounded-full bg-white/50'
                }
              />
              <span className="text-[11px] font-medium whitespace-nowrap text-white/80">
                {label}
              </span>
            </div>
            {i < steps.length - 1 && <span aria-hidden className="h-px w-4 bg-white/25" />}
          </div>
        ))}
      </div>
    </div>
  );
}
