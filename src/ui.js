const FONT = '"Trebuchet MS", Verdana, sans-serif';
const TEXT = { fontFamily: FONT, fontSize: '18px', color: '#f4ecff', stroke: '#1b1424', strokeThickness: 4 };

// Tudo da interface fica preso à tela (scrollFactor 0), não ao mapa
// (no Phaser 3.80 o container não repassa o scrollFactor aos filhos, e o clique sairia deslocado)
function fixed(obj, depth) {
  obj.setScrollFactor(0);
  if (obj.list) obj.each((o) => o.setScrollFactor(0));
  return obj.setDepth(depth);
}

// Mostra ou esconde um painel; escondido, os botões dele não recebem clique
function showPanel(container, on) {
  container.setVisible(on);
  container.each((o) => { if (o.input) o.input.enabled = on; });
}

// Botão retangular com texto; onClick recebe o clique
function button(scene, x, y, w, h, label, onClick, size = 16) {
  const bg = scene.add.rectangle(x, y, w, h, 0x3f2a4f).setStrokeStyle(2, 0x1b1424).setInteractive({ useHandCursor: true });
  const text = scene.add.text(x, y, label, { ...TEXT, fontSize: `${size}px`, strokeThickness: 3, align: 'center' }).setOrigin(0.5);
  bg.on('pointerdown', (p, lx, ly, ev) => { ev.stopPropagation(); onClick(); });
  bg.on('pointerover', () => bg.enabled !== false && bg.setFillStyle(0x5a3d70));
  bg.on('pointerout', () => bg.setFillStyle(bg.enabled === false ? 0x2a2230 : 0x3f2a4f));
  return {
    bg, text,
    set(labelText, enabled = true) {
      text.setText(labelText);
      bg.enabled = enabled;
      bg.setFillStyle(enabled ? 0x3f2a4f : 0x2a2230);
      text.setColor(enabled ? '#f4ecff' : '#8a7a99');
    },
    list: [bg, text],
  };
}

// Barra superior, minimapa, barra de ferramentas e mensagens na tela
class Hud {
  constructor(scene) {
    this.scene = scene;
    fixed(scene.add.rectangle(0, 0, GAME_W, HUD_H, PALETTE.outline, 0.85).setOrigin(0), 20);
    this.waveText = fixed(scene.add.text(14, 9, '', TEXT), 21);
    this.zombieText = fixed(scene.add.text(330, 9, '', TEXT), 21);
    this.moneyText = fixed(scene.add.text(GAME_W - 14, 9, '', { ...TEXT, color: '#ffd86b' }).setOrigin(1, 0), 21);
    this.bars = fixed(scene.add.graphics(), 21);
    this.hpText = fixed(scene.add.text(570, 20, '', { ...TEXT, fontSize: '14px' }).setOrigin(0.5), 22);
    this.baseText = fixed(scene.add.text(800, 20, '', { ...TEXT, fontSize: '14px' }).setOrigin(0.5), 22);
    this.statusText = fixed(scene.add.text(14, HUD_H + 8, '', { ...TEXT, fontSize: '16px', color: '#ffd86b' }), 21);

    fixed(scene.add.rectangle(0, GAME_H - 56, GAME_W, 56, PALETTE.outline, 0.7).setOrigin(0), 20);
    this.toolText = fixed(scene.add.text(14, GAME_H - 50, '', { ...TEXT, fontSize: '14px' }), 21);
    this.infoText = fixed(scene.add.text(14, GAME_H - 27, '', { ...TEXT, fontSize: '14px', color: '#c9b8d9' }), 21);
    this.centerText = fixed(scene.add.text(GAME_W / 2, 70, '', { ...TEXT, fontSize: '20px', align: 'center' }).setOrigin(0.5, 0), 21);
    this.bannerText = fixed(scene.add.text(GAME_W / 2, GAME_H / 2 - 140, '', {
      ...TEXT, fontFamily: TITLE_FONT, fontSize: '52px', color: '#8fd16a', strokeThickness: 8, align: 'center',
    }).setOrigin(0.5).setAlpha(0), 25);
    this.floatLine = fixed(scene.add.text(GAME_W / 2, GAME_H - 90, '', { ...TEXT, fontSize: '20px', color: '#ffd86b' }).setOrigin(0.5).setAlpha(0), 24);

    // Minimapa: no escuro só aparecem os zumbis iluminados
    this.mini = { x: GAME_W - 234, y: HUD_H + 8, w: 220, h: (220 * WORLD_H) / WORLD_W };
    this.miniG = fixed(scene.add.graphics(), 21);
    this.miniAt = 0;
  }

