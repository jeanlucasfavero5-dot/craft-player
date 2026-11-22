// Craft Player — Fase 2 — UI, perfil, inventário/crafting, hotbar, modos de jogo, sincronização e salvamento
import { World, ITENS, RECEITAS, PECAS, dropsDe, detectaMobile, qualidadeAuto } from './world.js';

const $ = (s) => document.querySelector(s);
const mobile = detectaMobile();
const params = new URLSearchParams(location.search);
let jogador = { id: params.get('id') || localStorage.getItem('cp_id'), t: params.get('t') || localStorage.getItem('cp_t') || '', nick: null, diamantes: null };
let config = { qualidade: 'auto', sensibilidade: 1, invertY: false, volumeGeral: .8, volumeMusica: .6, volumeEfeitos: .8, controleTouch: 'joystick' };
let socket = null, modoAtual = null, rotuloModo = '', telaAnterior = 'inicio', emJogo = false, invAberto = false;
let inv = {}, hotbar = ['mao', null, null, null, null, null, null, null], sel = 0, stats = { vida: 100, energia: 100 }, progresso = {};
let contLocal = 1, salvando = false;

const qs = () => `?id=${encodeURIComponent(jogador.id)}&t=${encodeURIComponent(jogador.t || '')}`;
const api = async (p, opt) => { const r = await fetch(p + qs(), opt); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || r.status); return r.json(); };
const qtd = (i) => (i === 'mao' ? 1 : (inv[i] || 0));
let toastT = 0;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2200); }

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
  if (d === 'opcoes-jogo') { $('#tela-opcoes').classList.add('ativa'); $('#tela-opcoes').style.zIndex = 30; return; }
  if (d === 'sala') { ir('sala'); listarSalas(); return; }
  world.som.ativar(); ir(d);
});

// ---------- mundo ----------
const world = new World($('#cena'));
const aplicaQualidade = () => world.setQualidade(config.qualidade === 'auto' ? qualidadeAuto() : config.qualidade);
const aplicaConfig = () => { world.cfg.sensibilidade = config.sensibilidade; world.cfg.invertY = config.invertY; world.som.setVol(config.volumeGeral, config.volumeMusica, config.volumeEfeitos); };

// ---------- perfil + progresso ----------
async function carregaPerfil() {
  if (!jogador.id) { $('#p-nick').textContent = 'Sem jogador'; $('#aviso-modos').textContent = 'Abra o jogo pelo hub (faltou o id do jogador).'; return; }
  try {
    const p = await api('/api/perfil');
    jogador = { ...jogador, ...p }; localStorage.setItem('cp_id', p.id_jogador); if (jogador.t) localStorage.setItem('cp_t', jogador.t);
    $('#p-nick').textContent = p.nick; $('#p-id').textContent = p.id_jogador; $('#p-diamantes').textContent = Number(p.diamantes).toLocaleString('pt-BR');
    $('#p-avatar').textContent = (p.nick || '?')[0].toUpperCase(); $('#hud-diamantes').textContent = p.diamantes;
    config = { ...config, ...(await api('/api/config').catch(() => ({}))) };
    progresso = await api('/api/progresso').catch(() => ({}));
    if (progresso.inventario) inv = progresso.inventario;
    if (Array.isArray(progresso.hotbar) && progresso.hotbar.some(Boolean)) hotbar = progresso.hotbar.slice(0, 8);
    if (!hotbar.includes('mao') && !hotbar[0]) hotbar[0] = 'mao';
    if (progresso.stats) stats = { vida: progresso.stats.vida ?? 100, energia: progresso.stats.energia ?? 100 };
  } catch (e) { $('#p-nick').textContent = 'Offline'; $('#aviso-modos').textContent = 'Perfil indisponível (' + e.message + '). O modo Offline continua disponível.'; }
  preencheOpcoes(); aplicaConfig(); aplicaQualidade(); renderHotbar(); equipa();
}
addEventListener('message', (e) => { if (e.data?.type === 'wavecombat-user' && e.data.id) { jogador.id = String(e.data.id); jogador.t = e.data.t || ''; carregaPerfil(); } });

