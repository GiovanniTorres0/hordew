// Gera a composição de uma horda. Cada horda fica maior e com zumbis mais fortes.
function buildWave(n, levelIndex) {
  const diff = n + levelIndex * 2; // níveis seguintes começam mais difíceis
  const count = 6 + Math.floor(diff * 2.5);
  const list = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let type = 'comum';
    if (diff >= 3 && r < Math.min(0.3, 0.05 * diff)) type = 'corredor';
    else if (diff >= 4 && r < Math.min(0.55, 0.3 + 0.04 * diff)) type = 'blindado';
    list.push(type);
  }
  // Um brutamonte a cada 3 hordas, e mais deles no fim do nível
  for (let i = 0; i < Math.floor(diff / 3); i++) list.push('brutamonte');
  Phaser.Utils.Array.Shuffle(list);

  return {
    zombies: list,
    hpMul: 1 + 0.15 * (diff - 1),
    // Intervalo entre zumbis diminui com a horda (ms)
    spawnDelay: Math.max(450, 1500 - diff * 70),
  };
}
