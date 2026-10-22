const FONT = '"Trebuchet MS", Verdana, sans-serif';

// Barra superior, barra de ferramentas e mensagens na tela
class Hud {
  constructor(scene) {
    this.scene = scene;
    const P = PALETTE;
    const style = { fontFamily: FONT, fontSize: '18px', color: '#f4ecff', stroke: '#1b1424', strokeThickness: 4 };

    scene.add.rectangle(0, 0, GAME_W, HUD_H, P.outline, 0.85).setOrigin(0).setDepth(20);
    this.waveText = scene.add.text(14, 9, '', style).setDepth(21);
    this.zombieText = scene.add.text(250, 9, '', style).setDepth(21);
    this.moneyText = scene.add.text(GAME_W - 14, 9, '', { ...style, color: '#ffd86b' }).setOrigin(1, 0).setDepth(21);
    this.hpBar = scene.add.graphics().setDepth(21);
    this.hpText = scene.add.text(GAME_W / 2 + 70, 20, '', { ...style, fontSize: '15px' }).setOrigin(0.5).setDepth(22);

    this.toolText = scene.add.text(14, GAME_H - 30, '', { ...style, fontSize: '15px' }).setDepth(21);
    this.centerText = scene.add.text(GAME_W / 2 + FINAL_LINE_X / 2, 70, '', { ...style, fontSize: '20px', align: 'center' }).setOrigin(0.5, 0).setDepth(21);
    this.bannerText = scene.add.text(GAME_W / 2 + FINAL_LINE_X / 2, GAME_H / 2 - 120, '', { ...style, fontFamily: TITLE_FONT, fontSize: '56px', color: '#8fd16a', strokeThickness: 8 })
      .setOrigin(0.5).setDepth(25).setAlpha(0);
  }

  update() {
    const s = this.scene;
    this.waveText.setText(`${s.level.name} · Horda ${s.wave}/${s.level.wavesToWin}`);
    const left = s.spawnQueue.length + s.zombies.countActive();
    this.zombieText.setText(s.state === 'wave' ? `Zumbis: ${left}` : '');
    this.moneyText.setText(`$ ${s.money}`);

    const w = 220;
    const x = GAME_W / 2 - 40;
    this.hpBar.clear();
    this.hpBar.fillStyle(0x3a2a40).fillRect(x, 10, w, 20);
    this.hpBar.fillStyle(s.hp / s.maxHp > 0.3 ? 0x6bd13a : 0xe8453c).fillRect(x, 10, w * (s.hp / s.maxHp), 20);
    this.hpBar.lineStyle(2, 0xf4ecff).strokeRect(x, 10, w, 20);
    this.hpText.setText(`Vida ${Math.ceil(s.hp)}/${s.maxHp}`);

    const sel = (t) => (s.buildType === t ? '▶' : '');
    this.toolText.setText(
      `${sel('torreta')}[1] Torreta $${BUILDINGS.torreta.cost}   ${sel('espinhos')}[2] Espinhos $${BUILDINGS.espinhos.cost}   ` +
      `[Esc/botão direito] Cancelar   Arma: ${s.weapon.name}`,
    );

    if (s.state === 'intermission') {
      const tip = s.wave === 0 && s.levelIndex === 0
        ? '\n\nDica: aperte [1] e clique no gramado para construir uma torreta.\nOs zumbis vêm da direita. Não deixe nenhum passar da linha vermelha!'
        : '';
      this.centerText.setText(`Próxima horda em ${Math.ceil(s.intermissionLeft)}s\n[Espaço] começar já   [L] Loja   [P] Pausa${tip}`);
    } else this.centerText.setText('');
  }

  setPaused(paused) {
    if (!this.pauseText) {
      this.pauseText = this.scene.add.text(GAME_W / 2, GAME_H / 2, 'PAUSADO\n[P] para voltar', {
        fontFamily: TITLE_FONT, fontSize: '64px', color: '#ffd86b', stroke: '#1b1424', strokeThickness: 10, align: 'center',
      }).setOrigin(0.5).setDepth(40);
    }
    this.pauseText.setVisible(paused);
  }

