import {
  avatar,
  backHead,
  checkBadge,
  circle,
  ellipse,
  face,
  g,
  hand,
  HAIR,
  lg,
  limb,
  line,
  neck,
  P,
  palm,
  path,
  rect,
  SKIN,
  sparkle,
  svg,
  Theme,
  torso,
} from './kit';

/** Onboarding 1 — "Vos classes et cours au même endroit": teacher with a tablet at the chalkboard, two students. */
export const onboarding1 = (t: Theme) => {
  const W = 400;
  const H = 370;
  const defs =
    lg(`o1b${t.uid}`, t.blob, t.blob2, 0, 0, 1, 1) +
    lg(`o1board${t.uid}`, '#2F7568', '#235549', 0, 0, 0, 1) +
    lg(`o1jacket${t.uid}`, P.violetLight, P.violet, 0, 0, 0, 1) +
    lg(`o1screen${t.uid}`, '#DDF5EA', '#B9E8D2', 0, 0, 0, 1);
  const teacherSkin = SKIN.brown;
  const body: string[] = [];
  // background blob + dots
  body.push(path('M62 76 C112 22 232 10 304 30 C374 52 398 124 388 204 C378 292 322 350 220 354 C118 358 36 324 20 244 C6 172 20 114 62 76Z', `url(#o1b${t.uid})`));
  body.push(circle(44, 120, 5, t.deco), circle(360, 330, 4, t.deco), sparkle(330, 34, 9, t.deco));
  // chalkboard
  body.push(rect(176, 56, 204, 154, 12, t.dark ? '#B9C9C4' : '#E1EAE7'));
  body.push(rect(184, 64, 188, 138, 7, `url(#o1board${t.uid})`));
  body.push(rect(204, 88, 92, 6, 3, '#FFFFFF', 'opacity="0.55"'), rect(204, 106, 136, 6, 3, '#FFFFFF', 'opacity="0.35"'), rect(204, 124, 112, 6, 3, '#FFFFFF', 'opacity="0.35"'), rect(204, 150, 70, 6, 3, '#FFFFFF', 'opacity="0.3"'));
  body.push(rect(230, 202, 60, 6, 3, t.dark ? '#9FB1AB' : '#CBD8D4'));

  // ── teacher ──
  const tx = 148;
  body.push(face({ cx: tx, cy: 88, r: 27, skin: teacherSkin, hair: HAIR.black, style: 'bun', part: 'back' }));
  body.push(neck(tx, 106, 20, 22, teacherSkin));
  // legs (navy trousers) peeking under the jacket
  body.push(torso(tx, 122, 50, 184, `url(#o1jacket${t.uid})`, P.violetDark));
  // white top + lapels
  body.push(path(`M${tx - 18} 123 Q${tx} 140 ${tx + 18} 123 L${tx + 14} 306 L${tx - 14} 306Z`, '#FFFFFF'));
  body.push(path(`M${tx - 18} 123 Q${tx} 140 ${tx + 18} 123 L${tx + 10} 133 Q${tx} 142 ${tx - 10} 133Z`, '#E8E4F5'));
  body.push(path(`M${tx - 22} 122 L${tx - 6} 150 L${tx - 18} 230 L${tx - 34} 150Z`, P.violetDark, 'opacity="0.55"'));
  body.push(path(`M${tx + 22} 122 L${tx + 6} 150 L${tx + 18} 230 L${tx + 34} 150Z`, P.violetDark, 'opacity="0.75"'));
  body.push(face({ cx: tx, cy: 88, r: 27, skin: teacherSkin, hair: HAIR.black, style: 'bun', part: 'head', turn: 0.25 }));
  // earrings
  body.push(circle(tx - 25, 99, 3, P.yellow), circle(tx + 25, 99, 3, P.yellow));
  // arm pointing to the board
  body.push(limb(`M${tx + 40} 140 Q${tx + 66} 170 ${tx + 74} 196 L${tx + 106} 166`, P.violetDark, 24));
  body.push(palm(tx + 110, 166, 13, 40, teacherSkin));
  // arm holding the tablet
  body.push(limb(`M${tx - 40} 142 Q${tx - 54} 190 ${tx - 48} 222 L${tx - 18} 246`, P.violetDark, 24));
  body.push(g(`rotate(-14 ${tx + 18} 232)`, rect(tx - 16, 210, 72, 48, 7, P.navy) + rect(tx - 11, 215, 62, 38, 4, '#6F7BF7') + rect(tx - 11, 215, 62, 14, 4, '#8E98FA')));
  body.push(hand(tx - 12, 246, 10, teacherSkin));

  // desk
  body.push(path('M18 304 L382 304 L396 326 L4 326Z', t.dark ? '#C9B497' : '#EAD8C0'));
  body.push(rect(4, 326, 392, 12, 3, t.dark ? '#A8916F' : '#D3B996'));
  // notebook + laptop on the desk
  body.push(path('M92 296 L150 290 L160 314 L98 320Z', '#FFFFFF'), path('M100 300 L144 296 M103 306 L148 302', 'none', `stroke="#C9CDE8" stroke-width="2" stroke-linecap="round"`));
  body.push(rect(222, 246, 82, 54, 6, P.navy), rect(227, 251, 72, 44, 3, `url(#o1screen${t.uid})`));
  body.push(circle(263, 266, 7, SKIN.medium.base), path('M250 289 Q263 272 276 289Z', P.blue), circle(263, 262, 7.5, HAIR.dark, 'opacity="0.0"'));
  body.push(path('M214 300 L312 300 L318 308 L208 308Z', '#A9B1D6'));

  // ── student left (boy, blue shirt, raising his hand) ──
  const bSkin = SKIN.deep;
  body.push(limb('M36 300 Q24 282 26 262', P.blueDark, 20));
  body.push(palm(26, 264, 11, -8, bSkin, true));
  body.push(torso(68, 286, 52, 90, P.blue, P.blueDark));
  body.push(backHead(80, 252, 27, bSkin, HAIR.black, 'right', 'short'));

  // ── student right (girl, yellow hoodie, ponytail) ──
  const gSkin = SKIN.medium;
  body.push(torso(336, 288, 54, 90, P.yellow, P.yellowDark));
  body.push(path('M300 290 Q336 318 372 290 Q360 284 336 284 Q312 284 300 290Z', P.yellowDark, 'opacity="0.6"'));
  body.push(limb('M298 312 Q282 318 286 300', P.yellow, 18));
  body.push(backHead(330, 254, 27, gSkin, HAIR.dark, 'left', 'ponytail'));
  return svg(W, H, defs, body.join(''));
};

