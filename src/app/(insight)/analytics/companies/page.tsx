import { Building2, Clock, ExternalLink, Layers, MapPin, ShieldCheck, Users } from 'lucide-react';
import { byVisitor, summarise } from '@/lib/analytics/aggregate';
import { readVisitorViews } from '@/lib/analytics/store';
import { groupIntoAccounts, resolveVisitors } from '@/lib/analytics/resolve';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardTitle, EmptyState } from '@/components/ui/primitives';
import { CompanyMark, ConnectionPill, Reasons } from '@/components/analytics/Company';
import { Enrich } from '@/components/analytics/Enrich';
import { IntentBadge, IntentBreakdown } from '@/components/analytics/Intent';
import { NUM, Pill, ago, duration, number } from '@/components/analytics/Figures';
import { WindowTabs, windowFrom } from '@/components/analytics/Window';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Companies' };
export const dynamic = 'force-dynamic';

/**
 * The accounts behind the anonymous traffic.
 *
 * This is the screen the whole de-anonymisation engine exists to produce, and
 * the number to expect on it is smaller than it looks like it should be.
 * Somewhere between a fifth and two fifths of real traffic ever resolves to a
 * named company; the rest is people at home, on a phone, or behind a corporate
 * VPN that egresses under the vendor's name. That gap is the gate working. The
 * moment it is widened to fill the screen, every row on it stops being worth
 * acting on, because nobody downstream can tell the confident rows from the
 * hopeful ones.
 *
 * So the count of what did not resolve is stated at the top, next to what did,
 * and every card can be opened to show the reasoning that produced it.
 */
export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const days = windowFrom((await searchParams).days);
  const rows = await readVisitorViews(days);

  const summaries = [...byVisitor(rows).values()]
    .map(summarise)
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const records = await resolveVisitors(summaries);
  const accounts = groupIntoAccounts(records);

  const gated = records.filter((r) => r.resolution && !r.resolution.identified).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Visitor Intelligence"
        title="Who has been reading"
        description="Anonymous visits resolved to the organisation behind the address, and only where the evidence actually supports it."
        action={<WindowTabs current={days as 7 | 30 | 90} base="/analytics/companies" />}
      />

      <div className="surface-lit flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl px-5 py-4">
        <Stat label="Companies identified" value={number(accounts.length)} tone="var(--status-approved)" />
        <Stat label="People seen" value={number(summaries.length)} tone="var(--h-indigo)" />
        <Stat label="Not identifiable" value={number(gated)} tone="var(--status-draft)" />
        <p className="text-subtle min-w-[16rem] flex-1 text-[11.5px] leading-relaxed text-pretty">
          Home broadband, mobile data, cloud hosts and security proxies are refused a company name
          outright, however confident the underlying signal looked. Naming one of those as a visiting
          account is the single failure this system is built to prevent.
        </p>
      </div>

      {accounts.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            icon={<Building2 className="size-6" />}
            title="Nothing has resolved to a company yet"
            description={
              'Either there has been no business traffic in this window, or every visit came from a '
              + 'connection that cannot be attributed to an organisation. Both are ordinary. Open a '
              + 'visitor under Visitors to read exactly why a particular one was refused.'
            }
          />
        </Card>
      ) : (
        <ul className="stagger space-y-4">
          {accounts.map((account) => (
            <li key={account.domain}>
              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-start gap-4 border-b px-5 py-4">
                  <CompanyMark name={account.name} logoUrl={account.company?.logoUrl} size={44} />

                  <div className="min-w-[12rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[15px] font-semibold tracking-tight">{account.name}</h2>
                      <ConnectionPill type={account.resolution.connectionType} />
                    </div>

                    <p className="text-subtle mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
                      <a
                        href={`https://${account.domain}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 hover:text-[var(--text-c)] hover:underline"
                      >
                        {account.domain}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                      {account.company?.city && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" aria-hidden />
                          {[account.company.city, account.company.country].filter(Boolean).join(', ')}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" aria-hidden />
                        {ago(account.lastSeen)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="size-3" aria-hidden />
                        {Math.round(account.resolution.confidence * 100)}% confident
                      </span>
                    </p>
                  </div>

                  <IntentBadge intent={account.intent} className="mt-1" />
                </div>

                {account.company?.description && (
                  <p className="text-muted border-b px-5 py-3 text-[12.5px] leading-relaxed text-pretty">
                    {account.company.description}
                  </p>
                )}

                <div className="grid gap-5 px-5 py-4 lg:grid-cols-[1.1fr_1fr]">
                  <div className="space-y-4">
                    <dl className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
                      <Figure label="Visits" value={number(account.sessions)} />
                      <Figure label="Pages read" value={number(account.views)} />
                      <Figure label="People" value={number(account.visitors.length)} icon={<Users className="size-3" />} />
                      <Figure label="Attention" value={duration(account.engagedSeconds)} />
                    </dl>

                    {account.company && account.company.tech.length > 0 && (
                      <div>
                        <p className="a-label text-subtle mb-2 flex items-center gap-1.5">
                          <Layers className="size-3" aria-hidden />
                          Running
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {account.company.tech.slice(0, 12).map((tech) => (
                            <Pill key={tech} tone="var(--h-cyan)">
                              {tech}
                            </Pill>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="a-label text-subtle mb-2">What they read</p>
                      <ul className="flex flex-wrap gap-1.5">
                        {[...new Set(account.visitors.flatMap((v) => v.summary.pages))]
                          .slice(0, 10)
                          .map((page) => (
                            <li
                              key={page}
                              className={cn(NUM, 'surface-sunken rounded-md border px-2 py-0.5 text-[11px]')}
                            >
                              {page}
                            </li>
                          ))}
                      </ul>
                    </div>

                    <Reasons resolution={account.resolution} />
                  </div>

                  <div className="space-y-4 lg:border-l lg:pl-5">
                    <IntentBreakdown intent={account.intent} />
                    <div className="border-t pt-4">
                      <Enrich domain={account.domain} name={account.name} />
                    </div>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card className="overflow-hidden">
        <CardTitle
          title="Why the number is what it is"
          description="Worth reading once, so the gaps on this screen read as answers rather than as faults."
        />
        <div className="text-muted space-y-3 px-5 py-4 text-[12.5px] leading-relaxed text-pretty">
          <p>
            An address is only allowed to name a company when it classifies as a business, an
            educational institution or a government body. Consumer broadband, mobile data, cloud
            hosting and VPN or secure-web-gateway vendors are refused outright, because the
            organisation on those addresses is the one selling the connection rather than the one
            employing the visitor.
          </p>
          <p>
            Past that gate, a name still needs the evidence to be of the right kind: a reverse DNS
            record or a direct provider hit stands on its own, two independent methods agreeing
            stands, and a clean registry registrant on a small dedicated block stands. A single
            domain guessed from an organisation name, on a large shared block, never does — however
            plausible the guess looks.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden className="h-8 w-[3px] rounded-full" style={{ background: tone }} />
      <span>
        <span className={cn(NUM, 'block text-[20px] leading-none font-semibold')}>{value}</span>
        <span className="text-subtle mt-1 block text-[11px]">{label}</span>
      </span>
    </span>
  );
}

function Figure({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-subtle flex items-center gap-1 text-[11px]">
        {icon}
        {label}
      </dt>
      <dd className={cn(NUM, 'mt-1 text-[15px] font-semibold')}>{value}</dd>
    </div>
  );
}
