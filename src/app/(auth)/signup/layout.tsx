import type { Metadata } from 'next';

/** See the note in ../login/layout.tsx: a client page cannot title itself. */
export const metadata: Metadata = { title: 'Create an account' };

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
