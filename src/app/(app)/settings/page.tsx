import { Palette, ShieldCheck, UserRound } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { ROLE_META, USER_ROLES, type UserRole } from '@/lib/domain/workflow';
import { Card, CardBody, CardHeader } from '@/components/ui/primitives';
import { PageHeader } from '@/components/PageHeader';
import { NameForm } from './NameForm';
import { ThemeChoice } from './ThemeChoice';
import { SignOutButton } from './SignOutButton';

export const metadata = { title: 'Settings · NVR Voucher' };

/**
 * Your own account. Role is shown but never editable here — it moves only
 * through set_user_role(), which an owner drives from /admin.
 */
export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { count } = await supabase
    .from('vouchers')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', user.id)
    .is('deleted_at', null);

  const initials =
    (user.full_name ?? user.email)
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join('') || '?';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Your account and how this app looks." />

      <Card className="stagger overflow-hidden">
        <div className="relative overflow-hidden">
          {/* Brand band behind the avatar — the one flourish on the page. */}
          <div aria-hidden className="gradient-brand h-20 w-full opacity-90" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 h-20 [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:32px_32px] opacity-10"
          />

          <div className="flex items-end gap-4 px-5 pb-4">
            <span className="elev-2 -mt-8 grid size-16 shrink-0 place-items-center rounded-2xl border-4 border-[var(--surface-raised)] bg-[var(--surface-sunken)] text-lg font-bold">
              {initials}
            </span>
            <div className="min-w-0 pb-1">
              <p className="truncate text-lg font-semibold tracking-tight">
                {user.full_name ?? user.email.split('@')[0]}
              </p>
              <p className="text-muted truncate text-sm">{user.email}</p>
            </div>
            <span className="text-subtle numeric ml-auto hidden shrink-0 pb-1 text-sm sm:block">
              {count ?? 0} voucher{count === 1 ? '' : 's'} raised
            </span>
          </div>
        </div>

        <CardBody className="border-t">
          <NameForm initial={user.full_name ?? ''} />
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="text-subtle size-4" aria-hidden />
            <div>
              <h2 className="font-semibold">Your access</h2>
              <p className="text-muted mt-0.5 text-sm">
                Granted by an owner. It cannot be changed from here.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardBody className="space-y-2">
          {USER_ROLES.map((role) => (
            <RoleRow key={role} role={role} current={user.role} />
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <Palette className="text-subtle size-4" aria-hidden />
            <div>
              <h2 className="font-semibold">Appearance</h2>
              <p className="text-muted mt-0.5 text-sm">Saved on this device.</p>
            </div>
          </div>
        </CardHeader>
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
 * The whole ladder is shown, not just the current rung — someone wondering why
 * they cannot see the approval queue gets their answer without asking.
 */
function RoleRow({ role, current }: { role: UserRole; current: UserRole }) {
  const meta = ROLE_META[role];
  const active = role === current;

  return (
    <div
      className={
        active
          ? 'flex items-start gap-3 rounded-xl border border-brand-500 bg-brand-50 px-3.5 py-3 ring-1 ring-brand-500 dark:bg-brand-900/30'
          : 'flex items-start gap-3 rounded-xl border border-transparent px-3.5 py-3 opacity-60'
      }
    >
      <span
        aria-hidden
        className={
          active
            ? 'gradient-brand mt-1 size-2 shrink-0 rounded-full'
            : 'mt-1 size-2 shrink-0 rounded-full bg-[var(--border-strong)]'
        }
      />
      <div>
        <p className="text-sm font-semibold">
          {meta.label}
          {active && (
            <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
              You
            </span>
          )}
        </p>
        <p className="text-muted mt-0.5 text-sm">{meta.grants}</p>
      </div>
    </div>
  );
}
