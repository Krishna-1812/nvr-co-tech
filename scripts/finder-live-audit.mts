/**
 * A live, read-only audit of every Apollo parameter this tool sends.
 *
 * Calls the actual exported functions in src/lib/finder/apollo/client.ts — not
 * a reimplementation — against the real Apollo API, and prints total_entries
 * before and after each filter is added. A parameter Apollo actually honours
 * moves the count; a parameter Apollo silently ignores (wrong name, wrong
 * format, deprecated) leaves it exactly where it was. That is the whole test.
 *
 * Free (mixed_people/api_search costs nothing) unless run with --paid, which
 * adds a handful of real company-search / enrich calls that do spend credits.
 *
 *     APOLLO_API_KEY=... npx vite-node --config vitest.config.mts scripts/finder-live-audit.mts
 *     APOLLO_API_KEY=... npx vite-node --config vitest.config.mts scripts/finder-live-audit.mts --paid
 */

import { searchPeople, searchCompanies, enrichCompanyById, matchPerson } from '../src/lib/finder/apollo/client';
import type { PeopleFilters, CompanyFilters, SearchMeta } from '../src/lib/finder/apollo/types';

const key = process.env.APOLLO_API_KEY;
if (!key) {
  console.error('Set APOLLO_API_KEY.');
  process.exit(1);
}
const paid = process.argv.includes('--paid');

let baseline = 0;

async function people(label: string, filters: PeopleFilters): Promise<number> {
  const meta: SearchMeta = {};
  await searchPeople(filters, key!, { perPage: 1, meta, strict: true });
  const total = meta.total_entries ?? -1;
  const delta = baseline > 0 ? ` (baseline ${baseline.toLocaleString()}, ${((total / baseline) * 100).toFixed(1)}% of it)` : '';
  console.log(`  ${label.padEnd(46)} total_entries=${total.toLocaleString()}${delta}`);
  return total;
}

async function company(label: string, filters: CompanyFilters): Promise<number> {
  const meta: SearchMeta = {};
  const rows = await searchCompanies(filters, key!, { perPage: 1, meta, strict: true });
  console.log(
    `  ${label.padEnd(46)} total_entries=${(meta.total_entries ?? -1).toLocaleString()} returned=${meta.returned ?? rows.length}`,
  );
  return meta.total_entries ?? -1;
}

