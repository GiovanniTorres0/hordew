// Todas as imagens do jogo são desenhadas por código e viram texturas.
// Personagens são desenhados olhando para a direita (rotação 0).
function makeTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const P = PALETTE;
  const done = (key, w, h) => { g.generateTexture(key, w, h); g.clear(); };

  // Chão de cada nível, com manchas e tufos em espiral
  LEVELS.forEach((lv, i) => {
    g.fillStyle(lv.ground).fillRect(0, 0, 64, 64);
    g.fillStyle(lv.groundDark);
    [[8, 10], [40, 6], [22, 34], [52, 44], [10, 54]].forEach(([x, y]) => g.fillCircle(x, y, 3));
    g.lineStyle(2, lv.groundDark);
    spiral(g, 44, 24, 6, 2);
    done(`ground${i}`, 64, 64);
  });

  // Árvore torta com copa em espiral
  g.lineStyle(4, P.outline);
  g.fillStyle(0x3f2a4f).fillRect(28, 50, 8, 34).strokeRect(28, 50, 8, 34);
  g.fillStyle(0x2f6b4f).fillCircle(32, 34, 26).strokeCircle(32, 34, 26);
  g.lineStyle(3, 0x1f4a36);
  spiral(g, 32, 34, 20, 3);
  done('tree', 64, 86);

  // Poste listrado curvado
  g.lineStyle(3, P.outline);
  for (let i = 0; i < 8; i++) g.fillStyle(i % 2 ? 0xf4ecff : 0x1b1424).fillRect(14, 20 + i * 8, 8, 8);
  g.strokeRect(14, 20, 8, 64);
  g.fillStyle(P.window).fillCircle(18, 14, 10).strokeCircle(18, 14, 10);
  done('lamp', 36, 86);

  // Lápide torta
  g.lineStyle(3, P.outline);
  g.fillStyle(0x9a94a8).fillRoundedRect(6, 6, 34, 46, { tl: 16, tr: 16, bl: 0, br: 0 });
  g.strokeRoundedRect(6, 6, 34, 46, { tl: 16, tr: 16, bl: 0, br: 0 });
  g.lineStyle(3, 0x5c566a).lineBetween(23, 16, 23, 34).lineBetween(15, 22, 31, 22);
  done('tomb', 46, 56);

  // Jogador
  g.lineStyle(3, P.outline);
  g.fillStyle(P.gun).fillRect(18, 15, 20, 6).strokeRect(18, 15, 20, 6);
  g.fillStyle(P.shirt).fillCircle(18, 18, 13).strokeCircle(18, 18, 13);
  g.fillStyle(P.player).fillCircle(20, 18, 7).strokeCircle(20, 18, 7);
  done('player', 40, 36);

  g.fillStyle(P.bullet).fillCircle(4, 4, 4);
  done('bullet', 8, 8);

  // Zumbis: braços esticados para frente, cabeça verde
  const zombie = (key, r, shirt, extra) => {
    const s = r * 2 + 16;
    const c = s / 2;
    g.lineStyle(3, P.outline);
    g.fillStyle(P.zombie);
    g.fillRect(c, c - r * 0.75 - 3, r + 6, 6).strokeRect(c, c - r * 0.75 - 3, r + 6, 6);
    g.fillRect(c, c + r * 0.75 - 3, r + 4, 6).strokeRect(c, c + r * 0.75 - 3, r + 4, 6);
    g.fillStyle(shirt).fillCircle(c, c, r).strokeCircle(c, c, r);
    g.fillStyle(P.zombie).fillCircle(c + 2, c, r * 0.55).strokeCircle(c + 2, c, r * 0.55);
    if (extra) extra(c, r);
    done(key, s, s);
  };
  zombie('z_comum', 14, P.zombieShirt);
  zombie('z_corredor', 12, 0xd9534f);
  zombie('z_blindado', 15, 0x4d5b6b, (c, r) => {
    g.fillStyle(P.metal).fillCircle(c + 2, c, r * 0.6).strokeCircle(c + 2, c, r * 0.6);
  });
  zombie('z_brutamonte', 22, 0x6a3d7a, (c, r) => {
    g.lineStyle(2, P.outline).lineBetween(c - r * 0.6, c - 6, c + r * 0.2, c - 6).lineBetween(c - r * 0.6, c + 6, c + r * 0.2, c + 6);
  });

  // Torreta: base de madeira + canhão (separados para o canhão girar)
  g.lineStyle(3, P.outline);
  g.fillStyle(P.wood).fillRect(3, 3, 34, 34).strokeRect(3, 3, 34, 34);
  g.lineStyle(2, P.outline).lineBetween(3, 14, 37, 14).lineBetween(3, 26, 37, 26);
  done('turret_base', 40, 40);
  g.lineStyle(3, P.outline);
  g.fillStyle(P.metal).fillRect(14, 11, 22, 8).strokeRect(14, 11, 22, 8);
  g.fillStyle(0x5b6670).fillCircle(14, 15, 10).strokeCircle(14, 15, 10);
  done('turret_gun', 40, 30);

  // Espinhos
  g.lineStyle(2, P.outline);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const x = 7 + i * 13;
      const y = 7 + j * 13;
      g.fillStyle(P.metal).fillTriangle(x - 5, y + 5, x, y - 6, x + 5, y + 5).strokeTriangle(x - 5, y + 5, x, y - 6, x + 5, y + 5);
    }
  }
  done('spikes', 40, 40);

  // Caixa de suprimentos e helicóptero
  g.lineStyle(3, P.outline);
  g.fillStyle(P.wood).fillRect(2, 2, 28, 28).strokeRect(2, 2, 28, 28);
  g.lineBetween(2, 2, 30, 30).lineBetween(30, 2, 2, 30);
  g.fillStyle(P.line).fillRect(12, 2, 8, 28);
  done('crate', 32, 32);

  g.lineStyle(3, P.outline);
  g.fillStyle(0x3d5a40).fillRect(10, 32, 70, 8).strokeRect(10, 32, 70, 8);
  g.fillStyle(0x4f7a52).fillEllipse(90, 36, 60, 30).strokeEllipse(90, 36, 60, 30);
  g.fillStyle(0x9fd3e6).fillEllipse(105, 36, 18, 16).strokeEllipse(105, 36, 18, 16);
  g.lineStyle(4, P.outline).lineBetween(40, 8, 140, 64).lineBetween(140, 8, 40, 64);
  done('heli', 150, 72);

  // Cachorro
  g.lineStyle(3, P.outline);
  g.fillStyle(P.dog).fillEllipse(14, 12, 24, 14).strokeEllipse(14, 12, 24, 14);
  g.fillCircle(27, 12, 7).strokeCircle(27, 12, 7);
  g.fillStyle(0x6b4423).fillEllipse(25, 5, 6, 8).fillEllipse(25, 19, 6, 8);
  done('dog', 36, 24);

  // Partícula de gosma
  g.fillStyle(0xffffff).fillCircle(3, 3, 3);
  done('dot', 6, 6);

  g.destroy();
}

// Espiral de Arquimedes, assinatura visual do estilo Burton
function spiral(g, cx, cy, radius, turns) {
  g.beginPath();
  const steps = turns * 24;
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
