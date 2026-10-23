// Todas as imagens do jogo são desenhadas por código e viram texturas.
// Personagens são desenhados olhando para a direita (rotação 0).
// Estilo Don't Starve / Tim Burton: contornos tremidos desenhados duas vezes, formas tortas, espirais.

// Gerador fixo para o "tremido" sair igual toda vez
const SKETCH = new Phaser.Math.RandomDataGenerator(['hordew-rabisco']);

// Pontos de uma elipse com as bordas tortas
function wobblePoints(cx, cy, rx, ry, jitter = 0.08, n = 20) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + SKETCH.realInRange(-jitter, jitter);
    pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k));
  }
  return pts;
}

// Forma preenchida com contorno rabiscado (duas passadas levemente deslocadas)
function sketchShape(g, pts, fill, line = PALETTE.outline, width = 3) {
  if (fill !== null) g.fillStyle(fill).fillPoints(pts, true);
  g.lineStyle(width, line).strokePoints(pts, true);
  const off = pts.map((p) => new Phaser.Math.Vector2(p.x + SKETCH.realInRange(-0.8, 0.8), p.y + SKETCH.realInRange(-0.8, 0.8)));
  g.lineStyle(Math.max(1, width - 1.5), line, 0.7).strokePoints(off, true);
}

function blob(g, cx, cy, rx, ry, fill, jitter, width) {
  sketchShape(g, wobblePoints(cx, cy, rx, ry === undefined ? rx : ry, jitter), fill, PALETTE.outline, width);
}

function sketchRect(g, x, y, w, h, fill, width = 3) {
  const j = () => SKETCH.realInRange(-1.2, 1.2);
  const pts = [
    new Phaser.Math.Vector2(x + j(), y + j()), new Phaser.Math.Vector2(x + w + j(), y + j()),
    new Phaser.Math.Vector2(x + w + j(), y + h + j()), new Phaser.Math.Vector2(x + j(), y + h + j()),
  ];
  sketchShape(g, pts, fill, PALETTE.outline, width);
}

function sketchLine(g, x1, y1, x2, y2, color = PALETTE.outline, width = 2) {
  g.lineStyle(width, color).lineBetween(x1, y1, x2, y2);
  g.lineStyle(Math.max(1, width - 1), color, 0.6).lineBetween(x1 + 0.8, y1 - 0.6, x2 - 0.5, y2 + 0.8);
}

// Hachura diagonal para sombras
function hatch(g, x, y, w, h, color, alpha = 0.35, step = 5) {
  g.lineStyle(1, color, alpha);
  // Linhas a 45°, recortadas para não sair do retângulo
  for (let i = -h; i < w; i += step) {
    const x1 = Math.max(x, x + i);
    const x2 = Math.min(x + w, x + i + h);
    if (x2 <= x1) continue;
    g.lineBetween(x1, y + h - (x1 - x - i), x2, y + h - (x2 - x - i));
  }
}

function makeTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const P = PALETTE;
  // Texturas que já vieram de assets/sprites (desenhadas) não são substituídas pelas feitas por código
  const done = (key, w, h) => {
    if (!scene.textures.exists(key)) g.generateTexture(key, w, h);
    g.clear();
  };

  // Chão de cada nível: manchas, tufos de grama, rachaduras e espiral
  LEVELS.forEach((lv, i) => {
    g.fillStyle(lv.ground).fillRect(0, 0, 64, 64);
    g.fillStyle(lv.groundDark, 0.6);
    [[8, 10, 5], [40, 6, 4], [22, 34, 6], [52, 44, 5], [10, 54, 4]].forEach(([x, y, r]) => g.fillEllipse(x, y, r * 2, r * 1.3));
    g.lineStyle(1.5, lv.groundDark);
    [[30, 14], [6, 30], [46, 58], [58, 22]].forEach(([x, y]) => {
      g.lineBetween(x, y, x - 2, y - 5).lineBetween(x, y, x + 1, y - 6).lineBetween(x, y, x + 3, y - 4);
    });
    g.lineStyle(1, P.outline, 0.25).lineBetween(14, 44, 20, 48).lineBetween(20, 48, 19, 54).lineBetween(20, 48, 27, 50);
    g.lineStyle(2, lv.groundDark);
    spiral(g, 44, 26, 6, 2);
    done(`ground${i}`, 64, 64);
  });

  // Árvore torta e seca, copa em espiral
  g.lineStyle(4, P.outline);
  sketchShape(g, [
    new Phaser.Math.Vector2(27, 84), new Phaser.Math.Vector2(30, 52), new Phaser.Math.Vector2(25, 44),
    new Phaser.Math.Vector2(33, 48), new Phaser.Math.Vector2(37, 84),
  ], 0x3f2a4f);
  sketchLine(g, 31, 58, 20, 50, P.outline, 3);
  blob(g, 32, 32, 27, 24, 0x2f6b4f, 0.12, 4);
  hatch(g, 14, 36, 34, 16, 0x1f4a36, 0.5);
  g.lineStyle(3, 0x1f4a36);
  spiral(g, 32, 32, 19, 3);
  done('tree', 64, 86);

  // Poste listrado curvado com lâmpada
  for (let i = 0; i < 8; i++) g.fillStyle(i % 2 ? 0xf4ecff : 0x1b1424).fillRect(14 + Math.sin(i * 0.6) * 1.5, 20 + i * 8, 8, 8);
  g.lineStyle(3, P.outline).strokeRect(14, 20, 9, 64);
  g.fillStyle(P.window, 0.35).fillCircle(18, 14, 14);
  blob(g, 18, 14, 10, 10, P.window, 0.1);
  done('lamp', 36, 86);

  // Lápide torta e rachada
  g.fillStyle(0x9a94a8).fillRoundedRect(6, 6, 34, 46, { tl: 16, tr: 16, bl: 0, br: 0 });
  g.lineStyle(3, P.outline).strokeRoundedRect(6, 6, 34, 46, { tl: 16, tr: 16, bl: 0, br: 0 });
  g.lineStyle(1.5, P.outline, 0.6).strokeRoundedRect(7, 7, 33, 45, { tl: 15, tr: 16, bl: 0, br: 0 });
  hatch(g, 28, 18, 10, 32, 0x5c566a, 0.6, 4);
  sketchLine(g, 23, 16, 23, 34, 0x5c566a, 3);
  sketchLine(g, 15, 22, 31, 22, 0x5c566a, 3);
  g.lineStyle(1.5, P.outline, 0.7).lineBetween(12, 40, 17, 44).lineBetween(17, 44, 15, 50);
  done('tomb', 46, 56);

  // A base: casa roxa vista de cima, telhado de telhas com espiral
  sketchRect(g, 4, 4, BASE_W - 8, BASE_H - 8, P.house, 4);
  g.fillStyle(P.roof).fillRect(18, 18, BASE_W - 36, BASE_H - 36);
  g.lineStyle(1.5, 0x2a1c36, 0.8);
  for (let y = 26; y < BASE_H - 18; y += 10) {
    g.lineBetween(18, y, BASE_W - 18, y);
    for (let x = 18 + ((y / 10) % 2) * 8; x < BASE_W - 18; x += 16) g.lineBetween(x, y - 10, x, y);
  }
  g.lineStyle(4, P.outline).strokeRect(18, 18, BASE_W - 36, BASE_H - 36);
  g.lineStyle(3, 0x7a5590);
  spiral(g, BASE_W / 2, BASE_H / 2, 34, 3);
  g.fillStyle(P.window);
  [[10, 30], [10, BASE_H - 50], [BASE_W - 22, 30], [BASE_W - 22, BASE_H - 50]].forEach(([x, y]) => {
    sketchRect(g, x, y, 12, 20, P.window, 3);
    g.lineStyle(1.5, P.outline).lineBetween(x + 6, y, x + 6, y + 20);
  });
  sketchRect(g, BASE_W / 2 - 14, BASE_H - 12, 28, 10, 0x6b4423, 3);
  hatch(g, 4, BASE_H - 18, BASE_W - 8, 14, P.outline, 0.25, 6);
  done('base', BASE_W, BASE_H);

  // Balas e projéteis. A bala comum é um rastro: cauda apagada atrás, ponta clara na frente (gira com o tiro)
  for (let i = 0; i < 10; i++) g.fillStyle(0xffd88a, (i / 10) ** 2 * 0.7).fillRect(i, 1.5, 1, 1.5);
  g.fillStyle(0xfff2c4).fillCircle(11, 2.25, 1.6);
  done('bullet', 13, 5);
  // Clarão do cano
  g.fillStyle(0xffd27a, 0.9).fillTriangle(0, 3, 12, 6, 0, 9).fillTriangle(4, 0, 9, 6, 4, 12);
  g.fillStyle(0xfff6d8).fillCircle(4, 6, 3);
  done('clarao', 12, 12);
  // Sombra sob os pés: elipse escura de borda suave
  for (let i = 6; i >= 1; i--) g.fillStyle(0x0d0a12, 0.09).fillEllipse(16, 6, 32 * i / 6, 12 * i / 6);
  done('sombra', 32, 12);
  // Mancha de sangue no chão (fica onde o zumbi morreu e some devagar)
  [[12, 8, 9, 5], [6, 5, 4, 3], [20, 11, 4, 2.5], [17, 3, 3, 2], [4, 11, 2, 1.5], [23, 6, 2, 1.5]].forEach(([x, y, rx, ry]) => {
    g.fillStyle(0x3d0c0c, 0.85).fillEllipse(x, y, rx * 2, ry * 2);
  });
  g.fillStyle(0x5e1414, 0.7).fillEllipse(11, 7, 9, 5);
  done('mancha', 26, 16);
  g.lineStyle(2, P.outline).fillStyle(0xd9c27a).fillRect(1, 3, 20, 4).strokeRect(1, 3, 20, 4);
  g.fillStyle(0xe8453c).fillTriangle(20, 0, 26, 5, 20, 10);
  g.fillStyle(0xf4ecff).fillTriangle(0, 1, 5, 5, 0, 9);
  done('bolt', 26, 10);
  blob(g, 7, 7, 6, 6, 0x4f7a52, 0.05, 2);
  g.lineStyle(1, P.outline).lineBetween(3, 7, 11, 7);
  done('grenade', 14, 14);
  g.fillStyle(0xffa53c).fillCircle(7, 7, 7);
  g.fillStyle(0xfff27a).fillCircle(7, 7, 3);
  done('flame', 14, 14);
  blob(g, 8, 8, 7, 6, P.acid, 0.15, 2);
  done('acid', 16, 16);
  blob(g, 14, 14, 12, 11, 0x7d7487, 0.15, 3);
  hatch(g, 6, 14, 16, 8, P.outline, 0.4, 4);
  done('rock', 28, 28);
  // Poça de bile: borda escura, miolo sujo, respingos em volta e brilho pequeno
  g.fillStyle(0x3e4418, 0.55).fillPoints(wobblePoints(50, 50, 46, 42, 0.16), true);
  g.fillStyle(P.acid, 0.5).fillPoints(wobblePoints(50, 51, 40, 36, 0.14), true);
  g.fillStyle(0x5a6224, 0.45).fillPoints(wobblePoints(44, 56, 18, 12, 0.2), true);
  [[90, 30, 4], [12, 66, 3], [80, 84, 3], [22, 18, 2.5], [94, 58, 2]].forEach(([x, y, r]) => g.fillStyle(0x6f7a2a, 0.6).fillCircle(x, y, r));
  g.fillStyle(0xd8dc9a, 0.35).fillCircle(40, 40, 5).fillCircle(60, 58, 3);
  done('puddle', 100, 100);
  // Veneno no chão: mancha escura e oleosa com bolhas, sem verde-neon
  g.fillStyle(0x2e3618, 0.35).fillPoints(wobblePoints(50, 50, 48, 46, 0.18), true);
  g.fillStyle(0x56602a, 0.35).fillPoints(wobblePoints(50, 50, 36, 34, 0.16), true);
  g.lineStyle(1.5, 0x3a4220, 0.45);
  spiral(g, 50, 50, 24, 2);
  [[30, 36, 4], [66, 44, 3], [54, 68, 3.5], [40, 60, 2]].forEach(([x, y, r]) => g.lineStyle(1.2, 0x9aa060, 0.5).strokeCircle(x, y, r));
  done('poison', 100, 100);

  // Zumbis: braços esticados para frente, cabeça verde, olhos e pontos de costura.
  // opts: { skin, arms: (r) => [comprimentoCima, comprimentoBaixo], armW, eyes: 'x'|'red'|'none', stitch, head }
  const zombie = (key, r, shirt, extra, opts = {}) => {
    const skin = opts.skin || P.zombie;
    const s = r * 2 + 16;
    const c = s / 2;
    const [la, lb] = opts.arms ? opts.arms(r) : [r + 6, r + 4];
    const aw = opts.armW || 6;
    if (la) sketchRect(g, c, c - r * 0.75 - aw / 2, la, aw, skin, 2.5);
    if (lb) sketchRect(g, c, c + r * 0.75 - aw / 2, lb, aw, skin, 2.5);
    blob(g, c, c, r, r, shirt, 0.09);
    hatch(g, c - r * 0.8, c + r * 0.15, r * 1.2, r * 0.6, P.outline, 0.3);
    if (opts.stitch !== false) {
      g.lineStyle(1.5, P.outline, 0.8).lineBetween(c - r * 0.7, c - r * 0.2, c - r * 0.2, c - r * 0.55);
      for (let i = 0; i < 3; i++) {
        const t = (i + 0.5) / 3;
        const x = c - r * 0.7 + r * 0.5 * t;
        const y = c - r * 0.2 - r * 0.35 * t;
        g.lineBetween(x - 2, y - 2, x + 2, y + 2);
      }
    }
    const hr = (opts.head || 0.55) * r;
    blob(g, c + 2, c, hr, hr, skin, 0.1, 2.5);
    const ex = c + 2 + hr * 0.45;
    const ey = hr * 0.42;
    if (opts.eyes === 'x') {
      g.lineStyle(1.5, P.outline);
      [-1, 1].forEach((sd) => g.lineBetween(ex - 2, c + sd * ey - 2, ex + 2, c + sd * ey + 2).lineBetween(ex - 2, c + sd * ey + 2, ex + 2, c + sd * ey - 2));
    } else if (opts.eyes !== 'none') {
      [-1, 1].forEach((sd) => {
        g.fillStyle(0xf4ecff).fillCircle(ex, c + sd * ey, Math.max(1.8, hr * 0.22));
        g.fillStyle(opts.eyes === 'red' ? 0xe8453c : P.outline).fillCircle(ex + 0.6, c + sd * ey, Math.max(1, hr * 0.11));
      });
    }
    if (extra) extra(c, r);
    done(key, s, s);
  };
  zombie('z_comum', 14, P.zombieShirt);
  zombie('z_corredor', 12, 0xd9534f, (c, r) => {
    g.lineStyle(1.5, P.outline, 0.7).lineBetween(c - r - 2, c - 4, c - r - 7, c - 4).lineBetween(c - r - 2, c + 3, c - r - 8, c + 3);
  }, { eyes: 'red' });
  zombie('z_blindado', 15, 0x4d5b6b, (c, r) => {
    blob(g, c + 2, c, r * 0.62, r * 0.62, P.metal, 0.04, 2.5);
    g.lineStyle(2, P.outline).lineBetween(c + 2 + r * 0.3, c - r * 0.4, c + 2 + r * 0.3, c + r * 0.4);
    g.fillStyle(P.outline).fillCircle(c - r * 0.5, c - r * 0.5, 1.5).fillCircle(c - r * 0.5, c + r * 0.5, 1.5);
  }, { eyes: 'none' });
  zombie('z_brutamonte', 22, 0x6a3d7a, (c, r) => {
    sketchLine(g, c - r * 0.6, c - 6, c + r * 0.1, c - 6, P.outline, 2);
    sketchLine(g, c - r * 0.6, c + 6, c + r * 0.1, c + 6, P.outline, 2);
  }, { arms: (r) => [r + 4, r + 4], armW: 10, eyes: 'red' });
  zombie('z_venenoso', 18, 0x5b7a2a, (c, r) => {
    [[-8, -9, 4], [-10, 7, 5], [4, 11, 3], [-2, -13, 3]].forEach(([dx, dy, br]) => {
      blob(g, c + dx, c + dy, br, br, P.acid, 0.1, 2);
      g.fillStyle(0xe6ff8a).fillCircle(c + dx - 1, c + dy - 1, 1);
    });
  }, { skin: 0x9cc25a });
  // Boomer: barrigão inchado com pústulas
  zombie('z_boomer', 20, 0xc9a27a, (c, r) => {
    blob(g, c - 5, c, r * 0.62, r * 0.7, 0xe2c49a, 0.12, 2.5);
    [[-10, -6], [-4, 8], [-12, 5]].forEach(([dx, dy]) => blob(g, c + dx, c + dy, 2.5, 2.5, 0xb6c46a, 0.1, 1.5));
  }, { arms: (r) => [r * 0.6, r * 0.6], armW: 7, head: 0.45, stitch: false });
  // Spitter: pescoço comprido, boca cheia de ácido
  zombie('z_spitter', 14, 0xd6e24a, (c, r) => {
    blob(g, c + r * 0.72, c, 4, 4, P.acid, 0.2, 2);
    g.fillStyle(P.acid).fillCircle(c + r * 0.95, c + 3, 1.6).fillCircle(c + r * 0.9, c - 4, 1.2);
  }, { skin: 0xb9cf6a, eyes: 'x' });
  // Smoker: língua comprida e enrolada
  zombie('z_smoker', 14, 0x6d6d6d, (c, r) => {
    g.lineStyle(3, 0xd96a8a);
    g.beginPath();
    g.moveTo(c + r * 0.5, c);
    for (let i = 1; i <= 8; i++) g.lineTo(c + r * 0.5 + i * 1.1, c + Math.sin(i * 1.3) * 3);
    g.strokePath();
    g.fillStyle(0x9a9a9a, 0.5).fillCircle(c - r * 0.5, c - r * 0.6, 3).fillCircle(c - r * 0.7, c + r * 0.4, 2.5);
  }, { arms: (r) => [r, r * 0.7], eyes: 'red' });
  // Hunter: capuz escuro, garras
  zombie('z_hunter', 13, 0x34495e, (c, r) => {
    sketchShape(g, wobblePoints(c - 1, c, r * 0.75, r * 0.72, 0.06), 0x2c3e50, P.outline, 2.5);
    g.fillStyle(0xe8453c).fillCircle(c + r * 0.45, c - 3, 1.6).fillCircle(c + r * 0.45, c + 3, 1.6);
    g.lineStyle(1.5, 0xf4ecff).lineBetween(c + r + 6, c - r * 0.75, c + r + 10, c - r * 0.95).lineBetween(c + r + 4, c + r * 0.75, c + r + 9, c + r * 0.95);
  }, { eyes: 'none' });
  // Charger: um braço gigante
  zombie('z_charger', 20, 0x7f4f2f, (c, r) => {
    blob(g, c + r * 0.4, c - r * 0.72, r * 0.75, r * 0.42, P.zombie, 0.1, 3);
    hatch(g, c, c - r * 0.8, r * 0.8, r * 0.4, P.outline, 0.35);
  }, { arms: (r) => [0, r * 0.6], eyes: 'red' });
  // Jockey: pequeno, corcunda, braços longos e finos
  zombie('z_jockey', 11, 0xa569bd, (c, r) => {
    blob(g, c - r * 0.45, c, r * 0.45, r * 0.6, 0x8e44ad, 0.12, 2);
  }, { arms: (r) => [r + 9, r + 9], armW: 4, head: 0.62 });
  // Tank: punhos enormes
  zombie('z_tank', 30, 0x4a3b5c, (c, r) => {
    blob(g, c + r * 0.5, c - r * 0.8, r * 0.45, r * 0.45, P.zombie, 0.12, 3);
    blob(g, c + r * 0.5, c + r * 0.8, r * 0.45, r * 0.45, P.zombie, 0.12, 3);
    hatch(g, c + r * 0.2, c - r * 1.1, r * 0.55, r * 0.5, P.outline, 0.4);
    hatch(g, c + r * 0.2, c + r * 0.55, r * 0.55, r * 0.5, P.outline, 0.4);
    g.lineStyle(2, P.outline, 0.6).lineBetween(c - r * 0.5, c - r * 0.3, c - r * 0.2, c + r * 0.2);
  }, { arms: (r) => [0, 0], head: 0.4, eyes: 'red' });
  // Witch: pálida, cabelo comprido e garras vermelhas
  zombie('z_witch', 14, 0xeeeeee, (c, r) => {
    g.lineStyle(2, 0x2b2b2b);
    for (let i = -3; i <= 3; i++) g.lineBetween(c - 2, c + i * 2, c - r - 2, c + i * 3.2);
    g.lineStyle(2, 0xe8453c);
    [-1, 1].forEach((sd) => {
      g.lineBetween(c + r + 4, c + sd * r * 0.75, c + r + 8, c + sd * r * 0.95);
      g.lineBetween(c + r + 4, c + sd * r * 0.75, c + r + 9, c + sd * r * 0.7);
    });
  }, { skin: 0xdde6d0, arms: (r) => [r + 4, r + 4], armW: 4, eyes: 'red', stitch: false });

  // Torreta: base de madeira + canhão (separados para o canhão girar)
  sketchRect(g, 3, 3, 34, 34, P.wood);
  sketchLine(g, 4, 14, 36, 14, P.outline, 2);
  sketchLine(g, 4, 26, 36, 26, P.outline, 2);
  g.fillStyle(P.outline).fillCircle(8, 8, 1.5).fillCircle(32, 8, 1.5).fillCircle(8, 32, 1.5).fillCircle(32, 32, 1.5);
  done('turret_base', 40, 40);
  sketchRect(g, 14, 11, 22, 8, P.metal);
  blob(g, 14, 15, 10, 10, 0x5b6670, 0.05);
  g.lineStyle(2, 0x3f4a55);
  spiral(g, 14, 15, 6, 1.5);
  done('turret_gun', 40, 30);

  // Tesla: bobina com espiral elétrica
  sketchRect(g, 3, 3, 34, 34, 0x3f4a5a);
  blob(g, 20, 20, 12, 12, 0xb87333, 0.05);
  g.lineStyle(2, 0x7fdfff);
  spiral(g, 20, 20, 10, 2.5);
  g.lineStyle(1.5, 0x7fdfff, 0.7).lineBetween(4, 4, 9, 9).lineBetween(36, 4, 31, 9).lineBetween(4, 36, 9, 31).lineBetween(36, 36, 31, 31);
  done('tesla', 40, 40);

  // Lança-chamas
  sketchRect(g, 3, 3, 34, 34, 0x7a3b2e);
  hatch(g, 4, 24, 32, 12, P.outline, 0.3);
  blob(g, 20, 20, 8, 8, 0xe8453c, 0.08);
  done('flame_base', 40, 40);
  sketchRect(g, 14, 10, 24, 10, 0x4a4a4a);
  blob(g, 14, 15, 9, 9, 0xffa53c, 0.06);
  g.fillStyle(0xfff27a).fillCircle(14, 15, 3);
  done('flame_gun', 40, 30);

  // Barricada de tábuas pregadas
  for (let i = 0; i < 3; i++) sketchRect(g, 2, 3 + i * 12, 36, 10, i % 2 ? 0x9a6a3c : P.wood);
  sketchLine(g, 6, 4, 34, 36, 0x5a3a22, 3);
  g.fillStyle(P.metal);
  [[6, 8], [33, 8], [6, 32], [33, 32]].forEach(([x, y]) => g.fillCircle(x, y, 1.5));
  done('barricade', 40, 40);

  // Mina
  blob(g, 20, 20, 11, 11, 0x4f5a3c, 0.06);
  g.lineStyle(1.5, P.outline, 0.6).strokeCircle(20, 20, 7);
  g.fillStyle(0xe8453c).fillCircle(20, 20, 3.5);
  done('mine', 40, 40);

  // Farol
  sketchRect(g, 8, 8, 24, 24, 0x2b2b2b);
  g.fillStyle(0xfff3b0, 0.35).fillCircle(20, 20, 14);
  blob(g, 20, 20, 9, 9, 0xfff3b0, 0.05);
  done('floodlight', 40, 40);

  // Espinhos
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const x = 7 + i * 13 + SKETCH.realInRange(-1, 1);
      const y = 7 + j * 13 + SKETCH.realInRange(-1, 1);
      g.fillStyle(P.metal).fillTriangle(x - 5, y + 5, x, y - 6, x + 5, y + 5);
      g.lineStyle(2, P.outline).strokeTriangle(x - 5, y + 5, x, y - 6, x + 5, y + 5);
      g.lineStyle(1, 0x5c566a).lineBetween(x, y - 5, x + 3, y + 4);
    }
  }
  done('spikes', 40, 40);

  // Caixa de suprimentos e helicóptero
  sketchRect(g, 2, 2, 28, 28, P.wood);
  sketchLine(g, 3, 3, 29, 29, P.outline, 2);
  sketchLine(g, 29, 3, 3, 29, P.outline, 2);
  g.fillStyle(P.line).fillRect(12, 2, 8, 28);
  g.lineStyle(2, P.outline).strokeRect(12, 2, 8, 28);
  done('crate', 32, 32);

  sketchRect(g, 10, 32, 70, 8, 0x3d5a40);
  blob(g, 90, 36, 30, 15, 0x4f7a52, 0.05);
  hatch(g, 64, 38, 50, 12, P.outline, 0.3);
  blob(g, 105, 36, 9, 8, 0x9fd3e6, 0.05, 2);
  sketchLine(g, 40, 8, 140, 64, P.outline, 4);
  sketchLine(g, 140, 8, 40, 64, P.outline, 4);
  done('heli', 150, 72);

  // Pets
  blob(g, 14, 12, 12, 7, 0xc98b4f, 0.08);
  blob(g, 27, 12, 7, 7, 0xc98b4f, 0.08);
  g.fillStyle(0x6b4423).fillEllipse(25, 5, 6, 8).fillEllipse(25, 19, 6, 8);
  g.fillStyle(P.outline).fillCircle(32, 12, 2).fillCircle(28, 9, 1.2).fillCircle(28, 15, 1.2);
  g.lineStyle(2, 0x9a6a3c).lineBetween(3, 12, 0, 8);
  done('pet_cachorro', 36, 24);

  blob(g, 22, 13, 19, 8, 0x3f7a3a, 0.08);
  sketchShape(g, [new Phaser.Math.Vector2(36, 7), new Phaser.Math.Vector2(54, 13), new Phaser.Math.Vector2(36, 19)], 0x3f7a3a);
  g.fillStyle(0x3f7a3a).fillRect(8, 2, 6, 6).fillRect(8, 18, 6, 6).fillRect(26, 2, 6, 6).fillRect(26, 18, 6, 6);
  g.lineStyle(1.5, 0x2a5527);
  for (let x = 8; x < 34; x += 5) g.lineBetween(x, 9, x + 2, 17);
  g.fillStyle(P.window).fillCircle(40, 9, 2).fillCircle(40, 17, 2);
  g.lineStyle(1, 0xf4ecff).lineBetween(42, 12, 52, 13).lineBetween(42, 14, 52, 13);
  done('pet_crocodilo', 56, 26);

  blob(g, 12, 11, 10, 6, 0x8a8a9a, 0.08);
  blob(g, 23, 11, 6, 6, 0x8a8a9a, 0.08);
  g.fillStyle(0x8a8a9a).fillTriangle(21, 3, 25, 0, 27, 5).fillTriangle(21, 19, 25, 22, 27, 17);
  g.lineStyle(1, P.outline).lineBetween(8, 7, 10, 15).lineBetween(13, 6, 15, 16);
  g.fillStyle(0xffd86b).fillCircle(26, 9, 1.5).fillCircle(26, 13, 1.5);
  g.lineStyle(3, 0x8a8a9a).lineBetween(2, 11, 0, 4);
  done('pet_gato', 32, 22);

  sketchShape(g, [new Phaser.Math.Vector2(18, 18), new Phaser.Math.Vector2(4, 2), new Phaser.Math.Vector2(10, 18)], 0x7a5230);
  sketchShape(g, [new Phaser.Math.Vector2(18, 18), new Phaser.Math.Vector2(4, 34), new Phaser.Math.Vector2(10, 18)], 0x7a5230);
  g.lineStyle(1, 0x4a3018).lineBetween(8, 6, 12, 16).lineBetween(8, 30, 12, 20);
  blob(g, 20, 18, 11, 5, 0x7a5230, 0.06);
  blob(g, 31, 18, 5, 5, 0xf4ecff, 0.06, 2);
  g.fillStyle(0xffd86b).fillTriangle(35, 16, 40, 18, 35, 20);
  g.fillStyle(P.outline).fillCircle(32, 16, 1).fillCircle(32, 20, 1);
  done('pet_gaviao', 42, 36);

  blob(g, 12, 12, 9, 9, 0xf5a3c7, 0.08);
  blob(g, 22, 12, 6, 6, 0xf5a3c7, 0.08);
  blob(g, 19, 4, 6, 2.5, 0xf5a3c7, 0.05, 2);
  blob(g, 19, 20, 6, 2.5, 0xf5a3c7, 0.05, 2);
  g.fillStyle(0xffd0e3).fillEllipse(19, 4, 6, 1.4).fillEllipse(19, 20, 6, 1.4);
  g.fillStyle(P.outline).fillCircle(25, 10, 1.2).fillCircle(25, 14, 1.2);
  g.fillStyle(0xf4ecff).fillCircle(3, 12, 3);
  done('pet_coelho', 30, 24);

  // Arma do jogador: pistola pequena separada do corpo, gira na direção do mouse (cano para a direita).
  // Do tamanho da mão do personagem desenhado (~12% da altura dele), ferro gasto e cabo de madeira.
  g.fillStyle(0x2a2622).fillRect(3, 1, 13, 4);
  g.fillStyle(0x58534a).fillRect(4, 1.5, 11, 1);
  g.fillStyle(0x1a1612).fillRect(15, 1.5, 1, 3);
  g.fillStyle(0x4a3424).fillTriangle(3, 4, 8, 4, 4, 10).fillTriangle(8, 4, 6.5, 10, 4, 10);
  g.lineStyle(1, 0x15110d, 0.9).strokeRect(3, 1, 13, 4).lineBetween(8, 4, 6.5, 10).lineBetween(3, 4, 4, 10).lineBetween(4, 10, 6.5, 10);
  g.lineStyle(1, 0x15110d, 0.8).strokeCircle(9.5, 6, 1.6);
  done('arma', 17, 11);

  // Partícula de gosma
  g.fillStyle(0xffffff).fillCircle(3, 3, 3);
  done('dot', 6, 6);

  g.destroy();

  // Pincel de luz para a noite: gradiente radial que "apaga" a escuridão
  const canvas = scene.textures.createCanvas('light', 256, 256);
  const ctx = canvas.getContext();
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  canvas.refresh();

  // Texturas padrão dos personagens (para menus)
  CHARACTERS.forEach((c) => makePlayerTexture(scene, c, OUTFITS[0], `char_${c.id}`));
}

