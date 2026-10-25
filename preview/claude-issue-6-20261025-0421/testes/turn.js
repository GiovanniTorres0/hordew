// Diagnóstico: testa servidores de retransmissão (TURN), usados quando os jogadores estão em redes
// diferentes que não se enxergam direto. Para cada servidor, tenta coletar um candidato "relay".
// Uso: node testes/turn.js
const { chromium } = require('playwright-core');
const fs = require('fs');

const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((n) => fs.existsSync(n));
const SERVIDORES = JSON.parse(process.env.SERVIDORES || 'null') || [
  { nome: 'peerjs eu', urls: 'turn:eu-0.turn.peerjs.com:3478', username: 'peerjs', credential: 'peerjsp' },
  { nome: 'peerjs us', urls: 'turn:us-0.turn.peerjs.com:3478', username: 'peerjs', credential: 'peerjsp' },
  { nome: 'openrelay 80', urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { nome: 'openrelay 443', urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { nome: 'openrelay 443 tcp', urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage();
  await page.goto('about:blank');
  for (const s of SERVIDORES) {
    const r = await page.evaluate(async (srv) => {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: srv.urls, username: srv.username, credential: srv.credential }], iceTransportPolicy: 'relay' });
      pc.createDataChannel('x');
      const achou = new Promise((ok) => {
        pc.onicecandidate = (e) => { if (e.candidate && e.candidate.candidate.includes(' relay ')) ok('relay ok'); };
        setTimeout(() => ok('sem resposta'), 8000);
      });
      await pc.setLocalDescription(await pc.createOffer());
      const res = await achou;
      pc.close();
      return res;
    }, s);
    console.log(`${s.nome}: ${r}`);
  }
  await browser.close();
})();
