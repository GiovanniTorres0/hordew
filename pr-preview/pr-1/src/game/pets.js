// Pets: seguem o jogador, atacam zumbis perto dele e dão bônus próprios.
// Prioridade de alvo: quem está prendendo o jogador (Hunter, Jockey, Smoker).
const PetLogic = {
  spawnPet(id) {
    if (this.pet) this.pet.destroy();
    const def = PETS[id];
    const pet = this.physics.add.sprite(this.player.x - 30, this.player.y + 30, def.tex).setDepth(id === 'gaviao' ? 9 : 3);
    pet.def = def;
    pet.id = id;
    pet.lastAttack = 0;
    pet.nextScout = this.time.now + 5000;
    pet.scouting = false;
    this.pet = pet;
  },

  moveTo(sprite, x, y, speed) {
    const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, x, y);
    if (dist < 8) return sprite.setVelocity(0, 0);
    const a = Phaser.Math.Angle.Between(sprite.x, sprite.y, x, y);
    this.physics.velocityFromRotation(a, Math.min(speed, dist * 4), sprite.body.velocity);
    sprite.rotation = a;
  },

  updatePet(dt) {
    const pet = this.pet;
    if (!pet) return;
    const now = this.time.now;
    const def = pet.def;
    const home = this.down ? { x: BASE_X, y: BASE_Y + BASE_H / 2 + 40 } : { x: this.player.x - 35, y: this.player.y + 30 };

    // Gavião: de tempos em tempos sobrevoa um ponto distante e ilumina a área
    if (def.scout) {
      if (pet.scouting) {
        this.moveTo(pet, pet.scoutX, pet.scoutY, def.speed);
        if (Phaser.Math.Distance.Between(pet.x, pet.y, pet.scoutX, pet.scoutY) < 20) {
          if (!pet.scoutArrived) pet.scoutArrived = now;
          if (now - pet.scoutArrived > 1500) { pet.scouting = false; pet.nextScout = now + def.scout.every * 1000; }
        }
        return;
      }
      if (this.state === 'wave' && now > pet.nextScout) {
        const far = this.zombies.getChildren().filter((z) => Phaser.Math.Distance.Between(z.x, z.y, this.player.x, this.player.y) > 350);
        const spot = far.length ? Phaser.Utils.Array.GetRandom(far) : { x: Phaser.Math.Between(200, WORLD_W - 200), y: Phaser.Math.Between(200, WORLD_H - 200) };
        pet.scouting = true;
        pet.scoutArrived = 0;
        pet.scoutX = spot.x;
        pet.scoutY = spot.y;
        return;
      }
    }

    let target = this.pinnedBy || this.smokedBy;
    if (!target && !this.down) target = this.nearestZombie(this.player.x, this.player.y, PET_SIGHT);
    if (!target) return this.moveTo(pet, home.x, home.y, def.speed);

    this.moveTo(pet, target.x, target.y, def.speed);
    const reach = target.def.radius + 18;
    if (Phaser.Math.Distance.Between(pet.x, pet.y, target.x, target.y) > reach) return;
    if (now - pet.lastAttack < 1000 / def.rate) return;
    pet.lastAttack = now;

    const rescuing = target === this.pinnedBy || target === this.smokedBy;
    if (rescuing && this.pinnedBy === target) {
      this.pinBreak = (this.pinBreak || 0) + 2;
      if (this.pinBreak >= 8) this.releasePins(true);
    }
    if (def.bleed) target.bleed = { t: def.bleed.time, dps: def.bleed.dps };
    if (def.camo && Math.random() < def.camo.chance) {
      this.camoUntil = now + def.camo.time * 1000;
      this.hud.floatText('Camuflado! Os zumbis demoram a te notar');
    }
    if (pet.id === 'cachorro' && Math.random() < 0.3) Sfx.bark();
    this.tweens.add({ targets: pet, scale: 1.25, duration: 80, yoyo: true });
    this.damageZombie(target, def.damage * (rescuing ? 2 : 1));
  },
};

Object.assign(GameScene.prototype, PetLogic);
