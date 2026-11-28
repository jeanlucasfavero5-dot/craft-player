// Craft Player — Fase 2 — UI, perfil, inventário/crafting, hotbar, modos de jogo, sincronização e salvamento
import { World, ITENS, RECEITAS, PECAS, CONSUMIVEL, dropsDe, detectaMobile, qualidadeAuto } from './world.js';
import { ehNoite } from './hostis.js';

const $ = (s) => document.querySelector(s);
const mobile = detectaMobile();
const params = new URLSearchParams(location.search);
let jogador = { id: params.get('id') || localStorage.getItem('cp_id'), t: params.get('t') || localStorage.getItem('cp_t') || '', nick: null, diamantes: null };
let config = { qualidade: 'auto', sensibilidade: 1, invertY: false, volumeGeral: .8, volumeMusica: .6, volumeEfeitos: .8, controleTouch: 'joystick' };
let socket = null, modoAtual = null, rotuloModo = '', telaAnterior = 'inicio', emJogo = false, invAberto = false;
let inv = {}, hotbar = ['mao', null, null, null, null, null, null, null], sel = 0, stats = { vida: 100, fome: 100, sede: 100 }, progresso = {};
let pontoRespawn = null, morto = false, loja = null, abaLoja = 'skin';
let ultimaMorte = null, conquistas = new Set(), est = { kills: 0, mortes: 0, tempo_s: 0, construcoes: 0 }, bauAtual = null;
let chatAberto = false, bauAberto = false, tutAberto = false, tutVisto = false, viveuNoite = false, t0Vida = Date.now(), killsSessao = 0, mortesSessao = 0, contDrop = 1, tempoJogo = 0;
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
const aplicaQualidade = () => { world.autoQ = config.qualidade === 'auto'; world.setQualidade(config.qualidade === 'auto' ? qualidadeAuto() : config.qualidade); };
const aplicaConfig = () => { world.cfg.sensibilidade = config.sensibilidade; world.cfg.invertY = config.invertY; world.som.setVol(config.volumeGeral, config.volumeMusica, config.volumeEfeitos); };

