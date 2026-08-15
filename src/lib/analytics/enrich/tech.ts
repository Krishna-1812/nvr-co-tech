/**
 * What a company's website is built with, read off the page itself.
 *
 * The same technique the commercial tech-lookup services use, hand-rolled in
 * about forty lines because that is genuinely all it is: fetch the homepage,
 * run a table of regexes over the markup, and report what matched. Doing it
 * ourselves costs nothing per lookup and means one fewer third party holding a
 * list of which companies we are curious about.
 *
 * It is also, quietly, one of the more useful things on the account view. A
 * prospect running HubSpot and Segment is a different conversation from one
 * running a WordPress site and no analytics at all.
 */

const SIGNATURES: [string, RegExp][] = [
  // Frameworks and site builders
  ['Next.js', /__NEXT_DATA__|\/_next\/static/],
  ['React', /\breact(-dom)?[.@-]|data-reactroot/],
  ['Vue', /\bvue(\.min)?\.js|data-v-[0-9a-f]{8}/],
  ['Angular', /ng-version=|angular(\.min)?\.js/],
  ['Svelte', /svelte-[0-9a-z]{6}|__SVELTEKIT/],
  ['WordPress', /wp-content|wp-includes|wp-json/],
  ['Shopify', /cdn\.shopify\.com|Shopify\.theme/],
  ['Webflow', /webflow\.(js|com)|data-wf-page/],
  ['Squarespace', /squarespace\.com|static1\.squarespace/],
  ['Wix', /wix\.com|wixstatic\.com/],
  ['Drupal', /drupal\.js|sites\/default\/files/],
  ['HubSpot CMS', /hs-sites\.com|hubspotusercontent/],

  // Analytics and product measurement
  ['Google Analytics', /googletagmanager\.com|gtag\(|google-analytics\.com/],
  ['Segment', /cdn\.segment\.(com|io)|analytics\.load\(/],
  ['Mixpanel', /cdn\.mxpnl\.com|mixpanel\.init/],
  ['Amplitude', /amplitude\.com\/libs|amplitude\.getInstance/],
  ['Hotjar', /static\.hotjar\.com|hjSettings/],
  ['Plausible', /plausible\.io\/js/],
  ['Matomo', /matomo\.(js|php)|piwik\.js/],

  // Sales, marketing and support
  ['HubSpot', /js\.hs-scripts\.com|hs-analytics\.net/],
  ['Salesforce', /force\.com|salesforce\.com\/embeddedservice/],
  ['Marketo', /munchkin\.js|marketo\.net/],
  ['Pardot', /pi\.pardot\.com/],
  ['Intercom', /widget\.intercom\.io|intercomSettings/],
  ['Drift', /js\.driftt\.com|drift\.load/],
  ['Zendesk', /static\.zdassets\.com|zendesk\.com\/embeddable/],
  ['Crisp', /client\.crisp\.chat/],
  ['Calendly', /assets\.calendly\.com/],

  // Payments
  ['Stripe', /js\.stripe\.com/],
  ['Razorpay', /checkout\.razorpay\.com/],
  ['PayPal', /paypal\.com\/sdk\/js/],

  // Delivery and reliability
  ['Cloudflare', /cf-ray|cdn-cgi\/|cloudflareinsights/],
  ['Fastly', /fastly\.net|x-served-by/],
  ['Akamai', /akamai(hd|ized)?\.net/],
  ['CloudFront', /cloudfront\.net/],
  ['Sentry', /browser\.sentry-cdn\.com|Sentry\.init/],
  ['Datadog RUM', /datadoghq-browser-agent|DD_RUM/],
  ['Optimizely', /cdn\.optimizely\.com/],
];

/**
 * Everything the markup gives away, in the order the table lists it.
 *
 * Headers are folded into the same haystack as the body because two of the
 * strongest signals — `cf-ray` and `x-served-by` — only ever appear there.
 */
export function fingerprint(html: string, headers?: Headers): string[] {
  const headerText = headers
    ? [...headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\n')
    : '';
  // The interesting tags are near the top; a megabyte of body copy is not.
  const haystack = `${headerText}\n${html.slice(0, 400_000)}`;

  return SIGNATURES.filter(([, pattern]) => pattern.test(haystack)).map(([name]) => name);
}
