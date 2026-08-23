import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { requireUser } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/domain/workflow';
import { PageHeader } from '@/components/PageHeader';
import { Card, EmptyState } from '@/components/ui/primitives';
import { IngestForm } from './IngestForm';

export const metadata = { title: 'Seed the registry' };

/**
 * A `maxDuration` export can't live in `valuationIngest.ts` itself — that file
 * has a top-level `'use server'` directive, which restricts it to exporting
 * only async functions, and a plain number breaks the whole module (confirmed
 * by a real build failure, the same class of error `MAX_ITEMS` hit earlier for
 * the same reason). Next.js does honor `maxDuration` set on the page that
 * calls a Server Action, which is this page for every action `IngestForm`
 * uses — see `sheetRows.ts`'s comment on `MAX_ITEMS` for why a longer budget
 * matters here at all.
 */
export const maxDuration = 60;

/**
 * Where the shared registry gets its first rows.
 *
 * Admin-only, checked here as well as in the server action and in the nav —
 * three layers because the database layer has none: every write function in
 * migration 0028 is granted to `authenticated`, not to a role, so this page and
 * the action behind it are what actually stop a non-admin from writing into
 * data every tenant on the platform reads.
 */
export default async function ValuationIngestPage() {
  const me = await requireUser();

  if (!isAdmin(me.role)) {
    return (
      <>
        <PageHeader eyebrow="Valuation Desk" title="Seed the registry" />
        <Card>
          <EmptyState
            icon={<ShieldAlert className="size-6" aria-hidden />}
            title="Admins only"
            description="Seeding the shared company registry is restricted to admins, because it writes data every tenant on the platform will read."
          />
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Valuation Desk"
        title="Seed the registry"
        description="Pull real companies from a free source and write them in, so Comparables has peers to show."
      />
      <IngestForm />
      <p className="text-subtle text-xs leading-relaxed">
        Looking for the comparables screen itself?{' '}
        <Link href="/comps" className="underline underline-offset-2">
          Go to Comparables
        </Link>
        .
      </p>
    </div>
  );
}