// ---------- perfil + progresso ----------
async function carregaPerfil() {
  if (!jogador.id) { $('#p-nick').textContent = 'Sem jogador'; $('#aviso-modos').textContent = 'Abra o jogo pelo hub (faltou o id do jogador).'; return; }
  try {
    const p = await api('/api/perfil');
    jogador = { ...jogador, ...p }; world.meuId = jogador.id; localStorage.setItem('cp_id', p.id_jogador); if (jogador.t) localStorage.setItem('cp_t', jogador.t);
    $('#p-nick').textContent = p.nick; $('#p-id').textContent = p.id_jogador; $('#p-diamantes').textContent = Number(p.diamantes).toLocaleString('pt-BR');
    $('#p-avatar').textContent = (p.nick || '?')[0].toUpperCase(); $('#hud-diamantes').textContent = p.diamantes;
    config = { ...config, ...(await api('/api/config').catch(() => ({}))) };
    progresso = await api('/api/progresso').catch(() => ({}));
    if (progresso.inventario) inv = progresso.inventario;
    if (Array.isArray(progresso.hotbar) && progresso.hotbar.some(Boolean)) hotbar = progresso.hotbar.slice(0, 8);
    if (!hotbar.includes('mao') && !hotbar[0]) hotbar[0] = 'mao';
    if (progresso.stats) { const st = progresso.stats; stats = { vida: st.vida ?? 100, fome: st.fome ?? st.energia ?? 100, sede: st.sede ?? 100 }; pontoRespawn = st.respawn || null; if (stats.vida <= 0) stats.vida = 60; }
    if (Array.isArray(progresso.conquistas)) conquistas = new Set(progresso.conquistas);
    if (progresso.estatisticas) est = { ...est, ...progresso.estatisticas };
  } catch (e) { $('#p-nick').textContent = 'Offline'; $('#aviso-modos').textContent = 'Perfil indisponível (' + e.message + '). O modo Offline continua disponível.'; }
  preencheOpcoes(); aplicaConfig(); aplicaQualidade(); renderHotbar(); equipa();
  carregarLoja().then(aplicaCosmeticos).catch(() => {});
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
  const it = hotbar[i], info = it ? ITENS[it] : null, q = it && !['ferramenta', 'arma'].includes(info.t) ? qtd(it) : '';
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
  if (!inv[item]) { delete inv[item]; if (ITENS[item].t !== 'recurso') hotbar = hotbar.map(h => (h === item ? null : h)); }
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
    return `<div class="receita"><span class="ic">${ic}</span><div><b>${nome}</b><small>${custo}${r.bancada ? ' · 🛠 perto da Bancada' : ''}</small></div><button class="btn mini ${ok ? 'primario' : ''}" data-craft="${r.id}" ${ok ? '' : 'disabled'}>Fabricar</button></div>`;
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
  if (r.bancada && !world.nearBancada) { world.som.erro(); return toast('Chegue perto de uma Bancada de Trabalho'); }
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
  $('#btn-girar').classList.toggle('oculto', !h.construindo); $('#btn-demolir').classList.toggle('oculto', !h.demolivel); $('#btn-usar').classList.toggle('oculto', !h.usavel);
};
const fmtHora = () => { const f = world.fase * 24, h = Math.floor(f), m = Math.floor((f - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
// ---------- sobrevivência: vida, fome e sede ----------
const pct = (v) => Math.max(0, Math.min(100, v));
const gasta = (fome, sede) => { stats.fome = Math.max(0, stats.fome - fome); stats.sede = Math.max(0, stats.sede - sede); };
function atualizaStats() {
  $('#b-vida').style.width = pct(stats.vida) + '%'; $('#b-fome').style.width = pct(stats.fome) + '%'; $('#b-sede').style.width = pct(stats.sede) + '%';
  $('#b-vida').closest('.barra').classList.toggle('baixo', stats.vida < 25); $('#b-fome').closest('.barra').classList.toggle('baixo', stats.fome < 20); $('#b-sede').closest('.barra').classList.toggle('baixo', stats.sede < 20);
  $('#hud-hora').textContent = (world.fase > .25 && world.fase < .75 ? '☀️ ' : '🌙 ') + fmtHora();
}
function receberDano(v, fonte, flash = true) {
  if (morto || !emJogo) return;
  stats.vida = Math.max(0, stats.vida - v); world.vida = stats.vida;
  if (flash) { const fx = $('#dano-fx'); fx.classList.add('on'); setTimeout(() => fx.classList.remove('on'), 260); world.som.dano(); }
  atualizaStats(); if (stats.vida <= 0) morrer(fonte);
}
world.onDano = (v, k) => receberDano(v, k);
setInterval(() => {   // fome e sede caem mais ao andar, minerar/atacar; zeradas, drenam a vida; fogueira regenera
  if (!emJogo || world.mode !== 'play' || world.parado || morto) { if (emJogo) atualizaStats(); return; }
  const mov = world.movendo, trab = world.trabalhando;
  gasta(.05 + (mov ? .10 : 0) + (trab ? .18 : 0), .07 + (mov ? .14 : 0) + (trab ? .20 : 0));
  if (stats.fome <= 0 || stats.sede <= 0) receberDano(.8, 'fome', false);
  else if (stats.fome > 60 && stats.sede > 60) stats.vida = Math.min(100, stats.vida + .3);
  if (world.nearFogueira) stats.vida = Math.min(100, stats.vida + 1.5);
  $('#hud-fogo').classList.toggle('oculto', !world.nearFogueira);
  world.vida = stats.vida; atualizaStats();
}, 1000);

// morte e renascimento (spawn ou última fogueira/cama construída)
const pontoValido = () => !!pontoRespawn && [...world.estruturas.values()].some(s => (s.tipo === 'fogueira' || s.tipo === 'cama') && Math.hypot(s.x - pontoRespawn.x, s.z - pontoRespawn.z) < 1);
function morrer(fonte) {
  if (morto) return; morto = true; world.vivo = false; world.parado = true; world.pressAcao(false); document.exitPointerLock?.(); world.som.morrer(); droparMochila(fonte);
  $('#morte-causa').textContent = ({ fome: 'Você morreu de fome ou sede.', lobo: 'Devorado por um lobo sombrio.', golem: 'Esmagado por um golem de pedra.' })[fonte] || 'Você morreu.';
  $('#btn-renasc-fog').disabled = !pontoValido(); $('#morte').classList.remove('oculto'); $('#toast').classList.remove('on');
}
function renascer(noPonto) {
  stats = { vida: 70, fome: 60, sede: 60 }; world.vida = stats.vida; morto = false; t0Vida = Date.now(); world.vivo = true; $('#morte').classList.add('oculto');
  if (noPonto && pontoValido()) world.teleportar(pontoRespawn.x + 1.6, pontoRespawn.z, 0); else world.teleportar(0, 0, 0);
  world.parado = invAberto || lojaAberta(); socket?.emit('vivo', true); atualizaStats(); if (!mobile && !world.parado) world.canvas.requestPointerLock?.();
}
$('#btn-renasc-spawn').onclick = () => renascer(false);
$('#btn-renasc-fog').onclick = () => renascer(true);

// consumir, cozinhar, beber, encher cantil, drops e combate
world.onConsumir = (item) => {
  const c = CONSUMIVEL[item]; if (!c || qtd(item) <= 0) return; const i = hotbar.indexOf(item);
  consome(item); stats.fome = pct(stats.fome + c.fome); stats.sede = pct(stats.sede + c.sede); stats.vida = pct(stats.vida + c.vida); world.vida = stats.vida;
  if (c.volta) { add(c.volta, 1); if (!inv[item] && i >= 0) { hotbar = hotbar.map(h => (h === c.volta ? null : h)); hotbar[i] = c.volta; renderHotbar(); equipa(); } }
  toast(`${ITENS[item].ic} ${c.fome ? '+' + c.fome + ' fome ' : ''}${c.sede ? '+' + c.sede + ' sede ' : ''}${c.vida ? '+' + c.vida + ' vida' : ''}`); atualizaStats();
};
world.onCozinhar = () => { if (qtd('carne_crua') <= 0) return; consome('carne_crua'); add('carne_assada', 1); toast('🍖 Carne assada!'); };
world.onBeberAgua = () => { stats.sede = pct(stats.sede + 30); toast('💧 +30 sede'); atualizaStats(); };
world.onEncher = () => {
  if (qtd('cantil') <= 0) return; const i = hotbar.indexOf('cantil'); consome('cantil'); add('cantil_cheio', 1);
  if (!inv.cantil && i >= 0) { hotbar = hotbar.map(h => (h === 'cantil_cheio' ? null : h)); hotbar[i] = 'cantil_cheio'; renderHotbar(); equipa(); }
  toast('💧 Cantil cheio');
};
world.onDrop = (d) => { const t = []; for (const [k, q] of Object.entries(d)) { add(k, q); t.push(`+${q} ${ITENS[k].ic}`); } world.som.coletar(); toast(t.join('  ')); };
world.onAtacarHostil = (id) => socket?.emit('atacar', { id }, (r) => { if (r?.drops) { contaKill(); world.onDrop(r.drops); } });
world.onKill = () => contaKill();
const aposConstruir = (d) => { est.construcoes++; if (d.tipo === 'fogueira') conquista('primeira_fogueira'); if (d.tipo === 'bau') conquista('primeiro_bau'); if (est.construcoes >= 10) conquista('construtor'); gasta(.6, .4); if (d.tipo === 'fogueira' || d.tipo === 'cama') pontoRespawn = { x: d.x, y: d.y, z: d.z }; atualizaStats(); };

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
  seg($('#btn-usar'), () => world.usarAlvo());
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
  if (modoAtual === 'offline') { world.addEstrutura({ ...d, id: 'l' + contLocal++, dono: jogador.id }); consome(d.tipo); aposConstruir(d); return true; }
  if (!socket?.connected) { toast('Sem conexão com a sala'); return false; }
  consome(d.tipo); aposConstruir(d);
  socket.emit('construir', d, (r) => { if (r?.erro) { add(d.tipo, 1); toast(({ ocupado: 'Já existe uma peça aqui', longe_demais: 'Longe demais', limite_estruturas: 'Limite de estruturas da sala' })[r.erro] || 'Não foi possível construir (' + r.erro + ')'); } });
  return true;
};
world.onDemolir = (s) => {
  const recupera = (tipo, itens) => { add(tipo, 1); for (const [k, q] of Object.entries(itens || {})) add(k, q); toast(Object.keys(itens || {}).length ? 'Peça e itens do baú recuperados' : 'Peça recuperada'); };
  if (modoAtual === 'offline') { world.removerEstrutura(s.id); recupera(s.tipo, s.itens); return; }
  socket?.emit('demolir', { id: s.id }, (r) => { if (r?.ok) recupera(r.tipo, r.itens); else toast(r?.erro === 'sem_permissao' ? 'Só o dono (ou autorizado no Totem) pode demolir' : 'Não foi possível demolir'); });
};
world.onMove = (p) => { if (modoAtual !== 'offline') socket?.emit('mover', p); };

// ---------- salvamento (inventário, hotbar, posição, stats, mundo) ----------
function montaPayload() {
  return {
    inventario: inv, hotbar, stats: { ...stats, respawn: pontoRespawn }, conquistas: [...conquistas], estatisticas: est,
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
  world.setPlay(seed, opts); emJogo = true; ir('jogo'); aplicaControlesTouch(); checaOrientacao(); renderHotbar(); equipa(); atualizaStats(); t0Vida = Date.now(); tempoJogo = 0;
  if (localStorage.getItem('cp_tut') !== 'off' && !tutVisto) { tutVisto = true; abrirTutorial(true); } else if (!mobile) world.canvas.requestPointerLock?.();
}
async function sairJogo() {
  await salvar(false);
  world.setMenu(); world.limparRemotos(); world.onMove = null; world.parado = false; invAberto = false; emJogo = false;
  sessao = null; socket?.emit('sala:sair'); $('#hud-online').textContent = ''; $('#pausa').classList.add('oculto'); $('#inv').classList.add('oculto'); $('#morte').classList.add('oculto'); morto = false; world.vivo = true; world.limparHostis(); world.limparDrops(); ultimaMorte = null; chatAberto = bauAberto = tutAberto = false; $('#chat').classList.remove('aberto'); $('#bau').classList.add('oculto'); $('#placar').classList.add('oculto'); $('#tutorial').classList.add('oculto'); checaOrientacao(); ir('inicio');
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
    world.aplicarMundo(r.mundo); aplicaDrops(r.drops); r.jogadores.forEach(j => world.upsertRemoto(j.sid, j, j.nick, j.cos)); toast('🔄 Reconectado');
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
    s.on('sala:entrou', (j) => { world.upsertRemoto(j.sid, { x: 0, y: 1.7, z: 0 }, j.nick, j.cos); atualizaOnline(1); });
    s.on('sala:saiu', ({ sid }) => { world.removeRemoto(sid); atualizaOnline(-1); });
    s.on('mover', (m) => world.upsertRemoto(m.sid, m));
    s.on('recurso:estado', ({ id, vivo }) => world.setRecursoVivo(id, vivo));
    s.on('estrutura:nova', (e) => world.addEstrutura(e));
    s.on('estrutura:removida', ({ id }) => world.removerEstrutura(id));
    s.on('chat', msgChat);
    s.on('bau:estado', ({ id, itens }) => { const e = world.estruturas.get(id); if (e) e.itens = itens; if (bauAtual?.id === id) { bauAtual.itens = itens; renderBau(); } });
    s.on('drop:novo', (d) => { world.addDrop({ ...d, libEm: Date.now() + d.lib, expiraEm: Date.now() + d.exp }); if (d.dono === jogador.id) ultimaMorte = { x: d.x, z: d.z }; });
    s.on('drop:removido', ({ id }) => { const d = world.drops.get(id); if (d && d.dono === jogador.id) ultimaMorte = null; world.removeDrop(id); });
    s.on('dano', ({ v, k }) => receberDano(v, k));                                        // golpe de criatura hostil (servidor)
    s.on('hostis', (l) => { if (emJogo) world.setHostis(l); });                           // snapshot das criaturas hostis (10 Hz)
    s.on('hostil:golpe', ({ id, por }) => { if (por !== s.id) world.fxHostilGolpe(id); });
    s.on('cosmeticos', ({ sid, cos }) => world.setCosRemoto(sid, cos));                   // skins/efeitos equipados por outros jogadores
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
      world.aplicarMundo(r.mundo); aplicaDrops(r.drops);
      r.jogadores.forEach(j => world.upsertRemoto(j.sid, j, j.nick, j.cos));
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
  if ((invAberto || chatAberto || bauAberto || tutAberto || lojaAberta()) && v) return;
  world.parado = v; $('#pausa').classList.toggle('oculto', !v); if (v) { document.exitPointerLock?.(); world.pressAcao(false); }
};
$('#btn-pausa').onclick = () => pausar(true);
$('#btn-continuar').onclick = () => { pausar(false); if (!mobile) world.canvas.requestPointerLock?.(); };
$('#btn-sair').onclick = sairJogo;
addEventListener('keydown', (e) => {
  if (!emJogo || e.target.closest?.('input,select,textarea') || morto) return;
  if (e.code === 'Escape' && lojaAberta()) { abrirLoja(false); return; }
  if (e.code === 'Enter' || e.code === 'NumpadEnter') { if (!invAberto && !bauAberto && !tutAberto && !lojaAberta() && !pausaVisivel()) { e.preventDefault(); abrirChat(true); } return; }
  if (e.code === 'Escape' && bauAberto) { fecharBau(); return; }
  if (e.code === 'Escape' && tutAberto) { abrirTutorial(false); return; }
  if (e.code === 'KeyE' && bauAberto) { fecharBau(); return; }
  if (e.code === 'KeyL') { if (!invAberto && $('#pausa').classList.contains('oculto')) abrirLoja(!lojaAberta()); return; }
  if (e.code === 'Escape') { if (!$('#menu-constr').classList.contains('oculto')) toggleConstr(false); else if (invAberto) abrirInv(false); else if (!$('#tela-opcoes').classList.contains('ativa')) pausar(!world.parado); return; }
  if (e.code === 'KeyE') { if ($('#pausa').classList.contains('oculto')) abrirInv(!invAberto); return; }
  if (e.code === 'KeyB') { if (!invAberto && $('#pausa').classList.contains('oculto')) toggleConstr(); return; }
  if (e.code === 'KeyG') { salvar(true); return; }
  const m = /^Digit([1-8])$/.exec(e.code); if (m && !invAberto && !world.parado) selecionaSlot(+m[1] - 1);
});
addEventListener('wheel', (e) => { if (emJogo && !world.parado && !invAberto) selecionaSlot(sel + (e.deltaY > 0 ? 1 : -1)); }, { passive: true });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && emJogo && !world.parado && !mobile) pausar(true); });

