import type { Metadata } from 'next';
import { LandedWorkbench } from '@/components/landed/LandedWorkbench';

export const metadata: Metadata = { title: 'True Property Cost' };

/**
 * The tool. A server page holding one client component, because there is
 * nothing for the server to fetch: the schedules live in the reader's browser.
 */
export default function LandedCostPage() {
  return <LandedWorkbench />;
}