// ---------- opções ----------
function preencheOpcoes() {
  $('#o-qualidade').value = config.qualidade; $('#o-sens').value = config.sensibilidade; $('#o-sens-v').textContent = Number(config.sensibilidade).toFixed(1);
  $('#o-invertY').checked = !!config.invertY; $('#o-touch').value = config.controleTouch;
  $('#o-vg').value = config.volumeGeral; $('#o-vm').value = config.volumeMusica; $('#o-ve').value = config.volumeEfeitos;
  $('#info-dispositivo').textContent = mobile ? '(Mobile detectado)' : '(PC detectado)';
}
$('#o-sens').addEventListener('input', e => $('#o-sens-v').textContent = Number(e.target.value).toFixed(1));
$('#btn-salvar-opcoes').onclick = () => {
  config = { qualidade: $('#o-qualidade').value, sensibilidade: +$('#o-sens').value, invertY: $('#o-invertY').checked, controleTouch: $('#o-touch').value, volumeGeral: +$('#o-vg').value, volumeMusica: +$('#o-vm').value, volumeEfeitos: +$('#o-ve').value };
  localStorage.setItem('cp_config', JSON.stringify(config));
  aplicaConfig(); aplicaQualidade(); aplicaControlesTouch();
  if (jogador.id) api('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) }).catch(() => {});
  $('#tela-opcoes').style.zIndex = '';
  if ($('#tela-jogo').classList.contains('ativa')) $('#tela-opcoes').classList.remove('ativa'); else ir(telaAnterior || 'inicio');
};
try { config = { ...config, ...JSON.parse(localStorage.getItem('cp_config') || '{}') }; } catch { /* ignore */ }
preencheOpcoes();

// ---------- tela cheia / orientação ----------
$('#btn-tela-cheia').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
const checaOrientacao = () => $('#girar').classList.toggle('oculto', !(mobile && innerHeight > innerWidth && emJogo));
addEventListener('resize', checaOrientacao);

// ---------- hotbar / equipamento ----------
function equipa() {
  const it = hotbar[sel] || 'mao';
  world.setEquipado(it, PECAS.includes(it) ? qtd(it) : 0);
  document.querySelectorAll('#hotbar .slot').forEach((el, i) => el.classList.toggle('sel', i === sel));
  document.querySelectorAll('#inv-hotbar .slot').forEach((el, i) => el.classList.toggle('sel', i === sel));
}
function slotHTML(i) {
  const it = hotbar[i], info = it ? ITENS[it] : null, q = it && info.t !== 'ferramenta' ? qtd(it) : '';
  return `<div class="slot${i === sel ? ' sel' : ''}${it && info.t === 'peca' && !qtd(it) ? ' vazio' : ''}" data-i="${i}"><b>${i + 1}</b><span class="ic">${info ? info.ic : ''}</span><em>${q}</em></div>`;
}
function renderHotbar() {
  const h = Array.from({ length: 8 }, (_, i) => slotHTML(i)).join('');
  $('#hotbar').innerHTML = h; $('#inv-hotbar').innerHTML = h;
  if (!$('#menu-constr').classList.contains('oculto')) renderConstr();
}
function selecionaSlot(i) { sel = (i + 8) % 8; equipa(); }
for (const alvo of ['#hotbar', '#inv-hotbar']) {
  const el = $(alvo);
  el.addEventListener('pointerdown', (e) => { const s = e.target.closest('.slot'); if (!s) return; e.preventDefault(); selecionaSlot(+s.dataset.i); });
}
function colocaNaHotbar(item) {   // equipa no slot selecionado (sem perder a Mão do slot 1)
  hotbar = hotbar.map(h => (h === item ? null : h));
  let i = sel; if (hotbar[sel] === 'mao') { const l = hotbar.indexOf(null); if (l >= 0) i = l; }
  hotbar[i] = item; sel = i; renderHotbar(); equipa();
}
function autoHotbar(item) {
  const t = ITENS[item].t; if (t === 'recurso' || hotbar.includes(item)) return;
  const livre = hotbar.indexOf(null); if (livre >= 0) hotbar[livre] = item;
}
function add(item, q) {
  inv[item] = (inv[item] || 0) + q; autoHotbar(item); renderHotbar(); equipa(); if (invAberto) renderInv();
}
function consome(item, q = 1) {
  inv[item] = Math.max(0, (inv[item] || 0) - q);
  if (!inv[item]) { delete inv[item]; if (ITENS[item].t === 'peca') hotbar = hotbar.map(h => (h === item ? null : h)); }
  renderHotbar(); equipa(); if (invAberto) renderInv();
}

// ---------- inventário + crafting ----------
function renderInv() {
  const itens = Object.keys(inv).filter(k => inv[k] > 0);
  $('#inv-itens').innerHTML = itens.length ? itens.map(k => `<button class="item" data-item="${k}" title="${ITENS[k].nome}"><span class="ic">${ITENS[k].ic}</span><b>${ITENS[k].nome}</b><em>${inv[k]}</em></button>`).join('') : '<p class="vazio-msg">Mochila vazia — colete madeira e pedra.</p>';
  $('#inv-receitas').innerHTML = RECEITAS.map(r => {
    const ok = Object.entries(r.custo).every(([k, v]) => qtd(k) >= v), nome = Object.keys(r.sai).map(k => `${r.sai[k] > 1 ? r.sai[k] + '× ' : ''}${ITENS[k].nome}`).join(', ');
    const custo = Object.entries(r.custo).map(([k, v]) => `<span class="${qtd(k) >= v ? '' : 'falta'}">${v}${ITENS[k].ic}</span>`).join(' ');
    const ic = ITENS[Object.keys(r.sai)[0]].ic;
    return `<div class="receita"><span class="ic">${ic}</span><div><b>${nome}</b><small>${custo}</small></div><button class="btn mini ${ok ? 'primario' : ''}" data-craft="${r.id}" ${ok ? '' : 'disabled'}>Fabricar</button></div>`;
  }).join('');
  renderHotbar(); equipa();
}
$('#inv-itens').addEventListener('click', (e) => {
  const b = e.target.closest('[data-item]'); if (!b) return; const it = b.dataset.item, t = ITENS[it].t;
  if (t === 'recurso') return toast('Recurso de crafting — não vai na hotbar');
  colocaNaHotbar(it); renderInv();
});
$('#inv-receitas').addEventListener('click', (e) => {
  const b = e.target.closest('[data-craft]'); if (!b) return; const r = RECEITAS.find(x => x.id === b.dataset.craft); if (!r) return;
  if (!Object.entries(r.custo).every(([k, v]) => qtd(k) >= v)) return;
  for (const [k, v] of Object.entries(r.custo)) inv[k] = (inv[k] || 0) - v;
  for (const k of Object.keys(inv)) if (!inv[k]) delete inv[k];
  for (const [k, v] of Object.entries(r.sai)) add(k, v);
  world.som.coletar(); toast('Fabricado: ' + ITENS[Object.keys(r.sai)[0]].nome);
});
function abrirInv(v) {
  if (!emJogo) return; invAberto = v; if (v) toggleConstr(false);
  $('#inv').classList.toggle('oculto', !v); world.parado = v || !$('#pausa').classList.contains('oculto');
  if (v) { document.exitPointerLock?.(); renderInv(); world.pressAcao(false); }
  else if (!mobile && $('#pausa').classList.contains('oculto')) world.canvas.requestPointerLock?.();
}
$('#btn-mochila').onclick = () => abrirInv(!invAberto);
$('#btn-fechar-inv').onclick = () => abrirInv(false);

// ---------- menu de construção (tecla B / botão 🏗) ----------
function renderConstr() {
  $('#menu-constr').innerHTML = PECAS.map(k => `<button class="item${qtd(k) ? '' : ' vazio'}" data-peca="${k}"><span class="ic">${ITENS[k].ic}</span><b>${ITENS[k].nome}</b><em>${qtd(k)}</em></button>`).join('');
}
function toggleConstr(v) {
  const el = $('#menu-constr'); if (v === undefined) v = el.classList.contains('oculto');
  if (v && (!emJogo || invAberto)) return;
  el.classList.toggle('oculto', !v);
  if (v) { renderConstr(); if (!mobile) { world.parado = true; document.exitPointerLock?.(); world.pressAcao(false); } }
  else if (!mobile && emJogo && $('#pausa').classList.contains('oculto')) { world.parado = false; world.canvas.requestPointerLock?.(); }
}
$('#btn-constr').onclick = () => toggleConstr();
$('#menu-constr').addEventListener('click', (e) => {
  const b = e.target.closest('[data-peca]'); if (!b) return; const k = b.dataset.peca;
  if (!qtd(k)) { world.som.erro(); return toast('Sem peças — fabrique no inventário (E)'); }
  colocaNaHotbar(k); toggleConstr(false);
});

// ---------- HUD ----------
world.onHud = (h) => {
  const a = $('#alvo'); a.classList.toggle('oculto', !h.alvo); $('#alvo-nome').textContent = h.alvo; $('#alvo-prog').style.width = h.prog + '%';
  $('#dica').textContent = h.dica; $('#dica').classList.toggle('oculto', !h.dica);
  $('#btn-girar').classList.toggle('oculto', !h.construindo); $('#btn-demolir').classList.toggle('oculto', !h.demolivel);
};
const fmtHora = () => { const f = world.fase * 24, h = Math.floor(f), m = Math.floor((f - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
function atualizaStats() {
  $('#b-vida').style.width = stats.vida + '%'; $('#b-en').style.width = stats.energia + '%';
  $('#hud-hora').textContent = (world.fase > .25 && world.fase < .75 ? '☀️ ' : '🌙 ') + fmtHora();
}
setInterval(() => {   // sobrevivência: energia cai devagar; fogueira regenera vida/energia
  if (!emJogo || world.mode !== 'play') return;
  if (!world.parado) {
    stats.energia = Math.max(0, stats.energia - .06);
    if (world.nearFogueira) { stats.vida = Math.min(100, stats.vida + 2); stats.energia = Math.min(100, stats.energia + 1.5); }
    else if (stats.energia <= 0) stats.vida = Math.max(1, stats.vida - .5);
    else if (stats.energia > 50) stats.vida = Math.min(100, stats.vida + .1);
    $('#hud-fogo').classList.toggle('oculto', !world.nearFogueira);
  }
  atualizaStats();
}, 1000);
setInterval(() => { if (emJogo) $('#hud-hora').textContent = (world.fase > .25 && world.fase < .75 ? '☀️ ' : '🌙 ') + fmtHora(); }, 5000);

// ---------- controles touch ----------
function aplicaControlesTouch() {
  $('#touch').classList.toggle('oculto', !mobile);
  $('#stick').classList.toggle('oculto', config.controleTouch !== 'joystick');
  $('#dpad').classList.toggle('oculto', config.controleTouch !== 'dpad');
}
(function iniciaTouch() {
  const st = $('#stick'), kn = $('#knob'); let id = null;
  const mover = (t) => { const r = st.getBoundingClientRect(), R = r.width / 2; let dx = t.clientX - (r.left + R), dy = t.clientY - (r.top + R); const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; } kn.style.transform = `translate(${dx}px,${dy}px)`; world.setAnalogico(dx / R, -dy / R); };
  const zera = () => { id = null; kn.style.transform = ''; world.setAnalogico(0, 0); };
  st.addEventListener('touchstart', e => { e.preventDefault(); id = e.changedTouches[0].identifier; mover(e.changedTouches[0]); }, { passive: false });
  st.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === id) mover(t); }, { passive: false });
  st.addEventListener('touchend', zera); st.addEventListener('touchcancel', zera);
  const dir = { f: [0, 1], b: [0, -1], l: [-1, 0], r: [1, 0] };
  document.querySelectorAll('#dpad button').forEach(b => { const [x, z] = dir[b.dataset.d]; b.addEventListener('touchstart', e => { e.preventDefault(); world.setAnalogico(x, z); }, { passive: false }); b.addEventListener('touchend', () => world.setAnalogico(0, 0)); });
  const seg = (el, ini, fim) => { el.addEventListener('touchstart', e => { e.preventDefault(); ini(); }, { passive: false }); if (fim) { el.addEventListener('touchend', fim); el.addEventListener('touchcancel', fim); } };
  seg($('#btn-pulo'), () => { world.input.pulo = true; }, () => { world.input.pulo = false; });
  seg($('#btn-acao'), () => world.pressAcao(true), () => world.pressAcao(false));
  seg($('#btn-girar'), () => world.girarGhost());
  seg($('#btn-demolir'), () => world.demolirAlvo());
})();

