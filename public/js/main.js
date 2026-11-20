import { World, detectaMobile, qualidadeAuto } from './world.js';

const $ = (s) => document.querySelector(s);
const mobile = detectaMobile();
const params = new URLSearchParams(location.search);
let jogador = { id: params.get('id') || localStorage.getItem('cp_id'), t: params.get('t') || localStorage.getItem('cp_t') || '', nick: null, diamantes: null };
let config = { qualidade: 'auto', sensibilidade: 1, invertY: false, volumeGeral: .8, volumeMusica: .6, volumeEfeitos: .8, controleTouch: 'joystick' };
let socket = null, modoAtual = null, telaAnterior = 'inicio';

const qs = () => `?id=${encodeURIComponent(jogador.id)}&t=${encodeURIComponent(jogador.t || '')}`;
const api = async (p, opt) => { const r = await fetch(p + qs(), opt); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || r.status); return r.json(); };

// ---------- navegação ----------
function ir(nome) {
  document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
  $('#tela-' + nome).classList.add('ativa');
  if (nome !== 'jogo' && nome !== 'opcoes') telaAnterior = nome;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-ir]'); if (!b) return;
  const d = b.dataset.ir;
  if (d === 'voltar-opcoes') return ir(telaAnterior || 'inicio');
  if (d === 'opcoes-jogo') { $('#tela-opcoes').classList.add('ativa'); $('#tela-opcoes').style.zIndex = 20; return; }
  if (d === 'sala') { ir('sala'); listarSalas(); return; }
  ir(d);
});

// ---------- mundo ----------
const world = new World($('#cena'));
const aplicaQualidade = () => { const q = config.qualidade === 'auto' ? qualidadeAuto() : ({ baixa: 'baixa', media: 'media', alta: 'alta' })[config.qualidade]; world.setQualidade(q); };
const aplicaConfig = () => { world.cfg.sensibilidade = config.sensibilidade; world.cfg.invertY = config.invertY; };

// ---------- perfil ----------
async function carregaPerfil() {
  if (!jogador.id) { $('#p-nick').textContent = 'Sem jogador'; $('#aviso-modos').textContent = 'Abra o jogo pelo hub (faltou o id do jogador).'; return; }
  try {
    const p = await api('/api/perfil');
    jogador = { ...jogador, ...p }; localStorage.setItem('cp_id', p.id_jogador); if (jogador.t) localStorage.setItem('cp_t', jogador.t);
    $('#p-nick').textContent = p.nick; $('#p-id').textContent = p.id_jogador; $('#p-diamantes').textContent = Number(p.diamantes).toLocaleString('pt-BR');
    $('#p-avatar').textContent = (p.nick || '?')[0].toUpperCase(); $('#hud-diamantes').textContent = p.diamantes;
    config = { ...config, ...(await api('/api/config').catch(() => ({}))) };
  } catch (e) { $('#p-nick').textContent = 'Offline'; $('#aviso-modos').textContent = 'Perfil indisponível (' + e.message + '). O modo Offline continua disponível.'; }
  preencheOpcoes(); aplicaConfig(); aplicaQualidade();
}
// o hub também pode enviar o jogador por postMessage (iframe)
addEventListener('message', (e) => {
  if (e.data?.type === 'wavecombat-user' && e.data.id) { jogador.id = String(e.data.id); jogador.t = e.data.t || ''; carregaPerfil(); }
});