  update() {
    const s = this.scene;
    const goal = s.infinite ? '∞' : s.wavesToWin;
    this.waveText.setText(`${s.level.name} · Horda ${s.wave}/${goal} · ${s.diff.name}`);
    const left = s.spawnQueue.length + s.zombies.getChildren().filter((z) => !z.optional).length;
    this.zombieText.setText(s.state === 'wave' ? `Zumbis: ${left}` : '');
    this.moneyText.setText(`$ ${s.money}`);

    const g = this.bars;
    g.clear();
    const bar = (x, frac, color) => {
      g.fillStyle(0x3a2a40).fillRect(x, 10, 200, 20);
      g.fillStyle(color).fillRect(x, 10, 200 * Math.max(0, frac), 20);
      g.lineStyle(2, 0xf4ecff).strokeRect(x, 10, 200, 20);
    };
    bar(470, s.hp / s.maxHp, s.hp / s.maxHp > 0.3 ? 0x6bd13a : 0xe8453c);
    bar(700, s.base.hp / s.base.maxHp, 0xb36ab8);
    this.hpText.setText(s.down ? 'Caído' : `Vida ${Math.ceil(s.hp)}/${s.maxHp}`);
    this.baseText.setText(`Base ${Math.ceil(s.base.hp)}/${s.base.maxHp}`);

    const status = [];
    if (s.event) status.push(EVENTS[s.event].name);
    if (s.now < s.camoUntil) status.push('Camuflado');
    if (s.now < s.bileUntil) status.push('Vomitado!');
    if (s.pinnedBy) status.push('PRESO! Aperte Espaço');
    if (s.smokedBy) status.push('Puxado pelo Smoker! Atire nele');
    this.statusText.setText(status.join(' · '));

    this.toolText.setText(BUILD_ORDER.map((t, i) => `${s.buildType === t ? '▶' : ''}[${i + 1}] ${BUILDINGS[t].name} $${s.buildCost(t)}`).join('   '));
    const pet = s.pet ? s.pet.def.name : 'nenhum (compre na loja)';
    this.infoText.setText(`Arma: ${s.weapon.name} [Q troca] · Pet: ${pet} · Botão direito numa torre ou na base: upgrades, consertar, vender · [U] som`);

    if (s.state === 'intermission') {
      const tip = s.wave === 0
        ? '\n\nOs zumbis vêm de todos os lados e querem destruir a base no centro.\nConstrua com [1] a [7], compre armas e pets na loja [L].'
        : '';
      const early = Math.floor(s.intermissionLeft * EARLY_BONUS * s.diff.money);
      this.centerText.setText(`Dia · próxima horda em ${Math.ceil(s.intermissionLeft)}s\n[Espaço] chamar já (+$${early})   [L] Loja   [P] Pausa${tip}`);
    } else this.centerText.setText('');

    if (s.time.now > this.miniAt) {
      this.miniAt = s.time.now + 100;
      this.drawMinimap();
    }
  }

