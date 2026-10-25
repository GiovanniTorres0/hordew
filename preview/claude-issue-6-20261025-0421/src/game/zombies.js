// Zumbis: nascimento nas bordas do mapa, escolha de alvo e os especiais no estilo Left 4 Dead 2.
// z.mode controla os especiais: walk, crouch, leap, pin, ride, pull, windup, charge, sit, rage, stunned
const ZombieLogic = {
  spawnNext() {
    const type = this.spawnQueue.pop();
    if (!type) {
      this.spawnTimer.remove();
      return;
    }
    // Metade dos zumbis vem de um lado principal da horda, o resto de qualquer lado
    const side = Math.random() < 0.5 ? this.mainSide : Phaser.Math.Between(0, 3);
    const t = Math.random();
    const pos = [
      [t * WORLD_W, 12], [WORLD_W - 12, t * WORLD_H], [t * WORLD_W, WORLD_H - 12], [12, t * WORLD_H],
    ][side];
    this.createZombie(type, pos[0], pos[1]);
    if (type === 'tank') {
      this.announce('TANK!');
      this.cameras.main.shake(400, 0.008);
      this.netSfx('roar');
    } else if (Math.random() < 0.2) Sfx.groan();
  },

  createZombie(type, x, y) {
    const def = ZOMBIES[type];
    const z = this.zombies.create(x, y, def.tex).setDepth(2);
    z.body.setCircle(def.radius, z.width / 2 - def.radius, z.height / 2 - def.radius);
    if (def.boss) z.body.pushable = false;
    // O chefe com arte antiga (desenho pequeno) é ampliado para ser o maior zumbi; o círculo de colisão compensa
    z.baseScale = def.boss && !ANIM_FRAMES[def.tex] ? Math.max(1, 120 / z.height) : 1;
    if (z.baseScale > 1) {
      z.setScale(z.baseScale);
      const r = def.radius / z.baseScale;
      z.body.setCircle(r, z.width / 2 - r, z.height / 2 - r);
    }
    this.addShadow(z, def.radius * 2.6);
    z.def = def;
    z.type = type;
    z.nid = this.nidSeq = (this.nidSeq || 0) + 1; // id para o cooperativo
    z.hp = z.maxHp = def.hp * this.waveHpMul;
    z.wobble = Math.random() * 1000;
    z.slow = 1;
    z.mode = 'walk';
    z.cooldown = this.time.now + Phaser.Math.Between(1500, 4000);
    z.retargetAt = 0;
    return z;
  },

  spawnWitch() {
    const a = Math.random() * Math.PI * 2;
    const d = Phaser.Math.Between(450, 700);
    const x = Phaser.Math.Clamp(BASE_X + Math.cos(a) * d, 60, WORLD_W - 60);
    const y = Phaser.Math.Clamp(BASE_Y + Math.sin(a) * d, 60, WORLD_H - 60);
    const z = this.createZombie('witch', x, y);
    z.mode = 'sit';
    z.optional = true; // a horda acaba mesmo com ela viva
    z.body.moves = false;
    this.announceFloat('Uma Witch está chorando por perto... não chegue perto');
  },

  // Distância de um zumbi até a borda de uma construção (retângulo)
  rectDist(z, s) {
    const hw = s.hw || GRID / 2;
    const hh = s.hh || GRID / 2;
    const dx = Math.max(Math.abs(z.x - s.x) - hw, 0);
    const dy = Math.max(Math.abs(z.y - s.y) - hh, 0);
    return Math.sqrt(dx * dx + dy * dy);
  },

  // Alvo: o jogador mais perto (ou o vomitado), senão a construção bloqueante mais próxima no caminho, senão a base
  pickTarget(z) {
    if (!this.down && this.now < this.bileUntil) return { kind: 'player', p: this.player };
    const near = this.nearestPerson(z);
    if (near.p) {
      const range = near.p === this.player && this.now < this.camoUntil ? 60 : PLAYER.chaseRange;
      if (near.d < range) return { kind: 'player', p: near.p };
    }
    let best = null;
    let bestD = 110;
    this.structures.forEach((s) => {
      if (!s.def.block) return;
      const d = this.rectDist(z, s);
      if (d < bestD) { bestD = d; best = s; }
    });
    return best ? { kind: 'structure', s: best } : { kind: 'structure', s: this.base };
  },

  updateZombies(dt) {
    const now = this.time.now;
    const zs = this.zombies.getChildren().slice();
    zs.forEach((z) => {
      if (!z.active) return;
      // Sangramento e fogo
      if (z.bleed && z.bleed.t > 0) { z.bleed.t -= dt; this.damageZombie(z, z.bleed.dps * dt, 0, true); }
      if (z.burn && z.burn.t > 0) { z.burn.t -= dt; this.damageZombie(z, z.burn.dps * dt, 0, true); }
      if (!z.active) return;
      this.updateZombie(z, dt, now);
    });

    const left = this.zombies.getChildren().filter((z) => !z.optional).length;
    if (this.state === 'wave' && this.spawnQueue.length === 0 && left === 0) this.endWave();
  },

  updateZombie(z, dt, now) {
    const p = this.player;
    const def = z.def;
    let speed = def.speed * z.slow * (this.event === 'rapida' ? 1.4 : 1) * (this.now < this.bileUntil ? 1.3 : 1);
    z.slow = 1;
    // Especiais só miram o anfitrião (distP); os comuns, a pessoa mais perto (near)
    const distP = this.down ? 1e9 : Phaser.Math.Distance.Between(z.x, z.y, p.x, p.y);
    const near = this.nearestPerson(z);

    // Aura de veneno (inspirado nos infectados de The Last of Us): dano a 1 metro
    if (def.aura && near.p && near.d < def.aura + 12) this.hurtWho(near.p, def.auraDps * dt);

    if (this.updateSpecial(z, dt, now, distP)) return;

    if (now > z.retargetAt) {
      z.target = this.pickTarget(z);
      z.retargetAt = now + 350;
    }
    const alvo = z.target.kind === 'player' && z.target.p && !this.personDown(z.target.p) ? z.target.p : null;
    const tgt = alvo || (z.target.s && (z.target.s.hp > 0) ? z.target.s : this.base);
    const isPlayer = !!alvo;
    const distT = isPlayer ? Phaser.Math.Distance.Between(z.x, z.y, tgt.x, tgt.y) : 0;
    const contact = isPlayer ? distT < def.radius + 16 : this.rectDist(z, tgt) < def.radius + 8;

    // Spitter para a distância e cospe ácido
    if (def === ZOMBIES.spitter) {
      const d = isPlayer ? distT : this.rectDist(z, tgt);
      if (d < 220) {
        speed = 0;
        if (now > z.cooldown) {
          z.cooldown = now + 4000;
          this.throwShot(z, tgt.x, tgt.y, 'acid');
        }
      }
    }
    // Tank arremessa pedras em quem estiver longe
    if (def === ZOMBIES.tank && near.p && near.d > 180 && near.d < 600 && now > z.cooldown) {
      z.cooldown = now + 6000;
      this.throwShot(z, near.p.x, near.p.y, 'rock');
    }

    let angle = Phaser.Math.Angle.Between(z.x, z.y, tgt.x, tgt.y);
    if (!contact) angle += Math.sin((now + z.wobble) / 400) * 0.25;
    this.physics.velocityFromRotation(angle, contact ? speed * 0.2 : speed, z.body.velocity);
    this.face(z, angle);
    // Passada (ou golpe, encostado no alvo) no ritmo da velocidade; por cima, o gingado de zumbi,
    // menor em quem já tem quadros de animação
    const anim = this.animate(z, contact ? 'ataque' : 'andar', Phaser.Math.Clamp(speed / 45, 0.6, 2.2));
    z.setAngle(contact ? 0 : Math.sin((now + z.wobble) / 160) * (anim ? 3 : 6));
    z.setScale(z.baseScale, z.baseScale * (1 + Math.sin((now + z.wobble) / 120) * 0.04));

    if (contact) {
      if (isPlayer) this.hurtWho(tgt, def.dps * dt);
      else this.damageStructure(tgt, def.dps * def.struct * dt);
    }
    // Boomer vomita em quem chegar perto
    if (def === ZOMBIES.boomer && distP < 70 && now > z.cooldown) {
      z.cooldown = now + 8000;
      this.bile();
    }
  },

  // Retorna true quando o especial controlou o movimento neste quadro
  updateSpecial(z, dt, now, distP) {
    const p = this.player;
    const def = z.def;
    const toPlayer = () => Phaser.Math.Angle.Between(z.x, z.y, p.x, p.y);

    if (z.mode === 'stunned') {
      z.setVelocity(0, 0);
      if (now > z.modeUntil) z.mode = 'walk';
      return true;
    }

    if (def === ZOMBIES.witch) {
      if (z.mode === 'sit') {
        z.setVelocity(0, 0);
        if (Math.random() < dt * 0.3) Sfx.cry();
        if (distP < 150) this.startleWitch(z);
        return true;
      }
      if (this.down) return false; // sem jogador, ataca a base como os outros
      this.physics.velocityFromRotation(toPlayer(), def.speed, z.body.velocity);
      this.face(z, toPlayer());
      if (distP < def.radius + 16) this.hurtPlayer(def.dps * dt);
      return true;
    }

    if (def === ZOMBIES.hunter || def === ZOMBIES.jockey) {
      const isHunter = def === ZOMBIES.hunter;
      if (z.mode === 'pin' || z.mode === 'ride') {
        if (this.pinnedBy !== z || this.down) { z.mode = 'walk'; return false; }
        z.setPosition(p.x + 6, p.y - 6).setVelocity(0, 0);
        this.hurtPlayer((isHunter ? 12 : 6) * dt);
        return true;
      }
      if (z.mode === 'crouch') {
        z.setVelocity(0, 0);
        if (now > z.modeUntil) {
          z.mode = 'leap';
          z.modeUntil = now + 550;
          this.physics.velocityFromRotation(toPlayer(), isHunter ? 520 : 420, z.body.velocity);
          Sfx.scream();
        }
        return true;
      }
      if (z.mode === 'leap') {
        if (!this.down && !this.pinnedBy && distP < def.radius + 18) {
          this.pinnedBy = z;
          this.pinBreak = 0;
          z.mode = isHunter ? 'pin' : 'ride';
          this.hud.banner(isHunter ? 'Hunter! Aperte Espaço' : 'Jockey! Aperte Espaço');
          return true;
        }
        if (now > z.modeUntil) { z.mode = 'walk'; z.cooldown = now + 3000; }
        return true;
      }
      if (!this.down && !this.pinnedBy && now > z.cooldown && distP < (isHunter ? 240 : 130)) {
        z.mode = 'crouch';
        z.modeUntil = now + (isHunter ? 600 : 300);
        return true;
      }
      return false;
    }

    if (def === ZOMBIES.smoker) {
      if (z.mode === 'pull') {
        if (this.smokedBy !== z || this.down || z.pullDamage >= 3 || now > z.modeUntil || distP < 30) {
          if (this.smokedBy === z) this.smokedBy = null;
          z.mode = 'walk';
          z.cooldown = now + 7000;
          return false;
        }
        z.setVelocity(0, 0);
        this.face(z, toPlayer());
        this.hurtPlayer(5 * dt);
        return true;
      }
      if (!this.down && !this.smokedBy && now > z.cooldown && distP < 280 && distP > 80) {
        z.mode = 'pull';
        z.modeUntil = now + 4000;
        z.pullDamage = 0;
        this.smokedBy = z;
        this.hud.floatText('Um Smoker te pegou! Atire nele');
        return true;
      }
      return false;
    }

    if (def === ZOMBIES.charger) {
      if (z.mode === 'windup') {
        z.setVelocity(0, 0);
        if (now > z.modeUntil) {
          z.mode = 'charge';
          z.modeUntil = now + 1300;
          this.physics.velocityFromRotation(z.facing, 400, z.body.velocity);
          Sfx.roar();
        }
        return true;
      }
      if (z.mode === 'charge') {
        if (!this.down && distP < def.radius + 18) {
          this.hurtPlayer(20);
          const a = toPlayer();
          p.setPosition(p.x + Math.cos(a) * 60, p.y + Math.sin(a) * 60);
          return this.endCharge(z, now);
        }
        const hit = this.structures.concat([this.base]).find((s) => s.def.block && this.rectDist(z, s) < def.radius + 6);
        if (hit) {
          this.damageStructure(hit, 50);
          this.cameras.main.shake(150, 0.006);
          return this.endCharge(z, now);
        }
        if (now > z.modeUntil) return this.endCharge(z, now);
        return true;
      }
      if (!this.down && now > z.cooldown && distP < 320) {
        z.mode = 'windup';
        z.modeUntil = now + 700;
        this.face(z, toPlayer());
        return true;
      }
      return false;
    }
    return false;
  },

  endCharge(z, now) {
    z.mode = 'stunned';
    z.modeUntil = now + 1000;
    z.cooldown = now + 6000;
    z.setVelocity(0, 0);
    return true;
  },

  startleWitch(z) {
    if (z.mode !== 'sit') return;
    z.mode = 'rage';
    z.body.moves = true;
    this.announce('A Witch acordou!');
    this.netSfx('scream');
  },

  // Vômito do Boomer: todos os zumbis vêm atrás do jogador por 6 segundos
  bile() {
    if (this.down) return;
    this.bileUntil = this.time.now + 6000;
    this.hud.floatText('Vomitado! A horda inteira está vindo atrás de você');
    Sfx.vomit();
    this.player.setTint(0xc8c2a0); // sujo de vômito, sem verde-limão
    this.time.delayedCall(6000, () => this.player.clearTint());
  },

  // Projéteis inimigos: ácido do Spitter e pedra do Tank
  throwShot(z, tx, ty, kind) {
    const img = this.add.image(z.x, z.y, kind).setDepth(8);
    this.enemyShots.push({ img, tx, ty, kind, speed: kind === 'rock' ? 380 : 300 });
    if (kind === 'acid') Sfx.spit();
    this.netEvent(['a', Math.round(z.x), Math.round(z.y), Math.round(tx), Math.round(ty), kind]);
  },

  updateEnemyShots(dt) {
    const now = this.time.now;
    this.enemyShots = this.enemyShots.filter((s) => {
      const d = Phaser.Math.Distance.Between(s.img.x, s.img.y, s.tx, s.ty);
      const step = s.speed * dt;
      if (d > step) {
        const a = Phaser.Math.Angle.Between(s.img.x, s.img.y, s.tx, s.ty);
        s.img.x += Math.cos(a) * step;
        s.img.y += Math.sin(a) * step;
        s.img.rotation += dt * 8;
        return true;
      }
      // Na tela do amigo é só o desenho: a poça e o dano vêm do anfitrião
      if (s.kind === 'acid') { if (!this.isGuest) this.addPuddle(s.tx, s.ty, 'puddle', 50, 5000); }
      else {
        this.cameras.main.shake(150, 0.006);
        if (!this.isGuest) {
          this.peopleNear(s.tx, s.ty, 45).forEach((who) => this.hurtWho(who, 25));
          this.structures.concat([this.base]).forEach((st) => {
            if (st.def.block && this.rectDist({ x: s.tx, y: s.ty }, st) < 40) this.damageStructure(st, 40);
          });
        }
      }
      s.img.destroy();
      return false;
    });

    // Poças de ácido derretem construções e o jogador; nuvens de veneno só machucam o jogador
    this.puddles = this.puddles.filter((pd) => {
      if (now > pd.until) { pd.img.destroy(); return false; }
      pd.img.setAlpha(Math.min(1, (pd.until - now) / 1000));
      if (this.isGuest) return true;
      this.peopleNear(pd.x, pd.y, pd.r).forEach((who) => this.hurtWho(who, 8 * dt));
      if (pd.kind === 'puddle') {
        this.structures.concat([this.base]).forEach((st) => {
          if (st.maxHp && this.rectDist(pd, st) < pd.r * 0.6) this.damageStructure(st, 6 * dt);
        });
      }
      return true;
    });
  },

  addPuddle(x, y, kind, r, ms) {
    const img = this.add.image(x, y, kind).setDepth(0.8).setScale(r / 50);
    this.puddles.push({ img, x, y, r, kind, until: this.time.now + ms });
    this.netEvent(['p', Math.round(x), Math.round(y), kind, r, ms]);
  },

  // silent = dano contínuo (fogo, sangramento) sem piscar
  damageZombie(z, amount, burn, silent) {
    if (!z.active) return;
    z.hp -= amount;
    if (burn) z.burn = { t: burn, dps: 1.2 };
    if (z.mode === 'pull') z.pullDamage += amount;
    if (z.mode === 'sit') this.startleWitch(z);
    if (!silent) {
      // Acerto: pisca levemente avermelhado (vermelho forte, sob rajada, deixava o zumbi chapado e parecia outro)
      z.setTint(0xffb4a4);
      this.time.delayedCall(70, () => z.active && z.clearTint());
    }
    if (z.hp > 0) return;

    const def = z.def;
    this.particles.explode(def.radius > 20 ? 40 : 12, z.x, z.y);
    this.bloodStain(z.x, z.y + z.displayHeight / 2 - 4, def.radius / 12);
    this.netEvent(['m', Math.round(z.x), Math.round(z.y + z.displayHeight / 2 - 4), def.radius]);
    if (def.radius > 20) this.cameras.main.shake(250, 0.01);
    this.money += Math.max(1, Math.round(def.reward * this.diff.money * (this.event === 'dupla' ? 2 : 1)));
    if (this.pinnedBy === z) this.releasePins();
    if (this.smokedBy === z) this.smokedBy = null;
    if (def === ZOMBIES.boomer) {
      this.particles.explode(30, z.x, z.y);
      if (!this.down && Phaser.Math.Distance.Between(z.x, z.y, this.player.x, this.player.y) < 90) this.bile();
    }
    if (def === ZOMBIES.venenoso) this.addPuddle(z.x, z.y, 'poison', 55, 4000);
    if (def === ZOMBIES.witch) this.announceFloat(`Witch derrotada! +$${Math.round(def.reward * this.diff.money)}`);
    z.destroy();
    Sfx.splat();
  },
};

Object.assign(GameScene.prototype, ZombieLogic);