// Animações de uma folha de quadros: <key>_andar (passada, parado, passada contrária, parado) e
// <key>_ataque (tronco inclinado e de volta). A velocidade de cada boneco ajusta o ritmo com timeScale.
function makeAnims(scene, key) {
  [['andar', [1, 0, 2, 0], 9], ['ataque', [3, 0], 5]].forEach(([nome, frames, frameRate]) => {
    const k = `${key}_${nome}`;
    if (scene.anims.exists(k)) scene.anims.remove(k);
    scene.anims.create({ key: k, frames: frames.map((frame) => ({ key, frame })), frameRate, repeat: -1 });
  });
}

// Cor da roupa apagada e puxada para o sépia, para não brigar com a paleta suja da arte desenhada
function mutedOutfit(c) {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const cinza = 0.3 * r + 0.59 * g + 0.11 * b;
  const mix = (v, s) => Math.round((v * 0.55 + cinza * 0.25 + s * 0.2) * 0.85);
  return (mix(r, 150) << 16) | (mix(g, 128) << 8) | mix(b, 98);
}

// Personagem visto de cima: corpo com a cor da roupa, cabeça, cabelo ou chapéu e a arma
function makePlayerTexture(scene, char, outfit, key) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  // Personagem desenhado (3/4): pinta a camisa branca com a cor da roupa usando a máscara _roupa
  const art = `p_${char.id}`;
  if (scene.textures.exists(art)) {
    const body = scene.textures.get(art).getSourceImage();
    const canvas = scene.textures.createCanvas(key, body.width, body.height);
    const ctx = canvas.getContext();
    ctx.drawImage(body, 0, 0);
    if (scene.textures.exists(`${art}_roupa`)) {
      const mask = scene.textures.get(`${art}_roupa`).getSourceImage();
      const tmp = document.createElement('canvas');
      tmp.width = body.width;
      tmp.height = body.height;
      const t = tmp.getContext('2d');
      t.drawImage(mask, 0, 0);
      t.globalCompositeOperation = 'multiply';
      t.fillStyle = `#${mutedOutfit(outfit).toString(16).padStart(6, '0')}`;
      t.fillRect(0, 0, tmp.width, tmp.height);
      t.globalCompositeOperation = 'destination-in';
      t.drawImage(mask, 0, 0);
      ctx.drawImage(tmp, 0, 0);
    }
    // Folha de quadros: recorta os mesmos quadros na textura pintada
    const fr = ANIM_FRAMES[art];
    if (fr) {
      for (let i = 0; i * fr[0] < body.width; i++) canvas.add(i, 0, i * fr[0], 0, fr[0], fr[1]);
      makeAnims(scene, key);
    }
    canvas.refresh();
    return;
  }
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const P = PALETTE;
  sketchRect(g, 18, 15, 20, 6, P.gun, 2.5);
  blob(g, 18, 18, 13, 13, outfit, 0.06);
  hatch(g, 6, 20, 18, 9, P.outline, 0.3);
  // Mãos segurando a arma
  g.fillStyle(char.skin).fillCircle(24, 14, 3).fillCircle(29, 21, 3);
  g.lineStyle(1.5, P.outline).strokeCircle(24, 14, 3).strokeCircle(29, 21, 3);
  blob(g, 20, 18, 7, 7, char.skin, 0.06, 2.5);
  if (char.hat) {
    blob(g, 18, 18, 6.5, 6.5, char.hat, 0.05, 2);
    g.fillStyle(char.hat).fillRect(20, 14, 6, 8);
    g.lineStyle(1.5, P.outline).strokeRect(20, 14, 6, 8);
  } else if (char.id === 'jussara') {
    g.fillStyle(char.hair).fillCircle(16, 18, 6);
    g.fillEllipse(8, 18, 12, 6);
    g.lineStyle(1.5, P.outline, 0.7).lineBetween(4, 17, 14, 17).lineBetween(4, 19, 14, 19);
  } else {
    g.fillStyle(char.hair).fillCircle(17, 18, 4.5);
  }
  g.generateTexture(key, 40, 36);
  g.destroy();
}

// Espiral de Arquimedes, assinatura visual do estilo Burton
function spiral(g, cx, cy, radius, turns) {
  g.beginPath();
  const steps = Math.ceil(turns * 24);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const x = cx + Math.cos(a) * radius * t;
    const y = cy + Math.sin(a) * radius * t;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.strokePath();
}
