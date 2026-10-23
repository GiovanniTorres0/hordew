const FONT = '"Oswald", "Trebuchet MS", sans-serif';
const NOTE_FONT = '"Special Elite", "Courier New", monospace';
// Cores da interface: osso, ferrugem, sangue seco e o amarelo de fita de perigo
const UI = { text: '#e9e1cc', dim: '#a89f8a', gold: '#e0b04a', blood: '#c0281c', green: '#a6c46a', ink: '#2a1d14', edge: 0xe0b04a };
const TEXT = { fontFamily: FONT, fontSize: '18px', color: UI.text, stroke: '#120e0b', strokeThickness: 4 };

// ---------- Texturas da interface: metal enferrujado, madeira lascada, papel velho, silver tape ----------
// Cada placa é desenhada no tamanho exato em que aparece (nada esticado) e fica guardada pelo nome.

function uiRng(key) {
  return new Phaser.Math.RandomDataGenerator([`hordew-ui-${key}`]);
}

// Manchas redondas e suaves (ferrugem, café, sangue)
function blotch(ctx, x, y, r, rgb, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${alpha})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Grão: pontinhos claros e escuros
function grain(ctx, rnd, w, h, n, alpha) {
  for (let i = 0; i < n; i++) {
    const v = rnd.between(0, 1) ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${rnd.realInRange(0, alpha)})`;
    ctx.fillRect(rnd.between(0, w - 1), rnd.between(0, h - 1), rnd.between(1, 2), 1);
  }
}

function rivet(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.arc(x + 1, y + 1.5, 3.6, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(x - 1, y - 1, 0.5, x, y, 3.6);
  g.addColorStop(0, '#d8d2c2');
  g.addColorStop(0.5, '#7d776b');
  g.addColorStop(1, '#3a352e');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 3.4, 0, Math.PI * 2);
  ctx.fill();
}

// Borda com relevo: luz em cima e à esquerda, sombra embaixo e à direita
function bevel(ctx, w, h, light, dark) {
  ctx.fillStyle = light;
  ctx.fillRect(2, 2, w - 4, 2);
  ctx.fillRect(2, 2, 2, h - 4);
  ctx.fillStyle = dark;
  ctx.fillRect(2, h - 4, w - 4, 2);
  ctx.fillRect(w - 4, 2, 2, h - 4);
  ctx.strokeStyle = '#120e0b';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
}

const UI_PAINT = {
  // Chapa de metal escovado com ferrugem, arranhões e rebites
  metal(ctx, w, h, rnd) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#5f5d55');
    g.addColorStop(1, '#3a3833');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      ctx.fillStyle = `rgba(255,255,255,${rnd.realInRange(0, 0.05)})`;
      ctx.fillRect(0, y, w, 1);
    }
    const n = Math.max(3, (w * h) / 1800);
    for (let i = 0; i < n; i++) {
      const edge = rnd.frac() < 0.6; // a ferrugem gosta das bordas
      const x = edge ? (rnd.frac() < 0.5 ? rnd.between(0, 14) : w - rnd.between(0, 14)) : rnd.between(0, w);
      const y = rnd.between(0, h);
      blotch(ctx, x, y, rnd.between(5, Math.min(28, h * 0.8)), rnd.pick(['126,60,22', '96,42,16', '150,82,34']), rnd.realInRange(0.3, 0.65));
    }
    grain(ctx, rnd, w, h, (w * h) / 5, 0.18);
    ctx.lineWidth = 1;
    for (let i = 0; i < Math.max(2, w / 60); i++) {
      const x = rnd.between(0, w);
      const y = rnd.between(0, h);
      ctx.strokeStyle = `rgba(230,225,210,${rnd.realInRange(0.08, 0.22)})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rnd.between(-30, 30), y + rnd.between(-6, 6));
      ctx.stroke();
    }
    bevel(ctx, w, h, 'rgba(255,255,255,0.16)', 'rgba(0,0,0,0.45)');
    if (w >= 40 && h >= 26) {
      const xs = [8, w - 8];
      for (let x = 130; x < w - 60; x += 130) xs.push(x);
      xs.forEach((x) => {
        rivet(ctx, x, 7);
        if (h >= 34) rivet(ctx, x, h - 8);
      });
    }
  },

  // Tábuas pregadas, com veio, nós, frestas e alguma mancha de sangue seco
  madeira(ctx, w, h, rnd) {
    const rows = Math.max(1, Math.round(h / 38));
    const ph = h / rows;
    for (let r = 0; r < rows; r++) {
      const y0 = r * ph;
      const base = [rnd.between(78, 100), rnd.between(54, 66), rnd.between(34, 42)];
      ctx.fillStyle = `rgb(${base})`;
      ctx.fillRect(0, y0, w, ph);
      for (let i = 0; i < ph * 0.9; i++) {
        const y = y0 + rnd.realInRange(2, ph - 2);
        ctx.strokeStyle = `rgba(30,18,10,${rnd.realInRange(0.08, 0.3)})`;
        ctx.lineWidth = rnd.realInRange(0.5, 1.4);
        ctx.beginPath();
        ctx.moveTo(0, y);
        const amp = rnd.realInRange(0.5, 2.5);
        for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x / rnd.between(30, 70) + i) * amp);
        ctx.stroke();
      }
      for (let i = 0; i < w / 180; i++) {
        const x = rnd.between(20, w - 20);
        const y = y0 + ph / 2 + rnd.between(-4, 4);
        ctx.fillStyle = 'rgba(25,14,8,0.6)';
        ctx.beginPath();
        ctx.ellipse(x, y, rnd.between(5, 9), rnd.between(2, 4), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Luz na quina de cima e fresta escura embaixo
      ctx.fillStyle = 'rgba(255,220,170,0.12)';
      ctx.fillRect(0, y0 + 1, w, 2);
      ctx.fillStyle = 'rgba(10,6,3,0.85)';
      ctx.fillRect(0, y0 + ph - 2, w, 2);
      [9, w - 9].forEach((x) => {
        ctx.fillStyle = '#1a1410';
        ctx.beginPath();
        ctx.arc(x, y0 + ph / 2, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(200,190,170,0.5)';
        ctx.fillRect(x - 1, y0 + ph / 2 - 1.5, 1, 1);
      });
    }
    if (w * h > 30000) {
      for (let i = 0; i < 2; i++) blotch(ctx, rnd.between(0, w), rnd.between(0, h), rnd.between(18, 40), '90,12,8', 0.35);
      for (let i = 0; i < 14; i++) blotch(ctx, rnd.between(0, w), rnd.between(0, h), rnd.between(2, 5), '80,10,6', 0.6);
    }
    grain(ctx, rnd, w, h, (w * h) / 8, 0.12);
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    bevel(ctx, w, h, 'rgba(255,220,170,0.1)', 'rgba(0,0,0,0.5)');
  },

  // Folha velha de caderno com borda rasgada, manchas de café e sombra
  papel(ctx, w, h, rnd) {
    const pts = [];
    const step = 10;
    for (let x = 4; x <= w - 4; x += step) pts.push([x, 4 + rnd.realInRange(-1.5, 2)]);
    for (let y = 4; y <= h - 6; y += step) pts.push([w - 5 + rnd.realInRange(-2, 1.5), y]);
    for (let x = w - 4; x >= 4; x -= step) pts.push([x, h - 6 + rnd.realInRange(-2.5, 1.5)]);
    for (let y = h - 6; y >= 4; y -= step) pts.push([4 + rnd.realInRange(-1.5, 2), y]);
    const path = (dx, dy) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)));
      ctx.closePath();
    };
    path(2, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    path(0, 0);
    ctx.save();
    ctx.clip();
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, '#ddd0ac');
    g.addColorStop(1, '#b39c6e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let y = 28; y < h - 8; y += 22) {
      ctx.fillStyle = 'rgba(70,90,130,0.16)';
      ctx.fillRect(6, y, w - 12, 1);
    }
    for (let i = 0; i < Math.max(2, (w * h) / 15000); i++) {
      blotch(ctx, rnd.between(0, w), rnd.between(0, h), rnd.between(10, 34), '120,82,36', rnd.realInRange(0.1, 0.25));
    }
    grain(ctx, rnd, w, h, (w * h) / 6, 0.1);
    ctx.restore();
    path(0, 0);
    ctx.strokeStyle = 'rgba(90,70,40,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  },

  // Encaixe fundo de metal escuro (onde ficam os ícones das torres)
  slot(ctx, w, h, rnd) {
    ctx.fillStyle = '#24221d';
    ctx.fillRect(0, 0, w, h);
    blotch(ctx, w / 2, h / 2 - 4, w * 0.5, '150,140,120', 0.35);
    for (let i = 0; i < 2; i++) blotch(ctx, rnd.between(0, w), rnd.between(0, h), rnd.between(6, 14), '110,50,20', 0.35);
    grain(ctx, rnd, w, h, w * h / 4, 0.15);
    bevel(ctx, w, h, 'rgba(0,0,0,0.6)', 'rgba(255,255,255,0.12)');
  },
};

