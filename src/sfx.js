// Efeitos sonoros sintetizados com Web Audio (sem arquivos de som)
const Sfx = (() => {
  let ctx = null;
  const audio = () => {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  function tone({ freq = 440, to = freq, dur = 0.1, type = 'square', vol = 0.08, delay = 0 }) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur);
  }

  function noise(dur = 0.1, vol = 0.1, delay = 0) {
    const a = audio();
    if (!a) return;
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = a.createBufferSource();
    const g = a.createGain();
    g.gain.value = vol;
    src.buffer = buf;
    src.connect(g).connect(a.destination);
    src.start(a.currentTime + delay);
  }

  return {
    shot: () => noise(0.06, 0.06),
    splat: () => tone({ freq: 220, to: 60, dur: 0.18, type: 'sawtooth', vol: 0.06 }),
    build: () => tone({ freq: 300, to: 600, dur: 0.12, type: 'triangle', vol: 0.1 }),
    pick: () => { tone({ freq: 500, dur: 0.08, type: 'triangle' }); tone({ freq: 800, dur: 0.12, type: 'triangle', delay: 0.08 }); },
    heli: () => { for (let i = 0; i < 10; i++) noise(0.05, 0.05, i * 0.12); },
    groan: () => tone({ freq: Phaser.Math.Between(90, 130), to: 60, dur: 0.6, type: 'sawtooth', vol: 0.035 }),
    bark:() => { tone({ freq: 600, to: 350, dur: 0.08, type: 'sawtooth', vol: 0.06 }); tone({ freq: 650, to: 380, dur: 0.08, type: 'sawtooth', vol: 0.06, delay: 0.12 }); },
    lose:() => tone({ freq: 300, to: 60, dur: 1, type: 'sawtooth', vol: 0.1 }),
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.25, type: 'triangle', vol: 0.1, delay: i * 0.15 })),
    zap: () => tone({ freq: 1400, to: 300, dur: 0.12, type: 'square', vol: 0.04 }),
    boom: () => { noise(0.35, 0.18); tone({ freq: 120, to: 40, dur: 0.35, type: 'sine', vol: 0.15 }); },
    spit: () => tone({ freq: 400, to: 900, dur: 0.15, type: 'sawtooth', vol: 0.04 }),
    scream: () => tone({ freq: 900, to: 500, dur: 0.4, type: 'sawtooth', vol: 0.05 }),
    roar: () => { tone({ freq: 80, to: 50, dur: 0.9, type: 'sawtooth', vol: 0.12 }); noise(0.5, 0.06); },
    cry: () => tone({ freq: 700, to: 600, dur: 0.7, type: 'sine', vol: 0.03 }),
    vomit: () => { noise(0.4, 0.08); tone({ freq: 150, to: 90, dur: 0.4, type: 'sawtooth', vol: 0.06 }); },
    crack: () => noise(0.12, 0.1),
    sell: () => { tone({ freq: 800, dur: 0.06, type: 'triangle' }); tone({ freq: 600, dur: 0.1, type: 'triangle', delay: 0.06 }); },
    alarm: () => { tone({ freq: 500, to: 700, dur: 0.2, type: 'square', vol: 0.05 }); tone({ freq: 500, to: 700, dur: 0.2, type: 'square', vol: 0.05, delay: 0.25 }); },
  };
})();
