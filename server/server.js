// Craft Player — servidor (Render): API segura p/ Supabase + salas via Socket.IO
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

app.use(express.json({ limit: '50kb' }));
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', `frame-ancestors 'self' ${ALLOWED_ORIGIN}`);
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---------- autenticação leve hub -> jogo ----------
function assinaturaOk(id, t) {
  if (!HUB_SHARED_SECRET) return true; // sem segredo configurado = modo aberto (apenas desenvolvimento)
  if (!t) return false;
  const esperado = crypto.createHmac('sha256', HUB_SHARED_SECRET).update(String(id)).digest('hex');
  const a = Buffer.from(esperado), b = Buffer.from(String(t));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const idValido = (id) => typeof id === 'string' && /^[0-9A-Za-z_-]{1,32}$/.test(id);
function auth(req, res, next) {
  const id = req.query.id, t = req.query.t;
  if (!idValido(id) || !assinaturaOk(id, t)) return res.status(401).json({ erro: 'nao_autorizado' });
  req.jogadorId = id; next();
}

// ---------- API ----------
app.get('/api/perfil', auth, async (req, res) => {
  const { data, error } = await sb.from('carteira_diamantes')
    .select('id_jogador,nick,diamantes').eq('id_jogador', req.jogadorId).maybeSingle();
  if (error) return res.status(500).json({ erro: 'db' });
  if (!data) return res.status(404).json({ erro: 'jogador_nao_encontrado' });
  // garante a linha de progresso
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
    sensibilidade: Math.min(3, Math.max(0.2, Number(c.sensibilidade) || 1)),
    invertY: !!c.invertY,
    volumeGeral: Math.min(1, Math.max(0, Number(c.volumeGeral) ?? 0.8)),
    volumeMusica: Math.min(1, Math.max(0, Number(c.volumeMusica) ?? 0.6)),
    volumeEfeitos: Math.min(1, Math.max(0, Number(c.volumeEfeitos) ?? 0.8)),
    controleTouch: ['joystick', 'dpad'].includes(c.controleTouch) ? c.controleTouch : 'joystick',
  };
  const { error } = await sb.from('craft_progresso')
    .upsert({ id_jogador: req.jogadorId, config: limpo, updated_at: new Date().toISOString() });
  if (error) return res.status(500).json({ erro: 'db' });
  res.json(limpo);
});

app.get('/api/itens', auth, async (req, res) => {
  const { data, error } = await sb.from('craft_itens_adquiridos').select('item_id,adquirido_em').eq('id_jogador', req.jogadorId);
  if (error) return res.status(500).json({ erro: 'db' });
  res.json(data);
});

app.get('/api/salas', async (_req, res) => {
  res.json([...salas.values()].filter(s => s.publica).map(resumoSala));
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- Salas / Mapa Aberto (tempo real, em memória) ----------
const salas = new Map(); // codigo -> {codigo,nome,publica,max,seed,dono,jogadores:Map}
const MAPA_ABERTO = { codigo: 'MAPA_ABERTO', nome: 'Mapa Aberto', publica: true, max: 64, seed: 20261119, dono: null, jogadores: new Map() };
salas.set(MAPA_ABERTO.codigo, MAPA_ABERTO);

const resumoSala = (s) => ({ codigo: s.codigo, nome: s.nome, jogadores: s.jogadores.size, max: s.max, publica: s.publica });
const novoCodigo = () => { let c; do { c = crypto.randomBytes(4).toString('base64').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6); } while (!c || salas.has(c)); return c; };

io.on('connection', (socket) => {
  let sala = null, eu = null;

  const sair = () => {
    if (!sala) return;
    sala.jogadores.delete(socket.id);
    socket.leave(sala.codigo);
    io.to(sala.codigo).emit('sala:saiu', { sid: socket.id });
    if (sala.codigo !== 'MAPA_ABERTO' && sala.jogadores.size === 0) salas.delete(sala.codigo);
    sala = null;
  };

  const entrar = (s, ack) => {
    if (s.jogadores.size >= s.max) return ack?.({ erro: 'sala_cheia' });
    sair();
    sala = s;
    s.jogadores.set(socket.id, { sid: socket.id, ...eu, x: 0, y: 0, z: 0, ry: 0 });
    socket.join(s.codigo);
    socket.to(s.codigo).emit('sala:entrou', { sid: socket.id, ...eu });
    ack?.({ ok: true, sala: resumoSala(s), seed: s.seed, jogadores: [...s.jogadores.values()].filter(j => j.sid !== socket.id) });
  };

  // identificação: o servidor busca nick no banco (não confia no cliente)
  socket.on('identificar', async ({ id, t }, ack) => {
    if (!idValido(id) || !assinaturaOk(id, t)) return ack?.({ erro: 'nao_autorizado' });
    const { data } = await sb.from('carteira_diamantes').select('id_jogador,nick').eq('id_jogador', id).maybeSingle();
    if (!data) return ack?.({ erro: 'jogador_nao_encontrado' });
    eu = { id: data.id_jogador, nick: data.nick };
    ack?.({ ok: true });
  });

  socket.on('mapa:entrar', (_, ack) => eu ? entrar(MAPA_ABERTO, ack) : ack?.({ erro: 'nao_identificado' }));

  socket.on('sala:criar', ({ nome, publica, max } = {}, ack) => {
    if (!eu) return ack?.({ erro: 'nao_identificado' });
    const s = {
      codigo: novoCodigo(),
      nome: String(nome || `Sala de ${eu.nick}`).slice(0, 32),
      publica: !!publica,
      max: Math.min(32, Math.max(2, Number(max) || 8)),
      seed: Math.floor(Math.random() * 2147483647),
      dono: eu.id, jogadores: new Map(),
    };
    salas.set(s.codigo, s);
    sb.from('craft_salas').insert({ codigo: s.codigo, nome: s.nome, id_dono: s.dono, publica: s.publica, max_jogadores: s.max, seed: s.seed }).then(() => {});
    entrar(s, ack);
  });

  socket.on('sala:entrar', ({ codigo } = {}, ack) => {
    if (!eu) return ack?.({ erro: 'nao_identificado' });
    const s = salas.get(String(codigo || '').toUpperCase().trim());
    if (!s) return ack?.({ erro: 'sala_inexistente' });
    entrar(s, ack);
  });

  socket.on('sala:sair', sair);

  // posição ~10 Hz vinda do cliente (validação anti-cheat vem nas próximas fases)
  socket.on('mover', (p) => {
    if (!sala) return;
    const j = sala.jogadores.get(socket.id); if (!j) return;
    const n = (v) => (Number.isFinite(v) ? Math.max(-5000, Math.min(5000, v)) : 0);
    j.x = n(p?.x); j.y = n(p?.y); j.z = n(p?.z); j.ry = n(p?.ry);
    socket.to(sala.codigo).volatile.emit('mover', { sid: socket.id, x: j.x, y: j.y, z: j.z, ry: j.ry });
  });

  socket.on('disconnect', sair);
});

server.listen(PORT, () => console.log(`Craft Player ouvindo na porta ${PORT}`));
