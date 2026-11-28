// Craft Player — Fase 3 — simulação das criaturas hostis noturnas.
// Módulo compartilhado (sem THREE/DOM): roda no SERVIDOR (autoritativo nas salas online) e no CLIENTE (modo offline).
export const CICLO = 720;                                           // segundos por dia completo (igual ao mundo)
export const elevSol = (fase) => Math.sin(fase * Math.PI * 2 - Math.PI / 2);
export const ehNoite = (fase) => elevSol(fase) < -.06;

export const TIPOS_HOSTIL = {
  lobo:  { nome: 'Lobo Sombrio',   hp: 30, vel: 5.4, fuga: 6.4, dano: 7,  alcance: 1.8, recarga: 1.0, deteccao: 32, drops: { carne_crua: 1 } },
  golem: { nome: 'Golem de Pedra', hp: 70, vel: 2.7, fuga: 3.2, dano: 14, alcance: 2.3, recarga: 1.9, deteccao: 26, drops: { pedra: 3 } },
};
export const ARMAS = new Set(['espada_madeira', 'espada_pedra', 'espada_ferro']);
// dano por item equipado (o servidor usa esta tabela — o cliente não escolhe o dano)
export const DANO = { mao: 2, machado_pedra: 4, picareta_pedra: 3, picareta_ferro: 4, espada_madeira: 6, espada_pedra: 9, espada_ferro: 14 };
export const RAIO_FOGUEIRA = 9;
const MAXR = 215;

export class Hostis {
  constructor(rnd = Math.random) { this.lista = new Map(); this.prox = 1; this.rnd = rnd; this.tSpawn = 2; }
  limpar() { this.lista.clear(); this.tSpawn = 2; }