// ---------- callbacks do mundo ----------
world.onQuebrou = (r) => {
  const d = dropsDe(r.tipo), txt = [];
  for (const [k, q] of Object.entries(d)) { add(k, q); txt.push(`+${q} ${ITENS[k].ic}`); }
  world.som.coletar(); toast(txt.join('  '));
  if (modoAtual !== 'offline') socket?.emit('recurso:quebrar', { id: r.id }, () => {});
};
world.onConstruir = (d) => {
  if (qtd(d.tipo) <= 0) return false;
  if (modoAtual === 'offline') { world.addEstrutura({ ...d, id: 'l' + contLocal++, dono: jogador.id }); consome(d.tipo); return true; }
  if (!socket?.connected) { toast('Sem conexão com a sala'); return false; }
  consome(d.tipo);
  socket.emit('construir', d, (r) => { if (r?.erro) { add(d.tipo, 1); toast(({ ocupado: 'Já existe uma peça aqui', longe_demais: 'Longe demais', limite_estruturas: 'Limite de estruturas da sala' })[r.erro] || 'Não foi possível construir (' + r.erro + ')'); } });
  return true;
};
world.onDemolir = (s) => {
  if (modoAtual === 'offline') { world.removerEstrutura(s.id); add(s.tipo, 1); toast('Peça recuperada'); return; }
  socket?.emit('demolir', { id: s.id }, (r) => { if (r?.ok) { add(r.tipo, 1); toast('Peça recuperada'); } else toast(r?.erro === 'sem_permissao' ? 'Só o dono pode demolir' : 'Não foi possível demolir'); });
};
world.onMove = (p) => { if (modoAtual !== 'offline') socket?.emit('mover', p); };