  banner(text) {
    this.bannerText.setText(text).setAlpha(1).setScale(0.6);
    this.scene.tweens.killTweensOf(this.bannerText);
    this.scene.tweens.add({ targets: this.bannerText, scale: 1, duration: 250, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: this.bannerText, alpha: 0, delay: 1600, duration: 500 });
  }

  endScreen(title, reason, stats, hint) {
    const s = this.scene;
    s.tweens.killTweensOf(this.bannerText);
    this.bannerText.setAlpha(0);
    s.add.rectangle(0, 0, GAME_W, GAME_H, 0x1b1424, 0.75).setOrigin(0).setDepth(30);
    const base = { fontFamily: FONT, color: '#f4ecff', stroke: '#1b1424', strokeThickness: 6, align: 'center' };
    s.add.text(GAME_W / 2, GAME_H / 2 - 110, title, { ...base, fontFamily: TITLE_FONT, fontSize: '84px', color: '#ffd86b' }).setOrigin(0.5).setDepth(31);
    s.add.text(GAME_W / 2, GAME_H / 2 - 30, reason, { ...base, fontSize: '26px' }).setOrigin(0.5).setDepth(31);
    s.add.text(GAME_W / 2, GAME_H / 2 + 20, stats, { ...base, fontSize: '20px' }).setOrigin(0.5).setDepth(31);
    s.add.text(GAME_W / 2, GAME_H / 2 + 90, hint, { ...base, fontSize: '22px', color: '#8fd16a' }).setOrigin(0.5).setDepth(31);
  }
}

// Loja aberta entre as hordas; o item chega de helicóptero
class Shop {
  constructor(scene) {
    this.scene = scene;
    this.isOpen = false;
    const w = 520;
    const h = 90 + SHOP_ITEMS.length * 62;
    const c = scene.add.container(GAME_W / 2 + FINAL_LINE_X / 2, GAME_H / 2).setDepth(26).setVisible(false);
    c.add(scene.add.rectangle(0, 0, w, h, 0x2a1f35, 0.95).setStrokeStyle(4, 0xb36ab8));
    const style = { fontFamily: FONT, fontSize: '18px', color: '#f4ecff' };
    c.add(scene.add.text(0, -h / 2 + 28, 'LOJA · entrega por helicóptero', { ...style, fontFamily: TITLE_FONT, fontSize: '30px', color: '#ffd86b' }).setOrigin(0.5));

    this.buttons = SHOP_ITEMS.map((item, i) => {
      const y = -h / 2 + 85 + i * 62;
      const bg = scene.add.rectangle(0, y, w - 40, 52, 0x3f2a4f).setStrokeStyle(2, 0x1b1424).setInteractive({ useHandCursor: true });
      const label = scene.add.text(-w / 2 + 36, y - 11, `${item.name} — ${item.desc}`, style).setOrigin(0, 0.5);
      const price = scene.add.text(w / 2 - 36, y, `$ ${item.cost}`, { ...style, color: '#ffd86b', fontSize: '22px' }).setOrigin(1, 0.5);
      const note = scene.add.text(-w / 2 + 36, y + 12, '', { ...style, fontSize: '13px', color: '#c9b8d9' }).setOrigin(0, 0.5);
      bg.on('pointerdown', () => this.buy(item, note));
      c.add([bg, label, price, note]);
      return { item, bg };
    });
    c.add(scene.add.text(0, h / 2 - 22, '[L] ou [Esc] fechar', { ...style, fontSize: '14px', color: '#c9b8d9' }).setOrigin(0.5));
    this.container = c;
  }

  toggle() {
    if (this.isOpen) this.close();
    else if (this.scene.state === 'intermission') this.open();
  }

  open() {
    this.isOpen = true;
    this.scene.setBuild(null);
    this.container.setVisible(true);
    this.refresh();
  }

  close() {
    this.isOpen = false;
    this.container.setVisible(false);
  }

  refresh() {
    this.buttons.forEach(({ item, bg }) => bg.setFillStyle(this.scene.money >= item.cost ? 0x3f2a4f : 0x2a2230));
  }

  buy(item, note) {
    const s = this.scene;
    if (s.money < item.cost) {
      note.setText('Dinheiro insuficiente');
      return;
    }
    s.money -= item.cost;
    note.setText('Comprado! Pegue a caixa que cair do céu');
    this.refresh();
    s.deliver(item);
  }
}
