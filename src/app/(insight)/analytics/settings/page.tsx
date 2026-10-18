import type { Metadata } from 'next';
import { Settings2 } from 'lucide-react';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { ADMIN_EMAILS, GRANTABLE_TOOLS } from '@/lib/access';
import { SOLUTIONS } from '@/lib/solutions';
import type { AdminAccountRow } from '@/lib/supabase/types';
import { PageHeader } from '@/components/PageHeader';
import { AccessCard, AdminsCard, DataCard, TrackingCard, type AdminRow, type GrantRow, type Waiting } from '@/components/admin/Settings';

export const metadata: Metadata = { title: 'Admin settings' };

/**
 * Admin settings: the platform's own switches, separate from a person's
 * account settings (/settings).
 *
 * Four sections, each backed by migration 0035: who is an admin, which locked
 * tools are open to which people (with the access requests still waiting on
 * an answer), whether admins count in the figures, and the visit data itself.
 * The layout has already checked the admin list; every change checks it again.
 */
export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const me = await getCurrentUser();
  const [admins, grants, settings, accounts, requests, visitors, views] = await Promise.all([
    supabase.from('analytics_admins').select('email, note').order('added_at'),
    supabase.from('tool_grants').select('*').order('granted_at', { ascending: false }),
    supabase.from('platform_settings').select('key, value'),
    supabase.rpc('admin_accounts'),
    supabase.from('access_requests').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('site_visitors').select('id', { count: 'exact', head: true }),
    supabase.from('site_views').select('id', { count: 'exact', head: true }),
  ]);

  const nameOf = new Map(((accounts.data ?? []) as AdminAccountRow[]).filter((a) => a.email).map((a) => [a.email!.toLowerCase(), a.full_name]));
  const mine = (me?.authEmail ?? me?.email ?? '').toLowerCase();
  const toolName = (slug: string) => SOLUTIONS.find((s) => s.slug === slug)?.name ?? slug;

  // Built-in addresses first, then everyone added in the database.
  const seen = new Set<string>();
  const adminRows: AdminRow[] = [];
  for (const e of [...ADMIN_EMAILS, ...(admins.data ?? []).map((a) => a.email.toLowerCase())]) {
    if (seen.has(e)) continue;
    seen.add(e);
    adminRows.push({
      email: e,
      note: (admins.data ?? []).find((a) => a.email.toLowerCase() === e)?.note ?? null,
      builtIn: ADMIN_EMAILS.includes(e),
      name: nameOf.get(e) ?? null,
      you: e === mine,
    });
  }

  const grantRows: GrantRow[] = (grants.data ?? []).map((g) => ({
    email: g.email,
    tool: g.tool,
    toolName: toolName(g.tool),
    grantedBy: g.granted_by,
    at: g.granted_at,
    name: nameOf.get(g.email.toLowerCase()) ?? null,
  }));
  const granted = new Set(grantRows.map((g) => `${g.email.toLowerCase()}|${g.tool}`));

  // Access requests for a tool that can be opened, from somebody who is not
  // an admin and has not been given it yet: the screen's "waiting" list.
  const bySlugName = new Map(GRANTABLE_TOOLS.map((slug) => [`access to ${toolName(slug)}`.toLowerCase(), slug]));
  const waiting: Waiting[] = [];
  const asked = new Set<string>();
  for (const r of requests.data ?? []) {
    const slug = bySlugName.get((r.interest ?? '').toLowerCase());
    const email = r.email.toLowerCase();
    const k = `${email}|${slug}`;
    if (!slug || granted.has(k) || seen.has(email) || asked.has(k)) continue;
    asked.add(k);
    waiting.push({ email, name: r.name, tool: slug, toolName: toolName(slug), at: r.created_at });
  }

  const excludeAdmins = (settings.data ?? []).find((s) => s.key === 'exclude_admins')?.value === true;
  const missing = grants.error || settings.error;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader eyebrow="Admin" title="Admin settings" description="Who runs the platform, who has which tool, and how the figures are counted." />
      {missing && (
        <p className="tinted flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm [--tone:var(--status-warn)]">
          <Settings2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          Tool access and the counting switch need migration 0035. Run it in the Supabase SQL editor and reload this page.
        </p>
      )}
      <AdminsCard admins={adminRows} />
      <AccessCard grants={grantRows} waiting={waiting} tools={GRANTABLE_TOOLS.map((slug) => ({ slug, name: toolName(slug) }))} />
      <TrackingCard excludeAdmins={excludeAdmins} />
      <DataCard visitors={visitors.count ?? 0} views={views.count ?? 0} />
    </div>
  );
}
