import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, Lock, LogIn } from 'lucide-react';
import { SOLUTIONS } from '@/lib/solutions';
import { OPEN_TOOLS } from '@/lib/access';
import { buttonClass, Card, CardBody, CardTitle } from '@/components/ui/primitives';
import { ArchScene, type SceneMotif } from '@/components/ui/Scene';
import { HeroChip, ToolHero } from '@/components/ui/ToolHero';
import { AccessRequest } from './AccessRequest';

const MOTIF: Record<string, SceneMotif> = {
  'voucher-desk': 'voucher',
  'ledger-reconciliation': 'scales',
  'valuation-desk': 'columns',
  'contact-finder': 'seekers',
};

/**
 * What a locked tool shows to anybody who may not use it.
 *
 * The whole tool, described, rather than a wall: its promise, everything it
 * does (the same `does` list the public page prints, which is a promise about
 * the code), what goes in and what comes out, and the way to ask for it. Every
 * screen under the tool renders this in place of itself, so a deep link to a
 * voucher or a saved reconciliation lands here too rather than on a sign-in
 * screen that would open nothing.
 *
 * Signing in does not unlock it, and the screen says so before anybody signs
 * in hoping it will.
 */
export function LockedTool({
  slug,
  signedIn,
  name,
  email,
}: {
  slug: string;
  signedIn: boolean;
  name?: string | null;
  email?: string | null;
}) {
  const tool = SOLUTIONS.find((s) => s.slug === slug);
  if (!tool) return null;
  const open = SOLUTIONS.filter((s) => OPEN_TOOLS.includes(s.slug));

  return (
    <div className="space-y-6">
      <ToolHero
        id="locked-tool"
        label={tool.category}
        pill={{ icon: Lock, text: 'Access on request', tone: 'var(--status-warn)' }}
        title={tool.name}
        glow={tool.tone}
        sub={tool.pitch}
        scene={<ArchScene motif={MOTIF[slug] ?? 'gate'} className="h-full min-h-[17rem]" />}
      >
        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <a href="#request" className={buttonClass({ variant: 'primary', className: 'group' })}>
            Request access
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </a>
          <Link href={tool.plan} className={buttonClass({ className: 'group' })}>
            The full tour
            <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <HeroChip icon={Lock} className="max-w-full">
            <span className="min-w-0 text-pretty">
              Open to our team today. {signedIn ? 'Your account does not have it yet.' : 'Signing in does not open it.'}
            </span>
          </HeroChip>
        </div>
      </ToolHero>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardTitle title="What it does" description={tool.summary} />
          <CardBody>
            <ul className="space-y-3">
              {tool.does.map((line) => (
                <li key={line} className="flex gap-3 text-[13.5px] leading-relaxed text-pretty">
                  <Check className="mt-1 size-3.5 shrink-0" style={{ color: tool.tone }} aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <dl className="surface-sunken a-inner mt-6 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-2xl border p-4 text-[13px]">
              <dt className="a-label pt-px">Takes</dt>
              <dd className="text-muted text-pretty">{tool.inputs}</dd>
              <dt className="a-label pt-px" style={{ color: tool.tone }}>
                Gives
              </dt>
              <dd className="font-medium text-pretty">{tool.outputs}</dd>
            </dl>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card id="request" className="scroll-mt-24 overflow-hidden">
            <CardTitle
              icon={<Lock className="size-4" />}
              title={`Request access to ${tool.name}`}
              description="It comes straight to us, and a person replies."
            />
            <CardBody>
              <AccessRequest slug={slug} toolName={tool.name} name={name ?? ''} email={email ?? ''} />
            </CardBody>
          </Card>

          <Card className="overflow-hidden">
            <CardTitle
              title="Open to everybody, now"
              description={signedIn ? 'Both are yours to use, and your work is saved to your account.' : 'No account needed. Sign in only if you want your work saved to an account.'}
            />
            <CardBody className="grid gap-2.5">
              {open.map((t) => (
                <Link
                  key={t.slug}
                  href={t.open ?? t.plan}
                  className="surface-sunken a-inner group flex items-center gap-3 rounded-2xl border p-3 transition hover:border-[var(--border-strong)]"
                >
                  <span aria-hidden className="tinted grid size-9 shrink-0 place-items-center rounded-xl border" style={{ '--tone': t.tone } as React.CSSProperties}>
                    <t.icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold tracking-tight">{t.name}</span>
                    <span className="text-subtle block truncate text-xs">{t.category}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              ))}
              {!signedIn && (
                <Link href={`/login?next=${encodeURIComponent('/hub')}`} className={buttonClass({ size: 'sm', className: 'mt-1 justify-self-start' })}>
                  <LogIn className="size-4" aria-hidden />
                  Sign in
                </Link>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
