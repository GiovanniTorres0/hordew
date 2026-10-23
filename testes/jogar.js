// Roteiro de teste do Hordew: abre o jogo num Chrome sem janela, passa pelas telas,
// coloca todos os zumbis e pets em cena, anda, mira, atira, testa a noite e grava
// prints + relatorio.json em testes/saida/. Uso: cd testes && npm install && node jogar.js
// O navegador é o Chrome/Edge já instalado (variável NAVEGADOR troca o caminho).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const RAIZ = path.join(__dirname, '..');
const SAIDA = process.env.SAIDA || path.join(__dirname, 'saida'); // SAIDA=outra/pasta para rodar em paralelo
const NAVEGADORES = [
  process.env.NAVEGADOR,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };

// Servidor estático mínimo, igual ao GitHub Pages: serve os arquivos como estão
function servidor() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const arq = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
      if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
      fs.createReadStream(arq).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => ok(s));
  });
}

(async () => {
  fs.rmSync(SAIDA, { recursive: true, force: true });
  fs.mkdirSync(SAIDA, { recursive: true });
  const srv = await servidor();
  const url = `http://127.0.0.1:${srv.address().port}/index.html`;
  const exe = NAVEGADORES.find((n) => fs.existsSync(n));
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const erros = [];
  const falhas = [];
  // "Failed to load resource" é repetido pelo navegador; as falhas de rede são checadas abaixo, com filtro
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) erros.push(m.text()); });
  page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    // preview/versions.json só existe no GitHub Pages (barra de versões)
    if (r.status() >= 400 && !r.url().includes('preview/versions.json')) falhas.push(`${r.status()} ${r.url()}`);
  });
  const prints = [];
  const foto = async (nome, descricao) => {
    await page.screenshot({ path: path.join(SAIDA, `${nome}.png`) });
    prints.push({ arquivo: `testes/saida/${nome}.png`, descricao });
  };
  const verificacoes = [];
  const checar = (nome, ok, detalhe) => verificacoes.push({ nome, ok: !!ok, detalhe });

  await page.goto(url);
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('Menu'), null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  await foto('01_menu', 'Menu principal com zumbis passeando ao fundo');

  // Toda textura desenhada da lista precisa ter carregado de verdade
  const texturas = await page.evaluate(() => SPRITE_KEYS.concat(ROUPA_KEYS.map((k) => `${k}_roupa`))
    .filter((k) => !game.textures.exists(k) || game.textures.get(k).key === '__MISSING'));
  checar('sprites desenhados carregados', texturas.length === 0, texturas.length ? `faltando: ${texturas.join(', ')}` : `${await page.evaluate(() => SPRITE_KEYS.length)} sprites`);

  await page.evaluate(() => { game.scene.stop('Menu'); game.scene.start('Setup'); });
  await page.waitForTimeout(1000);
  await foto('02_preparacao', 'Tela de preparação: os 3 personagens, cores de roupa e dificuldade');

  // Jussara com roupa azul, de dia, com todos os tipos de zumbi em volta (vida infinita para não morrerem)
  await page.evaluate(() => { game.scene.stop('Setup'); game.scene.start('Game', { char: 2, outfit: 0 }); });
  await page.waitForFunction(() => game.scene.isActive('Game'), null, { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const s = game.scene.getScene('Game');
    s.hurtPlayer = () => {};
    const p = s.player;
    Object.keys(ZOMBIES).forEach((t, i) => {
      const a = (i / Object.keys(ZOMBIES).length) * Math.PI * 2;
      const z = s.createZombie(t, p.x + Math.cos(a) * 260, p.y + Math.sin(a) * 200);
      z.hp = z.maxHp = 99999;
      if (t === 'witch') z.mode = 'sit';
    });
    s.spawnPet('cachorro');
  });
  await page.waitForTimeout(600);
  await foto('03_elenco_dia', 'De dia: Jussara (roupa azul) cercada por todos os tipos de zumbi e o cachorro');

  const centro = async () => page.evaluate(() => {
    const s = game.scene.getScene('Game');
    const c = s.cameras.main;
    return { x: s.player.x - c.worldView.x, y: s.player.y - c.worldView.y };
  });
  let c = await centro();
  await page.mouse.move(c.x + 300, c.y - 100);
  await page.mouse.down();
  await page.waitForTimeout(350);
  await foto('04_tiro_direita', 'Mirando e atirando para a direita e para cima');
  await page.mouse.up();
  const dir = await page.evaluate(() => { const s = game.scene.getScene('Game'); return { flip: s.player.flipX, rot: s.player.rotation, arma: s.gun.rotation }; });
  checar('mira à direita: jogador não espelha nem gira', !dir.flip && Math.abs(dir.rot) < 0.2, JSON.stringify(dir));

  await page.keyboard.down('a');
  await page.waitForTimeout(200);
  const anda = await page.evaluate(() => { const s = game.scene.getScene('Game'); const a = s.player.anims; return { desenhado: !!ANIM_FRAMES[`p_${s.char.id}`], tocando: a.isPlaying, anim: a.currentAnim && a.currentAnim.key }; });
  checar('jogador anda com animação de passada', !anda.desenhado || (anda.tocando && anda.anim === 'player_andar'), JSON.stringify(anda));
  c = await centro();
  await page.mouse.move(c.x - 300, c.y + 80);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await foto('05_tiro_esquerda_andando', 'Andando para a esquerda e atirando para a esquerda');
  await page.mouse.up();
  await page.keyboard.up('a');
  const esq = await page.evaluate(() => { const s = game.scene.getScene('Game'); return { flip: s.player.flipX, rot: s.player.rotation, armaFlipY: s.gun.flipY }; });
  checar('mira à esquerda: jogador espelha, arma acompanha', esq.flip && esq.armaFlipY && Math.abs(esq.rot) < 0.2, JSON.stringify(esq));

  // Armas desenhadas: AK-47 e escopeta na mão, mirando para a direita (arma de perfil, cano para fora)
  for (const id of ['ak47', 'escopeta']) {
    await page.evaluate((w) => { const s = game.scene.getScene('Game'); s.owned.push(w); s.weapon = WEAPONS[w]; }, id);
    c = await centro();
    await page.mouse.move(c.x + 280, c.y + 40);
    await page.mouse.down();
    await page.waitForTimeout(300);
    await foto(`05_arma_${id}`, `Jogador com a ${id} desenhada, atirando para a direita`);
    await page.mouse.up();
  }
  await page.evaluate(() => { const s = game.scene.getScene('Game'); s.weapon = WEAPONS.pistola; });

  // Zumbis andando: precisam espelhar na direção do jogador e nunca girar mais que o gingado
  await page.waitForTimeout(1500);
  await foto('06_horda_chegando', 'A horda se aproximando do jogador');
  const zs = await page.evaluate(() => {
    const s = game.scene.getScene('Game');
    return s.zombies.getChildren().map((z) => ({ tipo: z.def.name, x: Math.round(z.x - s.player.x), flip: z.flipX, angulo: Math.round(z.angle), depth: z.depth, y: z.y + z.displayHeight / 2 }));
  });
  const animados = await page.evaluate(() => {
    const s = game.scene.getScene('Game');
    return s.zombies.getChildren().filter((z) => ANIM_FRAMES[z.def.tex])
      .map((z) => ({ tipo: z.def.name, anim: z.anims.currentAnim && z.anims.currentAnim.key, tocando: z.anims.isPlaying, modo: z.mode }));
  });
  const parados = animados.filter((z) => z.modo === 'walk' && !z.tocando);
  checar('zumbis desenhados animam (andar ou atacar)', parados.length === 0, parados.map((z) => z.tipo).join(', ') || `${animados.length} animados`);
  // Close dos quadros de animação: cada folha desenhada com seus 4 quadros ampliados (parado, passo, passo, ataque)
  await page.evaluate(() => {
    const s = game.scene.getScene('Game');
    const c = s.cameras.main;
    const g = s.add.graphics().setScrollFactor(0).setDepth(50).fillStyle(0x2b2f24, 0.95).fillRect(0, 0, 1280, 720);
    const itens = [g];
    let x = 20, y = 20, alt = 0;
    Object.keys(ANIM_FRAMES).forEach((k) => {
      const [fw, fh] = ANIM_FRAMES[k];
      const esc = Math.min(1.4, 72 / fh);
      if (x + fw * esc * 4 > 1260) { x = 20; y += alt + 10; alt = 0; }
      for (let i = 0; i < 4; i++) itens.push(s.add.image(x + (i + 0.5) * fw * esc, y + fh * esc / 2, k, i).setScale(esc).setScrollFactor(0).setDepth(51));
      x += fw * esc * 4 + 24;
      alt = Math.max(alt, fh * esc);
    });
    s.time.delayedCall(400, () => itens.forEach((i) => i.destroy()));
  });
  await page.waitForTimeout(100);
  await foto('06b_quadros_animacao', 'Folhas de animação ampliadas: para cada boneco, parado, passada, passada contrária e ataque');
  await page.waitForTimeout(400);
  const girando = zs.filter((z) => Math.abs(z.angulo) > 10);
  checar('zumbis só gingam (ângulo ≤ 10°)', girando.length === 0, girando.map((z) => `${z.tipo} ${z.angulo}°`).join(', ') || 'ok');
  // A profundidade é calculada no update e a física move depois: tolera 6 px (1 quadro de atraso)
  const ordem = zs.slice().sort((a, b) => a.y - b.y);
  checar('profundidade: quem está mais embaixo fica na frente', ordem.every((z, i) => i === 0 || z.depth >= ordem[i - 1].depth || z.y - ordem[i - 1].y < 6), '');

  // Cada pet aparece e segue o jogador
  for (const pet of await page.evaluate(() => Object.keys(PETS))) {
    await page.evaluate((id) => game.scene.getScene('Game').spawnPet(id), pet);
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => {
    const s = game.scene.getScene('Game');
    Object.keys(PETS).forEach((id, i) => {
      const img = s.add.image(s.player.x - 160 + i * 70, s.player.y + 110, PETS[id].tex).setDepth(4);
      s.time.delayedCall(3000, () => img.destroy());
    });
  });
  await page.waitForTimeout(200);
  await foto('07_pets', 'Os 5 pets lado a lado embaixo do jogador (o gavião também voa)');

  // Tank ao lado do Brutamonte, arremessando a pedra no jogador
  await page.evaluate(() => {
    const s = game.scene.getScene('Game');
    s.releasePins(); s.zombies.getChildren().slice().forEach((z) => { if (z.shadow) z.shadow.destroy(); z.destroy(); });
    const t = s.createZombie('tank', s.player.x + 320, s.player.y - 20);
    s.createZombie('brutamonte', s.player.x + 200, s.player.y + 90);
    t.cooldown = 0;
  });
  await page.waitForTimeout(500);
  await foto('07b_tank', 'O Tank (chefe) ao lado do Brutamonte, arremessando a pedra de concreto');
  const tank = await page.evaluate(() => {
    const s = game.scene.getScene('Game');
    const t = s.zombies.getChildren().find((z) => z.def === ZOMBIES.tank);
    const b = s.zombies.getChildren().find((z) => z.def === ZOMBIES.brutamonte);
    return { desenhado: !!ANIM_FRAMES.z_tank, alt: t && Math.round(t.displayHeight), brut: b && Math.round(b.displayHeight) };
  });
  checar('Tank desenhado e maior que o Brutamonte', tank.desenhado && tank.alt > tank.brut, JSON.stringify(tank));
  await page.evaluate(() => {
    const s = game.scene.getScene('Game');
    s.releasePins(); s.zombies.getChildren().slice().forEach((z) => { if (z.shadow) z.shadow.destroy(); z.destroy(); });
  });

  // Efeitos no chão: poça de bile do Spitter e gás do Venenoso perto do jogador
  await page.evaluate(() => {
    const s = game.scene.getScene('Game');
    s.hurtPlayer = () => {};
    s.addPuddle(s.player.x - 110, s.player.y + 40, 'puddle', 50, 60000);
    s.addPuddle(s.player.x + 120, s.player.y + 50, 'poison', 55, 60000);
    s.createZombie('venenoso', s.player.x + 120, s.player.y + 20).hp = 99999;
    s.createZombie('spitter', s.player.x - 110, s.player.y - 10).hp = 99999;
  });
  await page.waitForTimeout(600);
  await foto('07c_efeitos', 'Poça de bile do Spitter (esquerda) e veneno e gás do Venenoso (direita)');

  // Noite: lanterna e legibilidade no escuro, com zumbis dentro e fora do cone da lanterna
  await page.evaluate(() => {
    const s = game.scene.getScene('Game');
    s.tweens.killTweensOf(s);
    s.darkness = 0.8;
    s.releasePins(); s.zombies.getChildren().slice().forEach((z) => { if (z.shadow) z.shadow.destroy(); z.destroy(); });
    [['comum', 160, -30], ['corredor', 240, 60], ['boomer', -200, 40], ['witch', 60, 170]].forEach(([t, dx, dy]) => {
      const z = s.createZombie(t, s.player.x + dx, s.player.y + dy);
      z.hp = 99999;
      z.speed = 0;
    });
  });
  await page.waitForTimeout(500);
  await foto('08_noite', 'À noite, com a lanterna do jogador e zumbis dentro e fora do cone');
  await page.evaluate(() => {
    const s = game.scene.getScene('Game');
    s.releasePins(); s.zombies.getChildren().slice().forEach((z) => { if (z.shadow) z.shadow.destroy(); z.destroy(); });
  });
  await page.evaluate(() => { game.scene.getScene('Game').darkness = 0; });

  // Construções em volta do jogador
  await page.evaluate(() => {
    const s = game.scene.getScene('Game');
    s.money = 99999;
    const tipos = Object.keys(BUILDINGS);
    tipos.forEach((t, i) => {
      s.setBuild(t);
      const wp = { x: s.player.x - 200 + (i % 4) * 90, y: s.player.y + 90 + Math.floor(i / 4) * 85 };
      s.tryBuild(wp);
    });
    s.setBuild(null);
  });
  await page.waitForTimeout(800);
  await foto('09_construcoes', 'Todas as construções colocadas perto do jogador, com zumbis em volta');

  // Interface: painel da torre, loja e o bilhete de dicas ([H])
  await page.evaluate(() => {
    const s = game.scene.getScene('Game');
    s.panel.open(s.structures.find((t) => t.def.upgradable) || s.base);
  });
  await page.waitForTimeout(400);
  await foto('09b_painel_torre', 'Painel de upgrades de uma torre (botão direito), em madeira e metal');
  await page.evaluate(() => {
    const s = game.scene.getScene('Game');
    s.panel.close();
    s.money = 300;
    s.shop.open();
  });
  await page.waitForTimeout(400);
  await foto('09c_loja', 'Loja aberta na aba de armas: madeira, tiras de papel, preço escrito à mão');
  await page.evaluate(() => { const s = game.scene.getScene('Game'); s.shop.tab = 'pet'; s.shop.render(); });
  await page.waitForTimeout(300);
  await foto('09d_loja_pets', 'Loja na aba de pets, com o desenho de cada pet');
  const dicas = await page.evaluate(() => {
    const s = game.scene.getScene('Game');
    s.shop.close();
    s.hud.bannerText.setAlpha(0);
    s.hud.update();
    const inicio = s.hud.tips.visible; // na horda 0 o bilhete aparece sozinho
    s.wave = Math.max(1, s.wave);
    s.hud.update();
    const antes = s.hud.tips.visible;
    s.input.keyboard.emit('keydown-H');
    s.hud.update();
    return { inicio, antes, depois: s.hud.tips.visible };
  });
  checar('bilhete de dicas some depois da 1ª horda e volta com [H]', dicas.inicio && !dicas.antes && dicas.depois, JSON.stringify(dicas));
  await page.evaluate(() => { const h = game.scene.getScene('Game').hud; h.scene.tweens.killTweensOf(h.bannerText); h.bannerText.setAlpha(0); });
  await page.waitForTimeout(300);
  await foto('09e_dicas_h', 'Bilhete de dicas reaberto com [H] durante o jogo');
  await page.evaluate(() => { const s = game.scene.getScene('Game'); s.input.keyboard.emit('keydown-H'); });

  // Casa nos 3 estados de dano: com o desenho base<n>_dano1/2 a imagem troca
  const danos = [];
  for (const [frac, nome] of [[0.5, '09f_casa_avariada'], [0.2, '09g_casa_ruinas']]) {
    danos.push(await page.evaluate((frac) => {
      const s = game.scene.getScene('Game');
      s.base.hp = s.base.maxHp * frac;
      s.updateBaseLook();
      s.player.setPosition(s.base.sprite.x, s.base.sprite.y + 150);
      return s.base.sprite.texture.key;
    }, frac));
    await page.waitForTimeout(400);
    await foto(nome, `Casa com ${frac * 100}% de vida: ${danos[danos.length - 1]}`);
  }
  await page.evaluate(() => { const s = game.scene.getScene('Game'); s.base.hp = s.base.maxHp; s.updateBaseLook(); });
  checar('casa troca de desenho nos estados de dano', danos[0].endsWith('_dano1') && danos[1].endsWith('_dano2'), danos.join(', '));

  // Desempenho: quadros por segundo com tudo em cena
  const fps = await page.evaluate(() => new Promise((ok) => {
    let n = 0;
    const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else ok(Math.round(n / 2)); };
    requestAnimationFrame(f);
  }));
  checar('desempenho (≥ 30 quadros/s sem janela)', fps >= 30, `${fps} fps`);

  // As outras duas fases: chão, rua e decoração de cada uma
  for (const level of [1, 2]) {
    await page.evaluate((lv) => { game.scene.stop('Game'); game.scene.start('Game', { char: 0, outfit: 1, level: lv }); }, level);
    await page.waitForFunction(() => game.scene.isActive('Game'), null, { timeout: 10000 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      const s = game.scene.getScene('Game');
      s.hurtPlayer = () => {};
      ['comum', 'corredor', 'brutamonte', 'boomer'].forEach((t, i) => s.createZombie(t, s.player.x - 150 + i * 100, s.player.y + 120).hp = 99999);
    });
    await page.waitForTimeout(500);
    await foto(`10_fase${level + 1}`, `Fase ${level + 1}: chão, rua e decoração, com José (roupa verde) e alguns zumbis`);
    // Casa desta fase no estado avariado (lojinha de tijolo e capela também têm o desenho do meio)
    const tex = await page.evaluate(() => {
      const s = game.scene.getScene('Game');
      s.base.hp = s.base.maxHp * 0.5;
      s.updateBaseLook();
      s.player.setPosition(s.base.sprite.x, s.base.sprite.y + 150);
      return s.base.sprite.texture.key;
    });
    await page.waitForTimeout(400);
    await foto(`10_fase${level + 1}_avariada`, `Fase ${level + 1}: casa com 50% de vida (${tex})`);
  }

  // Tela de fim de jogo e menu de preparação
  await page.evaluate(() => { game.scene.getScene('Game').gameOver('A casa caiu.'); });
  await page.waitForTimeout(600);
  await foto('11_fim', 'Tela de fim de jogo');

  // Música gravada: as 8 faixas decodificadas depois do primeiro clique, e o clima certo tocando
  const musica = await page.evaluate(() => ({ faixas: Music.tracksLoaded(), clima: Music.mood() }));
  checar('música gravada carregada (8 faixas)', musica.faixas === 8, JSON.stringify(musica));
  checar('sem erros no console', erros.length === 0, erros.slice(0, 10).join(' | '));
  checar('sem arquivos faltando', falhas.length === 0, falhas.slice(0, 10).join(' | '));

  const relatorio = { quando: new Date().toISOString(), navegador: exe, verificacoes, prints, zumbis: zs };
  fs.writeFileSync(path.join(SAIDA, 'relatorio.json'), JSON.stringify(relatorio, null, 1));
  const ruins = verificacoes.filter((v) => !v.ok);
  console.log(ruins.length ? `FALHOU ${ruins.length}: ${ruins.map((v) => `${v.nome} (${v.detalhe})`).join('; ')}` : `OK: ${verificacoes.length} verificações`);
  await browser.close();
  srv.close();
  process.exitCode = ruins.length ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
