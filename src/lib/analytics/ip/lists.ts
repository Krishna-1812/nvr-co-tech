/**
 * The keyword lists the connection-type gate is built from.
 *
 * There is no clever way to do this part. Deciding whether "Reliance Jio
 * Infocomm Limited" is a company somebody works for or the company that sells
 * them broadband is not a problem that yields to an algorithm; it yields to
 * knowing that Jio sells broadband. So this is a list, it is long, and it is
 * expected to keep growing — every entry here was either obvious or is the scar
 * left by a false positive somebody saw in a lead list.
 *
 * The lists are weighted towards the markets this site actually gets traffic
 * from. An analytics system built on a US-and-EU carrier list will confidently
 * report that a hundred Indian households are a hundred separate businesses,
 * because it has never heard of ACT Fibernet.
 *
 * Everything is matched case-insensitively as a substring of the organisation
 * name, so entries are written in their most distinctive short form.
 */

/**
 * Residential and consumer providers, and the transit carriers that move
 * everybody's traffic between them. Both belong here for the same reason: an
 * address inside one tells you nothing about who is at the other end of it.
 */
export const ISP_BRANDS = [
  // India
  'jio', 'reliance', 'bharti', 'airtel', 'vodafone idea', 'vi india', 'bsnl', 'mtnl',
  'act fibernet', 'atria convergence', 'hathway', 'den networks', 'excitel', 'railwire',
  'tikona', 'you broadband', 'spectra', 'gtpl', 'asianet', 'kerala vision', 'siti cable',
  'tata communications', 'tata teleservices', 'sify', 'netplus', 'connect broadband',
  'alliance broadband', 'wish net', 'meghbela', 'ion networks', 'joister', 'i-on',
  // Rest of South and South-East Asia
  'pldt', 'globe telecom', 'converge ict', 'sky cable', 'singtel', 'starhub', 'm1 limited',
  'maxis', 'celcom', 'digi telecommunications', 'time dotcom', 'tm net', 'telekom malaysia',
  'indosat', 'xl axiata', 'biznet', 'first media', 'telkom indonesia', 'linknet',
  'true internet', 'ais fibre', '3bb', 'viettel', 'vnpt', 'fpt telecom', 'cmc telecom',
  'dialog axiata', 'sri lanka telecom', 'grameenphone', 'banglalink', 'robi axiata',
  'ptcl', 'nayatel', 'stormfiber', 'transworld', 'nepal telecom', 'worldlink', 'subisu',
  // Greater China, Japan, Korea
  'china telecom', 'china unicom', 'china mobile', 'chinanet', 'cernet',
  'chunghwa', 'far eastone', 'taiwan mobile', 'hinet',
  'ntt communications', 'ntt docomo', 'ntt east', 'ntt west', 'kddi', 'softbank',
  'biglobe', 'nifty corporation', 'jcom', 'sakura internet',
  'kt corporation', 'sk broadband', 'sk telecom', 'lg uplus', 'korea telecom',
  // Middle East and Africa
  'etisalat', 'du telecom', 'emirates integrated', 'stc ', 'saudi telecom', 'mobily',
  'zain', 'ooredoo', 'omantel', 'batelco', 'turkcell', 'turk telekom', 'türk telekom',
  'superonline', 'vodafone turkey',
  'safaricom', 'mtn ', 'glo mobile', 'globacom', '9mobile', 'liquid telecom',
  'telkom kenya', 'orange egypt', 'te data', 'vodafone egypt', 'maroc telecom',
  // Europe
  'deutsche telekom', 't-online', '1&1 versatel', 'telefonica', 'movistar', 'o2 ',
  'orange polska', 'orange espagne', 'orange france', 'free sas', 'iliad', 'sfr',
  'bouygues telecom', 'proximus', 'telenet', 'kpn', 'ziggo', 'delta fiber',
  'british telecom', 'bt group', 'sky uk', 'sky broadband', 'virgin media', 'talktalk',
  'plusnet', 'ee limited', 'vodafone limited', 'hyperoptic', 'community fibre',
  'telecom italia', 'tim spa', 'wind tre', 'fastweb', 'iliad italia', 'vodafone italia',
  'telia', 'telenor', 'tele2', 'elisa', 'dna oyj', 'get as', 'altibox',
  'a1 telekom', 'magenta telekom', 'swisscom', 'sunrise', 'salt mobile',
  'rostelecom', 'mts ', 'megafon', 'beeline', 'er-telecom', 'ttk ',
  'upc ', 'vodafone czech', 'o2 czech', 'orange romania', 'rcs & rds', 'digi romania',
  'play communications', 'netia', 'inea',
  // Americas
  'comcast', 'xfinity', 'verizon', 'at&t', 'centurylink', 'lumen', 'charter',
  'spectrum', 'cox communications', 'frontier communications', 'windstream',
  'optimum', 'altice', 'cablevision', 'mediacom', 'wow internet', 'rcn ',
  'consolidated communications', 'ziply fiber', 'metronet', 'google fiber',
  'rogers communications', 'bell canada', 'telus', 'shaw communications', 'videotron',
  'claro ', 'vivo ', 'telefonica brasil', 'oi s.a', 'tim brasil', 'algar telecom',
  'telmex', 'izzi telecom', 'totalplay', 'megacable', 'antel', 'entel', 'movistar chile',
  'vtr ', 'etb ', 'tigo ', 'millicom', 'cable & wireless',
  // Oceania
  'telstra', 'optus', 'tpg telecom', 'iinet', 'aussie broadband', 'superloop',
  'spark new zealand', 'vodafone new zealand', 'one nz', '2degrees',
  // Backbone and transit. Not consumer, but equally not an employer you can name.
  'cogent communications', 'hurricane electric', 'level 3', 'zayo', 'gtt communications',
  'ntt global', 'telia carrier', 'arelion', 'seabone', 'retn ', 'pccw global',
  'tata communications transformation',
] as const;