/** Rounded gradient tile with a white glyph (onboarding 2 side icons). */
const iconTile = (x: number, y: number, s: number, fill: string, glyph: string) =>
  rect(x + 2, y + 5, s, s, 13, '#4F46E5', 'opacity="0.18"') + rect(x, y, s, s, 13, fill) + glyph;

/** Onboarding 2 — "Sessions en direct et devoirs": teacher on a video call, student writing, side icons. */
export const onboarding2 = (t: Theme) => {
  const W = 400;
  const H = 370;
  const u = t.uid;
  const defs =
    lg(`o2b${u}`, t.blob, t.blob2, 0, 0, 1, 1) +
    lg(`o2scr${u}`, '#F1F4FF', '#DDE3FF', 0, 0, 0, 1) +
    lg(`o2tile${u}`, P.g1, P.primary, 0, 0, 1, 1) +
    lg(`o2hood${u}`, '#FCC94F', P.yellow, 0, 0, 0, 1) +
    `<clipPath id="o2clip${u}"><rect x="64" y="66" width="232" height="140" rx="6"/></clipPath>`;
  const b: string[] = [];
  b.push(path('M48 92 C92 30 210 18 290 34 C366 50 396 130 386 214 C376 296 316 352 210 354 C108 356 30 322 16 238 C6 176 14 132 48 92Z', `url(#o2b${u})`));
  b.push(circle(34, 200, 5, t.deco), sparkle(40, 60, 8, t.deco), circle(380, 300, 4, t.deco));

  // desk (back surface where the monitor stands)
  b.push(path('M40 266 L360 266 L390 324 L10 324Z', t.dark ? '#C9B497' : '#EAD8C0'));
  b.push(rect(2, 324, 396, 12, 3, t.dark ? '#A8916F' : '#D3B996'));

  // monitor
  b.push(path('M160 214 L200 214 L206 252 L154 252Z', '#B9BEDF'), rect(132, 248, 96, 10, 5, '#A3A9D3'));
  b.push(rect(52, 54, 256, 164, 14, P.navy));
  b.push(rect(64, 66, 232, 140, 6, `url(#o2scr${u})`));
  b.push(`<g clip-path="url(#o2clip${u})">`);
  // classroom backdrop on the call
  b.push(rect(76, 80, 70, 44, 4, '#2F7568'), rect(84, 90, 34, 4, 2, '#FFFFFF', 'opacity="0.5"'), rect(84, 100, 50, 4, 2, '#FFFFFF', 'opacity="0.35"'));
  b.push(rect(196, 84, 40, 30, 3, '#C9D1FF'), rect(196, 116, 40, 4, 2, '#B4BDF5'));
  // teacher on screen (beard + glasses)
  const ms = SKIN.deep;
  b.push(neck(160, 138, 16, 18, ms));
  b.push(torso(160, 150, 40, 60, P.blue, P.blueDark));
  b.push(path('M146 150 L160 166 L174 150Z', '#FFFFFF'));
  b.push(face({ cx: 160, cy: 122, r: 22, skin: ms, hair: HAIR.black, style: 'short', beard: true, glasses: true, smile: 'open' }));
  b.push('</g>');
  // participants column
  const [a1d, a1] = avatar(`o2a1${u}`, 270, 92, 15, '#FFE7B8', { skin: SKIN.tan, hair: HAIR.dark, style: 'ponytail' }, P.pink);
  const [a2d, a2] = avatar(`o2a2${u}`, 270, 132, 15, '#D7F5E8', { skin: SKIN.brown, hair: HAIR.black, style: 'curly' }, P.green);
  b.push(a1, a2);
  // call controls
  b.push(rect(124, 184, 72, 18, 9, P.navy, 'opacity="0.85"'), circle(140, 193, 5, '#FFFFFF', 'opacity="0.9"'), circle(160, 193, 6, P.red), circle(180, 193, 5, '#FFFFFF', 'opacity="0.9"'));

  // side icons
  const x = 324;
  const s = 50;
  b.push(
    iconTile(x, 62, s, `url(#o2tile${u})`, rect(x + 11, 79, 20, 17, 4, '#FFFFFF') + path(`M${x + 32} 84 L${x + 40} 79 L${x + 40} 96 L${x + 32} 91Z`, '#FFFFFF')),
  );
  b.push(
    iconTile(
      x,
      124,
      s,
      `url(#o2tile${u})`,
      rect(x + 14, 135, 22, 28, 4, '#FFFFFF') + rect(x + 19, 131, 12, 7, 3, '#C4B5FD') + rect(x + 19, 145, 12, 3, 1.5, P.primary) + rect(x + 19, 151, 12, 3, 1.5, P.primary) + rect(x + 19, 157, 8, 3, 1.5, P.primary),
    ),
  );
  b.push(
    iconTile(
      x,
      186,
      s,
      `url(#o2tile${u})`,
      path(`M${x + 25} 199 L${x + 42} 207 L${x + 25} 215 L${x + 8} 207Z`, '#FFFFFF') +
        path(`M${x + 15} 211 L${x + 15} 219 Q${x + 25} 225 ${x + 35} 219 L${x + 35} 211 L${x + 25} 216Z`, '#FFFFFF') +
        line(`M${x + 40} 208 L${x + 40} 219`, '#FFFFFF', 2.5),
    ),
  );

  // notebook on the desk
  b.push(path('M196 290 L262 282 L268 316 L202 326Z', '#FFFFFF'), path('M262 282 L328 290 L322 324 L268 316Z', '#F4F1FF'));
  b.push(line('M208 298 L254 292 M210 306 L256 300 M212 314 L244 310', '#C9CDE8', 2), line('M274 292 L318 298 M273 300 L316 306', '#C9CDE8', 2));
  b.push(line('M262 282 L268 316', '#DCD6F5', 2));

  // student in a hoodie (back three-quarter view), writing
  const ss = SKIN.brown;
  b.push(path('M70 278 Q110 262 150 278 L150 300 L70 300Z', P.yellowDark));
  b.push(torso(108, 284, 62, 90, `url(#o2hood${u})`, P.yellowDark));
  b.push(limb('M150 304 Q186 322 222 312', P.yellow, 24));
  b.push(line('M232 300 L214 322', P.amber, 5), line('M214 322 L211 326', '#3A2A20', 3));
  b.push(hand(224, 310, 11, ss));
  b.push(path('M66 268 Q108 236 152 270 Q150 292 108 292 Q68 292 66 268Z', P.yellowDark));
  b.push(backHead(112, 244, 28, ss, HAIR.black, 'right', 'short'));
  b.push(line('M98 290 L96 318 M120 291 L122 318', '#FFFFFF', 3, 'opacity="0.8"'));
  return svg(W, H, defs + a1d + a2d, b.join(''));
};