// ---------- opções ----------
function preencheOpcoes() {
  $('#o-qualidade').value = config.qualidade; $('#o-sens').value = config.sensibilidade; $('#o-sens-v').textContent = Number(config.sensibilidade).toFixed(1);
  $('#o-invertY').checked = !!config.invertY; $('#o-touch').value = config.controleTouch;
  $('#o-vg').value = config.volumeGeral; $('#o-vm').value = config.volumeMusica; $('#o-ve').value = config.volumeEfeitos;
  $('#info-dispositivo').textContent = mobile ? '(Mobile detectado)' : '(PC detectado)';
}
$('#o-sens').addEventListener('input', e => $('#o-sens-v').textContent = Number(e.target.value).toFixed(1));
$('#btn-salvar-opcoes').onclick = async () => {
  config = { qualidade: $('#o-qualidade').value, sensibilidade: +$('#o-sens').value, invertY: $('#o-invertY').checked, controleTouch: $('#o-touch').value,
    volumeGeral: +$('#o-vg').value, volumeMusica: +$('#o-vm').value, volumeEfeitos: +$('#o-ve').value };
  localStorage.setItem('cp_config', JSON.stringify(config));
  aplicaConfig(); aplicaQualidade(); aplicaControlesTouch();
  if (jogador.id) api('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) }).catch(() => {});
  $('#tela-opcoes').style.zIndex = '';
  if ($('#tela-jogo').classList.contains('ativa')) $('#tela-opcoes').classList.remove('ativa'); else ir(telaAnterior || 'inicio');
};
try { config = { ...config, ...JSON.parse(localStorage.getItem('cp_config') || '{}') }; } catch {}
preencheOpcoes();

// ---------- tela cheia / orientação ----------
$('#btn-tela-cheia').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
const checaOrientacao = () => $('#girar').classList.toggle('oculto', !(mobile && innerHeight > innerWidth && $('#tela-jogo').classList.contains('ativa')));
addEventListener('resize', checaOrientacao);

// ---------- controles touch ----------
function aplicaControlesTouch() {
  $('#touch').classList.toggle('oculto', !mobile);
  $('#stick').classList.toggle('oculto', config.controleTouch !== 'joystick');
  $('#dpad').classList.toggle('oculto', config.controleTouch !== 'dpad');
}
(function iniciaStick() {
  const st = $('#stick'), kn = $('#knob'); let id = null;
  const mover = (t) => { const r = st.getBoundingClientRect(), R = r.width / 2; let dx = t.clientX - (r.left + R), dy = t.clientY - (r.top + R); const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
    kn.style.transform = `translate(${dx}px,${dy}px)`; world.setAnalogico(dx / R, -dy / R); };
  const zera = () => { id = null; kn.style.transform = ''; world.setAnalogico(0, 0); };
  st.addEventListener('touchstart', e => { e.preventDefault(); id = e.changedTouches[0].identifier; mover(e.changedTouches[0]); }, { passive: false });
  st.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === id) mover(t); }, { passive: false });
  st.addEventListener('touchend', zera); st.addEventListener('touchcancel', zera);
  const dir = { f: [0, 1], b: [0, -1], l: [-1, 0], r: [1, 0] };
  document.querySelectorAll('#dpad button').forEach(b => {
    const [x, z] = dir[b.dataset.d];
    b.addEventListener('touchstart', e => { e.preventDefault(); world.setAnalogico(x, z); }, { passive: false });
    b.addEventListener('touchend', () => world.setAnalogico(0, 0));
  });
  const pulo = $('#btn-pulo');
  pulo.addEventListener('touchstart', e => { e.preventDefault(); world.input.pulo = true; }, { passive: false });
  pulo.addEventListener('touchend', () => world.input.pulo = false);
})();

// hotbar placeholder (inventário real na Fase 2)
$('#hotbar').innerHTML = Array.from({ length: 9 }, (_, i) => `<div class="${i === 0 ? 'sel' : ''}">${i + 1}</div>`).join('');

// ---------- modos de jogo ----------
function entrarJogo(rotulo, seed) {
  modoAtual = rotulo; $('#hud-modo').textContent = rotulo; world.setPlay(seed); ir('jogo'); aplicaControlesTouch(); checaOrientacao();
  if (!mobile) world.canvas.requestPointerLock?.();
}
function sairJogo() {
  world.setMenu(); world.limparRemotos(); world.onMove = null; world.parado = false;
  if (modoAtual === 'offline') salvarOffline();
  socket?.emit('sala:sair'); $('#hud-online').textContent = ''; $('#pausa').classList.add('oculto'); ir('inicio');
}

// Offline: salva local (e sincroniza com o Supabase na Fase 2 via craft_progresso.offline_save)
function salvarOffline() { localStorage.setItem('cp_offline_' + (jogador.id || 'anon'), JSON.stringify({ pos: world.pos.toArray(), yaw: world.yaw, t: Date.now() })); }
function modoOffline() {
  const s = JSON.parse(localStorage.getItem('cp_offline_' + (jogador.id || 'anon')) || 'null');
  entrarJogo('Offline', 20261119);
  if (s) { world.pos.fromArray(s.pos); world.yaw = s.yaw; }
}

