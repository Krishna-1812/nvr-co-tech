import { ImageResponse } from 'next/og';
import { BRAND } from '@/lib/marketing/content';
import { BEAK, EYE, HEAD, HEAD_INK, INK, RUPEE, RUPEE_SHIFT, TUFTS, VIEW } from '@/lib/brand/mark';

/**
 * The card that appears when a link to the public site is pasted into Slack,
 * WhatsApp or LinkedIn — which, for a business sold by introduction, is how most
 * people will meet it first.
 *
 * Rendered at build time by Satori, not by a browser: it supports a deliberately
 * small slice of CSS. Flexbox only, no CSS variables, no oklch(), no external
 * fonts unless they are fetched and passed in. Hence the literal hex values,
 * which are the sRGB equivalents of the --m-* tokens.
 *
 * The mark is the exception. Its geometry and ink come from lib/brand/mark,
 * which is already plain sRGB hex for exactly this reason, so the owl on this
 * card cannot drift from the owl in the header.
 */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = `${BRAND.name}. ${BRAND.tagline}.`;

export default function OpengraphImage() {
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
          <svg width="72" height="72" viewBox={`0 0 ${VIEW} ${VIEW}`}>
            <defs>
              <linearGradient
                id="og-owl"
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="0"
                x2={VIEW}
                y2={VIEW}
              >
                <stop offset="0%" stopColor={HEAD_INK.hi} />
                <stop offset="100%" stopColor={HEAD_INK.lo} />
              </linearGradient>
            </defs>
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
            <path fill={INK.gold} transform={`translate(0,${RUPEE_SHIFT})`} d={RUPEE} />
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
            {BRAND.tagline}
          </span>
          <span
            style={{
              color: '#f3f5fd',
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.06,
              letterSpacing: -2.2,
              marginTop: 26,
              maxWidth: 900,
            }}
          >
            We handle the repetitive work. You make the calls.
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            borderTop: '1px solid rgba(124,140,220,0.22)',
            paddingTop: 26,
          }}
        >
          {/* The three chips carry the breadth, since the headline cannot. A
              card that names only approvals reads as one product. */}
          {['Payments, GST, TDS, bank', 'One set of records', 'Hosted in Mumbai'].map((t) => (
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
    size,
  );
}