// ================= Fase 4: chat, baús, minimapa, placar, mochila de morte, tutorial =================
const escHtml = (t) => String(t).replace(/[<>&"]/g, '');
const pausaVisivel = () => !$('#pausa').classList.contains('oculto');
function recalcParado() {   // um único lugar decide se o jogo está parado (inventário, chat, baú, loja, pausa, tutorial, morte)
  world.parado = invAberto || chatAberto || bauAberto || tutAberto || morto || lojaAberta() || pausaVisivel();
  if (world.parado) { world.pressAcao(false); document.exitPointerLock?.(); } else if (!mobile && emJogo) world.canvas.requestPointerLock?.();
}
world.onQualidadeAuto = (n) => toast('⚙ Qualidade ajustada automaticamente (' + ['alta', 'reduzida', 'econômica'][n] + ')');

// ---- chat da sala ----
function msgChat(m) {
  const log = $('#chat-log'), d = document.createElement('div'); d.className = 'msg' + (m.sys ? ' sys' : ''); d.dataset.t = Date.now();
  if (m.sys) d.textContent = m.texto; else { const b = document.createElement('b'); b.textContent = m.de + ': '; d.append(b, document.createTextNode(m.texto)); }
  log.append(d); while (log.children.length > 40) log.firstChild.remove(); log.scrollTop = log.scrollHeight;
}
setInterval(() => { const a = Date.now(); for (const d of $('#chat-log').children) d.classList.toggle('velho', !chatAberto && a - d.dataset.t > 9000); }, 1000);
function abrirChat(v) {
  if (!emJogo || morto || (v && (invAberto || bauAberto || lojaAberta() || tutAberto))) return;
  chatAberto = v; $('#chat').classList.toggle('aberto', v); const i = $('#chat-input');
  if (v) { i.value = ''; recalcParado(); setTimeout(() => i.focus(), 0); } else { i.blur(); recalcParado(); }
}
function enviarChat() {
  const txt = $('#chat-input').value.trim().slice(0, 160); if (!txt) return;
  if (!socket?.connected || modoAtual === 'offline') return msgChat({ sys: true, texto: 'O chat só funciona nas salas online.' });
  if (txt[0] === '/') { const [n, ...r] = txt.slice(1).split(/\s+/); socket.emit('cmd', { nome: n.toLowerCase(), arg: r.join(' ') }); } else socket.emit('chat', { texto: txt });
}
$('#chat-input').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { enviarChat(); abrirChat(false); } else if (e.key === 'Escape') abrirChat(false); });
$('#chat-enviar').onclick = () => { enviarChat(); abrirChat(false); };
$('#btn-chat').onclick = () => abrirChat(!chatAberto);

