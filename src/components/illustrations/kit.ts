/**
 * Tiny SVG-string toolkit shared by the pre-login illustrations.
 *
 * The illustrations are built as SVG markup strings (rendered on device with react-native-svg's
 * SvgXml, see ./index.tsx). Keeping them as plain strings with no React Native import means the
 * exact same source can be rasterised on a desktop to preview/iterate on the artwork.
 */

// ── Palette ─────────────────────────────────────────────────────────────────

export const P = {
  primary: '#8C52FF',
  indigo: '#6D4AFF',
  g1: '#4F46E5',
  g2: '#9333EA',
  violet: '#7C4DFF',
  violetDark: '#5B34D6',
  violetLight: '#A385FF',
  lavender: '#EDE7FF',
  lavender2: '#DCD1FF',
  blue: '#3B82F6',
  blueDark: '#2563EB',
  blueLight: '#7FAEF9',
  green: '#10B981',
  amber: '#F59E0B',
  yellow: '#FBBF3C',
  yellowDark: '#E39A12',
  pink: '#F9A8C8',
  pinkDark: '#EC7FAA',
  red: '#EF4444',
  navy: '#1E1B4B',
  navy2: '#2B2A63',
  ink: '#1F1638',
  white: '#FFFFFF',
  eye: '#24140E',
  mouth: '#5B1F24',
  leaf: '#8F7BFF',
  leafDark: '#6C55F0',
  leafSoft: '#C7BBFF',
} as const;

export interface Skin {
  base: string;
  shade: string;
  light: string;
}

export const SKIN: Record<'deep' | 'brown' | 'medium' | 'tan', Skin> = {
  deep: { base: '#7B4A2B', shade: '#603720', light: '#8E5A37' },
  brown: { base: '#94593A', shade: '#77442A', light: '#A86C48' },
  medium: { base: '#B57449', shade: '#975A35', light: '#C78A5D' },
  tan: { base: '#C98F63', shade: '#AE744A', light: '#D9A479' },
};

export const HAIR = { black: '#1C1222', dark: '#2A1A14', brown: '#4A2B1C' } as const;

// ── Theme (light / dark) ────────────────────────────────────────────────────

export interface Theme {
  dark: boolean;
  /** Suffix for gradient ids, so light/dark copies never share ids. */
  uid: string;
  /** Soft background blob. */
  blob: string;
  blob2: string;
  /** Small floating decorations (dots, sparkles). */
  deco: string;
  decoSoft: string;
  /** Floating cards (onboarding 4 list, chat bubble…). */
  card: string;
  cardLine: string;
  cardText: string;
  cardSub: string;
  /** Font attributes for <text>. */
  font: (weight: 'regular' | 'semibold' | 'bold') => string;
}

export interface ThemeOptions {
  dark?: boolean;
  /** Poppins face names when the font is loaded (React Native); otherwise a CSS-ish family list. */
  fontFamilies?: { regular: string; semibold: string; bold: string };
}

const WEIGHT = { regular: 400, semibold: 600, bold: 700 } as const;

export const makeTheme = ({ dark = false, fontFamilies }: ThemeOptions = {}): Theme => ({
  dark,
  uid: dark ? 'd' : 'l',
  blob: dark ? '#2A2452' : '#F0EBFF',
  blob2: dark ? '#221D45' : '#E6DEFF',
  deco: dark ? '#8B74FF' : '#B9A6FF',
  decoSoft: dark ? '#4A3F8C' : '#DCD2FF',
  card: dark ? '#1E293B' : '#FFFFFF',
  cardLine: dark ? '#334155' : '#EEF0F6',
  cardText: dark ? '#F8FAFC' : '#1E1B4B',
  cardSub: dark ? '#A78BFA' : '#7C3AED',
  font: (w) =>
    fontFamilies
      ? `font-family="${fontFamilies[w]}"`
      : `font-family="Poppins, 'Segoe UI', Arial, sans-serif" font-weight="${WEIGHT[w]}"`,
});

// ── Primitives ──────────────────────────────────────────────────────────────

const n = (v: number) => Math.round(v * 100) / 100;

