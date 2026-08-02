import Link from 'next/link';
import { ArrowLeft, FileCheck2, History, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/marketing/Logo';
import { Aurora } from '@/components/marketing/bits';
import { BRAND } from '@/lib/marketing/content';

/**
 * Shell for /login and /signup.
 *
 * Skinned as part of the public site rather than the application. Signing in is
 * the last step of the marketing journey, not the first step of the product, and
 * arriving at a white form from a dark site reads as leaving one company's
 * website for another's.
 *
 * The forms inside are the app's own primitives, unchanged — the night skin
 * redefines the tokens they read, so they come out dark without being forked.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-skin="night" className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      <main className="relative flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          {/* The brand panel is hidden below lg, so the mark has to appear here. */}
          <Link href="/" className="mb-9 inline-flex lg:hidden">
            <Logo id="auth-mobile-mark" />
          </Link>

          {children}

          <p className="mt-10 text-center">
            <Link
              href="/"
              className="m-dim-2 inline-flex items-center gap-1.5 text-xs transition hover:text-[var(--m-ink)]"
            >
              <ArrowLeft className="size-3" aria-hidden />
              Back to {BRAND.name}
            </Link>
          </p>
        </div>
      </main>
    </div>
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
    <aside className="relative hidden overflow-hidden border-r border-[var(--m-line)] lg:flex lg:flex-col lg:justify-between lg:p-12">
      {/*
        Three oversized fields drifting on long, offset cycles rather than a
        static gradient — it keeps a large flat area from reading as a solid
        block without ever pulling focus from the form.
      */}
      <Aurora
        color="var(--m-indigo)"
        opacity={0.34}
        className="animate-[drift_22s_ease-in-out_infinite_alternate] -top-1/4 -left-1/4 size-[70%]"
      />
      <Aurora
        color="var(--m-violet)"
        opacity={0.26}
        className="animate-[drift_28s_ease-in-out_infinite_alternate-reverse] top-1/3 -right-1/4 size-[65%]"
      />
      <Aurora
        color="var(--m-cyan)"
        opacity={0.14}
        className="animate-[drift_34s_ease-in-out_infinite_alternate] -bottom-1/4 left-1/4 size-[60%]"
      />

      <div
        aria-hidden
        className="m-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(80%_80%_at_30%_20%,#000,transparent)]"
      />

      <Link href="/" className="relative transition hover:opacity-85">
        <Logo id="auth-mark" />
      </Link>

      <div className="relative max-w-md">
        <p className="m-eyebrow">Voucher Desk</p>
        <h1 className="m-display mt-4 text-[2.6rem]">
          Every voucher,
          <br />
          <span className="m-serif m-grad-text">properly approved.</span>
        </h1>
        <p className="m-dim mt-5 text-[15px] leading-relaxed">
          Payment vouchers for the CIO Association — raised, reviewed and signed off through an
          approval chain the database itself enforces.
        </p>

        <ul className="mt-10 space-y-5">
          {POINTS.map((p) => (
            <li key={p.title} className="flex gap-3.5">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--m-line)] bg-white/[0.04]">
                <p.icon className="size-4 text-[var(--m-cyan)]" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">{p.title}</p>
                <p className="m-dim-2 mt-1 text-[13px] leading-relaxed">{p.body}</p>
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
    <div className="relative flex items-center gap-2">
      {steps.map((label, i) => {
        const last = i === steps.length - 1;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-[var(--m-line)] bg-white/[0.04] py-1.5 pr-3.5 pl-2.5 backdrop-blur">
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ background: last ? 'var(--m-emerald)' : 'var(--m-dim-2)' }}
              />
              <span className="m-dim text-[11px] font-medium whitespace-nowrap">{label}</span>
            </div>
            {!last && <span aria-hidden className="h-px w-4 bg-[var(--m-line-2)]" />}
          </div>
        );
      })}
    </div>
  );
}