// Devolve o nome de uma textura de placa (metal, madeira, papel, slot) no tamanho pedido
function uiTexture(scene, kind, w, h) {
  w = Math.round(w);
  h = Math.round(h);
  const key = `ui_${kind}_${w}x${h}`;
  if (!scene.textures.exists(key)) {
    const t = scene.textures.createCanvas(key, w, h);
    UI_PAINT[kind](t.context, w, h, uiRng(key));
    t.refresh();
  }
  return key;
}

function plate(scene, x, y, w, h, kind = 'metal') {
  return scene.add.image(x, y, uiTexture(scene, kind, w, h));
}

// Ícones pequenos rabiscados e a fita adesiva prata
function makeUiTextures(scene) {
  const icon = (key, w, h, draw) => {
    if (scene.textures.exists(key)) return;
    const t = scene.textures.createCanvas(key, w, h);
    const ctx = t.context;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    draw(ctx, w, h);
    t.refresh();
  };
  // Preenche e contorna duas vezes, levemente deslocado, como o traço do resto do jogo
  const ink = (ctx, shape, fill) => {
    shape();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#120e0b';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.save();
    ctx.translate(0.7, -0.5);
    shape();
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.restore();
  };
  icon('ic_vida', 28, 28, (ctx) => ink(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(14, 24);
    ctx.bezierCurveTo(2, 15, 2, 5, 9, 5);
    ctx.bezierCurveTo(12, 5, 14, 8, 14, 9);
    ctx.bezierCurveTo(14, 8, 16, 5, 19, 5);
    ctx.bezierCurveTo(26, 5, 26, 15, 14, 24);
    ctx.closePath();
  }, '#b3261e'));
  icon('ic_base', 28, 28, (ctx) => {
    ink(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(3, 13);
      ctx.lineTo(14, 3);
      ctx.lineTo(25, 13);
      ctx.lineTo(22, 13);
      ctx.lineTo(22, 25);
      ctx.lineTo(6, 25);
      ctx.lineTo(6, 13);
      ctx.closePath();
    }, '#c9b48a');
    ctx.fillStyle = '#120e0b';
    ctx.fillRect(12, 17, 5, 8);
    ctx.strokeStyle = '#6b4a2a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(7, 16);
    ctx.lineTo(21, 22);
    ctx.stroke();
  });
  icon('ic_zumbi', 28, 28, (ctx) => {
    ink(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(5, 13);
      ctx.bezierCurveTo(5, 1, 23, 1, 23, 13);
      ctx.lineTo(20, 18);
      ctx.lineTo(19, 25);
      ctx.lineTo(9, 25);
      ctx.lineTo(8, 18);
      ctx.closePath();
    }, '#d9cfb4');
    ctx.fillStyle = '#120e0b';
    ctx.beginPath();
    ctx.ellipse(10, 13, 3, 3.6, 0, 0, Math.PI * 2);
    ctx.ellipse(18, 13, 3, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(13, 17, 2, 3);
    [11, 14, 17].forEach((x) => ctx.fillRect(x, 22, 1, 3));
  });
  icon('ic_grana', 30, 24, (ctx) => {
    ink(ctx, () => {
      ctx.beginPath();
      ctx.rect(3, 5, 24, 14);
    }, '#6b6a48');
    ctx.strokeStyle = 'rgba(18,14,11,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(6, 8, 18, 8);
    ctx.fillStyle = '#e9e1cc';
    ctx.font = 'bold 12px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 15, 12.5);
  });
  icon('ui_fita', 64, 20, (ctx, w, h) => {
    const rnd = uiRng('fita');
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= w; x += 4) ctx.lineTo(x, rnd.realInRange(0, 1.5));
    for (let y = 0; y <= h; y += 3) ctx.lineTo(w - rnd.realInRange(0, 4), y);
    for (let x = w; x >= 0; x -= 4) ctx.lineTo(x, h - rnd.realInRange(0, 1.5));
    for (let y = h; y >= 0; y -= 3) ctx.lineTo(rnd.realInRange(0, 4), y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(178,178,170,0.88)';
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let x = 0; x < w; x += 2) {
      ctx.fillStyle = `rgba(255,255,255,${rnd.realInRange(0, 0.14)})`;
      ctx.fillRect(x, 0, 1, h);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(0, 2, w, 2);
    ctx.fillStyle = 'rgba(40,40,36,0.25)';
    ctx.fillRect(0, h - 4, w, 3);
    ctx.restore();
  });
}