/**
 * Mobile carriers, kept separate from the ISPs above.
 *
 * Worth its own list because plenty of carriers register their mobile and their
 * fixed-line address space under differently-worded organisation names, and
 * because a visitor on mobile data is worth distinguishing in a report even
 * though neither can ever be identified as a company.
 */
export const MOBILE_BRANDS = [
  'jio mobile', 'airtel mobile', 'vodafone idea mobile', 'reliance jio infocomm',
  'verizon wireless', 'cellco partnership', 't-mobile', 'metropcs', 'sprint',
  'at&t mobility', 'at&t wireless', 'us cellular', 'boost mobile', 'cricket wireless',
  'vodafone gmbh', 'telefonica germany', 'e-plus', 'orange mobile', 'sfr mobile',
  'three ', 'h3g', 'ee mobile', 'o2 uk', 'giffgaff', 'lycamobile', 'lebara',
  'telenor mobile', 'telia mobile', 'tele2 mobile', 'dna mobile',
  'ntt docomo mobile', 'kddi mobile', 'au by kddi', 'softbank mobile', 'rakuten mobile',
  'china mobile communications', 'cmnet', 'unicom mobile',
  'mtn nigeria', 'vodacom', 'airtel africa', 'safaricom mobile',
  'grameenphone mobile', 'jazz mobile', 'mobilink', 'zong', 'ufone',
  'smart communications', 'dito telecommunity', 'axiata mobile',
  'claro movil', 'telcel', 'vivo movel', 'tim celular', 'personal argentina',
  'telstra mobile', 'optus mobile', 'vodafone hutchison',
] as const;

/**
 * Words that sound like a carrier without proving one.
 *
 * These never positively classify anything — far too many real companies are
 * called something Communications. What they do is veto the "this is a small
 * block, so it is probably one business" inference at the very end of the
 * classification, because carriers routinely register small per-city sub-blocks
 * under their own name and those look exactly like a dedicated corporate
 * allocation until you read the name.
 */
export const TELECOM_WORDS = [
  'telecom', 'telecomm', 'telecommunication', 'communications', 'broadband',
  'fibernet', 'fibre', 'fiber', 'wireless', 'cable', 'connectivity', 'internet service',
  'internet services', 'net services', 'netservices', 'dsl', 'cellular', 'mobile network',
  'isp', 'broadband services', 'telephone', 'telefon', 'telecoms',
] as const;

/**
 * Cloud, CDN, datacentre and shared hosting.
 *
 * The hyperscalers are here under their own legal names on purpose. "Google
 * LLC" appearing on an address almost never means a Google employee is reading
 * the page; it means somebody's crawler is running on Google Cloud. The same
 * goes for Microsoft, Oracle, Amazon and Alibaba. Losing the occasional genuine
 * employee visit is the correct trade against reporting every bot on the
 * internet as a visit from a household name.
 */