  #bloqueado(x, z, paredes) {
    for (const p of paredes) {
      const dx = x - p.x, dz = z - p.z; if (dx * dx + dz * dz > 9) continue;
      const c = Math.cos(p.ry), s = Math.sin(p.ry), lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) < 2.2 && Math.abs(lz) < .65 && (p.tipo !== 'porta' || Math.abs(lx) > .9)) return true;   // porta: só os batentes bloqueiam
    }
    return false;
  }

  // ctx: { jogadores:[{id,x,z,vivo}], fogueiras:[{x,z}], paredes:[{x,z,ry}], noite:boolean, ataque(id,dano,k), sumiu(h,longe) }
  update(dt, ctx) {
    const { jogadores, fogueiras, paredes, noite, ataque, sumiu } = ctx;
    const vivos = jogadores.filter(j => j.vivo !== false);
    this.tSpawn -= dt;

    // geração noturna perto dos jogadores (nunca dentro do raio de uma fogueira)
    if (noite && vivos.length && this.lista.size < Math.min(10, 2 + vivos.length * 2) && this.tSpawn <= 0) {
      this.tSpawn = 3 + this.rnd() * 2;
      const j = vivos[Math.floor(this.rnd() * vivos.length)], ang = this.rnd() * 6.283, d = 26 + this.rnd() * 14;
      const x = j.x + Math.cos(ang) * d, z = j.z + Math.sin(ang) * d;
      const perto = fogueiras.some(f => (f.x - x) ** 2 + (f.z - z) ** 2 < (RAIO_FOGUEIRA + 4) ** 2);
      if (x * x + z * z < MAXR * MAXR && !perto) {
        const k = this.rnd() < .72 ? 'lobo' : 'golem', T = TIPOS_HOSTIL[k], id = this.prox++;
        this.lista.set(id, { id, k, x, z, ry: 0, hp: T.hp, hpMax: T.hp, cd: 1, estado: 0, atk: 0, tx: x, tz: z, tw: 0 });
      }
    }

    for (const h of this.lista.values()) {
      const T = TIPOS_HOSTIL[h.k]; h.atk = Math.max(0, h.atk - dt * 3); h.cd -= dt;
      if (!noite) h.hp -= 12 * dt;                                   // amanhecer: enfraquecem e desaparecem

      let fx = 0, fz = 0, perto = false;                             // fogueira acesa: fogem e perdem vida
      for (const f of fogueiras) {
        const dx = h.x - f.x, dz = h.z - f.z, d2 = dx * dx + dz * dz;
        if (d2 < RAIO_FOGUEIRA ** 2) { perto = true; const l = Math.sqrt(d2) || 1; fx += dx / l; fz += dz / l; }
      }
      if (perto) h.hp -= 3 * dt;
      if (h.hp <= 0) { this.lista.delete(h.id); sumiu?.(h); continue; }

      let alvo = null, bd = T.deteccao ** 2;
      for (const j of vivos) { const dx = j.x - h.x, dz = j.z - h.z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; alvo = j; } }

      let mx = 0, mz = 0, vel = 0;
      if (perto) { const l = Math.hypot(fx, fz) || 1; mx = fx / l; mz = fz / l; vel = T.fuga; h.estado = 2; }
      else if (alvo && noite) {
        const dx = alvo.x - h.x, dz = alvo.z - h.z, d = Math.sqrt(bd) || 1;
        h.ry = Math.atan2(dx, dz);
        if (d > T.alcance * .8) { mx = dx / d; mz = dz / d; vel = T.vel; h.estado = 1; }
        else { h.estado = 3; if (h.cd <= 0) { h.cd = T.recarga; h.atk = 1; ataque?.(alvo.id, T.dano, h.k); } }
      } else if (!noite) {
        h.estado = 2;
        if (alvo) { const dx = h.x - alvo.x, dz = h.z - alvo.z, l = Math.hypot(dx, dz) || 1; mx = dx / l; mz = dz / l; vel = T.fuga * .6; }
      } else {
        h.tw -= dt;
        if (h.tw <= 0) { h.tw = 2 + this.rnd() * 3; const a = this.rnd() * 6.283; h.tx = h.x + Math.cos(a) * 8; h.tz = h.z + Math.sin(a) * 8; }
        const dx = h.tx - h.x, dz = h.tz - h.z, d = Math.hypot(dx, dz);
        if (d > 1) { mx = dx / d; mz = dz / d; vel = T.vel * .35; }
        h.estado = 0;
      }

      if (vel) {
        const nx = h.x + mx * vel * dt, nz = h.z + mz * vel * dt;
        if (!this.#bloqueado(nx, nz, paredes) && nx * nx + nz * nz < MAXR * MAXR) { h.x = nx; h.z = nz; }
        else if (!this.#bloqueado(nx, h.z, paredes)) h.x = nx;
        else if (!this.#bloqueado(h.x, nz, paredes)) h.z = nz;
        if (h.estado !== 1 && h.estado !== 3) h.ry = Math.atan2(mx, mz);
      }

      if (!vivos.some(j => (j.x - h.x) ** 2 + (j.z - h.z) ** 2 < 110 * 110)) { this.lista.delete(h.id); sumiu?.(h, true); }
    }
  }

  danificar(id, dano) {
    const h = this.lista.get(id); if (!h) return null;
    h.hp -= dano; if (h.estado !== 2) h.estado = 1;
    if (h.hp <= 0) { this.lista.delete(id); return { morto: true, h, drops: { ...TIPOS_HOSTIL[h.k].drops } }; }
    return { morto: false, h };
  }

  // [id, tipo(0 lobo/1 golem), x, z, ry, hp, estado(0 vaga/1 persegue/2 foge/3 ataca), atk, hpMax]
  snapshot() {
    return [...this.lista.values()].map(h => [h.id, h.k === 'lobo' ? 0 : 1, +h.x.toFixed(2), +h.z.toFixed(2), +h.ry.toFixed(2), Math.round(h.hp), h.estado, h.atk > .5 ? 1 : 0, h.hpMax]);
  }
}
