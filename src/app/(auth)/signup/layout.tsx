import type { Metadata } from 'next';

/** See the note in ../login/layout.tsx: a client page cannot title itself. */
/* Kept out of search results for the same reason as the sign-in page. */
export const metadata: Metadata = { title: 'Create an account', robots: { index: false, follow: true } };

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
