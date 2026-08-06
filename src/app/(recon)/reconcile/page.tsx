import type { Metadata } from 'next';
import { Workbench } from '@/components/recon/Workbench';

export const metadata: Metadata = { title: 'Reconcile' };

/**
 * The tool.
 *
 * A server page holding one client component and nothing else, because there is
 * nothing for the server to fetch: the two ledgers come from the reader's own
 * machine and never leave it, so every part of this screen has to run in the
 * browser. What the server still does is the part it should — the session check
 * in the layout above, and the shell around it.
 */
export default function ReconcilePage() {
  return <Workbench />;
}
