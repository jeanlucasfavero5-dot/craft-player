// Craft Player — Fase 2 — servidor (Render): API segura p/ Supabase + salas/mapa aberto via Socket.IO
// Sincroniza: jogadores (posição/ferramenta/animação), recursos quebrados/regenerados e estruturas construídas.
// Persiste: progresso (craft_progresso) e estado do mundo (craft_mundos).
import express from 'express';
import http from 'http';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { createClient } from '@supabase/supabase-js';
import { Hostis, CICLO, ehNoite, DANO } from '../public/js/hostis.js';   // simulação compartilhada de criaturas hostis

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,        // service_role: SOMENTE aqui no servidor
  HUB_SHARED_SECRET = '',      // opcional: o hub assina o id (HMAC-SHA256 hex) -> parâmetro ?t=
  ALLOWED_ORIGIN = 'https://wavecombat-hub.onrender.com',
  PORT = 3000,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_KEY');
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: ALLOWED_ORIGIN } });

// ---------- listas permitidas / utilidades ----------
const ITENS_OK = new Set(['mao', 'madeira', 'tabua', 'pedra', 'ferro', 'diamante', 'machado_pedra', 'picareta_pedra', 'picareta_ferro', 'espada_madeira', 'espada_pedra', 'espada_ferro', 'fruta', 'carne_crua', 'carne_assada', 'cantil', 'cantil_cheio', 'fogueira', 'cama', 'fundacao', 'parede', 'porta', 'rampa', 'bancada', 'bau', 'totem']);
const LEGADO = { tronco: 'madeira', cristal: 'diamante' };   // migra saves da Fase 2 (nomes antigos)
const PECAS_OK = new Set(['fundacao', 'parede', 'porta', 'rampa', 'bancada', 'bau', 'totem', 'fogueira', 'cama']);
const PAREDES = new Set(['parede', 'porta']);
const MIN_DIST = { fundacao: 3.4, parede: .6, porta: .6, rampa: 3, bancada: 1.3, bau: 1.2, totem: 2.5, fogueira: 1.3, cama: 1.6 };   // mesma regra do cliente: evita peças sobrepostas
const RAIO_TOTEM = 25, LIB_MS = 60000, EXP_MS = 300000;   // território do totem; mochila: só o dono por 60 s, some em 5 min
const CONQUISTAS = { primeira_fogueira: 'Primeira Fogueira', primeiro_bau: 'Despenseiro', primeira_noite: 'Sobrevivente da Noite', cacador: 'Caçador (10 abates)', construtor: 'Construtor (10 peças)' };
const RESPAWN_S = { t: 180, r: 120, o: 300, f: 150 };   // árvore, rocha, minério, arbusto de frutas
const MAX_ESTRUTURAS = 600;
const RE_RECURSO = /^[trof]\d{1,4}$/;
const RE_ESTR = /^[el]\d{1,7}$/;

const num = (v, def, min, max) => { v = Number(v); if (!Number.isFinite(v)) return def; return Math.min(max, Math.max(min, v)); };
const idValido = (id) => typeof id === 'string' && /^[0-9A-Za-z_-]{1,32}$/.test(id);

