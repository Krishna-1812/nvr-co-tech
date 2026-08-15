import type { RdapInfo } from '../types';
import { cleanOrgName } from './names';

/**
 * RDAP — asking the registry who was given this address block.
 *
 * The modern replacement for WHOIS, and the reason this whole engine still
 * works with no paid subscription at all: rdap.org bootstraps to the right
 * regional registry, it is free, and it needs no key. On a project with no
 * IP-intelligence budget it is the only authoritative signal available.
 *
 * What makes it awkward is the shape of the answer. A response nests a list of
 * "entities" — registrant, administrative contact, technical contact, abuse
 * contact — each of which may nest more of the same, and the registry's own
 * bookkeeping objects sit in that list looking exactly like the companies do.
 * Picking the right one is a scoring problem, which is what most of this file
 * is.
 */

/** Entities are walked to this depth. Past it, it is contacts of contacts. */
const MAX_DEPTH = 2;

type Entity = {
  roles?: unknown;
  handle?: unknown;
  vcardArray?: unknown;
  entities?: unknown;
};

type Candidate = { name: string; score: number; handle: string | null };

/**
 * Pull the display name and the `kind` out of a jCard.
 *
 * A vcardArray is `["vcard", [[property, params, type, value], ...]]`, which is
 * a shape only a standards committee could produce and the only place the
 * organisation's actual name lives.
 */
function readVcard(vcardArray: unknown): { name: string | null; kind: string | null } {
  if (!Array.isArray(vcardArray) || !Array.isArray(vcardArray[1])) return { name: null, kind: null };

  let name: string | null = null;
  let kind: string | null = null;

  for (const entry of vcardArray[1] as unknown[]) {
    if (!Array.isArray(entry) || entry.length < 4) continue;
    const [property, , , value] = entry as [unknown, unknown, unknown, unknown];
    if (property === 'fn' && typeof value === 'string' && !name) name = value;
    if (property === 'org' && typeof value === 'string' && !name) name = value;
    if (property === 'kind' && typeof value === 'string') kind = value.toLowerCase();
  }

  return { name, kind };
}

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

/**
 * Score one entity on how likely it is to be the organisation that actually
 * holds this block, rather than a contact record or a registry artefact.
 *
 * The weights are the specification's and are not arbitrary: registrant is the
 * role that means ownership, so it dominates; `kind: org` and an `ORG-` handle
 * are both the registry itself asserting "this is an organisation"; and the two
 * small bonuses for a space and for mixed case encode the observation that real
 * company names are written like prose and handles are written like variables.
 */
function scoreEntity(entity: Entity, depth: number): Candidate | null {
  const { name: raw, kind } = readVcard(entity.vcardArray);
  const name = cleanOrgName(raw);
  // Rejected before scoring, per the specification: a bookkeeping string that
  // scores well is still a bookkeeping string.
  if (!name) return null;

  const roles = asStrings(entity.roles).map((r) => r.toLowerCase());
  const handle = typeof entity.handle === 'string' ? entity.handle : null;

  let score = 0;
  if (roles.includes('registrant')) score += 4;
  if (roles.includes('administrative')) score += 1;
  if (kind === 'org') score += 3;
  if (handle?.toUpperCase().startsWith('ORG-')) score += 3;
  if (name.includes(' ')) score += 2;
  if (/[a-z]/.test(name) && /[A-Z]/.test(name)) score += 1;
  // A nested contact is further from the allocation than a top-level one.
  score -= depth;

  return { name, score, handle };
}

/**
 * The best organisation name in an RDAP response, or nothing.
 *
 * Nothing is a real answer and the right one whenever every candidate looked
 * like a handle. Returning the least-bad string would put `NS1212-MNT` in front
 * of a salesperson as a company that visited the site.
 */
export function pickOrgName(entities: unknown): { name: string; handle: string | null } | null {
  const candidates = collect(entities, 0);
  if (candidates.length === 0) return null;

  const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
  return { name: best.name, handle: best.handle };
}

/** Every scoreable entity at every level, flattened, so the winner is a max. */
function collect(entities: unknown, depth: number): Candidate[] {
  if (!Array.isArray(entities) || depth > MAX_DEPTH) return [];

  const found: Candidate[] = [];
  for (const raw of entities) {
    if (!raw || typeof raw !== 'object') continue;
    const entity = raw as Entity;

    const candidate = scoreEntity(entity, depth);
    if (candidate) found.push(candidate);

    found.push(...collect(entity.entities, depth + 1));
  }
  return found;
}

const ipv4ToInt = (ip: string): number | null => {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;

  let total = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    total = total * 256 + n;
  }
  return total;
};

/**
 * How many addresses the registry handed out in one go.
 *
 * IPv4 only, deliberately. The size heuristics everywhere downstream — small
 * block means one tenant, huge block means shared infrastructure — are
 * calibrated against a 32-bit address space where handing somebody 65,536
 * addresses is a considered act. In IPv6 a single small company is routinely
 * given 2^80 addresses, so the same numbers would classify every corporate v6
 * range as sprawling infrastructure. Returning null says "no opinion", which is
 * true, rather than a confidently wrong number.
 */
export function blockSizeOf(response: Record<string, unknown>): number | null {
  const cidrs = response.cidr0_cidrs;
  if (Array.isArray(cidrs) && cidrs.length > 0) {
    const first = cidrs[0] as { v4prefix?: unknown; length?: unknown };
    if (typeof first?.v4prefix === 'string' && typeof first.length === 'number') {
      return 2 ** (32 - first.length);
    }
  }

  const start = typeof response.startAddress === 'string' ? ipv4ToInt(response.startAddress) : null;
  const end = typeof response.endAddress === 'string' ? ipv4ToInt(response.endAddress) : null;
  if (start != null && end != null && end >= start) return end - start + 1;

  return null;
}

/** Read an RDAP response body into the two things the engine wants from it. */
export function readRdap(response: Record<string, unknown>): RdapInfo {
  const picked = pickOrgName(response.entities);
  return {
    org: picked?.name ?? null,
    handle: picked?.handle ?? null,
    blockSize: blockSizeOf(response),
  };
}

const RDAP_TIMEOUT_MS = 3_000;

/**
 * Ask rdap.org about an address.
 *
 * Time-boxed and failure-swallowing like every other signal here: a registry
 * being slow is not a reason for a dashboard to fail, it is a reason to know one
 * less thing about one visitor.
 */
export async function fetchRdap(ip: string): Promise<RdapInfo | null> {
  try {
    const response = await fetch(`https://rdap.org/ip/${encodeURIComponent(ip)}`, {
      headers: { accept: 'application/rdap+json' },
      signal: AbortSignal.timeout(RDAP_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!response.ok) return null;

    const body = (await response.json()) as Record<string, unknown>;
    return readRdap(body);
  } catch {
    return null;
  }
}
