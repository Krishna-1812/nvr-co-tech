import { ImageResponse } from 'next/og';
import { BRAND } from '@/lib/marketing/content';

/**
 * The card that appears when a link to the public site is pasted into Slack,
 * WhatsApp or LinkedIn — which, for a business sold by introduction, is how most
 * people will meet it first.
 *
 * Rendered at build time by Satori, not by a browser: it supports a deliberately
 * small slice of CSS. Flexbox only, no CSS variables, no oklch(), no external
 * fonts unless they are fetched and passed in. Hence the literal hex values,
 * which are the sRGB equivalents of the --m-* tokens.
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
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6 55%, #22d3ee)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
              <path
                d="M9 15.4 13.2 19.6 23 9.8"
                stroke="white"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 21.6 13.2 25.8 23 16"
                stroke="white"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.5"
              />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#eef1fb', fontSize: 30, fontWeight: 700 }}>{BRAND.name}</span>
            <span style={{ color: '#8b95bd', fontSize: 17, marginTop: 4 }}>{BRAND.tagline}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              color: '#8b95bd',
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