  drawMinimap() {
    const s = this.scene;
    const { x, y, w, h } = this.mini;
    const k = w / WORLD_W;
    const g = this.miniG;
    g.clear();
    g.fillStyle(0x1b1424, 0.75).fillRect(x, y, w, h);
    g.lineStyle(2, 0xb36ab8).strokeRect(x, y, w, h);
    g.fillStyle(0xb36ab8).fillRect(x + (BASE_X - BASE_W / 2) * k, y + (BASE_Y - BASE_H / 2) * k, BASE_W * k, BASE_H * k);
    g.fillStyle(0x7fdfff);
    s.structures.forEach((st) => g.fillRect(x + st.x * k - 1.5, y + st.y * k - 1.5, 3, 3));
    s.zombies.getChildren().forEach((z) => {
      if (!s.isLit(z.x, z.y)) return;
      g.fillStyle(z.def.boss || z.def === ZOMBIES.witch ? 0xffffff : 0xe8453c);
      g.fillCircle(x + z.x * k, y + z.y * k, z.def.boss ? 3.5 : 1.8);
    });
    if (!s.down) g.fillStyle(0xffd86b).fillCircle(x + s.player.x * k, y + s.player.y * k, 3);
    const cam = s.cameras.main;
    g.lineStyle(1, 0xf4ecff, 0.6).strokeRect(x + cam.scrollX * k, y + cam.scrollY * k, GAME_W * k, GAME_H * k);
  }

  setPaused(paused) {
    if (!this.pauseText) {
      this.pauseText = fixed(this.scene.add.text(GAME_W / 2, GAME_H / 2, 'PAUSADO\n[P] para voltar', {
        fontFamily: TITLE_FONT, fontSize: '64px', color: '#ffd86b', stroke: '#1b1424', strokeThickness: 10, align: 'center',
      }).setOrigin(0.5), 40);
    }
    this.pauseText.setVisible(paused);
  }

  banner(text) {
    this.bannerText.setText(text).setAlpha(1).setScale(0.6);
    this.scene.tweens.killTweensOf(this.bannerText);
    this.scene.tweens.add({ targets: this.bannerText, scale: 1, duration: 250, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: this.bannerText, alpha: 0, delay: 1800, duration: 500 });
  }

  // Mensagem curta acima da barra de ferramentas
  floatText(text) {
    this.floatLine.setText(text).setAlpha(1);
    this.scene.tweens.killTweensOf(this.floatLine);
    this.scene.tweens.add({ targets: this.floatLine, alpha: 0, delay: 2200, duration: 600 });
  }

  endScreen(title, reason, stats, hint) {
    const s = this.scene;
    s.tweens.killTweensOf(this.bannerText);
    this.bannerText.setAlpha(0);
    fixed(s.add.rectangle(0, 0, GAME_W, GAME_H, 0x1b1424, 0.75).setOrigin(0), 30);
    const base = { fontFamily: FONT, color: '#f4ecff', stroke: '#1b1424', strokeThickness: 6, align: 'center' };
    fixed(s.add.text(GAME_W / 2, GAME_H / 2 - 110, title, { ...base, fontFamily: TITLE_FONT, fontSize: '84px', color: '#ffd86b' }).setOrigin(0.5), 31);
    fixed(s.add.text(GAME_W / 2, GAME_H / 2 - 30, reason, { ...base, fontSize: '26px' }).setOrigin(0.5), 31);
    fixed(s.add.text(GAME_W / 2, GAME_H / 2 + 20, stats, { ...base, fontSize: '20px', wordWrap: { width: 1000 } }).setOrigin(0.5), 31);
    fixed(s.add.text(GAME_W / 2, GAME_H / 2 + 90, hint, { ...base, fontSize: '22px', color: '#8fd16a' }).setOrigin(0.5), 31);
  }
}