// Pedaço de silver tape segurando uma placa
function tape(scene, x, y, angle = 0, w = 64) {
  return scene.add.image(x, y, 'ui_fita').setAngle(angle).setDisplaySize(w, 20);
}

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

// Botão de chapa de metal com texto; onClick recebe o clique; select() põe a moldura amarela de escolhido
function button(scene, x, y, w, h, label, onClick, size = 16) {
  const edge = scene.add.rectangle(x, y, w + 6, h + 6).setStrokeStyle(3, UI.edge).setVisible(false);
  const bg = plate(scene, x, y, w, h, 'metal').setInteractive({ useHandCursor: true });
  const text = scene.add.text(x, y, label, { ...TEXT, fontSize: `${size}px`, strokeThickness: 3, align: 'center' }).setOrigin(0.5);
  bg.enabled = true;
  const paint = (hover) => bg.setTint(!bg.enabled ? 0x5e5750 : hover ? 0xffffff : 0xc9c1b4);
  paint(false);
  bg.on('pointerdown', (p, lx, ly, ev) => { ev.stopPropagation(); onClick(); });
  bg.on('pointerover', () => paint(true));
  bg.on('pointerout', () => paint(false));
  return {
    bg, text,
    set(labelText, enabled = true) {
      text.setText(labelText);
      bg.enabled = enabled;
      paint(false);
      text.setColor(enabled ? UI.text : '#7d7468');
    },
    select(on) { edge.setVisible(on); },
    setVisible(on) {
      bg.setVisible(on);
      text.setVisible(on);
      if (!on) edge.setVisible(false);
    },
    list: [edge, bg, text],
  };
}

