import { checkBadge, circle, face, g, hand, HAIR, lg, limb, line, neck, P, path, plant, rect, SKIN, sparkle, svg, Theme, torso } from './kit';

/** Login — a group of four smiling students (wide band). */
export const loginHero = (t: Theme) => {
  const W = 400;
  const H = 160;
  const u = t.uid;
  const defs = lg(`lhb${u}`, t.blob, t.blob2, 0, 0, 1, 1) + lg(`lhtab${u}`, '#7C83FF', P.primary, 0, 0, 1, 1);
  const b: string[] = [];
  b.push(path('M34 122 C22 76 66 40 128 42 C170 14 250 12 292 40 C352 38 392 78 382 120 C376 146 352 160 316 160 L84 160 C56 160 40 146 34 122Z', `url(#lhb${u})`));
  b.push(sparkle(30, 44, 7, t.deco), sparkle(372, 34, 6, t.deco), circle(56, 26, 3.5, t.deco), circle(352, 70, 3.5, t.decoSoft));

  type Kid = { x: number; y: number; skin: (typeof SKIN)[keyof typeof SKIN]; hair: string; style: Parameters<typeof face>[0]['style']; shirt: string; shade: string; turn: number };
  const person = (k: Kid, extra = '') => {
    const r = 21;
    return (
      face({ cx: k.x, cy: k.y, r, skin: k.skin, hair: k.hair, style: k.style, part: 'back' }) +
      neck(k.x, k.y + r * 0.6, r * 0.62, r * 0.9, k.skin) +
      torso(k.x, k.y + r * 1.3, 38, 160, k.shirt, k.shade) +
      path(`M${k.x - 9} ${k.y + r * 1.3} Q${k.x} ${k.y + r * 1.3 + 9} ${k.x + 9} ${k.y + r * 1.3}Z`, k.skin.shade) +
      extra +
      face({ cx: k.x, cy: k.y, r, skin: k.skin, hair: k.hair, style: k.style, part: 'head', turn: k.turn })
    );
  };
  // back row
  b.push(
    person(
      { x: 164, y: 56, skin: SKIN.brown, hair: HAIR.black, style: 'short', shirt: P.violet, shade: P.violetDark, turn: 0.2 },
      limb('M140 94 Q136 120 138 160', '#3730A3', 7) + limb('M188 94 Q192 120 190 160', '#3730A3', 7),
    ),
  );
  b.push(person({ x: 244, y: 54, skin: SKIN.tan, hair: HAIR.dark, style: 'long', shirt: P.blue, shade: P.blueDark, turn: -0.2 }));
  // front row
  b.push(person({ x: 88, y: 74, skin: SKIN.deep, hair: HAIR.black, style: 'puffs', shirt: P.yellow, shade: P.yellowDark, turn: 0.25 }));
  b.push(g('rotate(-8 92 140)', rect(66, 124, 52, 34, 5, P.navy) + rect(70, 128, 44, 26, 3, `url(#lhtab${u})`)));
  b.push(hand(66, 146, 8, SKIN.deep), hand(116, 140, 8, SKIN.deep));
  b.push(person({ x: 320, y: 74, skin: SKIN.medium, hair: HAIR.black, style: 'curly', shirt: P.green, shade: '#0E9F6E', turn: -0.25 }));
  b.push(g('rotate(8 318 142)', rect(296, 126, 44, 34, 4, P.primary) + rect(300, 126, 6, 34, 2, P.violetDark)));
  b.push(hand(298, 146, 8, SKIN.medium), hand(340, 142, 8, SKIN.medium));
  return svg(W, H, defs, b.join(''));
};

const cloud = 'M62 150 C34 150 24 112 52 98 C50 56 96 34 136 52 C164 22 236 26 252 70 C292 72 304 118 280 140 C274 162 246 168 216 164 L96 164 C80 168 66 162 62 150Z';

/** Forgot password — an envelope with a padlock, sparkles, soft cloud. */
export const forgotPassword = (t: Theme) => {
  const W = 240;
  const H = 160;
  const u = t.uid;
  const defs = lg(`fpb${u}`, t.blob, t.blob2, 0, 0, 1, 1) + lg(`fpe${u}`, P.violetLight, P.indigo, 0, 0, 0, 1) + lg(`fpl${u}`, P.primary, P.g1, 0, 0, 1, 1);
  const b: string[] = [];
  b.push(g('translate(-8 6) scale(0.8)', path(cloud, `url(#fpb${u})`)));
  b.push(circle(30, 64, 3.5, t.deco), sparkle(202, 40, 6, t.deco), circle(206, 132, 3, t.decoSoft));
  // rays
  b.push(line('M150 26 L154 14 M162 32 L172 24 M168 44 L180 42', P.primary, 3.5));
  // envelope
  const x = 52;
  const y = 50;
  b.push(rect(x, y, 104, 72, 10, `url(#fpe${u})`));
  b.push(path(`M${x + 4} ${y + 68} L${x + 52} ${y + 30} L${x + 100} ${y + 68}Z`, '#FFFFFF', 'opacity="0.18"'));
  b.push(path(`M${x + 2} ${y + 6} Q${x} ${y} ${x + 8} ${y} L${x + 96} ${y} Q${x + 104} ${y} ${x + 102} ${y + 6} L${x + 58} ${y + 42} Q${x + 52} ${y + 47} ${x + 46} ${y + 42}Z`, '#B9A3FF'));
  // padlock
  const lx = 160;
  const ly = 112;
  b.push(circle(lx, ly + 2, 30, t.dark ? '#1E1B4B' : '#FFFFFF'));
  b.push(path(`M${lx - 11} ${ly - 4} L${lx - 11} ${ly - 12} A11 11 0 0 1 ${lx + 11} ${ly - 12} L${lx + 11} ${ly - 4}`, 'none', `stroke="${P.violetDark}" stroke-width="6" stroke-linecap="round"`));
  b.push(rect(lx - 19, ly - 6, 38, 30, 8, `url(#fpl${u})`));
  b.push(circle(lx, ly + 6, 4.5, '#FFFFFF'), rect(lx - 2, ly + 7, 4, 9, 2, '#FFFFFF'));
  return svg(W, H, defs, b.join(''));
};

