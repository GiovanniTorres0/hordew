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

function unlockedLevels() {
  return storageGet('hordew_niveis', 1);
}

function unlockLevel(index) {
  if (index + 1 > unlockedLevels()) storageSet('hordew_niveis', index + 1);
}

// Recorde codificado como nível * 100 + horda
function recordText(record) {
  if (!record) return 'Recorde: nenhum';
  const lv = LEVELS[Math.floor(record / 100)] || LEVELS[0];
  return `Recorde: ${lv.name}, horda ${record % 100}`;
}