// ---------- salvamento (inventário, hotbar, posição, stats, mundo) ----------
function montaPayload() {
  return {
    inventario: inv, hotbar, stats,
    posicao: { x: world.pos.x, y: world.pos.y, z: world.pos.z, yaw: world.yaw, seed: world.seed },
    modo: modoAtual,
    mundo_offline: modoAtual === 'offline' ? world.estadoMundo() : undefined,
  };
}
function flashSalvo(ok) { const b = $('#btn-salvar'); b.classList.add(ok ? 'ok' : 'erro'); setTimeout(() => b.classList.remove('ok', 'erro'), 1200); }
async function salvar(manual) {
  if (!jogador.id || salvando || !emJogo) return;
  salvando = true;
  const p = montaPayload();
  if (p.mundo_offline) localStorage.setItem('cp_mundo_' + jogador.id, JSON.stringify(p.mundo_offline));
  try { await api('/api/progresso', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }); flashSalvo(true); if (manual) toast('💾 Progresso salvo'); }
  catch (e) { flashSalvo(false); if (manual) toast('Falha ao salvar: ' + e.message); }
  salvando = false;
}
setInterval(() => salvar(false), 30000);
$('#btn-salvar').onclick = () => salvar(true);
$('#btn-salvar-pausa').onclick = () => salvar(true);
const salvarSaida = () => { if (!emJogo || !jogador.id) return; try { navigator.sendBeacon('/api/progresso' + qs(), new Blob([JSON.stringify(montaPayload())], { type: 'application/json' })); } catch { /* ignore */ } };
addEventListener('beforeunload', salvarSaida);
document.addEventListener('visibilitychange', () => { if (document.hidden) salvarSaida(); });