// ---- baú de madeira (inventário <-> baú, sincronizado pelo servidor) ----
const MSG_BAU = { territorio: 'Território protegido por um Totem', longe_demais: 'Chegue mais perto do baú', cheio: 'Baú cheio (24 tipos)', vazio: 'Item não está mais no baú', inexistente: 'Baú não encontrado', rapido_demais: '…' };
function renderBau() {
  const b = bauAtual?.itens || {}, btn = (k, q, a) => `<button class="item" ${a}="${k}" title="${ITENS[k].nome}"><span class="ic">${ITENS[k].ic}</span><b>${ITENS[k].nome}</b><em>${q}</em></button>`;
  $('#bau-minha').innerHTML = Object.keys(inv).filter(k => inv[k] > 0).map(k => btn(k, inv[k], 'data-dep')).join('') || '<p class="vazio-msg">Mochila vazia.</p>';
  $('#bau-itens').innerHTML = Object.keys(b).map(k => btn(k, b[k], 'data-ret')).join('') || '<p class="vazio-msg">Baú vazio.</p>';
  $('#bau-cont').textContent = `(${Object.keys(b).length}/24)`;
}
function mostrarBau() { bauAberto = true; $('#bau').classList.remove('oculto'); renderBau(); recalcParado(); }
function fecharBau() { bauAberto = false; bauAtual = null; $('#bau').classList.add('oculto'); recalcParado(); }
function abrirBau(e) {
  if (!emJogo || bauAberto) return;
  if (modoAtual === 'offline') { e.itens = e.itens || {}; bauAtual = { id: e.id, itens: e.itens, local: e }; return mostrarBau(); }
  socket?.emit('bau:abrir', { id: e.id }, (r) => { if (r?.ok) { bauAtual = { id: e.id, itens: r.itens }; mostrarBau(); } else toast(MSG_BAU[r?.erro] || 'Não foi possível abrir o baú'); });
}
world.onUsar = abrirBau;
$('#btn-fechar-bau').onclick = fecharBau;
$('#bau').addEventListener('click', (e) => {
  const dep = e.target.closest('[data-dep]'), ret = e.target.closest('[data-ret]'); if (!bauAtual || (!dep && !ret)) return;
  const tudo = $('#bau-tudo').checked;
  if (dep) {
    const k = dep.dataset.dep, q = tudo ? qtd(k) : 1; if (qtd(k) < q || q < 1) return;
    if (bauAtual.local) { const it = bauAtual.itens; if (!it[k] && Object.keys(it).length >= 24) return toast(MSG_BAU.cheio); it[k] = (it[k] || 0) + q; consome(k, q); renderBau(); return; }
    consome(k, q); socket.emit('bau:mover', { id: bauAtual.id, item: k, qtd: q, dir: 'dep' }, (r) => { if (!r?.ok) { add(k, q); toast(MSG_BAU[r?.erro] || 'Falha ao guardar'); } });
  } else {
    const k = ret.dataset.ret, q = tudo ? (bauAtual.itens[k] || 0) : 1; if (q < 1) return;
    if (bauAtual.local) { const it = bauAtual.itens; const dado = Math.min(it[k] || 0, q); it[k] -= dado; if (!it[k]) delete it[k]; add(k, dado); renderBau(); return; }
    socket.emit('bau:mover', { id: bauAtual.id, item: k, qtd: q, dir: 'ret' }, (r) => { if (r?.ok) add(k, r.qtd); else toast(MSG_BAU[r?.erro] || 'Falha ao retirar'); });
  }
});

