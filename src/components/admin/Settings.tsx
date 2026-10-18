'use client';

import { useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Download, KeyRound, Lock, ShieldCheck, Trash2, UserPlus, X } from 'lucide-react';
import { addAdmin, grantTool, removeAdmin, resetVisits, revokeTool, setExcludeAdmins } from '@/app/actions/adminSettings';
import type { ActionResult } from '@/app/actions/workflow';
import { Button, Card, CardTitle, Field, Input, Select } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { stamp } from './when';

/**
 * The four sections of Admin settings. Each change goes through a server
 * action in actions/adminSettings, which re-checks the admin list and calls a
 * database function that checks it again (migration 0035).
 */

export type AdminRow = { email: string; note: string | null; builtIn: boolean; name: string | null; you: boolean };
export type GrantRow = { email: string; tool: string; toolName: string; grantedBy: string | null; at: string; name: string | null };
export type Waiting = { email: string; name: string | null; tool: string; toolName: string; at: string };

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error);
      else {
        after?.();
        router.refresh();
      }
    });
  return { pending, error, run };
}

function Problem({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="tinted rounded-xl border px-3 py-2 text-[13px] [--tone:var(--status-rejected)]">
      {error}
    </p>
  );
}

function Who({ name, email, children }: { name: string | null; email: string; children?: ReactNode }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="truncate text-[13.5px] font-semibold">{name ?? email}</span>
        {children}
      </span>
      {name && <span className="text-subtle block truncate text-[12px]">{email}</span>}
    </span>
  );
}

function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span style={{ '--tone': tone } as CSSProperties} className="tinted rounded-full border px-2 py-px text-[10px] font-bold tracking-wide uppercase">
      {children}
    </span>
  );
}

// ── Admins ──────────────────────────────────────────────────────────────────