// Barra de vida: fundo afundado, cor com sujeira riscada e brilho em cima
function grimyBar(g, x, y, w, h, frac, color) {
  g.fillStyle(0x120e0b).fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle(0x2a2520).fillRect(x, y, w, h);
  const fw = w * Phaser.Math.Clamp(frac, 0, 1);
  g.fillStyle(color).fillRect(x, y, fw, h);
  g.lineStyle(1, 0x000000, 0.25);
  for (let i = 4; i < fw; i += 7) g.lineBetween(x + i, y + h, x + i + 5, y);
  g.fillStyle(0xffffff, 0.18).fillRect(x, y + 1, fw, 2);
  g.fillStyle(0x000000, 0.3).fillRect(x, y + h - 3, fw, 3);
}

// Barra superior, minimapa, barra de construções e mensagens na tela
class Hud {
  constructor(scene) {
    this.scene = scene;
    const top = 48;
    fixed(plate(scene, GAME_W / 2, top / 2, GAME_W, top, 'metal'), 20);
    fixed(tape(scene, 300, 4, -6, 56), 21);
    fixed(tape(scene, 990, 44, 4, 50), 21);
    this.waveText = fixed(scene.add.text(16, 2, '', { ...TEXT, fontFamily: TITLE_FONT, fontSize: '22px', color: UI.text }), 21);
    this.levelText = fixed(scene.add.text(17, 27, '', { ...TEXT, fontSize: '14px', color: '#d8ccb0', strokeThickness: 3 }), 21);
    fixed(scene.add.image(352, 24, 'ic_zumbi'), 21);
    this.zombieText = fixed(scene.add.text(370, 10, '', { ...TEXT, fontSize: '20px' }), 21);
    fixed(scene.add.image(478, 24, 'ic_vida'), 21);
    fixed(scene.add.image(728, 24, 'ic_base'), 21);
    fixed(scene.add.image(GAME_W - 128, 24, 'ic_grana'), 21);
    this.bars = fixed(scene.add.graphics(), 21);
    this.hpText = fixed(scene.add.text(596, 24, '', { ...TEXT, fontSize: '14px', strokeThickness: 3 }).setOrigin(0.5), 22);
    this.baseText = fixed(scene.add.text(846, 24, '', { ...TEXT, fontSize: '14px', strokeThickness: 3 }).setOrigin(0.5), 22);
    this.moneyText = fixed(scene.add.text(GAME_W - 18, 8, '', { ...TEXT, fontSize: '24px', color: UI.gold }).setOrigin(1, 0), 21);
    this.statusText = fixed(scene.add.text(GAME_W / 2, top + 8, '', { ...TEXT, fontSize: '18px', color: UI.gold }).setOrigin(0.5, 0), 21);

    // Placa de madeira do intervalo: tempo até a próxima horda e atalhos
    this.daySign = fixed(scene.add.container(GAME_W / 2, GAME_H - 68 - 40), 21);
    this.daySign.add([
      plate(scene, 0, 0, 470, 58, 'madeira'),
      tape(scene, -220, -24, -20, 46),
      tape(scene, 222, -24, 18, 46),
    ]);
    this.dayTitle = scene.add.text(0, -11, '', { ...TEXT, fontFamily: TITLE_FONT, fontSize: '22px' }).setOrigin(0.5);
    this.dayKeys = scene.add.text(0, 14, '', { ...TEXT, fontSize: '15px', color: '#d8ccb0', strokeThickness: 3 }).setOrigin(0.5);
    this.daySign.add([this.dayTitle, this.dayKeys]);
    fixed(this.daySign, 21);

    // Bilhete de papel com as instruções: some depois da 1ª horda, [H] mostra de novo
    this.tipsForced = null;
    const tw = 400;
    const th = 214;
    this.tips = scene.add.container(16 + tw / 2, top + 60 + th / 2).setAngle(-1.5);
    this.tips.add([
      plate(scene, 0, 0, tw, th, 'papel'),
      tape(scene, -tw / 2 + 20, -th / 2 + 6, -35, 56),
      tape(scene, tw / 2 - 20, -th / 2 + 6, 35, 56),
      scene.add.text(-tw / 2 + 22, -th / 2 + 18,
        'Os mortos vêm de todos os lados atrás\nda casa no centro. Segure até o fim.\n\n'
        + 'WASD anda · mouse mira e atira\n'
        + '[1]–[7] constrói · botão direito: upgrade\n'
        + '[L] loja entre hordas · [Q] troca a arma\n'
        + '[Espaço] chama a horda · [P] pausa\n'
        + '[H] esconde este bilhete',
        { fontFamily: NOTE_FONT, fontSize: '15px', color: UI.ink, lineSpacing: 5 }),
    ]);
    fixed(this.tips, 22);
    scene.input.keyboard.on('keydown-H', () => { this.tipsForced = !this.tips.visible; });

    this.makeToolbar();
    this.bannerText = fixed(scene.add.text(GAME_W / 2, GAME_H / 2 + 130, '', {
      ...TEXT, fontFamily: TITLE_FONT, fontSize: '58px', color: UI.blood, stroke: '#120e0b', strokeThickness: 9, align: 'center',
    }).setOrigin(0.5).setAlpha(0), 25);
    this.floatLine = fixed(scene.add.text(GAME_W / 2, GAME_H - 172, '', { ...TEXT, fontSize: '20px', color: UI.gold }).setOrigin(0.5).setAlpha(0), 24);

    // Minimapa numa moldura de metal: no escuro só aparecem os zumbis iluminados
    this.mini = { x: GAME_W - 232, y: top + 14, w: 216, h: (216 * WORLD_H) / WORLD_W };
    const { x, y, w, h } = this.mini;
    fixed(plate(scene, x + w / 2, y + h / 2, w + 16, h + 16, 'metal'), 20);
    this.miniG = fixed(scene.add.graphics(), 21);
    fixed(tape(scene, x + 8, y - 4, -30, 44), 22);
    this.miniAt = 0;
  }

