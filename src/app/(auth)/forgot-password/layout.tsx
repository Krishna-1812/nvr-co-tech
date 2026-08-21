import type { Metadata } from 'next';

/** See the note in ../login/layout.tsx: a client page cannot title itself. */
export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
