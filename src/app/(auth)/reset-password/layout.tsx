import type { Metadata } from 'next';

/** See the note in ../login/layout.tsx: a client page cannot title itself. */
export const metadata: Metadata = { title: 'Choose a new password' };

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
