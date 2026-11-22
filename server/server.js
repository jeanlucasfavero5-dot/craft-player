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
const ITENS_OK = new Set(['mao', 'madeira', 'tabua', 'pedra', 'ferro', 'diamante', 'machado_pedra', 'picareta_pedra', 'picareta_ferro', 'fogueira', 'fundacao', 'parede', 'rampa', 'bancada']);
const LEGADO = { tronco: 'madeira', cristal: 'diamante' };   // migra saves da Fase 2 (nomes antigos)
const PECAS_OK = new Set(['fundacao', 'parede', 'rampa', 'bancada', 'fogueira']);
const MIN_DIST = { fundacao: 3.4, parede: .6, rampa: 3, bancada: 1.3, fogueira: 1.3 };   // mesma regra do cliente: evita peças sobrepostas
const RESPAWN_S = { t: 180, r: 120, o: 300 };           // árvore, rocha, minério
const MAX_ESTRUTURAS = 600;
const RE_RECURSO = /^[tro]\d{1,4}$/;
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
function limpaEstruturas(arr) {
  const r = [];
  if (!Array.isArray(arr)) return r;
  for (const e of arr.slice(0, MAX_ESTRUTURAS)) {
    if (!e || !PECAS_OK.has(e.tipo) || typeof e.id !== 'string' || !RE_ESTR.test(e.id)) continue;
    r.push({ id: e.id, tipo: e.tipo, x: num(e.x, 0, -600, 600), y: num(e.y, 0, -50, 500), z: num(e.z, 0, -600, 600), ry: num(e.ry, 0, -100, 100), dono: typeof e.dono === 'string' ? e.dono.slice(0, 32) : null });
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
  const { data, error } = await sb.from('craft_progresso').select('inventario,hotbar,posicao,stats,offline_save,ultimo_modo').eq('id_jogador', req.jogadorId).maybeSingle();
  if (error) return res.status(500).json({ erro: 'db' });
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
    stats: { vida: num(b.stats?.vida, 100, 0, 100), energia: num(b.stats?.energia, 100, 0, 100) },
    updated_at: new Date().toISOString(),
  };
  if (modos[b.modo]) linha.ultimo_modo = modos[b.modo];
  if (b.mundo_offline) linha.offline_save = limpaMundo(b.mundo_offline);
  const { error } = await sb.from('craft_progresso').upsert(linha, { onConflict: 'id_jogador' });
  if (error) return res.status(500).json({ erro: 'db' });
  res.json({ ok: true });
}
app.put('/api/progresso', auth, salvarProgresso);
app.post('/api/progresso', auth, salvarProgresso);   // usado por navigator.sendBeacon ao fechar a aba

app.get('/api/salas', async (_req, res) => {
  res.json([...salas.values()].filter(s => s.publica).map(resumoSala));
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- Salas / Mapa Aberto ----------
const salas = new Map();
const carregando = new Map();
const novaSala = (base) => ({ ...base, jogadores: new Map(), mundo: { destruidos: {}, estruturas: [], proxId: 1 }, sujo: false, timers: new Map() });
const MAPA_ABERTO = novaSala({ codigo: 'MAPA_ABERTO', nome: 'Mapa Aberto', publica: true, max: 64, seed: 20261119, dono: null });
salas.set(MAPA_ABERTO.codigo, MAPA_ABERTO);

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
    if (s.codigo !== 'MAPA_ABERTO' && s.jogadores.size === 0) {
      s.timers.forEach(clearTimeout);
      (async () => { await salvarMundo(s); salas.delete(s.codigo); })();
    }
  };

  const entrar = (s, ack) => {
    if (s.jogadores.size >= s.max) return ack?.({ erro: 'sala_cheia' });
    sair();
    sala = s;
    s.jogadores.set(socket.id, { sid: socket.id, ...eu, x: 0, y: 0, z: 0, ry: 0 });
    socket.join(s.codigo);
    socket.to(s.codigo).emit('sala:entrou', { sid: socket.id, ...eu });
    ack?.({
      ok: true, sala: resumoSala(s), seed: s.seed, agora: Date.now(),
      jogadores: [...s.jogadores.values()].filter(j => j.sid !== socket.id),
      mundo: { destruidos: s.mundo.destruidos, estruturas: s.mundo.estruturas },
    });
  };

  socket.on('identificar', async ({ id, t } = {}, ack) => {
    if (!idValido(id) || !assinaturaOk(id, t)) return ack?.({ erro: 'nao_autorizado' });
    const { data } = await sb.from('carteira_diamantes').select('id_jogador,nick').eq('id_jogador', id).maybeSingle();
    if (!data) return ack?.({ erro: 'jogador_nao_encontrado' });
    eu = { id: data.id_jogador, nick: data.nick };
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
    j.a = p?.a ? 1 : 0;
    socket.to(sala.codigo).volatile.emit('mover', { sid: socket.id, x: j.x, y: j.y, z: j.z, ry: j.ry, f: j.f, a: j.a });
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
    for (const o of sala.mundo.estruturas) if (o.tipo === e.tipo && (o.x - e.x) ** 2 + (o.z - e.z) ** 2 < MIN_DIST[e.tipo] ** 2 && Math.abs(o.y - e.y) < 2.5) return ack?.({ erro: 'ocupado' });
    e.id = 'e' + (sala.mundo.proxId++); e.dono = eu.id;
    sala.mundo.estruturas.push(e); sala.sujo = true;
    io.to(sala.codigo).emit('estrutura:nova', e);
    ack?.({ ok: true, id: e.id });
  });

  socket.on('demolir', ({ id } = {}, ack) => {
    if (!sala || !eu) return ack?.({ erro: 'fora_da_sala' });
    const i = sala.mundo.estruturas.findIndex(e => e.id === id);
    if (i < 0) return ack?.({ erro: 'inexistente' });
    const e = sala.mundo.estruturas[i];
    if (e.dono !== eu.id && sala.dono !== eu.id) return ack?.({ erro: 'sem_permissao' });
    sala.mundo.estruturas.splice(i, 1); sala.sujo = true;
    io.to(sala.codigo).emit('estrutura:removida', { id });
    ack?.({ ok: true, tipo: e.tipo });
  });

  socket.on('disconnect', sair);
});

// grava tudo ao encerrar (deploy/restart no Render)
const encerrar = async () => { for (const s of salas.values()) if (s.sujo) await salvarMundo(s); process.exit(0); };
process.on('SIGTERM', encerrar); process.on('SIGINT', encerrar);

server.listen(PORT, () => console.log(`Craft Player ouvindo na porta ${PORT}`));