// ---- mochila dropada ao morrer ----
function droparMochila(fonte) {
  est.mortes++; mortesSessao++; viveuNoite = false; const p = world.pos, dump = { ...inv }; ultimaMorte = { x: p.x, z: p.z };
  if (socket?.connected && modoAtual !== 'offline') socket.emit('evento', { tipo: 'morte', causa: fonte, x: p.x, y: p.y, z: p.z, inv: dump });
  else if (Object.keys(dump).length) world.addDrop({ id: 'dl' + (contDrop++), x: p.x, z: p.z, dono: jogador.id, libEm: 0, expiraEm: Date.now() + 300000, itens: dump });
  inv = {}; hotbar = ['mao', null, null, null, null, null, null, null]; sel = 0; renderHotbar(); equipa();
}
function aplicaDrops(lista) {
  world.limparDrops();
  for (const d of lista || []) { world.addDrop({ ...d, libEm: Date.now() + d.lib, expiraEm: Date.now() + d.exp }); if (d.dono === jogador.id) ultimaMorte = { x: d.x, z: d.z }; }
}
world.onPegarDrop = (d) => {
  const receber = (itens) => { for (const [k, q] of Object.entries(itens)) add(k, q); if (d.dono === jogador.id) ultimaMorte = null; toast('🎒 Mochila recuperada!'); world.som.coletar(); };
  if (String(d.id).startsWith('dl')) { receber(d.itens); world.removeDrop(d.id); return; }
  socket?.emit('drop:pegar', { id: d.id }, (r) => { if (r?.itens) receber(r.itens); });
};