  // Barra de baixo: um encaixe por construção (clicável), mais arma, pet e atalhos
  makeToolbar() {
    const s = this.scene;
    const bh = 68;
    const y = GAME_H - bh / 2;
    fixed(plate(s, GAME_W / 2, y, GAME_W, bh, 'metal'), 20);
    this.toolTip = fixed(s.add.text(0, GAME_H - bh - 14, '', { ...TEXT, fontSize: '16px', color: UI.text }).setOrigin(0.5, 1), 24);
    this.slots = BUILD_ORDER.map((type, i) => {
      const def = BUILDINGS[type];
      const x = 42 + i * 68;
      const edge = fixed(s.add.rectangle(x, y, 68, 62).setStrokeStyle(3, UI.edge).setVisible(false), 21);
      const bg = fixed(plate(s, x, y, 64, 58, 'slot').setInteractive({ useHandCursor: true }), 21);
      const img = fixed(s.add.image(x, y - 3, def.tex), 22);
      img.setScale(Math.min(30 / img.width, 30 / img.height));
      const gun = def.gunTex && s.textures.exists(def.gunTex) ? fixed(s.add.image(x, y - 10, def.gunTex), 22) : null;
      if (gun) gun.setScale(img.scale * 0.9);
      const key = fixed(s.add.text(x - 29, y - 29, `${i + 1}`, { ...TEXT, fontSize: '13px', strokeThickness: 3 }), 23);
      const cost = fixed(s.add.text(x + 29, y - 29, '', { ...TEXT, fontSize: '12px', color: UI.gold, strokeThickness: 3 }).setOrigin(1, 0), 23);
      fixed(s.add.text(x, y + 28, def.name, { ...TEXT, fontSize: '12px', strokeThickness: 3 }).setOrigin(0.5, 1), 23);
      bg.on('pointerdown', (p, lx, ly, ev) => { ev.stopPropagation(); s.setBuild(s.buildType === type ? null : type); });
      bg.on('pointerover', () => this.toolTip.setText(def.name).setX(x + 0).setVisible(true));
      bg.on('pointerout', () => this.toolTip.setVisible(false));
      return { type, edge, img, gun, cost };
    });
    const x0 = 24 + BUILD_ORDER.length * 68;
    this.toolText = fixed(s.add.text(x0, GAME_H - 58, '', { ...TEXT, fontSize: '17px' }), 21);
    this.infoText = fixed(s.add.text(x0, GAME_H - 30, '', { ...TEXT, fontSize: '14px', color: UI.dim, strokeThickness: 3 }), 21);
  }

