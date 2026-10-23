// Constantes globais do jogo
const GAME_W = 1280; // tamanho da tela
const GAME_H = 720;
const WORLD_W = 2400; // tamanho do mapa; a câmera segue o jogador
const WORLD_H = 1600;
const BASE_X = WORLD_W / 2; // a base fica no centro do mapa
const BASE_Y = WORLD_H / 2;
const BASE_W = 200;
const BASE_H = 150;
const HUD_H = 40; // faixa superior reservada para o HUD
const GRID = 40; // tamanho da célula de construção

// Paleta inspirada em Tim Burton: cores fortes com contorno escuro
const PALETTE = {
  outline: 0x1b1424,
  house: 0xb36ab8,
  roof: 0x3f2a4f,
  window: 0xffd86b,
  line: 0xe8453c,
  gun: 0x2b2b2b,
  bullet: 0xfff27a,
  zombie: 0x8fd16a,
  zombieShirt: 0x8c5a3c,
  blood: 0x6bd13a,
  metal: 0x9aa3ad,
  wood: 0xb07a45,
  acid: 0xb6f03c,
};

const PLAYER = {
  speed: 220,
  maxHp: 100,
  chaseRange: 180, // zumbis a esta distância largam a base e vêm atrás do jogador
  light: 170, // raio da lanterna à noite
};

// Personagens jogáveis: só mudam a aparência e um pouco de vida/velocidade
const CHARACTERS = [
  { id: 'jose', name: 'José Perdigueiro', desc: 'Equilibrado', skin: 0xf2c6a0, hair: 0x5a3a22, hat: 0xe07b2a, hp: 100, speed: 220 },
  { id: 'pedro', name: 'Pedro Pedra Preto', desc: 'Mais vida, mais lento', skin: 0x6b4423, hair: 0x1b1424, hat: null, hp: 130, speed: 200 },
  { id: 'jussara', name: 'Jussara Tais', desc: 'Mais rápida, menos vida', skin: 0xe0a98a, hair: 0xc0392b, hat: null, hp: 90, speed: 245 },
];
const OUTFITS = [0x3a8fb7, 0x6bd13a, 0xe8453c, 0xffd86b, 0x9b59b6, 0xf4ecff];

// Pets: comprados na loja. rate = ataques por segundo
const PETS = {
  cachorro: {
    name: 'Biscoito (cachorro)', tex: 'pet_cachorro', cost: 80, speed: 260, rate: 0.64, damage: 1.2,
    desc: 'Mordida com sangramento por 12 s', bleed: { time: 12, dps: 0.3 },
  },
  crocodilo: {
    name: 'Crocodilo', tex: 'pet_crocodilo', cost: 180, speed: 200, rate: 0.5, damage: 5,
    desc: 'Mordida devastadora; 15% de chance de camuflar você', camo: { chance: 0.15, time: 6 },
  },
  gato: {
    name: 'Gato', tex: 'pet_gato', cost: 100, speed: 320, rate: 0.91, damage: 0.8,
    desc: 'Arranha rápido e corre mais',
  },
  gaviao: {
    name: 'Gavião', tex: 'pet_gaviao', cost: 140, speed: 300, rate: 0.64, damage: 1,
    desc: 'Bicadas; sobrevoa o mapa e revela zumbis no escuro', scout: { every: 14, light: 230 },
  },
  coelho: {
    name: 'Coelho fofinho rosa', tex: 'pet_coelho', cost: 120, speed: 280, rate: 0.71, damage: 0.7,
    desc: 'Patadinhas; +20% de velocidade para você', speedBuff: 1.2,
  },
};
const PET_SIGHT = 200; // distância do jogador em que o pet procura zumbis

