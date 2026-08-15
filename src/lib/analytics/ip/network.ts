import type { IpIntel } from '../types';

/**
 * The two network calls that are not RDAP: reverse DNS, and whichever
 * IP-intelligence provider the project has a token for.
 *
 * Both are optional in the strict sense. The engine is designed to produce a
 * correct, useful answer with neither of them — RDAP alone is free and
 * unauthenticated — and this project currently runs with no IP-intelligence
 * token at all. What a token buys is a materially higher identification rate,
 * not the difference between working and not.
 */

/** DNS can hang for a long time. A second and a half is already generous. */
const DNS_TIMEOUT_MS = 1_500;
const INTEL_TIMEOUT_MS = 2_500;

/**
 * The PTR record for an address, if it has one worth having.
 *
 * A corporate mail or web server's reverse record — `mail.acme.com` — is the
 * single strongest domain signal in the whole system, because somebody at that
 * company had to configure it on purpose. Almost everything else in reverse DNS
 * is a carrier's generated name and is filtered out downstream.
 *
 * The dynamic import keeps `node:dns` out of any bundle that merely imports a
 * type from this module's neighbours.
 */
export async function reverseDns(ip: string): Promise<string | null> {
  try {
    const { promises: dns } = await import('node:dns');

    const lookup = dns.reverse(ip);
    const timeout = new Promise<string[]>((_, reject) =>
      setTimeout(() => reject(new Error('reverse DNS timed out')), DNS_TIMEOUT_MS),
    );

    const names = await Promise.race([lookup, timeout]);
    return names[0]?.replace(/\.$/, '').toLowerCase() ?? null;
  } catch {
    return null;
  }
}

type IpinfoBody = {
  hostname?: unknown;
  city?: unknown;
  country?: unknown;
  org?: unknown;
  asn?: { asn?: unknown; name?: unknown; domain?: unknown; type?: unknown };
  company?: { name?: unknown; domain?: unknown; type?: unknown };
  privacy?: { vpn?: unknown; proxy?: unknown; tor?: unknown; hosting?: unknown };
};

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/**
 * Normalise one provider's answer into the shape the engine reasons about.
 *
 * Written against IPinfo's response because that is the most common free tier,
 * but the shape it produces is deliberately provider-agnostic: swapping to
 * MaxMind or ipapi means rewriting this function and nothing else.
 *
 * Note what happens to the free tier's `org` field, which arrives as
 * "AS15169 Google LLC" — the ASN number is stripped, because every keyword list
 * downstream matches on names and a leading number only ever gets in the way.
 */
export function readIpinfo(body: IpinfoBody): IpIntel {
  const asnFromOrg = str(body.org)?.match(/^AS(\d+)\s+(.*)$/i);

  const privacy = body.privacy;
  const flag: IpIntel['privacy'] = privacy?.hosting
    ? 'hosting'
    : privacy?.tor
      ? 'tor'
      : privacy?.vpn
        ? 'vpn'
        : privacy?.proxy
          ? 'proxy'
          : null;

  const type = str(body.asn?.type) ?? str(body.company?.type);
  const asnType = (['isp', 'hosting', 'education', 'government', 'business'] as const).find(
    (t) => t === type,
  );

  return {
    org: str(body.asn?.name) ?? asnFromOrg?.[2] ?? str(body.org),
    asn: str(body.asn?.asn) ?? (asnFromOrg ? `AS${asnFromOrg[1]}` : null),
    hostname: str(body.hostname),
    city: str(body.city),
    country: str(body.country),
    privacy: flag,
    asnType: asnType ?? null,
    companyName: str(body.company?.name),
    companyDomain: str(body.company?.domain)?.toLowerCase() ?? null,
  };
}

/**
 * Ask the provider, if there is one to ask.
 *
 * Returns null both when no token is configured and when the call failed, and
 * the caller cannot tell the two apart on purpose — from its point of view they
 * are the same situation: one fewer signal, carry on with the others.
 */
export async function fetchIntel(ip: string): Promise<IpIntel | null> {
  const token = process.env.IPINFO_TOKEN;
  if (!token) return null;

  try {
    const response = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      signal: AbortSignal.timeout(INTEL_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!response.ok) return null;

    return readIpinfo((await response.json()) as IpinfoBody);
  } catch {
    return null;
  }
}

/**
 * Addresses there is no point asking anybody about.
 *
 * Loopback, the RFC 1918 ranges, link-local and carrier-grade NAT. These show
 * up in local development and behind some proxies, and running a registry
 * lookup on 127.0.0.1 wastes a round-trip to be told what everybody already
 * knows.
 */
export function isPrivateIp(ip: string): boolean {
  const v4 = ip.split('.').map(Number);
  if (v4.length === 4 && v4.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = v4;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  const v6 = ip.toLowerCase();
  return v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
}