export const svg = (w: number, h: number, defs: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`;

export const lg = (id: string, c1: string, c2: string, x1 = 0, y1 = 0, x2 = 1, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;

export const path = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;

export const circle = (cx: number, cy: number, r: number, fill: string, extra = '') =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;

export const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string, extra = '') =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;

export const rect = (x: number, y: number, w: number, h: number, rx: number, fill: string, extra = '') =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(rx)}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;

/** Thick rounded stroke, used for arms, legs, handles. */
export const limb = (d: string, color: string, width: number) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;

export const line = (d: string, color: string, width: number, extra = '') =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra ? ' ' + extra : ''}/>`;

export const g = (transform: string, body: string) => `<g transform="${transform}">${body}</g>`;

// ── Decorations ─────────────────────────────────────────────────────────────

/** Four-point sparkle. */
export const sparkle = (cx: number, cy: number, s: number, fill: string) =>
  path(
    `M${n(cx)} ${n(cy - s)} C${n(cx + s * 0.15)} ${n(cy - s * 0.15)} ${n(cx + s * 0.15)} ${n(cy - s * 0.15)} ${n(cx + s)} ${n(cy)} ` +
      `C${n(cx + s * 0.15)} ${n(cy + s * 0.15)} ${n(cx + s * 0.15)} ${n(cy + s * 0.15)} ${n(cx)} ${n(cy + s)} ` +
      `C${n(cx - s * 0.15)} ${n(cy + s * 0.15)} ${n(cx - s * 0.15)} ${n(cy + s * 0.15)} ${n(cx - s)} ${n(cy)} ` +
      `C${n(cx - s * 0.15)} ${n(cy - s * 0.15)} ${n(cx - s * 0.15)} ${n(cy - s * 0.15)} ${n(cx)} ${n(cy - s)}Z`,
    fill,
  );

/** A single leaf pointing up from (x, y), rotated by `angle` degrees. */
export const leaf = (x: number, y: number, len: number, angle: number, fill: string, vein?: string) => {
  const w = len * 0.36;
  const body = path(`M0 0 C${n(-w)} ${n(-len * 0.3)} ${n(-w * 0.7)} ${n(-len * 0.8)} 0 ${n(-len)} C${n(w * 0.7)} ${n(-len * 0.8)} ${n(w)} ${n(-len * 0.3)} 0 0Z`, fill);
  const v = vein ? line(`M0 ${n(-len * 0.08)} L0 ${n(-len * 0.82)}`, vein, Math.max(1, len * 0.04)) : '';
  return g(`translate(${n(x)} ${n(y)}) rotate(${angle})`, body + v);
};

/** A fan of leaves (little plant) growing from (x, y). */
export const plant = (x: number, y: number, size: number, colors: string[], vein?: string, mirror = false) => {
  const angles = [-38, -14, 10, 34];
  const lens = [0.78, 1, 0.92, 0.7];
  return angles
    .map((a, i) => leaf(x, y, size * lens[i], mirror ? -a : a, colors[i % colors.length], vein))
    .join('');
};

/** Round badge with a white check mark. */
export const checkBadge = (cx: number, cy: number, r: number, fill: string, ring?: string) =>
  (ring ? circle(cx, cy, r * 1.22, ring) : '') +
  circle(cx, cy, r, fill) +
  line(
    `M${n(cx - r * 0.42)} ${n(cy + r * 0.02)} L${n(cx - r * 0.12)} ${n(cy + r * 0.32)} L${n(cx + r * 0.45)} ${n(cy - r * 0.3)}`,
    '#FFFFFF',
    r * 0.2,
  );

// ── People ──────────────────────────────────────────────────────────────────

export type HairStyle = 'bun' | 'short' | 'curly' | 'afro' | 'long' | 'ponytail' | 'puffs';

export interface FaceOpts {
  cx: number;
  cy: number;
  /** Head radius (vertical half-height of the face). */
  r: number;
  skin: Skin;
  hair: string;
  style: HairStyle;
  /** Horizontal gaze/turn offset, -1..1 (shifts the features). */
  turn?: number;
  smile?: 'open' | 'closed' | 'grin';
  beard?: boolean;
  glasses?: boolean;
  blush?: boolean;
  /** Draw only the parts behind the face (long hair), or only the head. */
  part?: 'all' | 'back' | 'head';
}

/** Hair that sits BEHIND the face/neck (long hair, buns, afro volume). */
const hairBack = ({ cx, cy, r, hair, style, turn = 0 }: FaceOpts) => {
  switch (style) {
    case 'bun':
      return circle(cx - turn * r * 0.2, cy - r * 0.2, r * 1.05, hair) + circle(cx - turn * r * 0.15, cy - r * 1.2, r * 0.52, hair) + circle(cx - turn * r * 0.15 - r * 0.12, cy - r * 1.32, r * 0.2, '#ffffff', 'opacity="0.07"');
    case 'afro':
      return [
        [0, -0.3, 1.32],
        [-0.75, -0.55, 0.62],
        [0.75, -0.55, 0.62],
        [-0.95, 0.05, 0.55],
        [0.95, 0.05, 0.55],
        [0, -1.05, 0.68],
      ]
        .map(([dx, dy, rr]) => circle(cx + dx * r, cy + dy * r, rr * r, hair))
        .join('');
    case 'long':
      return path(
        `M${n(cx - r * 1.05)} ${n(cy - r * 0.2)} C${n(cx - r * 1.15)} ${n(cy - r * 1.6)} ${n(cx + r * 1.15)} ${n(cy - r * 1.6)} ${n(cx + r * 1.05)} ${n(cy - r * 0.2)} ` +
          `L${n(cx + r * 1.2)} ${n(cy + r * 1.35)} Q${n(cx + r * 1.1)} ${n(cy + r * 1.7)} ${n(cx + r * 0.7)} ${n(cy + r * 1.6)} L${n(cx - r * 0.7)} ${n(cy + r * 1.6)} Q${n(cx - r * 1.1)} ${n(cy + r * 1.7)} ${n(cx - r * 1.2)} ${n(cy + r * 1.35)}Z`,
        hair,
      );
    case 'ponytail':
      return circle(cx, cy - r * 0.15, r * 1.02, hair) + ellipse(cx + r * (turn >= 0 ? -1.05 : 1.05), cy + r * 0.25, r * 0.36, r * 0.8, hair, `transform="rotate(${turn >= 0 ? 18 : -18} ${n(cx + r * (turn >= 0 ? -1.05 : 1.05))} ${n(cy + r * 0.25)})"`);
    case 'puffs':
      return circle(cx, cy - r * 0.15, r * 1.02, hair) + circle(cx - r * 0.95, cy - r * 0.75, r * 0.45, hair) + circle(cx + r * 0.95, cy - r * 0.75, r * 0.45, hair);
    case 'curly':
      return '';
    case 'short':
    default:
      return '';
  }
};

/** Hair over the forehead. */
const hairFront = ({ cx, cy, r, hair, style, turn = 0 }: FaceOpts) => {
  const t = turn * r * 0.25;
  switch (style) {
    case 'short':
      return path(
        `M${n(cx - r * 0.93)} ${n(cy - r * 0.05)} C${n(cx - r * 1.02)} ${n(cy - r * 1.42)} ${n(cx + r * 1.02)} ${n(cy - r * 1.42)} ${n(cx + r * 0.93)} ${n(cy - r * 0.05)} ` +
          `L${n(cx + r * 0.82)} ${n(cy - r * 0.38)} Q${n(cx + t)} ${n(cy - r * 0.62)} ${n(cx - r * 0.82)} ${n(cy - r * 0.38)}Z`,
        hair,
      );
    case 'curly': {
      const bumps = [
        [-0.78, -0.55, 0.32],
        [-0.5, -0.88, 0.36],
        [-0.1, -1.0, 0.38],
        [0.32, -0.95, 0.36],
        [0.7, -0.68, 0.34],
        [0.88, -0.3, 0.24],
        [-0.92, -0.22, 0.22],
      ];
      return (
        path(
          `M${n(cx - r * 0.95)} ${n(cy - r * 0.05)} C${n(cx - r * 1.02)} ${n(cy - r * 1.4)} ${n(cx + r * 1.02)} ${n(cy - r * 1.4)} ${n(cx + r * 0.95)} ${n(cy - r * 0.05)} ` +
            `L${n(cx + r * 0.8)} ${n(cy - r * 0.42)} Q${n(cx + t)} ${n(cy - r * 0.6)} ${n(cx - r * 0.8)} ${n(cy - r * 0.42)}Z`,
          hair,
        ) + bumps.map(([dx, dy, rr]) => circle(cx + dx * r, cy + dy * r, rr * r, hair)).join('')
      );
    }
    case 'bun':
    case 'afro':
    case 'puffs':
    case 'ponytail':
      return path(
        `M${n(cx - r * 0.95)} ${n(cy + r * 0.05)} C${n(cx - r * 1.0)} ${n(cy - r * 1.43)} ${n(cx + r * 1.0)} ${n(cy - r * 1.43)} ${n(cx + r * 0.95)} ${n(cy + r * 0.05)} ` +
          `C${n(cx + r * 0.75)} ${n(cy - r * 0.5)} ${n(cx + r * 0.1 + t)} ${n(cy - r * 0.62)} ${n(cx - r * 0.25 + t)} ${n(cy - r * 0.6)} C${n(cx - r * 0.6)} ${n(cy - r * 0.5)} ${n(cx - r * 0.85)} ${n(cy - r * 0.3)} ${n(cx - r * 0.95)} ${n(cy + r * 0.05)}Z`,
        hair,
      );
    case 'long':
      return path(
        `M${n(cx - r * 0.98)} ${n(cy + r * 0.4)} C${n(cx - r * 1.08)} ${n(cy - r * 1.55)} ${n(cx + r * 1.08)} ${n(cy - r * 1.55)} ${n(cx + r * 0.98)} ${n(cy + r * 0.4)} ` +
          `C${n(cx + r * 0.85)} ${n(cy - r * 0.2)} ${n(cx + r * 0.5)} ${n(cy - r * 0.55)} ${n(cx - r * 0.05 + t)} ${n(cy - r * 0.6)} C${n(cx - r * 0.55)} ${n(cy - r * 0.45)} ${n(cx - r * 0.85)} ${n(cy - r * 0.1)} ${n(cx - r * 0.98)} ${n(cy + r * 0.4)}Z`,
        hair,
      );
    default:
      return '';
  }
};

/** A friendly simplified face (ears, face, hair, eyes, brows, nose, smile). */
export const face = (o: FaceOpts) => {
  const { cx, cy, r, skin, hair, turn = 0, smile = 'open', beard, glasses, blush = true, part = 'all' } = o;
  if (part === 'back') return hairBack(o);
  const fx = cx + turn * r * 0.22;
  const ex = r * 0.34;
  const ey = cy + r * 0.1;
  const out: string[] = [];
  if (part === 'all') out.push(hairBack(o));
  // ears
  out.push(circle(cx - r * 0.9, cy + r * 0.12, r * 0.2, skin.shade), circle(cx + r * 0.9, cy + r * 0.12, r * 0.2, skin.shade));
  // face + soft jaw shade
  out.push(ellipse(cx, cy, r * 0.9, r, skin.base));
  out.push(path(`M${n(cx + r * 0.9)} ${n(cy)} A${n(r * 0.9)} ${n(r)} 0 0 1 ${n(cx - r * 0.2)} ${n(cy + r * 0.98)} Q${n(cx + r * 0.72)} ${n(cy + r * 0.6)} ${n(cx + r * 0.9)} ${n(cy)}Z`, skin.shade, 'opacity="0.35"'));
  if (beard)
    out.push(
      path(
        `M${n(cx - r * 0.9)} ${n(cy + r * 0.05)} Q${n(cx - r * 0.85)} ${n(cy + r * 1.08)} ${n(fx)} ${n(cy + r * 1.12)} Q${n(cx + r * 0.85)} ${n(cy + r * 1.08)} ${n(cx + r * 0.9)} ${n(cy + r * 0.05)} ` +
          `Q${n(cx + r * 0.7)} ${n(cy + r * 0.62)} ${n(fx)} ${n(cy + r * 0.5)} Q${n(cx - r * 0.7)} ${n(cy + r * 0.62)} ${n(cx - r * 0.9)} ${n(cy + r * 0.05)}Z`,
        hair,
      ),
    );
  out.push(hairFront(o));
  // brows
  out.push(
    line(`M${n(fx - ex - r * 0.14)} ${n(ey - r * 0.25)} Q${n(fx - ex)} ${n(ey - r * 0.34)} ${n(fx - ex + r * 0.14)} ${n(ey - r * 0.27)}`, hair, r * 0.075),
    line(`M${n(fx + ex - r * 0.14)} ${n(ey - r * 0.27)} Q${n(fx + ex)} ${n(ey - r * 0.34)} ${n(fx + ex + r * 0.14)} ${n(ey - r * 0.25)}`, hair, r * 0.075),
  );
  // eyes
  out.push(ellipse(fx - ex, ey, r * 0.085, r * 0.115, P.eye), ellipse(fx + ex, ey, r * 0.085, r * 0.115, P.eye));
  out.push(circle(fx - ex + r * 0.03, ey - r * 0.04, r * 0.03, '#FFFFFF'), circle(fx + ex + r * 0.03, ey - r * 0.04, r * 0.03, '#FFFFFF'));
  if (glasses)
    out.push(
      circle(fx - ex, ey, r * 0.24, 'none', `stroke="${P.ink}" stroke-width="${n(r * 0.06)}"`),
      circle(fx + ex, ey, r * 0.24, 'none', `stroke="${P.ink}" stroke-width="${n(r * 0.06)}"`),
      line(`M${n(fx - ex + r * 0.24)} ${n(ey)} L${n(fx + ex - r * 0.24)} ${n(ey)}`, P.ink, r * 0.06),
    );
  // nose
  out.push(line(`M${n(fx - r * 0.08)} ${n(cy + r * 0.38)} Q${n(fx)} ${n(cy + r * 0.44)} ${n(fx + r * 0.08)} ${n(cy + r * 0.38)}`, skin.shade, r * 0.07));
  // blush
  if (blush) out.push(circle(fx - ex - r * 0.1, cy + r * 0.45, r * 0.13, '#FF7A7A', 'opacity="0.22"'), circle(fx + ex + r * 0.1, cy + r * 0.45, r * 0.13, '#FF7A7A', 'opacity="0.22"'));
  // mouth
  const my = cy + r * 0.56;
  const mw = r * (smile === 'grin' ? 0.34 : 0.28);
  if (smile === 'closed') {
    out.push(line(`M${n(fx - mw)} ${n(my)} Q${n(fx)} ${n(my + r * 0.22)} ${n(fx + mw)} ${n(my)}`, P.mouth, r * 0.08));
  } else {
    out.push(path(`M${n(fx - mw)} ${n(my)} Q${n(fx)} ${n(my + r * 0.05)} ${n(fx + mw)} ${n(my)} Q${n(fx + mw * 0.9)} ${n(my + r * 0.36)} ${n(fx)} ${n(my + r * 0.36)} Q${n(fx - mw * 0.9)} ${n(my + r * 0.36)} ${n(fx - mw)} ${n(my)}Z`, P.mouth));
    out.push(path(`M${n(fx - mw * 0.85)} ${n(my + r * 0.03)} Q${n(fx)} ${n(my + r * 0.07)} ${n(fx + mw * 0.85)} ${n(my + r * 0.03)} L${n(fx + mw * 0.7)} ${n(my + r * 0.13)} Q${n(fx)} ${n(my + r * 0.16)} ${n(fx - mw * 0.7)} ${n(my + r * 0.13)}Z`, '#FFFFFF'));
  }
  return out.join('');
};

/** Head seen from behind / three-quarter back (hair covering most of it, ear + cheek visible). */
export const backHead = (cx: number, cy: number, r: number, skin: Skin, hair: string, facing: 'left' | 'right', style: 'short' | 'ponytail' | 'hood' = 'short') => {
  const s = facing === 'right' ? 1 : -1;
  const out: string[] = [];
  // cheek sliver on the facing side
  out.push(ellipse(cx + s * r * 0.15, cy + r * 0.05, r * 0.92, r, skin.base));
  if (style === 'ponytail') out.push(ellipse(cx - s * r * 0.85, cy + r * 0.35, r * 0.34, r * 0.75, hair, `transform="rotate(${-s * 20} ${n(cx - s * r * 0.85)} ${n(cy + r * 0.35)})"`));
  out.push(
    path(
      `M${n(cx + s * r * 0.55)} ${n(cy - r * 0.85)} C${n(cx - s * r * 0.4)} ${n(cy - r * 1.25)} ${n(cx - s * r * 1.15)} ${n(cy - r * 0.4)} ${n(cx - s * r * 0.95)} ${n(cy + r * 0.45)} ` +
        `C${n(cx - s * r * 0.8)} ${n(cy + r * 0.95)} ${n(cx - s * r * 0.1)} ${n(cy + r * 1.05)} ${n(cx + s * r * 0.25)} ${n(cy + r * 0.85)} ` +
        `C${n(cx + s * r * 0.15)} ${n(cy + r * 0.35)} ${n(cx + s * r * 0.35)} ${n(cy - r * 0.1)} ${n(cx + s * r * 0.75)} ${n(cy - r * 0.2)} ` +
        `C${n(cx + s * r * 0.95)} ${n(cy - r * 0.45)} ${n(cx + s * r * 0.85)} ${n(cy - r * 0.75)} ${n(cx + s * r * 0.55)} ${n(cy - r * 0.85)}Z`,
      hair,
    ),
  );
  // ear
  out.push(ellipse(cx + s * r * 0.32, cy + r * 0.12, r * 0.15, r * 0.22, skin.shade));
  return out.join('');
};

/** Rounded torso (shoulders + chest) from `top` down `h` units, half-width `w`. */
export const torso = (cx: number, top: number, w: number, h: number, fill: string, shade?: string) => {
  const d = `M${n(cx - w)} ${n(top + h)} L${n(cx - w)} ${n(top + w * 0.5)} Q${n(cx - w)} ${n(top)} ${n(cx - w * 0.5)} ${n(top)} L${n(cx + w * 0.5)} ${n(top)} Q${n(cx + w)} ${n(top)} ${n(cx + w)} ${n(top + w * 0.5)} L${n(cx + w)} ${n(top + h)}Z`;
  let out = path(d, fill);
  if (shade)
    out += path(
      `M${n(cx + w * 0.45)} ${n(top + h)} Q${n(cx + w * 0.62)} ${n(top + w * 0.6)} ${n(cx + w * 0.6)} ${n(top + 1)} Q${n(cx + w)} ${n(top + 2)} ${n(cx + w)} ${n(top + w * 0.5)} L${n(cx + w)} ${n(top + h)}Z`,
      shade,
    );
  return out;
};

/** Neck with a soft shadow under the chin. */
export const neck = (cx: number, top: number, w: number, h: number, skin: Skin) =>
  rect(cx - w / 2, top, w, h, w * 0.3, skin.base) + path(`M${n(cx - w / 2)} ${n(top)} L${n(cx + w / 2)} ${n(top)} L${n(cx + w / 2)} ${n(top + h * 0.45)} Q${n(cx)} ${n(top + h * 0.7)} ${n(cx - w / 2)} ${n(top + h * 0.45)}Z`, skin.shade);

/** Hand (mitten shape) at (x, y). */
export const hand = (x: number, y: number, r: number, skin: Skin) => circle(x, y, r, skin.base) + circle(x + r * 0.25, y + r * 0.25, r * 0.6, skin.shade, 'opacity="0.35"');

/** Open palm (fingers together, thumb out), pointing up, rotated by `angle` around its base (x, y). */
export const palm = (x: number, y: number, s: number, angle: number, skin: Skin, mirror = false) => {
  const m = mirror ? -1 : 1;
  const d =
    `M${n(-s * 0.5)} 0 L${n(-s * 0.55)} ${n(-s * 1.25)} Q${n(-s * 0.55)} ${n(-s * 1.6)} 0 ${n(-s * 1.6)} Q${n(s * 0.55)} ${n(-s * 1.6)} ${n(s * 0.55)} ${n(-s * 1.25)} L${n(s * 0.5)} 0 Q0 ${n(s * 0.35)} ${n(-s * 0.5)} 0Z`;
  const thumb = `M${n(-s * 0.45 * m)} ${n(-s * 0.35)} Q${n(-s * 1.05 * m)} ${n(-s * 0.7)} ${n(-s * 0.95 * m)} ${n(-s * 1.0)}`;
  return g(
    `translate(${n(x)} ${n(y)}) rotate(${angle})`,
    limb(thumb, skin.base, s * 0.42) + path(d, skin.base),
  );
};

/** Round avatar (soft background + clipped head and shoulders). Returns [defs, body]. */
export const avatar = (id: string, cx: number, cy: number, r: number, bg: string, f: Omit<FaceOpts, 'cx' | 'cy' | 'r'>, shirt: string): [string, string] => {
  const fr = r * 0.48;
  const fcy = cy - r * 0.08;
  const defs = `<clipPath id="${id}"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"/></clipPath>`;
  const body =
    circle(cx, cy, r, bg) +
    `<g clip-path="url(#${id})">` +
    face({ ...f, cx, cy: fcy, r: fr, part: 'back' }) +
    neck(cx, fcy + fr * 0.5, fr * 0.62, fr * 0.8, f.skin) +
    torso(cx, fcy + fr * 1.15, r * 0.78, r, shirt) +
    face({ ...f, cx, cy: fcy, r: fr, part: 'head', blush: false }) +
    '</g>';
  return [defs, body];
};