// Loja aberta entre as hordas, com abas; o item chega de helicóptero
class Shop {
  constructor(scene) {
    this.scene = scene;
    this.isOpen = false;
    this.tab = 'weapon';
    this.w = 760;
    this.h = 560;
    const c = scene.add.container(GAME_W / 2, GAME_H / 2 + 10).setVisible(false);
    c.add(scene.add.rectangle(0, 0, this.w, this.h, 0x2a1f35, 0.96).setStrokeStyle(4, 0xb36ab8).setInteractive());
    c.add(scene.add.text(0, -this.h / 2 + 26, 'LOJA · entrega por helicóptero', { ...TEXT, fontFamily: TITLE_FONT, fontSize: '30px', color: '#ffd86b' }).setOrigin(0.5));
    [['weapon', 'Armas'], ['pet', 'Pets'], ['item', 'Itens']].forEach(([id, label], i) => {
      const b = button(scene, -170 + i * 170, -this.h / 2 + 70, 150, 34, label, () => { this.tab = id; this.render(); });
      c.add(b.list);
    });
    this.note = scene.add.text(0, this.h / 2 - 48, '', { ...TEXT, fontSize: '16px', color: '#8fd16a' }).setOrigin(0.5);
    c.add(this.note);
    c.add(scene.add.text(0, this.h / 2 - 20, '[L] ou [Esc] fechar', { ...TEXT, fontSize: '14px', color: '#c9b8d9' }).setOrigin(0.5));
    this.container = c;
    this.rows = [];
    fixed(c, 26);
    showPanel(c, false);
  }

  entries() {
    const s = this.scene;
    if (this.tab === 'weapon') {
      return Object.keys(WEAPONS).filter((id) => id !== 'pistola').map((id) => ({
        kind: 'weapon', id, name: WEAPONS[id].name, desc: WEAPONS[id].desc, cost: WEAPONS[id].cost, owned: s.owned.includes(id),
      }));
    }
    if (this.tab === 'pet') {
      return Object.keys(PETS).map((id) => ({
        kind: 'pet', id, name: PETS[id].name, desc: PETS[id].desc, cost: PETS[id].cost, owned: s.pet && s.pet.id === id,
      }));
    }
    return SHOP_ITEMS.map((it) => ({ kind: 'item', ...it, owned: false }));
  }

  render() {
    const s = this.scene;
    this.rows.forEach((o) => o.destroy());
    this.rows = [];
    this.entries().forEach((e, i) => {
      const y = -this.h / 2 + 118 + i * 42;
      const can = !e.owned && s.money >= e.cost;
      const bg = s.add.rectangle(0, y, this.w - 40, 36, can ? 0x3f2a4f : 0x2a2230).setStrokeStyle(2, 0x1b1424).setInteractive({ useHandCursor: true });
      const label = s.add.text(-this.w / 2 + 34, y, `${e.name} — ${e.desc}`, { ...TEXT, fontSize: '16px', strokeThickness: 3 }).setOrigin(0, 0.5);
      const price = s.add.text(this.w / 2 - 34, y, e.owned ? (e.kind === 'pet' ? 'seu pet' : 'você tem') : `$ ${e.cost}`, {
        ...TEXT, fontSize: '18px', color: e.owned ? '#8fd16a' : '#ffd86b',
      }).setOrigin(1, 0.5);
      bg.on('pointerdown', (p, lx, ly, ev) => { ev.stopPropagation(); this.buy(e); });
      [bg, label, price].forEach((o) => { this.container.add(o); o.setScrollFactor(0); this.rows.push(o); });
    });
  }

  toggle() {
    if (this.isOpen) this.close();
    else if (this.scene.state === 'intermission') this.open();
  }

  open() {
    this.isOpen = true;
    this.scene.setBuild(null);
    this.scene.panel.close();
    showPanel(this.container, true);
    this.note.setText('');
    this.render();
  }

  close() {
    this.isOpen = false;
    showPanel(this.container, false);
  }

  buy(e) {
    const s = this.scene;
    if (e.owned) return;
    if (s.money < e.cost) {
      this.note.setText('Dinheiro insuficiente').setColor('#e8453c');
      return;
    }
    s.money -= e.cost;
    this.note.setText('Comprado! Pegue a caixa que cair do céu').setColor('#8fd16a');
    s.deliver(e);
    this.render();
  }
}

