import { AuthFormSkeleton } from '@/components/auth/AuthFormSkeleton';

/**
 * /onboarding does two serial round trips before it can render anything — the
 * profile, then invite_preview() when a token is present — on the single most
 * fragile step of the journey. Without this the reader watched a blank column
 * while both completed, which on a slow connection is indistinguishable from
 * the invite link being broken.
 *
 * One field and no divider: the real card is a single name box, or a lone
 * "Join organisation" button.
 */
export default function OnboardingLoading() {
  return <AuthFormSkeleton fields={1} divider={false} />;
}
