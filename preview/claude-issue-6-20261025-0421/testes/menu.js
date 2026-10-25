// Teste das saídas para o menu: botão Menu na barra, menu de pausa (Esc) e botões da tela de fim.
// Uso: node testes/menu.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const RAIZ = path.join(__dirname, '..');
const SAIDA = path.join(__dirname, 'saida_menu');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((n) => fs.existsSync(n));

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
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) erros.push(m.text()); });
  let falhas = 0;
  const checar = (nome, ok, d) => { if (!ok) falhas += 1; console.log(`${ok ? 'ok  ' : 'FALHA'} ${nome}${d !== undefined ? ` (${d})` : ''}`); };
  const foto = (n) => page.screenshot({ path: path.join(SAIDA, `${n}.png`) });
  const entrar = async () => {
    await page.evaluate(() => { game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key)); game.scene.start('Game', { char: 0, outfit: 1 }); });
    await page.waitForFunction(() => game.scene.isActive('Game'));
    await page.waitForTimeout(800);
  };
  const ativa = () => page.evaluate(() => game.scene.getScenes(true).map((s) => s.scene.key).join(','));

  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('Menu'), null, { timeout: 20000 });
  await entrar();
  await foto('m01_barra');

  // Botão "Menu" da barra abre a pausa
  await page.mouse.click(1030, 24);
  await page.waitForTimeout(300);
  checar('botão Menu da barra pausa o jogo', await page.evaluate(() => game.scene.getScene('Game').paused));
  await foto('m02_pausa');
  // Continuar
  await page.mouse.click(640, 320);
  await page.waitForTimeout(300);
  checar('Continuar volta ao jogo', await page.evaluate(() => !game.scene.getScene('Game').paused && !game.scene.getScene('Game').physics.world.isPaused));
  // Esc abre; Recomeçar reinicia sem ficar parado
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  checar('Esc abre a pausa', await page.evaluate(() => game.scene.getScene('Game').paused));
  await page.mouse.click(640, 384);
  await page.waitForTimeout(800);
  checar('Recomeçar reinicia andando', await page.evaluate(() => { const g = game.scene.getScene('Game'); return !g.paused && !g.physics.world.isPaused && !g.time.paused; }));
  // Sair para o menu
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.mouse.click(640, 448);
  await page.waitForTimeout(800);
  checar('Sair para o menu leva ao menu', (await ativa()) === 'Menu', await ativa());
  await foto('m03_menu');

  // Tela de fim: botões clicáveis
  await entrar();
  await page.evaluate(() => game.scene.getScene('Game').gameOver('Teste do menu.'));
  await page.waitForTimeout(500);
  await foto('m04_fim');
  await page.mouse.click(640 + 125, 360 + 130);
  await page.waitForTimeout(800);
  checar('Menu principal na tela de fim', (await ativa()) === 'Menu', await ativa());
  await entrar();
  await page.evaluate(() => game.scene.getScene('Game').gameOver('Teste do menu.'));
  await page.waitForTimeout(500);
  await page.mouse.click(640 - 125, 360 + 130);
  await page.waitForTimeout(800);
  checar('Recomeçar na tela de fim', await page.evaluate(() => game.scene.isActive('Game') && game.scene.getScene('Game').state !== 'over'));
  await entrar();
  await page.evaluate(() => game.scene.getScene('Game').victory());
  await page.waitForTimeout(500);
  await foto('m05_vitoria');

  checar('sem erros no console', erros.length === 0, erros.slice(0, 3).join(' | '));
  await browser.close();
  srv.close();
  console.log(falhas ? `FALHOU: ${falhas}` : 'OK');
  process.exit(falhas ? 1 : 0);
})();