/** Onboarding 3 — "Messagerie et notifications": phone with chat, bell with a badge, young woman with her phone. */
export const onboarding3 = (t: Theme) => {
  const W = 400;
  const H = 370;
  const u = t.uid;
  const defs =
    lg(`o3b${u}`, t.blob, t.blob2, 0, 0, 1, 1) +
    lg(`o3me${u}`, P.g1, P.primary, 0, 0, 1, 0) +
    lg(`o3bell${u}`, P.violetLight, P.indigo, 0, 0, 0, 1) +
    lg(`o3top${u}`, '#8B6BFF', '#6D4AFF', 0, 0, 0, 1);
  const b: string[] = [];
  b.push(path('M56 84 C104 26 226 14 300 36 C372 58 398 132 388 214 C378 296 318 352 214 354 C110 356 30 320 18 238 C8 176 18 126 56 84Z', `url(#o3b${u})`));
  b.push(sparkle(34, 230, 8, t.deco), circle(366, 64, 5, t.deco), circle(28, 120, 4, t.deco));

  // phone
  b.push(rect(66, 50, 150, 276, 26, P.navy, 'transform="rotate(-6 141 188)"'));
  const phone: string[] = [];
  phone.push(rect(74, 58, 134, 260, 19, '#FFFFFF'));
  phone.push(rect(121, 66, 40, 8, 4, P.navy));
  // header
  phone.push(circle(94, 92, 10, '#E6DEFF'), rect(110, 86, 52, 6, 3, '#CFC6F5'), rect(110, 96, 34, 5, 2.5, '#E3DEF7'));
  phone.push(rect(82, 110, 118, 1.5, 0.75, '#ECEAF6'));
  const avs: [string, string][] = [
    avatar(`o3a1${u}`, 93, 135, 12, '#FFE7B8', { skin: SKIN.tan, hair: HAIR.dark, style: 'long' }, P.pink),
    avatar(`o3a2${u}`, 93, 211, 12, '#D7F5E8', { skin: SKIN.deep, hair: HAIR.black, style: 'short' }, P.green),
    avatar(`o3a3${u}`, 93, 256, 12, '#DCE8FF', { skin: SKIN.medium, hair: HAIR.black, style: 'puffs' }, P.blue),
  ];
  phone.push(avs[0][1], rect(108, 124, 76, 22, 10, '#EEEBFF'), rect(116, 132, 52, 5, 2.5, '#C9BEFA'));
  phone.push(rect(118, 158, 80, 34, 11, `url(#o3me${u})`), rect(128, 167, 56, 5, 2.5, '#FFFFFF', 'opacity="0.9"'), rect(128, 177, 38, 5, 2.5, '#FFFFFF', 'opacity="0.7"'));
  phone.push(avs[1][1], rect(108, 200, 70, 22, 10, '#EEEBFF'), rect(116, 208, 44, 5, 2.5, '#C9BEFA'));
  phone.push(avs[2][1], rect(108, 244, 84, 24, 10, '#EEEBFF'), rect(116, 253, 60, 5, 2.5, '#C9BEFA'));
  phone.push(rect(84, 286, 98, 20, 10, '#F2F1F8'), circle(193, 296, 10, P.primary), path('M189 291 L198 296 L189 301Z', '#FFFFFF'));
  b.push(g('rotate(-6 141 188)', phone.join('')));

  // floating message card
  b.push(rect(184, 118, 104, 52, 14, '#4F46E5', 'opacity="0.12" transform="translate(2 5)"'));
  b.push(rect(184, 118, 104, 52, 14, t.card), path('M196 168 L190 182 L210 168Z', t.card));
  b.push(rect(198, 132, 74, 7, 3.5, '#C4B5FD'), rect(198, 146, 54, 7, 3.5, t.dark ? '#475569' : '#E4DEFB'));

  // notification bell with badge
  b.push(circle(262, 74, 30, t.dark ? '#3B2F7A' : '#E4DBFF'));
  b.push(path('M246 88 L278 88 Q272 82 272 72 L272 66 Q272 52 262 50 Q252 52 252 66 L252 72 Q252 82 246 88Z', `url(#o3bell${u})`));
  b.push(circle(262, 47, 3.5, P.indigo), path('M256 91 Q262 99 268 91Z', P.indigo));
  b.push(circle(281, 52, 11, P.red, `stroke="${t.dark ? '#1E1B4B' : '#FFFFFF'}" stroke-width="3"`));
  b.push(`<text x="281" y="56.5" text-anchor="middle" font-size="13" fill="#FFFFFF" ${t.font('bold')}>3</text>`);

  // young woman holding a phone
  const ws = SKIN.medium;
  const cx = 316;
  b.push(face({ cx, cy: 196, r: 30, skin: ws, hair: HAIR.dark, style: 'long', part: 'back' }));
  b.push(neck(cx, 218, 22, 22, ws));
  b.push(torso(cx, 236, 60, 140, `url(#o3top${u})`, P.violetDark));
  b.push(path(`M${cx - 16} 236 Q${cx} 252 ${cx + 16} 236Z`, ws.shade));
  b.push(face({ cx, cy: 196, r: 30, skin: ws, hair: HAIR.dark, style: 'long', part: 'head', turn: -0.35 }));
  // arm + phone
  b.push(limb(`M${cx - 44} 262 Q${cx - 58} 316 ${cx - 40} 326 L${cx - 22} 296`, P.violetDark, 24));
  b.push(g(`rotate(-14 ${cx - 26} 278)`, rect(cx - 42, 252, 30, 52, 6, P.navy) + rect(cx - 39, 256, 24, 44, 4, '#A99BFF')));
  b.push(hand(cx - 24, 296, 11, ws));
  return svg(W, H, defs + avs.map((a) => a[0]).join(''), b.join(''));
};

