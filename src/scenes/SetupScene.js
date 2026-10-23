// Antes da partida: escolha de personagem, cor da roupa, dificuldade e modo (normal ou infinito).
// Também é a sala de espera do cooperativo online: "Jogar com amigo" cria a sala e copia o link;
// quem abre o link (?sala=CODIGO) chega aqui só escolhendo o boneco e entra na sala.
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
    this.sala = (data && data.sala) || null; // código da sala do amigo (modo convidado)
    this.room = null; // sala criada aqui: { code, guests: Map(id -> { char, outfit }) }
    this.joined = false;
  }

  create() {
    const lv = LEVELS[this.choice.level];
    const guest = !!this.sala;
    this.add.tileSprite(0, 0, GAME_W, GAME_H, `ground${this.choice.level}`).setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0c0a08, 0.7).setOrigin(0);
    const title = guest ? `Entrar na sala ${this.sala}` : `Prepare-se · ${lv.name}`;
    this.add.text(GAME_W / 2, 50, title, { ...TEXT, fontFamily: TITLE_FONT, fontSize: '52px', color: UI.blood, strokeThickness: 8 }).setOrigin(0.5);

    const label = (y, text) => this.add.text(GAME_W / 2, y, text, { ...TEXT, fontFamily: TITLE_FONT, fontSize: '22px', color: '#d8ccb0' }).setOrigin(0.5);

    label(110, 'Personagem');
    this.charCards = CHARACTERS.map((c, i) => {
      const x = GAME_W / 2 + (i - 1) * 300;
      const edge = this.add.rectangle(x, 200, 268, 148).setStrokeStyle(4, UI.edge);
      const bg = plate(this, x, 200, 260, 140, 'madeira').setInteractive({ useHandCursor: true });
      const img = this.add.image(x, 180, `char_${c.id}`);
      this.add.text(x, 238, c.name, { ...TEXT, fontSize: '20px', color: UI.gold }).setOrigin(0.5);
      this.add.text(x, 262, `${c.desc} · vida ${c.hp}`, { ...TEXT, fontSize: '14px' }).setOrigin(0.5);
      bg.on('pointerdown', () => { this.choice.char = i; this.refresh(); });
      return { bg, img, edge };
    });

    label(310, 'Cor da roupa');
    this.swatches = OUTFITS.map((color, i) => {
      const sw = this.add.circle(GAME_W / 2 + (i - 2.5) * 60, 352, 20, color).setStrokeStyle(4, 0x120e0b).setInteractive({ useHandCursor: true });
      sw.on('pointerdown', () => { this.choice.outfit = i; this.refresh(); });
      return sw;
    });

    // Texto da sala de espera (código, link e quem já entrou)
    this.status = this.add.text(GAME_W / 2, guest ? 440 : 600, '', {
      ...TEXT, fontSize: '15px', color: UI.gold, align: 'center', strokeThickness: 3, lineSpacing: 0,
    }).setOrigin(0.5);

    if (guest) {
      this.status.setText('O anfitrião escolhe o mapa e a dificuldade.\nEscolha seu boneco e clique em ENTRAR.');
      this.playBtn = button(this, GAME_W / 2 + 110, 650, 200, 56, 'ENTRAR', () => this.joinRoom(), 26);
      this.playBtn.text.setColor(UI.gold);
    } else {
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

      this.playBtn = button(this, GAME_W / 2 + 110, 650, 200, 56, 'JOGAR', () => this.play(), 26);
      this.playBtn.text.setColor(UI.gold);
      this.friendBtn = button(this, GAME_W / 2 + 350, 650, 240, 56, 'Jogar com amigo', () => this.openRoom(), 20);
      this.input.keyboard.on('keydown-ENTER', () => this.play());
    }
    button(this, GAME_W / 2 - 110, 650, 160, 56, 'Voltar', () => this.back(), 20);
    this.input.keyboard.on('keydown-ESC', () => this.back());
    this.events.once('shutdown', () => Net.on({}));
    this.refresh();
  }

  back() {
    Net.leave();
    this.scene.start('Menu');
  }

  refresh() {
    const c = this.choice;
    this.charCards.forEach(({ bg, img, edge }, i) => {
      edge.setVisible(i === c.char);
      bg.setTint(i === c.char ? 0xffffff : 0xa49a8c);
      makePlayerTexture(this, CHARACTERS[i], OUTFITS[c.outfit], `char_${CHARACTERS[i].id}`);
      img.setTexture(`char_${CHARACTERS[i].id}`);
      img.setScale(90 / img.height); // cabe no cartão, seja o desenho antigo ou o novo
    });
    this.swatches.forEach((sw, i) => sw.setStrokeStyle(4, i === c.outfit ? UI.edge : 0x120e0b));
    if (this.diffButtons) {
      this.diffButtons.forEach((b, i) => b.select(i === c.difficulty));
      this.modeNormal.select(!c.infinite);
      this.modeInf.select(c.infinite);
      if (!this.infEnabled) this.modeInf.set(this.modeInf.text.text, false);
    }
    // Já na sala: o anfitrião vê o boneco novo
    if (this.joined) Net.send({ t: 'ola', char: c.char, outfit: c.outfit });
  }

  saveChoice() {
    const c = this.choice;
    storageSetJSON('hordew_escolhas', { char: c.char, outfit: c.outfit, difficulty: c.difficulty });
  }

  play() {
    const c = this.choice;
    this.saveChoice();
    if (this.room) {
      // Cooperativo: a cena do jogo avisa os amigos e eles começam junto
      const roster = [{ id: 'h', char: c.char, outfit: c.outfit }];
      this.room.guests.forEach((g, id) => roster.push({ id, char: g.char, outfit: g.outfit }));
      this.scene.start('Game', { ...c, net: { role: 'host', me: 'h', roster } });
      return;
    }
    if (!storageGet('hordew_viu_intro', 0)) {
      storageSet('hordew_viu_intro', 1);
      this.scene.start('Intro', { next: c });
    } else this.scene.start('Game', c);
  }

  // ---------- Cooperativo ----------

  roomText() {
    const r = this.room;
    const n = r.guests.size;
    const quem = n ? `${n} amigo${n > 1 ? 's' : ''} na sala: ${[...r.guests.values()].map((g) => CHARACTERS[g.char].name).join(', ')}. Aperte JOGAR quando quiser.` : 'Esperando o amigo abrir o link...';
    this.status.setText(`Sala ${r.code} · link: ${Net.inviteLink(r.code)}\n${quem}`);
  }

  copyLink() {
    const link = Net.inviteLink(this.room.code);
    const ok = () => this.friendBtn.set('Link copiado!');
    try {
      navigator.clipboard.writeText(link).then(ok, () => this.friendBtn.set('Copie o link acima'));
    } catch (e) {
      this.friendBtn.set('Copie o link acima');
    }
  }

  openRoom() {
    if (this.room) return this.copyLink();
    this.friendBtn.set('Criando sala...', false);
    this.status.setText('Criando a sala...');
    Net.createRoom().then((code) => {
      if (!this.scene.isActive()) return;
      this.room = { code, guests: new Map() };
      Net.on({
        entrou: () => this.roomText(),
        saiu: (id) => { this.room.guests.delete(id); this.roomText(); },
        msg: (m, de) => {
          if (m.t !== 'ola') return;
          this.room.guests.set(de, { char: CHARACTERS[m.char] ? m.char : 0, outfit: OUTFITS[m.outfit] !== undefined ? m.outfit : 0 });
          this.roomText();
        },
      });
      this.friendBtn.set('Copiar link');
      this.copyLink();
      this.roomText();
    }).catch((e) => {
      this.friendBtn.set('Jogar com amigo');
      this.status.setText(e.message).setColor(UI.blood);
    });
  }

  joinRoom() {
    if (this.joined) return;
    this.saveChoice();
    this.playBtn.set('Conectando...', false);
    this.status.setText(`Procurando a sala ${this.sala}...`).setColor(UI.gold);
    Net.join(this.sala).then((me) => {
      if (!this.scene.isActive()) return;
      this.joined = true;
      Net.on({
        saiu: () => {
          this.joined = false;
          this.playBtn.set('ENTRAR');
          this.status.setText('O anfitrião fechou a sala.').setColor(UI.blood);
        },
        msg: (m) => {
          if (m.t !== 'comecar') return;
          this.scene.start('Game', { ...m.setup, char: this.choice.char, outfit: this.choice.outfit, net: { role: 'guest', me, roster: m.roster } });
        },
      });
      this.refresh(); // manda o 'ola' com o boneco escolhido
      this.playBtn.set('Na sala!', false);
      this.status.setText('Você está na sala. Esperando o anfitrião apertar JOGAR...\n(dá para trocar o boneco enquanto isso)');
    }).catch((e) => {
      this.playBtn.set('ENTRAR');
      this.status.setText(e.message).setColor(UI.blood);
    });
  }
}
