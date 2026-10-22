// Constantes globais do jogo
const GAME_W = 1280;
const GAME_H = 720;

// A casa fica à esquerda; se um zumbi cruzar esta linha, o jogador perde
const HOUSE_W = 170;
const FINAL_LINE_X = 200;
const HUD_H = 40; // faixa superior reservada para o HUD
const GRID = 40; // tamanho da célula de construção

// Paleta inspirada em Tim Burton: cores fortes com contorno escuro
const PALETTE = {
  outline: 0x1b1424,
  ground: 0x5b7f4a,
  groundDark: 0x4a6b3c,
  street: 0x6e6577,
  house: 0xb36ab8,
  roof: 0x3f2a4f,
  window: 0xffd86b,
  line: 0xe8453c,
  player: 0xf2c6a0,
  shirt: 0x3a8fb7,
  gun: 0x2b2b2b,
  bullet: 0xfff27a,
  zombie: 0x8fd16a,
  zombieShirt: 0x8c5a3c,
  blood: 0x6bd13a,
  metal: 0x9aa3ad,
  wood: 0xb07a45,
  dog: 0xc98b4f,
};

const PLAYER = {
  speed: 220,
  maxHp: 100,
  bulletSpeed: 700,
};

// Cachorro companheiro: persegue zumbis perto do jogador
const DOG = { speed: 260, sight: 190, dps: 3 };

// Armas do jogador: a loja troca a arma atual
const WEAPONS = {
  pistola: { name: 'Pistola', fireDelay: 260, damage: 1, pellets: 1, spread: 0.04 },
  metralhadora: { name: 'Metralhadora', fireDelay: 90, damage: 1, pellets: 1, spread: 0.1 },
  escopeta: { name: 'Escopeta', fireDelay: 650, damage: 1.2, pellets: 6, spread: 0.45 },
};

// Tipos de zumbi: hp e velocidade base (px/s), dinheiro ao morrer, dano no jogador (por segundo)
const ZOMBIES = {
  comum: { tex: 'z_comum', hp: 3, speed: 38, reward: 5, dps: 15, radius: 14 },
  corredor: { tex: 'z_corredor', hp: 2, speed: 80, reward: 6, dps: 10, radius: 12 },
  blindado: { tex: 'z_blindado', hp: 9, speed: 30, reward: 12, dps: 20, radius: 15 },
  brutamonte: { tex: 'z_brutamonte', hp: 28, speed: 20, reward: 30, dps: 35, radius: 22 },
};

const BUILDINGS = {
  torreta: { name: 'Torreta', cost: 60, costStep: 10, range: 230, fireDelay: 550, damage: 1 },
  espinhos: { name: 'Espinhos', cost: 25, dps: 2, slow: 0.45, durability: 25 },
};

const SHOP_ITEMS = [
  { id: 'metralhadora', name: 'Metralhadora', cost: 220, desc: 'Atira muito rápido' },
  { id: 'escopeta', name: 'Escopeta', cost: 180, desc: '6 balas espalhadas' },
  { id: 'colete', name: 'Colete', cost: 120, desc: '+50 de vida máxima' },
  { id: 'kit', name: 'Kit médico', cost: 40, desc: 'Recupera toda a vida' },
  { id: 'municao', name: 'Bala reforçada', cost: 150, desc: '+50% de dano' },
];

// Cada nível tem cores e decoração próprias; os seguintes começam com hordas mais fortes
const LEVELS = [
  { name: 'Subúrbio', wavesToWin: 10, ground: 0x6f9a52, groundDark: 0x5a8343, street: 0x7a6f86, decor: 'tree', sky: 0x2d2140 },
  { name: 'Centro', wavesToWin: 10, ground: 0x8a8296, groundDark: 0x766d84, street: 0x4e475a, decor: 'lamp', sky: 0x1f2a3d },
  { name: 'Cemitério', wavesToWin: 10, ground: 0x4f6b5a, groundDark: 0x3f574a, street: 0x5c4f45, decor: 'tomb', sky: 0x15121f },
];

const TITLE_FONT = '"Creepster", "Trebuchet MS", sans-serif';

const START_MONEY = 120;
