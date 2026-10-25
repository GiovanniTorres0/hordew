// Cooperativo online. O anfitrião simula tudo e manda o estado do mundo ~15 vezes por segundo; cada amigo
// move o próprio boneco e atira (na tela dele as balas são só de enfeite: o dano é calculado no anfitrião)
// e pede ao anfitrião o que mexe no mundo: construir, upgrade, consertar, vender, comprar e chamar a horda.
// Cada jogador tem o próprio dinheiro (o anfitrião guarda a carteira de todos) e no máximo 1 pet.
// Zumbis comuns atacam quem estiver mais perto; os especiais (Hunter,
// Jockey, Smoker, Charger, Boomer) continuam só com o anfitrião.
const SNAP_MS = 66; // anfitrião -> amigos
const EU_MS = 50; // amigo -> anfitrião
// Sem notícia de alguém por este tempo, a conexão caiu (aba fechada sem aviso, internet caiu).
// Folgado porque aba em segundo plano quase para de rodar o jogo.
// Contado no relógio do jogo (game.loop.time): o relógio da cena só anda depois do create e começa atrasado.
const SILENCIO_MS = 20000;

const CoopLogic = {
  netStart() {
    const n = this.net;
    this.netEvents = [];
    this.netShots = [];
    this.netAt = 0;
    this.zombieById = new Map();
    this.netPets = new Map(); // pets de todos, vistos pelo amigo (dono -> sprite)
    this.lastSnap = this.game.loop.time;
    n.roster.forEach((r, i) => { if (r.id !== n.me) this.addOther(r, i); });
    Net.on({ msg: (m, de) => this.netMessage(m, de), saiu: (id) => this.netLeft(id) });
    this.events.once('shutdown', () => Net.on({}));
    if (this.isHost) {
      Net.setAccepting(false);
      const { level, difficulty, infinite } = this.setup;
      Net.broadcast({ t: 'comecar', setup: { level, difficulty, infinite }, roster: n.roster });
    }
    this.hud.floatText(this.isHost ? `Sala com ${n.roster.length} jogadores. Defendam a casa juntos!` : 'Conectado! Defenda a casa junto com o anfitrião');
  },

  netEvent(e) { if (this.isHost) this.netEvents.push(e); },

  // Aviso grande (banner) ou pequeno (float) que aparece para todo mundo
  announce(text, color) { this.hud.banner(text, color); this.netEvent(['b', text, color || null]); },
  announceFloat(text) { this.hud.floatText(text); this.netEvent(['f', text]); },
  netSfx(name) { Sfx[name](); this.netEvent(['s', name]); },

  // Amigo pede ao anfitrião; devolve false para quem chamou achar que nada mudou ainda
  ask(m) { Net.send(m); return false; },

  weaponId(w = this.weapon) { return Object.keys(WEAPONS).find((k) => WEAPONS[k] === w); },

  // ---------- Bonecos dos outros jogadores ----------

  addOther(r, i) {
    const key = `amigo_${i}`;
    const char = CHARACTERS[r.char] || CHARACTERS[0];
    makePlayerTexture(this, char, OUTFITS[r.outfit] || OUTFITS[0], key);
    const s = this.add.sprite(BASE_X - 40 + 40 * i, BASE_Y + BASE_H / 2 + 50, key).setDepth(3);
    this.addShadow(s, 30);
    const gun = this.add.image(0, 0, 'arma').setOrigin(0.25, 0.4);
    const tag = this.add.text(0, 0, r.id === 'h' ? `${char.name} (anfitrião)` : char.name, {
      ...TEXT, fontSize: '13px', color: UI.gold, strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(6);
    const o = { id: r.id, s, gun, tag, tx: s.x, ty: s.y, aim: 0, mv: 0, wid: 'pistola', hp: char.hp, maxHp: char.hp, down: false, dmg: 0, money: this.money, pet: null };
    o.seen = this.game.loop.time;
    s.ally = o;
    this.others.set(r.id, o);
  },

  removeOther(id) {
    const o = this.others.get(id);
    if (!o) return;
    o.s.destroy();
    o.gun.destroy();
    o.tag.destroy();
    if (o.pet) o.pet.destroy();
    this.others.delete(id);
  },

  // ---------- Dinheiro (cada jogador tem o seu) ----------

  // Prêmio de morte: vai para quem atirou; torres e fogo dividem igualmente entre todos
  payKill(amount) {
    const owner = this.killer;
    if (owner && this.net && owner === this.net.me) { this.money += amount; return; }
    const o = owner && this.others.get(owner);
    if (o) { o.money += amount; return; }
    this.payAll(Math.max(1, Math.round(amount / (this.others.size + 1))));
  },

  payAll(amount) {
    this.money += amount;
    this.others.forEach((o) => { o.money += amount; });
  },

  // Roda um pedido de construção/upgrade/etc. de um amigo cobrando da carteira dele
  withWallet(o, fn) {
    const host = this.money;
    this.money = o.money;
    try { fn(); } finally { o.money = this.money; this.money = host; }
  },

  updateOthers(dt) {
    const k = Math.min(1, dt * 14);
    const now = this.time.now;
    this.others.forEach((o) => {
      const s = o.s;
      [s, o.gun, o.tag].forEach((x) => x.setVisible(!o.down));
      if (o.down) return;
      s.x += (o.tx - s.x) * k;
      s.y += (o.ty - s.y) * k;
      this.face(s, o.aim);
      const anim = this.animate(s, o.mv ? 'andar' : null, 1.2);
      s.setAngle(o.mv ? Math.sin(now / 110) * (anim ? 2 : 5) : 0);
      this.placeGun(s, o.gun, o.aim, o.wid);
      o.tag.setPosition(s.x, s.y - s.displayHeight / 2 - 2);
    });
  },

  // ---------- Anfitrião ----------

  // Quem os zumbis comuns podem atacar: o anfitrião e os amigos de pé; devolve o mais perto
  nearestPerson(z) {
    let p = null;
    let d = 1e9;
    if (!this.down) { p = this.player; d = Phaser.Math.Distance.Between(z.x, z.y, p.x, p.y); }
    this.others.forEach((o) => {
      if (o.down) return;
      const od = Phaser.Math.Distance.Between(z.x, z.y, o.s.x, o.s.y);
      if (od < d) { d = od; p = o.s; }
    });
    return { p, d };
  },

  personDown(s) { return s === this.player ? this.down : !s.ally || s.ally.down || !s.active; },

  // Dano em alguém: no anfitrião direto; no amigo, junta e manda no próximo pacote
  hurtWho(s, amount) {
    if (s === this.player) this.hurtPlayer(amount);
    else if (s.ally && !s.ally.down && this.state !== 'over') s.ally.dmg += amount;
  },

  // Todo mundo de pé dentro do raio (pedra do Tank, poças)
  peopleNear(x, y, r) {
    const list = [];
    if (!this.down && Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < r) list.push(this.player);
    this.others.forEach((o) => { if (!o.down && Phaser.Math.Distance.Between(x, y, o.s.x, o.s.y) < r) list.push(o.s); });
    return list;
  },

  netTick() {
    const now = this.game.loop.time;
    if (now < this.netAt) return;
    // Pela retransmissão manda menos pacotes (o servidor público não aguenta a mesma rajada)
    this.netAt = now + (this.isGuest ? (Net.lento() ? 90 : EU_MS) : (Net.lento() ? 100 : SNAP_MS));
    if (this.isGuest) {
      this.sendMine();
      if (now - this.lastSnap > SILENCIO_MS) this.netLeft('h');
    } else {
      this.sendSnapshot();
      this.others.forEach((o) => { if (now - o.seen > SILENCIO_MS) { Net.drop(o.id); this.netLeft(o.id); } });
    }
  },

  packShot(shot) {
    const o = { s: shot.speed || 700, l: shot.life || 1600 };
    if (shot.tex) o.x = shot.tex;
    if (shot.trail) o.r = shot.trail;
    if (shot.tint) o.c = shot.tint;
    if (shot.pierce) o.p = shot.pierce;
    if (shot.burn) o.b = 1;
    return o;
  },

  unpackShot(o) {
    return { damage: 0, speed: o.s, life: o.l, tex: o.x, trail: o.r, tint: o.c, pierce: o.p || 0, burn: o.b || 0 };
  },

  sendSnapshot() {
    const r = Math.round;
    const z = this.zombies.getChildren().map((zz) => {
      const anim = zz.anims && zz.anims.isPlaying && zz.anims.currentAnim ? (zz.anims.currentAnim.key.endsWith('ataque') ? 2 : 1) : 0;
      return [zz.nid, zz.type, r(zz.x), r(zz.y), zz.flipX ? 1 : 0, r(zz.hp), r(zz.maxHp), zz.mode, anim, zz.optional ? 1 : 0];
    });
    const p = [[this.net.me, r(this.player.x), r(this.player.y), +this.aim.toFixed(2), 0, this.player.body.velocity.lengthSq() > 0 ? 1 : 0,
      this.weaponId(), Math.ceil(this.hp), this.maxHp, this.down ? 1 : 0]];
    this.others.forEach((o) => p.push([o.id, r(o.tx), r(o.ty), o.aim, 0, o.mv, o.wid, o.hp, o.maxHp, o.down ? 1 : 0]));
    const st = this.structures.map((s) => [s.nid, s.type, s.x, s.y, s.hp === undefined ? -1 : r(s.hp), s.maxHp || 0, s.levels,
      s.durability === undefined ? -1 : +s.durability.toFixed(1), s.gun ? +s.gun.rotation.toFixed(2) : 0, s.spent]);
    const dmg = {};
    this.others.forEach((o) => { if (o.dmg > 0) { dmg[o.id] = +o.dmg.toFixed(1); o.dmg = 0; } });
    const pets = [];
    const addPet = (id, pt) => { if (pt) pets.push([id, pt.texture.key, r(pt.x), r(pt.y), pt.flipX ? 1 : 0, +pt.depth.toFixed(3)]); };
    addPet(this.net.me, this.pet);
    const mm = { [this.net.me]: this.money };
    this.others.forEach((o) => { addPet(o.id, o.pet); mm[o.id] = o.money; });
    Net.broadcast({
      t: 's', z, p, st, pets, dmg, b: [r(this.base.hp), this.base.maxHp], mm, w: this.wave, ws: this.state,
      il: +(this.intermissionLeft || 0).toFixed(1), ev: this.event, dk: +this.darkness.toFixed(2), sq: this.spawnQueue.length,
      bc: this.builtCount, tiros: this.netShots, e: this.netEvents,
    });
    this.netShots = [];
    this.netEvents = [];
  },

  // Manda já o que estiver pendente (fim de jogo: o update para de rodar)
  netFlush() {
    if (!this.isHost) return;
    this.netAt = 0;
    this.sendSnapshot();
  },

  netMessage(m, de) {
    if (m.t === 'comecar') {
      if (this.isGuest) {
        this.scene.restart({ ...m.setup, char: this.setup.char, outfit: this.setup.outfit, net: { role: 'guest', me: this.net.me, roster: m.roster } });
      }
      return;
    }
    if (this.isGuest) {
      if (m.t === 's') { this.lastSnap = this.game.loop.time; this.applySnapshot(m); }
      else if (m.t === 'compra_ok') {
        this.deliver(m.item);
        if (this.shop.isOpen) { this.shop.note.setText('Comprado! Pegue a caixa que cair do céu').setColor(UI.green); this.shop.render(); }
      } else if (m.t === 'recusado') {
        if (this.shop.isOpen) this.shop.note.setText(m.msg).setColor(UI.blood);
        else this.hud.floatText(m.msg);
      }
      return;
    }
    const o = this.others.get(de);
    if (!o) return;
    o.seen = this.game.loop.time;
    if (m.t === 'eu') {
      Object.assign(o, { tx: +m.x || 0, ty: +m.y || 0, aim: +m.a || 0, mv: m.mv ? 1 : 0, wid: WEAPONS[m.w] ? m.w : 'pistola', hp: m.hp, maxHp: m.mh, down: !!m.d });
      return;
    }
    if (this.state === 'over') return;
    const achar = (id) => (id === 0 ? this.base : this.structures.find((s) => s.nid === id));
    if (m.t === 'tiro') this.allyShot(o, m);
    else if (m.t === 'construir' && BUILDINGS[m.tipo]) {
      this.withWallet(o, () => {
        const antes = this.buildType;
        this.buildType = m.tipo;
        this.tryBuild({ x: +m.x, y: +m.y });
        this.buildType = antes;
      });
    } else if (m.t === 'upgrade') { const s = achar(m.id); if (s && s !== this.base) this.withWallet(o, () => this.upgrade(s, m.linha | 0)); }
    else if (m.t === 'consertar') { const s = achar(m.id); if (s) this.withWallet(o, () => this.repair(s)); }
    else if (m.t === 'vender') { const s = achar(m.id); if (s) this.withWallet(o, () => this.sell(s)); }
    else if (m.t === 'chamar') this.startWave(true);
    else if (m.t === 'compra') this.allyBuy(o, m);
    else if (m.t === 'pet' && PETS[m.id]) this.spawnPet(m.id, o);
    else if (m.t === 'reparo') this.base.hp = Math.min(this.base.maxHp, this.base.hp + 200);
  },

  allyShot(o, m) {
    if (o.down || !Array.isArray(m.a)) return;
    const w = WEAPONS[m.w] || WEAPONS.pistola;
    const off = Phaser.Math.Clamp(+m.o || 0, 0, 60);
    this.shotOwner = o.id;
    m.a.slice(0, 12).forEach((a) => this.fireBullet(+m.x, +m.y, +a, off, w));
    this.shotOwner = 0;
    const a0 = +m.a[0];
    if (w !== WEAPONS.chamas) this.muzzleFlash(+m.x + Math.cos(a0) * off, +m.y + Math.sin(a0) * off, a0);
    if (w !== WEAPONS.chamas || Math.random() < 0.2) Sfx.gun(m.w);
  },

  allyBuy(o, m) {
    const def = m.kind === 'weapon' ? WEAPONS[m.id] : m.kind === 'pet' ? PETS[m.id] : m.kind === 'item' ? SHOP_ITEMS.find((i) => i.id === m.id) : null;
    if (!def || this.state !== 'intermission') return Net.sendTo(o.id, { t: 'recusado', msg: 'A loja só abre entre as hordas' });
    if (o.money < def.cost) return Net.sendTo(o.id, { t: 'recusado', msg: 'Dinheiro insuficiente' });
    o.money -= def.cost;
    Net.sendTo(o.id, { t: 'compra_ok', item: { kind: m.kind, id: m.id, name: def.name } });
  },

  netLeft(id) {
    if (this.isGuest) {
      if (id !== 'h' || this.state === 'over') return;
      this.netEnd('SEM CONEXÃO', 'O anfitrião saiu ou a conexão caiu.', '', false);
      return;
    }
    this.removeOther(id);
    this.net.roster = this.net.roster.filter((r) => r.id !== id);
    this.hud.floatText('Um amigo saiu da partida');
  },

  // ---------- Amigo ----------

  sendMine() {
    const p = this.player;
    Net.send({
      t: 'eu', x: Math.round(p.x), y: Math.round(p.y), a: +this.aim.toFixed(2), mv: p.body.velocity.lengthSq() > 0 ? 1 : 0,
      w: this.weaponId(), hp: Math.ceil(this.hp), mh: this.maxHp, d: this.down ? 1 : 0,
    });
  },

  // Tiro do amigo: as balas da tela dele são de enfeite; o anfitrião dispara as de verdade
  netShot(x, y, angles, wid, off) {
    if (!this.isGuest) return;
    Net.send({ t: 'tiro', x: Math.round(x), y: Math.round(y), a: angles.map((a) => +a.toFixed(3)), w: wid, o: Math.round(off) });
  },

  guestUpdate(time, delta) {
    if (this.state === 'over') return;
    const dt = Math.min(delta, 50) / 1000;
    this.now = this.time.now;
    this.updatePlayer(time, dt);
    this.updateGhost();
    this.moveProxies(dt);
    this.updateOthers(dt);
    this.updateEnemyShots(dt);
    this.sortDepth();
    this.cleanupBullets();
    this.drawHpBars();
    this.drawFx();
    this.drawNight();
    this.hud.update();
    this.updateBaseLook();
    this.netTick();
  },

  // Zumbis e pet vindos do anfitrião deslizam até a última posição recebida
  moveProxies(dt) {
    const k = Math.min(1, dt * 12);
    const now = this.time.now;
    this.zombies.getChildren().forEach((z) => {
      if (z.tx === undefined) return;
      z.x += (z.tx - z.x) * k;
      z.y += (z.ty - z.y) * k;
      if (z.body) z.body.updateFromGameObject();
      const nome = z.netAnim === 2 ? 'ataque' : z.netAnim === 1 ? 'andar' : null;
      const anim = this.animate(z, nome, 1);
      z.setAngle(z.netAnim === 1 ? Math.sin((now + z.wobble) / 160) * (anim ? 3 : 6) : 0);
      z.setScale(z.baseScale, z.baseScale * (1 + Math.sin((now + z.wobble) / 120) * 0.04));
    });
    this.netPets.forEach((pet) => {
      const mv = Math.abs(pet.tx - pet.x) + Math.abs(pet.ty - pet.y) > 2;
      pet.x += (pet.tx - pet.x) * k;
      pet.y += (pet.ty - pet.y) * k;
      this.animate(pet, mv ? 'andar' : null, 1);
      this.moveShadow(pet);
    });
  },

  applySnapshot(m) {
    if (this.state === 'over') return;
    if (m.mm[this.net.me] !== undefined) this.money = m.mm[this.net.me];
    this.wave = m.w;
    this.state = m.ws;
    this.intermissionLeft = m.il;
    this.darkness = m.dk;
    if (m.ev !== this.event) {
      this.event = m.ev;
      if (m.ev === 'chuva') this.rain.start(); else this.rain.stop();
    }
    this.spawnQueue.length = m.sq;
    this.base.hp = m.b[0];
    this.base.maxHp = m.b[1];
    if (this.state !== 'intermission' && this.shop.isOpen) this.shop.close();

    const vistos = new Set();
    m.z.forEach(([id, type, x, y, flip, hp, maxHp, mode, anim, optional]) => {
      vistos.add(id);
      let z = this.zombieById.get(id);
      if (!z) {
        if (!ZOMBIES[type]) return;
        z = this.createZombie(type, x, y);
        z.nid = id;
        z.body.moves = false;
        z.body.immovable = true;
        this.zombieById.set(id, z);
      }
      z.tx = x;
      z.ty = y;
      z.setFlipX(!!flip);
      z.hp = hp;
      z.maxHp = maxHp;
      z.mode = mode;
      z.netAnim = anim;
      z.optional = !!optional;
    });
    this.zombieById.forEach((z, id) => {
      if (vistos.has(id)) return;
      if (z.active) z.destroy();
      this.zombieById.delete(id);
    });

    const pessoas = new Set();
    m.p.forEach(([id, x, y, a, , mv, w, hp, mh, d]) => {
      const o = this.others.get(id);
      if (!o) return;
      Object.assign(o, { tx: x, ty: y, aim: a, mv, wid: w, hp, maxHp: mh, down: !!d });
      pessoas.add(id);
    });
    this.others.forEach((o, id) => { if (!pessoas.has(id)) this.removeOther(id); });

    const obras = new Set();
    m.st.forEach(([id, type, x, y, hp, maxHp, levels, dur, rot, spent]) => {
      obras.add(id);
      let s = this.structures.find((o) => o.nid === id);
      if (!s) {
        if (!BUILDINGS[type]) return;
        s = this.placeStructure(type, this.snap({ x, y }), id);
        Sfx.build();
      }
      if (hp >= 0) s.hp = hp;
      if (maxHp) s.maxHp = maxHp;
      s.spent = spent;
      if (dur >= 0) {
        s.durability = dur;
        s.sprite.setAlpha(0.4 + 0.6 * (dur / s.def.durability));
      }
      if (s.levels.join() !== levels.join()) {
        s.levels = levels.slice();
        this.computeStats(s);
      }
      if (s.gun) s.gun.setRotation(rot).setFlipY(Math.cos(rot) < 0);
    });
    this.structures.slice().forEach((s) => { if (!obras.has(s.nid)) this.removeStructure(s); });
    this.builtCount = m.bc;

    const comPet = new Set();
    m.pets.forEach(([dono, tex, x, y, flip, depth]) => {
      comPet.add(dono);
      let pet = this.netPets.get(dono);
      if (!pet) {
        pet = this.add.sprite(x, y, tex);
        this.addShadow(pet, 30);
        this.netPets.set(dono, pet);
      }
      if (pet.texture.key !== tex) pet.setTexture(tex);
      pet.tx = x;
      pet.ty = y;
      pet.setFlipX(!!flip).setDepth(depth);
    });
    this.netPets.forEach((pet, dono) => {
      if (comPet.has(dono)) return;
      pet.destroy();
      this.netPets.delete(dono);
    });

    const dano = m.dmg && m.dmg[this.net.me];
    if (dano) this.hurtPlayer(dano);

    const ouvidos = new Set();
    m.tiros.forEach(([x, y, a, off, sh, dono]) => {
      if (dono === this.net.me) return;
      this.fireBullet(x, y, a, off, this.unpackShot(sh));
      if (dono && sh.w && !ouvidos.has(dono)) {
        ouvidos.add(dono);
        if (sh.w !== 'chamas') this.muzzleFlash(x + Math.cos(a) * off, y + Math.sin(a) * off, a);
        if (sh.w !== 'chamas' || Math.random() < 0.2) Sfx.gun(sh.w);
      }
    });
    m.e.forEach((e) => this.playEvent(e));
  },

  playEvent(e) {
    const [k] = e;
    if (k === 'b') this.hud.banner(e[1], e[2] || undefined);
    else if (k === 'f') this.hud.floatText(e[1]);
    else if (k === 's' && Sfx[e[1]]) Sfx[e[1]]();
    else if (k === 'm') {
      const [, x, y, r] = e;
      this.particles.explode(r > 20 ? 40 : 12, x, y);
      this.bloodStain(x, y, r / 12);
      if (r > 20) this.cameras.main.shake(250, 0.01);
      Sfx.splat();
    } else if (k === 'x') {
      this.fireParticles.explode(24, e[1], e[2]);
      this.cameras.main.shake(120, 0.006);
      Sfx.boom();
    } else if (k === 'z') {
      const pts = [];
      for (let i = 0; i < e[1].length; i += 2) pts.push(new Phaser.Math.Vector2(e[1][i], e[1][i + 1]));
      this.bolts.push({ points: pts, until: this.time.now + 120 });
      Sfx.zap();
    } else if (k === 'a') this.throwShot({ x: e[1], y: e[2] }, e[3], e[4], e[5]);
    else if (k === 'p') this.addPuddle(e[1], e[2], e[3], e[4], e[5]);
    else if (k === 'onda') this.respawnPlayer();
    else if (k === 'fim') this.netEnd(e[1], e[2], e[3], e[4]);
  },

  // Fim de partida na tela do amigo: quem recomeça é o anfitrião
  netEnd(title, reason, stats, won) {
    this.state = 'over';
    this.won = won;
    this.physics.pause();
    this.rain.stop();
    this.shop.close();
    this.panel.close();
    this.setBuild(null);
    this.menuOpen = false;
    this.hud.setPaused(false);
    this.hud.endScreen(title, reason, stats, '[M] menu  ·  o anfitrião pode recomeçar', [['Menu principal', () => this.toMenu()]]);
    if (won) Sfx.win(); else Sfx.lose();
  },
};

Object.assign(GameScene.prototype, CoopLogic);
