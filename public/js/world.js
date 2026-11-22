// Craft Player — Fase 3 — mundo realista, sobrevivência, combate, criaturas hostis noturnas, cosméticos, clima e áudio procedural
import { Hostis, DANO, ARMAS, CICLO, ehNoite } from './hostis.js';
const THREE = window.THREE;

/* =====================================================================
   DEFINIÇÕES (itens, recursos, receitas)
   ===================================================================== */
export const ITENS = {
  mao:            { nome: 'Mão', ic: '✋', t: 'ferramenta' },
  madeira:        { nome: 'Madeira', ic: '🪵', t: 'recurso' },
  tabua:          { nome: 'Tábua de Madeira', ic: '🟫', t: 'recurso' },
  pedra:          { nome: 'Pedra', ic: '🪨', t: 'recurso' },
  ferro:          { nome: 'Minério de Ferro', ic: '🔩', t: 'recurso' },
  diamante:       { nome: 'Diamante Bruto', ic: '💎', t: 'recurso' },
  machado_pedra:  { nome: 'Machado de Pedra', ic: '🪓', t: 'ferramenta' },
  picareta_pedra: { nome: 'Picareta de Pedra', ic: '⛏️', t: 'ferramenta' },
  picareta_ferro: { nome: 'Picareta de Ferro', ic: '⚒️', t: 'ferramenta' },
  espada_madeira: { nome: 'Espada de Madeira', ic: '🗡️', t: 'arma' },
  espada_pedra:   { nome: 'Espada de Pedra', ic: '🗡️', t: 'arma' },
  espada_ferro:   { nome: 'Espada de Ferro', ic: '⚔️', t: 'arma' },
  fruta:          { nome: 'Frutas Silvestres', ic: '🍒', t: 'consumivel' },
  carne_crua:     { nome: 'Carne Crua', ic: '🥩', t: 'consumivel' },
  carne_assada:   { nome: 'Carne Assada', ic: '🍖', t: 'consumivel' },
  cantil:         { nome: 'Cantil', ic: '🧴', t: 'consumivel' },
  cantil_cheio:   { nome: 'Cantil Cheio', ic: '💧', t: 'consumivel' },
  fogueira:       { nome: 'Fogueira', ic: '🔥', t: 'peca' },
  cama:           { nome: 'Cama', ic: '🛏️', t: 'peca' },
  fundacao:       { nome: 'Fundação de Madeira', ic: '⬛', t: 'peca' },
  parede:         { nome: 'Parede de Madeira', ic: '🧱', t: 'peca' },
  rampa:          { nome: 'Rampa / Telhado', ic: '📐', t: 'peca' },
  bancada:        { nome: 'Bancada de Trabalho', ic: '🛠️', t: 'peca' },
};
export const PECAS = ['fundacao', 'parede', 'rampa', 'bancada', 'fogueira', 'cama'];
// efeito ao consumir (fome/sede/vida); "volta" = item devolvido
export const CONSUMIVEL = {
  fruta:        { fome: 14, sede: 6,  vida: 0 },
  carne_assada: { fome: 45, sede: 0,  vida: 30 },
  cantil_cheio: { fome: 0,  sede: 45, vida: 0, volta: 'cantil' },
};

export const RECURSOS = {
  arvore:  { nome: 'Árvore',               cat: 'madeira', tier: 0, dureza: 4, respawn: 180, req: 'Mão' },
  rocha:   { nome: 'Rocha',                cat: 'pedra',   tier: 0, dureza: 3, respawn: 120, req: 'Mão' },
  ferro:   { nome: 'Veio de Ferro',        cat: 'ferro',   tier: 1, dureza: 5, respawn: 300, req: 'Picareta de Pedra' },
  cristal: { nome: 'Veio de Diamante',  cat: 'cristal', tier: 2, dureza: 7, respawn: 300, req: 'Picareta de Ferro' },
  fruta:   { nome: 'Arbusto de Frutas',    cat: 'planta',  tier: 0, dureza: 1.2, respawn: 150, req: 'Mão' },
};
// multiplicador de velocidade por ferramenta (0 = não consegue coletar)
const FERR = {
  mao:            { tier: 0, madeira: .8, pedra: .6 },
  machado_pedra:  { tier: 0, madeira: 3.2, pedra: .6 },
  picareta_pedra: { tier: 1, madeira: .8, pedra: 2.4 },
  picareta_ferro: { tier: 2, madeira: .8, pedra: 4 },
};
export function velocidadeColeta(ferr, tipo) {
  const r = RECURSOS[tipo], f = FERR[ferr] || FERR.mao;
  if (f.tier < r.tier) return 0;
  if (r.cat === 'planta') return 2.2;
  return f[r.cat === 'madeira' ? 'madeira' : 'pedra'];
}
export function dropsDe(tipo) {
  const q = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  if (tipo === 'arvore') return { madeira: q(3, 5) };
  if (tipo === 'rocha') return { pedra: q(2, 3) };
  if (tipo === 'ferro') return { ferro: q(1, 2) };
  if (tipo === 'fruta') return { fruta: q(2, 3) };
  return { diamante: 1 };
}
export const RECEITAS = [
  { id: 'tabua',          sai: { tabua: 2 },          custo: { madeira: 1 } },
  { id: 'machado_pedra',  sai: { machado_pedra: 1 },  custo: { madeira: 2, pedra: 3 } },
  { id: 'picareta_pedra', sai: { picareta_pedra: 1 }, custo: { madeira: 2, pedra: 3 } },
  { id: 'picareta_ferro', sai: { picareta_ferro: 1 }, custo: { madeira: 2, ferro: 3 } },
  { id: 'fogueira',       sai: { fogueira: 1 },       custo: { madeira: 3, pedra: 2 } },
  { id: 'fundacao',       sai: { fundacao: 1 },       custo: { tabua: 4 } },
  { id: 'parede',         sai: { parede: 1 },         custo: { tabua: 3 } },
  { id: 'rampa',          sai: { rampa: 1 },          custo: { tabua: 3 } },
  { id: 'bancada',        sai: { bancada: 1 },        custo: { tabua: 4, pedra: 1 } },
  { id: 'cama',           sai: { cama: 1 },           custo: { tabua: 4, madeira: 2 } },
  { id: 'espada_madeira', sai: { espada_madeira: 1 }, custo: { madeira: 3 } },
  { id: 'espada_pedra',   sai: { espada_pedra: 1 },   custo: { madeira: 1, pedra: 3 } },
  { id: 'espada_ferro',   sai: { espada_ferro: 1 },   custo: { madeira: 1, ferro: 3 } },
  { id: 'cantil',         sai: { cantil: 1 },         custo: { madeira: 2, pedra: 1 } },
];

const QUALIDADE = {
  baixa: { pr: 1,   sombra: false, seg: 110, far: 170, dec: 250, fog: .0105 },
  media: { pr: 1.5, sombra: true,  seg: 180, far: 260, dec: 500, fog: .0078 },
  alta:  { pr: 2,   sombra: true,  seg: 240, far: 340, dec: 900, fog: .0062 },
};
export const detectaMobile = () => matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
export const qualidadeAuto = () => (detectaMobile() ? 'baixa' : 'alta');

const ALC = 5.2;          // alcance de coleta
const AGUA = 0;           // nível da água

