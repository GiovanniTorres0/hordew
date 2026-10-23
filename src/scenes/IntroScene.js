// Introdução da história em quadros; clique ou Espaço avança, Esc pula
const STORY = [
  'Era uma terça-feira comum. Aí os mortos levantaram.\nTerças-feiras nunca prestaram.',
  'José Perdigueiro perdeu a família para a horda.\nSobrou o Biscoito, um cachorro que nunca respeitou ninguém, vivo ou morto.',
  'Na fuga, os dois acharam uma família escondida numa casa roxa.\nJosé prometeu: desta vez, ninguém fica para trás.',
  'O rádio avisa que o resgate vem de helicóptero.\nÉ só aguentar mais um pouco. Umas trinta hordas. Coisa pouca.',
];

class IntroScene extends Phaser.Scene {
  constructor() {
    super('Intro');
  }

  init(data) {
    this.next = data ? data.next : null;
    this.page = 0;
  }

  create() {
    this.add.rectangle(0, 0, GAME_W, GAME_H, LEVELS[2].sky).setOrigin(0);
    const moon = this.add.graphics();
    moon.fillStyle(0xf4ecff).fillCircle(1040, 150, 70);
    moon.lineStyle(3, 0xc9b8d9);
    spiral(moon, 1040, 150, 55, 3);
    [[150, 700], [330, 690], [900, 705], [1150, 700]].forEach(([x, y], i) =>
      this.add.image(x, y, i % 2 ? 'tomb' : 'tree').setOrigin(0.5, 1).setScale(1.6).setAngle(i % 2 ? 10 : -6));
    this.add.image(560, 640, 'pet_cachorro').setScale(2.2);
    this.add.image(640, 640, 'char_jose').setScale(2.2);

    this.text = this.add.text(GAME_W / 2, 300, '', {
      fontFamily: FONT, fontSize: '30px', color: '#f4ecff', align: 'center', lineSpacing: 14,
      stroke: '#1b1424', strokeThickness: 6, wordWrap: { width: 1000 },
    }).setOrigin(0.5);
    this.hint = this.add.text(GAME_W / 2, 520, '', { fontFamily: FONT, fontSize: '18px', color: '#c9b8d9' }).setOrigin(0.5);
    this.show();

    this.input.on('pointerdown', () => this.advance());
    this.input.keyboard.on('keydown-SPACE', () => this.advance());
    this.input.keyboard.on('keydown-ENTER', () => this.advance());
    this.input.keyboard.on('keydown-ESC', () => this.finish());
  }

  show() {
    this.text.setText(STORY[this.page]).setAlpha(0);
    this.tweens.add({ targets: this.text, alpha: 1, duration: 500 });
    this.hint.setText(`${this.page + 1}/${STORY.length} · clique ou Espaço para continuar · Esc para pular`);
  }

  advance() {
    this.page += 1;
    if (this.page >= STORY.length) this.finish();
    else this.show();
  }

  finish() {
    if (this.next === null) this.scene.start('Menu');
    else this.scene.start('Game', this.next);
  }
}