  update() {
    const s = this.scene;
    const goal = s.infinite ? '∞' : s.wavesToWin;
    this.waveText.setText(`Horda ${s.wave}/${goal}`);
    this.levelText.setText(`${s.level.name} · ${s.diff.name}`);
    const left = s.spawnQueue.length + s.zombies.getChildren().filter((z) => !z.optional).length;
    this.zombieText.setText(`${left}`);
    this.moneyText.setText(`$ ${s.money}`);

    const g = this.bars;
    g.clear();
    const hpFrac = s.hp / s.maxHp;
    grimyBar(g, 496, 14, 200, 20, hpFrac, hpFrac > 0.3 ? 0x8a2a1c : 0xd0331f);
    grimyBar(g, 746, 14, 200, 20, s.base.hp / s.base.maxHp, 0x9c7a3a);
    this.hpText.setText(s.down ? 'CAÍDO' : `${Math.ceil(s.hp)}/${s.maxHp}`);
    this.baseText.setText(`CASA ${Math.ceil(s.base.hp)}/${s.base.maxHp}`);

    const status = [];
    if (s.event) status.push(EVENTS[s.event].name);
    if (s.now < s.camoUntil) status.push('Camuflado');
    if (s.now < s.bileUntil) status.push('Vomitado!');
    if (s.pinnedBy) status.push('PRESO! Aperte Espaço');
    if (s.smokedBy) status.push('Puxado pelo Smoker! Atire nele');
    this.statusText.setText(status.join(' · '));

    this.slots.forEach(({ type, edge, img, gun, cost }) => {
      const c = s.buildCost(type);
      const can = s.money >= c;
      edge.setVisible(s.buildType === type);
      img.setAlpha(can ? 1 : 0.45);
      if (gun) gun.setAlpha(can ? 1 : 0.45);
      cost.setText(`$${c}`).setColor(can ? UI.gold : '#b0453a');
    });
    const pet = s.pet ? s.pet.def.name : 'nenhum';
    this.toolText.setText(`${s.weapon.name.toUpperCase()}  [Q]      Pet: ${pet}`);
    this.infoText.setText('Botão direito numa torre: upgrade e conserto · [H] dicas · [U] som');

    const day = s.state === 'intermission';
    this.daySign.setVisible(day && !s.shop.isOpen);
    if (day) {
      const early = Math.floor(s.intermissionLeft * EARLY_BONUS * s.diff.money);
      this.dayTitle.setText(`Próxima horda em ${Math.ceil(s.intermissionLeft)}s`);
      this.dayKeys.setText(`[Espaço] chamar já (+$${early})  ·  [L] loja  ·  [P] pausa`);
    }
    const tipsOn = this.tipsForced !== null ? this.tipsForced : day && s.wave === 0;
    this.tips.setVisible(tipsOn && s.state !== 'over' && !s.shop.isOpen && this.bannerText.alpha < 0.05);

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
    g.fillStyle(0x16130f, 0.92).fillRect(x, y, w, h);
    g.lineStyle(1, 0x3a342b, 0.8);
    g.lineBetween(x, y + BASE_Y * k, x + w, y + BASE_Y * k);
    g.lineBetween(x + BASE_X * k, y, x + BASE_X * k, y + h);
    g.fillStyle(0xc9b48a).fillRect(x + (BASE_X - BASE_W / 2) * k, y + (BASE_Y - BASE_H / 2) * k, BASE_W * k, BASE_H * k);
    g.fillStyle(0x8fa0a8);
    s.structures.forEach((st) => g.fillRect(x + st.x * k - 1.5, y + st.y * k - 1.5, 3, 3));
    s.zombies.getChildren().forEach((z) => {
      if (!s.isLit(z.x, z.y)) return;
      g.fillStyle(z.def.boss || z.def === ZOMBIES.witch ? 0xffffff : 0xd0331f);
      g.fillCircle(x + z.x * k, y + z.y * k, z.def.boss ? 3.5 : 1.8);
    });
    if (!s.down) g.fillStyle(0xe0b04a).fillCircle(x + s.player.x * k, y + s.player.y * k, 3);
    const cam = s.cameras.main;
    g.lineStyle(1, 0xe9e1cc, 0.5).strokeRect(x + cam.scrollX * k, y + cam.scrollY * k, GAME_W * k, GAME_H * k);
  }

