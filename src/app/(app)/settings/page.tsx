import { Check, Palette, ShieldCheck, UserRound } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { canApprove, ROLE_META, USER_ROLES, type UserRole } from '@/lib/domain/workflow';
import { Card, CardBody, CardTitle } from '@/components/ui/primitives';
import { PageHeader } from '@/components/PageHeader';
import { ProfileCard } from './ProfileCard';
import { ThemeChoice } from './ThemeChoice';
import { SignOutButton } from './SignOutButton';

export const metadata = { title: 'Settings' };

/**
 * Your own account. Role is shown but never editable here — it moves only
 * through set_user_role(), which an owner drives from /admin.
 */
export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const count = () =>
    supabase.from('vouchers').select('id', { count: 'exact', head: true }).is('deleted_at', null);

  /*
   * Approvals are counted as two queries rather than one `or` filter, which keeps
   * this working against the preview client as well as Postgres. Nothing is double
   * counted: a voucher's two approvals must come from two different people, so the
   * same person can never be both approver_1 and approver_2 on one row.
   */
  const [raised, approver1, approver2, profile] = await Promise.all([
    count().eq('created_by', user.id),
    canApprove(user.role) ? count().eq('approver_1', user.id) : null,
    canApprove(user.role) ? count().eq('approver_2', user.id) : null,
    supabase.from('profiles').select('created_at').eq('id', user.id).maybeSingle(),
  ]);

  const approved = canApprove(user.role)
    ? (approver1?.count ?? 0) + (approver2?.count ?? 0)
    : null;

  // "Aug 2025", in Kolkata, so somebody who joined late one evening is not told
  // they joined the previous month.
  const memberSince = profile.data?.created_at
    ? new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        month: 'short',
        year: 'numeric',
      }).format(new Date(profile.data.created_at))
    : 'Unknown';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Your account and how this app looks."
      />

      <ProfileCard
        user={user}
        raised={raised.count ?? 0}
        approved={approved}
        memberSince={memberSince}
      />

      <Card className="overflow-hidden">
        <CardTitle
          icon={<ShieldCheck className="size-4" />}
          title="Your access"
          description="Granted by an owner. It cannot be changed from here."
        />
        <CardBody>
          <RoleLadder current={user.role} />
        </CardBody>
      </Card>

      <Card>
        <CardTitle
          icon={<Palette className="size-4" />}
          title="Appearance"
          description="Saved on this device."
        />
        <CardBody>
          <ThemeChoice />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <UserRound className="text-subtle size-4" aria-hidden />
            <div>
              <p className="font-semibold">Sign out</p>
              <p className="text-muted mt-0.5 text-sm">
                Ends this session on this device only.
              </p>
            </div>
          </div>
          <SignOutButton />
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * The whole ladder, not just the rung you are on.
 *
 * Drawn as a ladder because that is genuinely what it is: the roles are cumulative,
 * so an admin can do everything an approver can. Marking every rung up to yours as
 * held — rather than highlighting one row and dimming the rest — is both prettier
 * and more accurate, and it answers the question people actually arrive with, which
 * is "why can I not see the approval queue".
 */
function RoleLadder({ current }: { current: UserRole }) {
  const held = USER_ROLES.indexOf(current);

  return (
    <ol className="space-y-1">
      {USER_ROLES.map((role, i) => {
        const meta = ROLE_META[role];
        const has = i <= held;
        const you = i === held;
        const last = i === USER_ROLES.length - 1;

        return (
          <li key={role} className="relative flex gap-3.5">
            {/* The rail between rungs, lit only as far as this person's access
                reaches. */}
            {!last && (
              <span
                aria-hidden
                className="absolute top-6 bottom-0 left-[9px] w-px"
                style={{
                  background: i < held ? 'var(--color-brand-500)' : 'var(--border-c)',
                  opacity: i < held ? 0.5 : 1,
                }}
              />
            )}

            <span
              aria-hidden
              className={
                has
                  ? 'gradient-brand elev-brand mt-2.5 grid size-[18px] shrink-0 place-items-center rounded-full text-white'
                  : 'mt-2.5 size-[18px] shrink-0 rounded-full border-2 border-dashed border-[var(--border-strong)]'
              }
            >
              {has && <Check className="size-2.5" strokeWidth={3.5} />}
            </span>

            <div
              className={
                you
                  ? 'min-w-0 flex-1 rounded-xl border border-brand-500 bg-brand-50 px-3.5 py-2.5 dark:bg-brand-900/30'
                  : 'min-w-0 flex-1 rounded-xl border border-transparent px-3.5 py-2.5'
              }
            >
              {/*
                The rungs above yours are dimmed with the muted text colour rather
                than by lowering the opacity of the whole row — half-opacity text
                on a tinted card drops below a readable contrast ratio.
              */}
              <p className={has ? 'text-sm font-semibold' : 'text-muted text-sm font-semibold'}>
                {meta.label}
                {you && (
                  <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                    You
                  </span>
                )}
              </p>
              <p className={has ? 'text-muted mt-0.5 text-sm' : 'text-subtle mt-0.5 text-sm'}>
                {meta.grants}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
