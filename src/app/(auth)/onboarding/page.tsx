import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser, createClient } from '@/lib/supabase/server';
import { ROLE_META } from '@/lib/domain/workflow';
import { AuthCard, AuthHeading } from '@/components/auth/AuthCard';
import { CreateOrganizationForm } from './CreateOrganizationForm';
import { AcceptInviteForm } from './AcceptInviteForm';

export const metadata = { title: 'Set up your organisation' };

/**
 * The gap between "signed in" and "can use the platform."
 *
 * Every screen past here — chapters, events, vouchers — is scoped to an
 * organization (migration 0012), and a profile with no organization yet would
 * see nothing under RLS regardless of what it tried to open. This is where
 * that gap is closed: name a new organization and become its owner, or follow
 * an invite link and join the one that sent it.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const user = await requireUser();
  const token = (await searchParams).invite?.trim();

  if (user.organizationId) {
    // A second invite link opened by someone already settled into an
    // organization used to bounce here straight to /hub with no explanation
    // at all — indistinguishable from the link simply not working. There is
    // no leave-organization path yet, so the honest answer is that this
    // invite cannot be accepted from this account, not silence.
    if (!token) redirect('/hub');

    return (
      <div className="animate-[rise_0.65s_cubic-bezier(0.22,1,0.36,1)_backwards]">
        <AuthHeading
          title="You're already in an organisation."
          lead="An account can only belong to one at a time, so this invite cannot be accepted here."
        />
        <AuthCard
          footer={
            <Link
              href="/hub"
              className="text-[13px] font-semibold text-[var(--m-ink)] underline-offset-4 transition hover:text-[var(--m-cyan)] hover:underline"
            >
              Go to your workspace
            </Link>
          }
        >
          <p className="m-dim text-[14px] leading-relaxed">
            To join the organisation this invite is for, accept it from a different account. Or ask
            whoever sent it to invite the address you are signed in with instead.
          </p>
        </AuthCard>
      </div>
    );
  }

  if (token) {
    const supabase = await createClient();
    const { data } = await supabase.rpc('invite_preview', { p_token: token });
    const preview = data?.[0];

    if (!preview || !preview.valid || !preview.organization_name || !preview.role) {
      return (
        <div className="animate-[rise_0.65s_cubic-bezier(0.22,1,0.36,1)_backwards]">
          <AuthHeading
            title="That invite link is not valid."
            lead="It may already have been used, or it has expired."
          />
          <AuthCard>
            <p className="m-dim text-[14px] leading-relaxed">
              Ask whoever invited you for a fresh link, or{' '}
              <a
                href="/onboarding"
                className="font-semibold text-[var(--m-ink)] underline-offset-4 hover:text-[var(--m-cyan)] hover:underline"
              >
                set up your own organisation
              </a>{' '}
              instead.
            </p>
          </AuthCard>
        </div>
      );
    }

    /*
     * The address the invite was actually sent to, checked here rather than
     * left to accept_invite().
     *
     * The database has always refused a mismatch, with a good message naming
     * the right address — but only after the button was pressed. Until then the
     * screen said "Join <Org>", because invite_preview() returned the email and
     * nothing looked at it. Somebody opening a work invite while signed in with
     * a personal account was told they had been invited, allowed to accept, and
     * only then sent away. The check is the same one; it has moved to before
     * the click, where it can be acted on.
     */
    const invitedEmail = preview.email?.toLowerCase() ?? '';
    const signedInAs = (user.authEmail ?? '').trim().toLowerCase();

    if (invitedEmail && signedInAs && invitedEmail !== signedInAs) {
      return (
        <div className="animate-[rise_0.65s_cubic-bezier(0.22,1,0.36,1)_backwards]">
          <AuthHeading
            title="This invite is for a different address."
            lead={`It was sent to ${preview.email}, and you are signed in as ${user.authEmail}.`}
          />
          <AuthCard>
            <p className="m-dim text-[14px] leading-relaxed">
              Sign out and back in as{' '}
              <span className="font-semibold text-[var(--m-ink)]">{preview.email}</span> to accept
              it, or ask whoever invited you to send a fresh one to this address instead.
            </p>
          </AuthCard>
        </div>
      );
    }

    return (
      <div className="animate-[rise_0.65s_cubic-bezier(0.22,1,0.36,1)_backwards]">
        <AuthHeading
          title={
            <>
              Join <span className="m-serif m-grad-text">{preview.organization_name}.</span>
            </>
          }
          lead={`You have been invited as ${ROLE_META[preview.role].label.toLowerCase()}.`}
        />
        <AcceptInviteForm token={token} expiresAt={preview.expires_at} />
      </div>
    );
  }

  return (
    <div className="animate-[rise_0.65s_cubic-bezier(0.22,1,0.36,1)_backwards]">
      <AuthHeading
        title={
          <>
            Name your <span className="m-serif m-grad-text">organisation.</span>
          </>
        }
        lead="This is the workspace your team will share. You can invite people once it exists."
      />
      <CreateOrganizationForm />
    </div>
  );
}