  setPaused(paused) {
    if (!this.pauseText) {
      const sc = this.scene;
      this.pauseDim = fixed(sc.add.rectangle(0, 0, GAME_W, GAME_H, 0x0c0a08, 0.55).setOrigin(0), 39);
      this.pauseText = fixed(sc.add.text(GAME_W / 2, GAME_H / 2, 'PAUSADO\n[P] para voltar', {
        fontFamily: TITLE_FONT, fontSize: '64px', color: UI.text, stroke: '#120e0b', strokeThickness: 10, align: 'center',
      }).setOrigin(0.5), 40);
    }
    this.pauseDim.setVisible(paused);
    this.pauseText.setVisible(paused);
  }

  banner(text, color = UI.blood) {
    this.bannerText.setText(text).setColor(color).setAlpha(1).setScale(0.6);
    this.scene.tweens.killTweensOf(this.bannerText);
    this.scene.tweens.add({ targets: this.bannerText, scale: 1, duration: 250, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: this.bannerText, alpha: 0, delay: 1800, duration: 500 });
  }

  // Mensagem curta acima da barra de construções
  floatText(text) {
    this.floatLine.setText(text).setAlpha(1);
    this.scene.tweens.killTweensOf(this.floatLine);
    this.scene.tweens.add({ targets: this.floatLine, alpha: 0, delay: 2200, duration: 600 });
  }

  endScreen(title, reason, stats, hint) {
    const s = this.scene;
    s.tweens.killTweensOf(this.bannerText);
    this.bannerText.setAlpha(0);
    this.tips.setVisible(false);
    this.daySign.setVisible(false);
    fixed(s.add.rectangle(0, 0, GAME_W, GAME_H, 0x0c0a08, 0.7).setOrigin(0), 30);
    fixed(plate(s, GAME_W / 2, GAME_H / 2, 860, 330, 'madeira'), 30);
    fixed(tape(s, GAME_W / 2 - 400, GAME_H / 2 - 150, -30), 31);
    fixed(tape(s, GAME_W / 2 + 400, GAME_H / 2 - 150, 30), 31);
    const base = { fontFamily: FONT, color: UI.text, stroke: '#120e0b', strokeThickness: 6, align: 'center' };
    fixed(s.add.text(GAME_W / 2, GAME_H / 2 - 100, title, { ...base, fontFamily: TITLE_FONT, fontSize: '84px', color: title.startsWith('VIT') ? UI.green : UI.blood }).setOrigin(0.5), 31);
    fixed(s.add.text(GAME_W / 2, GAME_H / 2 - 25, reason, { ...base, fontSize: '26px' }).setOrigin(0.5), 31);
    fixed(s.add.text(GAME_W / 2, GAME_H / 2 + 25, stats, { ...base, fontSize: '20px', wordWrap: { width: 800 } }).setOrigin(0.5), 31);
    fixed(s.add.text(GAME_W / 2, GAME_H / 2 + 105, hint, { ...base, fontSize: '22px', color: UI.gold }).setOrigin(0.5), 31);
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
    c.add(plate(scene, 0, 0, this.w, this.h, 'madeira').setInteractive());
    c.add(plate(scene, 0, -this.h / 2 + 30, 460, 50, 'metal'));
    c.add([tape(scene, -225, -this.h / 2 + 10, -25), tape(scene, 225, -this.h / 2 + 10, 25)]);
    c.add(scene.add.text(0, -this.h / 2 + 30, 'Loja · entrega de helicóptero', { ...TEXT, fontFamily: TITLE_FONT, fontSize: '28px', color: UI.gold }).setOrigin(0.5));
    this.tabs = [['weapon', 'Armas'], ['pet', 'Pets'], ['item', 'Itens']].map(([id, label], i) => {
      const b = button(scene, -170 + i * 170, -this.h / 2 + 88, 150, 36, label, () => { this.tab = id; this.render(); }, 18);
      c.add(b.list);
      return { id, b };
    });
    this.note = scene.add.text(0, this.h / 2 - 52, '', { ...TEXT, fontSize: '17px', color: UI.green }).setOrigin(0.5);
    c.add(this.note);
    c.add(scene.add.text(0, this.h / 2 - 24, '[L] ou [Esc] fecha', { ...TEXT, fontSize: '14px', color: UI.dim }).setOrigin(0.5));
    this.container = c;
    this.rows = [];
    fixed(c, 26);
    showPanel(c, false);
  }

  entries() {
    const s = this.scene;
    if (this.tab === 'weapon') {
      return Object.keys(WEAPONS).filter((id) => id !== 'pistola').map((id) => ({
        kind: 'weapon', id, name: WEAPONS[id].name, desc: WEAPONS[id].desc, cost: WEAPONS[id].cost, owned: s.owned.includes(id), icon: `w_${id}`,
      }));
    }
    if (this.tab === 'pet') {
      return Object.keys(PETS).map((id) => ({
        kind: 'pet', id, name: PETS[id].name, desc: PETS[id].desc, cost: PETS[id].cost, owned: s.pet && s.pet.id === id, icon: PETS[id].tex,
      }));
    }
    return SHOP_ITEMS.map((it) => ({ kind: 'item', ...it, owned: false }));
  }

