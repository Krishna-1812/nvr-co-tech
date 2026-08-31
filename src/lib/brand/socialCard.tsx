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
 * family. The mark, the ground, the two lights and the chip rail never vary;
 * only the eyebrow, the headline and the chips do.
 *
 * ── What Satori will and will not do ────────────────────────────────────────
 *
 * Rendered at build time by Satori, not by a browser, and it supports a
 * deliberately small slice of CSS. Flexbox only, no CSS variables, no oklch(),
 * no external fonts unless they are fetched and passed in. Hence the literal
 * hex values, which are the sRGB equivalents of the --m-* tokens. Every element
 * with more than one child needs an explicit `display: flex`, including ones
 * that plainly are not layouts, because Satori has no block formatting to fall
 * back to.
 *
 * The mark is the exception to the literals. Its geometry and ink come from
 * lib/brand/mark, which is already plain sRGB hex for exactly this reason, so
 * the owl on these cards cannot drift from the owl in the header.
 */

/** 1200x630, which is what every one of those three services crops to. */
export const CARD_SIZE = { width: 1200, height: 630 };
export const CARD_TYPE = 'image/png';

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
          background: '#0b0d1c',
          padding: 72,
          position: 'relative',
        }}
      >
        {/* Two light sources, matching the site's hero. */}
        <div
          style={{
            position: 'absolute',
            top: -260,
            left: -160,
            width: 760,
            height: 760,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(99,102,241,0.55), rgba(11,13,28,0) 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: -160,
            right: -200,
            width: 640,
            height: 640,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(139,92,246,0.42), rgba(11,13,28,0) 70%)',
            display: 'flex',
          }}
        />

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
            <span style={{ color: '#eef1fb', fontSize: 30, fontWeight: 700 }}>{BRAND.name}</span>
            <span style={{ color: '#8b95bd', fontSize: 17, marginTop: 4 }}>{BRAND.tagline}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              // Gold, matching .m-eyebrow on the site itself.
              color: INK.gold,
              fontSize: 19,
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            {eyebrow}
          </span>
          <span
            style={{
              color: '#f3f5fd',
              /*
               * Two sizes, not a fitted one. Satori cannot measure text before
               * it lays it out, so there is no way to shrink a headline until it
               * fits. The long-headline pages are the ones with a sentence for a
               * title and the short ones are a product name, which wants to be
               * large; the threshold sits between the two clusters rather than
               * at an arbitrary width.
               */
              fontSize: headline.length > 34 ? 76 : 92,
              fontWeight: 700,
              lineHeight: 1.06,
              letterSpacing: -2.2,
              marginTop: 26,
              maxWidth: 900,
            }}
          >
            {headline}
          </span>
          {sub && (
            <span
              style={{
                color: '#a3adcf',
                fontSize: 26,
                lineHeight: 1.35,
                marginTop: 20,
                maxWidth: 840,
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
            borderTop: '1px solid rgba(124,140,220,0.22)',
            paddingTop: 26,
          }}
        >
          {chips.map((t) => (
            <span
              key={t}
              style={{
                color: '#a3adcf',
                fontSize: 19,
                border: '1px solid rgba(124,140,220,0.28)',
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
