// Teste de carga do cooperativo: partida com muitos zumbis por um minuto, internet de casa simulada
// (atraso e upload limitado no anfitrião), medindo o tamanho dos pacotes e se o amigo continua na sala.
// Uso: node testes/estresse.js   (RETRANSMISSAO=1 força a retransmissão; AMIGOS=3 põe três amigos)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const RAIZ = path.join(__dirname, '..');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((n) => fs.existsSync(n));
const AMIGOS = +(process.env.AMIGOS || 1);
const SEGUNDOS = +(process.env.SEGUNDOS || 60);
const UPLOAD_KBPS = +(process.env.UPLOAD || 1000); // upload do anfitrião em kbit/s (internet de casa comum)

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
  const srv = await servidor();
  const url = process.env.URL || `http://127.0.0.1:${srv.address().port}/index.html`;
  const browser = await chromium.launch({ executablePath: exe, args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const erros = [];
  const abrir = async (nome, limitar) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    if (nome !== 'anfitrião' && process.env.RETRANSMISSAO) await ctx.addInitScript(() => { window.RTCPeerConnection = undefined; window.webkitRTCPeerConnection = undefined; });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => erros.push(`${nome}: ${e.message}`));
    if (limitar) {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 80, downloadThroughput: 10e6 / 8, uploadThroughput: (UPLOAD_KBPS * 1000) / 8 });
    }
    await page.goto(url);
    await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('Menu'), null, { timeout: 20000 });
    return page;
  };
  const host = await abrir('anfitrião', true);
  await host.evaluate(() => { game.scene.stop('Menu'); game.scene.start('Setup', { level: 0 }); });
  await host.waitForFunction(() => game.scene.isActive('Setup'));
  await host.evaluate(() => game.scene.getScene('Setup').openRoom());
  await host.waitForFunction(() => game.scene.getScene('Setup').room, null, { timeout: 20000 });
  const codigo = await host.evaluate(() => game.scene.getScene('Setup').room.code);
  const amigos = [];
  for (let i = 0; i < AMIGOS; i++) {
    const a = await abrir(`amigo${i + 1}`, false);
    await a.goto(`${url}?sala=${codigo}`);
    await a.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('Setup'), null, { timeout: 20000 });
    await a.evaluate(() => game.scene.getScene('Setup').joinRoom());
    await a.waitForFunction(() => game.scene.getScene('Setup').joined, null, { timeout: 30000 });
    amigos.push(a);
  }
  await host.waitForFunction((n) => game.scene.getScene('Setup').room.guests.size === n, AMIGOS, { timeout: 15000 });
  const vias = await Promise.all(amigos.map((a) => a.evaluate(() => Net.via('h'))));
  console.log(`sala ${codigo}, ${AMIGOS} amigo(s) por: ${vias.join(', ')}; upload do anfitrião ${UPLOAD_KBPS} kbit/s`);
  // Mede o tamanho de cada pacote que o anfitrião manda
  await host.evaluate(() => {
    window.medida = { n: 0, bytes: 0, max: 0 };
    const orig = Net.broadcast;
    Net.broadcast = (m) => { const t = JSON.stringify(m).length; medida.n += 1; medida.bytes += t; medida.max = Math.max(medida.max, t); orig(m); };
  });
  await host.evaluate(() => game.scene.getScene('Setup').play());
  await Promise.all(amigos.map((a) => a.waitForFunction(() => game.scene.isActive('Game'), null, { timeout: 15000 })));
  await host.waitForTimeout(1500);
  console.log('anfitrião logo após começar:', await host.evaluate(() => { const g = game.scene.getScene('Game'); return JSON.stringify({ roster: g.net.roster.map((r) => r.id), others: [...g.others.keys()], peers: Net.peers ? Net.peers() : null }); }));
  console.log('amigos:', await Promise.all(amigos.map((a) => a.evaluate(() => { const g = game.scene.getScene('Game'); return `${game.scene.getScenes(true).map((x) => x.scene.key)} outros=${g.others.size} state=${g.state}`; }))));
  await host.evaluate(() => {
    const g = game.scene.getScene('Game');
    g.money = 5000;
    g.startWave(true);
    // muitos zumbis de uma vez, como numa horda grande
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2;
      const z = g.createZombie('comum', g.player.x + Math.cos(a) * 700, g.player.y + Math.sin(a) * 700);
      z.hp = z.maxHp = 1e6;
    }
    g.hp = g.maxHp = 1e9;
    g.base.hp = g.base.maxHp = 1e9;
  });
  const t0 = Date.now();
  let caiu = null;
  while (Date.now() - t0 < SEGUNDOS * 1000) {
    await host.waitForTimeout(5000);
    const outros = await host.evaluate(() => game.scene.getScene('Game').others.size);
    const m = await host.evaluate(() => medida);
    const atraso = await Promise.all(amigos.map((a) => a.evaluate(() => { const g = game.scene.getScene('Game'); return Math.round(game.loop.time - g.lastSnap); })));
    const s = Math.round((Date.now() - t0) / 1000);
    console.log(`${s}s: amigos no anfitrião ${outros}/${AMIGOS}, pacote médio ${Math.round(m.bytes / Math.max(1, m.n))} B, maior ${m.max} B, ${Math.round(m.bytes / s / 1024)} KB/s, último pacote no amigo há ${atraso.join('/')} ms`);
    if (outros < AMIGOS && !caiu) caiu = s;
  }
  console.log(caiu ? `CAIU aos ${caiu}s` : 'OK: ninguém caiu');
  if (erros.length) console.log('erros:', erros.slice(0, 5).join(' | '));
  await browser.close();
  srv.close();
  process.exit(caiu ? 1 : 0);
})();
