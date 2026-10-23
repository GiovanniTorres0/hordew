// Música de fundo. Com as faixas gravadas (assets/music, geradas no Stable Audio Open), toca cada clima
// alternando duas variações, com silêncio entre uma e outra (música o tempo todo cansava e dava dor de cabeça);
// sem elas, cai na valsa feita por código (Web Audio).
// Climas: dia (valsa), noite (horda: percussão e cordas tensas), tank e witch. [U] liga/desliga.
const Music = (() => {
  let ctx = null;
  let master = null; // valsa por código
  let out = null; // saída geral (mudo = 0)
  let trackBus = null; // faixas gravadas
  let mood = null;
  let timer = null;
  let step = 0;
  let nextTime = 0;
  let muted = storageGet('hordew_mudo', 0) === 1;
  let unlocked = false;

  // Lá menor: progressão Am - F - Dm - E (cada acorde = 1 compasso de valsa, 3 tempos)
  const CHORDS = [
    [57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59],
  ];
  // Melodia de sininhos, 6 colcheias por compasso (null = pausa)
  const MELODY = [
    [76, null, 72, 74, 76, null], [77, null, 76, 74, 72, null],
    [74, null, 72, 69, 72, 74], [71, null, 68, 71, 76, null],
  ];
  const MOODS = {
    day: { bpm: 96, lead: 0.5, perc: 0.3, bassType: 'triangle' },
    night: { bpm: 132, lead: 0.7, perc: 0.8, bassType: 'sawtooth' },
    tank: { bpm: 150, lead: 0.7, perc: 1, bassType: 'sawtooth' },
    witch: { bpm: 70, lead: 0.4, perc: 0.15, bassType: 'triangle' },
  };

  const freq = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function init() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      out = ctx.createGain();
      out.gain.value = muted ? 0 : 1;
      out.connect(ctx.destination);
      master = ctx.createGain();
      master.gain.value = 0.02;
      master.connect(out);
      trackBus = ctx.createGain();
      trackBus.gain.value = 0.22; // música é fundo: bem abaixo dos tiros e efeitos
      trackBus.connect(out);
      loadTracks();
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  function note(n, t, dur, type, vol) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq(n), t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function tick(t, vol) {
    const len = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    g.gain.value = vol;
    src.buffer = buf;
    src.connect(g).connect(master);
    src.start(t);
  }

  // Agenda uma colcheia: baixo pizzicato no tempo 1, acordes nos tempos 2 e 3, sininhos e percussão
  function schedule(t) {
    const m = MOODS[mood];
    const bar = Math.floor(step / 6) % 4;
    const eighth = step % 6;
    const chord = CHORDS[bar];
    const beat = 60 / m.bpm;
    if (eighth === 0) note(chord[0] - 12, t, beat * 0.9, m.bassType, 0.9);
    if (eighth === 2 || eighth === 4) chord.forEach((n) => note(n, t, beat * 0.4, 'triangle', 0.25));
    const mel = MELODY[bar][eighth];
    if (mel && (mood === 'night' || mood === 'tank' || step % 24 < 12 || eighth % 2 === 0)) {
      note(mel, t, beat * 0.8, 'sine', m.lead);
      note(mel + 12, t, beat * 0.3, 'sine', m.lead * 0.25); // brilho de celesta
    }
    if (eighth % 2 === 0) tick(t, eighth === 0 ? m.perc : m.perc * 0.4);
    if (mood !== 'day' && mood !== 'witch' && eighth % 2 === 1) tick(t, m.perc * 0.2);
    step += 1;
  }

  // ---------- Faixas gravadas ----------
  // Só entra aqui o que já existe em assets/music (arquivo faltando vira erro 404 no console)
  const TRACKS = {
    day: ['dia_a', 'dia_b'], night: ['noite_a', 'noite_b'], tank: ['tank_a', 'tank_b'], witch: ['witch_a', 'witch_b'],
  };
  const XF = 4; // segundos de saída suave no fim de cada faixa
  // Silêncio entre uma faixa e a próxima, em segundos [mín, máx]: de dia quase só o ambiente; na horda
  // pausas curtas; chefe vivo toca sem parar (dura pouco)
  const PAUSA = { day: [25, 60], night: [6, 15], tank: [0, 0], witch: [4, 10] };
  let pauseUntil = 0;
  let lastMood = null; // clima da última faixa (na pausa, troca de clima entra na hora)
  const buffers = {}; // clima -> lista de AudioBuffer já decodificados
  const turn = {}; // qual variação toca em seguida
  let deck = null; // faixa tocando agora: { mood, src, gain, endAt }

  function loadTracks() {
    Object.entries(TRACKS).forEach(([m, names]) => names.forEach((n) => {
      fetch(`assets/music/${n}.opus`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
        .then((data) => new Promise((ok, bad) => ctx.decodeAudioData(data, ok, bad)))
        .then((buf) => { (buffers[m] = buffers[m] || []).push(buf); })
        .catch(() => { /* sem a faixa, o clima usa a valsa por código */ });
    }));
  }

  function fade(d, to, when, dur) {
    const g = d.gain.gain;
    g.cancelScheduledValues(when);
    g.setValueAtTime(Math.max(0.0001, g.value), when);
    g.exponentialRampToValueAtTime(to, when + dur);
  }

  function startTrack(m, when, fadeIn) {
    const list = buffers[m];
    turn[m] = ((turn[m] === undefined ? -1 : turn[m]) + 1) % list.length;
    const src = ctx.createBufferSource();
    src.buffer = list[turn[m]];
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    src.connect(gain).connect(trackBus);
    src.start(when);
    const d = { mood: m, src, gain, endAt: when + src.buffer.duration };
    lastMood = m;
    fade(d, 1, when, fadeIn);
    return d;
  }

  function stopDeck(when, dur) {
    if (!deck) return;
    fade(deck, 0.0001, when, dur);
    try { deck.src.stop(when + dur + 0.1); } catch (e) { /* já parou */ }
    deck = null;
  }

  // Troca de clima com cruzamento de 2,5 s; no fim de cada faixa ela sai suave e vem um silêncio antes da próxima
  function tracksLoop() {
    const now = ctx.currentTime;
    if (deck && deck.mood !== mood) {
      stopDeck(now, 2.5);
      deck = startTrack(mood, now + 0.05, 2.5);
    } else if (!deck) {
      if (now < pauseUntil && mood === lastMood) return;
      deck = startTrack(mood, now + 0.05, 1.5);
    } else if (now > deck.endAt - XF - 0.3) {
      const [a, b] = PAUSA[mood];
      pauseUntil = deck.endAt + a + Math.random() * (b - a);
      stopDeck(deck.endAt - XF, XF);
    }
  }

  function loop() {
    if (!ctx || !mood) return;
    if (buffers[mood] && buffers[mood].length) {
      tracksLoop();
      return;
    }
    stopDeck(ctx.currentTime, 1.5);
    const eighthDur = 60 / MOODS[mood].bpm / 2;
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.3) {
      try { schedule(nextTime); } catch (e) { /* áudio indisponível */ }
      nextTime += eighthDur;
    }
  }

  function play(newMood) {
    if (!MOODS[newMood] || newMood === mood) return;
    mood = newMood;
    if (!unlocked || !init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!timer) timer = setInterval(loop, 100);
  }

  function stop() {
    mood = null;
    if (ctx) stopDeck(ctx.currentTime, 2);
    if (timer) { clearInterval(timer); timer = null; }
  }

  function toggleMute() {
    muted = !muted;
    storageSet('hordew_mudo', muted ? 1 : 0);
    if (out) out.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.1);
    return muted;
  }

  // O navegador só deixa tocar som depois de um clique ou tecla
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    const wanted = mood;
    mood = null;
    if (wanted) play(wanted);
  }
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', (e) => {
    unlock();
    if (e.key === 'u' || e.key === 'U') toggleMute();
  });

  // Escolhe o clima olhando a cena ativa, sem precisar mexer nas cenas
  setInterval(() => {
    try {
      if (typeof game === 'undefined' || !game.scene) return;
      const g = game.scene.getScene('Game');
      if (g && game.scene.isActive('Game')) {
        if (g.state === 'over') stop();
        else {
          // Chefe vivo muda a música: Tank (ou Witch furiosa) toca a de chefe; Witch sentada, a de suspense
          const zs = g.zombies.getChildren();
          const boss = zs.some((z) => z.active && (z.def.boss || (z.def === ZOMBIES.witch && z.mode !== 'sit')));
          const witch = zs.some((z) => z.active && z.def === ZOMBIES.witch);
          play(boss ? 'tank' : witch ? 'witch' : g.state === 'wave' ? 'night' : 'day');
        }
      } else if (['Menu', 'Setup', 'Intro'].some((k) => game.scene.isActive(k))) play('day');
    } catch (e) { /* ignora */ }
  }, 500);

  const tracksLoaded = () => Object.values(buffers).reduce((n, l) => n + l.length, 0);
  return { play, stop, toggleMute, isMuted: () => muted, tracksLoaded, mood: () => mood };
})();
