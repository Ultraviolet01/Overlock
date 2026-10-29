// Title screen: name, how to play, and a hero pick that starts the run.

class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.road = this.add.tileSprite(W / 2, H / 2, W, H, 'road').setTint(0x9fb0aa);
    this.add.image(W / 2, 0, 'fog').setOrigin(0.5, 0);

    this.add.text(W / 2, 190, 'OVERCLOCK', textStyle(92, '#c8f1ff', {
      stroke: '#0b1412', strokeThickness: 10,
      shadow: { color: '#4fc3ff', blur: 24, fill: true, offsetX: 0, offsetY: 0 },
    })).setOrigin(0.5);
    this.add.text(W / 2, 278, 'Outrun the horde. Fire faster or fall.', textStyle(28, COLORS.textDim)).setOrigin(0.5);

    const lines = [
      'Drag to steer your cursed knights',
      'Walk through cards to grow or shrink the squad',
      'Shoot the cards to raise their number',
      'Every kill speeds your fire rate. Every bite slows it.',
    ];
    lines.forEach((l, i) => {
      this.add.text(W / 2, 370 + i * 44, l, textStyle(24, COLORS.text, { fontStyle: 'normal' })).setOrigin(0.5);
    });

    this.add.text(W / 2, 600, 'CHOOSE YOUR CAPTAIN', textStyle(30, '#f2c14e')).setOrigin(0.5);
    ['blitz', 'tank', 'surge'].forEach((key, i) => this.heroCard(HEROES[key], 700 + i * 150));

    const best = Store.get('best', null);
    if (best) {
      this.add.text(W / 2, 1180, `Best: wave ${best.wave}  |  fire rate x${best.topSpeed.toFixed(1)}  |  ${best.score} pts`,
        textStyle(22, COLORS.textDim, { fontStyle: 'normal' })).setOrigin(0.5);
    }

    this.muteText = this.add.text(W - 24, 24, '', textStyle(24, COLORS.textDim)).setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    this.refreshMute();
    this.muteText.on('pointerdown', () => {
      Sfx.resume();
      Sfx.toggleMute();
      this.refreshMute();
    });

    this.input.keyboard.on('keydown-ONE', () => this.start('blitz'));
    this.input.keyboard.on('keydown-TWO', () => this.start('tank'));
    this.input.keyboard.on('keydown-THREE', () => this.start('surge'));
  }

  refreshMute() {
    this.muteText.setText(Store.get('muted', false) ? 'SOUND OFF' : 'SOUND ON');
  }

  heroCard(hero, y) {
    const card = this.add.container(W / 2, y);
    const bg = this.add.graphics();
    bg.fillStyle(0x13201c, 0.92);
    bg.fillRoundedRect(-300, -60, 600, 120, 16);
    bg.lineStyle(3, COLORS.knight, 0.8);
    bg.strokeRoundedRect(-300, -60, 600, 120, 16);
    const icon = this.add.image(-240, 0, hero.key === 'tank' ? 'champion' : 'knight').setScale(hero.key === 'tank' ? 0.45 : 0.5);
    const name = this.add.text(-180, -30, hero.name, textStyle(36, '#c8f1ff'));
    const role = this.add.text(-180, 14, hero.role, textStyle(22, COLORS.textDim, { fontStyle: 'normal' }));
    card.add([bg, icon, name, role]);
    card.setSize(600, 120);
    card.setInteractive({ useHandCursor: true });
    card.on('pointerdown', () => this.start(hero.key));
    this.tweens.add({ targets: icon, y: -4, duration: 500 + Math.random() * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  start(heroKey) {
    Sfx.resume();
    this.scene.start('Game', { hero: heroKey });
  }

  update(time, delta) {
    this.road.tilePositionY -= delta * 0.12;
  }
}
