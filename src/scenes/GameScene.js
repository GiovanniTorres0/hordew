class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.levelIndex = (data && data.level) || 0;
    this.level = LEVELS[this.levelIndex];
    this.money = START_MONEY;
    this.wave = 0;
    this.state = 'intermission';
    this.won = false;
    this.weapon = WEAPONS.pistola;
    this.damageMul = 1;
    this.maxHp = PLAYER.maxHp;
    this.hp = this.maxHp;
    this.buildType = null;
    this.occupied = new Set();
    this.turrets = [];
    this.spawnQueue = [];
  }

  create() {
    this.physics.resume(); // o mundo de física sobrevive ao restart e pode estar pausado pelo fim de jogo
    this.drawMap();
    this.createPlayer();
    this.zombies = this.physics.add.group();
    this.spikes = this.physics.add.staticGroup();
    this.crates = this.physics.add.group();
    this.particles = this.add.particles(0, 0, 'dot', {
      speed: { min: 60, max: 180 }, lifespan: 450, scale: { start: 1.2, end: 0 }, tint: PALETTE.blood, emitting: false,
    }).setDepth(5);

    this.physics.add.collider(this.zombies, this.zombies);
    this.physics.add.overlap(this.bullets, this.zombies, (b, z) => this.hitZombie(b, z));
    this.physics.add.overlap(this.player, this.crates, (p, c) => this.pickCrate(c));

    this.hpBars = this.add.graphics().setDepth(6);
    this.rangeCircle = this.add.circle(0, 0, BUILDINGS.torreta.range, 0xffffff, 0.08).setStrokeStyle(2, 0xffffff, 0.3).setVisible(false).setDepth(1);

    this.createInput();
    this.hud = new Hud(this);
    this.shop = new Shop(this);
    this.startIntermission(25);
  }

  // ---------- Mapa ----------

  drawMap() {
    const P = PALETTE;
    const lv = this.level;
    this.add.tileSprite(0, 0, GAME_W, GAME_H, `ground${this.levelIndex}`).setOrigin(0);
    this.add.rectangle(0, GAME_H / 2 - 50, GAME_W, 100, lv.street).setOrigin(0);

    // Decoração fora da rua (sem colisão), sempre nas mesmas posições
    const rnd = new Phaser.Math.RandomDataGenerator([lv.name]);
    for (let i = 0; i < 9; i++) {
      const x = rnd.between(FINAL_LINE_X + 40, GAME_W - 30);
      const top = rnd.frac() < 0.5;
      const y = top ? rnd.between(HUD_H + 50, GAME_H / 2 - 90) : rnd.between(GAME_H / 2 + 90, GAME_H - 40);
      this.add.image(x, y, lv.decor).setOrigin(0.5, 1).setAngle(rnd.between(-12, 12)).setAlpha(0.85).setDepth(0.5);
    }
    if (this.cameras.main.postFX) this.cameras.main.postFX.addVignette(0.5, 0.5, 0.95, 0.35);
    const marks = this.add.graphics().fillStyle(0xe9e2c8, 0.7);
    for (let x = FINAL_LINE_X + 20; x < GAME_W; x += 80) marks.fillRect(x, GAME_H / 2 - 3, 40, 6);

    const house = this.add.graphics();
    house.lineStyle(4, P.outline);
    house.fillStyle(P.house).fillRect(10, 140, HOUSE_W - 20, GAME_H - 260);
    house.strokeRect(10, 140, HOUSE_W - 20, GAME_H - 260);
    house.fillStyle(P.roof).fillTriangle(0, 145, HOUSE_W / 2, 60, HOUSE_W, 145);
    house.strokeTriangle(0, 145, HOUSE_W / 2, 60, HOUSE_W, 145);
    house.fillStyle(P.window);
    [190, 300, 410, 520].forEach((y) => {
      house.fillRect(55, y, 50, 40);
      house.strokeRect(55, y, 50, 40);
    });

    const line = this.add.graphics();
    line.fillStyle(P.line);
    for (let y = HUD_H; y < GAME_H; y += 30) line.fillRect(FINAL_LINE_X - 3, y, 6, 18);
  }

  // ---------- Jogador ----------

  createPlayer() {
    this.player = this.physics.add.sprite(FINAL_LINE_X + 120, GAME_H / 2, 'player').setDepth(3);
    this.player.setCollideWorldBounds(true);
    this.player.body.setCircle(13, 5, 5);
    this.lastShot = 0;
    this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 150 });

    // Cachorro: segue o jogador e morde zumbis que chegam perto
    this.dog = this.physics.add.sprite(this.player.x - 40, this.player.y + 30, 'dog').setDepth(3);
    this.dog.lastBark = 0;
  }

  updateDog(time, dt) {
    const d = this.dog;
    let target = null;
    let best = DOG.sight;
    this.zombies.getChildren().forEach((z) => {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, z.x, z.y);
      if (dist < best) { best = dist; target = z; }
    });

    let tx = this.player.x - 35;
    let ty = this.player.y + 30;
    if (target) { tx = target.x; ty = target.y; }
    const dist = Phaser.Math.Distance.Between(d.x, d.y, tx, ty);
    if (dist > 8) {
      const angle = Phaser.Math.Angle.Between(d.x, d.y, tx, ty);
      const speed = target ? DOG.speed : Math.min(DOG.speed, dist * 3);
      this.physics.velocityFromRotation(angle, speed, d.body.velocity);
      d.rotation = angle;
    } else d.setVelocity(0, 0);

    if (target && Phaser.Math.Distance.Between(d.x, d.y, target.x, target.y) < target.def.radius + 18) {
      target.slow = Math.min(target.slow, 0.6);
      this.damageZombie(target, DOG.dps * dt);
      if (time - d.lastBark > 1500) { Sfx.bark(); d.lastBark = time; }
    }
  }

  createInput() {
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.input.mouse.disableContextMenu();
    this.input.keyboard.on('keydown-ONE', () => this.setBuild('torreta'));
    this.input.keyboard.on('keydown-TWO', () => this.setBuild('espinhos'));
    this.input.keyboard.on('keydown-ESC', () => { this.setBuild(null); this.shop.close(); });
    this.input.keyboard.on('keydown-L', () => this.shop.toggle());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.input.keyboard.on('keydown-SPACE', () => { if (this.state === 'intermission') this.startWave(); });
    this.input.keyboard.on('keydown-R', () => { if (this.state === 'over') this.scene.restart({ level: this.levelIndex }); });
    this.input.keyboard.on('keydown-M', () => { if (this.state === 'over') this.scene.start('Menu'); });
    this.input.keyboard.on('keydown-N', () => {
      if (this.state === 'over' && this.won && this.levelIndex + 1 < LEVELS.length) this.scene.restart({ level: this.levelIndex + 1 });
    });

    this.ghost = this.add.image(0, 0, 'turret_base').setAlpha(0.6).setVisible(false).setDepth(4);
    this.input.on('pointerdown', (pointer) => {
      if (pointer.rightButtonDown()) return this.setBuild(null);
      if (this.buildType && !this.shop.isOpen) this.tryBuild(pointer);
    });
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

  drawHpBars() {
    this.hpBars.clear();
    this.zombies.getChildren().forEach((z) => {
      if (z.hp >= z.maxHp) return;
      const w = z.def.radius * 2;
      const x = z.x - w / 2;
      const y = z.y - z.def.radius - 12;
      this.hpBars.fillStyle(0x1b1424).fillRect(x - 1, y - 1, w + 2, 6);
      this.hpBars.fillStyle(0xe8453c).fillRect(x, y, w * Math.max(0, z.hp / z.maxHp), 4);
    });
  }

  update(time, delta) {
    if (this.state === 'over' || this.paused) return;
    const dt = delta / 1000;
    this.drawHpBars();
    this.updatePlayer(time);
    this.updateGhost();
    this.updateDog(time, dt);
    this.updateZombies(dt);
    this.updateTurrets(time);
    this.updateSpikes(dt);
    this.cleanupBullets();
    if (this.state === 'intermission') {
      this.intermissionLeft -= dt;
      if (this.intermissionLeft <= 0) this.startWave();
    }
    this.hud.update();
  }

  updatePlayer(time) {
    const k = this.keys;
    const vx = (k.D.isDown ? 1 : 0) - (k.A.isDown ? 1 : 0);
    const vy = (k.S.isDown ? 1 : 0) - (k.W.isDown ? 1 : 0);
    const v = new Phaser.Math.Vector2(vx, vy).normalize().scale(PLAYER.speed);
    this.player.setVelocity(v.x, v.y);
    if (this.player.x < FINAL_LINE_X + 15) this.player.x = FINAL_LINE_X + 15;
    if (this.player.y < HUD_H + 15) this.player.y = HUD_H + 15;

    const pointer = this.input.activePointer;
    this.player.rotation = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);

    const canShoot = !this.buildType && !this.shop.isOpen;
    if (canShoot && pointer.leftButtonDown() && time - this.lastShot > this.weapon.fireDelay) {
      for (let i = 0; i < this.weapon.pellets; i++) {
        const angle = this.player.rotation + Phaser.Math.FloatBetween(-this.weapon.spread, this.weapon.spread) / 2;
        this.fireBullet(this.player.x, this.player.y, angle, 22, this.weapon.damage * this.damageMul);
      }
      this.lastShot = time;
      Sfx.shot();
    }
  }

  fireBullet(x, y, angle, offset, damage) {
    const bullet = this.bullets.get(x + Math.cos(angle) * offset, y + Math.sin(angle) * offset);
    if (!bullet) return;
    bullet.setActive(true).setVisible(true).setDepth(2);
    bullet.body.enable = true;
    bullet.damage = damage;
    this.physics.velocityFromRotation(angle, PLAYER.bulletSpeed, bullet.body.velocity);
  }

  killBullet(bullet) {
    bullet.setActive(false).setVisible(false);
    bullet.body.enable = false;
    bullet.body.stop();
  }

  cleanupBullets() {
    this.bullets.getChildren().forEach((b) => {
      if (b.active && (b.x < -20 || b.x > GAME_W + 20 || b.y < -20 || b.y > GAME_H + 20)) this.killBullet(b);
    });
  }

  hurtPlayer(amount) {
    this.hp -= amount;
    this.cameras.main.shake(80, 0.003);
    if (!this.player.isTinted) {
      this.player.setTint(0xff6666);
      this.time.delayedCall(120, () => this.player.clearTint());
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.gameOver('Você foi devorado!');
    }
  }

  // ---------- Hordas ----------

  startIntermission(seconds) {
    this.state = 'intermission';
    this.intermissionLeft = seconds;
  }

  startWave() {
    this.shop.close();
    this.wave += 1;
    const w = buildWave(this.wave, this.levelIndex);
    this.waveHpMul = w.hpMul;
    this.spawnQueue = w.zombies;
    this.waveTotal = w.zombies.length;
    this.state = 'wave';
    this.hud.banner(`Horda ${this.wave}`);
    this.spawnTimer = this.time.addEvent({
      delay: w.spawnDelay, loop: true, callback: () => this.spawnNext(),
    });
    this.spawnNext();
  }

  spawnNext() {
    const type = this.spawnQueue.pop();
    if (!type) {
      this.spawnTimer.remove();
      return;
    }
    const def = ZOMBIES[type];
    const y = Phaser.Math.Between(HUD_H + 30, GAME_H - 30);
    const z = this.zombies.create(GAME_W + 30, y, def.tex).setDepth(2);
    const size = def.radius * 2 + 16;
    z.body.setCircle(def.radius, (size - def.radius * 2) / 2, (size - def.radius * 2) / 2);
    z.def = def;
    z.hp = z.maxHp = def.hp * this.waveHpMul;
    z.targetY = Phaser.Math.Between(HUD_H + 30, GAME_H - 30);
    z.wobble = Math.random() * 1000;
    z.slow = 1;
    if (Math.random() < 0.25) Sfx.groan();
  }

  updateZombies(dt) {
    const p = this.player;
    this.zombies.getChildren().forEach((z) => {
      const speed = z.def.speed * z.slow;
      z.slow = 1;
      const dist = Phaser.Math.Distance.Between(z.x, z.y, p.x, p.y);
      let angle;
      if (dist < 160) angle = Phaser.Math.Angle.Between(z.x, z.y, p.x, p.y);
      else angle = Phaser.Math.Angle.Between(z.x, z.y, FINAL_LINE_X - 50, z.targetY);
      angle += Math.sin((this.time.now + z.wobble) / 400) * 0.25;
      this.physics.velocityFromRotation(angle, speed, z.body.velocity);
      z.rotation = angle;

      if (dist < z.def.radius + 16) this.hurtPlayer(z.def.dps * dt);
      if (z.x < FINAL_LINE_X && this.state !== 'over') this.gameOver('Um zumbi chegou na casa!');
    });

    if (this.state === 'wave' && this.spawnQueue.length === 0 && this.zombies.countActive() === 0) this.endWave();
  }

  hitZombie(bullet, z) {
    if (!bullet.active) return;
    this.killBullet(bullet);
    this.damageZombie(z, bullet.damage);
  }

  damageZombie(z, amount) {
    if (!z.active) return;
    z.hp -= amount;
    z.setTintFill(0xffffff);
    this.time.delayedCall(60, () => z.active && z.clearTint());
    if (z.hp <= 0) {
      this.particles.explode(z.def === ZOMBIES.brutamonte ? 40 : 12, z.x, z.y);
      if (z.def === ZOMBIES.brutamonte) this.cameras.main.shake(250, 0.01);
      this.money += z.def.reward;
      z.destroy();
      Sfx.splat();
    }
  }

  endWave() {
    this.state = 'between';
    const bonus = 30 + this.wave * 10;
    this.money += bonus;
    if (this.wave >= this.level.wavesToWin) return this.victory();
    this.hud.banner(`Horda ${this.wave} vencida! +$${bonus}`);
    this.startIntermission(20);
  }

  // ---------- Construção ----------

  setBuild(type) {
    this.buildType = type;
    this.ghost.setVisible(!!type);
    this.rangeCircle.setVisible(type === 'torreta');
    if (type) this.ghost.setTexture(type === 'torreta' ? 'turret_base' : 'spikes');
  }

  snap(pointer) {
    const cx = Math.floor(pointer.worldX / GRID) * GRID + GRID / 2;
    const cy = Math.floor(pointer.worldY / GRID) * GRID + GRID / 2;
    return { cx, cy, key: `${cx},${cy}` };
  }

  canBuildAt({ cx, cy, key }) {
    const def = BUILDINGS[this.buildType];
    return cx - GRID / 2 >= FINAL_LINE_X + 10 && cy - GRID / 2 >= HUD_H && !this.occupied.has(key) && this.money >= def.cost;
  }

  updateGhost() {
    if (!this.buildType) return;
    const cell = this.snap(this.input.activePointer);
    this.ghost.setPosition(cell.cx, cell.cy);
    this.rangeCircle.setPosition(cell.cx, cell.cy);
    this.ghost.setTint(this.canBuildAt(cell) ? 0xffffff : 0xff4444);
  }

  tryBuild(pointer) {
    const cell = this.snap(pointer);
    if (!this.canBuildAt(cell)) return;
    const def = BUILDINGS[this.buildType];
    this.money -= def.cost;
    this.occupied.add(cell.key);
    if (this.buildType === 'torreta') {
      const base = this.add.image(cell.cx, cell.cy, 'turret_base').setDepth(1);
      const gun = this.add.image(cell.cx, cell.cy, 'turret_gun').setOrigin(14 / 40, 0.5).setDepth(3);
      this.turrets.push({ base, gun, lastShot: 0, def });
    } else {
      const s = this.spikes.create(cell.cx, cell.cy, 'spikes').setDepth(1);
      s.durability = def.durability;
      s.cellKey = cell.key;
    }
    Sfx.build();
  }

  updateTurrets(time) {
    const zs = this.zombies.getChildren();
    this.turrets.forEach((t) => {
      let best = null;
      let bestD = t.def.range;
      zs.forEach((z) => {
        const d = Phaser.Math.Distance.Between(t.base.x, t.base.y, z.x, z.y);
        if (d < bestD) { bestD = d; best = z; }
      });
      if (!best) return;
      t.gun.rotation = Phaser.Math.Angle.Between(t.base.x, t.base.y, best.x, best.y);
      if (time - t.lastShot > t.def.fireDelay) {
        this.fireBullet(t.base.x, t.base.y, t.gun.rotation, 24, t.def.damage * this.damageMul);
        t.lastShot = time;
      }
    });
  }

  updateSpikes(dt) {
    const def = BUILDINGS.espinhos;
    this.spikes.getChildren().slice().forEach((s) => {
      this.zombies.getChildren().forEach((z) => {
        if (Math.abs(z.x - s.x) < GRID / 2 + 6 && Math.abs(z.y - s.y) < GRID / 2 + 6) {
          z.slow = def.slow;
          this.damageZombie(z, def.dps * dt);
          s.durability -= dt;
        }
      });
      s.setAlpha(0.4 + 0.6 * (s.durability / def.durability));
      if (s.durability <= 0) {
        this.occupied.delete(s.cellKey);
        s.destroy();
      }
    });
  }

  // ---------- Loja e helicóptero ----------

  deliver(item) {
    const heli = this.add.image(-100, 0, 'heli').setDepth(10);
    const dropX = Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(-150, 150), FINAL_LINE_X + 60, GAME_W - 60);
    const dropY = Phaser.Math.Clamp(this.player.y + Phaser.Math.Between(-120, 120), HUD_H + 60, GAME_H - 60);
    heli.y = dropY - 40;
    Sfx.heli();
    this.tweens.add({
      targets: heli, x: dropX, duration: 1400, ease: 'Sine.easeOut',
      onComplete: () => {
        const crate = this.crates.create(dropX, dropY - 60, 'crate').setDepth(2);
        crate.item = item;
        crate.body.enable = false;
        this.tweens.add({ targets: crate, y: dropY, duration: 500, ease: 'Bounce.easeOut', onComplete: () => { crate.body.enable = true; } });
        this.tweens.add({ targets: heli, x: GAME_W + 150, duration: 1400, ease: 'Sine.easeIn', onComplete: () => heli.destroy() });
      },
    });
  }

  pickCrate(crate) {
    const id = crate.item.id;
    if (id === 'metralhadora' || id === 'escopeta') this.weapon = WEAPONS[id];
    if (id === 'colete') { this.maxHp += 50; this.hp += 50; }
    if (id === 'kit') this.hp = this.maxHp;
    if (id === 'municao') this.damageMul *= 1.5;
    this.hud.banner(`Pegou: ${crate.item.name}`);
    crate.destroy();
    Sfx.pick();
  }

  // ---------- Fim de jogo ----------

  saveRecord() {
    const best = storageGet('hordew_recorde', 0);
    const now = this.levelIndex * 100 + this.wave;
    if (now > best) storageSet('hordew_recorde', now);
    return Math.max(best, now);
  }

  gameOver(reason) {
    this.state = 'over';
    this.physics.pause();
    if (this.spawnTimer) this.spawnTimer.remove();
    this.shop.close();
    this.setBuild(null);
    const record = this.saveRecord();
    this.hud.endScreen('FIM DE JOGO', reason, `Você chegou à horda ${this.wave}. ${recordText(record)}`, '[R] recomeçar   [M] menu');
    Sfx.lose();
  }

  victory() {
    this.state = 'over';
    this.won = true;
    this.physics.pause();
    this.setBuild(null);
    const record = this.saveRecord();
    const hasNext = this.levelIndex + 1 < LEVELS.length;
    if (hasNext) unlockLevel(this.levelIndex + 1);
    const reason = hasNext
      ? `${this.level.name} limpo! Mas o helicóptero só pousa mais adiante...`
      : 'O helicóptero de resgate chegou. A família está a salvo (e o cachorro também)!';
    const hint = hasNext ? `[N] próximo nível: ${LEVELS[this.levelIndex + 1].name}   [M] menu` : '[R] jogar de novo   [M] menu';
    this.hud.endScreen('VITÓRIA!', reason, `Todas as ${this.wave} hordas vencidas. ${recordText(record)}`, hint);
    Sfx.win();
  }
}
