'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { buttonClass } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

/**
 * The way in for a visitor using the workspace without an account.
 *
 * Says what signing in is for, because it is not for opening tools: the two
 * open ones already work, and the four locked ones stay locked. It is for
 * keeping your work in an account (lib/cloud). Returns here afterwards, so the
 * record being worked on is the first thing seen once signed in.
 */
export function SignInButton({ className, label = 'Sign in to save' }: { className?: string; label?: string }) {
  const path = usePathname() || '/hub';
  return (
    <Link
      href={`/login?next=${encodeURIComponent(path)}`}
      className={buttonClass({ variant: 'primary', size: 'sm', className: cn('group h-9 px-3', className) })}
      title="Your work is kept in this browser until you sign in. Signing in saves it to your account."
    >
      <LogIn className="size-4" aria-hidden />
      <span className="max-[380px]:sr-only">{label}</span>
    </Link>
  );
}
