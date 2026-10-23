class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    makeTextures(this);
    // Espera a fonte do título carregar (no máximo 2s) para o texto não aparecer com a fonte reserva
    const font = document.fonts ? document.fonts.load('48px "Creepster"') : Promise.resolve();
    const timeout = new Promise((r) => setTimeout(r, 2000));
    Promise.race([font, timeout]).catch(() => {}).then(() => this.scene.start('Menu'));
  }
}
