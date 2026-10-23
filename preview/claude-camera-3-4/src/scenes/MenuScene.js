class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    this.add.tileSprite(0, 0, GAME_W, GAME_H, 'ground0').setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x1b1424, 0.45).setOrigin(0);
    [[90, 250], [1180, 220], [160, 650], [1120, 680], [300, 160], [980, 140]].forEach(([x, y], i) =>
      this.add.image(x, y, 'tree').setOrigin(0.5, 1).setAngle(i % 2 ? 8 : -8));
    if (this.cameras.main.postFX) this.cameras.main.postFX.addVignette(0.5, 0.5, 0.9, 0.4);

    // Zumbis passeando ao fundo
    this.walkers = [];
    for (let i = 0; i < 6; i++) {
      const tex = ['z_comum', 'z_corredor', 'z_blindado'][i % 3];
      const z = this.add.image(Phaser.Math.Between(0, GAME_W), Phaser.Math.Between(420, 700), tex).setFlipX(true).setAlpha(0.8);
      z.speed = Phaser.Math.Between(15, 40);
      this.walkers.push(z);
    }

    const title = this.add.text(GAME_W / 2, 150, 'HORDEW', {
      fontFamily: TITLE_FONT, fontSize: '140px', color: '#8fd16a', stroke: '#1b1424', strokeThickness: 12,
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, angle: { from: -2, to: 2 }, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.text(GAME_W / 2, 250, 'Proteja a casa. Sobreviva às hordas. Faça carinho no cachorro.', {
      fontFamily: FONT, fontSize: '22px', color: '#f4ecff', stroke: '#1b1424', strokeThickness: 5,
    }).setOrigin(0.5);

    const unlocked = unlockedLevels();
    LEVELS.forEach((lv, i) => {
      const x = GAME_W / 2 + (i - 1) * 250;
      const open = i < unlocked;
      const bg = this.add.rectangle(x, 360, 220, 70, open ? 0x3f2a4f : 0x2a2230).setStrokeStyle(4, open ? 0xb36ab8 : 0x4a3d55);
      this.add.text(x, 350, `${i + 1}. ${lv.name}`, {
        fontFamily: TITLE_FONT, fontSize: '32px', color: open ? '#ffd86b' : '#6d607a',
      }).setOrigin(0.5);
      const won = medals(i);
      const stars = DIFFICULTIES.map((d) => (won.includes(d.id) ? '★' : '☆')).join(' ');
      this.add.text(x, 380, open ? `${lv.wavesToWin} hordas · ${stars}` : 'bloqueado', { fontFamily: FONT, fontSize: '14px', color: '#c9b8d9' }).setOrigin(0.5);
      if (open) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => bg.setFillStyle(0x5a3d70));
        bg.on('pointerout', () => bg.setFillStyle(0x3f2a4f));
        bg.on('pointerdown', () => this.scene.start('Setup', { level: i }));
      }
    });

    const story = this.add.text(GAME_W / 2, 445, '[ Ver a história ]', {
      fontFamily: FONT, fontSize: '20px', color: '#c9b8d9', stroke: '#1b1424', strokeThickness: 4,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    story.on('pointerdown', () => this.scene.start('Intro', { next: null }));

    this.add.text(GAME_W / 2, 560,
      'WASD andar · Mouse mirar · Clique atirar · [Q] trocar arma\n[1] a [7] construir · botão direito numa torre: upgrades · [L] loja entre hordas · [Espaço] chamar a horda',
      { fontFamily: FONT, fontSize: '18px', color: '#f4ecff', align: 'center', lineSpacing: 8, stroke: '#1b1424', strokeThickness: 4 },
    ).setOrigin(0.5);
    this.add.text(GAME_W / 2, 640, 'Estrelas: dificuldades vencidas (Fácil, Médio, Difícil, Impossível)', {
      fontFamily: FONT, fontSize: '18px', color: '#ffd86b', stroke: '#1b1424', strokeThickness: 4,
    }).setOrigin(0.5);

    if (!this.sys.game.device.os.desktop) {
      this.add.text(GAME_W / 2, 690, 'Este jogo precisa de teclado e mouse. Abra num computador para jogar.', {
        fontFamily: FONT, fontSize: '18px', color: '#e8453c', stroke: '#1b1424', strokeThickness: 4,
      }).setOrigin(0.5);
    }
    this.input.keyboard.on('keydown-ENTER', () => this.scene.start('Setup', { level: 0 }));
  }

  update(time, delta) {
    this.walkers.forEach((z) => {
      z.x -= (z.speed * delta) / 1000;
      z.setAngle(Math.sin((time + z.speed * 97) / 160) * 6);
      if (z.x < -40) z.x = GAME_W + 40;
    });
  }
}
