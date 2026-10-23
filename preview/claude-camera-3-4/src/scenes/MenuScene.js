class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    this.add.tileSprite(0, 0, GAME_W, GAME_H, 'ground0').setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0c0a08, 0.5).setOrigin(0);
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
      fontFamily: TITLE_FONT, fontSize: '150px', color: UI.blood, stroke: '#120e0b', strokeThickness: 12,
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, angle: { from: -1.5, to: 1.5 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.text(GAME_W / 2, 250, 'Proteja a casa. Sobreviva às hordas. Faça carinho no cachorro.', {
      fontFamily: FONT, fontSize: '22px', color: UI.text, stroke: '#120e0b', strokeThickness: 5,
    }).setOrigin(0.5);

    const unlocked = unlockedLevels();
    LEVELS.forEach((lv, i) => {
      const x = GAME_W / 2 + (i - 1) * 250;
      const open = i < unlocked;
      // Cada nível é uma placa de madeira pregada; bloqueado fica em chapa escura
      const bg = plate(this, x, 360, 220, 76, open ? 'madeira' : 'metal');
      if (!open) bg.setTint(0x6a625a);
      tape(this, x - 96, 326, -30, 44);
      this.add.text(x, 348, `${i + 1}. ${lv.name}`, {
        fontFamily: TITLE_FONT, fontSize: '30px', color: open ? UI.gold : '#7d7468', stroke: '#120e0b', strokeThickness: 5,
      }).setOrigin(0.5);
      const won = medals(i);
      const stars = DIFFICULTIES.map((d) => (won.includes(d.id) ? '★' : '☆')).join(' ');
      this.add.text(x, 380, open ? `${lv.wavesToWin} hordas · ${stars}` : 'bloqueado', { fontFamily: FONT, fontSize: '15px', color: '#d8ccb0', stroke: '#120e0b', strokeThickness: 3 }).setOrigin(0.5);
      if (open) {
        bg.setInteractive({ useHandCursor: true });
        bg.setTint(0xd8d0c4);
        bg.on('pointerover', () => bg.clearTint());
        bg.on('pointerout', () => bg.setTint(0xd8d0c4));
        bg.on('pointerdown', () => this.scene.start('Setup', { level: i }));
      }
    });

    const story = this.add.text(GAME_W / 2, 445, '[ Ver a história ]', {
      fontFamily: FONT, fontSize: '20px', color: '#d8ccb0', stroke: '#120e0b', strokeThickness: 4,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    story.on('pointerdown', () => this.scene.start('Intro', { next: null }));

    // Bilhete de papel preso com fita: os controles
    plate(this, GAME_W / 2, 590, 780, 130, 'papel').setAngle(-0.8);
    tape(this, GAME_W / 2 - 370, 530, -35, 56);
    tape(this, GAME_W / 2 + 370, 530, 35, 56);
    this.add.text(GAME_W / 2, 590,
      'WASD andar · Mouse mirar · Clique atirar · [Q] trocar arma\n[1] a [7] construir · botão direito numa torre: upgrades\n[L] loja entre hordas · [Espaço] chamar a horda\nEstrelas: dificuldades vencidas (Fácil, Médio, Difícil, Impossível)',
      { fontFamily: NOTE_FONT, fontSize: '17px', color: UI.ink, align: 'center', lineSpacing: 6 },
    ).setOrigin(0.5).setAngle(-0.8);

    if (!this.sys.game.device.os.desktop) {
      this.add.text(GAME_W / 2, 685, 'Este jogo precisa de teclado e mouse. Abra num computador para jogar.', {
        fontFamily: FONT, fontSize: '18px', color: UI.blood, stroke: '#120e0b', strokeThickness: 4,
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
