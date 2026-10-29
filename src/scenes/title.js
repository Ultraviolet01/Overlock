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

    // Logo: icy-blue gradient letters with a heavy outline, like Last War's captions.
    const logo = this.add.text(W / 2, 228, 'OVERCLOCK', textStyle(108, '#ffffff', {
      fontStyle: 'italic', strokeThickness: 16, shadow: { offsetX: 0, offsetY: 9, color: '#000000', blur: 0, fill: true, stroke: true },
    })).setOrigin(0.5);
    const grd = logo.context.createLinearGradient(0, 0, 0, logo.height);
    grd.addColorStop(0.15, '#ffffff');
    grd.addColorStop(0.5, '#9fdcff');
    grd.addColorStop(0.9, '#2f86d6');
    logo.setFill(grd);
    this.add.text(W / 2, 320, 'OUTRUN THE HORDE. FIRE FASTER OR FALL.', textStyle(26, '#f2c14e')).setOrigin(0.5);

    this.bestCard();

    this.add.text(W / 2, 640, 'CHOOSE YOUR CAPTAIN', textStyle(34, '#ffffff')).setOrigin(0.5);
    this.selected = Store.get('captain', 'blitz');
    if (!HEROES[this.selected]) this.selected = 'blitz';
    this.cards = {};
    ['blitz', 'tank', 'surge'].forEach((key, i) => this.heroCard(HEROES[key], W / 2 + (i - 1) * 218, 820));
    this.refreshCards();

    uiButton(this, W / 2, 1070, 480, 128, 'PLAY', 0x5fd35a, () => this.start(), { size: 64 });
    this.add.text(W / 2, 1206, 'v' + VERSION, textStyle(18, '#9fb3ad', { strokeThickness: 3 })).setOrigin(0.5);

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
    g.fillStyle(0x000000, 0.55);
    g.fillRoundedRect(W / 2 - 300, 380, 600, 150, 14);
    g.lineStyle(3, 0xffffff, 0.3);
    g.strokeRoundedRect(W / 2 - 300, 380, 600, 150, 14);
    this.add.text(W / 2, 410, 'BEST RUN', textStyle(24, '#f2c14e')).setOrigin(0.5);
    if (!best) {
      this.add.text(W / 2, 470, 'NO RUNS YET. HOW FAST CAN YOU GO?', textStyle(26, '#ffffff')).setOrigin(0.5);
      return;
    }
    const stats = [['WAVE', String(best.wave)], ['FIRE RATE', 'x' + best.topSpeed.toFixed(1)], ['SCORE', String(best.score)]];
    stats.forEach((st, i) => {
      const x = W / 2 + (i - 1) * 190;
      this.add.text(x, 458, st[1], textStyle(42, i === 1 ? '#7fd3ff' : '#ffffff', { fontStyle: 'italic' })).setOrigin(0.5);
      this.add.text(x, 502, st[0], textStyle(18, '#c9d6d2', { strokeThickness: 4 })).setOrigin(0.5);
    });
  }

  heroCard(hero, x, y) {
    const card = this.add.container(x, y);
    const bg = this.add.graphics();
    const portrait = this.add.image(0, -42, hero.key === 'tank' ? 'portrait_champion' : 'portrait_knight').setDisplaySize(150, 150);
    const icon = this.add.image(0, -42, 'flash').setVisible(false);
    const name = this.add.text(0, 62, hero.name, textStyle(32, '#ffffff')).setOrigin(0.5);
    const role = this.add.text(0, 100, hero.short.toUpperCase(), textStyle(18, '#f2c14e', { strokeThickness: 4 })).setOrigin(0.5);
    card.add([bg, portrait, icon, name, role]);
    card.setSize(200, 270);
    card.setInteractive({ useHandCursor: true });
    card.on('pointerup', () => {
      Sfx.resume();
      Sfx.click();
      this.select(hero.key);
    });
    card.bg = bg;
    this.cards[hero.key] = card;
  }

  refreshCards() {
    Object.keys(this.cards).forEach((key) => {
      const on = key === this.selected;
      const g = this.cards[key].bg;
      g.clear();
      g.fillStyle(0x0a0f0e, 1);
      g.fillRoundedRect(-104, -139, 208, 278, 18);
      g.fillStyle(on ? COLORS.gold : PANEL_TRIM, 1);
      g.fillRoundedRect(-100, -135, 200, 270, 16);
      g.fillStyle(0x16211f, 1);
      g.fillRoundedRect(-92, 16, 184, 110, 10);
      g.fillStyle(0x0a0f0e, 1);
      g.fillRoundedRect(-79, -121, 158, 158, 10);
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