// ---------- modos de jogo ----------
function posSalva(seed) { const p = progresso?.posicao; return p && p.seed === seed ? { x: p.x, z: p.z, yaw: p.yaw } : null; }
function entrarJogo(rotulo, seed, opts) {
  rotuloModo = rotulo; $('#hud-modo').textContent = rotulo; world.som.ativar();
  world.setPlay(seed, opts); emJogo = true; ir('jogo'); aplicaControlesTouch(); checaOrientacao(); renderHotbar(); equipa(); atualizaStats();
  if (!mobile) world.canvas.requestPointerLock?.();
}
async function sairJogo() {
  await salvar(false);
  world.setMenu(); world.limparRemotos(); world.onMove = null; world.parado = false; invAberto = false; emJogo = false;
  sessao = null; socket?.emit('sala:sair'); $('#hud-online').textContent = ''; $('#pausa').classList.add('oculto'); $('#inv').classList.add('oculto'); checaOrientacao(); ir('inicio');
}
function modoOffline() {
  modoAtual = 'offline';
  let m = progresso?.offline_save; if (!m || !m.estruturas) { try { m = JSON.parse(localStorage.getItem('cp_mundo_' + jogador.id) || 'null'); } catch { m = null; } }
  entrarJogo('Offline', 20261119, { offline: true, pos: posSalva(20261119) });
  world.aplicarMundo(m || {});
  contLocal = 1 + Math.max(0, ...(m?.estruturas || []).map(e => parseInt(String(e.id).slice(1), 10) || 0));
}
let sessao = null;   // {evento,payload} da sala atual -> usada para reentrar após queda de conexão
function reentrar() {
  if (!emJogo || !sessao) return;
  socket.emit(sessao.evento, sessao.payload, (r) => {
    if (r?.erro) { toast('Não foi possível voltar à sala (' + r.erro + ')'); sairJogo(); return; }
    world.limparRemotos(); nOnline = r.jogadores.length + 1; $('#hud-online').textContent = `👥 ${nOnline}`;
    world.aplicarMundo(r.mundo); r.jogadores.forEach(j => world.upsertRemoto(j.sid, j, j.nick)); toast('🔄 Reconectado');
  });
}
function conectar() {
  return new Promise((res, rej) => {
    if (socket?.connected) return res(socket);
    if (!jogador.id) return rej(new Error('Jogador não identificado — abra pelo hub.'));
    socket?.close(); const s = io(); socket = s; let primeira = true;
    const falha = (msg) => { if (!primeira) return; primeira = false; s.close(); if (socket === s) socket = null; rej(new Error(msg)); };
    s.on('connect_error', () => falha('Servidor indisponível'));
    s.on('connect', () => s.emit('identificar', { id: jogador.id, t: jogador.t }, (r) => {
      if (!r?.ok) return falha(r?.erro || 'falha');
      if (primeira) { primeira = false; res(s); } else reentrar();
    }));
    s.on('sala:entrou', (j) => { world.upsertRemoto(j.sid, { x: 0, y: 1.7, z: 0 }, j.nick); atualizaOnline(1); });
    s.on('sala:saiu', ({ sid }) => { world.removeRemoto(sid); atualizaOnline(-1); });
    s.on('mover', (m) => world.upsertRemoto(m.sid, m));
    s.on('recurso:estado', ({ id, vivo }) => world.setRecursoVivo(id, vivo));
    s.on('estrutura:nova', (e) => world.addEstrutura(e));
    s.on('estrutura:removida', ({ id }) => world.removerEstrutura(id));
    s.on('disconnect', () => { if (emJogo && modoAtual !== 'offline') toast('Conexão perdida — reconectando…'); });
  });
}
let nOnline = 0; const atualizaOnline = (d) => { nOnline = Math.max(1, nOnline + d); $('#hud-online').textContent = `👥 ${nOnline}`; };
async function entrarOnline(evento, payload, rotulo, aviso, chaveModo) {
  try {
    await conectar();
    socket.emit(evento, payload, (r) => {
      if (r?.erro) { $(aviso).textContent = ({ sala_cheia: 'Sala cheia.', sala_inexistente: 'Sala não encontrada.' })[r.erro] || r.erro; return; }
      modoAtual = chaveModo; sessao = r.sala.codigo === 'MAPA_ABERTO' ? { evento: 'mapa:entrar', payload: {} } : { evento: 'sala:entrar', payload: { codigo: r.sala.codigo } }; nOnline = r.jogadores.length + 1; $('#hud-online').textContent = `👥 ${nOnline}`;
      const salvaOk = chaveModo === 'mapa' ? posSalva(r.seed) : null;
      entrarJogo(rotulo + (r.sala.codigo !== 'MAPA_ABERTO' ? ` · ${r.sala.codigo}` : ''), r.seed, { offline: false, agora: r.agora, pos: salvaOk });
      world.aplicarMundo(r.mundo);
      r.jogadores.forEach(j => world.upsertRemoto(j.sid, j, j.nick));
    });
  } catch (e) { $(aviso).textContent = e.message; }
}
document.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => {
  $('#aviso-modos').textContent = '';
  if (b.dataset.modo === 'offline') modoOffline(); else entrarOnline('mapa:entrar', {}, 'Mapa Aberto', '#aviso-modos', 'mapa');
});
$('#btn-criar').onclick = () => entrarOnline('sala:criar', { nome: $('#s-nome').value.trim(), max: +$('#s-max').value, publica: $('#s-publica').checked }, 'Sala', '#aviso-sala', 'sala');
$('#btn-entrar').onclick = () => { const c = $('#s-codigo').value.trim().toUpperCase(); if (c.length < 4) return $('#aviso-sala').textContent = 'Digite o código.'; entrarOnline('sala:entrar', { codigo: c }, 'Sala', '#aviso-sala', 'sala'); };
async function listarSalas() {
  try {
    const l = await (await fetch('/api/salas')).json();
    $('#lista-salas').innerHTML = l.filter(s => s.codigo !== 'MAPA_ABERTO').map(s => `<li><span>${s.nome.replace(/[<>&"]/g, '')} · ${s.jogadores}/${s.max}</span><button class="btn mini" data-cod="${s.codigo}">Entrar</button></li>`).join('') || '<li>Nenhuma sala pública.</li>';
    document.querySelectorAll('[data-cod]').forEach(b => b.onclick = () => entrarOnline('sala:entrar', { codigo: b.dataset.cod }, 'Sala', '#aviso-sala', 'sala'));
  } catch { $('#lista-salas').innerHTML = '<li>Falha ao listar.</li>'; }
}
$('#btn-atualizar').onclick = listarSalas;