// Armas no estilo Killing Floor. Q troca entre as que você tem.
// pierce = quantos zumbis a bala atravessa; blast = raio da explosão; burn = segundos queimando
const WEAPONS = {
  pistola: { name: '9mm', cost: 0, fireDelay: 260, damage: 1, pellets: 1, spread: 0.04, speed: 700, desc: 'A de sempre' },
  mp7: { name: 'MP7', cost: 200, fireDelay: 80, damage: 0.7, pellets: 1, spread: 0.12, speed: 750, trail: 0.8, tint: 0xffe08a, desc: 'Submetralhadora rápida' },
  escopeta: { name: 'Escopeta', cost: 180, fireDelay: 700, damage: 1.2, pellets: 7, spread: 0.5, speed: 650, trail: 0.6, tint: 0xffb060, desc: '7 balas espalhadas' },
  handcannon: { name: 'Pistola .50', cost: 250, fireDelay: 450, damage: 4, pellets: 1, spread: 0.02, speed: 900, pierce: 1, trail: 1.8, tint: 0xfff4d0, desc: 'Atravessa 2 zumbis' },
  ak47: { name: 'AK-47', cost: 320, fireDelay: 110, damage: 1.3, pellets: 1, spread: 0.08, speed: 800, trail: 1.3, tint: 0xffd070, desc: 'Fuzil automático' },
  besta: { name: 'Besta', cost: 350, fireDelay: 900, damage: 10, pellets: 1, spread: 0, speed: 1000, pierce: 4, tex: 'bolt', desc: 'Virote que atravessa 5' },
  chamas: { name: 'Lança-chamas', cost: 400, fireDelay: 45, damage: 0.25, pellets: 1, spread: 0.35, speed: 380, life: 380, burn: 3, tex: 'flame', desc: 'Curto alcance, põe fogo' },
  m79: { name: 'M79', cost: 450, fireDelay: 1100, damage: 7, pellets: 1, spread: 0, speed: 550, blast: 90, tex: 'grenade', desc: 'Granada com explosão' },
  aa12: { name: 'AA-12', cost: 550, fireDelay: 210, damage: 1, pellets: 6, spread: 0.45, speed: 680, trail: 0.6, tint: 0xffa850, desc: 'Escopeta automática' },
};

const SHOP_ITEMS = [
  { id: 'kit', name: 'Kit médico', cost: 40, desc: 'Recupera toda a vida' },
  { id: 'colete', name: 'Colete', cost: 120, desc: '+50 de vida máxima' },
  { id: 'reparo', name: 'Caixa de ferramentas', cost: 150, desc: 'Conserta a base em 200' },
];

// Zumbis. dps = dano por segundo encostado; struct = multiplicador do dano em construções.
// from = horda a partir da qual aparece; weight = chance relativa na composição
const ZOMBIES = {
  comum: { name: 'Comum', tex: 'z_comum', hp: 3, speed: 38, reward: 4, dps: 15, radius: 14, struct: 1, from: 1, weight: 10 },
  corredor: { name: 'Corredor', tex: 'z_corredor', hp: 2, speed: 85, reward: 5, dps: 10, radius: 12, struct: 0.7, from: 2, weight: 4 },
  blindado: { name: 'Blindado', tex: 'z_blindado', hp: 9, speed: 30, reward: 10, dps: 20, radius: 15, struct: 1.2, from: 3, weight: 3 },
  brutamonte: { name: 'Brutamonte', tex: 'z_brutamonte', hp: 28, speed: 22, reward: 25, dps: 35, radius: 22, struct: 1.5, from: 4, weight: 1 },
  venenoso: { name: 'Venenoso', tex: 'z_venenoso', hp: 12, speed: 30, reward: 12, dps: 10, radius: 18, struct: 1, from: 5, weight: 1.2, aura: 45, auraDps: 8 },
  boomer: { name: 'Boomer', tex: 'z_boomer', hp: 10, speed: 28, reward: 14, dps: 8, radius: 20, struct: 0.8, from: 3, weight: 1, special: true },
  spitter: { name: 'Spitter', tex: 'z_spitter', hp: 7, speed: 40, reward: 15, dps: 8, radius: 14, struct: 1, from: 4, weight: 0.8, special: true },
  smoker: { name: 'Smoker', tex: 'z_smoker', hp: 8, speed: 42, reward: 15, dps: 8, radius: 14, struct: 0.8, from: 5, weight: 0.6, special: true },
  hunter: { name: 'Hunter', tex: 'z_hunter', hp: 7, speed: 70, reward: 15, dps: 8, radius: 13, struct: 0.6, from: 6, weight: 0.6, special: true },
  charger: { name: 'Charger', tex: 'z_charger', hp: 22, speed: 40, reward: 18, dps: 20, radius: 20, struct: 1.5, from: 7, weight: 0.5, special: true },
  jockey: { name: 'Jockey', tex: 'z_jockey', hp: 6, speed: 75, reward: 15, dps: 6, radius: 11, struct: 0.5, from: 8, weight: 0.5, special: true },
  tank: { name: 'Tank', tex: 'z_tank', hp: 200, speed: 40, reward: 100, dps: 45, radius: 30, struct: 1.2, from: 999, weight: 0, boss: true },
  witch: { name: 'Witch', tex: 'z_witch', hp: 40, speed: 215, reward: 150, dps: 80, radius: 14, struct: 0.5, from: 999, weight: 0 },
};