export function AdminsCard({ admins }: { admins: AdminRow[] }) {
  const { pending, error, run } = useRun();
  const [email, setEmail] = useState('');
  const [removing, setRemoving] = useState<AdminRow | null>(null);

  return (
    <Card className="overflow-hidden">
      <CardTitle
        icon={<ShieldCheck className="size-4" />}
        title="Admins"
        description="Admins have every tool, this Admin area and its settings. Add someone by the email they sign in with."
      />
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <ul className="space-y-1.5">
          {admins.map((a) => (
            <li key={a.email} className="surface-sunken flex items-center gap-3 rounded-2xl border px-3 py-2.5">
              <Who name={a.name} email={a.email}>
                {a.you && <Badge tone="var(--status-approved)">You</Badge>}
                {a.builtIn && <Badge tone="var(--color-brand-500)">Built in</Badge>}
              </Who>
              {!a.builtIn && !a.you && (
                <Button size="sm" variant="ghost" onClick={() => setRemoving(a)} aria-label={`Remove ${a.email}`}>
                  <Trash2 className="size-3.5" aria-hidden /> Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addAdmin({ email }), () => setEmail(''));
          }}
        >
          <Field label="Add an admin" htmlFor="admin-email" hint="Their sign-in email, Google or email and password.">
            <Input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required />
          </Field>
          <Button type="submit" variant="primary" loading={pending} className="sm:mb-[22px]">
            <UserPlus className="size-4" aria-hidden /> Add
          </Button>
        </form>
        <Problem error={error} />
      </div>

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name ?? removing?.email}?`}
        description="They lose the locked tools, this Admin area and these settings at once. Their account and their own work stay."
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setRemoving(null)}>Keep</Button>
          <Button variant="danger" loading={pending} onClick={() => removing && run(() => removeAdmin(removing.email), () => setRemoving(null))}>
            Remove admin
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

// ── Tool access ─────────────────────────────────────────────────────────────

export function AccessCard({ grants, waiting, tools }: { grants: GrantRow[]; waiting: Waiting[]; tools: { slug: string; name: string }[] }) {
  const { pending, error, run } = useRun();
  const [email, setEmail] = useState('');
  const [tool, setTool] = useState(tools[0]?.slug ?? '');

  return (
    <Card className="overflow-hidden">
      <CardTitle
        icon={<KeyRound className="size-4" />}
        title="Tool access"
        description="Open a locked tool for one person: they see it as open the next time they load a page. Contact Finder stays with admins."
      />
      <div className="space-y-5 px-5 py-5 sm:px-6">
        {waiting.length > 0 && (
          <div>
            <p className="a-label mb-2">Asked for, not yet opened</p>
            <ul className="space-y-1.5">
              {waiting.map((w) => (
                <li key={`${w.email}-${w.tool}`} className="tinted flex flex-wrap items-center gap-3 rounded-2xl border px-3 py-2.5 [--tone:var(--status-warn)]">
                  <Who name={w.name} email={w.email}>
                    <span className="text-muted text-[12px]">
                      wants {w.toolName} · {stamp(w.at, false)}
                    </span>
                  </Who>
                  <Button size="sm" variant="primary" loading={pending} onClick={() => run(() => grantTool({ email: w.email, tool: w.tool }))}>
                    <Check className="size-3.5" aria-hidden /> Open {w.toolName}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="a-label mb-2">Opened for</p>
          {grants.length === 0 ? (
            <p className="text-subtle text-[13px]">Nobody outside the admins has a locked tool yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {grants.map((g) => (
                <li key={`${g.email}-${g.tool}`} className="surface-sunken flex flex-wrap items-center gap-3 rounded-2xl border px-3 py-2.5">
                  <Who name={g.name} email={g.email}>
                    <Badge tone="var(--status-approved)">{g.toolName}</Badge>
                  </Who>
                  <span className="text-subtle text-[12px]">
                    {stamp(g.at, false)}
                    {g.grantedBy ? ` · by ${g.grantedBy}` : ''}
                  </span>
                  <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => revokeTool({ email: g.email, tool: g.tool }))}>
                    <X className="size-3.5" aria-hidden /> Close
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => grantTool({ email, tool }), () => setEmail(''));
          }}
        >
          <Field label="Email" htmlFor="grant-email">
            <Input id="grant-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required />
          </Field>
          <Field label="Tool" htmlFor="grant-tool">
            <Select id="grant-tool" value={tool} onChange={(e) => setTool(e.target.value)}>
              {tools.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="primary" loading={pending}>
            <Lock className="size-4" aria-hidden /> Open it
          </Button>
        </form>
        <Problem error={error} />
      </div>
    </Card>
  );
}

// ── Tracking ────────────────────────────────────────────────────────────────

export function TrackingCard({ excludeAdmins }: { excludeAdmins: boolean }) {
  const { pending, error, run } = useRun();
  const [on, setOn] = useState(excludeAdmins);

  return (
    <Card className="overflow-hidden">
      <CardTitle
        icon={<ShieldCheck className="size-4" />}
        title="Counting"
        description="How the Admin figures are worked out. Nothing recorded is deleted by these switches."
      />
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <label className="surface-sunken flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3.5">
          <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={pending}
            onClick={() => {
              const next = !on;
              setOn(next);
              run(() => setExcludeAdmins(next));
            }}
            className={cn(
              'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition',
              on ? 'bg-[var(--action)]' : 'bg-[var(--surface-raised)]',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 size-[18px] rounded-full shadow transition-all',
                on ? 'left-[22px] bg-[var(--on-action)]' : 'left-0.5 bg-[var(--text-subtle)]',
              )}
            />
          </button>
          <span>
            <span className="block text-[14px] font-semibold">Leave admins out of the figures</span>
            <span className="text-muted mt-0.5 block text-[13px] text-pretty">
              Your own visits while checking the site will not count as people, visits or time. They are still recorded, so turning this off brings them back.
            </span>
          </span>
        </label>
        <Problem error={error} />
      </div>
    </Card>
  );
}

// ── Data ────────────────────────────────────────────────────────────────────

export function DataCard({ visitors, views }: { visitors: number; views: number }) {
  const { pending, error, run } = useRun();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');

  return (
    <Card className="overflow-hidden">
      <CardTitle icon={<Download className="size-4" />} title="Data" description={`${visitors.toLocaleString('en-IN')} visitors and ${views.toLocaleString('en-IN')} page views recorded.`} />
      <div className="space-y-3 px-5 py-5 sm:px-6">
        <div className="surface-sunken flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3.5">
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold">Download every visit</span>
            <span className="text-muted block text-[13px]">A spreadsheet (CSV) with one row per page view: who, where, how long, from where.</span>
          </span>
          <a
            href="/analytics/export"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--action)] px-4 py-2 text-[13px] font-semibold text-[var(--on-action)] shadow-[var(--elev-brand)]"
          >
            <Download className="size-4" aria-hidden /> Download
          </a>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed px-4 py-3.5">
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold">Clear the visit data</span>
            <span className="text-muted block text-[13px]">Deletes every visitor and page view so the figures start from zero. Accounts and requests are kept.</span>
          </span>
          <Button variant="ghost" className="text-[var(--status-rejected)]" onClick={() => setConfirming(true)}>
            <Trash2 className="size-4" aria-hidden /> Clear
          </Button>
        </div>
        <Problem error={error} />
      </div>

      <Modal
        open={confirming}
        onClose={() => {
          setConfirming(false);
          setTyped('');
        }}
        title="Clear every visit?"
        description="This deletes all recorded visitors and page views for good. Download them first if you might want them."
      >
        <Field label='Type "clear" to confirm' htmlFor="clear-confirm">
          <Input id="clear-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setConfirming(false)}>Keep</Button>
          <Button
            variant="danger"
            disabled={typed.trim().toLowerCase() !== 'clear'}
            loading={pending}
            onClick={() =>
              run(
                () => resetVisits(typed),
                () => {
                  setConfirming(false);
                  setTyped('');
                },
              )
            }
          >
            Clear everything
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