// ---------- pausa / teclado ----------
const pausar = (v) => {
  if (invAberto && v) return;
  world.parado = v; $('#pausa').classList.toggle('oculto', !v); if (v) { document.exitPointerLock?.(); world.pressAcao(false); }
};
$('#btn-pausa').onclick = () => pausar(true);
$('#btn-continuar').onclick = () => { pausar(false); if (!mobile) world.canvas.requestPointerLock?.(); };
$('#btn-sair').onclick = sairJogo;
addEventListener('keydown', (e) => {
  if (!emJogo || e.target.closest?.('input,select,textarea')) return;
  if (e.code === 'Escape') { if (!$('#menu-constr').classList.contains('oculto')) toggleConstr(false); else if (invAberto) abrirInv(false); else if (!$('#tela-opcoes').classList.contains('ativa')) pausar(!world.parado); return; }
  if (e.code === 'KeyE') { if ($('#pausa').classList.contains('oculto')) abrirInv(!invAberto); return; }
  if (e.code === 'KeyB') { if (!invAberto && $('#pausa').classList.contains('oculto')) toggleConstr(); return; }
  if (e.code === 'KeyG') { salvar(true); return; }
  const m = /^Digit([1-8])$/.exec(e.code); if (m && !invAberto && !world.parado) selecionaSlot(+m[1] - 1);
});
addEventListener('wheel', (e) => { if (emJogo && !world.parado && !invAberto) selecionaSlot(sel + (e.deltaY > 0 ? 1 : -1)); }, { passive: true });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && emJogo && !world.parado && !mobile) pausar(true); });

aplicaControlesTouch(); aplicaQualidade(); aplicaConfig(); renderHotbar(); carregaPerfil();