async function main() {
  console.log('\n=== A. Baseline (no filters) ===');
  baseline = await people('no filters', {});

  console.log('\n=== B. person_titles / include_similar_titles ===');
  await people('titles=["Chief Executive Officer"], similar=true', {
    titles: ['Chief Executive Officer'],
  });
  await people('titles=["Chief Executive Officer"], similar=false', {
    titles: ['Chief Executive Officer'],
    include_similar_titles: false,
  });

  console.log('\n=== C. person_seniorities (spot check 3 of 11) ===');
  await people('seniorities=["c_suite"]', { seniorities: ['c_suite'] });
  await people('seniorities=["owner"]', { seniorities: ['owner'] });
  await people('seniorities=["intern"]', { seniorities: ['intern'] });

  console.log('\n=== D. person_locations / organization_locations ===');
  await people('person_locations=["California, United States"]', {
    person_locations: ['California, United States'],
  });
  await people('company_locations=["California, United States"]', {
    company_locations: ['California, United States'],
  });

  console.log('\n=== E. contact_email_status — the four documented values ===');
  await people('email_status=["verified"]', { email_status: ['verified'] });
  await people('email_status=["unavailable"]', { email_status: ['unavailable'] });
  await people('email_status=["unverified"] (claimed dead in code comment)', {
    email_status: ['unverified'],
  });
  await people('email_status=["likely to engage"] (claimed dead in code comment)', {
    email_status: ['likely to engage'],
  });

  console.log('\n=== F. organization_num_employees_ranges ===');
  await people('employee 1-10', { employee_min: 1, employee_max: 10 });
  await people('employee 10000-1000000', { employee_min: 10000, employee_max: 1000000 });

  console.log('\n=== G. industries (q_organization_keyword_tags) — the documented relevance-hint ===');
  await people('industries=["healthcare"]', { industries: ['healthcare'] });
  await people('industries=["asdkfjhaslkdjfhqwerty-not-a-real-industry"]', {
    industries: ['asdkfjhaslkdjfhqwerty-not-a-real-industry'],
  });

  console.log('\n=== H. technologies (currently_using_any_of_technology_uids) ===');
  await people('technologies=["salesforce"]', { technologies: ['salesforce'] });
  await people('technologies=["Salesforce.com"] (raw label, not uid)', {
    technologies: ['Salesforce.com'],
  });

  console.log('\n=== I. NAICS / SIC codes ===');
  await people('naics_codes=["621111"] (Offices of Physicians)', { naics_codes: ['621111'] });
  await people('sic_codes=["8011"] (Offices of Doctors of Medicine)', { sic_codes: ['8011'] });

  console.log('\n=== J. market_segments (undocumented in public API ref — verifying) ===');
  await people('market_segments=["B2B"]', { market_segments: ['B2B'] });
  await people('market_segments=["definitely-not-a-real-segment-xyz"]', {
    market_segments: ['definitely-not-a-real-segment-xyz'],
  });

  console.log('\n=== K. founded / headcount growth / num_jobs / job_posted ===');
  await people('founded 2020-2024', { founded_min: 2020, founded_max: 2024 });
  await people('headcount_growth 20-100, 6 months', {
    headcount_growth_min: 20,
    headcount_growth_max: 100,
    headcount_growth_months: 6,
  });
  await people('num_jobs 10-1000', { num_jobs_min: 10, num_jobs_max: 1000 });

  console.log('\n=== L. revenue_range ===');
  await people('revenue 1,000,000,000+', { revenue_min: 1_000_000_000 });

  console.log('\n=== M. q_keywords, linkedin, tenure/yoe ===');
  await people('keywords="growth marketing"', { keywords: 'growth marketing' });
  await people('yoe 10-40', { yoe_min: 10, yoe_max: 40 });
  await people('days_in_title 0-90', { days_in_title_min: 0, days_in_title_max: 90 });

  if (paid) {
    console.log('\n=== N. Company search (PAID — 1 credit per non-empty call) ===');
    const cBase = await company('baseline', {});
    await company('locations=["California, United States"]', { locations: ['California, United States'] });
    await company('industries=["healthcare"]', { industries: ['healthcare'] });
    await company('employee 10000-1000000', { employee_min: 10000, employee_max: 1000000 });
    void cBase;

    console.log('\n=== O. organizations/enrich (PAID — 1 credit on match) ===');
    const bogus = await enrichCompanyById('5e66b6fake0000000010e2e5c', key!);
    console.log('  enrichCompanyById(bogus id) ->', Object.keys(bogus).length > 0 ? `matched (unexpected): ${JSON.stringify(bogus).slice(0, 120)}` : 'empty (expected)');
    const wrongShape = await enrichCompanyById('apollo.io', key!); // wrong shape on purpose: id vs domain
    console.log('  enrichCompanyById("apollo.io" as id) ->', Object.keys(wrongShape).length > 0 ? `matched: ${JSON.stringify(wrongShape).slice(0, 120)}` : 'empty (expected — this is why the domain fallback exists)');

    console.log('\n=== P. people/match (PAID — 1 credit on match) ===');
    const matched = await matchPerson({ first_name: 'Larry', last_name: 'Page', domain: 'google.com' }, key!);
    console.log('  matchPerson(Larry Page @ google.com) ->', matched ? `matched: ${JSON.stringify(matched).slice(0, 200)}` : 'null');
  } else {
    console.log('\n(Skipping company-search / enrich / match — paid. Re-run with --paid to include them.)');
  }

  console.log('\nDone.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
