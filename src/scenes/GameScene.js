// Cena principal. A lógica de zumbis, construções e pets fica em src/game/*.js,
// que acrescentam métodos a esta classe (veja o fim de cada arquivo).
class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  // data: { level, char, outfit, difficulty, infinite }
  init(data) {
    this.setup = { level: 0, char: 0, outfit: 0, difficulty: 1, infinite: false, ...(data || {}) };
    this.levelIndex = this.setup.level;
    this.level = LEVELS[this.levelIndex];
    this.diff = DIFFICULTIES[this.setup.difficulty];
    this.infinite = this.setup.infinite;
    this.wavesToWin = this.infinite ? Infinity : this.level.wavesToWin;
    this.char = CHARACTERS[this.setup.char];
    this.outfit = OUTFITS[this.setup.outfit];

    this.money = Math.round((START_MONEY + 75 * this.levelIndex) * this.diff.money);
    this.wave = 0;
    this.waveHpMul = 1;
    this.state = 'intermission';
    this.won = false;
    this.paused = false;
    this.owned = ['pistola'];
    this.weapon = WEAPONS.pistola;
    this.maxHp = this.char.hp;
    this.hp = this.maxHp;
    this.down = false;
    this.buildType = null;
    this.occupied = new Set();
    this.structures = [];
    this.builtCount = {};
    this.spawnQueue = [];
    this.director = 1;
    this.event = null;
    this.pet = null;
    this.camoUntil = 0;
    this.bileUntil = 0;
    this.pinnedBy = null;
    this.smokedBy = null;
    this.enemyShots = [];
    this.puddles = [];
    this.bolts = [];
    this.darkness = 0;
  }

  create() {
    this.physics.resume(); // o mundo de física sobrevive ao restart e pode estar pausado pelo fim de jogo
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.drawMap();
    this.blockers = this.physics.add.staticGroup();
    this.createBase();
    this.createPlayer();
    this.zombies = this.physics.add.group();
    this.crates = this.physics.add.group();
    this.particles = this.add.particles(0, 0, 'dot', {
      speed: { min: 60, max: 180 }, lifespan: 450, scale: { start: 1.2, end: 0 }, tint: PALETTE.blood, emitting: false,
    }).setDepth(5);
    this.bloodParticles = this.add.particles(0, 0, 'dot', {
      speed: { min: 50, max: 160 }, lifespan: 380, scale: { start: 0.7, end: 0.1 }, gravityY: 300,
      tint: [0x6e1515, 0x8a1c1c, 0x4a0e0e], emitting: false,
    }).setDepth(5);
    this.stains = [];
    this.fireParticles = this.add.particles(0, 0, 'dot', {
      speed: { min: 80, max: 260 }, lifespan: 500, scale: { start: 2.2, end: 0 }, tint: [0xffa53c, 0xfff27a, 0xe8453c], emitting: false,
    }).setDepth(5);

    this.physics.add.collider(this.zombies, this.zombies);
    this.physics.add.collider(this.zombies, this.blockers);
    this.physics.add.collider(this.player, this.blockers);
    this.physics.add.overlap(this.bullets, this.zombies, (b, z) => this.hitZombie(b, z));
    this.physics.add.overlap(this.player, this.crates, (p, c) => this.pickCrate(c));

    this.hpBars = this.add.graphics().setDepth(6);
    this.fx = this.add.graphics().setDepth(7);
    this.rangeCircle = this.add.circle(0, 0, 100, 0xffffff, 0.08).setStrokeStyle(2, 0xffffff, 0.3).setVisible(false).setDepth(1);
    this.createNight();
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    this.createInput();
    this.hud = new Hud(this);
    // Flash vermelho na tela ao levar dano (fica acima do mundo, abaixo dos textos do HUD)
    this.hurtFlash = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x8a0f0f, 1)
      .setOrigin(0).setScrollFactor(0).setDepth(8).setAlpha(0);
    this.shop = new Shop(this);
    this.panel = new TowerPanel(this);
    this.startIntermission(40);
  }

  // ---------- Mapa ----------

  drawMap() {
    const lv = this.level;
    this.add.tileSprite(0, 0, WORLD_W, WORLD_H, `ground${this.levelIndex}`).setOrigin(0);
    // Duas ruas que se cruzam na base
    // Com textura desenhada (street<n>) a rua é ladrilhada; senão, faixa de cor lisa
    const street = `street${this.levelIndex}`;
    const road = (x, y, w, h) => (this.textures.exists(street)
      ? this.add.tileSprite(x, y, w, h, street).setOrigin(0).setTilePosition(x, y)
      : this.add.rectangle(x, y, w, h, lv.street).setOrigin(0));
    road(0, BASE_Y - 55, WORLD_W, 110);
    road(BASE_X - 55, 0, 110, WORLD_H);
    const marks = this.add.graphics().fillStyle(0xe9e2c8, 0.6);
    for (let x = 20; x < WORLD_W; x += 80) if (Math.abs(x - BASE_X) > 80) marks.fillRect(x, BASE_Y - 3, 40, 6);
    for (let y = 20; y < WORLD_H; y += 80) if (Math.abs(y - BASE_Y) > 80) marks.fillRect(BASE_X - 3, y, 6, 40);

    // Decoração fora das ruas (sem colisão), sempre nas mesmas posições
    const rnd = new Phaser.Math.RandomDataGenerator([lv.name]);
    let placed = 0;
    while (placed < 40) {
      const x = rnd.between(40, WORLD_W - 40);
      const y = rnd.between(60, WORLD_H - 20);
      if (Math.abs(x - BASE_X) < 120 || Math.abs(y - BASE_Y) < 120) continue;
      this.add.image(x, y, lv.decor).setOrigin(0.5, 1).setAngle(rnd.between(-3, 3)).setDepth(this.depthAt(y));
      placed += 1;
    }
    if (this.cameras.main.postFX) this.cameras.main.postFX.addVignette(0.5, 0.5, 0.95, 0.35);
  }

  // 3 estados de dano: inteira, avariada (abaixo de 2/3) e em ruínas (abaixo de 1/3).
  // Com os desenhos base<n>_dano1/_dano2 troca a imagem; sem eles, escurece e avermelha a casa.
  updateBaseLook() {
    const b = this.base;
    const stage = b.hp > b.maxHp * 0.66 ? 0 : b.hp > b.maxHp * 0.33 ? 1 : 2;
    if (stage === b.stage) return;
    b.stage = stage;
    const tex = `${b.baseTex}_dano${stage}`;
    if (stage && this.textures.exists(tex)) {
      b.sprite.setTexture(tex).setTint(stage === 2 ? 0xb8a49a : 0xffffff); // ruínas com fuligem
    } else if (stage === 2 && this.textures.exists(`${b.baseTex}_dano1`)) {
      // Só a avariada desenhada: ela mesma, escurecida, faz as ruínas
      b.sprite.setTexture(`${b.baseTex}_dano1`).setTint(0xa08878);
    } else {
      b.sprite.setTexture(b.baseTex).setTint([0xffffff, 0xcdb8a4, 0x9a7a68][stage]);
    }
  }

  createBase() {
    // Cada mapa tem o seu abrigo (base0..2); sem o desenho, a casa padrão
    const tex = this.textures.exists(`base${this.levelIndex}`) ? `base${this.levelIndex}` : 'base';
    const sprite = this.blockers.create(BASE_X, BASE_Y, tex);
    this.standOn(sprite, BASE_W, BASE_H);
    this.base = {
      type: 'base', def: { name: 'Base', block: true, light: 260 }, sprite, x: BASE_X, y: BASE_Y,
      hw: BASE_W / 2, hh: BASE_H / 2, hp: this.diff.baseHp, maxHp: this.diff.baseHp,
    };
    this.base.baseTex = tex;
    sprite.structure = this.base;
  }

  // ---------- Noite ----------

  // Uma camada escura do tamanho da tela; cada luz "apaga" um círculo nela
  createNight() {
    this.nightLayer = this.add.renderTexture(0, 0, GAME_W, GAME_H).setOrigin(0).setScrollFactor(0).setDepth(15);
    this.lightBrush = this.make.image({ key: 'light', add: false });
    this.rain = this.add.particles(0, 0, 'dot', {
      x: { min: 0, max: GAME_W }, y: -10, speedY: { min: 500, max: 700 }, speedX: -80, lifespan: 1400,
      scaleX: 0.5, scaleY: 2.5, alpha: 0.6, tint: PALETTE.acid, frequency: 12, emitting: false,
    }).setScrollFactor(0).setDepth(16);
  }

  collectLights() {
    const list = [];
    const fog = this.event === 'neblina' ? 0.65 : 1;
    if (!this.down) list.push([this.player.x, this.player.y, PLAYER.light]);
    list.push([BASE_X, BASE_Y, this.base.def.light]);
    this.structures.forEach((s) => {
      if (!s.stats || !s.stats.light) return;
      if (this.event === 'apagao' && (s.type === 'tesla' || s.type === 'farol')) return;
      list.push([s.x, s.y, s.stats.light]);
    });
    if (this.pet && this.pet.scouting) list.push([this.pet.x, this.pet.y, this.pet.def.scout.light]);
    this.zombies.getChildren().forEach((z) => { if (z.burn && z.burn.t > 0) list.push([z.x, z.y, 60]); });
    return list.map(([x, y, r]) => [x, y, r * fog]);
  }

  // Um ponto está iluminado? (usado no minimapa à noite)
  isLit(x, y) {
    if (this.darkness < 0.3) return true;
    return this.cachedLights.some(([lx, ly, r]) => (x - lx) ** 2 + (y - ly) ** 2 < r * r);
  }

  drawNight() {
    this.cachedLights = this.collectLights();
    const rt = this.nightLayer;
    rt.clear();
    if (this.darkness < 0.01) return;
    const cam = this.cameras.main;
    rt.fill(0x0a0618, this.darkness * (this.event === 'neblina' ? 1.12 : 1));
    this.cachedLights.forEach(([x, y, r]) => {
      const sx = x - cam.scrollX;
      const sy = y - cam.scrollY;
      if (sx < -r || sy < -r || sx > GAME_W + r || sy > GAME_H + r) return;
      this.lightBrush.setScale((r * 1.25) / 128);
      rt.erase(this.lightBrush, sx, sy);
    });
  }

  setNight(on) {
    this.tweens.add({ targets: this, darkness: on ? 0.8 : 0, duration: 2500 });
  }

  // ---------- Jogador ----------

  createPlayer() {
    makePlayerTexture(this, this.char, this.outfit, 'player');
    this.player = this.physics.add.sprite(BASE_X, BASE_Y + BASE_H / 2 + 50, 'player').setDepth(3);
    this.player.setCollideWorldBounds(true);
    this.player.body.setCircle(13, this.player.width / 2 - 13, this.player.height / 2 - 13);
    // Câmera 3/4: o corpo só espelha; quem gira na direção do mouse é a arma
    this.gun = this.add.image(0, 0, 'arma').setOrigin(0.25, 0.4);
    this.addShadow(this.player, 30);
    this.aim = 0;
    this.lastShot = 0;
    this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 400 });
  }

  createInput() {
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.input.mouse.disableContextMenu();
    BUILD_ORDER.forEach((type) => this.input.keyboard.on(`keydown-${BUILDINGS[type].key}`, () => this.setBuild(type)));
    this.input.keyboard.on('keydown-ESC', () => { this.setBuild(null); this.shop.close(); this.panel.close(); });
    this.input.keyboard.on('keydown-L', () => this.shop.toggle());
    this.input.keyboard.on('keydown-Q', () => this.nextWeapon());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.pinnedBy) this.struggle();
      else if (this.state === 'intermission' && !this.paused) this.startWave(true);
    });
    this.input.keyboard.on('keydown-R', () => { if (this.state === 'over') this.scene.restart(this.setup); });
    this.input.keyboard.on('keydown-M', () => { if (this.state === 'over') this.scene.start('Menu'); });
    this.input.keyboard.on('keydown-N', () => {
      if (this.state === 'over' && this.won && this.levelIndex + 1 < LEVELS.length) {
        this.scene.restart({ ...this.setup, level: this.levelIndex + 1 });
      }
    });

    this.ghost = this.add.image(0, 0, 'turret_base').setAlpha(0.6).setVisible(false).setDepth(4);
    this.input.on('pointerdown', (pointer, over) => {
      this.clickOnUI = over.length > 0;
      if (this.clickOnUI || this.state === 'over') return;
      const wp = this.worldPointer();
      if (pointer.rightButtonDown()) {
        if (this.buildType) return this.setBuild(null);
        const s = this.structureAt(wp.x, wp.y);
        if (s) this.panel.open(s);
        else this.panel.close();
        return;
      }
      if (this.buildType && !this.shop.isOpen) this.tryBuild(wp);
    });
    this.input.on('pointerup', () => { this.clickOnUI = false; });
  }

  worldPointer() {
    const p = this.input.activePointer;
    return this.cameras.main.getWorldPoint(p.x, p.y);
  }

  nextWeapon() {
    const i = this.owned.indexOf(Object.keys(WEAPONS).find((k) => WEAPONS[k] === this.weapon));
    this.weapon = WEAPONS[this.owned[(i + 1) % this.owned.length]];
  }

  togglePause() {
    if (this.state === 'over') return;
    this.paused = !this.paused;
    if (this.paused) {
      this.physics.pause();
      this.time.paused = true;
      this.tweens.pauseAll();
    } else {
      this.physics.resume();
      this.time.paused = false;
      this.tweens.resumeAll();
    }
    this.hud.setPaused(this.paused);
  }

  update(time, delta) {
    if (this.state === 'over' || this.paused) return;
    const dt = Math.min(delta, 50) / 1000;
    this.now = this.time.now;
    this.updatePlayer(time, dt);
    this.updateGhost();
    this.updatePet(dt);
    this.updateZombies(dt);
    if (this.state === 'over') return;
    this.updateStructures(dt);
    this.updateEnemyShots(dt);
    this.sortDepth();
    this.cleanupBullets();
    this.drawHpBars();
    this.drawFx();
    this.drawNight();
    if (this.state === 'intermission') {
      this.intermissionLeft -= dt;
      if (this.intermissionLeft <= 0) this.startWave(false);
    }
    this.hud.update();
    this.updateBaseLook();
  }

  updatePlayer(time, dt) {
    const p = this.player;
    if (this.down) return;
    const k = this.keys;
    let speed = this.char.speed * (this.pet && this.pet.def.speedBuff ? this.pet.def.speedBuff : 1);
    let vx = (k.D.isDown ? 1 : 0) - (k.A.isDown ? 1 : 0);
    let vy = (k.S.isDown ? 1 : 0) - (k.W.isDown ? 1 : 0);
    const v = new Phaser.Math.Vector2(vx, vy).normalize().scale(speed);

    const wp = this.worldPointer();
    this.aim = Phaser.Math.Angle.Between(p.x, p.y, wp.x, wp.y);
    this.face(p, this.aim);
    let canShoot = !this.buildType && !this.shop.isOpen && !this.clickOnUI;

    // Presos por especiais: Hunter imobiliza, Jockey conduz, Smoker puxa
    if (this.pinnedBy) {
      canShoot = false;
      const z = this.pinnedBy;
      if (z.def === ZOMBIES.jockey) {
        const away = Phaser.Math.Angle.Between(BASE_X, BASE_Y, p.x, p.y) + Math.sin(time / 300) * 0.8;
        v.set(Math.cos(away) * 110, Math.sin(away) * 110);
      } else v.set(0, 0);
    }
    if (this.smokedBy) {
      const z = this.smokedBy;
      const a = Phaser.Math.Angle.Between(p.x, p.y, z.x, z.y);
      v.scale(0.3).add(new Phaser.Math.Vector2(Math.cos(a) * 120, Math.sin(a) * 120));
    }
    p.setVelocity(v.x, v.y);
    const moving = v.lengthSq() > 0;
    p.setScale(1, 1 + (moving ? Math.sin(time / 70) * 0.05 : 0));
    const anim = this.animate(p, moving ? 'andar' : null, 1.2);
    p.setAngle(moving ? Math.sin(time / 110) * (anim ? 2 : 5) : 0);

    // Arma na altura da mão, do lado para onde o jogador olha
    const side = p.flipX ? -1 : 1;
    const gx = p.x + side * p.height * 0.09;
    const gy = p.y + p.height * 0.08;
    // Cada arma tem o seu desenho (w_<id>); sem ele, a pistola feita por código
    const wid = Object.keys(WEAPONS).find((k) => WEAPONS[k] === this.weapon);
    const wtex = this.textures.exists(`w_${wid}`) ? `w_${wid}` : 'arma';
    // Desenhos exportados em resolução dobrada e com contorno; a 0.7 ficam um pouco maiores que o real
    if (this.gun.texture.key !== wtex) this.gun.setTexture(wtex).setOrigin(wtex === 'arma' ? 0.25 : 0.3, wtex === 'arma' ? 0.4 : 0.55).setScale(wtex === 'arma' ? 1 : 0.7);
    this.gun.setPosition(gx, gy).setRotation(this.aim).setFlipY(Math.cos(this.aim) < 0).setDepth(p.depth + 0.001);

    if (canShoot && this.input.activePointer.leftButtonDown() && time - this.lastShot > this.weapon.fireDelay) {
      const w = this.weapon;
      for (let i = 0; i < w.pellets; i++) {
        const angle = this.aim + Phaser.Math.FloatBetween(-w.spread, w.spread) / 2;
        this.fireBullet(gx, gy, angle, this.gun.displayWidth * 0.7, w);
      }
      this.lastShot = time;
      const muzzle = this.gun.displayWidth * 0.7;
      if (w !== WEAPONS.chamas) this.muzzleFlash(gx + Math.cos(this.aim) * muzzle, gy + Math.sin(this.aim) * muzzle, this.aim);
      if (w !== WEAPONS.chamas || Math.random() < 0.2) Sfx.gun(wid);
    }
  }

  // Toca a animação do boneco desenhado ('andar', 'ataque' ou null para parado).
  // Devolve false se a textura não tem quadros (arte antiga desenhada por código), para quem chamou gingar no lugar.
  animate(sprite, nome, ritmo = 1) {
    const base = sprite.texture.key;
    if (!this.anims.exists(`${base}_andar`)) return false;
    if (!nome) {
      if (sprite.anims.isPlaying) sprite.anims.stop();
      sprite.setFrame(0);
    } else {
      sprite.play(`${base}_${nome}`, true);
      sprite.anims.timeScale = ritmo;
    }
    return true;
  }

  // Câmera 3/4: personagens são desenhados olhando para a direita e só espelham.
  // facing guarda o ângulo real (usado, por exemplo, na investida do Charger).
  // Zona morta: andando quase na vertical, mantém o lado em que já estava (senão o desvio do caminho faz piscar).
  face(sprite, angle) {
    sprite.facing = angle;
    const c = Math.cos(angle);
    if (Math.abs(c) > 0.3) sprite.setFlipX(c < 0);
  }

  // Quem está mais embaixo na tela (pés mais perto da câmera) fica na frente.
  // Personagens, construções e decoração usam a mesma régua: 2 a 3, pela altura dos pés no mundo.
  depthAt(bottomY) {
    return 2 + bottomY / WORLD_H;
  }

  sortDepth() {
    const feet = (s) => this.depthAt(s.y + s.displayHeight / 2);
    this.zombies.getChildren().forEach((z) => { z.setDepth(feet(z)); this.moveShadow(z); });
    if (!this.down) this.player.setDepth(feet(this.player));
    this.moveShadow(this.player);
    if (this.pet && this.pet.id !== 'gaviao') this.pet.setDepth(feet(this.pet));
    if (this.pet) this.moveShadow(this.pet);
  }

  // Sombra no chão sob os pés (camada 1.6: acima do chão e das manchas, abaixo de tudo que fica de pé).
  // largura em px; alto = distância até o chão (o gavião voa, a sombra fica bem abaixo dele).
  addShadow(sprite, largura, alto = 0) {
    const sombra = this.add.image(sprite.x, sprite.y, 'sombra').setDepth(1.6).setScale(largura / 32, largura / 32 * 0.9);
    sprite.shadow = sombra;
    sprite.shadowLift = alto;
    sprite.once('destroy', () => sombra.destroy());
    return sombra;
  }

  moveShadow(s) {
    if (!s.shadow) return;
    s.shadow.setPosition(s.x, s.y + s.displayHeight / 2 - 2 + s.shadowLift).setVisible(s.visible);
  }

  // Sangue: respingo na direção do golpe e, quando morre, uma mancha no chão que some devagar
  bloodSplash(x, y, angle, n) {
    const a = Phaser.Math.RadToDeg(angle);
    this.bloodParticles.setEmitterAngle({ min: a - 30, max: a + 30 });
    this.bloodParticles.emitParticleAt(x, y, n);
  }

  bloodStain(x, y, size) {
    const m = this.add.image(x, y, 'mancha').setDepth(1.5).setAngle(Phaser.Math.Between(0, 359))
      .setScale(size * Phaser.Math.FloatBetween(0.8, 1.2), size * Phaser.Math.FloatBetween(0.5, 0.7));
    this.stains.push(m);
    if (this.stains.length > 60) this.stains.shift().destroy();
    this.tweens.add({ targets: m, alpha: 0, delay: 20000, duration: 6000, onComplete: () => m.destroy() });
  }

  // Câmera 3/4: o objeto fica de pé sobre a sua área no chão (w x h, centrada em x, y);
  // o desenho pode ser mais alto que ela, mas a colisão continua sendo só essa área.
  standOn(sprite, w, h) {
    sprite.setOrigin(0.5, 1 - h / 2 / sprite.height);
    if (sprite.body) {
      sprite.refreshBody();
      sprite.body.setSize(w, h, false);
      sprite.body.setOffset((sprite.width - w) / 2, sprite.height - h);
    }
    return sprite.setDepth(this.depthAt(sprite.y + h / 2));
  }

  // shot: { damage, speed, pierce, blast, burn, life, tex }
  fireBullet(x, y, angle, offset, shot, damageMul = 1) {
    const bullet = this.bullets.get(x + Math.cos(angle) * offset, y + Math.sin(angle) * offset);
    if (!bullet) return;
    // Rastro com a ponta na posição da bala: a cauda fica para trás e nunca nasce atrás do cano
    bullet.setTexture(shot.tex || 'bullet').setOrigin(shot.tex ? 0.5 : 0.85, 0.5).setActive(true).setVisible(true).setDepth(3.5).setRotation(angle).setAlpha(1).setScale(1);
    // Rastro de cada arma: comprimento (trail) e cor (tint) da bala; torres e armas sem isso usam a bala padrão
    bullet.setScale(shot.trail || 1, shot.trail ? Math.min(1.3, 0.6 + shot.trail * 0.4) : 1);
    if (shot.tint) bullet.setTint(shot.tint); else bullet.clearTint();
    bullet.body.enable = true;
    bullet.body.setSize(Math.min(bullet.width, 10), Math.min(bullet.height, 10));
    bullet.damage = shot.damage * damageMul;
    bullet.pierce = shot.pierce || 0;
    bullet.blast = shot.blast || 0;
    bullet.burn = shot.burn || 0;
    bullet.life = shot.life || 1600;
    bullet.born = this.time.now;
    bullet.hits = new Set();
    this.physics.velocityFromRotation(angle, shot.speed || 700, bullet.body.velocity);
  }

  muzzleFlash(x, y, angle) {
    const f = this.add.image(x, y, 'clarao').setOrigin(0.2, 0.5).setRotation(angle).setDepth(3.6).setBlendMode('ADD');
    this.tweens.add({ targets: f, alpha: 0, scale: 1.4, duration: 70, onComplete: () => f.destroy() });
  }

  killBullet(bullet) {
    bullet.setActive(false).setVisible(false);
    bullet.body.enable = false;
    bullet.body.stop();
  }

  cleanupBullets() {
    const now = this.time.now;
    this.bullets.getChildren().forEach((b) => {
      if (!b.active) return;
      const age = now - b.born;
      if (b.texture.key === 'flame') b.setScale(1 + age / 200).setAlpha(1 - age / b.life);
      if (age > b.life || b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H) {
        if (b.blast) this.explode(b.x, b.y, b.blast, b.damage);
        this.killBullet(b);
      }
    });
  }

  hitZombie(bullet, z) {
    if (!bullet.active || bullet.hits.has(z)) return;
    bullet.hits.add(z);
    if (bullet.blast) {
      this.explode(bullet.x, bullet.y, bullet.blast, bullet.damage);
      return this.killBullet(bullet);
    }
    if (!bullet.burn) this.bloodSplash(z.x, z.y - z.displayHeight * 0.15, bullet.rotation, 5);
    this.damageZombie(z, bullet.damage, bullet.burn);
    if (bullet.pierce > 0) bullet.pierce -= 1;
    else this.killBullet(bullet);
  }

  explode(x, y, radius, damage) {
    this.fireParticles.explode(24, x, y);
    this.cameras.main.shake(120, 0.006);
    Sfx.boom();
    this.zombies.getChildren().slice().forEach((z) => {
      if (Phaser.Math.Distance.Between(x, y, z.x, z.y) < radius + z.def.radius) this.damageZombie(z, damage);
    });
  }

  hurtPlayer(amount) {
    if (this.down || this.state === 'over') return;
    if (this.now < this.camoUntil) amount *= 0.5;
    this.hp -= amount;
    this.damageTaken += amount;
    if (amount > 3) this.cameras.main.shake(80, 0.004);
    if (this.now > (this.hurtFlashAt || 0)) {
      this.hurtFlashAt = this.now + 350;
      this.hurtFlash.setAlpha(Math.min(0.45, 0.15 + amount * 0.03));
      this.tweens.add({ targets: this.hurtFlash, alpha: 0, duration: 300 });
    }
    if (!this.player.isTinted) {
      this.player.setTint(0xff6666);
      this.time.delayedCall(120, () => this.player.clearTint());
    }
    if (this.hp <= 0) this.playerDown();
  }

  playerDown() {
    this.hp = 0;
    this.down = true;
    this.downThisWave = true;
    this.releasePins();
    this.player.setVisible(false).setVelocity(0, 0);
    this.gun.setVisible(false);
    this.player.body.enable = false;
    this.setBuild(null);
    this.hud.banner('Você caiu! Volta na próxima horda');
    Sfx.lose();
  }

  respawnPlayer() {
    if (!this.down) return;
    this.down = false;
    this.hp = this.maxHp;
    this.player.setPosition(BASE_X, BASE_Y + BASE_H / 2 + 50).setVisible(true);
    this.gun.setVisible(true);
    this.player.body.enable = true;
  }

  // Apertar Espaço várias vezes solta o jogador de um Hunter ou Jockey
  struggle() {
    this.pinBreak = (this.pinBreak || 0) + 1;
    this.cameras.main.shake(40, 0.003);
    if (this.pinBreak >= (this.pinnedBy.def === ZOMBIES.hunter ? 8 : 6)) this.releasePins(true);
  }

  releasePins(shove) {
    const z = this.pinnedBy;
    if (z && z.active) {
      z.mode = 'stunned';
      z.modeUntil = this.time.now + 1500;
      z.cooldown = this.time.now + 5000;
      if (shove) {
        const a = Phaser.Math.Angle.Between(this.player.x, this.player.y, z.x, z.y);
        z.setPosition(z.x + Math.cos(a) * 50, z.y + Math.sin(a) * 50);
      }
    }
    if (this.smokedBy && this.smokedBy.active) {
      this.smokedBy.mode = 'walk';
      this.smokedBy.cooldown = this.time.now + 7000;
    }
    this.pinnedBy = null;
    this.smokedBy = null;
    this.pinBreak = 0;
  }

  // ---------- Hordas ----------

  startIntermission(seconds) {
    this.state = 'intermission';
    this.intermissionLeft = seconds;
    this.event = null;
    this.rain.stop();
    this.setNight(false);
  }

  startWave(early) {
    if (this.state !== 'intermission') return;
    this.shop.close();
    if (early && this.intermissionLeft > 1) {
      const bonus = Math.floor(this.intermissionLeft * EARLY_BONUS * this.diff.money);
      this.money += bonus;
      this.hud.floatText(`+$${bonus} por chamar antes`);
    }
    this.wave += 1;
    const w = buildWave(this.wave, { levelIndex: this.levelIndex, difficulty: this.diff, director: this.director });
    this.waveHpMul = w.hpMul;
    this.spawnQueue = w.zombies;
    this.event = w.event;
    this.waveStats = { baseHp: this.base.hp };
    this.damageTaken = 0;
    this.downThisWave = false;
    this.mainSide = Phaser.Math.Between(0, 3);
    this.state = 'wave';
    this.setNight(true);
    const ev = this.event ? `\n${EVENTS[this.event].name}: ${EVENTS[this.event].desc}` : '';
    this.hud.banner(`Horda ${this.wave}${ev}`);
    if (this.event === 'chuva') this.rain.start();
    if (w.witch) this.spawnWitch();
    this.spawnTimer = this.time.addEvent({ delay: w.spawnDelay, loop: true, callback: () => this.spawnNext() });
    this.spawnNext();
  }

  endWave() {
    this.state = 'between';
    if (this.spawnTimer) this.spawnTimer.remove();
    // Witch que ficou sentada vai embora
    this.zombies.getChildren().slice().forEach((z) => z.destroy());
    this.releasePins();
    this.director = updateDirector(this.director, {
      baseLoss: (this.waveStats.baseHp - this.base.hp) / this.base.maxHp,
      playerLoss: this.damageTaken / this.maxHp,
      playerDowned: this.downThisWave,
    });
    const bonus = Math.round((20 + this.wave * 4) * this.diff.money * (this.event === 'dupla' ? 2 : 1));
    this.money += bonus;
    this.respawnPlayer();
    if (this.wave >= this.wavesToWin) return this.victory();
    this.hud.banner(`Horda ${this.wave} vencida! +$${bonus}`, UI.green);
    this.startIntermission(INTERMISSION);
  }

  drawHpBars() {
    const g = this.hpBars;
    g.clear();
    const bar = (x, y, w, frac, color) => {
      g.fillStyle(0x1b1424).fillRect(x - 1, y - 1, w + 2, 6);
      g.fillStyle(color).fillRect(x, y, w * Math.max(0, frac), 4);
    };
    this.zombies.getChildren().forEach((z) => {
      if (z.hp >= z.maxHp) return;
      const w = z.def.radius * 2;
      bar(z.x - w / 2, z.y - z.displayHeight / 2 - 8, w, z.hp / z.maxHp, 0xe8453c);
    });
    this.structures.forEach((s) => {
      if (!s.maxHp || s.hp >= s.maxHp) return;
      bar(s.x - 18, s.y + GRID / 2 - s.sprite.displayHeight - 8, 36, s.hp / s.maxHp, 0x7fdfff);
    });
  }

  drawFx() {
    const g = this.fx;
    g.clear();
    const now = this.time.now;
    this.bolts = this.bolts.filter((b) => b.until > now);
    this.bolts.forEach((b) => {
      g.lineStyle(3, 0x7fdfff, 0.9);
      g.strokePoints(b.points);
      g.lineStyle(1, 0xffffff, 1);
      g.strokePoints(b.points);
    });
    if (this.smokedBy) this.drawTongue(g, this.smokedBy, this.player, now);
    this.zombies.getChildren().forEach((z) => {
      if (z.def.aura) {
        // Nuvem de gás em volta do Venenoso: bolhas que giram devagar, em vez de um disco chapado
        for (let i = 0; i < 5; i++) {
          const a = now / 1800 + i * 1.257 + z.x * 0.01;
          const r = z.def.aura * (0.45 + 0.12 * Math.sin(now / 700 + i));
          g.fillStyle(0x6f7a3a, 0.07).fillCircle(z.x + Math.cos(a) * z.def.aura * 0.4, z.y + Math.sin(a) * z.def.aura * 0.3, r);
        }
      }
      if (z.mode === 'crouch' || z.mode === 'windup') g.lineStyle(2, 0xe8453c, 0.8).strokeCircle(z.x, z.y, z.def.radius + 8);
    });
  }

  // Língua do Smoker: corda de carne ondulada, com contorno escuro e nós (a linha rosa lisa destoava)
  drawTongue(g, from, to, now) {
    const n = 18;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const onda = Math.sin(t * Math.PI * 3 + now / 90) * 5 * Math.sin(t * Math.PI);
      pts.push(new Phaser.Math.Vector2(from.x + dx * t + nx * onda, from.y + dy * t + ny * onda));
    }
    g.lineStyle(6, 0x2a1418, 0.9).strokePoints(pts);
    g.lineStyle(3.5, 0x8a3a44).strokePoints(pts);
    g.lineStyle(1.2, 0xc06a6e, 0.8).strokePoints(pts.map((p) => new Phaser.Math.Vector2(p.x, p.y - 1)));
    for (let i = 3; i < n; i += 4) g.fillStyle(0x5a2228).fillCircle(pts[i].x, pts[i].y, 2.6);
  }

  // ---------- Loja e helicóptero ----------

  // item: { kind: 'weapon' | 'pet' | 'item', id, name }
  deliver(item) {
    const fromLeft = Math.random() < 0.5;
    const cam = this.cameras.main;
    const startX = fromLeft ? cam.scrollX - 150 : cam.scrollX + GAME_W + 150;
    const heli = this.add.image(startX, 0, 'heli').setDepth(14).setFlipX(!fromLeft);
    const dropX = Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(-150, 150), 60, WORLD_W - 60);
    const dropY = Phaser.Math.Clamp(this.player.y + Phaser.Math.Between(-120, 120), 60, WORLD_H - 60);
    heli.y = dropY - 40;
    Sfx.heli();
    this.tweens.add({
      targets: heli, x: dropX, duration: 1400, ease: 'Sine.easeOut',
      onComplete: () => {
        const crate = this.crates.create(dropX, dropY - 60, 'crate').setDepth(2);
        crate.item = item;
        crate.body.enable = false;
        this.tweens.add({ targets: crate, y: dropY, duration: 500, ease: 'Bounce.easeOut', onComplete: () => { crate.body.enable = true; } });
        this.tweens.add({ targets: heli, x: fromLeft ? dropX + 1500 : dropX - 1500, duration: 1400, ease: 'Sine.easeIn', onComplete: () => heli.destroy() });
      },
    });
  }

  pickCrate(crate) {
    const { kind, id } = crate.item;
    if (kind === 'weapon') {
      if (!this.owned.includes(id)) this.owned.push(id);
      this.weapon = WEAPONS[id];
    }
    if (kind === 'pet') this.spawnPet(id);
    if (id === 'colete') { this.maxHp += 50; this.hp += 50; }
    if (id === 'kit') this.hp = this.maxHp;
    if (id === 'reparo') this.base.hp = Math.min(this.base.maxHp, this.base.hp + 200);
    this.hud.banner(`Pegou: ${crate.item.name}`, UI.gold);
    crate.destroy();
    Sfx.pick();
  }

  // ---------- Fim de jogo ----------

  gameOver(reason) {
    if (this.state === 'over') return;
    this.state = 'over';
    this.physics.pause();
    if (this.spawnTimer) this.spawnTimer.remove();
    this.rain.stop();
    this.shop.close();
    this.panel.close();
    this.setBuild(null);
    let stats = `Você chegou à horda ${this.wave} (${this.diff.name}).`;
    if (this.infinite) stats += ` Recorde no modo infinito: horda ${saveInfiniteRecord(this.levelIndex, this.wave)}.`;
    this.hud.endScreen('FIM DE JOGO', reason, stats, '[R] recomeçar   [M] menu');
    Sfx.lose();
  }

  victory() {
    this.state = 'over';
    this.won = true;
    this.physics.pause();
    this.rain.stop();
    this.setBuild(null);
    this.panel.close();
    addMedal(this.levelIndex, this.diff.id);
    const hasNext = this.levelIndex + 1 < LEVELS.length;
    if (hasNext) unlockLevel(this.levelIndex + 1);
    const reason = hasNext
      ? `${this.level.name} limpo! Mas o helicóptero só pousa mais adiante...`
      : 'O helicóptero de resgate chegou. A família está a salva (e o pet também)!';
    const hint = hasNext ? `[N] próximo nível: ${LEVELS[this.levelIndex + 1].name}   [M] menu` : '[R] jogar de novo   [M] menu';
    this.hud.endScreen('VITÓRIA!', reason, `Medalha ${this.diff.name} conquistada. Modo infinito liberado neste nível.`, hint);
    Sfx.win();
  }
}
