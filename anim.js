'use strict';
/* Animaciones de los ejercicios: un muñequito en SVG dibujado con código.
   No usa imágenes ni internet. Cada ejercicio define dos posturas (a → b)
   o una función de movimiento continuo, y brazos/piernas se calculan con
   cinemática inversa (como en los videojuegos). */
const ANIM = (() => {
  const L = { torso: 30, neck: 11, ua: 17, fa: 15, th: 23, sh: 22 };
  const rad = (d) => (d * Math.PI) / 180;
  const lerp = (a, b, u) => a + (b - a) * u;

  // Cinemática inversa de 2 segmentos: devuelve [codo/rodilla, mano/tobillo]
  function ik(root, target, a, b, hint) {
    const dx = target[0] - root[0], dy = target[1] - root[1];
    const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(a - b) + 0.01), a + b - 0.01);
    const th = Math.atan2(dy, dx);
    const al = Math.acos(Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d))));
    const c1 = [root[0] + a * Math.cos(th + al), root[1] + a * Math.sin(th + al)];
    const c2 = [root[0] + a * Math.cos(th - al), root[1] + a * Math.sin(th - al)];
    const mid = [(root[0] + target[0]) / 2, (root[1] + target[1]) / 2];
    const dot = (c) => (c[0] - mid[0]) * hint[0] + (c[1] - mid[1]) * hint[1];
    const j = dot(c1) >= dot(c2) ? c1 : c2;
    const ang = Math.atan2(target[1] - j[1], target[0] - j[0]);
    return [j, [j[0] + b * Math.cos(ang), j[1] + b * Math.sin(ang)]];
  }

  function mix(a, b, u) {
    const o = {};
    for (const k in a) {
      const x = a[k], y = b[k] ?? x;
      if (typeof x === 'number') o[k] = lerp(x, y, u);
      else if (Array.isArray(x)) o[k] = x.map((v, i) => lerp(v, y[i], u));
      else o[k] = x;
    }
    return o;
  }
  const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
  // ida y vuelta con pausas en los extremos
  function pingpong(p) {
    if (p < 0.1) return 0;
    if (p < 0.5) return ease((p - 0.1) / 0.4);
    if (p < 0.6) return 1;
    return ease(1 - (p - 0.6) / 0.4);
  }

  function skeleton(p, front) {
    const tr = rad(p.t), dir = [Math.cos(tr), Math.sin(tr)];
    const sc = [p.hip[0] + L.torso * dir[0], p.hip[1] + L.torso * dir[1]];
    const head = [p.hip[0] + (L.torso + L.neck) * dir[0], p.hip[1] + (L.torso + L.neck) * dir[1]];
    const S = front ? [sc[0] + 9, sc[1]] : sc;
    const H = front ? [p.hip[0] + 5, p.hip[1]] : p.hip;
    const k = p.armScale ?? 1;
    const [el, hand] = ik(S, p.hand, L.ua * k, L.fa * k, p.eh || [0, 1]);
    const [kn, ank] = ik(H, p.foot, L.th, L.sh, p.kh || [1, 0]);
    const toe = p.toe || (front ? [ank[0] + 3, ank[1]] : [ank[0] + 8, ank[1]]);
    const sk = { hipC: p.hip, sc, head, S, H, el, hand, kn, ank, toe, far: null };
    if (front) {
      const m = (q) => [2 * p.hip[0] - q[0], q[1]];
      sk.far = { S: m(S), H: m(H), el: m(el), hand: m(hand), kn: m(kn), ank: m(ank), toe: m(toe), mirror: true };
    } else if (p.fhand || p.ffoot) {
      const f = { S, H };
      if (p.fhand) [f.el, f.hand] = ik(S, p.fhand, L.ua, L.fa, p.feh || p.eh || [0, 1]);
      if (p.ffoot) {
        [f.kn, f.ank] = ik(H, p.ffoot, L.th, L.sh, p.fkh || p.kh || [1, 0]);
        f.toe = p.ftoe || [f.ank[0] + 8, f.ank[1]];
      }
      sk.far = f;
    }
    return sk;
  }

  /* ---------- dibujo ---------- */
  const f1 = (n) => n.toFixed(1);
  const ln = (a, b, w, cls) => `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke-width="${w}" class="${cls}"/>`;
  const circ = (c, r, cls) => `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${r}" class="${cls}"/>`;

  function anchor(sk, at, far) {
    const src = far ? sk.far : sk;
    if (!src) return null;
    return { hand: src.hand, S: src.S, hip: far ? src.H : sk.hipC, ank: src.ank }[at];
  }

  function prop(pr, sk) {
    switch (pr.k) {
      case 'line': return ln([pr.p[0], pr.p[1]], [pr.p[2], pr.p[3]], pr.w || 3, 'eq');
      case 'rect': return `<rect x="${pr.p[0]}" y="${pr.p[1]}" width="${pr.p[2]}" height="${pr.p[3]}" rx="2" class="eqf"/>`;
      case 'circle': return circ(pr.c, pr.r, 'eq');
      default: break;
    }
    const out = [];
    const sides = sk.far?.mirror && pr.at === 'hand' ? [false, true] : [false];
    for (const far of sides) {
      const a = anchor(sk, pr.at, far);
      if (!a) continue;
      const o = pr.off || [0, 0];
      const c = [a[0] + o[0], a[1] + o[1]];
      if (pr.k === 'plate') out.push(circ(c, pr.r || 9, 'w'), circ(c, 1.6, 'wf'));
      else if (pr.k === 'db') out.push(sk.far?.mirror ? ln([c[0], c[1] - 5], [c[0], c[1] + 5], 5, 'wl') : circ(c, 4.2, 'wf'));
      else if (pr.k === 'dot') out.push(circ(c, pr.r || 2.6, 'wf'));
      else if (pr.k === 'pad') out.push(circ(c, pr.r || 3.6, 'eqf'));
      else if (pr.k === 'cable') {
        const from = far ? [2 * sk.hipC[0] - pr.from[0], pr.from[1]] : pr.from;
        out.push(ln(from, c, 1.2, 'eq'), circ(from, 3, 'eqf'));
      } else if (pr.k === 'plat') {
        const n = Math.hypot(pr.dir[0], pr.dir[1]);
        const px = -pr.dir[1] / n, py = pr.dir[0] / n, h = (pr.len || 20) / 2;
        out.push(ln([c[0] + px * h, c[1] + py * h], [c[0] - px * h, c[1] - py * h], 4, 'eq'));
      }
    }
    return out.join('');
  }

  function figure(sk, front) {
    let s = '';
    const f = sk.far;
    if (f) {
      const cls = f.mirror ? 'b' : 'b far';
      if (f.kn) s += ln(f.H, f.kn, 6, cls) + ln(f.kn, f.ank, 5, cls) + ln(f.ank, f.toe, 4, cls);
      if (f.el) s += ln(f.S, f.el, 5, cls) + ln(f.el, f.hand, 4.5, cls);
    }
    if (front) s += ln(f.S, sk.S, 6, 'b') + ln(f.H, sk.H, 6, 'b');
    s += ln(sk.hipC, sk.sc, 8, 'b');
    s += circ(sk.head, 6.5, 'bf');
    s += ln(sk.H, sk.kn, 6, 'b') + ln(sk.kn, sk.ank, 5, 'b') + ln(sk.ank, sk.toe, 4, 'b');
    s += ln(sk.S, sk.el, 5, 'b') + ln(sk.el, sk.hand, 4.5, 'b');
    return s;
  }

  function frame(spec, t) {
    let p;
    if (spec.fn) p = spec.fn(t);
    else p = mix(spec.a, { ...spec.a, ...spec.b }, pingpong(t));
    const sk = skeleton(p, spec.front);
    const props = spec.props || [];
    let s = spec.noGround ? '' : ln([6, 110], [154, 110], 1.5, 'gr');
    s += props.filter((x) => ['line', 'rect', 'circle'].includes(x.k)).map((x) => prop(x, sk)).join('');
    s += props.filter((x) => x.k === 'cable').map((x) => prop(x, sk)).join('');
    if (spec.under) s += spec.under(sk, p, t);
    s += figure(sk, spec.front);
    s += props.filter((x) => !['line', 'rect', 'circle', 'cable'].includes(x.k)).map((x) => prop(x, sk)).join('');
    if (spec.over) s += spec.over(sk, p, t);
    return s;
  }

  /* ---------- ejercicios ---------- */
  const STAND = { hip: [80, 66], t: -90, hand: [83, 67], foot: [84, 110] };
  const FLAT_BENCH = [
    { k: 'rect', p: [38, 86, 70, 6] }, { k: 'line', p: [46, 92, 46, 110] }, { k: 'line', p: [100, 92, 100, 110] },
  ];
  const PULL_BAR = [{ k: 'line', p: [56, 12, 112, 12], w: 4 }];

  const S = {
    'Sentadilla': {
      a: { hip: [80, 66], t: -90, hand: [77, 37], foot: [84, 110], eh: [-0.4, 1] },
      b: { hip: [63, 92], t: -58, hand: [76, 68] },
      props: [{ k: 'plate', at: 'S', off: [-4, -3], r: 10 }],
      tips: ['Pies al ancho de hombros, puntas un poco hacia afuera.', 'Baja como si te sentaras atrás, con el pecho arriba.', 'Rodillas en dirección de las puntas; sube empujando con todo el pie.'],
    },
    'Prensa': {
      a: { hip: [62, 92], t: -122, hand: [70, 94], foot: [84, 68], kh: [-0.3, -1] },
      b: { foot: [94, 54] },
      props: [{ k: 'line', p: [40, 64, 58, 96], w: 5 }, { k: 'line', p: [58, 98, 80, 98], w: 4 }, { k: 'line', p: [70, 104, 130, 30], w: 1.5 }, { k: 'plat', at: 'ank', dir: [1, -1.2], len: 22 }],
      tips: ['Espalda baja pegada al respaldo todo el tiempo.', 'Baja hasta que las rodillas lleguen cerca del pecho sin que se despegue la cadera.', 'No bloquees las rodillas arriba.'],
    },
    'Zancadas': {
      a: { hip: [78, 66], t: -90, hand: [79, 67], foot: [95, 110], ffoot: [60, 106], ftoe: [67, 110], fkh: [0.3, 1] },
      b: { hip: [77, 84], hand: [78, 85], ffoot: [58, 104], ftoe: [65, 110] },
      props: [{ k: 'db', at: 'hand' }],
      tips: ['Paso largo; baja recto hacia abajo, no hacia adelante.', 'La rodilla de atrás casi toca el piso.', 'Torso derecho y empuja con el talón de la pierna de adelante.'],
    },
    'Peso muerto rumano': {
      a: { ...STAND },
      b: { hip: [70, 68], t: -18, hand: [90, 88], eh: [1, 0] },
      props: [{ k: 'plate', at: 'hand', r: 9 }],
      tips: ['Rodillas apenas flexionadas y fijas.', 'Lleva la cadera hacia atrás, la barra pegada a las piernas.', 'Baja hasta sentir el estiramiento atrás del muslo, espalda recta.'],
    },
    'Peso muerto': {
      a: { hip: [68, 86], t: -33, hand: [87, 100], foot: [86, 110] },
      b: { hip: [80, 66], t: -90, hand: [83, 67] },
      props: [{ k: 'plate', at: 'hand', r: 9 }],
      tips: ['Barra sobre la mitad del pie, espalda recta y pecho arriba.', 'Empuja el piso con las piernas y extiende la cadera al final.', 'La barra sube pegada al cuerpo; no redondees la espalda.'],
    },
    'Hip thrust': {
      a: { hip: [71, 103], t: -152, hand: [71, 96], foot: [100, 110], kh: [0.2, -1], eh: [0.5, -1] },
      b: { hip: [76, 86], t: -182, hand: [76, 79] },
      props: [{ k: 'rect', p: [20, 86, 32, 24] }, { k: 'plate', at: 'hip', off: [0, -9], r: 9 }],
      tips: ['Parte alta de la espalda apoyada en la banca.', 'Sube la cadera apretando glúteos hasta quedar recto de hombros a rodillas.', 'Barbilla hacia el pecho; no arquees la espalda baja.'],
    },
    'Puente de glúteo': {
      a: { hip: [80, 104], t: 180, hand: [81, 108], foot: [104, 110], kh: [0, -1], eh: [0, 1] },
      b: { hip: [82, 90], t: 155, hand: [85, 108] },
      tips: ['Boca arriba, rodillas dobladas y pies cerca de los glúteos.', 'Sube la cadera apretando glúteos hasta quedar recto de hombros a rodillas.', 'Pausa 1 segundo arriba y baja lento.'],
    },
    'Extensión de cuádriceps': {
      a: { hip: [70, 79], t: -100, hand: [70, 84], foot: [80, 106], kh: [1, -0.2] },
      b: { foot: [112, 70] },
      props: [{ k: 'rect', p: [48, 82, 32, 6] }, { k: 'line', p: [50, 82, 44, 46], w: 5 }, { k: 'line', p: [62, 88, 62, 110] }, { k: 'pad', at: 'ank' }],
      tips: ['Ajusta el rodillo justo arriba del tobillo.', 'Sube hasta estirar la pierna y aprieta un segundo arriba.', 'Baja lento, sin dejar caer el peso.'],
    },
    'Curl femoral': {
      a: { hip: [84, 77], t: 180, hand: [46, 90], foot: [128, 78], kh: [1, 0.6], eh: [1, 0.5] },
      b: { foot: [104, 54] },
      props: [{ k: 'rect', p: [30, 82, 80, 6] }, { k: 'line', p: [40, 88, 40, 110] }, { k: 'line', p: [100, 88, 100, 110] }, { k: 'pad', at: 'ank' }],
      tips: ['Cadera pegada a la banca todo el tiempo.', 'Lleva los talones hacia los glúteos.', 'Baja controlado, sin rebotar.'],
    },
    'Elevación de pantorrilla': {
      a: { hip: [80, 62], t: -90, hand: [83, 63], foot: [84, 106], toe: [94, 110] },
      b: { hip: [83, 54], hand: [86, 55], foot: [88, 98], toe: [95, 110] },
      props: [{ k: 'db', at: 'hand' }],
      tips: ['Sube lo más alto que puedas, sobre la punta de los pies.', 'Pausa un segundo arriba.', 'Baja lento hasta estirar bien la pantorrilla.'],
    },
    'Press de banca': {
      a: { hip: [92, 81], t: 180, hand: [62, 50], foot: [112, 110], kh: [1, -0.8], eh: [0.3, 1] },
      b: { hand: [66, 72], eh: [0.2, 1] },
      props: [...FLAT_BENCH, { k: 'plate', at: 'hand', r: 9 }],
      tips: ['Omóplatos juntos y hacia abajo, pies firmes en el piso.', 'Baja la barra a la parte baja del pecho, codos a unos 45°.', 'Empuja hacia arriba y un poco hacia atrás.'],
    },
    'Press inclinado con mancuernas': {
      a: { hip: [96, 88], t: -145, hand: [72, 40], foot: [120, 110], kh: [1, -0.6], eh: [0.3, 1] },
      b: { hand: [77, 64], eh: [0.4, 1] },
      props: [{ k: 'line', p: [100, 94, 62, 67], w: 5 }, { k: 'line', p: [96, 96, 96, 110] }, { k: 'db', at: 'hand' }],
      tips: ['Banca a unos 30°.', 'Baja las mancuernas a los lados del pecho, codos a 45°.', 'Sube juntándolas arriba sin chocarlas.'],
    },
    'Aperturas con mancuernas': {
      a: { hip: [92, 81], t: 180, hand: [62, 50], foot: [112, 110], kh: [1, -0.8], eh: [1, 0] },
      b: { hand: [60, 84], armScale: 0.4 },
      props: [...FLAT_BENCH, { k: 'db', at: 'hand' }],
      tips: ['Codos ligeramente flexionados y fijos todo el movimiento.', 'Abre los brazos hasta sentir el estiramiento en el pecho.', 'Cierra como si abrazaras un árbol.'],
    },
    'Cruces en polea': {
      front: true,
      a: { hip: [80, 66], t: -90, hand: [116, 42], foot: [88, 110], eh: [0.3, 1] },
      b: { hand: [86, 72] },
      props: [{ k: 'cable', at: 'hand', from: [148, 8] }, { k: 'dot', at: 'hand' }],
      tips: ['Un pie adelante y el torso un poco inclinado.', 'Codos ligeramente flexionados.', 'Junta las manos frente a ti y aprieta el pecho.'],
    },
    'Fondos en paralelas': {
      noGround: true,
      a: { hip: [78, 61], t: -86, hand: [82, 60], foot: [60, 90], eh: [-1, 0] },
      b: { hip: [70, 78], t: -72, foot: [52, 106] },
      props: [{ k: 'line', p: [64, 60, 106, 60], w: 4 }, { k: 'line', p: [100, 60, 100, 118] }],
      tips: ['Inclina un poco el torso hacia adelante para trabajar más pecho.', 'Baja hasta que el brazo quede paralelo al piso.', 'Sube sin bloquear los codos de golpe.'],
    },
    'Lagartijas': {
      a: { hip: [64, 88], t: -18, hand: [94, 110], foot: [22, 106], toe: [26, 110], eh: [-1, 0], kh: [0, 1] },
      b: { hip: [64, 97], t: -9, eh: [-1, -0.3] },
      tips: ['Cuerpo recto como tabla, abdomen apretado.', 'Manos un poco más abiertas que los hombros.', 'Baja hasta casi tocar el piso con el pecho.'],
    },
    'Dominadas': {
      noGround: true,
      a: { hip: [80, 74], t: -90, hand: [83, 13], foot: [74, 110], eh: [0.6, 1] },
      b: { hip: [80, 56], foot: [74, 92] },
      props: PULL_BAR,
      tips: ['Agarre un poco más abierto que los hombros.', 'Empieza bajando los hombros, luego jala con los codos hacia abajo.', 'Sube hasta pasar la barbilla y baja completo y controlado.'],
    },
    'Jalón al pecho': {
      a: { hip: [76, 82], t: -98, hand: [82, 22], foot: [102, 110], eh: [0.3, 1] },
      b: { t: -105, hand: [78, 52], eh: [-0.3, 1] },
      props: [{ k: 'rect', p: [60, 84, 30, 6] }, { k: 'line', p: [76, 90, 76, 110] }, { k: 'cable', at: 'hand', from: [82, 2] }, { k: 'dot', at: 'hand' }],
      tips: ['Pecho arriba e inclínate apenas hacia atrás.', 'Jala la barra a la parte alta del pecho llevando codos hacia abajo.', 'Sube lento hasta estirar los brazos.'],
    },
    'Remo con barra': {
      a: { hip: [72, 68], t: -22, hand: [98, 90], foot: [84, 110], eh: [0, 1] },
      b: { hand: [88, 72], eh: [-0.6, -1] },
      props: [{ k: 'plate', at: 'hand', r: 9 }],
      tips: ['Torso inclinado unos 45° o más, espalda recta.', 'Jala la barra hacia el ombligo.', 'Junta los omóplatos arriba y baja controlado.'],
    },
    'Remo con mancuerna': {
      a: { hip: [66, 70], t: -12, hand: [96, 98], fhand: [106, 86], foot: [58, 110], feh: [1, 0] },
      b: { hand: [84, 76], eh: [-0.6, -1] },
      props: [{ k: 'rect', p: [76, 86, 44, 6] }, { k: 'line', p: [112, 92, 112, 110] }, { k: 'db', at: 'hand' }],
      tips: ['Una mano y una rodilla en la banca, espalda plana.', 'Jala la mancuerna hacia la cadera, no hacia el hombro.', 'Baja hasta estirar el brazo.'],
    },
    'Remo sentado en polea': {
      a: { hip: [60, 95], t: -68, hand: [100, 78], foot: [104, 100], kh: [0, -1], eh: [0, 1] },
      b: { t: -96, hand: [76, 80], eh: [-1, 0] },
      props: [{ k: 'rect', p: [40, 98, 40, 5] }, { k: 'line', p: [110, 86, 110, 108], w: 4 }, { k: 'cable', at: 'hand', from: [150, 80] }, { k: 'dot', at: 'hand' }],
      tips: ['Rodillas un poco flexionadas, pecho arriba.', 'Jala hacia el abdomen juntando los omóplatos.', 'Regresa estirando brazos sin encorvarte.'],
    },
    'Press militar': {
      a: { ...STAND, hand: [86, 38], eh: [0.6, 1] },
      b: { hand: [80, 6], eh: [0.3, 1] },
      props: [{ k: 'plate', at: 'hand', r: 9 }],
      tips: ['Glúteos y abdomen apretados, no arquees la espalda.', 'Sube la barra en línea recta, pasando la cara.', 'Arriba, mete la cabeza entre los brazos.'],
    },
    'Elevaciones laterales': {
      front: true,
      a: { hip: [80, 66], t: -90, hand: [92, 66], foot: [86, 110], eh: [1, 0.2] },
      b: { hand: [118, 40], eh: [0, 1] },
      props: [{ k: 'db', at: 'hand' }],
      tips: ['Codos ligeramente flexionados.', 'Sube hasta la altura de los hombros, no más.', 'Baja lento; usa poco peso y buena técnica.'],
    },
    'Face pull': {
      a: { hip: [80, 66], t: -94, hand: [110, 38], foot: [84, 110], eh: [0, 1] },
      b: { hand: [86, 30], eh: [-1, -0.3] },
      props: [{ k: 'cable', at: 'hand', from: [148, 30] }, { k: 'dot', at: 'hand' }],
      tips: ['Polea a la altura de la cara, agarra la cuerda.', 'Jala hacia la frente abriendo los codos hacia afuera y arriba.', 'Aprieta atrás un segundo.'],
    },
    'Pájaros (deltoide posterior)': {
      a: { hip: [70, 68], t: -15, hand: [100, 92], foot: [84, 110], eh: [1, 0] },
      b: { hand: [102, 64], armScale: 0.35 },
      props: [{ k: 'db', at: 'hand' }],
      tips: ['Inclínate con la espalda recta.', 'Abre los brazos hacia los lados como alas.', 'Codos ligeramente flexionados; usa poco peso.'],
    },
    'Curl con barra': {
      a: { ...STAND, eh: [-0.2, 1] },
      b: { hand: [91, 40] },
      props: [{ k: 'plate', at: 'hand', r: 8 }],
      tips: ['Codos pegados al cuerpo y quietos.', 'Sube sin balancear el torso.', 'Baja lento hasta estirar los brazos.'],
    },
    'Curl martillo': {
      a: { ...STAND, eh: [-0.2, 1] },
      b: { hand: [91, 40] },
      props: [{ k: 'db', at: 'hand' }],
      tips: ['Palmas mirándose entre sí todo el tiempo.', 'Codos fijos a los costados.', 'Sube y baja controlado.'],
    },
    'Extensión de tríceps en polea': {
      a: { hip: [80, 66], t: -84, hand: [94, 42], foot: [84, 110], eh: [-0.2, 1] },
      b: { hand: [90, 66], eh: [-0.3, 1] },
      props: [{ k: 'cable', at: 'hand', from: [104, 4] }, { k: 'dot', at: 'hand' }],
      tips: ['Codos pegados a los costados, solo se mueve el antebrazo.', 'Estira completamente abajo y aprieta.', 'Sube hasta la altura del pecho, lento.'],
    },
    'Press francés': {
      a: { hip: [92, 81], t: 180, hand: [60, 51], foot: [112, 110], kh: [1, -0.8], eh: [0, -1] },
      b: { hand: [46, 66], eh: [0.4, -1] },
      props: [...FLAT_BENCH, { k: 'plate', at: 'hand', r: 7 }],
      tips: ['Brazos apuntando al techo, un poco hacia atrás.', 'Dobla solo los codos y baja la barra hacia la frente o atrás de la cabeza.', 'Codos cerrados, no los abras.'],
    },
    'Plancha': {
      a: { hip: [56, 95], t: -8, hand: [102, 108], foot: [12, 106], toe: [16, 110], eh: [0, 1], kh: [0, 1] },
      b: { hip: [56, 93] },
      tips: ['Codos debajo de los hombros.', 'Cuerpo recto: aprieta abdomen y glúteos.', 'Respira normal; no dejes caer la cadera.'],
    },
    'Crunch': {
      a: { hip: [84, 103], t: 180, hand: [40, 98], foot: [110, 108], kh: [0, -1], eh: [0.4, -1] },
      b: { t: 200, hand: [44, 84] },
      tips: ['Rodillas flexionadas, pies en el piso.', 'Sube los hombros enrollando el abdomen; no jales el cuello.', 'Baja lento.'],
    },
    'Elevación de piernas colgado': {
      noGround: true,
      a: { hip: [80, 74], t: -90, hand: [83, 13], foot: [81, 118], eh: [0.6, 1], kh: [1, 0] },
      b: { foot: [124, 76], kh: [0, 1] },
      props: PULL_BAR,
      tips: ['Cuélgate sin balancearte.', 'Sube las piernas usando el abdomen, no el impulso.', 'Baja lento.'],
    },
    'Caminadora': {
      noGround: true, ms: 1300,
      fn(t) {
        const ph = 2 * Math.PI * t;
        const leg = (o) => { const s = Math.sin(ph + o), c = Math.cos(ph + o); const x = 80 + 15 * s, y = 104 - 4 * Math.max(0, c); return [[x, y], [x + 8, y + 2]]; };
        const [ft, tt] = leg(0), [fft, ftt] = leg(Math.PI);
        const bob = 1.5 * Math.abs(Math.cos(ph));
        return { hip: [80, 64 - bob], t: -86, hand: [82 - 10 * Math.sin(ph), 64 - bob], fhand: [82 + 10 * Math.sin(ph), 64 - bob], foot: ft, toe: tt, ffoot: fft, ftoe: ftt, eh: [0.3, 1], kh: [1, 0] };
      },
      props: [{ k: 'rect', p: [34, 106, 98, 6] }, { k: 'line', p: [126, 106, 118, 56], w: 4 }, { k: 'line', p: [118, 56, 104, 60], w: 3 }],
      tips: ['Camina con la caminadora inclinada (8–12%) a paso rápido.', 'No te agarres de los barandales.', '15 min al final del entrenamiento.'],
    },
    'Bicicleta': {
      ms: 1100,
      fn(t) {
        const ph = 2 * Math.PI * t, c = [92, 94], r = 11;
        const ft = [c[0] + r * Math.cos(ph), c[1] + r * Math.sin(ph)];
        const fft = [c[0] - r * Math.cos(ph), c[1] - r * Math.sin(ph)];
        return { hip: [72, 62], t: -66, hand: [106, 50], fhand: [106, 50], foot: ft, toe: [ft[0] + 7, ft[1]], ffoot: fft, ftoe: [fft[0] + 7, fft[1]], kh: [1, -0.3], eh: [0, 1] };
      },
      props: [{ k: 'line', p: [62, 60, 80, 60], w: 4 }, { k: 'line', p: [72, 62, 92, 94] }, { k: 'line', p: [92, 94, 108, 52] }, { k: 'line', p: [102, 50, 112, 52], w: 4 }, { k: 'circle', c: [116, 94], r: 13 }, { k: 'line', p: [70, 110, 128, 110], w: 4 }],
      under(sk) { return sk.far?.ank ? ln([92, 94], sk.far.ank, 2, 'eq far') : ''; },
      over(sk) { return ln([92, 94], sk.ank, 2.5, 'eq') + circ([92, 94], 2.5, 'eqf'); },
      tips: ['Ajusta el asiento: pierna casi estirada abajo.', 'Ritmo constante, resistencia moderada.', '15 min al final del entrenamiento.'],
    },
    'Saltar la cuerda': {
      front: true, ms: 750,
      fn(t) {
        const ph = 2 * Math.PI * t;
        const jump = 7 * Math.max(0, -Math.cos(ph));
        return { hip: [80, 66 - jump], t: -90, hand: [95, 66 - jump], foot: [86, 110 - jump], eh: [1, 0.5], ropeY: 62 - 52 * Math.cos(ph) };
      },
      over(sk, p) {
        const a = sk.far.hand, b = sk.hand, cy = 2 * p.ropeY - a[1];
        return `<path d="M${f1(a[0])},${f1(a[1])} Q80,${f1(cy)} ${f1(b[0])},${f1(b[1])}" class="rope"/>`;
      },
      tips: ['Salta poquito, solo lo necesario para que pase la cuerda.', 'Gira la cuerda con las muñecas, no con los brazos.', 'Aterriza suave sobre la punta de los pies.'],
    },
  };

  /* ---------- montaje y ciclo de animación ---------- */
  const mounted = new Set();
  let raf = 0, last = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  function loop(now) {
    raf = 0;
    if (now - last > 33) {
      last = now;
      for (const m of mounted) {
        if (!m.svg.isConnected) { mounted.delete(m); continue; }
        const r = m.svg.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) continue;
        m.svg.innerHTML = frame(m.spec, ((now - m.t0) % m.ms) / m.ms);
      }
    }
    if (mounted.size) raf = requestAnimationFrame(loop);
  }

  function mount(el, name) {
    const spec = S[name];
    if (!spec) return;
    el.innerHTML = `<svg class="fig" viewBox="0 0 160 120" role="img" aria-label="Animación: ${name.replace(/"/g, '')}"></svg>`;
    const svg = el.firstChild;
    const m = { svg, spec, ms: spec.ms || 2800, t0: performance.now() };
    svg.innerHTML = frame(spec, spec.fn ? 0 : 0.5);
    if (reduce.matches) return;
    mounted.add(m);
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function mountAll(root = document) {
    root.querySelectorAll('[data-anim]').forEach((el) => mount(el, el.dataset.anim));
  }

  return { has: (name) => !!S[name], tips: (name) => S[name]?.tips || [], mount, mountAll, names: () => Object.keys(S), frame: (name, t) => frame(S[name], t) };
})();
