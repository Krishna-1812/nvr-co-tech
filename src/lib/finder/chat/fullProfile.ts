import type { PersonProfile } from '../profile';

/**
 * Every field a matched enrichment returned, as a labelled list — **rendered in
 * code, not by the model**, so nothing captured can be quietly summarised away.
 *
 * A single person-at-a-company match is exactly the case worth spending the
 * one-credit enrichment on, and the point of paying is to see what it reveals.
 * Contact fields are included unconditionally here regardless of whether the
 * question asked for them: withholding part of what a credit already bought is
 * the waste, not the showing of it.
 *
 * The verbose derived lists (employment history, technologies, keyword tags) are
 * left out for legibility rather than withheld. This is a contact card, not the
 * raw record.
 */
export function renderFullProfile(p: PersonProfile | null): string {
  if (!p) return '';

  const bullets = (pairs: [string, unknown][]): string[] =>
    pairs
      .filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== 0 && v !== false)
      .map(([label, v]) => `- **${label}:** ${String(v)}`);

  const location = p.location || [p.city, p.state, p.country].filter(Boolean).join(', ');

  // Every address, primary and enriched alike, each keeping its own status.
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const e of [...p.emails, { email: p.email, status: null }, { email: p.apollo_email, status: null }]) {
    const address = String(e?.email ?? '').trim();
    if (!address || seen.has(address)) continue;
    seen.add(address);
    const status = 'status' in e && e.status ? ` (${e.status})` : '';
    emails.push(address + status);
  }

  const phones = p.phones.map((n) => n.number).filter(Boolean);

  const lines = bullets([
    ['Name', p.name],
    ['Title', p.title],
    ['Headline', p.headline],
    ['Seniority', p.seniority],
    ['Department', p.departments.join(', ')],
    ['Location', location],
    ['Email', emails.join(', ')],
    ['Phone', phones.join(', ')],
    ['LinkedIn', p.linkedin],
    ['Twitter', p.twitter],
    ['Facebook', p.facebook],
  ]);

  const co = p.company;
  const companyLines = co
    ? bullets([
        ['Name', co.name],
        ['Domain', co.domain],
        ['Website', co.website],
        ['Industry', co.industry],
        ['Employees', co.employees],
        ['Revenue', co.revenue_printed || co.revenue],
        ['Founded', co.founded],
        ['HQ', co.hq],
        ['Phone', co.phone],
        ['LinkedIn', co.linkedin],
        ['Description', co.description],
      ])
    : [];

  if (companyLines.length > 0) {
    // A plain, non-bulleted line so the renderer closes the person's list and
    // opens a visually distinct second one, rather than running both together
    // under one heading.
    lines.push('Everything we hold on the company:');
    lines.push(...companyLines);
  }

  if (lines.length === 0) return '';
  return `Everything we hold on file for this person:\n${lines.join('\n')}`;
}