// ---- conquistas ----
const NOMES_CONQ = { primeira_fogueira: 'Primeira Fogueira', primeiro_bau: 'Despenseiro', primeira_noite: 'Sobrevivente da Noite', cacador: 'Caçador (10 abates)', construtor: 'Construtor (10 peças)' };
function conquista(id) {
  if (conquistas.has(id)) return; conquistas.add(id); const online = socket?.connected && modoAtual !== 'offline';
  toast('🏆 Conquista: ' + NOMES_CONQ[id]); world.som.coletar();
  if (online) socket.emit('evento', { tipo: 'conquista', id }); else msgChat({ sys: true, texto: '🏆 Conquista: ' + NOMES_CONQ[id] });
}
function contaKill() { est.kills++; killsSessao++; if (est.kills >= 10) conquista('cacador'); }

// ---- minimapa circular + bússola ----
const mm = $('#minimapa'), mctx = mm.getContext('2d'), MMS = mobile ? 92 : 112, RAIO_MM = 60;
function desenhaMapa() {
  if (!emJogo || world.mode !== 'play') return;
  const dpr = Math.min(devicePixelRatio || 1, 2), W = MMS * dpr; if (mm.width !== W) { mm.width = mm.height = W; mm.style.width = mm.style.height = MMS + 'px'; }
  const c = mctx, R = MMS / 2, k = (R - 7) / RAIO_MM, ys = Math.sin(world.yaw), yc = Math.cos(world.yaw);
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, MMS, MMS);
  c.save(); c.beginPath(); c.arc(R, R, R - 1, 0, 7); c.clip(); c.fillStyle = 'rgba(10,18,14,.74)'; c.fillRect(0, 0, MMS, MMS);
  c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1; c.beginPath(); c.arc(R, R, (R - 7) * .5, 0, 7); c.stroke();
  const rel = (x, z) => { const dx = x - world.pos.x, dz = z - world.pos.z; return [dx * yc - dz * ys, -dx * ys - dz * yc]; };   // direita, frente
  const marca = (x, z, cor, forma, borda) => {
    const [rx, fw] = rel(x, z); let px = rx * k, py = -fw * k; const d = Math.hypot(px, py), lim = R - 8;
    if (d > lim) { if (!borda) return; px *= lim / d; py *= lim / d; const a = Math.atan2(py, px); c.save(); c.translate(R + px, R + py); c.rotate(a); c.fillStyle = cor; c.beginPath(); c.moveTo(5, 0); c.lineTo(-3, -3.5); c.lineTo(-3, 3.5); c.closePath(); c.fill(); c.restore(); return; }
    c.fillStyle = cor; c.strokeStyle = 'rgba(0,0,0,.6)';
    if (forma === 'cranio') { c.font = '12px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('☠', R + px, R + py); }
    else if (forma === 'quadrado') { c.fillRect(R + px - 3.5, R + py - 3.5, 7, 7); c.strokeRect(R + px - 3.5, R + py - 3.5, 7, 7); }
    else { c.beginPath(); c.arc(R + px, R + py, forma === 'pequeno' ? 2.2 : 3.6, 0, 7); c.fill(); if (forma !== 'pequeno') c.stroke(); }
  };
  for (const h of world.hostisMap.values()) marca(h.g.position.x, h.g.position.z, '#ff5a4a', 'pequeno', false);
  for (const a of world.remotos.values()) marca(a.g.position.x, a.g.position.z, '#7ad0ff', 'ponto', true);
  if (pontoValido()) marca(pontoRespawn.x, pontoRespawn.z, '#ff9a3a', 'quadrado', true);
  if (ultimaMorte) marca(ultimaMorte.x, ultimaMorte.z, '#ff6a5a', 'cranio', true);
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath(); c.arc(R, R, R - 1, 0, 7); c.stroke();
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(R, R - 6); c.lineTo(R - 4, R + 4); c.lineTo(R + 4, R + 4); c.closePath(); c.fill();   // você (aponta para a frente)
  const nx = R + ys * (R - 10), ny = R - yc * (R - 10); c.font = 'bold 12px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ff5a4a'; c.fillText('N', nx, ny);   // norte = -Z
}
setInterval(desenhaMapa, 125);

