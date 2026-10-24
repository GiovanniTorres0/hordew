// Multiplayer online por link. Quem cria a sala é o anfitrião: o jogo inteiro roda no navegador dele.
// Os amigos (até 3) entram pelo link ?sala=CODIGO, mandam o que fazem e recebem o estado do mundo.
// Dois caminhos, sem servidor próprio:
//  - direto (WebRTC com PeerJS): rápido, mas só fecha quando as redes dos dois se enxergam;
//  - retransmissão (servidor MQTT público por WebSocket): funciona em qualquer rede, com uns 0,2 s de atraso.
// O amigo tenta o direto primeiro e, se não fechar em alguns segundos, vai pela retransmissão.
const Net = (() => {
  const PREFIXO = 'hordew-sala-';
  const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I, para ditar o código sem confusão
  const MAX_AMIGOS = 3;
  // Servidores MQTT públicos testados (testes/mqtt.js); o anfitrião escuta em todos que responderem
  const BROKERS = ['wss://test.mosquitto.org:8081/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
  const TOPICO = 'hordew/v1/';
  const DIRETO_MS = 6000; // espera pela conexão direta antes de ir pela retransmissão
  const PING_MS = 2000;
  const QUEDA_MS = 15000; // sem nenhuma mensagem nesse tempo, a conexão caiu

  let peer = null;
  let brokers = []; // clientes MQTT conectados
  let codigo = null;
  let meuId = null;
  let role = null; // 'host' | 'guest' | null
  let accepting = false;
  const conns = new Map(); // id -> { send(m), close(), via: 'direto' | 'retransmissão', visto, enviado }
  let cb = {}; // { msg(m, de), entrou(id), saiu(id) }: a cena ativa troca com Net.on
  let pulso = null;

  const convite = (new URLSearchParams(location.search).get('sala') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let conviteUsado = false;

  const temDireto = () => typeof Peer !== 'undefined';
  const temRetransmissao = () => typeof mqtt !== 'undefined';
  const disponivel = () => temDireto() || temRetransmissao();

  const aleatorio = (n) => { let s = ''; for (let i = 0; i < n; i++) s += LETRAS[Math.floor(Math.random() * LETRAS.length)]; return s; };

  // ---------- Conexões ----------

  function registrar(id, c) {
    c.visto = Date.now();
    c.enviado = 0;
    conns.set(id, c);
    if (!pulso) pulso = setInterval(batimento, PING_MS);
  }

  function receber(id, m) {
    const c = conns.get(id);
    if (!c || !m || !m.t) return;
    c.visto = Date.now();
    if (m.t === '__p') return; // só sinal de vida
    if (m.t === '__tchau') { cair(id); return; }
    if (cb.msg) cb.msg(m, id);
  }

  function cair(id) {
    const c = conns.get(id);
    if (!c) return;
    conns.delete(id);
    try { c.close(); } catch (e) { /* já fechada */ }
    if (cb.saiu) cb.saiu(id);
  }

  // Mantém viva e percebe quem sumiu sem avisar (aba fechada, internet caiu)
  function batimento() {
    const agora = Date.now();
    conns.forEach((c, id) => {
      if (agora - c.visto > QUEDA_MS) { cair(id); return; }
      if (agora - c.enviado > PING_MS) enviar(c, { t: '__p' });
    });
  }

  function enviar(c, m) {
    if (!c) return;
    c.enviado = Date.now();
    try { c.send(m); } catch (e) { /* conexão caindo: o batimento avisa */ }
  }

  function viaDireta(conn) {
    return { via: 'direto', send: (m) => { if (conn.open) conn.send(m); }, close: () => conn.close() };
  }

  function viaRetransmissao(cliente, topico, envelope) {
    return {
      via: 'retransmissão',
      send: (m) => cliente.publish(topico, JSON.stringify(envelope ? { de: meuId, m } : m)),
      close: () => {},
    };
  }

  // ---------- Retransmissão (MQTT) ----------

  function ligarBroker(url) {
    return new Promise((ok) => {
      if (!temRetransmissao()) { ok(null); return; }
      let c;
      try { c = mqtt.connect(url, { connectTimeout: 7000, reconnectPeriod: 2000, clean: true }); } catch (e) { ok(null); return; }
      const desiste = setTimeout(() => { c.end(true); ok(null); }, 8000);
      c.once('connect', () => { clearTimeout(desiste); ok(c); });
      c.on('error', () => { /* tenta de novo sozinho; se nunca ligar, o tempo desiste */ });
    });
  }

  async function ligarBrokers(todos) {
    if (!todos) {
      // amigo: o primeiro que responder basta
      for (const url of BROKERS) {
        const c = await ligarBroker(url);
        if (c) return [c];
      }
      return [];
    }
    return (await Promise.all(BROKERS.map(ligarBroker))).filter(Boolean);
  }

  // ---------- Anfitrião ----------

  function abrirPeerAnfitriao(tentativa = 0) {
    return new Promise((ok) => {
      if (!temDireto()) { ok(false); return; }
      const p = new Peer(PREFIXO + codigo, { debug: 0 });
      peer = p;
      p.on('open', () => ok(true));
      p.on('connection', (conn) => {
        conn.on('open', () => {
          const id = conn.peer;
          if (!accepting || conns.size >= MAX_AMIGOS || conns.has(id)) { conn.close(); return; }
          registrar(id, viaDireta(conn));
          conn.on('data', (m) => receber(id, m));
          conn.on('close', () => { const c = conns.get(id); if (c && c.via === 'direto') cair(id); });
          if (cb.entrou) cb.entrou(id);
        });
      });
      p.on('disconnected', () => { if (peer === p && !p.destroyed) p.reconnect(); }); // só a apresentação caiu
      p.on('error', (e) => {
        if (e.type === 'unavailable-id' && tentativa < 2) { p.destroy(); codigo = aleatorio(5); abrirPeerAnfitriao(tentativa + 1).then(ok); return; }
        ok(false);
      });
      setTimeout(() => ok(false), 8000);
    });
  }

  async function createRoom() {
    leave();
    if (!disponivel()) throw new Error('Multiplayer indisponível (as bibliotecas não carregaram). Recarregue a página.');
    codigo = aleatorio(5);
    meuId = 'h';
    const [direto, lista] = await Promise.all([abrirPeerAnfitriao(), ligarBrokers(true)]);
    brokers = lista;
    brokers.forEach((cli) => {
      const caixa = `${TOPICO}${codigo}/h`;
      cli.subscribe(caixa);
      cli.on('message', (topico, dados) => {
        if (topico !== caixa) return;
        let env;
        try { env = JSON.parse(dados.toString()); } catch (e) { return; }
        const id = env && typeof env.de === 'string' ? env.de.slice(0, 40) : null;
        if (!id || !env.m) return;
        if (env.m.t === '__oi') {
          if (conns.has(id)) return; // já entrou (pelo direto ou repetido)
          if (!accepting || conns.size >= MAX_AMIGOS) {
            cli.publish(`${TOPICO}${codigo}/${id}`, JSON.stringify({ t: '__cheia' }));
            return;
          }
          registrar(id, viaRetransmissao(cli, `${TOPICO}${codigo}/${id}`, false));
          enviar(conns.get(id), { t: '__bemvindo' });
          if (cb.entrou) cb.entrou(id);
          return;
        }
        receber(id, env.m);
      });
    });
    if (!direto && !brokers.length) { leave(); throw new Error('Sem conexão com os servidores de sala. Confira a internet e tente de novo.'); }
    role = 'host';
    accepting = true;
    return codigo;
  }

  // ---------- Amigo ----------

  function tentarDireto(cod) {
    return new Promise((ok) => {
      if (!temDireto()) { ok(null); return; }
      const p = new Peer(meuId, { debug: 0 });
      peer = p;
      let feito = false;
      const fim = (v) => { if (!feito) { feito = true; ok(v); } };
      setTimeout(() => fim(null), DIRETO_MS);
      p.on('open', () => {
        const conn = p.connect(PREFIXO + cod, { reliable: true, serialization: 'json' });
        conn.on('open', () => {
          if (feito) { conn.close(); return; }
          fim(conn);
        });
      });
      p.on('error', (e) => fim(e.type === 'peer-unavailable' ? 'sem-sala-direto' : null));
    });
  }

  function tentarRetransmissao(cod) {
    return new Promise((ok) => {
      ligarBrokers(false).then(([cli]) => {
        if (!cli) { ok(null); return; }
        brokers = [cli];
        const caixa = `${TOPICO}${cod}/${meuId}`;
        const conn = viaRetransmissao(cli, `${TOPICO}${cod}/h`, true);
        let feito = false;
        const fim = (v) => { if (!feito) { feito = true; ok(v); } };
        cli.subscribe(caixa, () => {
          // Chama algumas vezes: a primeira mensagem às vezes se perde enquanto o anfitrião liga
          let n = 0;
          const chama = () => { if (!feito && n++ < 4) { conn.send({ t: '__oi' }); setTimeout(chama, 1500); } };
          chama();
        });
        setTimeout(() => fim(null), 9000);
        cli.on('message', (topico, dados) => {
          if (topico !== caixa) return;
          let m;
          try { m = JSON.parse(dados.toString()); } catch (e) { return; }
          if (!feito) {
            if (m.t === '__bemvindo') fim(conn);
            else if (m.t === '__cheia') fim('cheia');
            return;
          }
          receber('h', m);
        });
      });
    });
  }

  async function join(cod) {
    leave();
    if (!disponivel()) throw new Error('Multiplayer indisponível (as bibliotecas não carregaram). Recarregue a página.');
    codigo = cod;
    meuId = `hordew-j-${aleatorio(8).toLowerCase()}`;
    const direto = await tentarDireto(cod);
    if (direto && typeof direto === 'object') {
      registrar('h', viaDireta(direto));
      direto.on('data', (m) => receber('h', m));
      direto.on('close', () => cair('h'));
      role = 'guest';
      return meuId;
    }
    if (peer) { try { peer.destroy(); } catch (e) { /* tanto faz */ } peer = null; }
    const rel = await tentarRetransmissao(cod);
    if (rel === 'cheia') { leave(); throw new Error('A sala está cheia (máximo de 4 jogadores) ou a partida já começou.'); }
    if (!rel) {
      leave();
      throw new Error(direto === 'sem-sala-direto'
        ? 'Sala não encontrada. O anfitrião precisa estar com a sala aberta: peça um link novo.'
        : 'Não deu para conectar. Confira a internet e se o anfitrião está com a sala aberta.');
    }
    registrar('h', rel);
    role = 'guest';
    return meuId;
  }

  function leave() {
    conns.forEach((c) => enviar(c, { t: '__tchau' }));
    const fechar = [...conns.values()];
    conns.clear();
    const b = brokers;
    brokers = [];
    // Dá tempo do "tchau" sair antes de fechar
    setTimeout(() => {
      fechar.forEach((c) => { try { c.close(); } catch (e) { /* já fechada */ } });
      b.forEach((cli) => { try { cli.end(true); } catch (e) { /* já fechado */ } });
    }, 150);
    if (peer) { const p = peer; setTimeout(() => { try { p.destroy(); } catch (e) { /* já destruído */ } }, 150); }
    peer = null;
    role = null;
    accepting = false;
    if (pulso) { clearInterval(pulso); pulso = null; }
  }

  // Fechar a aba avisa os outros na hora
  window.addEventListener('pagehide', () => conns.forEach((c) => enviar(c, { t: '__tchau' })));

  return {
    disponivel,
    createRoom,
    join,
    leave,
    on(handlers) { cb = handlers || {}; },
    send(m) { enviar(conns.get('h'), m); }, // amigo -> anfitrião
    sendTo(id, m) { enviar(conns.get(id), m); },
    broadcast(m) { conns.forEach((c) => enviar(c, m)); },
    drop(id) { const c = conns.get(id); conns.delete(id); if (c) { try { c.close(); } catch (e) { /* já fechada */ } } },
    setAccepting(on) { accepting = on; },
    role: () => role,
    id: () => meuId,
    peers: () => [...conns.keys()],
    via: (id) => (conns.get(id) ? conns.get(id).via : null),
    // Algum amigo pela retransmissão: o jogo manda menos pacotes por segundo
    lento: () => [...conns.values()].some((c) => c.via === 'retransmissão'),
    // Código da sala vindo do link (?sala=XXXXX); usado uma vez só e tirado da barra de endereço
    takeInvite() {
      if (conviteUsado || !convite) return null;
      conviteUsado = true;
      try { history.replaceState(null, '', location.pathname); } catch (e) { /* tanto faz */ }
      return convite;
    },
    inviteLink: (cod) => `${location.origin}${location.pathname}?sala=${cod}`,
  };
})();