export const HOSTING_BRANDS = [
  'amazon', 'aws', 'ec2', 'google llc', 'google cloud', 'googleusercontent',
  'microsoft corporation', 'microsoft azure', 'azure', 'oracle corporation',
  'oracle cloud', 'alibaba', 'aliyun', 'tencent', 'huawei cloud', 'ibm cloud',
  'softlayer', 'digitalocean', 'linode', 'akamai', 'cloudflare', 'fastly',
  'stackpath', 'bunny', 'cdn77', 'edgecast', 'limelight', 'edgio', 'cloudfront',
  'ovh', 'hetzner', 'contabo', 'vultr', 'choopa', 'scaleway', 'online sas',
  'leaseweb', 'equinix', 'rackspace', 'godaddy', 'namecheap', 'bluehost',
  'hostgator', 'siteground', 'hostinger', 'dreamhost', 'ionos', '1&1 internet',
  'a2 hosting', 'inmotion', 'liquid web', 'nexcess', 'wp engine', 'kinsta',
  'netcup', 'strato', 'aruba s.p.a', 'register.it', 'hosteurope', 'plusserver',
  'gcore', 'g-core', 'servers.com', 'datacamp limited', 'm247', 'zenlayer',
  'psychz', 'quadranet', 'colocrossing', 'hivelocity', 'phoenixnap', 'worldstream',
  'i3d', 'nforce', 'serverius', 'hostwinds', 'interserver', 'buyvm', 'frantech',
  'heroku', 'render.com', 'vercel', 'netlify', 'fly.io', 'railway', 'railway.app',
  'digital realty', 'cyrusone', 'iron mountain data', 'ntt data center',
  'e2e networks', 'esds software', 'ctrls', 'netmagic', 'web werks', 'yotta',
  'hostdime', 'krystal', 'clouvider', 'melbicom', 'the constant company',
  'oracle svr', 'linode llc', 'upcloud', 'exoscale', 'clouding.io', 'time4vps',
] as const;

/**
 * Security proxies, secure web gateways and commercial VPNs.
 *
 * A distinct failure class from hosting and the reason it gets its own list. An
 * entire company can push every byte of its outbound traffic through one of
 * these, so the egress address resolves to the vendor for every employee of
 * every customer they have. Report Zscaler as a visiting account and you will
 * report it as the largest account in the pipeline, made of a hundred different
 * companies.
 *
 * Only unambiguous brand names go in here. A bare "proxy" or "vpn" would match
 * real companies that happen to contain the letters.
 */
export const PROXY_BRANDS = [
  'zscaler', 'netskope', 'cato networks', 'iboss', 'forcepoint', 'menlo security',
  'skyhigh', 'broadcom cloud', 'symantec web', 'mcafee web', 'lookout inc',
  'perimeter 81', 'twingate', 'tailscale', 'cloudflare warp', 'palo alto networks',
  'prisma access', 'versa networks', 'aryaka', 'open systems ag',
  'nordvpn', 'nord security', 'tefincom', 'expressvpn', 'express vpn', 'surfshark',
  'private internet access', 'london trust media', 'cyberghost', 'kape technologies',
  'protonvpn', 'proton ag', 'mullvad', 'amagicom', 'ipvanish', 'windscribe',
  'tunnelbear', 'hide.me', 'purevpn', 'gz systems', 'hotspot shield', 'anchorfree',
  'pango', 'psiphon', 'astrill', 'vyprvpn', 'golden frog', 'strongvpn', 'torguard',
  'oxylabs', 'bright data', 'luminati', 'smartproxy', 'soax', 'iproyal',
  'packetstream', 'netnut', 'webshare', 'rayobyte', 'datacenter proxies',
  'the tor project', 'privateinternet',
] as const;

/** Universities and schools. Identifiable, but only ever at organisation level. */
export const EDUCATION_WORDS = [
  'university', 'universit', 'universidad', 'universidade', 'università', 'universiteit',
  'universität', 'université', 'college', 'school', 'academy', 'akademi',
  'polytechnic', 'institute of technology', 'indian institute', 'hochschule',
  'faculty of', 'campus network', 'education network', 'research and education',
  '.edu', '.ac.', 'edu.', 'iit ', 'iim ', 'nit ', 'iiit',
] as const;

/** Government and military. Same rule: organisation level only. */
export const GOVERNMENT_WORDS = [
  'government', 'govt', 'ministry', 'ministerio', 'department of', 'municipal',
  'municipality', 'city of', 'county of', 'state of', 'federal', 'national informatics',
  'nic.in', 'parliament', 'embassy', 'consulate', 'united nations', 'european commission',
  'military', 'ministry of defence', 'department of defense', 'army', 'navy',
  'air force', 'police', '.gov', '.gob', '.gouv', '.mil', 'public sector',
] as const;

/**
 * Extra substrings the operator can add without a deploy.
 *
 * The first thing anybody wants after seeing a false positive is for it to stop
 * today, not next release. Comma-separated, matched exactly like the hosting
 * list, and read fresh on every call so a change to the variable takes effect
 * the moment the process restarts.
 */
export function operatorExclusions(): string[] {
  return (process.env.ANALYTICS_EXCLUDE_ORGS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Case-insensitive substring test against a list of markers. */
export function hits(haystack: string, needles: readonly string[]): string | null {
  const s = haystack.toLowerCase();
  return needles.find((n) => s.includes(n)) ?? null;
}
