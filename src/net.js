// Multiplayer online por link (WebRTC com PeerJS). Quem cria a sala é o anfitrião: o jogo inteiro roda
// no navegador dele. Os amigos (até 3) entram pelo link ?sala=CODIGO, mandam o que fazem e recebem o
// estado do mundo. O servidor público do PeerJS só apresenta os navegadores; os dados vão direto entre eles.
const Net = (() => {
  const PREFIXO = 'hordew-sala-';
  const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I, para ditar o código sem confusão
  const MAX_AMIGOS = 3;
  let peer = null;
  let role = null; // 'host' | 'guest' | null
  let accepting = false;
  const conns = new Map(); // id -> conexão (no amigo, só a do anfitrião, com id 'h')
  let cb = {}; // { msg(m, de), entrou(id), saiu(id) }: a cena ativa troca com Net.on

  const convite = (new URLSearchParams(location.search).get('sala') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let conviteUsado = false;

  const disponivel = () => typeof Peer !== 'undefined';

  function novoCodigo() {
    let s = '';
    for (let i = 0; i < 5; i++) s += LETRAS[Math.floor(Math.random() * LETRAS.length)];
    return s;
  }

  function erroTexto(e) {
    const t = e && e.type;
    if (t === 'peer-unavailable') return 'Sala não encontrada. Confira o código ou peça um link novo.';
    if (t === 'browser-incompatible') return 'Este navegador não tem WebRTC. Use Chrome, Edge ou Firefox.';
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'Sem conexão com o servidor de salas. Tente de novo.';
    if (e && e.message === 'tempo') return 'Demorou demais para conectar. Tente de novo.';
    return 'Não foi possível conectar.';
  }

  function ligar(conn, id) {
    conn.on('data', (m) => { if (cb.msg && m && m.t) cb.msg(m, id); });
    conn.on('close', () => {
      if (conns.get(id) !== conn) return;
      conns.delete(id);
      if (cb.saiu) cb.saiu(id);
    });
    conn.on('error', () => { /* o close avisa */ });
  }

  function createRoom(tentativa = 0) {
    leave();
    if (!disponivel()) return Promise.reject(new Error('Multiplayer indisponível (a biblioteca não carregou)'));
    return new Promise((ok, bad) => {
      const codigo = novoCodigo();
      const p = new Peer(PREFIXO + codigo, { debug: 0 });
      peer = p;
      p.on('open', () => { role = 'host'; accepting = true; ok(codigo); });
      p.on('connection', (conn) => {
        conn.on('open', () => {
          if (!accepting || conns.size >= MAX_AMIGOS) { conn.close(); return; }
          conns.set(conn.peer, conn);
          ligar(conn, conn.peer);
          if (cb.entrou) cb.entrou(conn.peer);
        });
      });
      p.on('disconnected', () => { if (peer === p && !p.destroyed) p.reconnect(); }); // só a apresentação caiu; as conexões seguem
      p.on('error', (e) => {
        if (role === 'host') return; // erro depois de aberta (ex.: amigo com link errado) não derruba a sala
        if (e.type === 'unavailable-id' && tentativa < 3) { createRoom(tentativa + 1).then(ok, bad); return; }
        bad(new Error(erroTexto(e)));
      });
    });
  }

  function join(codigo) {
    leave();
    if (!disponivel()) return Promise.reject(new Error('Multiplayer indisponível (a biblioteca não carregou)'));
    return new Promise((ok, bad) => {
      const p = new Peer({ debug: 0 });
      peer = p;
      const limite = setTimeout(() => { bad(new Error(erroTexto({ message: 'tempo' }))); leave(); }, 20000);
      p.on('open', () => {
        const conn = p.connect(PREFIXO + codigo, { reliable: true, serialization: 'json' });
        conn.on('open', () => {
          clearTimeout(limite);
          role = 'guest';
          conns.set('h', conn);
          ligar(conn, 'h');
          ok(p.id);
        });
      });
      p.on('error', (e) => {
        if (role === 'guest') return;
        clearTimeout(limite);
        bad(new Error(erroTexto(e)));
        leave();
      });
    });
  }

  function leave() {
    conns.forEach((c) => { try { c.close(); } catch (e) { /* já fechada */ } });
    conns.clear();
    if (peer) { try { peer.destroy(); } catch (e) { /* já destruído */ } }
    peer = null;
    role = null;
    accepting = false;
  }

  // Fechar a aba avisa os outros na hora (sem isso o WebRTC demora a perceber)
  window.addEventListener('pagehide', leave);

  const enviar = (c, m) => { if (c && c.open) { try { c.send(m); } catch (e) { /* conexão caindo */ } } };

  return {
    disponivel,
    createRoom,
    join,
    leave,
    on(handlers) { cb = handlers || {}; },
    send(m) { enviar(conns.get('h'), m); }, // amigo -> anfitrião
    sendTo(id, m) { enviar(conns.get(id), m); },
    broadcast(m) { conns.forEach((c) => enviar(c, m)); },
    setAccepting(on) { accepting = on; },
    drop(id) { const c = conns.get(id); conns.delete(id); if (c) { try { c.close(); } catch (e) { /* já fechada */ } } },
    role: () => role,
    id: () => (peer ? peer.id : null),
    peers: () => [...conns.keys()],
    // Código da sala vindo do link (?sala=XXXXX); usado uma vez só e tirado da barra de endereço
    takeInvite() {
      if (conviteUsado || !convite) return null;
      conviteUsado = true;
      try { history.replaceState(null, '', location.pathname); } catch (e) { /* tanto faz */ }
      return convite;
    },
    inviteLink: (codigo) => `${location.origin}${location.pathname}?sala=${codigo}`,
  };
})();
