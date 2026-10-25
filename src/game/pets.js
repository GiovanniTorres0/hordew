// Pets: seguem o dono, atacam zumbis perto dele e dão bônus próprios.
// Prioridade de alvo: quem está prendendo o jogador (Hunter, Jockey, Smoker).
// No cooperativo cada jogador tem no máximo 1 pet: o do anfitrião fica em this.pet e o de cada
// amigo em ally.pet (o anfitrião simula todos; o amigo só vê).
const PetLogic = {
  // ally: undefined = anfitrião (ou jogo solo); senão o boneco do amigo (this.others)
  spawnPet(id, ally) {
    const owner = ally ? ally.s : this.player;
    const old = ally ? ally.pet : this.pet;
    if (old) old.destroy();
    const def = PETS[id];
    // Gavião voa acima de todos, mas abaixo das barras de vida (6) e dos efeitos
    const pet = this.physics.add.sprite(owner.x - 30, owner.y + 30, def.tex).setDepth(id === 'gaviao' ? 5.8 : 3);
    pet.def = def;
    this.addShadow(pet, id === 'crocodilo' ? 70 : id === 'gaviao' ? 26 : pet.width * 0.8, id === 'gaviao' ? 40 : 0);
    pet.id = id;
    pet.ownerId = ally ? ally.id : this.net ? this.net.me : 0;
    pet.lastAttack = 0;
    pet.nextScout = this.time.now + 5000;
    pet.scouting = false;
    if (ally) ally.pet = pet;
    else { this.pet = pet; this.petId = id; }
    return pet;
  },

  moveTo(sprite, x, y, speed) {
    const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, x, y);
    if (dist < 8) {
      this.animate(sprite, null);
      return sprite.setVelocity(0, 0);
    }
    const a = Phaser.Math.Angle.Between(sprite.x, sprite.y, x, y);
    this.physics.velocityFromRotation(a, Math.min(speed, dist * 4), sprite.body.velocity);
    this.face(sprite, a);
    this.animate(sprite, 'andar', Math.min(speed, dist * 4) / 200);
  },

  updatePet(dt) {
    if (this.pet) this.updateOnePet(this.pet, this.player, this.down, true);
    this.others.forEach((o) => { if (o.pet) this.updateOnePet(o.pet, o.s, o.down, false); });
  },

  // main = pet do anfitrião (os especiais só prendem o anfitrião, então só ele é socorrido)
  updateOnePet(pet, owner, ownerDown, main) {
    const now = this.time.now;
    const def = pet.def;
    const home = ownerDown ? { x: BASE_X, y: BASE_Y + BASE_H / 2 + 40 } : { x: owner.x - 44, y: owner.y + 22 }; // ao lado dos pés, sem cobrir o corpo do dono

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
        const far = this.zombies.getChildren().filter((z) => Phaser.Math.Distance.Between(z.x, z.y, owner.x, owner.y) > 350);
        const spot = far.length ? Phaser.Utils.Array.GetRandom(far) : { x: Phaser.Math.Between(200, WORLD_W - 200), y: Phaser.Math.Between(200, WORLD_H - 200) };
        pet.scouting = true;
        pet.scoutArrived = 0;
        pet.scoutX = spot.x;
        pet.scoutY = spot.y;
        return;
      }
    }

    let target = main ? this.pinnedBy || this.smokedBy : null;
    if (!target && !ownerDown) target = this.nearestZombie(owner.x, owner.y, PET_SIGHT);
    if (!target) return this.moveTo(pet, home.x, home.y, def.speed);

    this.moveTo(pet, target.x, target.y, def.speed);
    const reach = target.def.radius + 18;
    if (Phaser.Math.Distance.Between(pet.x, pet.y, target.x, target.y) > reach) return;
    if (now - pet.lastAttack < 1000 / def.rate) return;
    pet.lastAttack = now;

    const rescuing = main && (target === this.pinnedBy || target === this.smokedBy);
    if (rescuing && this.pinnedBy === target) {
      this.pinBreak = (this.pinBreak || 0) + 2;
      if (this.pinBreak >= 8) this.releasePins(true);
    }
    if (def.bleed) target.bleed = { t: def.bleed.time, dps: def.bleed.dps };
    if (main && def.camo && Math.random() < def.camo.chance) {
      this.camoUntil = now + def.camo.time * 1000;
      this.hud.floatText('Camuflado! Os zumbis demoram a te notar');
    }
    if (pet.id === 'cachorro' && Math.random() < 0.3) Sfx.bark();
    this.tweens.add({ targets: pet, scale: 1.25, duration: 80, yoyo: true });
    this.killer = pet.ownerId;
    this.damageZombie(target, def.damage * (rescuing ? 2 : 1));
    this.killer = 0;
  },
};

Object.assign(GameScene.prototype, PetLogic);