/* =====================================================================
   RUÍDO / TERRENO (determinístico: mesmo seed => mesmo mundo em todos os clientes)
   ===================================================================== */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(ix, iz, s) { let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(s, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
function vnoise(x, z, s, per = 0) {
  let ix = Math.floor(x), iz = Math.floor(z); const fx = x - ix, fz = z - iz;
  let jx = ix + 1, jz = iz + 1;
  if (per) { ix = ((ix % per) + per) % per; iz = ((iz % per) + per) % per; jx = ((jx % per) + per) % per; jz = ((jz % per) + per) % per; }
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = hash(ix, iz, s), b = hash(jx, iz, s), c = hash(ix, jz, s), d = hash(jx, jz, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, s, o = 4) { let a = .5, f = 1, t = 0, n = 0; for (let i = 0; i < o; i++) { t += vnoise(x * f, z * f, s + i * 101) * a; n += a; a *= .5; f *= 2.03; } return t / n; }

export function heightAt(x, z, seed) {
  const s = seed | 0;
  const cont = fbm(x * .0045, z * .0045, s, 4);
  const hill = fbm(x * .02 + 50, z * .02 - 30, s + 7, 3);
  const det = fbm(x * .09, z * .09, s + 13, 2);
  let h = (cont - .47) * 16 + hill * 3.2 + det * .6;
  // montanha: relevo alto com cristas e terraços (escaláveis)
  const m = smooth(.56, .78, cont);
  const ridge = 1 - Math.abs(fbm(x * .025, z * .025, s + 29, 3) * 2 - 1);
  h += m * m * (26 + ridge * 14);
  if (m > 0) { const q = h / 2.6, f = Math.floor(q); h += (f + smooth(.35, .65, q - f) - q) * 2.6 * .45 * m; }
  // rios
  const rv = Math.abs(fbm(x * .007 + 200, z * .007 + 120, s + 53, 3) - .5);
  h -= smooth(.045, 0, rv) * 7 * (1 - m);
  // área de início plana e seca
  const d = Math.sqrt(x * x + z * z);
  const w = 1 - smooth(8, 48, d);
  h = h * (1 - w) + (3.2 + hill * 1.2) * w;
  // borda da ilha
  h -= smooth(190, 250, d) * 22;
  return h;
}

// recursos coletáveis: ids determinísticos (t# árvores, r# rochas, o# minérios)
export function gerarRecursos(seed) {
  const rnd = mulberry32((seed ^ 0x9e3779b9) >>> 0), out = [];
  const cont = { t: 0, r: 0, o: 0 };
  const amostra = () => { const x = (rnd() - .5) * 440, z = (rnd() - .5) * 440; return [x, z, heightAt(x, z, seed)]; };
  const decl = (x, z, h) => Math.abs(heightAt(x + 1.5, z, seed) - h) + Math.abs(heightAt(x, z + 1.5, seed) - h);
  for (let i = 0; i < 16000 && cont.t < 650; i++) {
    const [x, z, h] = amostra();
    if (h < 1.5 || h > 17 || x * x + z * z < 64 || decl(x, z, h) > 1.8) continue;
    if (rnd() > fbm(x * .03, z * .03, (seed + 400) | 0, 3) * 1.5) continue;
    const pino = h > 7 ? rnd() < .85 : rnd() < .35;
    out.push({ id: 't' + cont.t++, tipo: 'arvore', v: pino ? 'pino' : 'carvalho', x, z, y: h, e: .85 + rnd() * .7, r: rnd() * 6.283 });
  }
  for (let i = 0; i < 6000 && cont.r < 140; i++) {
    const [x, z, h] = amostra();
    if (h < .9 || h > 30 || x * x + z * z < 36) continue;
    out.push({ id: 'r' + cont.r++, tipo: 'rocha', x, z, y: h, e: .7 + rnd() * 1.1, r: rnd() * 6.283 });
  }
  let nf = 0, nc = 0;
  for (let i = 0; i < 20000 && (nf < 45 || nc < 18); i++) {
    const [x, z, h] = amostra();
    if (h < 9 || decl(x, z, h) > 3.2) continue;
    if (h > 15 && nc < 18 && rnd() < .5) { out.push({ id: 'o' + cont.o++, tipo: 'cristal', x, z, y: h, e: 1.2 + rnd() * .5, r: rnd() * 6.283 }); nc++; }
    else if (nf < 45) { out.push({ id: 'o' + cont.o++, tipo: 'ferro', x, z, y: h, e: 1.2 + rnd() * .5, r: rnd() * 6.283 }); nf++; }
  }
  let nfr = 0;
  for (let i = 0; i < 6000 && nfr < 90; i++) {
    const [x, z, h] = amostra();
    if (h < 1.5 || h > 11 || x * x + z * z < 36 || decl(x, z, h) > 2.2) continue;
    if (rnd() > fbm(x * .04, z * .04, (seed + 900) | 0, 2) * 1.3) continue;
    out.push({ id: 'f' + nfr++, tipo: 'fruta', x, z, y: h, e: .8 + rnd() * .35, r: rnd() * 6.283 });
  }
  return out;
}

/* =====================================================================
   GEOMETRIAS / TEXTURAS PROCEDURAIS
   ===================================================================== */
const hp = (x, y, z, s) => { const v = Math.sin(Math.round(x * 1e4) * 127.1 + Math.round(y * 1e4) * 311.7 + Math.round(z * 1e4) * 74.7 + s * 19.3) * 43758.5453; return v - Math.floor(v); };
function organico(g, amp, seed) { // deforma radialmente => visual orgânico (sem formas perfeitas)
  g.computeBoundingBox(); const c = new THREE.Vector3(); g.boundingBox.getCenter(c);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + (hp(x, y, z, seed) - .5) * amp;
    p.setXYZ(i, c.x + (x - c.x) * k, c.y + (y - c.y) * k, c.z + (z - c.z) * k);
  }
  return g;
}
function suavizar(g) {
  g.computeVertexNormals(); if (g.index) return g;
  const p = g.attributes.position, n = g.attributes.normal, m = new Map(), K = i => p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3);
  for (let i = 0; i < p.count; i++) { const k = K(i); let a = m.get(k); if (!a) { a = [0, 0, 0]; m.set(k, a); } a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); }
  for (let i = 0; i < p.count; i++) { const a = m.get(K(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
  return g;
}
function fundir(partes) { // une geometrias com cor por vértice em uma só (1 draw call por espécie)
  const P = [], N = [], C = [], col = new THREE.Color();
  for (const [g0, hex] of partes) {
    suavizar(g0); const g = g0.index ? g0.toNonIndexed() : g0, p = g.attributes.position, n = g.attributes.normal;
    col.setHex(hex);
    for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); C.push(col.r, col.g, col.b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  return g;
}
const geoPino = () => {
  const t = new THREE.CylinderGeometry(.14, .3, 4.4, 6).translate(0, 2.2, 0);
  const cone = (r, h, y, s) => organico(new THREE.ConeGeometry(r, h, 9, 3).translate(0, y + h / 2 - .2, 0), .24, s);
  return fundir([[organico(t, .08, 9), 0x4e3522], [cone(1.9, 2.8, 3.0, 1), 0x1d4a28], [cone(1.5, 2.6, 4.6, 2), 0x275a31], [cone(1.05, 2.4, 6.0, 3), 0x2f6b3a]]);
};
const geoCarvalho = () => {
  const t = new THREE.CylinderGeometry(.2, .4, 3.3, 7).translate(0, 1.65, 0);
  const cr = (r, x, y, z, s) => organico(new THREE.IcosahedronGeometry(r, 1), .32, s).translate(x, y, z);
  return fundir([[organico(t, .1, 3), 0x5a3d25], [cr(1.7, 0, 4.3, 0, 1), 0x3f7a2e], [cr(1.3, 1.1, 3.7, .7, 2), 0x4b8a33], [cr(1.3, -1, 3.9, -.6, 3), 0x356b28], [cr(1.1, .2, 5.2, -.4, 4), 0x55963a]]);
};
const geoRocha = (cor = 0x7a766e) => fundir([[organico(new THREE.DodecahedronGeometry(1, 1), .5, 7).scale(1, .75, 1.1).translate(0, .45, 0), cor]]);
const geoFerro = () => {
  const partes = [[organico(new THREE.DodecahedronGeometry(.95, 1), .45, 11).scale(1, .8, 1).translate(0, .5, 0), 0x5d5953]];
  for (let i = 0; i < 6; i++) { const a = i * 1.05, r = .55 + (i % 2) * .15; partes.push([organico(new THREE.IcosahedronGeometry(.26, 0), .4, i).translate(Math.cos(a) * r, .7 + (i % 3) * .18, Math.sin(a) * r), i % 2 ? 0xb5532a : 0xd9763a]); }
  return fundir(partes);
};
const geoCristal = () => {
  const partes = [[organico(new THREE.DodecahedronGeometry(.95, 1), .45, 13).scale(1, .7, 1).translate(0, .4, 0), 0x55606a]];
  for (let i = 0; i < 5; i++) { const a = i * 1.3, c = new THREE.ConeGeometry(.2 + (i % 2) * .06, .9 + (i % 3) * .3, 5); c.translate(0, .5 + (i % 3) * .15, 0); c.rotateZ(Math.cos(a) * .35); c.rotateX(Math.sin(a) * .35); c.translate(Math.cos(a) * .35, .35, Math.sin(a) * .35); partes.push([c, i % 2 ? 0x7ae8ff : 0xa5f3ff]); }
  return fundir(partes);
};
const geoArbusto = () => fundir([[organico(new THREE.IcosahedronGeometry(.7, 1), .38, 5).scale(1.2, .8, 1.2).translate(0, .4, 0), 0x36672a]]);
const geoFruta = () => {
  const partes = [[organico(new THREE.IcosahedronGeometry(.7, 1), .38, 6).scale(1.15, .8, 1.15).translate(0, .42, 0), 0x2f6b2b]];
  for (let i = 0; i < 9; i++) { const a = i * 2.4, r = .62 + (i % 3) * .08; partes.push([new THREE.IcosahedronGeometry(.075, 0).translate(Math.cos(a) * r, .35 + (i % 4) * .16, Math.sin(a) * r), 0xc4162c]); }
  return fundir(partes);
};

function texRuido(tam, base, vari, rep) {
  const c = document.createElement('canvas'); c.width = c.height = tam; const g = c.getContext('2d'), id = g.createImageData(tam, tam), per = tam / 16;
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
    const n = vnoise(x / 16, y / 16, 5, per) * .5 + vnoise(x / 8, y / 8, 9, per * 2) * .3 + Math.random() * .22;
    const v = Math.floor(clamp(base + (n - .5) * vari, 0, 255)), k = (y * tam + x) * 4;
    id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 255;
  }
  g.putImageData(id, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 4; return t;
}
/* ---------- modelos de itens na mão e peças de construção ---------- */
function modeloItem(id, sk) {   // sk = skin de ferramenta equipada {cabeca, cabo, brilho}
  const g = new THREE.Group();
  const M = (c, r = .8, m = 0, em = false) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, emissive: em ? c : 0x000000, emissiveIntensity: em ? .5 : 0 });
  const cCabo = sk?.cabo ?? 0x6b4423, brilho = !!sk?.brilho, cab = (c) => sk?.cabeca ?? c, mt = sk?.cabeca ? .6 : 0;
  const cabo = (h) => new THREE.Mesh(new THREE.CylinderGeometry(.024, .03, h, 6), M(cCabo));
  const box = (w, h, d, c, x, y, z, m = 0, em = false) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c, .7, m, em)); b.position.set(x, y, z); return b; };
  if (id === 'mao') g.add(box(.11, .11, .32, 0xd9a779, 0, 0, -.05));
  else if (id === 'machado_pedra') { g.add(cabo(.62)); g.add(box(.22, .14, .05, cab(0x8d8a84), .1, .24, 0, mt, brilho)); g.add(box(.05, .1, .07, cab(0x6e6b66), -.02, .26, 0, mt, brilho)); }
  else if (id === 'picareta_pedra') { g.add(cabo(.62)); g.add(box(.46, .06, .06, cab(0x8d8a84), 0, .27, 0, mt, brilho)); g.add(box(.08, .1, .08, cab(0x6e6b66), 0, .27, 0, mt, brilho)); }
  else if (id === 'picareta_ferro') { g.add(cabo(.62)); g.add(box(.48, .06, .06, cab(0xc2c8d0), 0, .27, 0, .8, brilho)); g.add(box(.08, .1, .08, cab(0x9aa1ab), 0, .27, 0, .8, brilho)); }
  else if (ARMAS.has(id)) {
    const lam = id === 'espada_ferro' ? 0xc8ced6 : id === 'espada_pedra' ? 0x8d8a84 : 0xa8793f, p = cabo(.22); p.position.y = -.12; g.add(p);
    g.add(box(.22, .035, .05, 0x555555, 0, 0, 0)); g.add(box(.07, .55, .02, cab(lam), 0, .3, 0, id === 'espada_ferro' ? .8 : mt, brilho));
  }
  else if (id === 'fruta') { for (const [x, y] of [[-.05, 0], [.05, .02], [0, -.05]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), M(0xc4162c)); b.position.set(x, y, 0); g.add(b); } }
  else if (id === 'carne_crua') g.add(box(.2, .09, .12, 0xc0485a, 0, 0, 0));
  else if (id === 'carne_assada') { g.add(box(.2, .09, .12, 0x8a4a22, 0, 0, 0)); const o = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .24, 6), M(0xefe6d2)); o.rotation.z = Math.PI / 2; g.add(o); }
  else if (id === 'cantil' || id === 'cantil_cheio') { const c = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, .22, 10), M(0x8a6a3a)); g.add(c); const t = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .05, 8), M(id === 'cantil_cheio' ? 0x3a8fd0 : 0x4a3a28)); t.position.y = .14; g.add(t); }
  else if (PECAS.includes(id)) g.add(box(.2, .2, .2, id === 'fogueira' ? 0xc2582a : 0x9a6a3a, 0, 0, 0));
  else if (id) g.add(box(.14, .14, .14, 0x9a8a6a, 0, 0, 0));
  return g;
}
function texMadeira() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#8a5a33'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 14; i++) { const y = i * 9.1; g.fillStyle = `hsl(28,${38 + Math.random() * 14}%,${28 + Math.random() * 16}%)`; g.fillRect(0, y, 128, 8); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, y + 8, 128, 1.2); }
  for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(40,20,5,${.05 + Math.random() * .1})`; g.fillRect(Math.random() * 128, Math.random() * 128, 6 + Math.random() * 30, 1); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
let _matMad = null; const matMad = () => (_matMad ??= new THREE.MeshStandardMaterial({ map: texMadeira(), roughness: .85 }));
// origem de cada peça: fundação = topo da laje; parede/bancada/fogueira = base; rampa = borda baixa (sobe 2 m ao longo de +z local)
function meshPeca(tipo) {
  const g = new THREE.Group(), mad = matMad();
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  if (tipo === 'fundacao') add(new THREE.BoxGeometry(4, 1.5, 4), mad, 0, -.75, 0);
  else if (tipo === 'parede') add(new THREE.BoxGeometry(4, 3, .25), mad, 0, 1.5, 0);
  else if (tipo === 'rampa') { const m = add(new THREE.BoxGeometry(4, .2, 4.472), mad, 0, 1, 0); m.rotation.x = -Math.atan(.5); }
  else if (tipo === 'bancada') {
    add(new THREE.BoxGeometry(1.6, .12, .9), mad, 0, .9, 0);
    for (const [x, z] of [[-.7, -.35], [.7, -.35], [-.7, .35], [.7, .35]]) add(new THREE.BoxGeometry(.1, .9, .1), mad, x, .45, z);
    add(new THREE.BoxGeometry(1.5, .06, .8), mad, 0, .3, 0);
    add(new THREE.BoxGeometry(.3, .08, .12), new THREE.MeshStandardMaterial({ color: 0x8d8a84, roughness: .6 }), -.3, .99, 0);
  } else if (tipo === 'cama') {
    add(new THREE.BoxGeometry(1.1, .3, 2.0), mad, 0, .25, 0);
    add(new THREE.BoxGeometry(1.0, .16, 1.9), new THREE.MeshStandardMaterial({ color: 0xb8483a, roughness: .95 }), 0, .46, 0);
    add(new THREE.BoxGeometry(.8, .12, .4), new THREE.MeshStandardMaterial({ color: 0xf0e6d6, roughness: .95 }), 0, .6, -.7);
  } else if (tipo === 'fogueira') {
    const pedra = new THREE.MeshStandardMaterial({ color: 0x77736c, roughness: 1 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; add(organico(new THREE.DodecahedronGeometry(.17, 0), .4, i), pedra, Math.cos(a) * .55, .1, Math.sin(a) * .55); }
    const tora = new THREE.MeshStandardMaterial({ color: 0x4a301c, roughness: 1 });
    for (let i = 0; i < 3; i++) { const t = add(new THREE.CylinderGeometry(.07, .08, .9, 6), tora, 0, .17, 0); t.rotation.z = Math.PI / 2; t.rotation.y = i * 1.05; }
    const f1 = new THREE.Mesh(new THREE.ConeGeometry(.28, .8, 7), new THREE.MeshBasicMaterial({ color: 0xff7a1a })); f1.position.y = .6; g.add(f1);
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(.15, .5, 6), new THREE.MeshBasicMaterial({ color: 0xffd34a })); f2.position.y = .5; g.add(f2);
    g.userData.chamas = [f1, f2];
  }
  return g;
}

/* ---------- fauna (modelos estilizados) ---------- */
function modeloCervo() {
  const g = new THREE.Group(), M = c => new THREE.MeshStandardMaterial({ color: c, roughness: .9 }), pernas = [];
  const add = (geo, c, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, M(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m; };
  add(new THREE.SphereGeometry(.5, 12, 9), 0x8d5a2e, 0, 1.12, 0, .7, .68, 1.45);
  add(new THREE.CylinderGeometry(.11, .17, .8, 7), 0x8d5a2e, 0, 1.55, .7).rotation.x = .55;
  add(new THREE.SphereGeometry(.2, 9, 8), 0x9a6535, 0, 1.95, .98, .85, .9, 1.3);
  add(new THREE.SphereGeometry(.07, 6, 5), 0x2a1a10, 0, 1.9, 1.22);
  add(new THREE.SphereGeometry(.12, 7, 6), 0xf3ece0, 0, 1.3, -.75);
  for (const s of [-1, 1]) { const h = add(new THREE.CylinderGeometry(.015, .025, .5, 5), 0xd9c9a3, s * .1, 2.2, .95); h.rotation.z = -s * .4; const h2 = add(new THREE.CylinderGeometry(.012, .018, .28, 5), 0xd9c9a3, s * .2, 2.35, .95); h2.rotation.z = -s * .9; }
  for (const [x, z] of [[-.2, .6], [.2, .6], [-.2, -.55], [.2, -.55]]) { const p = new THREE.Group(); p.position.set(x, .95, z); const l = new THREE.Mesh(new THREE.CylinderGeometry(.045, .035, .95, 6), M(0x6f4624)); l.position.y = -.47; l.castShadow = true; p.add(l); g.add(p); pernas.push(p); }
  return { g, pernas };
}
function modeloCoelho() {
  const g = new THREE.Group(), M = c => new THREE.MeshStandardMaterial({ color: c, roughness: .95 });
  const add = (geo, c, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, M(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m; };
  add(new THREE.SphereGeometry(.28, 9, 7), 0x9c8467, 0, .3, 0, .8, .8, 1.3);
  add(new THREE.SphereGeometry(.15, 8, 6), 0xa68d6f, 0, .42, .33);
  add(new THREE.SphereGeometry(.07, 6, 5), 0xf4efe6, 0, .3, -.38);
  for (const s of [-1, 1]) { const o = add(new THREE.SphereGeometry(.05, 6, 5), 0xb59c7e, s * .06, .62, .3, 1, 3.4, .8); o.rotation.z = -s * .15; }
  return { g, pernas: [] };
}

function modeloLobo() {
  const g = new THREE.Group(), c = new THREE.Group(), pernas = []; g.add(c);
  const M = (col) => new THREE.MeshStandardMaterial({ color: col, roughness: .95 }), pel = M(0x1b1b24), pel2 = M(0x2b2b38);
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); c.add(m); return m; };
  add(new THREE.SphereGeometry(.5, 10, 8), pel, 0, .85, 0, .8, .75, 1.55);
  add(new THREE.SphereGeometry(.3, 9, 8), pel2, 0, 1.0, .85, .9, .85, 1.1);
  add(new THREE.BoxGeometry(.2, .16, .35), pel2, 0, .92, 1.25);
  for (const s of [-1, 1]) add(new THREE.ConeGeometry(.09, .22, 5), pel, s * .15, 1.3, .78);
  add(new THREE.ConeGeometry(.1, .6, 6), pel, 0, .9, -.95).rotation.x = -1.9;
  const olho = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(.055, 6, 5), olho, s * .12, 1.06, 1.1);
  for (const [x, z] of [[-.18, .55], [.18, .55], [-.18, -.5], [.18, -.5]]) { const p = new THREE.Group(); p.position.set(x, .7, z); const l = new THREE.Mesh(new THREE.CylinderGeometry(.06, .045, .7, 6), pel); l.position.y = -.35; p.add(l); c.add(p); pernas.push(p); }
  g.scale.setScalar(1.15); return { g, c, pernas };
}
function modeloGolem() {
  const g = new THREE.Group(), c = new THREE.Group(), pernas = [], bracos = []; g.add(c);
  const pedra = new THREE.MeshStandardMaterial({ color: 0x6b665e, roughness: 1, flatShading: true }), pedra2 = new THREE.MeshStandardMaterial({ color: 0x57534c, roughness: 1, flatShading: true }), musgo = new THREE.MeshStandardMaterial({ color: 0x3f6b30, roughness: 1 });
  const add = (geo, mat, x, y, z, par = c) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); par.add(m); return m; };
  add(organico(new THREE.DodecahedronGeometry(.75, 0), .25, 21).scale(1, 1.15, .8), pedra, 0, 1.85, 0);
  add(organico(new THREE.DodecahedronGeometry(.36, 0), .25, 22), pedra2, 0, 2.85, .08);
  add(new THREE.SphereGeometry(.3, 6, 5), musgo, -.3, 2.5, .3).scale.set(1, .35, 1);
  const olho = new THREE.MeshBasicMaterial({ color: 0x44ffee });
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(.07, 6, 5), olho, s * .15, 2.88, .4);
  for (const s of [-1, 1]) { const p = new THREE.Group(); p.position.set(s * .95, 2.4, 0); add(new THREE.BoxGeometry(.38, 1.2, .38), pedra2, 0, -.55, 0, p); add(organico(new THREE.DodecahedronGeometry(.32, 0), .3, 30 + s), pedra, 0, -1.2, 0, p); c.add(p); bracos.push(p); }
  for (const s of [-1, 1]) { const p = new THREE.Group(); p.position.set(s * .38, 1.2, 0); add(new THREE.BoxGeometry(.42, 1.2, .42), pedra2, 0, -.6, 0, p); c.add(p); pernas.push(p); }
  g.scale.setScalar(1.1); return { g, c, pernas, bracos };
}

function criarAvatar(nick) {
  const g = new THREE.Group(), mats = {}, M = (k, c) => (mats[k] = new THREE.MeshStandardMaterial({ color: c, roughness: .8 }));
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  add(new THREE.CylinderGeometry(.3, .3, .9, 8), M('corpo', 0x4a7a9a), 0, 1.0, 0);
  add(new THREE.SphereGeometry(.22, 10, 8), M('pele', 0xd9a779), 0, 1.68, 0);
  const calca = M('calca', 0x3a4a5a); add(new THREE.BoxGeometry(.18, .6, .2), calca, -.12, .3, 0); add(new THREE.BoxGeometry(.18, .6, .2), calca, .12, .3, 0);
  const chapeu = add(new THREE.CylinderGeometry(.24, .26, .16, 8), M('chapeu', 0x000000), 0, 1.9, 0); chapeu.visible = false;
  const arm = new THREE.Group(); arm.position.set(-.38, 1.35, 0); const braco = new THREE.Mesh(new THREE.BoxGeometry(.14, .55, .14), mats.pele); braco.position.y = -.25; arm.add(braco);
  const mao = new THREE.Group(); mao.position.set(0, -.5, -.12); mao.rotation.x = -.9; arm.add(mao); g.add(arm);
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.font = 'bold 34px system-ui'; x.textAlign = 'center'; x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 8, 256, 48); x.fillStyle = '#fff'; x.fillText(String(nick).slice(0, 14), 128, 44);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, fog: false })); sp.scale.set(1.8, .45, 1); sp.position.y = 2.3; sp.renderOrder = 5; g.add(sp);
  const hpBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x000000, transparent: true, opacity: .55, depthTest: false, fog: false })), hpFg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x44dd66, depthTest: false, fog: false }));
  hpBg.scale.set(1.2, .09, 1); hpFg.scale.set(1.2, .09, 1); hpBg.position.y = hpFg.position.y = 2.02; hpBg.renderOrder = 5; hpFg.renderOrder = 6; hpBg.visible = hpFg.visible = false; g.add(hpBg, hpFg);
  return { g, arm, mao, mats, chapeu, hpBg, hpFg, alvo: new THREE.Vector3(), ryAlvo: 0, f: null, atk: false, init: false, cos: null };
}
function aplicaSkin(a, skin) {   // skin = meta do catálogo {corpo, calca, pele, chapeu}
  const s = skin || {};
  a.mats.corpo.color.set(s.corpo || '#4a7a9a'); a.mats.calca.color.set(s.calca || '#3a4a5a'); a.mats.pele.color.set(s.pele || '#d9a779');
  if (s.chapeu) { a.chapeu.visible = true; a.mats.chapeu.color.set(s.chapeu); } else a.chapeu.visible = false;
}

/* =====================================================================
   ÁUDIO PROCEDURAL (Web Audio API — sem arquivos externos)
   ===================================================================== */
class Som {
  constructor() { this.ctx = null; this.vol = .64; this.mus = .3; this.ventoG = null; }
  ativar() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        this.ctx = new AC(); const c = this.ctx, b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.buf = b; this.#vento();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { /* áudio indisponível */ }
  }
  setVol(geral, musica, efeitos) { this.vol = geral * efeitos; this.mus = geral * musica; if (this.ventoG) this.ventoG.gain.value = this.mus * .07; }
  #vento() {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.buf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = .6;
    const g = c.createGain(); g.gain.value = this.mus * .07;
    const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = .12; lg.gain.value = 180; l.connect(lg); lg.connect(f.frequency); l.start();
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(); this.ventoG = g;
  }
  #rajada(freq, q, dur, gain, tipo = 'bandpass') {
    if (!this.ctx || this.vol <= 0) return; const c = this.ctx, t = c.currentTime, s = c.createBufferSource();
    s.buffer = this.buf; s.playbackRate.value = .8 + Math.random() * .4;
    const f = c.createBiquadFilter(); f.type = tipo; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(gain * this.vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t, Math.random()); s.stop(t + dur + .05);
  }
  #tom(f0, f1, dur, gain, tipo = 'sine') {
    if (!this.ctx || this.vol <= 0) return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(gain * this.vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + .05);
  }
  golpe(cat) {
    if (cat === 'planta') { this.#rajada(1800, .7, .09, .5, 'highpass'); return; }
    if (cat === 'madeira') { this.#rajada(320, 1.1, .13, .9); this.#tom(150, 60, .12, .5, 'triangle'); }
    else if (cat === 'pedra') { this.#rajada(2400, 1.5, .08, .7, 'highpass'); this.#tom(780, 420, .07, .22, 'square'); }
    else { this.#rajada(3200, 2, .08, .5, 'highpass'); this.#tom(1400, 1300, .35, .22); this.#tom(2100, 2000, .28, .14); }
  }
  quebrar(cat) {
    if (cat === 'planta') { this.#rajada(1500, .6, .25, .6, 'highpass'); return; }
    if (cat === 'madeira') { this.#rajada(260, .8, .35, 1); this.#tom(110, 40, .3, .6, 'triangle'); }
    else if (cat === 'pedra') { this.#rajada(1500, .9, .3, 1); this.#tom(220, 70, .25, .5, 'triangle'); }
    else { this.#rajada(2600, 1, .3, .8); this.#tom(1800, 900, .5, .25); this.#tom(2700, 1400, .45, .18); }
  }
  coletar() { this.#tom(620, 980, .12, .25); setTimeout(() => this.#tom(930, 1400, .1, .2), 70); }
  construir() { this.#tom(95, 45, .22, .7, 'sine'); this.#rajada(240, .8, .16, .7); }
  erro() { this.#tom(180, 120, .15, .25, 'sawtooth'); }
  passo(sup) {
    if (sup === 'grama') this.#rajada(700, .7, .09, .35, 'lowpass');
    else if (sup === 'areia') this.#rajada(1400, .5, .12, .3, 'bandpass');
    else if (sup === 'pedra') { this.#rajada(1900, 1.4, .06, .38, 'highpass'); this.#tom(260, 140, .05, .12, 'square'); }
    else if (sup === 'madeira') { this.#tom(190, 110, .07, .3, 'triangle'); this.#rajada(500, 1, .05, .2); }
    else this.#rajada(900, .4, .18, .3, 'lowpass');
  }
  comer() { for (let i = 0; i < 3; i++) setTimeout(() => this.#rajada(1200 + i * 200, 1.2, .07, .5, 'bandpass'), i * 110); }
  beber() { for (let i = 0; i < 3; i++) setTimeout(() => this.#tom(260 + i * 40, 160 + i * 20, .12, .3, 'sine'), i * 130); }
  espada() { this.#rajada(2200, .8, .16, .5, 'bandpass'); this.#tom(900, 300, .12, .12, 'sawtooth'); }
  golpeInimigo() { this.#tom(140, 60, .12, .45, 'triangle'); this.#rajada(900, 1, .08, .5); }
  dano() { this.#tom(220, 70, .22, .6, 'sawtooth'); this.#rajada(400, .7, .15, .5, 'lowpass'); }
  morrer() { this.#tom(300, 40, .9, .6, 'sawtooth'); }
}

/* =====================================================================
   PARTÍCULAS
   ===================================================================== */
class Particulas {
  constructor(scene, max = 500, size = .13, opac = 1) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3).fill(-9999); this.col = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.vida = new Float32Array(max); this.gr = new Float32Array(max).fill(1);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.pts = new THREE.Points(g, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity: opac, depthWrite: false, sizeAttenuation: true }));
    this.pts.frustumCulled = false; scene.add(this.pts); this.c = new THREE.Color();
  }
  emit(p, hex, n = 8, sp = 3, up = 2, vida = 1, grav = 1) {
    this.c.setHex(hex);
    for (let k = 0; k < n; k++) {
      const i = this.n++ % this.max, j = i * 3;
      this.pos[j] = p.x; this.pos[j + 1] = p.y; this.pos[j + 2] = p.z;
      this.vel[j] = (Math.random() - .5) * sp; this.vel[j + 1] = Math.random() * sp * .6 + up; this.vel[j + 2] = (Math.random() - .5) * sp;
      const v = .75 + Math.random() * .25; this.col[j] = this.c.r * v; this.col[j + 1] = this.c.g * v; this.col[j + 2] = this.c.b * v;
      this.vida[i] = (.5 + Math.random() * .6) * vida; this.gr[i] = grav;
    }
  }
  update(dt) {
    let ativo = false;
    for (let i = 0; i < this.max; i++) {
      if (this.vida[i] <= 0) continue; ativo = true; const j = i * 3;
      this.vida[i] -= dt; this.vel[j + 1] -= 9 * this.gr[i] * dt;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      if (this.vida[i] <= 0) this.pos[j + 1] = -9999;
    }
    if (ativo || this._sujo) { this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true; this._sujo = ativo; }
  }
}

// vaga-lumes (noite) e folhas/poeira (floresta, de dia) ao redor do jogador
class Ambiente {
  constructor(scene) {
    this.NV = 70; this.NF = 55;
    this.vp = new Float32Array(this.NV * 3).fill(-9999); this.vh = new Float32Array(this.NV); this.vf = Float32Array.from({ length: this.NV }, () => Math.random() * 6.283);
    this.fp = new Float32Array(this.NF * 3).fill(-9999); this.fh = new Float32Array(this.NF); this.ff = Float32Array.from({ length: this.NF }, () => Math.random() * 6.283); this.fc = new Float32Array(this.NF * 3);
    const gv = new THREE.BufferGeometry(); gv.setAttribute('position', new THREE.BufferAttribute(this.vp, 3));
    this.vaga = new THREE.Points(gv, new THREE.PointsMaterial({ color: 0xd6ff6a, size: .24, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const gf = new THREE.BufferGeometry(); gf.setAttribute('position', new THREE.BufferAttribute(this.fp, 3)); gf.setAttribute('color', new THREE.BufferAttribute(this.fc, 3));
    this.folhas = new THREE.Points(gf, new THREE.PointsMaterial({ size: .17, vertexColors: true, transparent: true, opacity: 0, depthWrite: false }));
    this.vaga.frustumCulled = this.folhas.frustumCulled = false; this.vaga.visible = this.folhas.visible = false; scene.add(this.vaga, this.folhas);
  }
  #nasce(pos, raio, seed) { const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * raio, x = pos.x + Math.cos(a) * d, z = pos.z + Math.sin(a) * d; return [x, z, Math.max(heightAt(x, z, seed), AGUA)]; }
  update(dt, t, pos, seed, noite, dia) {
    const h0 = heightAt(pos.x, pos.z, seed), flor = h0 > 1.5 && h0 < 12.5;
    const kv = clamp(noite * 1.25, 0, 1) * (flor ? 1 : .35), kf = clamp(dia * 1.1, 0, 1) * (flor ? 1 : 0);
    this.vaga.visible = kv > .03; this.folhas.visible = kf > .03;
    if (this.vaga.visible) {
      this.vaga.material.opacity = kv * (.7 + .3 * Math.sin(t * 3.1));
      for (let i = 0; i < this.NV; i++) {
        const j = i * 3, dx = this.vp[j] - pos.x, dz = this.vp[j + 2] - pos.z;
        if (this.vp[j + 1] < -9000 || dx * dx + dz * dz > 28 * 28) { const [x, z, h] = this.#nasce(pos, 24, seed); this.vp[j] = x; this.vp[j + 2] = z; this.vh[i] = h; }
        this.vp[j] += Math.sin(t * .7 + this.vf[i]) * .7 * dt; this.vp[j + 2] += Math.cos(t * .6 + this.vf[i] * 1.3) * .7 * dt;
        this.vp[j + 1] = this.vh[i] + .8 + 1.1 * (1 + Math.sin(t * .9 + this.vf[i] * 2));
      }
      this.vaga.geometry.attributes.position.needsUpdate = true;
    }
    if (this.folhas.visible) {
      this.folhas.material.opacity = kf * .85;
      for (let i = 0; i < this.NF; i++) {
        const j = i * 3, dx = this.fp[j] - pos.x, dz = this.fp[j + 2] - pos.z;
        if (this.fp[j + 1] < -9000 || dx * dx + dz * dz > 26 * 26 || this.fp[j + 1] < this.fh[i]) {
          const [x, z, h] = this.#nasce(pos, 22, seed); this.fp[j] = x; this.fp[j + 2] = z; this.fh[i] = h; this.fp[j + 1] = h + 2 + Math.random() * 7;
          const col = new THREE.Color([0x4b8a33, 0x8aa03a, 0xc8a038, 0x9a6a3a, 0xe4e0cc][Math.floor(Math.random() * 5)]); this.fc[j] = col.r; this.fc[j + 1] = col.g; this.fc[j + 2] = col.b;
          this.folhas.geometry.attributes.color.needsUpdate = true;
        }
        this.fp[j + 1] -= .65 * dt; this.fp[j] += Math.sin(t * 1.1 + this.ff[i]) * .55 * dt; this.fp[j + 2] += Math.cos(t * .9 + this.ff[i]) * .35 * dt;
      }
      this.folhas.geometry.attributes.position.needsUpdate = true;
    }
  }
}

/* =====================================================================
   GEOMETRIA DE RAIO x SEGMENTO (coleta por raycast do centro da câmera)
   ===================================================================== */
function rayVsSeg(ox, oy, oz, dx, dy, dz, ax, ay, az, vx, vy, vz, rad, max) {
  const wx = ox - ax, wy = oy - ay, wz = oz - az;
  const B = dx * vx + dy * vy + dz * vz, C = vx * vx + vy * vy + vz * vz, D = dx * wx + dy * wy + dz * wz, E = vx * wx + vy * wy + vz * wz;
  let s = 0, t;
  if (C > 1e-6) { const den = C - B * B; s = den > 1e-6 ? (E - B * D) / den : 0; s = s < 0 ? 0 : s > 1 ? 1 : s; }
  t = s * B - D; if (t < 0) t = 0; else if (t > max) t = max;
  if (C > 1e-6) { s = (E + t * B) / C; s = s < 0 ? 0 : s > 1 ? 1 : s; }
  const px = ox + dx * t - (ax + vx * s), py = oy + dy * t - (ay + vy * s), pz = oz + dz * t - (az + vz * s);
  return px * px + py * py + pz * pz <= rad * rad ? t : -1;
}
const CORES_HIT = { arvore: 0x8a5a33, rocha: 0x9a968e, ferro: 0xb5532a, cristal: 0x7ae8ff, fruta: 0xb02030 };

/* =====================================================================
   WORLD
   ===================================================================== */
export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(70, 1, .1, 400); this.scene.add(this.cam);
    this.mode = 'menu'; this.seed = 20261119; this.offline = true; this.offsetCeu = 0;
    this.pos = new THREE.Vector3(0, 10, 0); this.yaw = 0; this.pitch = 0; this.vy = 0; this.noChao = true;
    this.input = { x: 0, z: 0, pulo: false, acao: false };
    this.cfg = { sensibilidade: 1, invertY: false };
    this.remotos = new Map(); this.estruturas = new Map(); this.destruidos = new Map();
    this.recursos = []; this.recMap = new Map(); this.grid = new Map(); this.meshesRec = []; this.fauna = [];
    this.t = 0; this.parado = false; this.clock = new THREE.Clock();
    this.equipado = 'mao'; this.estoque = 0; this.giro = 0; this.progresso = 0; this.alvo = null; this.estAlvo = null;
    this.swing = 0; this.golpeT = 0; this.atacando = false; this.nearFogueira = false;
    this.vivo = true; this.vida = 100; this.movendo = false; this._passo = 0; this._atkAte = 0; this._fumo = 0; this.cdAtq = 0; this.cdUso = 0; this.dia = 1; this._nome = ''; this._prog = 0;
    this.cos = {}; this.hostisMap = new Map(); this.hostisLocal = new Hostis(); this.gHostis = new THREE.Group(); this.scene.add(this.gHostis);
    this.onConsumir = this.onCozinhar = this.onEncher = this.onBeberAgua = this.onDrop = this.onDano = this.onAtacarHostil = null;
    this.ghostOk = false; this.ghostPos = null; this.ghostTipo = null; this.ghostM = null;
    this._d = new THREE.Vector3(); this._hud = ''; this._ultEnvio = 0; this._resp = 0; this._tAlvo = 0; this._ultB = 0; this._embers = 0; this._dica = '';
    this.onMove = this.onQuebrou = this.onConstruir = this.onDemolir = this.onHud = null;
    this.som = new Som(); this.ray = new THREE.Raycaster();
    this.ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
    this.cor = { a: new THREE.Color(), b: new THREE.Color(), c: new THREE.Color() };
    this.qAtual = 'media'; this.Q = QUALIDADE.media;
    this.gEst = new THREE.Group(); this.scene.add(this.gEst);
    this.gGhost = new THREE.Group(); this.scene.add(this.gGhost);
    this.ghostMatOk = new THREE.MeshBasicMaterial({ color: 0x44ff77, transparent: true, opacity: .45, depthWrite: false });
    this.ghostMatBad = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: .45, depthWrite: false });
    this.#ceu(); this.#luzes(); this.#agua(); this.#mao(); this.#luzesFogo();
    this.part = new Particulas(this.scene); this.fumaca = new Particulas(this.scene, 160, .55, .3); this.amb = new Ambiente(this.scene);
    this.setQualidade('media');
    addEventListener('resize', () => this.resize()); this.resize(); this.#eventos();
    this.r.setAnimationLoop(() => this.#loop());
  }
  resize() { const w = innerWidth, h = innerHeight; this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
  get trabalhando() { return performance.now() < this._atkAte; }
  get fase() { return (((Date.now() / 1000 + this.offsetCeu) % CICLO) + CICLO) % CICLO / CICLO; }

  /* ---------- céu, luzes, água ---------- */
  #ceu() {
    this.ceuG = new THREE.Group(); this.scene.add(this.ceuG);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x2a6fc4) }, hor: { value: new THREE.Color(0xbcd8ee) }, low: { value: new THREE.Color(0x6a8a6a) }, nuvem: { value: new THREE.Color(0xffffff) }, tempo: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform vec3 top,hor,low,nuvem; uniform float tempo; varying vec3 vP;
        float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y); }
        float fb(vec2 p){ float a=.5,t=0.; for(int i=0;i<3;i++){ t+=vn(p)*a; p*=2.03; a*=.5; } return t; }
        void main(){
          float h=vP.y; vec3 c = h>0. ? mix(hor,top,pow(clamp(h,0.,1.),.55)) : mix(hor,low,clamp(-h*3.,0.,1.));
          if(h>.02){ vec2 uv=vP.xz/(h+.28)*1.6+vec2(tempo*.012,tempo*.006); float n=fb(uv); float cl=smoothstep(.5,.74,n)*smoothstep(.02,.22,h); c=mix(c,nuvem,cl*.85); }
          gl_FragColor=vec4(c,1.);
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), this.skyMat); this.dome.renderOrder = -10; this.dome.frustumCulled = false; this.ceuG.add(this.dome);
    const N = 900, a = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { let x, y, z, l; do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1; l = Math.hypot(x, y, z); } while (l > 1 || l < .2 || y < -.1 * l); a.set([x / l, y / l, z / l], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(a, 3));
    this.estrelas = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x000000, size: 1.7, sizeAttenuation: false, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false }));
    this.estrelas.renderOrder = -9; this.estrelas.frustumCulled = false; this.ceuG.add(this.estrelas);
    this.solM = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false, depthTest: false, depthWrite: false }));
    this.luaM = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false, depthTest: false, depthWrite: false }));
    this.solM.renderOrder = this.luaM.renderOrder = -8; this.solM.frustumCulled = this.luaM.frustumCulled = false; this.ceuG.add(this.solM, this.luaM);
    this.scene.fog = new THREE.FogExp2(0xbcd8ee, .0078);
  }
  #luzes() {
    this.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x3a3f2a, .7); this.scene.add(this.hemi);
    this.sol = new THREE.DirectionalLight(0xfff1d6, 1.1);
    const sc = this.sol.shadow.camera; sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 1; sc.far = 400; this.sol.shadow.bias = -.0004; this.sol.shadow.normalBias = .04;
    this.scene.add(this.sol, this.sol.target);
    this.lua = new THREE.DirectionalLight(0x8fa8ff, 0); this.scene.add(this.lua, this.lua.target);
  }
  #agua() {
    this.texOnda = texRuido(128, 128, 255, 70);
    this.aguaM = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500).rotateX(-Math.PI / 2),
      new THREE.MeshPhongMaterial({ color: 0x2f86b8, specular: 0xffffff, shininess: 150, transparent: true, opacity: .8, bumpMap: this.texOnda, bumpScale: .7 }));
    this.aguaM.position.y = AGUA; this.scene.add(this.aguaM);
  }
  #luzesFogo() { this.luzesF = []; for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xff8a3d, 0, 16, 2); this.scene.add(l); this.luzesF.push(l); } }
  #mao() {
    this.maoG = new THREE.Group(); this.maoG.position.set(.38, -.34, -.62); this.maoG.rotation.set(-.35, .25, 0); this.cam.add(this.maoG); this.maoId = null;
  }
  #trocaMao(id) {
    if (this.maoId === id) return; this.maoId = id;
    while (this.maoG.children.length) this.maoG.remove(this.maoG.children[0]);
    this.maoG.add(modeloItem(id, this.cos?.ferramenta));
  }
  #escalaCeu() {
    const f = this.Q.far;
    this.dome.scale.setScalar(f * .96); this.estrelas.scale.setScalar(f * .9);
    this.solM.scale.setScalar(f * .04); this.luaM.scale.setScalar(f * .028);
    this.cam.far = f + 40; this.cam.updateProjectionMatrix();
  }
  #atualizaCeu() {
    const fase = this.fase, a = fase * Math.PI * 2 - Math.PI / 2, e = Math.sin(a);
    const d = smooth(-.12, .22, e), tw = Math.max(0, 1 - Math.abs(e) / .28);
    const { a: A, b: B, c: C } = this.cor, U = this.skyMat.uniforms;
    this.dia = d; U.tempo.value = this.t; U.nuvem.value.setHex(0x161a2a).lerp(A.setHex(0xffffff), d).lerp(B.setHex(0xffb080), tw * .5);
    U.top.value.setHex(0x050a1a).lerp(A.setHex(0x2a6fc4), d);
    U.hor.value.setHex(0x0b1226).lerp(A.setHex(0xbcd8ee), d).lerp(B.setHex(0xff9a5a), tw * .6);
    U.low.value.copy(U.hor.value).multiplyScalar(.55);
    const fog = this.scene.fog;
    const sub = this.cam.position.y < AGUA + .05 && this.mode === 'play';
    if (sub) { fog.color.setHex(0x15506e); fog.density = .06; } else { fog.color.copy(U.hor.value); fog.density = this.Q.fog * (1 + (1 - d) * .45); }
    const S = this._d.set(Math.cos(a) * .9, e, .35).normalize();
    const foco = this.mode === 'play' ? this.pos : (this._f0 ??= new THREE.Vector3());
    this.sol.position.set(foco.x + S.x * 120, foco.y + S.y * 120, foco.z + S.z * 120); this.sol.target.position.copy(foco);
    this.sol.intensity = clamp(e * 2.2, 0, 1.2); this.sol.color.setHex(0xffb870).lerp(A.setHex(0xfff4e0), clamp(e * 3, 0, 1));
    this.lua.position.set(foco.x - S.x * 120, foco.y - S.y * 120, foco.z - S.z * 120); this.lua.target.position.copy(foco); this.lua.intensity = e < 0 ? clamp(-e * 1.5, 0, .3) : 0;
    this.hemi.intensity = .14 + .62 * d; this.hemi.color.setHex(0x1a2540).lerp(A.setHex(0xbfdcff), d);
    this.ceuG.position.copy(this.cam.position);
    const f = this.Q.far;
    this.solM.position.set(S.x * f * .8, S.y * f * .8, S.z * f * .8); this.luaM.position.set(-S.x * f * .8, -S.y * f * .8, -S.z * f * .8);
    this.solM.visible = e > -.12; this.luaM.visible = e < .12;
    this.estrelas.material.color.setScalar(clamp(1 - d * 1.2, 0, 1)); this.estrelas.visible = d < .85;
    this.aguaM.material.color.setHex(0x1a5878).lerp(A.setHex(0x2f86b8), d);
  }

  /* ---------- qualidade / construção do mundo ---------- */
  setQualidade(q) {
    this.qAtual = QUALIDADE[q] ? q : 'media'; this.Q = QUALIDADE[this.qAtual];
    this.r.setPixelRatio(Math.min(devicePixelRatio, this.Q.pr));
    this.r.shadowMap.enabled = this.Q.sombra; this.r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.sol.castShadow = this.Q.sombra; const ms = this.qAtual === 'alta' ? 2048 : 1024;
    if (this.sol.shadow.mapSize.x !== ms) { this.sol.shadow.mapSize.set(ms, ms); this.sol.shadow.map?.dispose(); this.sol.shadow.map = null; }
    this.#escalaCeu(); this.#reconstruir();
  }
  #reconstruir() {
    for (const g of [this.gTerreno, this.gRecursos, this.gDecor, this.gFauna]) if (g) { this.scene.remove(g); g.traverse(o => { o.geometry?.dispose(); }); }
    this.gTerreno = new THREE.Group(); this.gRecursos = new THREE.Group(); this.gDecor = new THREE.Group(); this.gFauna = new THREE.Group();
    this.scene.add(this.gTerreno, this.gRecursos, this.gDecor, this.gFauna);
    this.#terreno(); this.#recursos(); this.#decor(); this.#criaFauna();
    for (const [id, ts] of this.destruidos) { const r = this.recMap.get(id); if (r && ts > Date.now()) { r.vivo = false; r.mesh.setMatrixAt(r.idx, this.ZERO); } }
    for (const m of this.meshesRec) m.instanceMatrix.needsUpdate = true;
  }
  #terreno() {
    const Q = this.Q, N = 520, g = new THREE.PlaneGeometry(N, N, Q.seg, Q.seg); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, s = this.seed | 0;
    for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i), this.seed));
    g.computeVertexNormals();
    const nr = g.attributes.normal, col = new Float32Array(p.count * 3);
    const areia = new THREE.Color(.82, .75, .55), umida = new THREE.Color(.55, .48, .34), grama = new THREE.Color(.22, .46, .15), mata = new THREE.Color(.12, .30, .11), seca = new THREE.Color(.42, .45, .2), rocha = new THREE.Color(.47, .44, .4), rocha2 = new THREE.Color(.36, .33, .3), neve = new THREE.Color(.93, .95, .98), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = p.getY(i), ny = nr.getY(i), r = fbm(x * .08, z * .08, s + 7, 2), f = fbm(x * .02, z * .02, s + 3, 2);
      c.copy(grama).lerp(seca, smooth(.55, .8, fbm(x * .05, z * .05, s + 9, 2))).lerp(mata, smooth(.35, .6, f)).multiplyScalar(.85 + r * .3);
      c.lerp(umida, smooth(.9, -.2, h)).lerp(areia, smooth(1.7, .7, h) * (1 - smooth(.9, 1.1, ny) * 0));
      const wr = Math.max(smooth(11, 16, h + r * 3), smooth(.84, .62, ny));
      c.lerp(rocha2.clone().lerp(rocha, r), wr);
      c.lerp(neve, smooth(30, 35, h + r * 2) * smooth(.5, .8, ny));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.texChao ??= texRuido(128, 190, 110, 130);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, map: this.texChao, roughness: .96, metalness: 0 }));
    m.receiveShadow = true; this.gTerreno.add(m);
  }
  #recursos() {
    const lista = gerarRecursos(this.seed), Q = this.Q;
    this.recursos = []; this.recMap = new Map(); this.grid = new Map(); this.meshesRec = [];
    const matVc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 });
    const matCr = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .35, emissive: 0x0c3a47, emissiveIntensity: 1 });
    const defs = { pino: [geoPino, matVc], carvalho: [geoCarvalho, matVc], rocha: [geoRocha, matVc], ferro: [geoFerro, matVc], cristal: [geoCristal, matCr], fruta: [geoFruta, matVc] };
    const cont = {}; const chave = r => (r.tipo === 'arvore' ? r.v : r.tipo);
    for (const r of lista) cont[chave(r)] = (cont[chave(r)] || 0) + 1;
    const meshes = {};
    for (const k of Object.keys(cont)) {
      const m = new THREE.InstancedMesh(defs[k][0](), defs[k][1], cont[k]); m.frustumCulled = false; m.castShadow = Q.sombra; m.receiveShadow = true; m.n = 0;
      meshes[k] = m; this.meshesRec.push(m); this.gRecursos.add(m);
    }
    const d = new THREE.Object3D();
    for (const r of lista) {
      const m = meshes[chave(r)], e = r.e; d.position.set(r.x, r.y - .06, r.z); d.rotation.set(0, r.r, 0); d.scale.set(e, e, e); d.updateMatrix();
      const idx = m.n++; m.setMatrixAt(idx, d.matrix);
      const rec = { id: r.id, tipo: r.tipo, x: r.x, y: r.y, z: r.z, mesh: m, idx, mat: d.matrix.clone(), vivo: true };
      if (r.tipo === 'arvore') { rec.ay = r.y + .2; rec.vy = 4 * e; rec.rad = .75 * e; rec.col = .45 * e; }
      else if (r.tipo === 'fruta') { rec.ay = r.y + .4 * e; rec.vy = 0; rec.rad = .95 * e; rec.col = .35 * e; }
      else { rec.ay = r.y + .55 * e; rec.vy = 0; rec.rad = 1.05 * e; rec.col = .8 * e; }
      this.recursos.push(rec); this.recMap.set(rec.id, rec);
      const k = (Math.floor(r.x / 16) + 100) * 1000 + Math.floor(r.z / 16) + 100; let a = this.grid.get(k); if (!a) { a = []; this.grid.set(k, a); } a.push(rec);
    }
  }
  #vizinhos(x, z) {
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16), out = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = this.grid.get((cx + i + 100) * 1000 + cz + j + 100); if (a) for (const r of a) out.push(r); }
    return out;
  }
  #decor() {
    const rnd = mulberry32((this.seed + 1) | 0), n = this.Q.dec, d = new THREE.Object3D();
    const arb = new THREE.InstancedMesh(geoArbusto(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), n); arb.frustumCulled = false; arb.receiveShadow = true;
    let k = 0;
    for (let i = 0; i < n * 10 && k < n; i++) {
      const x = (rnd() - .5) * 440, z = (rnd() - .5) * 440, h = heightAt(x, z, this.seed);
      if (h < 1.3 || h > 13 || fbm(x * .04, z * .04, (this.seed + 55) | 0, 2) < .42) continue;
      const e = .6 + rnd() * 1.0; d.position.set(x, h - .05, z); d.rotation.set(0, rnd() * 6.28, 0); d.scale.set(e, e * (.8 + rnd() * .5), e); d.updateMatrix(); arb.setMatrixAt(k++, d.matrix);
    }
    arb.count = k; this.gDecor.add(arb);
    const nr = 160, peb = new THREE.InstancedMesh(geoRocha(0x8a857b), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), nr); peb.frustumCulled = false; k = 0;
    for (let i = 0; i < nr * 8 && k < nr; i++) {
      const x = (rnd() - .5) * 440, z = (rnd() - .5) * 440, h = heightAt(x, z, this.seed); if (h < .6) continue;
      const e = .12 + rnd() * .25; d.position.set(x, h - .02, z); d.rotation.set(rnd() * 3, rnd() * 6, 0); d.scale.set(e * 1.4, e, e * 1.1); d.updateMatrix(); peb.setMatrixAt(k++, d.matrix);
    }
    peb.count = k; this.gDecor.add(peb);
  }
  #criaFauna() {
    this.fauna = []; const rnd = mulberry32((this.seed + 77) | 0);
    for (let i = 0; i < 38; i++) {
      const cervo = i < 14; let x = 0, z = 0, h = 0, ok = false;
      for (let t = 0; t < 60 && !ok; t++) { x = (rnd() - .5) * 400; z = (rnd() - .5) * 400; h = heightAt(x, z, this.seed); ok = h > 1.6 && h < 10 && x * x + z * z > 200; }
      if (!ok) continue;
      const m = cervo ? modeloCervo() : modeloCoelho(); m.g.position.set(x, h, z); this.gFauna.add(m.g);
      this.fauna.push({ tipo: cervo ? 'cervo' : 'coelho', g: m.g, pernas: m.pernas, x, y: h, z, yaw: rnd() * 6.28, estado: 'idle', timer: rnd() * 4, dx: 0, dz: 1, fase: 0, hp: cervo ? 24 : 8, morto: false });
    }
  }

  /* ---------- entrada ---------- */
  #eventos() {
    const k = {};
    const tec = () => { this.input.z = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0); this.input.x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0); };
    addEventListener('keydown', e => {
      if (e.target.closest?.('input,select,textarea')) return;
      k[e.code] = true; if (e.code === 'Space') { this.input.pulo = true; if (this.mode === 'play') e.preventDefault(); }
      if (this.mode === 'play' && !this.parado) { if (e.code === 'KeyR') this.girarGhost(); if (e.code === 'KeyF') this.demolirAlvo(); }
      tec();
    });
    addEventListener('keyup', e => { k[e.code] = false; if (e.code === 'Space') this.input.pulo = false; tec(); });
    addEventListener('blur', () => { for (const c in k) k[c] = false; tec(); this.input.pulo = false; this.input.acao = false; });
    document.addEventListener('mousemove', e => { if (this.mode === 'play' && !this.parado && document.pointerLockElement === this.canvas) this.olhar(e.movementX, e.movementY, .0022); });
    document.addEventListener('mousedown', e => { if (e.button === 0 && this.mode === 'play' && !this.parado && document.pointerLockElement === this.canvas) this.pressAcao(true); });
    document.addEventListener('mouseup', e => { if (e.button === 0) this.pressAcao(false); });
    this.canvas.addEventListener('click', () => { if (this.mode === 'play' && !detectaMobile() && !this.parado) this.canvas.requestPointerLock?.(); });
    let tid = null, lx = 0, ly = 0;
    this.canvas.addEventListener('touchstart', e => { for (const t of e.changedTouches) if (tid === null && t.clientX > innerWidth * .4) { tid = t.identifier; lx = t.clientX; ly = t.clientY; } }, { passive: true });
    this.canvas.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === tid) { if (!this.parado) this.olhar(t.clientX - lx, t.clientY - ly, .0045); lx = t.clientX; ly = t.clientY; } }, { passive: true });
    const fim = e => { for (const t of e.changedTouches) if (t.identifier === tid) tid = null; };
    this.canvas.addEventListener('touchend', fim); this.canvas.addEventListener('touchcancel', fim);
  }
  olhar(dx, dy, f) {
    const s = this.cfg.sensibilidade; this.yaw -= dx * f * s; this.pitch -= dy * f * s * (this.cfg.invertY ? -1 : 1); this.pitch = clamp(this.pitch, -1.45, 1.45);
  }
  setAnalogico(x, z) { this.input.x = x; this.input.z = z; }
  pressAcao(v) {
    if (v && !this.input.acao && this.mode === 'play' && !this.parado && PECAS.includes(this.equipado)) this.#tentarConstruir();
    this.input.acao = v;
  }
  girarGhost() { this.giro = (this.giro + 1) % 4; }
  demolirAlvo() { if (this.estAlvo && !PECAS.includes(this.equipado)) this.onDemolir?.(this.estAlvo); }
  setEquipado(id, estoque = 0) { this.equipado = id || 'mao'; this.estoque = estoque; this.#trocaMao(this.equipado); }
  setEstoque(n) { this.estoque = n; }
  setCosmeticos(cos) { this.cos = cos || {}; this.maoId = null; this.#trocaMao(this.equipado); }
  teleportar(x, z, yaw = 0) { this.pos.set(x, this.groundAt(x, z, 1e9) + 1.75, z); this.yaw = yaw; this.pitch = 0; this.vy = 0; this.noChao = true; }

  /* ---------- modos ---------- */
  setMenu() { this.mode = 'menu'; this.input.acao = false; document.exitPointerLock?.(); this.maoG.visible = false; this.gGhost.visible = false; this.limparHostis(); }
  setPlay(seed, { offline = true, agora = null, pos = null } = {}) {
    if (seed !== this.seed) { this.seed = seed; this.destruidos.clear(); this.#reconstruir(); }
    this.offline = offline;
    this.offsetCeu = agora ? (agora - Date.now()) / 1000 : CICLO * .3 - ((Date.now() / 1000) % CICLO);
    this.mode = 'play'; this.parado = false; this.maoG.visible = true; this.gGhost.visible = true; this.vivo = true; this.hostisLocal.limpar(); this.limparHostis();
    const x = pos?.x ?? 0, z = pos?.z ?? 0; this.yaw = pos?.yaw ?? 0; this.pitch = 0; this.vy = 0; this.noChao = true;
    this.pos.set(x, this.groundAt(x, z, 1e9) + 1.75, z); this.#trocaMao(this.equipado);
  }

  /* ---------- estado do mundo (recursos + estruturas) ---------- */
  aplicarMundo(m = {}) {
    for (const r of this.recursos) if (!r.vivo) { r.vivo = true; r.mesh.setMatrixAt(r.idx, r.mat); }
    this.destruidos.clear();
    const ds = Array.isArray(m.destruidos) ? Object.fromEntries(m.destruidos.map(i => [i, Date.now() + 60000])) : (m.destruidos || {});
    for (const [id, ts] of Object.entries(ds)) { const r = this.recMap.get(id); if (r && ts > Date.now()) { r.vivo = false; r.mesh.setMatrixAt(r.idx, this.ZERO); this.destruidos.set(id, ts); } }
    for (const mm of this.meshesRec) mm.instanceMatrix.needsUpdate = true;
    for (const id of [...this.estruturas.keys()]) this.removerEstrutura(id);
    for (const e of m.estruturas || []) this.addEstrutura(e);
  }
  estadoMundo() { return { destruidos: Object.fromEntries(this.destruidos), estruturas: [...this.estruturas.values()].map(({ id, tipo, x, y, z, ry, dono }) => ({ id, tipo, x, y, z, ry, dono: dono || null })) }; }
  setRecursoVivo(id, vivo) {
    const r = this.recMap.get(id); if (!r) return;
    if (vivo && !r.vivo) { r.vivo = true; r.mesh.setMatrixAt(r.idx, r.mat); r.mesh.instanceMatrix.needsUpdate = true; this.destruidos.delete(id); }
    else if (!vivo && r.vivo) this.#destruir(r, false);
  }
  #destruir(r, local) {
    r.vivo = false; r.mesh.setMatrixAt(r.idx, this.ZERO); r.mesh.instanceMatrix.needsUpdate = true;
    const R = RECURSOS[r.tipo]; this.destruidos.set(r.id, Date.now() + R.respawn * 1000);
    const dx = r.x - this.pos.x, dz = r.z - this.pos.z;
    if (local || dx * dx + dz * dz < 80 * 80) { this.part.emit(new THREE.Vector3(r.x, r.y + 1.2, r.z), CORES_HIT[r.tipo], 28, 4.5, 3); if (!local) this.som.quebrar(R.cat === 'madeira' ? 'madeira' : R.cat); }
    if (local) { this.som.quebrar(R.cat === 'madeira' ? 'madeira' : R.cat); this.progresso = 0; this.alvo = null; this.onQuebrou?.(r); }
  }
  addEstrutura(e) {
    if (this.estruturas.has(e.id)) return;
    const m = meshPeca(e.tipo); m.position.set(e.x, e.y, e.z); m.rotation.y = e.ry; m.userData.sid = e.id; this.gEst.add(m);
    this.estruturas.set(e.id, { ...e, mesh: m });
    this.part.emit(new THREE.Vector3(e.x, e.y + .3, e.z), 0xb08050, 10, 3, 1);
  }
  removerEstrutura(id) { const s = this.estruturas.get(id); if (!s) return; this.gEst.remove(s.mesh); this.estruturas.delete(id); if (this.estAlvo?.id === id) this.estAlvo = null; }

  /* ---------- terreno + estruturas: altura do chão e colisão ---------- */
  groundAt(x, z, feetRef = 1e9) {
    let best = heightAt(x, z, this.seed);
    for (const s of this.estruturas.values()) {
      if (s.tipo !== 'fundacao' && s.tipo !== 'rampa') continue;
      const dx = x - s.x, dz = z - s.z; if (dx * dx + dz * dz > 10) continue;
      const c = Math.cos(s.ry), sn = Math.sin(s.ry), lx = dx * c - dz * sn, lz = dx * sn + dz * c;
      if (Math.abs(lx) > 2 || Math.abs(lz) > 2) continue;
      const y = s.tipo === 'fundacao' ? s.y : s.y + (lz + 2) * .5 + .1;
      if (y <= feetRef + .95 && y > best) best = y;
    }
    return best;
  }
  #colide(x, z, feet) {
    if (x * x + z * z > 228 * 228) return true;
    const pr = .35;
    for (const r of this.#vizinhos(x, z)) { if (!r.vivo) continue; const dx = x - r.x, dz = z - r.z, R = r.col + pr; if (dx * dx + dz * dz < R * R) return true; }
    for (const s of this.estruturas.values()) {
      const dx = x - s.x, dz = z - s.z; if (dx * dx + dz * dz > 12) continue;
      const c = Math.cos(s.ry), sn = Math.sin(s.ry), lx = dx * c - dz * sn, lz = dx * sn + dz * c;
      if (s.tipo === 'parede') { if (Math.abs(lx) < 2 + pr && Math.abs(lz) < .125 + pr && feet < s.y + 2.7) return true; }
      else if (s.tipo === 'fundacao') { if (Math.abs(lx) < 2 && Math.abs(lz) < 2 && s.y > feet + .95) return true; }
      else if (s.tipo === 'rampa') { if (Math.abs(lx) < 2 && Math.abs(lz) < 2 && s.y + (lz + 2) * .5 + .1 > feet + .95) return true; }
      else if (s.tipo === 'bancada') { if (Math.abs(lx) < .8 + pr && Math.abs(lz) < .45 + pr && feet < s.y + .9) return true; }
      else if (s.tipo === 'cama') { if (Math.abs(lx) < .55 + pr && Math.abs(lz) < 1 + pr && feet < s.y + .5) return true; }
      else if (s.tipo === 'fogueira') { if (dx * dx + dz * dz < (.45 + pr) ** 2 && feet < s.y + .3) return true; }
    }
    return false;
  }
  #mover(dx, dz) {
    if (!dx && !dz) return; let px = this.pos.x, pz = this.pos.z;
    const tenta = (nx, nz) => {
      const f = this.pos.y - 1.7; if (this.#colide(nx, nz, f)) return false;
      if (this.noChao) { const g1 = this.groundAt(px, pz, f + .95), g2 = this.groundAt(nx, nz, f + .95), st = Math.hypot(nx - px, nz - pz) || 1e-6; if (g2 - g1 > 0 && (g2 - g1) / st > 1.8) return false; }
      px = nx; pz = nz; return true;
    };
    if (!tenta(px + dx, pz + dz)) { tenta(px + dx, pz); tenta(px, pz + dz); }
    this.pos.x = px; this.pos.z = pz;
  }
  #jogador(dt) {
    const feet = this.pos.y - 1.7, base = heightAt(this.pos.x, this.pos.z, this.seed), nada = base < -1 && feet < .2;
    let v = 5.2; if (nada) v = 3; else if (feet < -.1) v *= .7;
    let ix = this.input.x, iz = this.input.z; const len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; }
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const ox = this.pos.x, oz = this.pos.z;
    this.#mover((c * ix - s * iz) * v * dt, (-s * ix - c * iz) * v * dt);
    const mv = Math.hypot(this.pos.x - ox, this.pos.z - oz); this.movendo = mv > 1e-4; this._passo += mv;
    if (this._passo > 1.9 && (this.noChao || nada)) {   // passos procedurais por superfície
      this._passo = 0; const hh = heightAt(this.pos.x, this.pos.z, this.seed), g2 = this.groundAt(this.pos.x, this.pos.z, this.pos.y - 1.7);
      this.som.passo(nada || feet < -.1 ? 'agua' : g2 > hh + .05 ? 'madeira' : hh < 1.3 ? 'areia' : hh > 12 ? 'pedra' : 'grama');
    }
    const g = this.groundAt(this.pos.x, this.pos.z, this.pos.y - 1.7);
    if (nada) { this.pos.y += (1.25 - this.pos.y) * Math.min(1, 3 * dt); this.vy = 0; this.noChao = false; if (this.input.pulo) this.pos.y += 2 * dt; }
    else {
      this.vy -= 22 * dt; this.pos.y += this.vy * dt; const fy = this.pos.y - 1.7;
      if (fy <= g) { this.pos.y = g + 1.7; this.vy = 0; this.noChao = true; }
      else if (this.noChao && this.vy <= 0 && fy - g < .4) this.pos.y = g + 1.7;
      else this.noChao = false;
      if (this.input.pulo && this.noChao) { this.vy = feet < -.1 ? 4.5 : 7.4; this.noChao = false; }
    }
    if (this.pos.y < -30) { this.pos.set(0, this.groundAt(0, 0, 1e9) + 1.75, 0); this.vy = 0; }
    this.cam.position.copy(this.pos); this.cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    const agora = performance.now();
    if (this.onMove && agora - this._ultEnvio > 100) { this._ultEnvio = agora; this.onMove({ x: this.pos.x, y: this.pos.y, z: this.pos.z, ry: this.yaw, f: this.equipado, a: this.atacando || performance.now() < this._atkAte ? 1 : 0, v: Math.round(this.vida) }); }
  }

  /* ---------- interação: mineração, construção, demolição ---------- */
  #interacao(dt) {
    this.cam.getWorldDirection(this._d);
    this.cdAtq = Math.max(0, this.cdAtq - dt); this.cdUso = Math.max(0, this.cdUso - dt);
    this._nome = ''; this._prog = 0; this._dica = ''; this.atacando = false;
    const eq = this.equipado;
    if (PECAS.includes(eq)) { this.alvo = null; this.progresso = 0; this.#ghost(); }
    else {
      this.gGhost.visible = false; if (this.ghostM) this.ghostM.visible = false; this.ghostPos = null;
      if (CONSUMIVEL[eq]) { this.alvo = null; this.#consumir(eq); }
      else if (eq === 'carne_crua') { this.alvo = null; this.#assar(dt); }
      else if (eq === 'cantil') { this.alvo = null; this.#encher(dt); }
      else if (ARMAS.has(eq)) { this.alvo = null; this.progresso = 0; this.#atacar(); }
      else {
        this.#minerar(dt);
        if (!this.alvo) { if (eq === 'mao' && this.#alvoAgua()) this.#beber(dt); else { this.progresso = 0; if (this.input.acao) this.#atacar(); } }
      }
      this.#alvoEst(dt);
    }
    this.#hud();
  }
  #minerar(dt) {
    const o = this.cam.position, d = this._d; let melhor = null, bt = ALC;
    for (const r of this.#vizinhos(o.x, o.z)) {
      if (!r.vivo) continue; const ddx = r.x - o.x, ddz = r.z - o.z; if (ddx * ddx + ddz * ddz > (ALC + r.rad + 2) ** 2) continue;
      const t = rayVsSeg(o.x, o.y, o.z, d.x, d.y, d.z, r.x, r.ay, r.z, 0, r.vy, 0, r.rad, ALC);
      if (t >= 0 && t < bt) { bt = t; melhor = r; }
    }
    if (melhor !== this.alvo) { this.alvo = melhor; this.progresso = 0; this.golpeT = 0; }
    if (melhor) {
      const R = RECURSOS[melhor.tipo], v = velocidadeColeta(this.equipado, melhor.tipo);
      this._nome = R.nome; this._prog = Math.round(this.progresso * 100);
      if (v <= 0) this._dica = 'Requer ' + R.req;
      else if (this.input.acao) {
        this.atacando = true; this._atkAte = performance.now() + 500; this.progresso += dt * v / R.dureza; this.golpeT -= dt;
        if (this.golpeT <= 0) { this.golpeT = .5; this.#golpe(melhor, bt); }
        if (this.progresso >= 1) this.#destruir(melhor, true);
      } else this.progresso = Math.max(0, this.progresso - dt * 1.2);
    } else this.progresso = 0;
  }
  #consumir(eq) {
    this._dica = 'Clique / ação para ' + (eq === 'cantil_cheio' ? 'beber' : 'comer');
    if (this.input.acao && this.cdUso <= 0) { this.cdUso = .9; this.swing = .7; if (eq === 'cantil_cheio') this.som.beber(); else this.som.comer(); this.onConsumir?.(eq); }
  }
  #assar(dt) {
    let f = null, bd = 3.4 ** 2;
    for (const s of this.estruturas.values()) if (s.tipo === 'fogueira') { const d2 = (s.x - this.pos.x) ** 2 + (s.z - this.pos.z) ** 2; if (d2 < bd) { bd = d2; f = s; } }
    if (!f) { this._dica = 'Aproxime-se de uma fogueira para assar a carne'; this.progresso = 0; return; }
    if (this.input.acao) {
      this.progresso += dt / 3; this._nome = 'Assando carne…'; this._prog = Math.round(this.progresso * 100);
      if (Math.random() < dt * 8) this.part.emit(new THREE.Vector3(f.x, f.y + .7, f.z), 0xffa040, 1, .6, 1.4);
      if (this.progresso >= 1) { this.progresso = 0; this.som.comer(); this.onCozinhar?.(); }
    } else { this.progresso = Math.max(0, this.progresso - dt); this._dica = 'Segure para assar na fogueira'; }
  }
  #alvoAgua() {   // ponto de água a até 4,6 m na direção do olhar (margens, rios e lagos)
    const o = this.cam.position, d = this._d;
    for (let t = .5; t <= 4.6; t += .25) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (y <= AGUA + .06) return heightAt(x, z, this.seed) < AGUA - .05 ? { x, z } : null;
    }
    return null;
  }
  #beber(dt) {
    if (this.input.acao) {
      this.progresso += dt / 1.1; this._nome = 'Bebendo água…'; this._prog = Math.round(this.progresso * 100); this.golpeT -= dt;
      if (this.golpeT <= 0) { this.golpeT = .4; this.som.beber(); }
      if (this.progresso >= 1) { this.progresso = 0; this.onBeberAgua?.(); }
    } else { this.progresso = Math.max(0, this.progresso - dt); this._dica = 'Segure para beber água'; }
  }
  #encher(dt) {
    if (!this.#alvoAgua()) { this._dica = 'Aponte para a água para encher o cantil'; this.progresso = 0; return; }
    if (this.input.acao) {
      this.progresso += dt / 1.1; this._nome = 'Enchendo cantil…'; this._prog = Math.round(this.progresso * 100);
      if (this.progresso >= 1) { this.progresso = 0; this.som.beber(); this.onEncher?.(); }
    } else { this.progresso = Math.max(0, this.progresso - dt); this._dica = 'Segure para encher o cantil'; }
  }
  // golpe corpo a corpo: cooldown + cone frontal (~44°) sobre criaturas hostis e animais
  #atacar() {
    const eq = this.equipado, arma = ARMAS.has(eq), alvo = this.#alvoCriatura(arma ? 3 : 2.3);
    if (!this.input.acao || this.cdAtq > 0) return;
    if (!arma && !alvo) return;
    this.cdAtq = arma ? .55 : .6; this.swing = 1; this.atacando = true; this._atkAte = performance.now() + 450;
    if (arma) this.som.espada(); else this.som.golpe('madeira');
    if (alvo) this.#acertar(alvo, DANO[eq] || 2);
  }
  #alvoCriatura(alc) {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), P = this.pos; let melhor = null, md = 1e9;
    const teste = (x, z, ref, tipo, extra) => {
      const dx = x - P.x, dz = z - P.z, d = Math.hypot(dx, dz); if (d > alc + extra) return;
      if (d > 1 && (dx * fx + dz * fz) / d < .72) return;
      if (d < md) { md = d; melhor = { ref, tipo }; }
    };
    for (const h of this.hostisMap.values()) teste(h.g.position.x, h.g.position.z, h, 'hostil', h.k === 'golem' ? .8 : .4);
    for (const a of this.fauna) if (!a.morto && a.g.visible) teste(a.x, a.z, a, 'fauna', a.tipo === 'cervo' ? .5 : .1);
    return melhor;
  }
  #acertar(alvo, dano) {
    if (alvo.tipo === 'hostil') {
      const h = alvo.ref; this.part.emit(new THREE.Vector3(h.g.position.x, h.g.position.y + 1, h.g.position.z), 0xaa1111, 10, 3, 2); this.som.golpeInimigo();
      if (this.offline) this.#danoHostilLocal(h.id, dano); else this.onAtacarHostil?.(h.id, dano);
    } else {
      const a = alvo.ref; a.hp -= dano; a.estado = 'fugir'; const dx = a.x - this.pos.x, dz = a.z - this.pos.z, l = Math.hypot(dx, dz) || 1; a.dx = dx / l; a.dz = dz / l;
      this.part.emit(new THREE.Vector3(a.x, a.y + 1, a.z), 0xaa1111, 8, 3, 2); this.som.golpeInimigo();
      if (a.hp <= 0) { a.morto = true; a.g.visible = false; a.volta = Date.now() + 90000; this.part.emit(new THREE.Vector3(a.x, a.y + .8, a.z), 0x884422, 16, 3, 2); this.onDrop?.(a.tipo === 'cervo' ? { carne_crua: 2 } : { carne_crua: 1 }); }
    }
  }
  #danoHostilLocal(id, dano) {
    const r = this.hostisLocal.danificar(id, dano); if (!r) return;
    if (r.morto) { this.onDrop?.(r.drops); this.setHostis(this.hostisLocal.snapshot()); }
  }
  #golpe(r, t) {
    const d = this._d, o = this.cam.position, cat = RECURSOS[r.tipo].cat;
    this.som.golpe(cat === 'madeira' ? 'madeira' : cat === 'pedra' ? 'pedra' : cat);
    this.part.emit(new THREE.Vector3(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t), CORES_HIT[r.tipo], 8, 3, 2);
    this.swing = 1;
  }
  #alvoEst(dt) {
    this._tAlvo -= dt; if (this._tAlvo > 0) return; this._tAlvo = .16;
    this.ray.setFromCamera({ x: 0, y: 0 }, this.cam); this.ray.far = 6;
    const hits = this.ray.intersectObjects(this.gEst.children, true); this.estAlvo = null;
    if (hits.length) { let o = hits[0].object; while (o && o.userData.sid === undefined) o = o.parent; if (o) this.estAlvo = this.estruturas.get(o.userData.sid) || null; }
  }
  #mira(max) {
    const o = this.cam.position, d = this._d; let prev = 0;
    for (let t = .6; t <= max; t += .3) {
      const g = this.groundAt(o.x + d.x * t, o.z + d.z * t, 1e9);
      if (o.y + d.y * t <= g) {
        let a = prev || t - .3, b = t;
        for (let i = 0; i < 6; i++) { const m = (a + b) / 2; if (o.y + d.y * m <= this.groundAt(o.x + d.x * m, o.z + d.z * m, 1e9)) b = m; else a = m; }
        const x = o.x + d.x * b, z = o.z + d.z * b; return { x, z, y: this.groundAt(x, z, 1e9), ok: true };
      }
      prev = t;
    }
    const x = o.x + d.x * max, z = o.z + d.z * max; return { x, z, y: this.groundAt(x, z, 1e9), ok: false };
  }
  #snap(tipo, a) {
    const S = Math.PI / 2, ys = Math.round(this.yaw / S) * S + this.giro * S, est = [...this.estruturas.values()];
    const fund = est.filter(s => s.tipo === 'fundacao');
    const prox = (arr, dmax) => { let b = null, bd = dmax * dmax; for (const s of arr) { const dx = s.x - a.x, dz = s.z - a.z, dd = dx * dx + dz * dz; if (dd < bd) { bd = dd; b = s; } } return b; };
    const loc = (s, x, z) => { const dx = x - s.x, dz = z - s.z, c = Math.cos(s.ry), sn = Math.sin(s.ry); return [dx * c - dz * sn, dx * sn + dz * c]; };
    const mund = (s, lx, lz) => { const c = Math.cos(s.ry), sn = Math.sin(s.ry); return [s.x + c * lx + sn * lz, s.z - sn * lx + c * lz]; };
    const base = { incB: 0, incC: 0 }, cantos = [[0, 0], [2, 2], [2, -2], [-2, 2], [-2, -2]];
    if (tipo === 'fundacao') {
      const F = prox(fund, 6.5);
      if (F) { // encaixa na célula vizinha (4 m) da fundação mais próxima, no mesmo nível
        const [lx, lz] = loc(F, a.x, a.z); let ox = 0, oz = 0; if (Math.abs(lx) > Math.abs(lz)) ox = Math.sign(lx) || 1; else oz = Math.sign(lz) || 1;
        const [wx, wz] = mund(F, ox * 4, oz * 4), c = Math.cos(F.ry), sn = Math.sin(F.ry);
        const h = cantos.map(([cx, cz]) => heightAt(wx + c * cx + sn * cz, wz - sn * cx + c * cz, this.seed));
        return { x: wx, y: F.y, z: wz, ry: F.ry, incB: F.y - Math.min(...h), incC: Math.max(...h) - F.y };
      }
      const c = Math.cos(ys), sn = Math.sin(ys), h = cantos.map(([cx, cz]) => this.groundAt(a.x + c * cx + sn * cz, a.z - sn * cx + c * cz, 1e9)), mx = Math.max(...h), mn = Math.min(...h);
      return { x: a.x, z: a.z, y: mx + .3, ry: ys, incB: mx + .3 - mn, incC: -.3 };
    }
    if (tipo === 'parede') {
      const F = prox(fund, 7);
      if (F) { // encaixa na borda mais próxima da fundação
        let best = null, bd = 1e9;
        for (const [lx, lz, ad] of [[0, 2, 0], [0, -2, 0], [2, 0, S], [-2, 0, S]]) { const [wx, wz] = mund(F, lx, lz), dd = (wx - a.x) ** 2 + (wz - a.z) ** 2; if (dd < bd) { bd = dd; best = { x: wx, z: wz, y: F.y, ry: F.ry + ad, ...base }; } }
        if (bd <= 16) return best;
      }
      const c = Math.cos(ys), sn = Math.sin(ys), g1 = this.groundAt(a.x - c * 2, a.z + sn * 2, 1e9), g2 = this.groundAt(a.x + c * 2, a.z - sn * 2, 1e9);
      return { x: a.x, z: a.z, y: Math.max(g1, g2), ry: ys, incB: Math.abs(g1 - g2), incC: 0 };
    }
    if (tipo === 'rampa') {
      const W = prox(est.filter(s => s.tipo === 'parede'), 4.5);
      if (W) { const [, lz] = loc(W, a.x, a.z), sg = lz >= 0 ? 1 : -1, dx = Math.sin(W.ry) * sg, dz = Math.cos(W.ry) * sg; return { x: W.x + dx * 2, z: W.z + dz * 2, y: W.y + 3, ry: Math.atan2(dx, dz), ...base }; } // telhado a partir do topo da parede
      const F = prox(fund, 4);
      if (F) { const [lx, lz] = loc(F, a.x, a.z); if (Math.abs(lx) < 2.2 && Math.abs(lz) < 2.2) return { x: F.x, z: F.z, y: F.y, ry: ys, ...base }; }
      return { x: a.x, z: a.z, y: this.groundAt(a.x - Math.sin(ys) * 2, a.z - Math.cos(ys) * 2, 1e9), ry: ys, ...base };
    }
    return { x: a.x, z: a.z, y: a.y, ry: tipo === 'fogueira' ? 0 : ys, ...base };
  }
  #valido(tipo, p, a) {
    if (this.estoque <= 0 || !a.ok) return false;
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z; if (dx * dx + dz * dz > 121) return false;
    if (this.estruturas.size >= 600 || p.y < .35) return false;
    if (p.incB > (tipo === 'fundacao' ? 1.6 : 1.2) || p.incC > .7) return false;
    const mind = { fundacao: 3.4, parede: .6, rampa: 3, bancada: 1.3, fogueira: 1.3, cama: 1.6 }[tipo];
    for (const s of this.estruturas.values()) { if (s.tipo === tipo && (s.x - p.x) ** 2 + (s.z - p.z) ** 2 < mind * mind && Math.abs(s.y - p.y) < 2.5) return false; }
    const ext = { fundacao: [2, 2], parede: [2, .15], rampa: [2, 2], bancada: [.8, .45], fogueira: [.5, .5], cama: [.55, 1] }[tipo], c = Math.cos(p.ry), sn = Math.sin(p.ry);
    for (const r of this.#vizinhos(p.x, p.z)) { if (!r.vivo) continue; const ddx = r.x - p.x, ddz = r.z - p.z, lx = ddx * c - ddz * sn, lz = ddx * sn + ddz * c; if (Math.abs(lx) < ext[0] + r.col && Math.abs(lz) < ext[1] + r.col) return false; }
    if (tipo !== 'fundacao') { const px = this.pos.x - p.x, pz = this.pos.z - p.z, lx = px * c - pz * sn, lz = px * sn + pz * c; if (Math.abs(lx) < ext[0] + .45 && Math.abs(lz) < ext[1] + .45 && this.pos.y - 1.7 < p.y + 1) return false; }
    return true;
  }
  #ghost() {
    if (this.ghostTipo !== this.equipado) {
      if (this.ghostM) this.gGhost.remove(this.ghostM);
      this.ghostM = meshPeca(this.equipado); this.ghostM.traverse(o => { if (o.isMesh) { o.material = this.ghostMatOk; o.castShadow = false; o.receiveShadow = false; } });
      this.gGhost.add(this.ghostM); this.ghostTipo = this.equipado; this._ghostCor = true;
    }
    const a = this.#mira(9.5), p = this.#snap(this.equipado, a), ok = this.#valido(this.equipado, p, a);
    if (ok !== this._ghostCor) { this._ghostCor = ok; this.ghostM.traverse(o => { if (o.isMesh) o.material = ok ? this.ghostMatOk : this.ghostMatBad; }); }
    this.ghostOk = ok; this.ghostPos = p; this.ghostM.visible = true; this.gGhost.visible = true;
    this.ghostM.position.set(p.x, p.y, p.z); this.ghostM.rotation.y = p.ry;
  }
  #tentarConstruir() {
    if (!this.ghostPos) return;
    if (!this.ghostOk) { this.som.erro(); return; }
    const n = performance.now(); if (n - this._ultB < 250) return; this._ultB = n;
    const p = this.ghostPos, r3 = v => Math.round(v * 1000) / 1000;
    if (this.onConstruir?.({ tipo: this.equipado, x: r3(p.x), y: r3(p.y), z: r3(p.z), ry: r3(p.ry) })) { this.som.construir(); this.swing = 1; }
  }
  #hud() {
    const constr = PECAS.includes(this.equipado); let nome = this._nome, prog = this._prog, dica = this._dica;
    if (constr) { nome = ''; prog = 0; dica = this.estoque <= 0 ? 'Sem peças — fabrique no inventário (E)' : this.ghostOk ? 'Construir: clique / botão de ação · R gira' : 'Local inválido'; }
    else if (!nome && !dica && this.estAlvo) dica = 'F / 🗑 demolir ' + ITENS[this.estAlvo.tipo].nome;
    const key = nome + '|' + prog + '|' + dica + '|' + constr + '|' + !!this.estAlvo;
    if (key !== this._hud) { this._hud = key; this.onHud?.({ alvo: nome, prog, dica, construindo: constr, demolivel: !!this.estAlvo && !constr }); }
  }

  /* ---------- fogueiras (luz, partículas, regeneração) ---------- */
  #fogo(dt) {
    const P = this.pos, fs = []; let nf = 1e9;
    for (const s of this.estruturas.values()) {
      const dx = s.x - P.x, dz = s.z - P.z, d2 = dx * dx + dz * dz;
      if (s.tipo === 'fogueira') { fs.push([d2, s]); if (d2 < nf) nf = d2; if (s.mesh.userData.chamas) { const f = .8 + .35 * Math.sin(this.t * 13 + s.x) + Math.random() * .1; s.mesh.userData.chamas[0].scale.set(1, f, 1); s.mesh.userData.chamas[1].scale.set(1, f * 1.1, 1); } }
    }
    this.nearFogueira = this.mode === 'play' && nf < 36;
    fs.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < 3; i++) { const l = this.luzesF[i], f = fs[i]; if (f && f[0] < 6400) { l.position.set(f[1].x, f[1].y + 1, f[1].z); l.intensity = 1.7 + Math.random() * .5; } else l.intensity = 0; }
    this._fumo -= dt;
    if (this._fumo <= 0) { this._fumo = .13; for (let i = 0; i < Math.min(2, fs.length); i++) { const f = fs[i]; if (f[0] < 3600) { const q = f[1]; this.fumaca.emit(new THREE.Vector3(q.x + (Math.random() - .5) * .2, q.y + 1.0, q.z + (Math.random() - .5) * .2), 0x666666, 1, .3, .9, 2.6, 0); } } }
    this._embers -= dt;
    if (fs[0] && fs[0][0] < 1600 && this._embers <= 0) { this._embers = .09; const s = fs[0][1]; this.part.emit(new THREE.Vector3(s.x + (Math.random() - .5) * .3, s.y + .7, s.z + (Math.random() - .5) * .3), Math.random() < .5 ? 0xff9a3a : 0xffd34a, 1, .6, 1.8); }
  }

  /* ---------- fauna ---------- */
  #faunaUpdate(dt) {
    const P = this.pos;
    for (const a of this.fauna) {
      if (a.morto) { if (Date.now() > a.volta) this.#reposFauna(a); continue; }
      const dx = a.x - P.x, dz = a.z - P.z, d2 = dx * dx + dz * dz; if (d2 > 140 * 140) continue;
      const d = Math.sqrt(d2), cervo = a.tipo === 'cervo', susto = cervo ? 15 : 10; let mov = 0;
      if (this.mode === 'play' && d < susto) { a.estado = 'fugir'; const l = d || 1; a.dx = dx / l; a.dz = dz / l; }
      else if (a.estado === 'fugir' && d > susto + 8) { a.estado = 'idle'; a.timer = 1 + Math.random() * 2; }
      if (a.estado === 'idle') { a.timer -= dt; if (a.timer <= 0) { const an = Math.random() * 6.283; a.dx = Math.cos(an); a.dz = Math.sin(an); a.estado = 'andar'; a.timer = 2 + Math.random() * 3; } }
      else if (a.estado === 'andar') { a.timer -= dt; if (a.timer <= 0) { a.estado = 'idle'; a.timer = 2 + Math.random() * 4; } }
      if (a.estado !== 'idle') {
        const sp = a.estado === 'fugir' ? (cervo ? 7.6 : 6.8) : (cervo ? 1.5 : 1.1), nx = a.x + a.dx * sp * dt, nz = a.z + a.dz * sp * dt, h = heightAt(nx, nz, this.seed);
        if (h < 1 || h > 16 || nx * nx + nz * nz > 220 * 220 || Math.abs(h - a.y) / (sp * dt + 1e-6) > 1.6) { a.dx = -a.dx + (Math.random() - .5); a.dz = -a.dz + (Math.random() - .5); const l = Math.hypot(a.dx, a.dz) || 1; a.dx /= l; a.dz /= l; if (a.estado === 'andar') a.timer = .3; }
        else { a.x = nx; a.z = nz; a.y = h; mov = sp; }
        let df = Math.atan2(a.dx, a.dz) - a.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); a.yaw += df * Math.min(1, dt * 8);
      }
      if (mov) a.fase += dt * (mov > 3 ? 14 : 7);
      a.g.position.set(a.x, a.y + (cervo || !mov ? 0 : Math.abs(Math.sin(a.fase)) * .18), a.z); a.g.rotation.y = a.yaw;
      a.pernas.forEach((l, i) => { l.rotation.x = mov ? Math.sin(a.fase + (i % 2) * Math.PI) * .7 : 0; });
    }
  }

  /* ---------- jogadores remotos ---------- */
  /* ---------- criaturas hostis (Fase 3) ---------- */
  #criaHostil(id, k) {
    const m = k === 'lobo' ? modeloLobo() : modeloGolem(), g = m.g, topo = k === 'lobo' ? 1.75 : 3.6;
    const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x000000, transparent: true, opacity: .55, depthTest: false, fog: false })), fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff5a4a, depthTest: false, fog: false }));
    bg.scale.set(1.2, .1, 1); fg.scale.set(1.2, .1, 1); bg.position.y = fg.position.y = topo; bg.renderOrder = 5; fg.renderOrder = 6; bg.visible = fg.visible = false; g.add(bg, fg);
    g.traverse(o => { if (o.isMesh) o.castShadow = this.Q.sombra; });
    return { id, k, g, c: m.c, pernas: m.pernas, bracos: m.bracos || [], bg, fg, tx: 0, tz: 0, ry: 0, hp: 1, hpMax: 1, estado: 0, atk: 0, fase: 0 };
  }
  // lista = snapshot do servidor (online) ou da simulação local (offline): [id,tipo,x,z,ry,hp,estado,atk,hpMax]
  setHostis(lista) {
    const vistos = new Set();
    for (const [id, k, x, z, ry, hp, estado, atk, hpMax] of lista) {
      vistos.add(id); let h = this.hostisMap.get(id);
      if (!h) { h = this.#criaHostil(id, k === 0 ? 'lobo' : 'golem'); h.g.position.set(x, Math.max(heightAt(x, z, this.seed), AGUA), z); h.g.rotation.y = ry; this.hostisMap.set(id, h); this.gHostis.add(h.g); }
      h.tx = x; h.tz = z; h.ry = ry; h.hp = hp; h.hpMax = hpMax; h.estado = estado; h.atk = atk;
    }
    for (const [id, h] of this.hostisMap) if (!vistos.has(id)) { this.part.emit(new THREE.Vector3(h.g.position.x, h.g.position.y + 1, h.g.position.z), 0x2a2a3a, 14, 3, 2); this.gHostis.remove(h.g); this.hostisMap.delete(id); }
  }
  limparHostis() { for (const h of this.hostisMap.values()) this.gHostis.remove(h.g); this.hostisMap.clear(); }
  fxHostilGolpe(id) { const h = this.hostisMap.get(id); if (h) { this.part.emit(new THREE.Vector3(h.g.position.x, h.g.position.y + 1, h.g.position.z), 0xaa1111, 8, 3, 2); this.som.golpeInimigo(); } }
  #hostisUpdate(dt) {
    if (this.mode === 'play' && this.offline && !this.parado) {   // offline: simulação local (online: snapshots do servidor)
      const fog = [], par = [];
      for (const s of this.estruturas.values()) { if (s.tipo === 'fogueira') fog.push(s); else if (s.tipo === 'parede') par.push(s); }
      this.hostisLocal.update(dt, {
        jogadores: [{ id: 'eu', x: this.pos.x, z: this.pos.z, vivo: this.vivo }], fogueiras: fog, paredes: par, noite: ehNoite(this.fase),
        ataque: (id, dano, k) => { if (this.vivo) this.onDano?.(dano, k); }, sumiu: () => {},
      });
      this.setHostis(this.hostisLocal.snapshot());
    }
    for (const h of this.hostisMap.values()) {
      const g = h.g, k = Math.min(1, dt * 10);
      g.position.x += (h.tx - g.position.x) * k; g.position.z += (h.tz - g.position.z) * k;
      g.position.y = Math.max(heightAt(g.position.x, g.position.z, this.seed), AGUA);
      let df = h.ry - g.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); g.rotation.y += df * Math.min(1, dt * 9);
      const mov = Math.hypot(h.tx - g.position.x, h.tz - g.position.z) > .12 ? 1 : 0; h.fase += dt * (h.k === 'lobo' ? 11 : 5) * mov;
      h.pernas.forEach((l, i) => { l.rotation.x = Math.sin(h.fase + (i % 2) * Math.PI) * .8 * mov; });
      h.bracos.forEach((b, i) => { b.rotation.x = h.atk ? -1.5 : Math.sin(h.fase + i * Math.PI) * .35 * mov; });
      h.c.rotation.x = h.atk && h.k === 'lobo' ? -.3 : 0;
      const f = clamp(h.hp / h.hpMax, 0, 1); h.bg.visible = h.fg.visible = f < .999; h.fg.scale.x = Math.max(.01, 1.2 * f);
    }
  }
  #reposFauna(a) {
    let x = 0, z = 0, h = 0, ok = false;
    for (let t = 0; t < 30 && !ok; t++) { x = (Math.random() - .5) * 400; z = (Math.random() - .5) * 400; h = heightAt(x, z, this.seed); const dx = x - this.pos.x, dz = z - this.pos.z; ok = h > 1.6 && h < 10 && x * x + z * z > 200 && dx * dx + dz * dz > 1600; }
    if (!ok) { a.volta = Date.now() + 15000; return; }
    a.x = x; a.z = z; a.y = h; a.hp = a.tipo === 'cervo' ? 24 : 8; a.morto = false; a.estado = 'idle'; a.timer = 2; a.g.visible = true; a.g.position.set(x, h, z);
  }

  /* ---------- jogadores remotos (com skins e efeitos) ---------- */
  upsertRemoto(sid, d, nick, cos) {
    let a = this.remotos.get(sid);
    if (!a) { a = criarAvatar(nick || 'Jogador'); this.scene.add(a.g); this.remotos.set(sid, a); }
    if (cos !== undefined) { a.cos = cos; aplicaSkin(a, cos?.skin); a.f = null; }
    if (d) {
      a.alvo.set(d.x || 0, (d.y || 1.7) - 1.7, d.z || 0); a.ryAlvo = d.ry || 0;
      if (!a.init) { a.g.position.copy(a.alvo); a.init = true; }
      if (d.f !== undefined && d.f !== a.f) { a.f = d.f; while (a.mao.children.length) a.mao.remove(a.mao.children[0]); a.mao.add(modeloItem(d.f || 'mao', a.cos?.ferramenta)); }
      a.atk = !!d.a;
      if (d.v !== undefined) { const f = clamp(d.v / 100, 0, 1); a.hpFg.scale.x = Math.max(.01, 1.2 * f); a.hpFg.material.color.setHex(f > .5 ? 0x44dd66 : f > .25 ? 0xe0c040 : 0xe0443e); a.hpBg.visible = a.hpFg.visible = f < .999; }
    }
  }
  setCosRemoto(sid, cos) { if (this.remotos.has(sid)) this.upsertRemoto(sid, null, null, cos); }
  removeRemoto(sid) { const a = this.remotos.get(sid); if (a) { this.scene.remove(a.g); this.remotos.delete(sid); } }
  limparRemotos() { for (const sid of [...this.remotos.keys()]) this.removeRemoto(sid); }
  #remotosUpdate(dt) {
    for (const a of this.remotos.values()) {
      a.g.position.lerp(a.alvo, Math.min(1, dt * 12));
      let df = a.ryAlvo + Math.PI - a.g.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); a.g.rotation.y += df * Math.min(1, dt * 10);
      a.arm.rotation.x = a.atk ? -1.1 + Math.sin(this.t * 14) * .8 : -.2;
    }
  }
  // efeitos visuais cosméticos: rastro (ao andar) ou aura (ao redor do corpo) — local e remotos
  #efeitosUpdate(dt) {
    const emite = (cos, p, mov) => {
      const e = cos?.efeito; if (!e) return; const cor = parseInt(String(e.cor || '#ffffff').slice(1), 16);
      if (e.tipo === 'aura') { if (Math.random() < dt * 14) this.part.emit({ x: p.x + (Math.random() - .5) * .9, y: p.y + .2 + Math.random() * 1.7, z: p.z + (Math.random() - .5) * .9 }, cor, 1, .3, .5, 1.2, .2); }
      else if (mov && Math.random() < dt * 22) this.part.emit({ x: p.x + (Math.random() - .5) * .3, y: p.y + .1, z: p.z + (Math.random() - .5) * .3 }, cor, 1, .8, .9, 1, .4);
    };
    if (this.mode === 'play') emite(this.cos, { x: this.pos.x, y: this.pos.y - 1.7, z: this.pos.z }, this.movendo);
    for (const a of this.remotos.values()) emite(a.cos, a.g.position, a.g.position.distanceTo(a.alvo) > .08);
  }
  #ambUpdate(dt) { const p = this.mode === 'play' ? this.pos : this.cam.position; this.amb.update(dt, this.t, p, this.seed, 1 - this.dia, this.dia); }
  #respawnLocal() {
    if (!this.offline) return; const n = Date.now();
    for (const [id, ts] of this.destruidos) if (ts <= n) this.setRecursoVivo(id, true);
  }

  /* ---------- loop ---------- */
  #loop() {
    const dt = Math.min(this.clock.getDelta(), .05); this.t += dt;
    this.texOnda.offset.x += dt * .012; this.texOnda.offset.y += dt * .008;
    if (this.mode === 'menu') {
      const a = this.t * .05, R = 62; this.cam.position.set(Math.cos(a) * R, 16 + Math.sin(a * 2) * 3, Math.sin(a) * R); this.cam.lookAt(0, 5, 0);
    } else {
      if (!this.parado) { this.#jogador(dt); this.#interacao(dt); }
      else { this.cam.position.copy(this.pos); }
      if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 3.2);
      this.maoG.rotation.set(-.35 - Math.sin((1 - this.swing) * Math.PI) * (this.swing > 0 ? 1 : 0) * 1.0, .25, 0);
      this.maoG.position.y = -.34 + Math.sin(this.t * 2) * .004;
    }
    this.#atualizaCeu(); this.#faunaUpdate(dt); this.#remotosUpdate(dt); this.#hostisUpdate(dt); this.#fogo(dt); this.#efeitosUpdate(dt); this.#ambUpdate(dt); this.part.update(dt); this.fumaca.update(dt);
    this._resp -= dt; if (this._resp <= 0) { this._resp = 1; this.#respawnLocal(); }
    this.r.render(this.scene, this.cam);
  }
}