// Online
function conectar() {
  return new Promise((res, rej) => {
    if (socket?.connected) return res(socket);
    if (!jogador.id) return rej(new Error('Jogador não identificado — abra pelo hub.'));
    socket = io();
    socket.on('connect_error', () => rej(new Error('Servidor indisponível')));
    socket.on('connect', () => socket.emit('identificar', { id: jogador.id, t: jogador.t }, (r) => r?.ok ? res(socket) : rej(new Error(r?.erro || 'falha'))));
    socket.on('sala:entrou', (j) => world.upsertRemoto(j.sid, { x: 0, y: 0, z: 0 }));
    socket.on('sala:saiu', ({ sid }) => { world.removeRemoto(sid); atualizaOnline(-1); });
    socket.on('mover', (m) => world.upsertRemoto(m.sid, m));
  });
}
let nOnline = 0; const atualizaOnline = (d) => { nOnline = Math.max(1, nOnline + d); $('#hud-online').textContent = `👥 ${nOnline}`; };
async function entrarOnline(evento, payload, rotulo, aviso) {
  try {
    await conectar();
    socket.emit(evento, payload, (r) => {
      if (r?.erro) { $(aviso).textContent = ({ sala_cheia: 'Sala cheia.', sala_inexistente: 'Sala não encontrada.' })[r.erro] || r.erro; return; }
      nOnline = r.jogadores.length + 1; $('#hud-online').textContent = `👥 ${nOnline}`;
      entrarJogo(rotulo + (r.sala.codigo !== 'MAPA_ABERTO' ? ` · ${r.sala.codigo}` : ''), r.seed);
      r.jogadores.forEach(j => world.upsertRemoto(j.sid, j));
      world.onMove = (p) => socket.emit('mover', p);
    });
  } catch (e) { $(aviso).textContent = e.message; }
}
document.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => {
  $('#aviso-modos').textContent = '';
  if (b.dataset.modo === 'offline') modoOffline();
  else entrarOnline('mapa:entrar', {}, 'Mapa Aberto', '#aviso-modos');
});
$('#btn-criar').onclick = () => entrarOnline('sala:criar', { nome: $('#s-nome').value.trim(), max: +$('#s-max').value, publica: $('#s-publica').checked }, 'Sala', '#aviso-sala');
$('#btn-entrar').onclick = () => { const c = $('#s-codigo').value.trim().toUpperCase(); if (c.length < 4) return $('#aviso-sala').textContent = 'Digite o código.'; entrarOnline('sala:entrar', { codigo: c }, 'Sala', '#aviso-sala'); };
async function listarSalas() {
  try {
    const l = await (await fetch('/api/salas')).json();
    $('#lista-salas').innerHTML = l.filter(s => s.codigo !== 'MAPA_ABERTO').map(s => `<li><span>${s.nome.replace(/[<>&]/g, '')} · ${s.jogadores}/${s.max}</span><button class="btn mini" data-cod="${s.codigo}">Entrar</button></li>`).join('') || '<li>Nenhuma sala pública.</li>';
    document.querySelectorAll('[data-cod]').forEach(b => b.onclick = () => entrarOnline('sala:entrar', { codigo: b.dataset.cod }, 'Sala', '#aviso-sala'));
  } catch { $('#lista-salas').innerHTML = '<li>Falha ao listar.</li>'; }
}
$('#btn-atualizar').onclick = listarSalas;

// ---------- pausa ----------
const pausar = (v) => { world.parado = v; $('#pausa').classList.toggle('oculto', !v); if (v) document.exitPointerLock?.(); };
$('#btn-pausa').onclick = () => pausar(true);
$('#btn-continuar').onclick = () => { pausar(false); if (!mobile) world.canvas.requestPointerLock?.(); };
$('#btn-sair').onclick = sairJogo;
addEventListener('keydown', (e) => { if (e.code === 'Escape' && $('#tela-jogo').classList.contains('ativa')) pausar(!world.parado); });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && $('#tela-jogo').classList.contains('ativa') && !world.parado && !mobile) pausar(true); });
addEventListener('beforeunload', () => { if (modoAtual === 'offline') salvarOffline(); });

aplicaControlesTouch();
aplicaQualidade();
carregaPerfil();
