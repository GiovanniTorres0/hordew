// Música de fundo gerada por código (Web Audio): valsa em tom menor no estilo Burton/Elfman.
// Dia: calma. Noite (durante a horda): mais rápida e tensa. [U] liga/desliga o som da música.
const Music = (() => {
  let ctx = null;
  let master = null;
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
  };

  const freq = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function init() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.04;
      master.connect(ctx.destination);
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
    if (mel && (mood === 'night' || step % 24 < 12 || eighth % 2 === 0)) {
      note(mel, t, beat * 0.8, 'sine', m.lead);
      note(mel + 12, t, beat * 0.3, 'sine', m.lead * 0.25); // brilho de celesta
    }
    if (eighth % 2 === 0) tick(t, eighth === 0 ? m.perc : m.perc * 0.4);
    if (mood === 'night' && eighth % 2 === 1) tick(t, m.perc * 0.2);
    step += 1;
  }

  function loop() {
    if (!ctx || !mood) return;
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
    if (timer) { clearInterval(timer); timer = null; }
  }

  function toggleMute() {
    muted = !muted;
    storageSet('hordew_mudo', muted ? 1 : 0);
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.04, ctx.currentTime, 0.1);
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
        else play(g.state === 'wave' ? 'night' : 'day');
      } else if (['Menu', 'Setup', 'Intro'].some((k) => game.scene.isActive(k))) play('day');
    } catch (e) { /* ignora */ }
  }, 500);

  return { play, stop, toggleMute, isMuted: () => muted };
})();