// ---- placar da sala (Tab / botão) ----
const fmtTempo = (s) => { const m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m}m${String(s % 60).padStart(2, '0')}s`; };
const nomeSkin = () => loja?.catalogo?.find(i => i.item_id === loja.equipados?.skin)?.nome || '—';
function atualizaPlacar() {
  const render = (rows) => { $('#placar-corpo').innerHTML = rows.sort((a, b) => b.kills - a.kills || b.tempo - a.tempo).map(r => `<tr class="${r.eu ? 'eu' : ''}${r.vivo ? '' : ' morto'}"><td>${escHtml(r.nick)}</td><td>${escHtml(r.skin)}</td><td>${fmtTempo(r.tempo)}</td><td>${r.kills}</td><td>${r.mortes}</td></tr>`).join(''); };
  if (socket?.connected && modoAtual !== 'offline') socket.emit('placar', null, (rows) => render(rows || []));
  else render([{ nick: jogador.nick || 'Você', skin: nomeSkin(), tempo: morto ? 0 : Math.floor((Date.now() - t0Vida) / 1000), kills: killsSessao, mortes: mortesSessao, vivo: !morto, eu: true }]);
}
function mostrarPlacar(v) { if (v && !emJogo) return; $('#placar').classList.toggle('oculto', !v); if (v) atualizaPlacar(); }
addEventListener('keydown', (e) => { if (e.code === 'Tab' && emJogo) { e.preventDefault(); if (!e.repeat) mostrarPlacar(true); } });
addEventListener('keyup', (e) => { if (e.code === 'Tab') mostrarPlacar(false); });
$('#btn-placar').onclick = () => mostrarPlacar($('#placar').classList.contains('oculto'));
setInterval(() => { if (!$('#placar').classList.contains('oculto')) atualizaPlacar(); }, 2000);

// ---- tutorial rápido + dicas contextuais (podem ser ocultados) ----
const TUT = mobile
  ? ['🕹 Joystick à esquerda move · arraste a tela à direita para olhar · ⤒ pula', '⛏ Mire numa árvore/pedra e segure o botão de ação para coletar', '🎒 Mochila/crafting: fabrique machado, picareta, fogueira e espadas', '🏗 Construir: escolha a peça · ⟳ gira · botão de ação coloca · 🗑 demole · ✋ abre baú', '💬 Chat · 📋 Placar · 🛒 Loja · 💾 Salvar · mapa no canto superior direito']
  : ['WASD move · Espaço pula · Mouse olha · Esc pausa', 'Segure o botão esquerdo mirando árvores/pedras para coletar', 'E abre mochila e crafting · 1–8 troca o item da hotbar', 'B menu de construção · R gira a peça · F usa baú · X demole', 'Enter chat (/ajuda) · Tab placar · G salva · L loja'];
function abrirTutorial(v) {
  tutAberto = v; $('#tutorial').classList.toggle('oculto', !v); if (v) { $('#tut-lista').innerHTML = TUT.map(t => `<li>${t}</li>`).join(''); $('#tut-nao').checked = localStorage.getItem('cp_tut') === 'off'; }
  if (emJogo) recalcParado();
}
$('#btn-tut-ok').onclick = () => { localStorage.setItem('cp_tut', $('#tut-nao').checked ? 'off' : 'on'); abrirTutorial(false); };
const dicasOn = () => localStorage.getItem('cp_dicas') !== 'off';
$('#o-dicas').checked = dicasOn(); $('#o-dicas').onchange = (e) => localStorage.setItem('cp_dicas', e.target.checked ? 'on' : 'off');
$('#btn-ver-tut').onclick = () => abrirTutorial(true);
const DICAS = [
  { id: 'coleta', quando: () => tempoJogo > 12 && !inv.madeira && !inv.pedra, texto: 'Mire numa árvore e segure o clique (ou o botão de ação) para coletar madeira 🪵' },
  { id: 'craft', quando: () => (inv.madeira || 0) >= 3 && (inv.pedra || 0) >= 2, texto: 'Pressione E (ou 🎒) para fabricar ferramentas, espada e fogueira' },
  { id: 'construir', quando: () => (inv.tabua || 0) >= 3, texto: 'Pressione B (ou 🏗) para construir. R gira a peça — comece por uma Fundação' },
  { id: 'noite', quando: () => ehNoite(world.fase), texto: 'Anoiteceu! Lobos e golens surgem — fique perto de uma fogueira e use uma espada ⚔️' },
  { id: 'fome', quando: () => stats.fome < 30, texto: 'Fome baixa: colete frutas, cace e asse a carne na fogueira 🍖' },
  { id: 'sede', quando: () => stats.sede < 30, texto: 'Sede baixa: aponte para um rio/lago e segure a ação para beber 💧' },
  { id: 'mochila', quando: () => !!ultimaMorte, texto: 'Sua mochila ficou marcada no mapa (☠) com um feixe de luz. Volte lá para recuperar os itens!' },
];
let dicaT = 0;
setInterval(() => {
  if (!emJogo || world.parado || !dicasOn()) return;
  const vistas = JSON.parse(localStorage.getItem('cp_dicas_vistas') || '[]');
  for (const d of DICAS) if (!vistas.includes(d.id) && d.quando()) {
    vistas.push(d.id); localStorage.setItem('cp_dicas_vistas', JSON.stringify(vistas));
    const el = $('#dica-ctx'); el.textContent = '💡 ' + d.texto; el.classList.remove('oculto'); clearTimeout(dicaT); dicaT = setTimeout(() => el.classList.add('oculto'), 7000); break;
  }
}, 2000);
setInterval(() => {   // tempo jogado e conquista "Sobrevivente da Noite"
  if (!emJogo || world.mode !== 'play' || world.parado || morto) return;
  tempoJogo++; est.tempo_s++;
  if (ehNoite(world.fase)) viveuNoite = true; else if (viveuNoite) { viveuNoite = false; conquista('primeira_noite'); }
}, 1000);

// ---------- loja de diamantes (WaveCombat Hub): saldo e compras validados no servidor ----------
const lojaAberta = () => $('#tela-loja').classList.contains('ativa');
const SLOT_ABA = { skin: 'skin', ferramenta: 'ferramenta', cosmetico: 'efeito' };
const MSG_LOJA = { saldo_insuficiente: 'Diamantes insuficientes', item_ja_adquirido: 'Você já tem este item', item_indisponivel: 'Item indisponível', nao_adquirido: 'Compre o item antes de equipar', nao_autorizado: 'Abra o jogo pelo hub para usar a loja' };
const post = (o) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
function atualizaDiamantes(v) { const t = Number(v).toLocaleString('pt-BR'); $('#p-diamantes').textContent = t; $('#hud-diamantes').textContent = v; $('#loja-saldo').textContent = t; jogador.diamantes = v; }
async function carregarLoja() { if (!jogador.id) throw new Error('nao_autorizado'); loja = await api('/api/loja'); atualizaDiamantes(loja.saldo); renderLoja(); return loja; }
function aplicaCosmeticos() {
  if (!loja) return; const res = {};
  for (const [slot, id] of Object.entries(loja.equipados || {})) { const c = loja.catalogo.find(x => x.item_id === id); if (c) res[slot] = { id, nome: c.nome, ...(c.meta || {}) }; }
  world.setCosmeticos(res);
}
const chips = (it) => { const m = it.meta || {}, cs = it.tipo === 'skin' ? [m.corpo, m.calca, m.pele, m.chapeu] : it.tipo === 'ferramenta' ? [m.cabeca, m.cabo] : [m.cor]; return cs.filter(Boolean).map(c => `<i style="background:${c}"></i>`).join(''); };
function renderLoja() {
  if (!loja) return;
  document.querySelectorAll('#tela-loja .aba').forEach(b => b.classList.toggle('ativa', b.dataset.aba === abaLoja));
  const itens = loja.catalogo.filter(i => i.tipo === abaLoja);
  $('#loja-grid').innerHTML = itens.length ? itens.map(it => {
    const slot = SLOT_ABA[it.tipo], tem = loja.adquiridos.includes(it.item_id), eq = loja.equipados?.[slot] === it.item_id, pode = loja.saldo >= it.preco_diamantes;
    const btn = tem ? (eq ? `<button class="btn mini ok" data-a="tirar" data-slot="${slot}">Equipado ✓ (remover)</button>` : `<button class="btn mini primario" data-a="equipar" data-id="${it.item_id}" data-slot="${slot}">Equipar</button>`)
      : `<button class="btn mini ${pode ? 'primario' : ''}" data-a="comprar" data-id="${it.item_id}" ${pode ? '' : 'disabled'}>Comprar · 💎 ${it.preco_diamantes}</button>`;
    return `<div class="loja-card r-${it.raridade}"><div class="chips">${chips(it)}</div><b>${String(it.nome).replace(/[<>&"]/g, '')}</b><small>${it.raridade}</small>${btn}</div>`;
  }).join('') : '<p class="vazio-msg">Nenhum item nesta categoria ainda.</p>';
}
$('#loja-grid').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a; $('#loja-aviso').textContent = '';
  try {
    if (a === 'comprar') { const r = await api('/api/loja/comprar', post({ item_id: b.dataset.id })); loja.saldo = r.saldo; loja.adquiridos.push(b.dataset.id); atualizaDiamantes(r.saldo); toast('✅ Item comprado!'); }
    else { const r = await api('/api/loja/equipar', post({ item_id: a === 'tirar' ? null : b.dataset.id, slot: b.dataset.slot })); loja.equipados = r.equipados; aplicaCosmeticos(); socket?.emit('cosmeticos:atualizar'); }
    renderLoja();
  } catch (err) { $('#loja-aviso').textContent = MSG_LOJA[err.message] || 'Erro na loja (' + err.message + ')'; world.som.erro(); }
});
document.querySelectorAll('#tela-loja .aba').forEach(b => b.onclick = () => { abaLoja = b.dataset.aba; renderLoja(); });
function abrirLoja(v) {
  $('#tela-loja').classList.toggle('ativa', v); $('#loja-aviso').textContent = '';
  if (v) {
    carregarLoja().catch((e) => { $('#loja-aviso').textContent = MSG_LOJA[e.message] || 'Loja indisponível (' + e.message + ')'; });
    if (emJogo) { world.parado = true; world.pressAcao(false); document.exitPointerLock?.(); }
  } else if (emJogo && !morto) {
    world.parado = invAberto || !$('#pausa').classList.contains('oculto');
    if (!world.parado && !mobile) world.canvas.requestPointerLock?.();
  }
}
$('#btn-fechar-loja').onclick = () => abrirLoja(false);
$('#btn-loja-inicio').onclick = () => { world.som.ativar(); abrirLoja(true); };
$('#btn-loja').onclick = () => abrirLoja(true);
$('#btn-loja-pausa').onclick = () => abrirLoja(true);

aplicaControlesTouch(); aplicaQualidade(); aplicaConfig(); renderHotbar(); carregaPerfil();
