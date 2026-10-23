// Gera a composição de uma horda. Cada horda fica maior e com zumbis mais fortes.
// ctx: { levelIndex, difficulty, director, infinite }
function buildWave(n, ctx) {
  const diff = n + ctx.levelIndex; // níveis seguintes começam mais difíceis
  const event = n >= 3 && Math.random() < 0.3 ? Phaser.Utils.Array.GetRandom(Object.keys(EVENTS)) : null;
  let count = (6 + diff * 2.5) * ctx.difficulty.count * ctx.director;
  if (event === 'dupla') count *= 2;
  count = Math.round(count);

  // Sorteio com peso entre os tipos liberados; especiais têm limite por horda
  const pool = Object.keys(ZOMBIES).filter((k) => ZOMBIES[k].weight > 0 && ZOMBIES[k].from <= diff && k !== 'brutamonte');
  const maxSpecials = 2 + Math.floor(diff / 2);
  let specials = 0;
  const list = [];
  for (let i = 0; i < count; i++) {
    let type = weightedPick(pool, diff);
    if (ZOMBIES[type].special) {
      if (specials >= maxSpecials) type = 'comum';
      else specials += 1;
    }
    list.push(type);
  }
  // Um brutamonte a cada 3 de dificuldade
  if (diff >= ZOMBIES.brutamonte.from) for (let i = 0; i < Math.floor(diff / 3); i++) list.push('brutamonte');
  Phaser.Utils.Array.Shuffle(list);
  // Tank: chefe a cada 10 hordas, entra no fim da horda
  if (n % 10 === 0) for (let i = 0; i < 1 + Math.floor(n / 20); i++) list.unshift('tank');

  let hpMul = (1 + 0.12 * (diff - 1)) * ctx.difficulty.hp;
  if (n > 30) hpMul *= 1 + 0.08 * (n - 30); // modo infinito acelera depois da horda 30

  return {
    zombies: list,
    hpMul,
    event,
    witch: n >= 4 && Math.random() < 0.3,
    // Intervalo entre zumbis diminui com a horda (ms)
    spawnDelay: Math.max(220, 1300 - diff * 60) / (event === 'dupla' ? 1.6 : 1),
  };
}

function weightedPick(pool, diff) {
  // Tipos mais novos ganham peso conforme a dificuldade passa do ponto em que aparecem
  const w = pool.map((k) => ZOMBIES[k].weight * (k === 'comum' ? 1 : Math.min(2.5, 1 + (diff - ZOMBIES[k].from) * 0.15)));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= w[i];
    if (r <= 0) return pool[i];
  }
  return pool[0];
}

// "Diretor" no estilo Left 4 Dead: ajusta o tamanho das hordas conforme o desempenho.
// stats: fração da vida da base e do jogador perdida na última horda
function updateDirector(current, stats) {
  let next = current;
  if (stats.baseLoss < 0.02 && stats.playerLoss < 0.25) next += 0.05; // muito fácil: aperta
  else if (stats.baseLoss > 0.15 || stats.playerDowned) next -= 0.1; // sofrendo: alivia
  return Phaser.Math.Clamp(next, 0.8, 1.2);
}
