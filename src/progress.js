// Progresso salvo no navegador. O acesso ao localStorage pode falhar (aba privada), então tudo tem try/catch.
function storageGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : Number(v);
  } catch (e) {
    return fallback;
  }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, String(value)); } catch (e) { /* sem salvamento */ }
}

function storageGetJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch (e) {
    return fallback;
  }
}

function storageSetJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* sem salvamento */ }
}

function unlockedLevels() {
  return storageGet('hordew_niveis', 1);
}

function unlockLevel(index) {
  if (index + 1 > unlockedLevels()) storageSet('hordew_niveis', index + 1);
}

// Medalhas: dificuldades vencidas em cada nível, ex.: { "0": ["facil", "medio"] }
function medals(levelIndex) {
  return storageGetJSON('hordew_medalhas', {})[levelIndex] || [];
}

function addMedal(levelIndex, difficultyId) {
  const all = storageGetJSON('hordew_medalhas', {});
  const list = all[levelIndex] || [];
  if (!list.includes(difficultyId)) list.push(difficultyId);
  all[levelIndex] = list;
  storageSetJSON('hordew_medalhas', all);
}

// O modo infinito de um nível abre depois de vencê-lo em qualquer dificuldade
function infiniteUnlocked(levelIndex) {
  return medals(levelIndex).length > 0;
}

// Maior horda alcançada no modo infinito de cada nível
function infiniteRecord(levelIndex) {
  return storageGetJSON('hordew_infinito', {})[levelIndex] || 0;
}

function saveInfiniteRecord(levelIndex, wave) {
  const all = storageGetJSON('hordew_infinito', {});
  if (wave > (all[levelIndex] || 0)) all[levelIndex] = wave;
  storageSetJSON('hordew_infinito', all);
  return all[levelIndex];
}
