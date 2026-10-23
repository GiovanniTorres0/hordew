class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // Sprites desenhados (lista em src/sprites.js); o que faltar é desenhado por código em makeTextures
    // Quem tem ANIM_FRAMES vem como folha de quadros (parado, passada, passada contrária, ataque)
    const load = (key, file, k) => (ANIM_FRAMES[k]
      ? this.load.spritesheet(key, file, { frameWidth: ANIM_FRAMES[k][0], frameHeight: ANIM_FRAMES[k][1] })
      : this.load.image(key, file));
    SPRITE_KEYS.forEach((k) => load(k, `assets/sprites/${k}.png`, k));
    ROUPA_KEYS.forEach((k) => load(`${k}_roupa`, `assets/sprites/${k}_roupa.png`, k));
  }

  create() {
    makeTextures(this);
    Object.keys(ANIM_FRAMES).forEach((k) => makeAnims(this, k));
    // Espera a fonte do título carregar (no máximo 2s) para o texto não aparecer com a fonte reserva
    const font = document.fonts ? document.fonts.load('48px "Creepster"') : Promise.resolve();
    const timeout = new Promise((r) => setTimeout(r, 2000));
    Promise.race([font, timeout]).catch(() => {}).then(() => this.scene.start('Menu'));
  }
}
