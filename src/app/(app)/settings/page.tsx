import { Check, Palette, ShieldCheck, ShieldOff, UserRound } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { canApprove, isOwner, ROLE_META, USER_ROLES, type UserRole } from '@/lib/domain/workflow';
import { Card, CardBody, CardTitle, IconTile } from '@/components/ui/primitives';
import { PageHeader } from '@/components/PageHeader';
import { ProfileCard } from './ProfileCard';
import { ThemeChoice } from './ThemeChoice';
import { SignOutButton, SignOutEverywhereButton } from './SignOutButton';
import { ChangePasswordForm } from './ChangePasswordForm';
import { ChangeEmailForm } from './ChangeEmailForm';
import { OrganizationForm } from './OrganizationForm';

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
   * counted: the same person can never be both approver_1 and approver_2 on one
   * row, so summing the two queries never counts a single approval twice. Most
   * vouchers only ever need one approval now (0015) — approver_2 stays populated
   * only on the rare voucher that entered the queue before that shipped.
   */
  const [raised, approver1, approver2, profile, org] = await Promise.all([
    count().eq('created_by', user.id),
    canApprove(user.role) ? count().eq('approver_1', user.id) : null,
    canApprove(user.role) ? count().eq('approver_2', user.id) : null,
    supabase.from('profiles').select('created_at').eq('id', user.id).maybeSingle(),
    // One row, because the policies only ever show you your own (0012).
    // maybeSingle rather than single: this layout guarantees a membership, so a
    // missing row is not a state anybody reaches, and it is not worth failing
    // the whole screen over if one ever does.
    supabase.from('organizations').select('name').maybeSingle(),
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

      <ChangeEmailForm email={user.authEmail} />
      <ChangePasswordForm email={user.authEmail} />

      {/* Above "Your access", because the two answer the same question from
          either end: which organisation this is, and what you can do inside it. */}
      {org.data?.name && (
        <OrganizationForm name={org.data.name} canRename={isOwner(user.role)} />
      )}

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

      {/*
        A heading row in all but name, so it is built from the same parts as the
        CardTitle rows above it: the icon in an IconTile, the same gap, the same
        type. Loose beside the text it was the one icon on the page not sitting in
        a tile, which made the last card look like it came from another screen.

        It stays a CardBody rather than becoming a CardTitle, because there is
        nothing underneath it for a heading to head.
      */}
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <IconTile>
              <UserRound className="size-4" />
            </IconTile>
            <div className="min-w-0 pt-0.5">
              <p className="font-semibold tracking-tight">Sign out</p>
              <p className="text-muted mt-1 text-sm text-pretty">
                Ends this session on this device only.
              </p>
            </div>
          </div>
          <SignOutButton />
        </CardBody>

        <CardBody className="flex flex-wrap items-center justify-between gap-4 border-t">
          <div className="flex min-w-0 items-start gap-3">
            <IconTile>
              <ShieldOff className="size-4" />
            </IconTile>
            <div className="min-w-0 pt-0.5">
              <p className="font-semibold tracking-tight">Sign out everywhere</p>
              <p className="text-muted mt-1 text-sm text-pretty">
                Ends every session on every device. Use it after a lost device, or a password you
                think someone else may have.
              </p>
            </div>
          </div>
          <SignOutEverywhereButton />
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
                  ? 'gradient-brand elev-brand mt-2.5 grid size-[18px] shrink-0 place-items-center rounded-full'
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
