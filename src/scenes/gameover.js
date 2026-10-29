// End of run: stats, best run, and buttons to go again.

class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  init(data) {
    this.result = data;
  }

  create() {
    const r = this.result;
    this.add.tileSprite(W / 2, H / 2, W, H, 'road').setTint(0x5f6f6a);
    this.add.rectangle(W / 2, H / 2, W, H, COLORS.bg, 0.55);

    const prev = Store.get('best', null);
    const isBest = !prev || r.score > prev.score;
    if (isBest) Store.set('best', { wave: r.wave, topSpeed: r.topSpeed, score: r.score, maxSquad: r.maxSquad });

    this.add.text(W / 2, 220, 'THE HORDE CAUGHT YOU', textStyle(52, '#e0413a', { stroke: '#0b1412', strokeThickness: 8 })).setOrigin(0.5);
    if (isBest) {
      const nb = this.add.text(W / 2, 300, 'NEW BEST RUN', textStyle(34, '#f2c14e')).setOrigin(0.5);
      this.tweens.add({ targets: nb, scale: 1.12, duration: 420, yoyo: true, repeat: -1 });
    }

    const rows = [
      ['Wave reached', String(r.wave)],
      ['Top fire rate', 'x' + r.topSpeed.toFixed(1)],
      ['Biggest squad', String(r.maxSquad)],
      ['Horde slain', String(r.kills)],
      ['Bosses felled', String(r.bosses)],
      ['Score', String(r.score)],
    ];
    rows.forEach((row, i) => {
      const y = 420 + i * 72;
      this.add.text(150, y, row[0], textStyle(32, COLORS.textDim, { fontStyle: 'normal' })).setOrigin(0, 0.5);
      this.add.text(W - 150, y, row[1], textStyle(40, i === 1 ? '#4fc3ff' : COLORS.text)).setOrigin(1, 0.5);
    });

    if (prev && !isBest) {
      this.add.text(W / 2, 880, `Best: ${prev.score} pts, wave ${prev.wave}`, textStyle(24, COLORS.textDim, { fontStyle: 'normal' })).setOrigin(0.5);
    }

    this.button(W / 2, 990, 'RUN AGAIN', COLORS.knight, () => this.scene.start('Game', { hero: r.hero }));
    this.button(W / 2, 1120, 'CHANGE CAPTAIN', 0x8fa8a0, () => this.scene.start('Title'));

    this.input.keyboard.once('keydown-SPACE', () => this.scene.start('Game', { hero: r.hero }));
  }

  button(x, y, label, color, onTap) {
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(0x13201c, 0.95);
    bg.fillRoundedRect(-230, -48, 460, 96, 18);
    bg.lineStyle(4, color, 1);
    bg.strokeRoundedRect(-230, -48, 460, 96, 18);
    const t = this.add.text(0, 0, label, textStyle(36, COLORS.text)).setOrigin(0.5);
    c.add([bg, t]);
    c.setSize(460, 96);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      Sfx.resume();
      onTap();
    });
  }
}