  // Cada item é uma tira de papel presa na madeira; o preço vai escrito à mão
  render() {
    const s = this.scene;
    this.rows.forEach((o) => o.destroy());
    this.rows = [];
    this.tabs.forEach(({ id, b }) => b.select(id === this.tab));
    const rw = this.w - 60;
    this.entries().forEach((e, i) => {
      const y = -this.h / 2 + 140 + i * 42;
      const can = !e.owned && s.money >= e.cost;
      const bg = plate(s, 0, y, rw, 38, 'papel').setInteractive({ useHandCursor: !e.owned });
      bg.setAngle(((i * 7) % 5 - 2) * 0.25).setAlpha(can || e.owned ? 1 : 0.75);
      const objs = [bg];
      let tx = -rw / 2 + 18;
      if (e.icon && s.textures.exists(e.icon)) {
        const ic = s.add.image(tx + 14, y, e.icon);
        ic.setScale(Math.min(30 / ic.width, 30 / ic.height));
        objs.push(ic);
        tx += 36;
      }
      objs.push(s.add.text(tx, y, `${e.name} — ${e.desc}`, { fontFamily: NOTE_FONT, fontSize: '16px', color: UI.ink }).setOrigin(0, 0.5));
      const ownedLabel = e.kind === 'pet' ? 'SEU PET' : 'VOCÊ TEM';
      objs.push(s.add.text(rw / 2 - 16, y, e.owned ? ownedLabel : `$ ${e.cost}`, {
        fontFamily: e.owned ? TITLE_FONT : NOTE_FONT, fontSize: e.owned ? '18px' : '19px', color: e.owned ? '#4f6b2a' : can ? UI.ink : '#8a1d12',
      }).setOrigin(1, 0.5).setAngle(e.owned ? -4 : 0));
      bg.on('pointerover', () => can && bg.setTint(0xfff4dc));
      bg.on('pointerout', () => bg.clearTint());
      bg.on('pointerdown', (p, lx, ly, ev) => { ev.stopPropagation(); this.buy(e); });
      objs.forEach((o) => { this.container.add(o); o.setScrollFactor(0); this.rows.push(o); });
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
      this.note.setText('Dinheiro insuficiente').setColor(UI.blood);
      return;
    }
    s.money -= e.cost;
    this.note.setText('Comprado! Pegue a caixa que cair do céu').setColor(UI.green);
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
    const h = 260;
    const c = scene.add.container(GAME_W - w / 2 - 14, GAME_H - 68 - h / 2 - 12).setVisible(false);
    c.add(plate(scene, 0, 0, w, h, 'madeira').setInteractive());
    c.add([tape(scene, -w / 2 + 14, -h / 2 + 6, -40, 50), tape(scene, w / 2 - 14, -h / 2 + 6, 40, 50)]);
    this.title = scene.add.text(-w / 2 + 18, -h / 2 + 12, '', { ...TEXT, fontFamily: TITLE_FONT, fontSize: '26px', color: UI.gold });
    this.info = scene.add.text(-w / 2 + 18, -h / 2 + 48, '', { ...TEXT, fontSize: '14px', color: '#d8ccb0', strokeThickness: 3 });
    c.add([this.title, this.info]);
    this.paths = UPGRADE_PATHS.map((path, i) => {
      const b = button(scene, 0, -h / 2 + 96 + i * 40, w - 32, 34, '', () => this.act(() => scene.upgrade(this.target, i)), 14);
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
      b.setVisible(show);
      if (!show) return;
      const lvl = t.levels[i];
      const path = UPGRADE_PATHS[i];
      if (lvl >= 3) return b.set(`${path.name}: nível máximo`, false);
      if (!s.canUpgrade(t, i)) return b.set(`${path.name}: bloqueado (já tem 2 linhas)`, false);
      const cost = s.upgradeCost(t, i);
      b.set(`${path.name} ${lvl}/3 → ${path.desc[lvl]}  $${cost}`, s.money >= cost);
    });
    const rc = s.repairCost(t);
    this.repairBtn.set(rc ? `Consertar $${rc}` : 'Sem dano para consertar', rc > 0 && s.money >= rc);
    const isBase = t === s.base;
    this.sellBtn.setVisible(!isBase);
    if (!isBase) this.sellBtn.set(`Vender $${s.sellValue(t)}`);
  }
}