// Painel de uma construção (botão direito): upgrades em 3 linhas, consertar e vender
class TowerPanel {
  constructor(scene) {
    this.scene = scene;
    this.target = null;
    const w = 400;
    const h = 250;
    const c = scene.add.container(GAME_W - w / 2 - 14, GAME_H - 56 - h / 2 - 10).setVisible(false);
    c.add(scene.add.rectangle(0, 0, w, h, 0x2a1f35, 0.95).setStrokeStyle(3, 0xb36ab8).setInteractive());
    this.title = scene.add.text(-w / 2 + 16, -h / 2 + 12, '', { ...TEXT, fontFamily: TITLE_FONT, fontSize: '26px', color: '#ffd86b' });
    this.info = scene.add.text(-w / 2 + 16, -h / 2 + 46, '', { ...TEXT, fontSize: '14px', color: '#c9b8d9' });
    c.add([this.title, this.info]);
    this.paths = UPGRADE_PATHS.map((path, i) => {
      const b = button(scene, 0, -h / 2 + 90 + i * 40, w - 32, 34, '', () => this.act(() => scene.upgrade(this.target, i)), 14);
      c.add(b.list);
      return b;
    });
    this.repairBtn = button(scene, -w / 4 + 4, h / 2 - 28, w / 2 - 24, 36, '', () => this.act(() => scene.repair(this.target)), 15);
    this.sellBtn = button(scene, w / 4 - 4, h / 2 - 28, w / 2 - 24, 36, '', () => {
      scene.sell(this.target);
      this.close();
    }, 15);
    c.add(this.repairBtn.list.concat(this.sellBtn.list));
    this.container = c;
    fixed(c, 26);
    showPanel(c, false);
    this.timer = scene.time.addEvent({ delay: 200, loop: true, callback: () => this.refresh() });
  }

  act(fn) {
    fn();
    this.refresh();
  }

  open(target) {
    this.target = target;
    showPanel(this.container, true);
    this.refresh();
    if (target.stats && target.stats.range) {
      this.scene.rangeCircle.setRadius(target.stats.range).setPosition(target.x, target.y).setVisible(true);
    }
  }

  close() {
    this.target = null;
    showPanel(this.container, false);
    if (!this.scene.buildType) this.scene.rangeCircle.setVisible(false);
  }

  refresh() {
    const t = this.target;
    const s = this.scene;
    if (!t || !this.container.visible) return;
    this.title.setText(t.def.name);
    const hp = t.maxHp ? `Vida ${Math.ceil(t.hp)}/${t.maxHp}` : t.durability !== undefined ? `Desgaste ${Math.round((t.durability / t.def.durability) * 100)}%` : '';
    const st = t.stats && t.stats.damage ? ` · Dano ${t.stats.damage.toFixed(1)}` : '';
    this.info.setText(`${hp}${st}${t.def.upgradable ? ' · no máximo 2 linhas de upgrade' : ''}`);
    this.paths.forEach((b, i) => {
      const show = !!t.def.upgradable;
      b.bg.setVisible(show);
      b.text.setVisible(show);
      if (!show) return;
      const lvl = t.levels[i];
      const path = UPGRADE_PATHS[i];
      if (lvl >= 3) return b.set(`${path.name}: nível máximo`, false);
      if (!s.canUpgrade(t, i)) return b.set(`${path.name}: bloqueado (já tem 2 linhas)`, false);
      const cost = s.upgradeCost(t, i);
      b.set(`${path.name} ${lvl}/3 → ${path.desc[lvl]}  $${cost}`, s.money >= cost);
    });
    const rc = s.repairCost(t);
    this.repairBtn.set(rc ? `Consertar $${rc}` : 'Inteira', rc > 0 && s.money >= rc);
    const isBase = t === s.base;
    this.sellBtn.bg.setVisible(!isBase);
    this.sellBtn.text.setVisible(!isBase);
    if (!isBase) this.sellBtn.set(`Vender $${s.sellValue(t)}`);
  }
}
