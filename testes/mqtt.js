// Diagnóstico: testa os servidores MQTT públicos (WebSocket) usados como retransmissão do cooperativo
// quando a conexão direta não fecha. Mede o tempo de ida e volta e quantas mensagens chegam numa rajada
// parecida com a do jogo (15 por segundo, ~3 KB). Uso: node testes/mqtt.js
const { chromium } = require('playwright-core');
const fs = require('fs');

const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((n) => fs.existsSync(n));
const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage();
  await page.goto('about:blank');
  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/mqtt/5.10.1/mqtt.min.js' });
  for (const url of BROKERS) {
    const r = await page.evaluate((u) => new Promise((ok) => {
      const fim = setTimeout(() => ok('sem resposta'), 15000);
      const topo = `hordew-teste/${Math.random().toString(36).slice(2)}`;
      const a = mqtt.connect(u, { connectTimeout: 8000, reconnectPeriod: 0 });
      const b = mqtt.connect(u, { connectTimeout: 8000, reconnectPeriod: 0 });
      let prontos = 0;
      let t0 = 0;
      let rtt = 0;
      let chegou = 0;
      const corpo = 'x'.repeat(3000);
      b.on('message', (t, msg) => {
        const m = JSON.parse(msg.toString());
        if (m.ping) { rtt = Date.now() - t0; b.publish(`${topo}/fim`, '{}'); return; }
        chegou += 1;
      });
      const comecar = () => {
        if (++prontos < 2) return;
        t0 = Date.now();
        a.publish(topo, JSON.stringify({ ping: 1 }));
        // rajada: 45 mensagens em 3 s
        let n = 0;
        const iv = setInterval(() => {
          a.publish(topo, JSON.stringify({ n, corpo }));
          if (++n >= 45) {
            clearInterval(iv);
            setTimeout(() => { clearTimeout(fim); a.end(true); b.end(true); ok(`ida+volta ${rtt}ms, rajada ${chegou}/45`); }, 2500);
          }
        }, 66);
      };
      a.on('connect', comecar);
      b.on('connect', () => b.subscribe(topo, () => comecar()));
      a.on('error', (e) => { clearTimeout(fim); ok(`erro ${e.message}`); });
      b.on('error', (e) => { clearTimeout(fim); ok(`erro ${e.message}`); });
    }), url);
    console.log(`${url}: ${r}`);
  }
  await browser.close();
})();
