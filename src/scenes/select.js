// Wizard selection screen: pick one of three wizards before a run.
// The selected wizard is shown large on the 3D road; the others are
// smaller cards on either side.

class SelectScene extends Phaser.Scene {
  constructor() {
    super('Select');
  }

  create() {
    this.t = 0;
    this.selected = Store.get('wizard', 'blitz');
    if (!HEROES[this.selected]) this.selected = 'blitz';

    World3D.setActive(World3D.ready);
    this.events.once('shutdown', () => World3D.setActive(false));
    if (!World3D.active) {
      this.road = this.add.tileSprite(W / 2, H / 2, W, H, 'road').setTint(0x9fb0aa);
    }

    // Dark gradient over the bottom half for readability.
    const shade = this.add.graphics();
    for (let i = 0; i < 40; i++) {
      shade.fillStyle(0x050a09, (i / 40) * 0.82);
      shade.fillRect(0, H - 820 + i * 20.5, W, 21);
    }

    // Header
    this.add.text(W / 2, 52, 'CHOOSE YOUR WIZARD', textStyle(42, '#f2c14e')).setOrigin(0.5);

    // Back button
    uiButton(this, 80, 52, 100, 56, 'BACK', 0x2c3a37, () => {
      Sfx.resume();
      this.scene.start('Title');
    }, { size: 22 });

    this.buildCards();
    this.buildInfoPanel();
    this.buildPlayButton();

    this.input.keyboard.on('keydown-ONE', () => this.select('blitz'));
    this.input.keyboard.on('keydown-TWO', () => this.select('tank'));
    this.input.keyboard.on('keydown-THREE', () => this.select('surge'));
    this.input.keyboard.on('keydown-ENTER', () => this.play());
    this.input.keyboard.on('keydown-SPACE', () => this.play());
  }

  buildCards() {
    const keys = ['blitz', 'tank', 'surge'];
    const cardY = 560;
    this.cards = {};

    keys.forEach((key, i) => {
      const hero = HEROES[key];
      const cx = W / 2 + (i - 1) * 220;
      const c = this.add.container(cx, cardY);

      // Card background
      const bg = this.add.graphics();
      c.add(bg);

      // Portrait
      const portrait = key === 'tank' ? 'portrait_champion' : 'portrait_knight';
      const img = this.add.image(0, -20, portrait).setDisplaySize(140, 140);
      if (key === 'surge') img.setTint(0x9fe8ff);
      c.add(img);

      // Name
      const name = this.add.text(0, 56, hero.name, textStyle(28, '#ffffff')).setOrigin(0.5);
      c.add(name);

      // Short description
      const short = this.add.text(0, 84, hero.short, textStyle(16, COLORS.textDim, { strokeThickness: 3 })).setOrigin(0.5);
      c.add(short);

      c.setSize(200, 220);
      c.setInteractive({ useHandCursor: true });
      c.on('pointerup', () => {
        Sfx.resume();
        Sfx.click();
        this.select(key);
      });

      c.bg = bg;
      c.img = img;
      this.cards[key] = c;
    });

    this.refreshCards();
  }

  refreshCards() {
    Object.keys(this.cards).forEach((key) => {
      const on = key === this.selected;
      const c = this.cards[key];
      const g = c.bg;
      g.clear();

      // Outer frame
      g.fillStyle(0x0a0f0e, 1);
      g.fillRoundedRect(-96, -104, 192, 220, 16);

      // Inner fill: gold for selected, dark for others
      g.fillStyle(on ? COLORS.gold : 0x2c3a37, 1);
      g.fillRoundedRect(-92, -100, 184, 212, 14);

      // Portrait background
      g.fillStyle(0x0a0f0e, 1);
      g.fillRoundedRect(-76, -94, 152, 152, 10);

      c.setScale(on ? 1.08 : 0.92);
      c.setAlpha(on ? 1 : 0.65);
    });
  }

  buildInfoPanel() {
    // Info panel below the cards showing the selected wizard's details.
    const py = 740;
    this.infoPanel = this.add.graphics();
    this.infoPanel.fillStyle(0x0a0f0e, 0.7);
    this.infoPanel.fillRoundedRect(40, py - 20, W - 80, 260, 18);
    this.infoPanel.lineStyle(2, 0xffffff, 0.15);
    this.infoPanel.strokeRoundedRect(40, py - 20, W - 80, 260, 18);

    this.infoName = this.add.text(W / 2, py + 10, '', textStyle(48, '#ffffff')).setOrigin(0.5);
    this.infoRole = this.add.text(W / 2, py + 60, '', textStyle(22, COLORS.text, { strokeThickness: 4, wordWrap: { width: W - 120 } })).setOrigin(0.5);

    // Stat bars
    this.statLabels = [];
    this.statBars = [];
    const stats = [
      { label: 'CAST SPEED', key: 'interval', invert: true },
      { label: 'SPELL DAMAGE', key: 'damage', invert: false },
      { label: 'TOUGHNESS', key: 'hitLoss', invert: true },
    ];

    stats.forEach((stat, i) => {
      const sy = py + 108 + i * 44;
      const lbl = this.add.text(70, sy, stat.label, textStyle(18, COLORS.textDim, { strokeThickness: 3 })).setOrigin(0, 0.5);
      this.statLabels.push(lbl);

      const barBg = this.add.graphics();
      barBg.fillStyle(0x1b1f1e, 1);
      barBg.fillRoundedRect(280, sy - 10, 340, 20, 6);

      const bar = this.add.graphics();
      this.statBars.push({ bar, stat, y: sy });
    });

    this.refreshInfo();
  }

  refreshInfo() {
    const hero = HEROES[this.selected];
    this.infoName.setText(hero.name);
    this.infoRole.setText(hero.role.toUpperCase());

    // Stat values normalized to 0-1 range across heroes
    const allHeroes = Object.values(HEROES);
    const stats = [
      { key: 'interval', invert: true },
      { key: 'damage', invert: false },
      { key: 'hitLoss', invert: true },
    ];

    stats.forEach((stat, i) => {
      const vals = allHeroes.map((h) => h[stat.key]);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      let ratio = max === min ? 1 : (hero[stat.key] - min) / (max - min);
      if (stat.invert) ratio = 1 - ratio;
      ratio = Math.max(0.15, ratio);

      const { bar, y } = this.statBars[i];
      bar.clear();
      const barColor = ratio > 0.7 ? COLORS.speedGate : ratio > 0.4 ? COLORS.gold : COLORS.ember;
      bar.fillStyle(barColor, 1);
      bar.fillRoundedRect(280, y - 10, Math.max(20, 340 * ratio), 20, 6);
    });
  }

  buildPlayButton() {
    this.playBtn = uiButton(this, W / 2, H - 100, 420, 110, 'PLAY', 0x5fd35a, () => this.play(), { size: 56 });
    this.tweens.add({ targets: this.playBtn, scale: 1.04, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  select(key) {
    if (this.selected === key) return;
    this.selected = key;
    Store.set('wizard', key);
    this.refreshCards();
    this.refreshInfo();
    // Update 3D showcase
    if (this.show3d) {
      this.show3d.forEach((m) => { if (m) World3D.release(m); });
      this.show3d = null;
    }
  }

  play() {
    Sfx.resume();
    this.scene.start('Game', { hero: this.selected });
  }

  update(time, delta) {
    this.t += delta / 1000;
    if (World3D.active) World3D.showcase(this, this.t, this.selected);
    else if (this.road) this.road.tilePositionY -= delta * 0.12;
  }
}
