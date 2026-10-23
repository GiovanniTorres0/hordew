// Teste do cooperativo online: abre duas abas (anfitrião e amigo), cria a sala, entra pelo link,
// começa a partida e confere que os dois se veem, que o tiro do amigo machuca zumbi no anfitrião,
// que o amigo constrói com o dinheiro da equipe e que a saída do amigo é percebida.
// Precisa de internet (o PeerJS usa o servidor público para apresentar as abas). Uso: node testes/coop.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const RAIZ = path.join(__dirname, '..');
const SAIDA = process.env.SAIDA || path.join(__dirname, 'saida_coop');
const NAVEGADORES = [
  process.env.NAVEGADOR,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };

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
  const browser = await chromium.launch({ executablePath: exe, args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const erros = [];
  const abrir = async (nome) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) erros.push(`${nome}: ${m.text()}`); });
    page.on('pageerror', (e) => erros.push(`${nome} pageerror: ${e.message}`));
    return page;
  };
  const verificacoes = [];
  const checar = (nome, ok, detalhe) => {
    verificacoes.push({ nome, ok: !!ok, detalhe });
    console.log(`${ok ? 'ok  ' : 'FALHA'} ${nome}${detalhe ? ` (${detalhe})` : ''}`);
  };
  const foto = (page, nome) => page.screenshot({ path: path.join(SAIDA, `${nome}.png`) });

  try {
    const host = await abrir('anfitrião');
    await host.goto(url);
    await host.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('Menu'), null, { timeout: 20000 });
    await host.evaluate(() => { game.scene.stop('Menu'); game.scene.start('Setup', { level: 0 }); });
    await host.waitForFunction(() => game.scene.isActive('Setup'));
    await host.evaluate(() => game.scene.getScene('Setup').openRoom());
    await host.waitForFunction(() => game.scene.getScene('Setup').room, null, { timeout: 20000 });
    const codigo = await host.evaluate(() => game.scene.getScene('Setup').room.code);
    checar('sala criada', !!codigo, codigo);
    await foto(host, 'c01_sala_criada');

    const amigo = await abrir('amigo');
    await amigo.goto(`${url}?sala=${codigo}`);
    await amigo.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('Setup'), null, { timeout: 20000 });
    const convidado = await amigo.evaluate(() => game.scene.getScene('Setup').sala);
    checar('link abre a sala no amigo', convidado === codigo, convidado);
    await amigo.evaluate(() => { const s = game.scene.getScene('Setup'); s.choice.char = 1; s.choice.outfit = 3; s.refresh(); });
    await foto(amigo, 'c02_amigo_entrando');
    await amigo.evaluate(() => game.scene.getScene('Setup').joinRoom());
    await amigo.waitForFunction(() => game.scene.getScene('Setup').joined, null, { timeout: 30000 });
    await host.waitForFunction(() => game.scene.getScene('Setup').room.guests.size === 1, null, { timeout: 10000 });
    checar('anfitrião vê o amigo na sala', true);
    await foto(host, 'c03_amigo_na_sala');

    await host.evaluate(() => game.scene.getScene('Setup').play());
    await host.waitForFunction(() => game.scene.isActive('Game'), null, { timeout: 10000 });
    await amigo.waitForFunction(() => game.scene.isActive('Game'), null, { timeout: 10000 });
    await host.waitForTimeout(1500);
    const vistos = [
      await host.evaluate(() => game.scene.getScene('Game').others.size),
      await amigo.evaluate(() => game.scene.getScene('Game').others.size),
    ];
    checar('os dois começam e um vê o outro', vistos[0] === 1 && vistos[1] === 1, `anfitrião vê ${vistos[0]}, amigo vê ${vistos[1]}`);

    // Amigo anda para a direita: o anfitrião vê o boneco dele se mexer
    const antes = await host.evaluate(() => [...game.scene.getScene('Game').others.values()][0].s.x);
    await amigo.keyboard.down('D');
    await amigo.waitForTimeout(900);
    await amigo.keyboard.up('D');
    await host.waitForTimeout(500);
    const depois = await host.evaluate(() => [...game.scene.getScene('Game').others.values()][0].s.x);
    checar('anfitrião vê o amigo andar', depois - antes > 100, `${Math.round(antes)} -> ${Math.round(depois)}`);

    // Zumbi parado perto do amigo, no anfitrião; o amigo mira e atira; a vida do zumbi cai no anfitrião
    const zid = await host.evaluate(() => {
      const g = game.scene.getScene('Game');
      const o = [...g.others.values()][0];
      const z = g.createZombie('comum', o.tx + 170, o.ty);
      z.hp = z.maxHp = 400;
      z.body.moves = false;
      z.mode = 'stunned';
      z.modeUntil = g.time.now + 60000;
      return z.nid;
    });
    await amigo.waitForFunction((id) => game.scene.getScene('Game').zombieById.has(id), zid, { timeout: 5000 });
    checar('zumbi do anfitrião aparece no amigo', true);
    const alvo = await amigo.evaluate((id) => {
      const g = game.scene.getScene('Game');
      const z = g.zombieById.get(id);
      const cam = g.cameras.main;
      return { x: z.x - cam.scrollX, y: z.y - cam.scrollY };
    }, zid);
    await amigo.mouse.move(alvo.x, alvo.y);
    await amigo.mouse.down();
    await amigo.waitForTimeout(1500);
    await foto(amigo, 'c04_amigo_atirando');
    await amigo.mouse.up();
    await host.waitForTimeout(500);
    await foto(host, 'c05_anfitriao_ve_tiros');
    const vida = await host.evaluate((id) => {
      const z = game.scene.getScene('Game').zombies.getChildren().find((zz) => zz.nid === id);
      return z ? z.hp : -1;
    }, zid);
    checar('tiro do amigo machuca o zumbi no anfitrião', vida < 400, `vida ${Math.round(vida)}/400`);

    // Amigo constrói uma barricada: sai do dinheiro da equipe e aparece nos dois
    const dinheiro = await host.evaluate(() => game.scene.getScene('Game').money);
    await amigo.evaluate(() => {
      const g = game.scene.getScene('Game');
      g.setBuild(BUILD_ORDER[0]);
      g.tryBuild({ x: g.player.x, y: g.player.y + 120 });
      g.setBuild(null);
    });
    await host.waitForTimeout(800);
    const obras = [
      await host.evaluate(() => game.scene.getScene('Game').structures.length),
      await amigo.evaluate(() => game.scene.getScene('Game').structures.length),
    ];
    const dinheiro2 = await amigo.evaluate(() => game.scene.getScene('Game').money);
    checar('amigo constrói com o dinheiro da equipe', obras[0] === 1 && obras[1] === 1 && dinheiro2 < dinheiro,
      `obras ${obras.join('/')}, dinheiro ${dinheiro} -> ${dinheiro2}`);

    // Amigo chama a horda: os zumbis nascem no anfitrião e aparecem no amigo, e a noite cai nos dois
    await amigo.evaluate(() => game.scene.getScene('Game').ask({ t: 'chamar' }));
    await host.waitForTimeout(4000);
    const horda = [
      await host.evaluate(() => [game.scene.getScene('Game').state, game.scene.getScene('Game').zombies.getChildren().length]),
      await amigo.evaluate(() => [game.scene.getScene('Game').state, game.scene.getScene('Game').zombies.getChildren().length, game.scene.getScene('Game').darkness]),
    ];
    checar('horda chamada pelo amigo chega nos dois', horda[0][0] === 'wave' && horda[1][0] === 'wave' && horda[1][1] >= horda[0][1] - 3 && horda[1][1] > 1 && horda[1][2] > 0.3,
      `anfitrião ${horda[0][1]} zumbis, amigo ${horda[1][1]}, escuro ${horda[1][2]}`);
    await foto(host, 'c06_horda_anfitriao');
    await foto(amigo, 'c07_horda_amigo');

    // Amigo leva dano dos zumbis (calculado no anfitrião)
    await host.evaluate(() => {
      const g = game.scene.getScene('Game');
      const o = [...g.others.values()][0];
      for (let i = 0; i < 3; i++) g.createZombie('comum', o.tx + 20, o.ty + 10 * i);
    });
    await host.waitForTimeout(2000);
    const vidaAmigo = await amigo.evaluate(() => [game.scene.getScene('Game').hp, game.scene.getScene('Game').maxHp]);
    checar('zumbis do anfitrião machucam o amigo', vidaAmigo[0] < vidaAmigo[1], `vida ${Math.round(vidaAmigo[0])}/${vidaAmigo[1]}`);
    await foto(amigo, 'c08_amigo_atacado');

    // Fim de jogo no anfitrião aparece no amigo
    await host.evaluate(() => game.scene.getScene('Game').gameOver('Teste'));
    await amigo.waitForTimeout(800);
    const fim = await amigo.evaluate(() => game.scene.getScene('Game').state);
    checar('fim de jogo chega no amigo', fim === 'over', fim);
    await foto(amigo, 'c09_fim_amigo');

    // Anfitrião recomeça: o amigo recomeça junto
    await host.evaluate(() => { const g = game.scene.getScene('Game'); g.scene.restart(g.setup); });
    await amigo.waitForTimeout(2500);
    const re = await amigo.evaluate(() => [game.scene.getScene('Game').state, game.scene.getScene('Game').others.size]);
    checar('amigo recomeça junto com o anfitrião', re[0] === 'intermission' && re[1] === 1, re.join(', '));

    // Amigo fecha a aba: o anfitrião segue sozinho
    await amigo.close({ runBeforeUnload: true });
    await host.waitForFunction(() => game.scene.getScene('Game').others.size === 0, null, { timeout: 20000 }).catch(() => {});
    const sozinho = await host.evaluate(() => game.scene.getScene('Game').others.size);
    checar('anfitrião percebe a saída do amigo', sozinho === 0, `outros: ${sozinho}`);
  } catch (e) {
    checar('roteiro rodou até o fim', false, e.message.split('\n')[0]);
  }
  checar('sem erros no console', erros.length === 0, erros.slice(0, 5).join(' | '));
  fs.writeFileSync(path.join(SAIDA, 'relatorio.json'), JSON.stringify({ verificacoes, erros }, null, 2));
  await browser.close();
  srv.close();
  const falhou = verificacoes.filter((v) => !v.ok);
  console.log(falhou.length ? `FALHOU: ${falhou.length} de ${verificacoes.length}` : `OK: ${verificacoes.length} verificações`);
  process.exit(falhou.length ? 1 : 0);
})();