/** Onboarding 4 — "Parents : suivez tous vos enfants": a family with a tablet and the children list card. */
export const onboarding4 = (t: Theme) => {
  const W = 400;
  const H = 370;
  const u = t.uid;
  const defs = lg(`o4b${u}`, t.blob, t.blob2, 0, 0, 1, 1) + lg(`o4tab${u}`, '#7C83FF', P.primary, 0, 0, 1, 1) + lg(`o4dad${u}`, '#5B95F8', P.blue, 0, 0, 0, 1);
  const b: string[] = [];
  b.push(path('M40 96 C80 34 196 18 262 38 C330 58 352 132 344 210 C336 292 280 352 182 354 C88 356 22 318 12 238 C4 178 10 140 40 96Z', `url(#o4b${u})`));
  b.push(sparkle(30, 70, 8, t.deco), circle(24, 180, 5, t.deco));

  // father
  const ds = SKIN.deep;
  const fx = 122;
  b.push(neck(fx, 116, 26, 30, ds));
  b.push(torso(fx, 138, 70, 240, `url(#o4dad${u})`, P.blueDark));
  b.push(path(`M${fx - 18} 138 Q${fx} 156 ${fx + 18} 138Z`, ds.shade));
  b.push(face({ cx: fx, cy: 96, r: 32, skin: ds, hair: HAIR.black, style: 'short', beard: true, turn: 0.3 }));

  // mother
  const ms = SKIN.brown;
  const mx = 206;
  b.push(face({ cx: mx, cy: 148, r: 27, skin: ms, hair: HAIR.dark, style: 'long', part: 'back' }));
  b.push(neck(mx, 168, 20, 24, ms));
  b.push(torso(mx, 186, 52, 190, P.yellow, P.yellowDark));
  b.push(path(`M${mx - 14} 186 Q${mx} 200 ${mx + 14} 186Z`, ms.shade));
  b.push(face({ cx: mx, cy: 148, r: 27, skin: ms, hair: HAIR.dark, style: 'long', part: 'head', turn: -0.3 }));

  // child
  const cs = SKIN.medium;
  const kx = 132;
  b.push(face({ cx: kx, cy: 236, r: 24, skin: cs, hair: HAIR.black, style: 'puffs', part: 'back' }));
  b.push(neck(kx, 252, 16, 20, cs));
  b.push(torso(kx, 266, 42, 110, P.pink, P.pinkDark));
  b.push(face({ cx: kx, cy: 236, r: 24, skin: cs, hair: HAIR.black, style: 'puffs', part: 'head', turn: 0.35 }));
  // father's hand on the child's shoulder
  b.push(limb(`M${fx - 54} 168 Q${fx - 64} 200 ${fx - 62} 228`, P.blueDark, 26));
  b.push(limb(`M${fx - 62} 228 Q${fx - 50} 262 ${kx - 22} 272`, ds.base, 15));
  b.push(hand(kx - 20, 272, 11, ds));

  // tablet held by mother and child
  b.push(g(`rotate(-10 196 300)`, rect(158, 272, 82, 56, 7, P.navy) + rect(163, 277, 72, 46, 4, `url(#o4tab${u})`) + rect(170, 285, 30, 5, 2.5, '#FFFFFF', 'opacity="0.8"') + rect(170, 295, 46, 5, 2.5, '#FFFFFF', 'opacity="0.5"')));
  b.push(limb(`M${mx + 44} 210 Q${mx + 54} 270 ${mx + 32} 300`, P.yellowDark, 24));
  b.push(hand(mx + 30, 298, 12, ms));
  b.push(limb(`M${kx + 30} 290 Q${kx + 32} 312 ${kx + 34} 314`, P.pink, 18));
  b.push(hand(kx + 34, 312, 10, cs));

  // children card
  const cxs = 262;
  const cw = 128;
  b.push(rect(cxs + 2, 58, cw, 198, 18, '#4F46E5', 'opacity="0.14"'));
  b.push(rect(cxs, 52, cw, 198, 18, t.card));
  const kids: [string, string, Parameters<typeof avatar>[5], string, string][] = [
    ['Louis', '3e', { skin: SKIN.deep, hair: HAIR.black, style: 'short' }, '#FFE7B8', P.amber],
    ['Emma', '5e', { skin: SKIN.medium, hair: HAIR.dark, style: 'puffs' }, '#FCE1EE', P.pinkDark],
    ['Mathis', 'CP', { skin: SKIN.tan, hair: HAIR.brown, style: 'curly' }, '#DCE8FF', P.blue],
  ];
  const avDefs: string[] = [];
  kids.forEach(([name, cls, f, bg, shirt], i) => {
    const y = 52 + i * 66;
    if (i > 0) b.push(rect(cxs + 14, y, cw - 28, 1.5, 0.75, t.cardLine));
    const [d, a] = avatar(`o4k${i}${u}`, cxs + 32, y + 33, 19, bg, f, shirt);
    avDefs.push(d);
    b.push(a);
    b.push(`<text x="${cxs + 60}" y="${y + 30}" font-size="15" fill="${t.cardText}" ${t.font('semibold')}>${name}</text>`);
    b.push(`<text x="${cxs + 60}" y="${y + 48}" font-size="12.5" fill="${t.cardSub}" ${t.font('semibold')}>${cls}</text>`);
  });
  return svg(W, H, defs + avDefs.join(''), b.join(''));
};
