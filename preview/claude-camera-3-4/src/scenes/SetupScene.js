// Antes da partida: escolha de personagem, cor da roupa, dificuldade e modo (normal ou infinito)
class SetupScene extends Phaser.Scene {
  constructor() {
    super('Setup');
  }

  init(data) {
    const last = storageGetJSON('hordew_escolhas', {});
    this.choice = {
      level: data && data.level !== undefined ? data.level : 0,
      char: last.char || 0,
      outfit: last.outfit || 0,
      difficulty: last.difficulty !== undefined ? last.difficulty : 1,
      infinite: false,
    };
  }

  create() {
    const lv = LEVELS[this.choice.level];
    this.add.tileSprite(0, 0, GAME_W, GAME_H, `ground${this.choice.level}`).setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x1b1424, 0.7).setOrigin(0);
    this.add.text(GAME_W / 2, 50, `Prepare-se · ${lv.name}`, { ...TEXT, fontFamily: TITLE_FONT, fontSize: '54px', color: '#8fd16a', strokeThickness: 8 }).setOrigin(0.5);

    const label = (y, text) => this.add.text(GAME_W / 2, y, text, { ...TEXT, fontSize: '20px', color: '#c9b8d9' }).setOrigin(0.5);

    label(110, 'Personagem');
    this.charCards = CHARACTERS.map((c, i) => {
      const x = GAME_W / 2 + (i - 1) * 300;
      const bg = this.add.rectangle(x, 200, 260, 140, 0x3f2a4f).setStrokeStyle(4, 0x1b1424).setInteractive({ useHandCursor: true });
      const img = this.add.image(x, 180, `char_${c.id}`);
      this.add.text(x, 238, c.name, { ...TEXT, fontSize: '20px', color: '#ffd86b' }).setOrigin(0.5);
      this.add.text(x, 262, `${c.desc} · vida ${c.hp}`, { ...TEXT, fontSize: '14px' }).setOrigin(0.5);
      bg.on('pointerdown', () => { this.choice.char = i; this.refresh(); });
      return { bg, img };
    });

    label(310, 'Cor da roupa');
    this.swatches = OUTFITS.map((color, i) => {
      const sw = this.add.circle(GAME_W / 2 + (i - 2.5) * 60, 352, 20, color).setStrokeStyle(4, 0x1b1424).setInteractive({ useHandCursor: true });
      sw.on('pointerdown', () => { this.choice.outfit = i; this.refresh(); });
      return sw;
    });

    label(410, 'Dificuldade');
    const won = medals(this.choice.level);
    this.diffButtons = DIFFICULTIES.map((d, i) => {
      const b = button(this, GAME_W / 2 + (i - 1.5) * 200, 452, 180, 46, `${d.name}${won.includes(d.id) ? ' ★' : ''}`, () => { this.choice.difficulty = i; this.refresh(); }, 20);
      b.text.setColor(d.color);
      return b;
    });

    label(512, 'Modo');
    const inf = infiniteUnlocked(this.choice.level);
    this.modeNormal = button(this, GAME_W / 2 - 160, 554, 280, 46, `Normal (${lv.wavesToWin} hordas)`, () => { this.choice.infinite = false; this.refresh(); }, 18);
    const rec = infiniteRecord(this.choice.level);
    this.modeInf = button(this, GAME_W / 2 + 160, 554, 280, 46, inf ? `Infinito${rec ? ` (recorde ${rec})` : ''}` : 'Infinito (vença o nível)', () => {
      if (inf) { this.choice.infinite = true; this.refresh(); }
    }, 18);
    this.infEnabled = inf;

    const play = button(this, GAME_W / 2 + 110, 650, 200, 56, 'JOGAR', () => this.play(), 26);
    play.text.setColor('#8fd16a');
    button(this, GAME_W / 2 - 110, 650, 160, 56, 'Voltar', () => this.scene.start('Menu'), 20);
    this.input.keyboard.on('keydown-ENTER', () => this.play());
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));
    this.refresh();
  }

  refresh() {
    const c = this.choice;
    this.charCards.forEach(({ bg, img }, i) => {
      bg.setStrokeStyle(4, i === c.char ? 0xffd86b : 0x1b1424);
      makePlayerTexture(this, CHARACTERS[i], OUTFITS[c.outfit], `char_${CHARACTERS[i].id}`);
      img.setTexture(`char_${CHARACTERS[i].id}`);
      img.setScale(90 / img.height); // cabe no cartão, seja o desenho antigo ou o novo
    });
    this.swatches.forEach((sw, i) => sw.setStrokeStyle(4, i === c.outfit ? 0xffd86b : 0x1b1424));
    this.diffButtons.forEach((b, i) => b.bg.setStrokeStyle(3, i === c.difficulty ? 0xffd86b : 0x1b1424));
    this.modeNormal.bg.setStrokeStyle(3, !c.infinite ? 0xffd86b : 0x1b1424);
    this.modeInf.bg.setStrokeStyle(3, c.infinite ? 0xffd86b : 0x1b1424);
    if (!this.infEnabled) this.modeInf.set(this.modeInf.text.text, false);
  }

  play() {
    const c = this.choice;
    storageSetJSON('hordew_escolhas', { char: c.char, outfit: c.outfit, difficulty: c.difficulty });
    if (!storageGet('hordew_viu_intro', 0)) {
      storageSet('hordew_viu_intro', 1);
      this.scene.start('Intro', { next: c });
    } else this.scene.start('Game', c);
  }
}
