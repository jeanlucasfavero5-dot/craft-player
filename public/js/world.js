// Mundo 3D realista (Fase 1: terreno orgânico, água, árvores, iluminação) + controles PC/Mobile
const THREE = window.THREE;

export function heightAt(x, z, seed = 1) {
  const s = seed * 0.0001;
  const n = Math.sin(x * .045 + s) * Math.cos(z * .04 - s) * 6 + Math.sin(x * .11 + z * .07) * 2.2 + Math.sin(z * .2 - x * .13) * .8;
  return n + 3 - Math.hypot(x, z) * .012;
}
const QUALIDADE = {
  baixa: { pr: 1, sombra: false, arvores: 60, seg: 64, far: 160 },
  media: { pr: 1.5, sombra: true, arvores: 160, seg: 110, far: 240 },
  alta:  { pr: 2, sombra: true, arvores: 320, seg: 160, far: 340 },
};
export const detectaMobile = () => matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
export const qualidadeAuto = () => (detectaMobile() ? 'baixa' : 'alta');

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(70, 1, .1, 400);
    this.mode = 'menu'; this.seed = 20261119;
    this.pos = new THREE.Vector3(0, 10, 0); this.yaw = 0; this.pitch = 0;
    this.input = { x: 0, z: 0, pulo: false }; this.vy = 0; this.noChao = true;
    this.cfg = { sensibilidade: 1, invertY: false };
    this.remotos = new Map(); this.t = 0; this.parado = false;
    this.clock = new THREE.Clock();
    this.onMove = null; this._ultEnvio = 0;
    this.#luz(); this.build('media');
    addEventListener('resize', () => this.resize()); this.resize();
    this.#eventos();
    this.r.setAnimationLoop(() => this.#loop());
  }
  resize() { const w = innerWidth, h = innerHeight; this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }

  #luz() {
    this.scene.background = new THREE.Color(0xa9cfe8);
    this.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x4a5a38, .75); this.scene.add(this.hemi);
    this.sol = new THREE.DirectionalLight(0xfff1d6, 1.25); this.sol.position.set(80, 120, 50);
    this.sol.shadow.camera.left = -70; this.sol.shadow.camera.right = 70; this.sol.shadow.camera.top = 70; this.sol.shadow.camera.bottom = -70;
    this.sol.shadow.camera.far = 300; this.sol.shadow.mapSize.set(2048, 2048); this.sol.shadow.bias = -.0004;
    this.scene.add(this.sol); this.scene.add(this.sol.target);
  }

  build(q) {
    const Q = QUALIDADE[q] || QUALIDADE.media; this.Q = Q;
    this.r.setPixelRatio(Math.min(devicePixelRatio, Q.pr));
    this.r.shadowMap.enabled = Q.sombra; this.r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.sol.castShadow = Q.sombra; this.sol.shadow.mapSize.set(Q.sombra && q === 'alta' ? 2048 : 1024, Q.sombra && q === 'alta' ? 2048 : 1024);
    this.cam.far = Q.far; this.cam.updateProjectionMatrix();
    this.scene.fog = new THREE.Fog(0xa9cfe8, Q.far * .25, Q.far * .95);
    if (this.mundo) { this.scene.remove(this.mundo); this.mundo.traverse(o => { o.geometry?.dispose(); }); }
    this.mundo = new THREE.Group(); this.scene.add(this.mundo);
    this.#terreno(Q); this.#agua(); this.#arvores(Q); this.#rochas();
  }

  #terreno(Q) {
    const g = new THREE.PlaneGeometry(500, 500, Q.seg, Q.seg); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cores = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = heightAt(x, z, this.seed); p.setY(i, h);
      const ruido = (Math.sin(x * .9) * Math.cos(z * .8)) * .04;
      if (h < .6) c.setRGB(.76 + ruido, .70 + ruido, .50);          // areia
      else if (h < 6) c.setRGB(.24 + ruido, .46 + ruido * 2, .17);   // grama
      else if (h < 9) c.setRGB(.40 + ruido, .36 + ruido, .31);       // rocha
      else c.setRGB(.92, .94, .96);                                  // neve
      cores.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cores, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0 }));
    m.receiveShadow = true; this.mundo.add(m);
  }
  #agua() {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x2b7fb0, transparent: true, opacity: .82, roughness: .15, metalness: .2 }));
    m.position.y = 0; this.agua = m; this.mundo.add(m);
  }
  #rand(i) { const x = Math.sin(i * 127.1 + this.seed) * 43758.5453; return x - Math.floor(x); }
  #organico(geo, amp) { // deforma vértices p/ visual orgânico (nada de formas perfeitas)
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 1 + (this.#rand(p.getX(i) * 31 + p.getY(i) * 17 + p.getZ(i) * 13) - .5) * amp; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
    geo.computeVertexNormals(); return geo;
  }
  #arvores(Q) {
    const tronco = new THREE.CylinderGeometry(.18, .32, 3, 7).translate(0, 1.5, 0);
    const copa = this.#organico(new THREE.IcosahedronGeometry(1.7, 1), .35).translate(0, 4, 0);
    const mt = new THREE.InstancedMesh(tronco, new THREE.MeshStandardMaterial({ color: 0x5a3d25, roughness: 1 }), Q.arvores);
    const mc = new THREE.InstancedMesh(copa, new THREE.MeshStandardMaterial({ color: 0x2f6b2a, roughness: .9 }), Q.arvores);
    const d = new THREE.Object3D(); let n = 0;
    for (let i = 0; n < Q.arvores && i < Q.arvores * 6; i++) {
      const x = (this.#rand(i * 2 + 1) - .5) * 400, z = (this.#rand(i * 2 + 2) - .5) * 400, h = heightAt(x, z, this.seed);
      if (h < 1 || h > 6.5) continue;
      const e = .8 + this.#rand(i + 99) * .9; d.position.set(x, h - .1, z); d.rotation.y = this.#rand(i) * 6.28; d.scale.set(e, e * (.9 + this.#rand(i + 5) * .5), e); d.updateMatrix();
      mt.setMatrixAt(n, d.matrix); mc.setMatrixAt(n, d.matrix); n++;
    }
    mt.count = mc.count = n; mt.castShadow = mc.castShadow = Q.sombra; mc.receiveShadow = true;
    this.mundo.add(mt, mc);
  }
  #rochas() {
    const g = this.#organico(new THREE.DodecahedronGeometry(1, 1), .5);
    const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0x777166, roughness: 1, flatShading: true }), 90);
    const d = new THREE.Object3D();
    for (let i = 0; i < 90; i++) {
      const x = (this.#rand(i * 3 + 500) - .5) * 420, z = (this.#rand(i * 3 + 501) - .5) * 420, e = .4 + this.#rand(i + 700) * 1.6;
      d.position.set(x, heightAt(x, z, this.seed) + e * .3, z); d.rotation.set(this.#rand(i), this.#rand(i + 1) * 6, 0); d.scale.set(e, e * .7, e * 1.1); d.updateMatrix(); m.setMatrixAt(i, d.matrix);
    }
    m.castShadow = this.Q.sombra; m.receiveShadow = true; this.mundo.add(m);
  }

  // ---- entrada ----
  #eventos() {
    const k = {};
    addEventListener('keydown', e => { k[e.code] = true; if (e.code === 'Space') this.input.pulo = true; this.#teclas(k); });
    addEventListener('keyup', e => { k[e.code] = false; if (e.code === 'Space') this.input.pulo = false; this.#teclas(k); });
    document.addEventListener('mousemove', e => { if (this.mode === 'play' && document.pointerLockElement === this.canvas) this.olhar(e.movementX, e.movementY, .0022); });
    this.canvas.addEventListener('click', () => { if (this.mode === 'play' && !detectaMobile() && !this.parado) this.canvas.requestPointerLock?.(); });
    // touch: arrastar na metade direita da tela para olhar
    let tid = null, lx = 0, ly = 0;
    this.canvas.addEventListener('touchstart', e => { for (const t of e.changedTouches) if (tid === null && t.clientX > innerWidth * .4) { tid = t.identifier; lx = t.clientX; ly = t.clientY; } }, { passive: true });
    this.canvas.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === tid) { this.olhar(t.clientX - lx, t.clientY - ly, .0045); lx = t.clientX; ly = t.clientY; } }, { passive: true });
    const fim = e => { for (const t of e.changedTouches) if (t.identifier === tid) tid = null; };
    this.canvas.addEventListener('touchend', fim); this.canvas.addEventListener('touchcancel', fim);
  }
  #teclas(k) { this.input.z = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0); this.input.x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0); this.tecladoAtivo = !!(this.input.x || this.input.z); }
  olhar(dx, dy, f) {
    const s = this.cfg.sensibilidade;
    this.yaw -= dx * f * s; this.pitch -= dy * f * s * (this.cfg.invertY ? -1 : 1);
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  }
  setAnalogico(x, z) { this.input.x = x; this.input.z = z; }

  // ---- modos ----
  setMenu() { this.mode = 'menu'; document.exitPointerLock?.(); }
  setPlay(seed) {
    if (seed && seed !== this.seed) { this.seed = seed; this.build(this.qAtual || 'media'); }
    this.mode = 'play'; this.pos.set(0, heightAt(0, 0, this.seed) + 2, 0); this.yaw = 0; this.pitch = 0; this.vy = 0;
  }
  setQualidade(q) { this.qAtual = q; this.build(q); }

  // jogadores remotos (capsula simples; modelos realistas virão na Fase 2)
  upsertRemoto(sid, d) {
    let m = this.remotos.get(sid);
    if (!m) {
      m = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 1.8, 8), new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: .8 }));
      m.castShadow = true; this.scene.add(m); this.remotos.set(sid, m);
    }
    if (d) { m.position.set(d.x, d.y - .9, d.z); m.rotation.y = d.ry || 0; }
  }
  removeRemoto(sid) { const m = this.remotos.get(sid); if (m) { this.scene.remove(m); this.remotos.delete(sid); } }
  limparRemotos() { for (const sid of [...this.remotos.keys()]) this.removeRemoto(sid); }

  #loop() {
    const dt = Math.min(this.clock.getDelta(), .05); this.t += dt;
    if (this.agua) this.agua.position.y = Math.sin(this.t * .8) * .05;
    if (this.mode === 'menu') { // câmera cinematográfica orbitando
      const a = this.t * .06, R = 70;
      this.cam.position.set(Math.cos(a) * R, 14 + Math.sin(a * 2) * 3, Math.sin(a) * R);
      this.cam.lookAt(0, 4, 0);
    } else if (!this.parado) {
      const v = 5.5, c = Math.cos(this.yaw), s = Math.sin(this.yaw);
      const fx = -s, fz = -c, rx = c, rz = -s, len = Math.hypot(this.input.x, this.input.z) || 1, k = Math.min(1, len);
      const dx = (rx * this.input.x + fx * this.input.z) / len * k * v * dt, dz = (rz * this.input.x + fz * this.input.z) / len * k * v * dt;
      this.pos.x += dx; this.pos.z += dz;
      const chao = heightAt(this.pos.x, this.pos.z, this.seed) + 1.7;
      this.vy -= 22 * dt; this.pos.y += this.vy * dt;
      if (this.pos.y <= chao) { this.pos.y = chao; this.vy = 0; this.noChao = true; } else this.noChao = false;
      if (this.input.pulo && this.noChao) { this.vy = 7.5; this.noChao = false; }
      this.cam.position.copy(this.pos); this.cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      this.sol.position.set(this.pos.x + 80, 120, this.pos.z + 50); this.sol.target.position.copy(this.pos);
      const agora = performance.now();
      if (this.onMove && agora - this._ultEnvio > 100) { this._ultEnvio = agora; this.onMove({ x: this.pos.x, y: this.pos.y, z: this.pos.z, ry: this.yaw }); }
    }
    this.r.render(this.scene, this.cam);
  }
}