// Construções. hp = vida (zumbis atacam); costStep = quanto cada nova do mesmo tipo fica mais cara.
// light = raio de luz à noite; block = zumbis não passam por cima
const BUILDINGS = {
  torreta: {
    key: 'ONE', name: 'Sentinela', tex: 'turret_base', gunTex: 'turret_gun', cost: 70, costStep: 15, hp: 60,
    range: 220, fireDelay: 600, damage: 1, light: 70, block: true, upgradable: true,
  },
  tesla: {
    key: 'TWO', name: 'Tesla', tex: 'tesla', cost: 140, costStep: 25, hp: 50,
    range: 170, fireDelay: 1100, damage: 2, chain: 4, light: 90, block: true, upgradable: true,
  },
  chamas: {
    key: 'THREE', name: 'Lança-chamas', tex: 'flame_base', gunTex: 'flame_gun', cost: 120, costStep: 20, hp: 70,
    range: 120, fireDelay: 60, damage: 0.12, burn: 3, light: 80, block: true, upgradable: true,
  },
  barricada: { key: 'FOUR', name: 'Barricada', tex: 'barricade', cost: 20, costStep: 2, hp: 120, block: true },
  espinhos: { key: 'FIVE', name: 'Espinhos', tex: 'spikes', cost: 25, costStep: 3, dps: 2, slow: 0.45, durability: 25 },
  mina: { key: 'SIX', name: 'Mina', tex: 'mine', cost: 35, costStep: 3, damage: 12, blast: 85 },
  farol: { key: 'SEVEN', name: 'Farol', tex: 'floodlight', cost: 40, costStep: 10, hp: 40, light: 300, block: true },
};
const BUILD_ORDER = ['torreta', 'tesla', 'chamas', 'barricada', 'espinhos', 'mina', 'farol'];

// Upgrades no estilo Bloons TD: 3 linhas de 3 níveis; cada torre só pode evoluir 2 linhas
const UPGRADE_PATHS = [
  { name: 'Velocidade', desc: ['+25% cadência', '+25% cadência', '+40% cadência'], mul: [0.8, 0.8, 0.7] },
  { name: 'Dano', desc: ['+40% dano', '+40% dano', '+60% dano'], mul: [1.4, 1.4, 1.6] },
  { name: 'Utilidade', desc: ['+15% alcance', '+15% alcance e +50% vida', '+20% alcance e luz'], mul: [1.15, 1.15, 1.2] },
];
const UPGRADE_COST = [0.6, 0.9, 1.4]; // fração do custo base da torre
const SELL_RATE = 0.7;

// Cada nível tem cores e decoração próprias; os seguintes começam com hordas mais fortes
const LEVELS = [
  { name: 'Subúrbio', wavesToWin: 10, ground: 0x6f9a52, groundDark: 0x5a8343, street: 0x7a6f86, decor: 'tree', sky: 0x2d2140 },
  { name: 'Centro', wavesToWin: 10, ground: 0x8a8296, groundDark: 0x766d84, street: 0x4e475a, decor: 'lamp', sky: 0x1f2a3d },
  { name: 'Cemitério', wavesToWin: 10, ground: 0x4f6b5a, groundDark: 0x3f574a, street: 0x5c4f45, decor: 'tomb', sky: 0x15121f },
];

// Dificuldades no estilo Bloons TD
const DIFFICULTIES = [
  { id: 'facil', name: 'Fácil', hp: 0.75, count: 0.8, money: 1.25, baseHp: 800, color: '#8fd16a' },
  { id: 'medio', name: 'Médio', hp: 1, count: 1, money: 1, baseHp: 600, color: '#ffd86b' },
  { id: 'dificil', name: 'Difícil', hp: 1.2, count: 1.1, money: 0.9, baseHp: 500, color: '#f39c4a' },
  { id: 'impossivel', name: 'Impossível', hp: 1.5, count: 1.3, money: 0.85, baseHp: 450, color: '#e8453c' },
];

// Eventos aleatórios de horda (a partir da horda 3)
const EVENTS = {
  neblina: { name: 'Neblina', desc: 'Luzes enxergam menos' },
  chuva: { name: 'Chuva ácida', desc: 'Construções derretem aos poucos' },
  rapida: { name: 'Horda rápida', desc: 'Zumbis 40% mais rápidos' },
  apagao: { name: 'Apagão', desc: 'Teslas e faróis desligados' },
  dupla: { name: 'Horda dupla', desc: 'O dobro de zumbis, o dobro de dinheiro' },
};

const TITLE_FONT = '"Rubik Dirt", Impact, sans-serif';

const START_MONEY = 200;
const BASE_ARMOR = 0.3; // a base recebe só 30% do dano dos zumbis
const BASE_FIRE = { range: 260, fireDelay: 450, damage: 1 }; // a família atira pela janela
const INTERMISSION = 30; // segundos entre hordas
const EARLY_BONUS = 2; // dinheiro por segundo restante ao chamar a horda antes