/** New password — a padlock in a soft circle. */
export const newPassword = (t: Theme) => {
  const W = 200;
  const H = 160;
  const u = t.uid;
  const defs = lg(`npb${u}`, t.blob, t.blob2, 0, 0, 1, 1) + lg(`npl${u}`, P.primary, P.g1, 0, 0, 1, 1);
  const b: string[] = [];
  b.push(circle(100, 82, 66, `url(#npb${u})`));
  b.push(circle(100, 82, 48, t.dark ? '#332B66' : '#E6DEFF'));
  b.push(sparkle(34, 34, 7, t.deco), circle(170, 40, 4, t.deco), circle(160, 140, 3, t.decoSoft), sparkle(26, 118, 5, t.decoSoft));
  b.push(path('M84 80 L84 66 A16 16 0 0 1 116 66 L116 80', 'none', `stroke="${P.violetDark}" stroke-width="9" stroke-linecap="round"`));
  b.push(rect(70, 74, 60, 48, 12, `url(#npl${u})`));
  b.push(rect(70, 74, 60, 14, 12, '#FFFFFF', 'opacity="0.12"'));
  b.push(circle(100, 94, 6.5, '#FFFFFF'), rect(97, 96, 6, 13, 3, '#FFFFFF'));
  return svg(W, H, defs, b.join(''));
};

/** Account created — a smiling young man with a backpack, big check badge, leaves and sparkles. */
export const accountCreated = (t: Theme) => {
  const W = 300;
  const H = 254;
  const u = t.uid;
  const defs = lg(`acb${u}`, t.blob, t.blob2, 0, 0, 1, 1) + lg(`acc${u}`, P.primary, P.g1, 0, 0, 1, 1) + lg(`act${u}`, '#8B6BFF', P.indigo, 0, 0, 0, 1);
  const b: string[] = [];
  b.push(path('M40 120 C34 64 90 26 150 34 C206 20 268 56 270 116 C292 150 276 206 236 222 C200 240 120 240 80 226 C40 214 22 170 40 120Z', `url(#acb${u})`));
  b.push(plant(240, 236, 54, [P.leafSoft, P.leaf, P.leafDark, P.leafSoft]));
  b.push(plant(44, 236, 40, [P.leaf, P.leafSoft, P.leafDark, P.leaf], undefined, true));
  b.push(sparkle(50, 62, 9, t.deco), sparkle(30, 104, 5, t.decoSoft), circle(266, 40, 4, t.deco), circle(276, 160, 3.5, t.decoSoft));

  const s = SKIN.brown;
  const x = 128;
  // backpack (behind)
  b.push(rect(x - 86, 136, 172, 124, 38, '#3448C9'), rect(x - 86, 136, 30, 124, 15, '#2A3AA8'), rect(x + 56, 136, 30, 124, 15, '#2A3AA8'));
  b.push(neck(x, 106, 24, 28, s));
  b.push(torso(x, 126, 58, 140, `url(#act${u})`, P.violetDark));
  b.push(path(`M${x - 14} 126 Q${x} 142 ${x + 14} 126Z`, s.shade));
  // straps
  b.push(limb(`M${x - 34} 128 Q${x - 40} 170 ${x - 36} 254`, '#26318F', 13), limb(`M${x + 34} 128 Q${x + 40} 170 ${x + 36} 254`, '#26318F', 13));
  // arms holding the straps
  b.push(limb(`M${x - 58} 150 Q${x - 66} 190 ${x - 58} 206`, '#7A5CFF', 22), limb(`M${x + 58} 150 Q${x + 66} 190 ${x + 58} 206`, P.violetDark, 22));
  b.push(limb(`M${x - 58} 206 Q${x - 50} 200 ${x - 38} 186`, s.base, 15), limb(`M${x + 58} 206 Q${x + 50} 200 ${x + 38} 186`, s.base, 15));
  b.push(hand(x - 37, 182, 11, s), hand(x + 37, 182, 11, s));
  b.push(face({ cx: x, cy: 82, r: 32, skin: s, hair: HAIR.black, style: 'curly', turn: 0.15, smile: 'grin' }));
  // check badge
  b.push(checkBadge(228, 96, 30, `url(#acc${u})`, t.dark ? '#3B2F7A' : '#E4DBFF'));
  return svg(W, H, defs, b.join(''));
};
