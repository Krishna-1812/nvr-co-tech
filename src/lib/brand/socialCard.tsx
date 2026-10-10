import { ImageResponse } from 'next/og';
import { BRAND } from '@/lib/marketing/content';
import { BEAK, EYE, HALO, HEAD, INK, RECENTRE, RUPEE, TUFTS, VIEW } from './mark';

/**
 * The card that appears when a link to the public site is pasted into Slack,
 * WhatsApp or LinkedIn — which, for a business sold by introduction, is how
 * most people will meet it first.
 *
 * ── Why this is a function rather than a file per page ──────────────────────
 *
 * There used to be one card for the whole site, hanging off the marketing route
 * group, so a link to Voucher Desk and a link to the privacy policy previewed
 * as the same picture with the same headline. That is worse than it sounds:
 * three links pasted into one Slack thread render as three copies of the same
 * card, and the reader has no way to tell which is which without hovering.
 *
 * Each page now has its own, and they are all built here so they stay one
 * family. The mark, the bone ground, the arch and the chip rail never vary;
 * only the eyebrow, the headline and the chips do.
 *
 * ── What Satori will and will not do ────────────────────────────────────────
 *
 * Rendered at build time by Satori, not by a browser, and it supports a
 * deliberately small slice of CSS. Flexbox only, no CSS variables, no oklch(),
 * no external fonts unless they are fetched and passed in. Hence the literal
 * hex values in SAND below, which match the --m-* tokens, and why the cards
 * set their headline in Satori's built-in sans rather than Gloock: fetching a
 * font at build time would make every deploy depend on Google Fonts being up.
 * Every element with more than one child needs an explicit `display: flex`,
 * including ones that plainly are not layouts, because Satori has no block
 * formatting to fall back to.
 *
 * The mark is the exception to the literals. Its geometry and ink come from
 * lib/brand/mark, which is already plain sRGB hex for exactly this reason, so
 * the owl on these cards cannot drift from the owl in the header.
 */

/** 1200x630, which is what every one of those three services crops to. */
export const CARD_SIZE = { width: 1200, height: 630 };
export const CARD_TYPE = 'image/png';

/**
 * The desert skin's palette as literal hex, because Satori reads no CSS
 * variables. Same values as the --m-* tokens in globals.css; change one and
 * change the other.
 */
const SAND = {
  bone: '#F6EFE4',
  sand: '#EBDDCB',
  dune: '#D9C2A5',
  sun: '#E9B44C',
  ink: '#2B211B',
  dim: '#4A3D33',
  olive: '#5F6136',
  line: '#E2D3BF',
  lineStrong: '#BFA98E',
} as const;

export type Card = {
  /** The gold micro-label, matching .m-eyebrow on the site. */
  eyebrow: string;
  /** The one line somebody reads at thumbnail size. */
  headline: string;
  /** An optional second line, for pages whose headline is only a name. */
  sub?: string;
  /**
   * Two or three, and short. They carry whatever the headline could not — on
   * the home card, the breadth, because a card that names only approvals reads
   * as though approvals are the whole product.
   */
  chips: string[];
};

export function socialCard({ eyebrow, headline, sub, chips }: Card) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: SAND.bone,
          padding: 72,
          position: 'relative',
        }}
      >
        {/*
          The site's one image, at the right of every card: an arch with the
          sun coming up inside it and a dune at its foot. Drawn from boxes,
          since Satori has no clip-path; a box with its two top corners rounded
          to half its width is an arch.
        */}
        <div
          style={{
            position: 'absolute',
            right: 72,
            bottom: 0,
            width: 300,
            height: 470,
            display: 'flex',
            justifyContent: 'center',
            background: SAND.sand,
            borderTopLeftRadius: 150,
            borderTopRightRadius: 150,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 70,
              width: 170,
              height: 170,
              borderRadius: 9999,
              background: SAND.sun,
              display: 'flex',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: 300,
              height: 120,
              background: SAND.dune,
              borderTopLeftRadius: 180,
              borderTopRightRadius: 120,
              display: 'flex',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              width: 80,
              height: 100,
              background: SAND.bone,
              borderTopLeftRadius: 40,
              borderTopRightRadius: 40,
              display: 'flex',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {/*
            The owl, from the same geometry and the same ink the site header
            draws, so the mark somebody meets in a Slack preview is the one they
            meet on the page.
          */}
          <svg width="76" height="76" viewBox={`0 0 ${VIEW} ${VIEW}`}>
            <defs>
              <linearGradient id="og-owl" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={INK.navyLit} />
                <stop offset="100%" stopColor={INK.navy} />
              </linearGradient>
            </defs>
            <circle cx={HALO.cx} cy={HALO.cy} r={HALO.r} fill={HALO.fill} />
            <g transform={`translate(0,${RECENTRE})`}>
              {TUFTS.map((points) => (
                <polygon key={points} points={points} fill="url(#og-owl)" />
              ))}
              <circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} fill="url(#og-owl)" />
              {EYE.x.map((x) => (
                <circle key={`w${x}`} cx={x} cy={EYE.y} r={EYE.white} fill="#FFFFFF" />
              ))}
              {EYE.x.map((x) => (
                <circle
                  key={`r${x}`}
                  cx={x}
                  cy={EYE.y}
                  r={EYE.ring}
                  fill="none"
                  stroke={INK.gold}
                  strokeWidth={EYE.ringWidth}
                />
              ))}
              {EYE.x.map((x) => (
                <circle key={`p${x}`} cx={x} cy={EYE.y} r={EYE.pupil} fill={INK.navy} />
              ))}
              <polygon points={BEAK} fill={INK.gold} />
              <path fill={INK.gold} d={RUPEE} />
            </g>
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: SAND.ink, fontSize: 30, fontWeight: 700 }}>{BRAND.name}</span>
            <span style={{ color: SAND.dim, fontSize: 17, marginTop: 4 }}>{BRAND.tagline}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 700 }}>
          <span
            style={{
              // Olive, matching .m-eyebrow on the site itself.
              color: SAND.olive,
              fontSize: 19,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            {eyebrow}
          </span>
          <span
            style={{
              color: SAND.ink,
              fontSize: headline.length > 34 ? 56 : 68,
              fontWeight: 700,
              lineHeight: 1.06,
              letterSpacing: -2,
              marginTop: 26,
            }}
          >
            {headline}
          </span>
          {sub && (
            <span
              style={{
                color: SAND.dim,
                fontSize: 26,
                lineHeight: 1.35,
                marginTop: 20,
              }}
            >
              {sub}
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            borderTop: `1px solid ${SAND.line}`,
            paddingTop: 26,
            maxWidth: 700,
            flexWrap: 'wrap',
          }}
        >
          {chips.map((t) => (
            <span
              key={t}
              style={{
                color: SAND.ink,
                fontSize: 19,
                border: `1.5px solid ${SAND.lineStrong}`,
                borderRadius: 9999,
                padding: '9px 20px',
                display: 'flex',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    ),
    CARD_SIZE,
  );
}

/**
 * The alt text for a card.
 *
 * A social card is an image with words in it, and the words are the whole
 * content. Screen readers on Slack, LinkedIn and X all read this attribute, so
 * it says what the picture says rather than describing the picture.
 */
export function cardAlt({ eyebrow, headline }: Pick<Card, 'eyebrow' | 'headline'>): string {
  return `${BRAND.name}. ${eyebrow}: ${headline}`;
}