function assinaturaOk(id, t) {
  if (!HUB_SHARED_SECRET) return true; // sem segredo = modo aberto (apenas desenvolvimento)
  if (!t) return false;
  const esperado = crypto.createHmac('sha256', HUB_SHARED_SECRET).update(String(id)).digest('hex');
  const a = Buffer.from(esperado), b = Buffer.from(String(t));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- sanitização (nunca confiar no cliente) ----------
function limpaInv(o) {
  const r = {};
  if (o && typeof o === 'object') for (const k0 of Object.keys(o)) {
    const k = LEGADO[k0] || k0;
    if (ITENS_OK.has(k) && k !== 'mao') r[k] = Math.min(99999, (r[k] || 0) + Math.floor(num(o[k0], 0, 0, 99999)));
  }
  for (const k of Object.keys(r)) if (r[k] <= 0) delete r[k];
  return r;
}
function limpaHotbar(a) {
  const r = Array(8).fill(null);
  if (Array.isArray(a)) for (let i = 0; i < 8; i++) { const k = typeof a[i] === 'string' ? (LEGADO[a[i]] || a[i]) : null; if (k && ITENS_OK.has(k)) r[i] = k; }
  return r;
}
function limpaPos(p) {
  if (!p || typeof p !== 'object') return null;
  return { x: num(p.x, 0, -5000, 5000), y: num(p.y, 5, -200, 2000), z: num(p.z, 0, -5000, 5000), yaw: num(p.yaw, 0, -1e4, 1e4), seed: Math.floor(num(p.seed, 0, 0, 2147483647)) };
}
function limpaItensBau(o) {
  const r = {};
  if (o && typeof o === 'object') for (const k of Object.keys(o)) { if (Object.keys(r).length >= 24) break; if (ITENS_OK.has(k) && k !== 'mao') { const q = Math.floor(num(o[k], 0, 0, 99999)); if (q > 0) r[k] = q; } }
  return r;
}
const limpaAut = (a) => (Array.isArray(a) ? a.filter(x => idValido(x)).slice(0, 12) : []);
function limpaEstruturas(arr) {
  const r = [];
  if (!Array.isArray(arr)) return r;
  for (const e of arr.slice(0, MAX_ESTRUTURAS)) {
    if (!e || !PECAS_OK.has(e.tipo) || typeof e.id !== 'string' || !RE_ESTR.test(e.id)) continue;
    const o = { id: e.id, tipo: e.tipo, x: num(e.x, 0, -600, 600), y: num(e.y, 0, -50, 500), z: num(e.z, 0, -600, 600), ry: num(e.ry, 0, -100, 100), dono: typeof e.dono === 'string' ? e.dono.slice(0, 32) : null };
    if (e.tipo === 'bau') o.itens = limpaItensBau(e.itens);
    if (e.tipo === 'totem') o.aut = limpaAut(e.aut);
    r.push(o);
  }
  return r;
}
function limpaMundo(m) {
  const d = {};
  if (m && typeof m.destruidos === 'object' && m.destruidos) {
    for (const [id, ts] of Object.entries(m.destruidos).slice(0, 4000)) if (RE_RECURSO.test(id)) d[id] = num(ts, 0, 0, 4e12);
  }
  return { destruidos: d, estruturas: limpaEstruturas(m?.estruturas) };
}

// ---------- middleware ----------
app.use(express.json({ limit: '300kb' }));
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', `frame-ancestors 'self' ${ALLOWED_ORIGIN}`);
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
function auth(req, res, next) {
  const id = req.query.id, t = req.query.t;
  if (!idValido(id) || !assinaturaOk(id, t)) return res.status(401).json({ erro: 'nao_autorizado' });
  req.jogadorId = id; next();
}

// ---------- API ----------
app.get('/api/perfil', auth, async (req, res) => {
  const { data, error } = await sb.from('carteira_diamantes').select('id_jogador,nick,diamantes').eq('id_jogador', req.jogadorId).maybeSingle();
  if (error) return res.status(500).json({ erro: 'db' });
  if (!data) return res.status(404).json({ erro: 'jogador_nao_encontrado' });
  await sb.from('craft_progresso').upsert({ id_jogador: data.id_jogador }, { onConflict: 'id_jogador', ignoreDuplicates: true });
  res.json(data);
});

app.get('/api/config', auth, async (req, res) => {
  const { data, error } = await sb.from('craft_progresso').select('config').eq('id_jogador', req.jogadorId).maybeSingle();
  if (error) return res.status(500).json({ erro: 'db' });
  res.json(data?.config ?? {});
});

app.put('/api/config', auth, async (req, res) => {
  const c = req.body || {};
  const limpo = {
    qualidade: ['auto', 'baixa', 'media', 'alta'].includes(c.qualidade) ? c.qualidade : 'auto',
    sensibilidade: num(c.sensibilidade, 1, 0.2, 3),
    invertY: !!c.invertY,
    volumeGeral: num(c.volumeGeral, 0.8, 0, 1),
    volumeMusica: num(c.volumeMusica, 0.6, 0, 1),
    volumeEfeitos: num(c.volumeEfeitos, 0.8, 0, 1),
    controleTouch: ['joystick', 'dpad'].includes(c.controleTouch) ? c.controleTouch : 'joystick',
  };
  const { error } = await sb.from('craft_progresso').upsert({ id_jogador: req.jogadorId, config: limpo, updated_at: new Date().toISOString() }, { onConflict: 'id_jogador' });
  if (error) return res.status(500).json({ erro: 'db' });
  res.json(limpo);
});

app.get('/api/itens', auth, async (req, res) => {
  const { data, error } = await sb.from('craft_itens_adquiridos').select('item_id,adquirido_em').eq('id_jogador', req.jogadorId);
  if (error) return res.status(500).json({ erro: 'db' });
  res.json(data);
});

// progresso: inventário, hotbar, posição, vida/energia e mundo offline
app.get('/api/progresso', auth, async (req, res) => {
  const base = 'inventario,hotbar,posicao,stats,offline_save,ultimo_modo';
  let r = await sb.from('craft_progresso').select(base + ',conquistas,estatisticas').eq('id_jogador', req.jogadorId).maybeSingle();
  if (r.error) r = await sb.from('craft_progresso').select(base).eq('id_jogador', req.jogadorId).maybeSingle();   // coluna nova ausente
  if (r.error) return res.status(500).json({ erro: 'db' });
  const data = r.data;
  res.json(data ? { ...data, inventario: limpaInv(data.inventario), hotbar: limpaHotbar(data.hotbar) } : {});
});
async function salvarProgresso(req, res) {
  const b = req.body || {};
  const modos = { offline: 'offline', mapa: 'mapa_aberto', sala: 'sala' };
  const linha = {
    id_jogador: req.jogadorId,
    inventario: limpaInv(b.inventario),
    hotbar: limpaHotbar(b.hotbar),
    posicao: limpaPos(b.posicao),
    stats: {
      vida: num(b.stats?.vida, 100, 0, 100), fome: num(b.stats?.fome ?? b.stats?.energia, 100, 0, 100), sede: num(b.stats?.sede, 100, 0, 100),
      respawn: b.stats?.respawn && typeof b.stats.respawn === 'object' ? { x: num(b.stats.respawn.x, 0, -600, 600), y: num(b.stats.respawn.y, 0, -50, 500), z: num(b.stats.respawn.z, 0, -600, 600) } : null,
    },
    updated_at: new Date().toISOString(),
  };
  if (modos[b.modo]) linha.ultimo_modo = modos[b.modo];
  if (b.mundo_offline) linha.offline_save = limpaMundo(b.mundo_offline);
  linha.conquistas = Array.isArray(b.conquistas) ? [...new Set(b.conquistas.filter(c => CONQUISTAS[c]))] : [];
  const es = b.estatisticas || {}; linha.estatisticas = { kills: Math.floor(num(es.kills, 0, 0, 1e7)), mortes: Math.floor(num(es.mortes, 0, 0, 1e7)), tempo_s: Math.floor(num(es.tempo_s, 0, 0, 1e9)), construcoes: Math.floor(num(es.construcoes, 0, 0, 1e7)) };
  let { error } = await sb.from('craft_progresso').upsert(linha, { onConflict: 'id_jogador' });
  if (error && /conquistas|estatisticas|column/i.test(error.message || '')) { delete linha.conquistas; delete linha.estatisticas; ({ error } = await sb.from('craft_progresso').upsert(linha, { onConflict: 'id_jogador' })); }
  if (error) return res.status(500).json({ erro: 'db' });
  res.json({ ok: true });
}
app.put('/api/progresso', auth, salvarProgresso);
app.post('/api/progresso', auth, salvarProgresso);   // usado por navigator.sendBeacon ao fechar a aba

// ---------- loja de diamantes / cosméticos (saldo e compras validados SOMENTE aqui, com a service key) ----------
let catCache = { t: 0, itens: [] };
async function catalogo() {
  if (Date.now() - catCache.t < 30000) return catCache.itens;
  const { data, error } = await sb.from('craft_catalogo').select('item_id,nome,tipo,preco_diamantes,raridade,meta').eq('ativo', true).order('preco_diamantes');
  if (error) throw error;
  catCache = { t: Date.now(), itens: data }; return data;
}
const SLOT_TIPO = { skin: 'skin', ferramenta: 'ferramenta', cosmetico: 'efeito' };
async function equipadosDe(id) { const { data } = await sb.from('craft_progresso').select('equipados').eq('id_jogador', id).maybeSingle(); return { ...(data?.equipados || {}) }; }
async function cosmeticosDe(id) {   // meta resolvida (cores/efeitos) para os outros jogadores renderizarem
  const [cat, eq] = await Promise.all([catalogo(), equipadosDe(id)]), out = {};
  for (const [slot, item] of Object.entries(eq)) { const c = cat.find(x => x.item_id === item); if (c) out[slot] = { id: c.item_id, nome: c.nome, ...(c.meta || {}) }; }
  return out;
}
app.get('/api/loja', auth, async (req, res) => {
  try {
    const [cat, own, car, eq] = await Promise.all([
      catalogo(),
      sb.from('craft_itens_adquiridos').select('item_id').eq('id_jogador', req.jogadorId),
      sb.from('carteira_diamantes').select('diamantes').eq('id_jogador', req.jogadorId).maybeSingle(),
      equipadosDe(req.jogadorId),
    ]);
    res.json({ saldo: car.data?.diamantes ?? 0, catalogo: cat, adquiridos: (own.data || []).map(r => r.item_id), equipados: eq });
  } catch { res.status(500).json({ erro: 'db' }); }
});
app.post('/api/loja/comprar', auth, async (req, res) => {
  const item = String(req.body?.item_id || '');
  if (!/^[a-z0-9_]{1,40}$/.test(item)) return res.status(400).json({ erro: 'item_invalido' });
  const { data, error } = await sb.rpc('craft_comprar_item', { p_id_jogador: req.jogadorId, p_item_id: item });   // débito + registro atômicos
  if (error) {
    const erro = ['item_indisponivel', 'item_ja_adquirido', 'saldo_insuficiente'].find(k => (error.message || '').includes(k)) || 'db';
    return res.status(erro === 'db' ? 500 : 400).json({ erro });
  }
  res.json({ ok: true, saldo: data });
});
app.post('/api/loja/equipar', auth, async (req, res) => {
  try {
    const slot = req.body?.slot, item = req.body?.item_id;
    if (!['skin', 'ferramenta', 'efeito'].includes(slot)) return res.status(400).json({ erro: 'slot_invalido' });
    const eq = await equipadosDe(req.jogadorId);
    if (item === null || item === undefined) delete eq[slot];
    else {
      const cat = (await catalogo()).find(c => c.item_id === item);
      if (!cat || SLOT_TIPO[cat.tipo] !== slot) return res.status(400).json({ erro: 'item_invalido' });
      const { data } = await sb.from('craft_itens_adquiridos').select('item_id').eq('id_jogador', req.jogadorId).eq('item_id', item).maybeSingle();
      if (!data) return res.status(403).json({ erro: 'nao_adquirido' });
      eq[slot] = item;
    }
    const { error } = await sb.from('craft_progresso').upsert({ id_jogador: req.jogadorId, equipados: eq, updated_at: new Date().toISOString() }, { onConflict: 'id_jogador' });
    if (error) throw error;
    res.json({ equipados: eq });
  } catch { res.status(500).json({ erro: 'db' }); }
});

app.get('/api/salas', async (_req, res) => {
  res.json([...salas.values()].filter(s => s.publica).map(resumoSala));
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- Salas / Mapa Aberto ----------
const salas = new Map();
const carregando = new Map();
const novaSala = (base) => ({ ...base, jogadores: new Map(), mundo: { destruidos: {}, estruturas: [], proxId: 1 }, sujo: false, timers: new Map(), hostis: new Hostis(), drops: new Map(), proxDrop: 1 });
const MAPA_ABERTO = novaSala({ codigo: 'MAPA_ABERTO', nome: 'Mapa Aberto', publica: true, max: 64, seed: 20261119, dono: null });
salas.set(MAPA_ABERTO.codigo, MAPA_ABERTO);

const pubEst = (e) => { const { aut, ...r } = e; return r; };   // a lista de autorizados não vai para os clientes
const chatSala = (s, texto) => io.to(s.codigo).emit('chat', { sys: true, texto, t: Date.now() });
const pubDrop = (d) => ({ id: d.id, x: d.x, y: d.y, z: d.z, dono: d.dono, lib: Math.max(0, d.libEm - Date.now()), exp: Math.max(0, d.expiraEm - Date.now()) });
function criarDrop(s, dono, x, y, z, itens) {
  const d = { id: 'd' + (s.proxDrop++), x, y, z, dono, itens, libEm: Date.now() + LIB_MS, expiraEm: Date.now() + EXP_MS };
  s.drops.set(d.id, d); io.to(s.codigo).emit('drop:novo', pubDrop(d)); return d;
}
// Totem de Território: dentro de 25 m só o dono e os autorizados constroem, usam baús ou demolem suas peças
const totensSobre = (s, x, z) => s.mundo.estruturas.filter(t => t.tipo === 'totem' && (t.x - x) ** 2 + (t.z - z) ** 2 < RAIO_TOTEM ** 2);
const autorizado = (s, eu, t) => t.dono === eu.id || (t.aut || []).includes(eu.id) || s.dono === eu.id;
const permitido = (s, eu, x, z) => totensSobre(s, x, z).every(t => autorizado(s, eu, t));
const idMundo = (s) => (s.codigo === 'MAPA_ABERTO' ? 'mapa_aberto' : s.codigo);
const resumoSala = (s) => ({ codigo: s.codigo, nome: s.nome, jogadores: s.jogadores.size, max: s.max, publica: s.publica });
const novoCodigo = () => { let c; do { c = crypto.randomBytes(4).toString('base64').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6); } while (!c || c.length < 4 || salas.has(c)); return c; };

function agendarRespawn(s, id, quando) {
  s.mundo.destruidos[id] = quando;
  clearTimeout(s.timers.get(id));
  s.timers.set(id, setTimeout(() => {
    delete s.mundo.destruidos[id]; s.timers.delete(id); s.sujo = true;
    io.to(s.codigo).emit('recurso:estado', { id, vivo: true });
  }, Math.max(0, quando - Date.now())));
}

async function carregarMundo(s) {
  const { data } = await sb.from('craft_mundos').select('edits').eq('id', idMundo(s)).maybeSingle();
  const e = data?.edits;
  if (!e || typeof e !== 'object') return;
  const m = limpaMundo(e);
  s.mundo.estruturas = m.estruturas;
  let max = 0;
  for (const x of m.estruturas) max = Math.max(max, parseInt(x.id.slice(1), 10) || 0);
  s.mundo.proxId = Math.max(Number(e.proxId) || 1, max + 1);
  const agora = Date.now();
  for (const [id, ts] of Object.entries(m.destruidos)) if (ts > agora) agendarRespawn(s, id, ts);
}
async function salvarMundo(s) {
  const { error } = await sb.from('craft_mundos').upsert({
    id: idMundo(s), seed: s.seed,
    edits: { destruidos: s.mundo.destruidos, estruturas: s.mundo.estruturas, proxId: s.mundo.proxId },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (error) { s.sujo = true; console.error('salvarMundo', s.codigo, error.message); }
}
async function obterSala(codigo) {
  let s = salas.get(codigo);
  if (s) return s;
  if (carregando.has(codigo)) return carregando.get(codigo);
  const p = (async () => {
    const { data } = await sb.from('craft_salas').select('*').eq('codigo', codigo).maybeSingle();
    if (!data) return null;
    const n = novaSala({ codigo: data.codigo, nome: data.nome, publica: data.publica, max: data.max_jogadores, seed: Number(data.seed), dono: data.id_dono });
    await carregarMundo(n);
    salas.set(codigo, n);
    return n;
  })().finally(() => carregando.delete(codigo));
  carregando.set(codigo, p);
  return p;
}
await carregarMundo(MAPA_ABERTO);

// salvamento periódico do mundo
setInterval(() => { for (const s of salas.values()) if (s.sujo) { s.sujo = false; salvarMundo(s); } }, 20000);

// criaturas hostis: servidor autoritativo (10 Hz) — gera à noite, persegue, ataca, foge de fogueiras e some ao amanhecer
setInterval(() => {
  const noite = ehNoite(((Date.now() / 1000) % CICLO) / CICLO);
  for (const s of salas.values()) {
    if (!s.jogadores.size) { if (s.hostis.lista.size) s.hostis.limpar(); continue; }
    const est = s.mundo.estruturas;
    s.hostis.update(.1, {
      jogadores: [...s.jogadores.values()].map(j => ({ id: j.sid, x: j.x, z: j.z, vivo: j.vivo !== false })),
      fogueiras: est.filter(e => e.tipo === 'fogueira'), paredes: est.filter(e => PAREDES.has(e.tipo)), noite,
      ataque: (sid, dano, k) => io.to(sid).emit('dano', { v: dano, k }), sumiu: () => {},
    });
    io.to(s.codigo).volatile.emit('hostis', s.hostis.snapshot());
  }
}, 100);

// mochilas dropadas: expiram sozinhas
setInterval(() => {
  const agora = Date.now();
  for (const s of salas.values()) for (const d of [...s.drops.values()]) if (agora > d.expiraEm) { s.drops.delete(d.id); io.to(s.codigo).emit('drop:removido', { id: d.id }); }
}, 5000);

const taxa = (socket, chave, ms) => {
  const n = Date.now(); socket.data.t ??= {};
  if (n - (socket.data.t[chave] || 0) < ms) return false;
  socket.data.t[chave] = n; return true;
};

io.on('connection', (socket) => {
  let sala = null, eu = null;

  const sair = () => {
    if (!sala) return;
    const s = sala; sala = null;
    s.jogadores.delete(socket.id);
    socket.leave(s.codigo);
    io.to(s.codigo).emit('sala:saiu', { sid: socket.id });
    if (eu) io.to(s.codigo).emit('chat', { sys: true, texto: `${eu.nick} saiu da sala`, t: Date.now() });
    if (s.codigo !== 'MAPA_ABERTO' && s.jogadores.size === 0) {
      s.timers.forEach(clearTimeout);
      (async () => { await salvarMundo(s); salas.delete(s.codigo); })();
    }
  };

  const entrar = (s, ack) => {
    if (s.jogadores.size >= s.max) return ack?.({ erro: 'sala_cheia' });
    sair();
    sala = s;
    s.jogadores.set(socket.id, { sid: socket.id, ...eu, x: 0, y: 0, z: 0, ry: 0, kills: 0, mortes: 0, t0: Date.now(), vivo: true });
    socket.join(s.codigo);
    socket.to(s.codigo).emit('sala:entrou', { sid: socket.id, ...eu });
    socket.to(s.codigo).emit('chat', { sys: true, texto: `${eu.nick} entrou na sala`, t: Date.now() });
    ack?.({
      ok: true, sala: resumoSala(s), seed: s.seed, agora: Date.now(),
      jogadores: [...s.jogadores.values()].filter(j => j.sid !== socket.id),
      mundo: { destruidos: s.mundo.destruidos, estruturas: s.mundo.estruturas.map(pubEst) }, drops: [...s.drops.values()].map(pubDrop),
    });
  };

  socket.on('identificar', async ({ id, t } = {}, ack) => {
    if (!idValido(id) || !assinaturaOk(id, t)) return ack?.({ erro: 'nao_autorizado' });
    const { data } = await sb.from('carteira_diamantes').select('id_jogador,nick').eq('id_jogador', id).maybeSingle();
    if (!data) return ack?.({ erro: 'jogador_nao_encontrado' });
    eu = { id: data.id_jogador, nick: data.nick, cos: await cosmeticosDe(data.id_jogador).catch(() => ({})) };
    ack?.({ ok: true });
  });

  socket.on('mapa:entrar', (_, ack) => eu ? entrar(MAPA_ABERTO, ack) : ack?.({ erro: 'nao_identificado' }));

  socket.on('sala:criar', async ({ nome, publica, max } = {}, ack) => {
    if (!eu) return ack?.({ erro: 'nao_identificado' });
    const s = novaSala({
      codigo: novoCodigo(),
      nome: String(nome || `Sala de ${eu.nick}`).slice(0, 32),
      publica: !!publica,
      max: Math.floor(num(max, 8, 2, 32)),
      seed: Math.floor(Math.random() * 2147483647),
      dono: eu.id,
    });
    salas.set(s.codigo, s);
    await sb.from('craft_salas').insert({ codigo: s.codigo, nome: s.nome, id_dono: s.dono, publica: s.publica, max_jogadores: s.max, seed: s.seed });
    entrar(s, ack);
  });

  socket.on('sala:entrar', async ({ codigo } = {}, ack) => {
    if (!eu) return ack?.({ erro: 'nao_identificado' });
    const c = String(codigo || '').toUpperCase().trim();
    if (!/^[A-Z0-9]{4,8}$/.test(c)) return ack?.({ erro: 'sala_inexistente' });
    const s = await obterSala(c);
    if (!s) return ack?.({ erro: 'sala_inexistente' });
    entrar(s, ack);
  });

  socket.on('sala:sair', sair);

  // posição ~10 Hz + ferramenta equipada (f) + animação de golpe (a)
  socket.on('mover', (p) => {
    if (!sala) return;
    const j = sala.jogadores.get(socket.id); if (!j) return;
    j.x = num(p?.x, 0, -5000, 5000); j.y = num(p?.y, 0, -500, 5000); j.z = num(p?.z, 0, -5000, 5000); j.ry = num(p?.ry, 0, -1e4, 1e4);
    j.f = typeof p?.f === 'string' && ITENS_OK.has(p.f) ? p.f : 'mao';
    j.a = p?.a ? 1 : 0; j.v = num(p?.v, 100, 0, 100);
    socket.to(sala.codigo).volatile.emit('mover', { sid: socket.id, x: j.x, y: j.y, z: j.z, ry: j.ry, f: j.f, a: j.a, v: j.v });
  });

  // recurso destruído (id determinístico t#/r#/o# gerado pela seed do mundo) -> regenera depois
  socket.on('recurso:quebrar', ({ id } = {}, ack) => {
    if (!sala || !eu) return ack?.({ erro: 'fora_da_sala' });
    if (typeof id !== 'string' || !RE_RECURSO.test(id)) return ack?.({ erro: 'id_invalido' });
    if (!taxa(socket, 'quebrar', 500)) return ack?.({ erro: 'rapido_demais' });
    if (sala.mundo.destruidos[id]) return ack?.({ erro: 'ja_quebrado' });
    agendarRespawn(sala, id, Date.now() + RESPAWN_S[id[0]] * 1000);
    sala.sujo = true;
    socket.to(sala.codigo).emit('recurso:estado', { id, vivo: false });
    ack?.({ ok: true });
  });

  socket.on('construir', (d = {}, ack) => {
    if (!sala || !eu) return ack?.({ erro: 'fora_da_sala' });
    if (!PECAS_OK.has(d.tipo)) return ack?.({ erro: 'tipo_invalido' });
    if (!taxa(socket, 'construir', 200)) return ack?.({ erro: 'rapido_demais' });
    if (sala.mundo.estruturas.length >= MAX_ESTRUTURAS) return ack?.({ erro: 'limite_estruturas' });
    const j = sala.jogadores.get(socket.id);
    const e = { tipo: d.tipo, x: num(d.x, NaN, -600, 600), y: num(d.y, NaN, -50, 500), z: num(d.z, NaN, -600, 600), ry: num(d.ry, 0, -100, 100) };
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.z)) return ack?.({ erro: 'posicao_invalida' });
    if (j && Math.hypot(e.x - j.x, e.z - j.z) > 16) return ack?.({ erro: 'longe_demais' });
    for (const o of sala.mundo.estruturas) if ((o.tipo === e.tipo || (PAREDES.has(o.tipo) && PAREDES.has(e.tipo))) && (o.x - e.x) ** 2 + (o.z - e.z) ** 2 < MIN_DIST[e.tipo] ** 2 && Math.abs(o.y - e.y) < 2.5) return ack?.({ erro: 'ocupado' });
    if (!permitido(sala, eu, e.x, e.z)) return ack?.({ erro: 'territorio' });
    e.id = 'e' + (sala.mundo.proxId++); e.dono = eu.id; if (e.tipo === 'bau') e.itens = {}; if (e.tipo === 'totem') e.aut = [];
    sala.mundo.estruturas.push(e); sala.sujo = true;
    io.to(sala.codigo).emit('estrutura:nova', pubEst(e));
    ack?.({ ok: true, id: e.id });
  });

  socket.on('demolir', ({ id } = {}, ack) => {
    if (!sala || !eu) return ack?.({ erro: 'fora_da_sala' });
    const i = sala.mundo.estruturas.findIndex(e => e.id === id);
    if (i < 0) return ack?.({ erro: 'inexistente' });
    const e = sala.mundo.estruturas[i];
    const cobre = totensSobre(sala, e.x, e.z).some(t => t.dono === eu.id || (t.aut || []).includes(eu.id));   // autorizado do totem pode demolir dentro do território
    if (e.dono !== eu.id && sala.dono !== eu.id && !(cobre && e.tipo !== 'totem')) return ack?.({ erro: 'sem_permissao' });
    sala.mundo.estruturas.splice(i, 1); sala.sujo = true;
    io.to(sala.codigo).emit('estrutura:removida', { id });
    ack?.({ ok: true, tipo: e.tipo, itens: e.itens || {} });
  });

  // golpe em criatura hostil: o DANO vem da tabela do servidor (arma equipada), validado por alcance e recarga
  socket.on('atacar', ({ id } = {}, ack) => {
    if (!sala || !eu) return ack?.({ erro: 'fora_da_sala' });
    const j = sala.jogadores.get(socket.id); if (!j || j.vivo === false) return ack?.({ erro: 'morto' });
    if (!taxa(socket, 'atacar', 280)) return ack?.({ erro: 'rapido_demais' });
    const h = sala.hostis.lista.get(Number(id)); if (!h) return ack?.({ erro: 'inexistente' });
    if ((h.x - j.x) ** 2 + (h.z - j.z) ** 2 > 4.8 ** 2) return ack?.({ erro: 'longe_demais' });
    const r = sala.hostis.danificar(h.id, DANO[j.f] ?? 2);
    io.to(sala.codigo).emit('hostil:golpe', { id: h.id, por: socket.id });
    if (r?.morto) { j.kills = (j.kills || 0) + 1; io.to(sala.codigo).emit('hostil:morto', { id: h.id }); return ack?.({ ok: true, drops: r.drops }); }
    ack?.({ ok: true });
  });
  socket.on('vivo', (v) => { const j = sala?.jogadores.get(socket.id); if (j) { j.vivo = !!v; if (j.vivo) j.t0 = Date.now(); } });   // jogador morto não é alvo
  socket.on('cosmeticos:atualizar', async () => {   // relê o equipado do banco (não confia no cliente) e avisa a sala
    if (!eu) return;
    eu.cos = await cosmeticosDe(eu.id).catch(() => eu.cos || {});
    const j = sala?.jogadores.get(socket.id); if (j) j.cos = eu.cos;
    if (sala) io.to(sala.codigo).emit('cosmeticos', { sid: socket.id, cos: eu.cos });
  });

  // ---------- chat, comandos, eventos (morte/conquistas), mochilas, baús e placar ----------
  socket.on('chat', ({ texto } = {}) => {
    if (!sala || !eu || !taxa(socket, 'chat', 700)) return;
    const t = String(texto || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 160); if (!t) return;
    io.to(sala.codigo).emit('chat', { de: eu.nick, texto: t, t: Date.now() });
  });
  socket.on('cmd', ({ nome, arg } = {}) => {
    if (!sala || !eu || !taxa(socket, 'cmd', 500)) return;
    const dizer = (t, sid = socket.id) => io.to(sid).emit('chat', { sys: true, texto: t, t: Date.now() });
    if (nome === 'autorizar' || nome === 'bloquear') {
      const meus = sala.mundo.estruturas.filter(e => e.tipo === 'totem' && e.dono === eu.id);
      if (!meus.length) return dizer('Você não possui um Totem de Território nesta sala.');
      const alvo = [...sala.jogadores.values()].find(j => String(j.nick).toLowerCase() === String(arg || '').toLowerCase().trim());
      if (!alvo) return dizer('Jogador não encontrado na sala.');
      if (alvo.id === eu.id) return dizer('Você já é o dono do território.');
      for (const t of meus) { t.aut = t.aut || []; const i = t.aut.indexOf(alvo.id); if (nome === 'autorizar' && i < 0 && t.aut.length < 12) t.aut.push(alvo.id); if (nome === 'bloquear' && i >= 0) t.aut.splice(i, 1); }
      sala.sujo = true;
      dizer(nome === 'autorizar' ? `✅ ${alvo.nick} agora pode construir e usar baús no seu território.` : `⛔ ${alvo.nick} foi bloqueado no seu território.`);
      dizer(nome === 'autorizar' ? `✅ ${eu.nick} autorizou você no território dele.` : `⛔ ${eu.nick} bloqueou você no território dele.`, alvo.sid);
    } else if (nome === 'ajuda') dizer('Comandos: /autorizar <nick> · /bloquear <nick> (valem para o seu Totem de Território) · /ajuda');
    else dizer('Comando desconhecido. Use /ajuda.');
  });
  socket.on('evento', (d = {}) => {
    if (!sala || !eu || !taxa(socket, 'evento', 400)) return;
    const j = sala.jogadores.get(socket.id); if (!j) return;
    if (d.tipo === 'morte') {
      if (j.vivo === false) return;
      j.vivo = false; j.mortes = (j.mortes || 0) + 1;
      chatSala(sala, `☠ ${eu.nick} morreu ${({ fome: 'de fome ou sede', lobo: 'para um lobo sombrio', golem: 'para um golem de pedra' })[d.causa] || ''}`.trim());
      const itens = limpaInv(d.inv);
      if (Object.keys(itens).length) criarDrop(sala, eu.id, num(d.x, j.x, -600, 600), num(d.y, 0, -50, 500), num(d.z, j.z, -600, 600), itens);
    } else if (d.tipo === 'conquista' && CONQUISTAS[d.id]) {
      socket.data.conq ??= new Set(); if (socket.data.conq.has(d.id)) return; socket.data.conq.add(d.id);
      chatSala(sala, `🏆 ${eu.nick} conquistou: ${CONQUISTAS[d.id]}`);
    }
  });
  socket.on('drop:pegar', ({ id } = {}, ack) => {
    if (!sala || !eu) return ack?.({ erro: 'fora_da_sala' });
    const j = sala.jogadores.get(socket.id), d = sala.drops.get(String(id));
    if (!j || j.vivo === false) return ack?.({ erro: 'morto' });
    if (!d) return ack?.({ erro: 'inexistente' });
    if ((d.x - j.x) ** 2 + (d.z - j.z) ** 2 > 25) return ack?.({ erro: 'longe_demais' });
    if (d.dono !== eu.id && Date.now() < d.libEm) return ack?.({ erro: 'dono' });
    sala.drops.delete(d.id); io.to(sala.codigo).emit('drop:removido', { id: d.id }); ack?.({ ok: true, itens: d.itens });
  });
  const estBau = (id) => sala?.mundo.estruturas.find(x => x.id === id && x.tipo === 'bau') || null;
  const acessoBau = (id, ack) => {
    const e = eu && estBau(id), j = sala?.jogadores.get(socket.id);
    if (!e || !j) { ack?.({ erro: 'inexistente' }); return null; }
    if ((e.x - j.x) ** 2 + (e.z - j.z) ** 2 > 7 * 7) { ack?.({ erro: 'longe_demais' }); return null; }
    if (!permitido(sala, eu, e.x, e.z)) { ack?.({ erro: 'territorio' }); return null; }
    return e;
  };
  socket.on('bau:abrir', ({ id } = {}, ack) => { const e = acessoBau(id, ack); if (e) ack?.({ ok: true, itens: e.itens || {} }); });
  socket.on('bau:mover', ({ id, item, qtd, dir } = {}, ack) => {
    const e = acessoBau(id, ack); if (!e) return;
    if (!taxa(socket, 'bau', 80)) return ack?.({ erro: 'rapido_demais' });
    if (!ITENS_OK.has(item) || item === 'mao') return ack?.({ erro: 'item_invalido' });
    const q = Math.floor(num(qtd, 0, 0, 9999)); if (q < 1) return ack?.({ erro: 'qtd_invalida' });
    e.itens ??= {}; let dado = q;
    if (dir === 'dep') { if (!e.itens[item] && Object.keys(e.itens).length >= 24) return ack?.({ erro: 'cheio' }); e.itens[item] = Math.min(99999, (e.itens[item] || 0) + q); }
    else if (dir === 'ret') { dado = Math.min(e.itens[item] || 0, q); if (dado <= 0) return ack?.({ erro: 'vazio' }); e.itens[item] -= dado; if (!e.itens[item]) delete e.itens[item]; }
    else return ack?.({ erro: 'dir_invalida' });
    sala.sujo = true; io.to(sala.codigo).emit('bau:estado', { id: e.id, itens: e.itens }); ack?.({ ok: true, qtd: dado });
  });
  socket.on('placar', (_, ack) => {
    if (!sala) return ack?.([]); const agora = Date.now();
    ack?.([...sala.jogadores.values()].map(j => ({ nick: j.nick, skin: j.cos?.skin?.nome || '—', tempo: j.vivo === false ? 0 : Math.floor((agora - (j.t0 || agora)) / 1000), kills: j.kills || 0, mortes: j.mortes || 0, vivo: j.vivo !== false, eu: j.sid === socket.id })));
  });

  socket.on('disconnect', sair);
});

// grava tudo ao encerrar (deploy/restart no Render)
const encerrar = async () => { for (const s of salas.values()) if (s.sujo) await salvarMundo(s); process.exit(0); };
process.on('SIGTERM', encerrar); process.on('SIGINT', encerrar);

server.listen(PORT, () => console.log(`Craft Player ouvindo na porta ${PORT}`));
