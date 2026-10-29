// Title screen: settings and help buttons, best run, captain pick and PLAY.

class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.road = this.add.tileSprite(W / 2, H / 2, W, H, 'road').setTint(0x9fb0aa);
    this.add.image(W / 2, 0, 'fog').setOrigin(0.5, 0);
    this.add.image(W / 2, 470, 'boss').setScale(0.7).setAlpha(0.18);

    uiIconButton(this, 60, 60, 'gear', () => openSettings(this));
    uiIconButton(this, W - 60, 60, 'help', () => openHelp(this));

    this.add.text(W / 2, 230, 'OVERCLOCK', textStyle(96, '#c8f1ff', {
      stroke: '#0b1412', strokeThickness: 10,
      shadow: { color: '#4fc3ff', blur: 24, fill: true, offsetX: 0, offsetY: 0 },
    })).setOrigin(0.5);
    this.add.text(W / 2, 318, 'Outrun the horde. Fire faster or fall.', textStyle(28, COLORS.textDim)).setOrigin(0.5);

    this.bestCard();

    this.add.text(W / 2, 640, 'CHOOSE YOUR CAPTAIN', textStyle(30, '#f2c14e')).setOrigin(0.5);
    this.selected = Store.get('captain', 'blitz');
    if (!HEROES[this.selected]) this.selected = 'blitz';
    this.cards = {};
    ['blitz', 'tank', 'surge'].forEach((key, i) => this.heroCard(HEROES[key], W / 2 + (i - 1) * 218, 820));
    this.refreshCards();

    uiButton(this, W / 2, 1070, 480, 124, 'PLAY', COLORS.gold, () => this.start(), { size: 56 });
    this.add.text(W / 2, 1200, 'v' + VERSION, textStyle(20, COLORS.textDim, { fontStyle: 'normal' })).setOrigin(0.5);

    this.input.keyboard.on('keydown-ONE', () => this.select('blitz'));
    this.input.keyboard.on('keydown-TWO', () => this.select('tank'));
    this.input.keyboard.on('keydown-THREE', () => this.select('surge'));
    this.input.keyboard.on('keydown-ENTER', () => this.start());
    this.input.keyboard.on('keydown-SPACE', () => this.start());

    if (!Store.get('seenHelp', false)) openHelp(this);
  }

  bestCard() {
    const best = Store.get('best', null);
    const g = this.add.graphics();
    g.fillStyle(0x13201c, 0.92);
    g.fillRoundedRect(W / 2 - 300, 380, 600, 150, 18);
    g.lineStyle(3, COLORS.gold, 0.8);
    g.strokeRoundedRect(W / 2 - 300, 380, 600, 150, 18);
    this.add.text(W / 2, 412, 'BEST RUN', textStyle(24, '#f2c14e')).setOrigin(0.5);
    if (!best) {
      this.add.text(W / 2, 470, 'No runs yet. How fast can you go?', textStyle(26, COLORS.text, { fontStyle: 'normal' })).setOrigin(0.5);
      return;
    }
    const stats = [['WAVE', String(best.wave)], ['FIRE RATE', 'x' + best.topSpeed.toFixed(1)], ['SCORE', String(best.score)]];
    stats.forEach((st, i) => {
      const x = W / 2 + (i - 1) * 190;
      this.add.text(x, 460, st[1], textStyle(36, i === 1 ? '#4fc3ff' : COLORS.text)).setOrigin(0.5);
      this.add.text(x, 500, st[0], textStyle(18, COLORS.textDim)).setOrigin(0.5);
    });
  }

  heroCard(hero, x, y) {
    const card = this.add.container(x, y);
    const bg = this.add.graphics();
    const icon = this.add.image(0, -40, hero.key === 'tank' ? 'champion' : 'knight').setScale(hero.key === 'tank' ? 0.6 : 0.75);
    const name = this.add.text(0, 66, hero.name, textStyle(30, '#c8f1ff')).setOrigin(0.5);
    const role = this.add.text(0, 100, hero.short, textStyle(20, COLORS.textDim, { fontStyle: 'normal' })).setOrigin(0.5);
    card.add([bg, icon, name, role]);
    card.setSize(200, 270);
    card.setInteractive({ useHandCursor: true });
    card.on('pointerup', () => {
      Sfx.resume();
      Sfx.click();
      this.select(hero.key);
    });
    card.bg = bg;
    this.cards[hero.key] = card;
    this.tweens.add({ targets: icon, y: -46, duration: 500 + Math.random() * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  refreshCards() {
    Object.keys(this.cards).forEach((key) => {
      const on = key === this.selected;
      const g = this.cards[key].bg;
      g.clear();
      g.fillStyle(on ? 0x1f3a33 : 0x13201c, 0.95);
      g.fillRoundedRect(-100, -135, 200, 270, 18);
      g.lineStyle(on ? 6 : 3, on ? COLORS.gold : COLORS.knight, on ? 1 : 0.5);
      g.strokeRoundedRect(-100, -135, 200, 270, 18);
      this.cards[key].setScale(on ? 1.04 : 1);
    });
  }

  select(key) {
    this.selected = key;
    Store.set('captain', key);
    this.refreshCards();
  }

  start() {
    Sfx.resume();
    this.scene.start('Game', { hero: this.selected });
  }

  update(time, delta) {
    this.road.tilePositionY -= delta * 0.12;
  }
}
