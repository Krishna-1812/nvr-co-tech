import type { Firmographics, Resolution } from '@/lib/analytics/types';

/**
 * Stand-in resolutions for preview mode.
 *
 * The real engine makes up to three network calls per address, and in preview
 * every address is inside RFC 5737's documentation ranges — so running it would
 * mean waiting on reverse DNS and a registry lookup to be told, correctly, that
 * nobody is there. Every account screen would then be empty, which shows
 * nothing about how those screens look when they have something to show.
 *
 * So preview substitutes a deterministic answer keyed off the last octet. About
 * a third resolve, which is roughly the real hit rate, and the rest are refused
 * for the actual reasons the real gate refuses things: home broadband, a mobile
 * network, a cloud host, a security proxy. Seeing the refusals is as important
 * as seeing the hits — they are the ordinary case, and the screens have to make
 * them read as answers rather than as gaps.
 *
 * None of this is evidence that the engine works. It is evidence that the
 * components render. The engine is tested separately, offline, in
 * lib/analytics/ip/gate.test.ts.
 */

type Sample = {
  name: string;
  domain: string;
  city: string;
  confidence: number;
  methods: Resolution['methods'];
  reasons: string[];
  tech: string[];
  description: string;
};

const COMPANIES: Sample[] = [
  {
    name: 'Example Textiles Limited',
    domain: 'example.co.in',
    city: 'Coimbatore',
    confidence: 0.86,
    methods: ['reverse_dns', 'rdap_registrant'],
    reasons: [
      'The registry allocated 4,096 addresses to a named organisation with no carrier or hosting markers against it.',
      'The reverse DNS record and the registry registrant point at example.co.in.',
      '2 independent methods agree, which adds a corroboration bonus.',
      'Domain-backed: the domain came from the address itself.',
    ],
    tech: ['WordPress', 'Google Analytics', 'Cloudflare'],
    description:
      'Spinning and weaving, three mills, invoices in four currencies. Exactly the sort of finance function that raises two hundred vouchers a month.',
  },
  {
    name: 'Meridian Capital Advisors',
    domain: 'meridiancapital.example',
    city: 'Mumbai',
    confidence: 0.8,
    methods: ['reverse_dns'],
    reasons: [
      'The address names meridiancapital.example with no carrier or hosting markers against it.',
      'The reverse DNS record points at meridiancapital.example.',
      'Domain-backed: the domain came from the address itself.',
    ],
    tech: ['Next.js', 'React', 'HubSpot', 'Stripe'],
    description: 'Boutique advisory. Twelve people, one financial controller, and a lot of spreadsheets.',
  },
  {
    name: 'Northgate Logistics',
    domain: 'northgate.example',
    city: 'Pune',
    confidence: 0.66,
    methods: ['rdap_registrant', 'org_name_guess'],
    reasons: [
      'The registry allocated 8,192 addresses to a named organisation with no carrier or hosting markers against it.',
      'The registry registrant and a domain guessed from the organisation name point at northgate.example.',
      '2 independent methods agree, which adds a corroboration bonus.',
      'Corroborated: two independent methods agree on the domain.',
    ],
    tech: ['Webflow', 'Segment'],
    description: 'Freight forwarding across four states. Reconciles carrier statements by hand, monthly.',
  },
];

const REFUSALS: { type: Resolution['connectionType']; reasons: string[]; asnOrg: string }[] = [
  {
    type: 'isp',
    asnOrg: 'Bharti Airtel Ltd',
    reasons: ['"airtel" is an internet or transit provider.'],
  },
  {
    type: 'mobile',
    asnOrg: 'Reliance Jio Infocomm Limited',
    reasons: ['"reliance jio infocomm" is a mobile carrier.'],
  },
  {
    type: 'hosting',
    asnOrg: 'Amazon Technologies Inc.',
    reasons: ['"amazon" is a hosting or cloud provider. Its address space is tenant traffic.'],
  },
  {
    type: 'proxy',
    asnOrg: 'Zscaler, Inc.',
    reasons: [
      '"zscaler" is a security proxy or VPN vendor. Its customers’ employees all egress from its addresses, so the name here is the vendor, not the visitor.',
    ],
  },
  {
    type: 'unknown',
    asnOrg: 'Regional Fibre Communications',
    reasons: [
      'The name contains "fibre", which sounds like a carrier without proving one. Carriers register small blocks under their own name, so the block size is not allowed to call this a business.',
    ],
  },
];

const octet = (ip: string): number => Number(ip.split('.').pop()) || 0;

export function previewResolution(ip: string): Resolution {
  const n = octet(ip);

  // Roughly a third resolve, which is about the real rate on real traffic.
  if (n % 3 === 0) {
    const sample = COMPANIES[Math.floor(n / 3) % COMPANIES.length];
    return {
      ip,
      identified: true,
      connectionType: 'business',
      companyName: sample.name,
      domain: sample.domain,
      confidence: sample.confidence,
      methods: sample.methods,
      reasons: sample.reasons,
      city: sample.city,
      country: 'IN',
      asn: `AS${64500 + (n % 400)}`,
      asnOrg: sample.name,
      hostname: `gw.${sample.domain}`,
      blockSize: 4_096,
    };
  }

  const refusal = REFUSALS[n % REFUSALS.length];
  return {
    ip,
    identified: false,
    connectionType: refusal.type,
    companyName: null,
    domain: null,
    confidence: 0,
    methods: [],
    reasons: [...refusal.reasons, 'The registry was not consulted: it could not have changed this.'],
    city: 'Bengaluru',
    country: 'IN',
    asn: `AS${9000 + (n % 900)}`,
    asnOrg: refusal.asnOrg,
    hostname: null,
    blockSize: null,
  };
}

export function previewCompany(domain: string): Firmographics | null {
  const sample = COMPANIES.find((c) => c.domain === domain);
  if (!sample) return null;

  return {
    domain,
    name: sample.name,
    description: sample.description,
    city: sample.city,
    country: 'India',
    linkedin: null,
    foundedYear: '2011',
    tech: sample.tech,
    logoUrl: null,
    industry: null,
    registryId: null,
    people: [],
  };
}
