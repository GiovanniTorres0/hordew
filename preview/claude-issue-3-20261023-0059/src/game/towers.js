// Construções: colocar no grid, atirar, upgrades no estilo Bloons TD, vender, consertar e quebrar.
const TowerLogic = {
  setBuild(type) {
    this.buildType = type;
    this.ghost.setVisible(!!type);
    const def = type && BUILDINGS[type];
    this.rangeCircle.setVisible(!!(def && (def.range || def.blast)));
    if (def) {
      this.ghost.setTexture(def.tex);
      this.rangeCircle.setRadius(def.range || def.blast);
      this.panel.close();
      this.shop.close();
    }
  },

  snap(p) {
    const cx = Math.floor(p.x / GRID) * GRID + GRID / 2;
    const cy = Math.floor(p.y / GRID) * GRID + GRID / 2;
    return { cx, cy, key: `${cx},${cy}` };
  },

  // Cada construção nova do mesmo tipo fica mais cara, para não dar para cobrir o mapa
  buildCost(type) {
    const def = BUILDINGS[type];
    return def.cost + def.costStep * (this.builtCount[type] || 0);
  },

  canBuildAt({ cx, cy, key }) {
    const nearBase = Math.abs(cx - BASE_X) < BASE_W / 2 + GRID / 2 && Math.abs(cy - BASE_Y) < BASE_H / 2 + GRID / 2;
    const inside = cx > GRID && cy > GRID && cx < WORLD_W - GRID && cy < WORLD_H - GRID;
    return inside && !nearBase && !isWater(cx, cy) && !this.occupied.has(key) && this.money >= this.buildCost(this.buildType);
  },

  updateGhost() {
    if (!this.buildType) return;
    const cell = this.snap(this.worldPointer());
    this.ghost.setPosition(cell.cx, cell.cy);
    this.rangeCircle.setPosition(cell.cx, cell.cy);
    this.ghost.setTint(this.canBuildAt(cell) ? 0xffffff : 0xff4444);
  },

  tryBuild(p) {
    const cell = this.snap(p);
    if (!this.canBuildAt(cell)) return;
    const type = this.buildType;
    const def = BUILDINGS[type];
    const cost = this.buildCost(type);
    this.money -= cost;
    this.builtCount[type] = (this.builtCount[type] || 0) + 1;
    this.occupied.add(cell.key);

    const s = { type, def, x: cell.cx, y: cell.cy, cellKey: cell.key, spent: cost, levels: [0, 0, 0], lastShot: 0 };
    if (def.block) s.sprite = this.blockers.create(cell.cx, cell.cy, def.tex).setDepth(1);
    else s.sprite = this.add.image(cell.cx, cell.cy, def.tex).setDepth(0.9);
    s.sprite.structure = s;
    if (def.gunTex) s.gun = this.add.image(cell.cx, cell.cy, def.gunTex).setOrigin(14 / 40, 0.5).setDepth(3);
    if (def.hp) s.hp = s.maxHp = def.hp;
    if (type === 'espinhos') s.durability = def.durability;
    this.computeStats(s);
    this.structures.push(s);
    Sfx.build();
  },

  structureAt(x, y) {
    if (Math.abs(x - BASE_X) < BASE_W / 2 && Math.abs(y - BASE_Y) < BASE_H / 2) return this.base;
    const { key } = this.snap({ x, y });
    return this.structures.find((s) => s.cellKey === key) || null;
  },

  // Aplica os upgrades nas estatísticas da torre
  computeStats(s) {
    const d = s.def;
    const st = { range: d.range, fireDelay: d.fireDelay, damage: d.damage, light: d.light || 0 };
    const [sp, dm, ut] = s.levels;
    for (let i = 0; i < sp; i++) st.fireDelay *= UPGRADE_PATHS[0].mul[i];
    for (let i = 0; i < dm; i++) st.damage *= UPGRADE_PATHS[1].mul[i];
    for (let i = 0; i < ut; i++) st.range *= UPGRADE_PATHS[2].mul[i];
    if (ut >= 3) st.light *= 1.6;
    s.stats = st;
    if (s.gun) s.gun.setTint(dm >= 2 ? 0xff9b9b : sp >= 2 ? 0x9bffb0 : 0xffffff);
  },

  // Bloons: no máximo 2 das 3 linhas podem ter upgrade
  canUpgrade(s, path) {
    if (!s.def.upgradable || s.levels[path] >= 3) return false;
    const used = s.levels.filter((l) => l > 0).length;
    return s.levels[path] > 0 || used < 2;
  },

  upgradeCost(s, path) {
    return Math.round(s.def.cost * UPGRADE_COST[s.levels[path]]);
  },

  upgrade(s, path) {
    const cost = this.upgradeCost(s, path);
    if (!this.canUpgrade(s, path) || this.money < cost) return false;
    this.money -= cost;
    s.spent += cost;
    s.levels[path] += 1;
    if (path === 2 && s.levels[2] === 2) { s.maxHp = Math.round(s.maxHp * 1.5); s.hp = s.maxHp; }
    this.computeStats(s);
    Sfx.build();
    return true;
  },

  repairCost(s) {
    if (!s.maxHp || s.hp >= s.maxHp) return 0;
    return Math.max(1, Math.ceil((s.maxHp - s.hp) * (s === this.base ? 0.4 : 0.5)));
  },

  repair(s) {
    const cost = this.repairCost(s);
    if (!cost || this.money < cost) return false;
    this.money -= cost;
    s.hp = s.maxHp;
    Sfx.build();
    return true;
  },

  sellValue(s) {
    return Math.floor(s.spent * SELL_RATE);
  },

  sell(s) {
    if (s === this.base) return;
    this.money += this.sellValue(s);
    this.removeStructure(s);
    Sfx.sell();
  },

  removeStructure(s) {
    this.builtCount[s.type] -= 1;
    this.occupied.delete(s.cellKey);
    s.sprite.destroy();
    if (s.gun) s.gun.destroy();
    s.hp = 0;
    this.structures = this.structures.filter((o) => o !== s);
    if (this.panel.target === s) this.panel.close();
  },

  damageStructure(s, amount) {
    if (!s.maxHp || s.hp <= 0) return;
    if (s === this.base) amount *= BASE_ARMOR;
    s.hp -= amount;
    if (s === this.base) {
      if (s.hp <= 0) this.gameOver('Os zumbis destruíram a base!');
      else if (this.now - (this.lastBaseAlarm || 0) > 4000) {
        this.lastBaseAlarm = this.now;
        this.hud.floatText('A base está sendo atacada!');
        Sfx.alarm();
      }
      return;
    }
    if (s.hp <= 0) {
      this.particles.explode(16, s.x, s.y);
      this.hud.floatText(`${s.def.name} destruída!`);
      Sfx.crack();
      this.removeStructure(s);
    }
  },

  nearestZombie(x, y, range) {
    let best = null;
    let bestD = range;
    this.zombies.getChildren().forEach((z) => {
      if (z.mode === 'sit') return; // torres não acordam a Witch
      const d = Phaser.Math.Distance.Between(x, y, z.x, z.y);
      if (d < bestD) { bestD = d; best = z; }
    });
    return best;
  },

  updateStructures(dt) {
    const now = this.time.now;
    if (this.event === 'chuva' && this.state === 'wave') {
      this.structures.forEach((s) => this.damageStructure(s, 0.6 * dt));
    }
    // A família atira pela janela: defesa mínima da base para todos os lados
    const fam = this.nearestZombie(BASE_X, BASE_Y, BASE_FIRE.range);
    if (fam && now - (this.base.lastShot || 0) > BASE_FIRE.fireDelay) {
      this.base.lastShot = now;
      this.fireBullet(BASE_X, BASE_Y, Phaser.Math.Angle.Between(BASE_X, BASE_Y, fam.x, fam.y), BASE_W / 2, { damage: BASE_FIRE.damage, speed: 650 });
    }
    this.structures.slice().forEach((s) => {
      if (s.hp !== undefined && s.hp <= 0) return;
      const st = s.stats;
      if (s.type === 'torreta' || s.type === 'chamas') {
        const z = this.nearestZombie(s.x, s.y, st.range);
        if (!z) return;
        s.gun.rotation = Phaser.Math.Angle.Between(s.x, s.y, z.x, z.y);
        if (now - s.lastShot < st.fireDelay) return;
        s.lastShot = now;
        if (s.type === 'torreta') this.fireBullet(s.x, s.y, s.gun.rotation, 24, { damage: st.damage, speed: 700 });
        else {
          const a = s.gun.rotation + Phaser.Math.FloatBetween(-0.25, 0.25);
          this.fireBullet(s.x, s.y, a, 22, { damage: st.damage, speed: 330, life: (st.range / 330) * 1000, burn: s.def.burn, tex: 'flame' });
        }
      } else if (s.type === 'tesla') {
        if (this.event === 'apagao' || now - s.lastShot < st.fireDelay) return;
        const first = this.nearestZombie(s.x, s.y, st.range);
        if (!first) return;
        s.lastShot = now;
        const points = [new Phaser.Math.Vector2(s.x, s.y)];
        const hit = [first];
        let cur = first;
        while (hit.length < s.def.chain + s.levels[2]) {
          const next = this.zombies.getChildren().find((z) => !hit.includes(z) && z.mode !== 'sit' && Phaser.Math.Distance.Between(cur.x, cur.y, z.x, z.y) < 110);
          if (!next) break;
          hit.push(next);
          cur = next;
        }
        hit.forEach((z) => {
          const last = points[points.length - 1];
          points.push(new Phaser.Math.Vector2((last.x + z.x) / 2 + Phaser.Math.Between(-10, 10), (last.y + z.y) / 2 + Phaser.Math.Between(-10, 10)));
          points.push(new Phaser.Math.Vector2(z.x, z.y));
        });
        this.bolts.push({ points, until: now + 120 });
        hit.forEach((z) => this.damageZombie(z, st.damage));
        Sfx.zap();
      } else if (s.type === 'espinhos') {
        this.zombies.getChildren().slice().forEach((z) => {
          if (Math.abs(z.x - s.x) < GRID / 2 + 6 && Math.abs(z.y - s.y) < GRID / 2 + 6) {
            z.slow = s.def.slow;
            this.damageZombie(z, s.def.dps * dt, 0, true);
            s.durability -= dt;
          }
        });
        s.sprite.setAlpha(0.4 + 0.6 * (s.durability / s.def.durability));
        if (s.durability <= 0) this.removeStructure(s);
      } else if (s.type === 'mina') {
        const z = this.nearestZombie(s.x, s.y, 32);
        if (z) {
          this.removeStructure(s);
          this.explode(s.x, s.y, s.def.blast, s.def.damage);
        }
      }
    });
  },
};

Object.assign(GameScene.prototype, TowerLogic);
