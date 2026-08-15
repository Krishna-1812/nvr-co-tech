import { Svg, G, Circle, Polygon, Path } from '@react-pdf/renderer';
import { BEAK, EYE, HALO, HEAD, INK, RECENTRE, RUPEE, TUFTS, VIEW } from './mark';

/**
 * The owl, for a printed document.
 *
 * Same geometry as the screen mark, drawn with react-pdf's SVG primitives, so
 * the thing at the top of a voucher is the thing on the site rather than a
 * second drawing of it.
 *
 * Flat where the screen mark has a gradient, for two reasons and both are about
 * paper: a gradient across 30pt of a laser print bands rather than blends, and
 * react-pdf resolves gradient coordinates per shape, so the head would not
 * match anything drawn beside it. At this size the gradient bought nothing.
 */
export function PdfMark({ size, body = INK.navyLit }: { size: number; body?: string }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
      <Circle cx={HALO.cx} cy={HALO.cy} r={HALO.r} fill={HALO.fill} />
      <G transform={`translate(0, ${RECENTRE})`}>
        {TUFTS.map((points) => (
          <Polygon key={points} points={points} fill={body} />
        ))}
        <Circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} fill={body} />

        {EYE.x.map((x) => (
          <Circle key={`white-${x}`} cx={x} cy={EYE.y} r={EYE.white} fill="#FFFFFF" />
        ))}
        {EYE.x.map((x) => (
          <Circle
            key={`ring-${x}`}
            cx={x}
            cy={EYE.y}
            r={EYE.ring}
            fill="none"
            stroke={INK.gold}
            strokeWidth={EYE.ringWidth}
          />
        ))}
        {EYE.x.map((x) => (
          <Circle key={`pupil-${x}`} cx={x} cy={EYE.y} r={EYE.pupil} fill={INK.navy} />
        ))}

        <Polygon points={BEAK} fill={INK.gold} />
        <Path d={RUPEE} fill={INK.gold} />
      </G>
    </Svg>
  );
}
