// Home screen, laid out like Last War's: the live 3D road behind everything
// with the squad marching on it and the airship hovering above, a player
// cluster in the top-left corner, small icon buttons top-right, the logo, a
// big START button, and the captain picker along the bottom.

class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.t = 0;
    this.selected = Store.get('captain', 'blitz');
    if (!HEROES[this.selected]) this.selected = 'blitz';

    World3D.setActive(World3D.ready);
    this.events.once('shutdown', () => World3D.setActive(false));
    if (!World3D.active) {
      // 2D fallback backdrop.
      this.road = this.add.tileSprite(W / 2, H / 2, W, H, 'road').setTint(0x9fb0aa);
    }
    this.add.image(W / 2, 0, 'fog').setOrigin(0.5, 0).setScale(1, 1.1);
    const shade = this.add.graphics();
    for (let i = 0; i < 30; i++) {
      shade.fillStyle(0x050a09, (i / 30) * 0.75);
      shade.fillRect(0, H - 330 + i * 11, W, 11);
    }

    this.airship = this.add.image(W / 2, 488, 'airship').setScale(0.62);
    this.drawPlayerCluster();
    uiIconButton(this, W - 52, 54, 'gear', () => openSettings(this), 72);
    uiIconButton(this, W - 52, 140, 'help', () => openHelp(this), 72);

    // Logo: icy-blue gradient letters with a heavy outline.
    const logo = this.add.text(W / 2, 250, 'OVERCLOCK', textStyle(104, '#ffffff', {
      fontStyle: 'italic', strokeThickness: 16, shadow: { offsetX: 0, offsetY: 9, color: '#000000', blur: 0, fill: true, stroke: true },
    })).setOrigin(0.5);
    const grd = logo.context.createLinearGradient(0, 0, 0, logo.height);
    grd.addColorStop(0.15, '#ffffff');
    grd.addColorStop(0.5, '#9fdcff');
    grd.addColorStop(0.9, '#2f86d6');
    logo.setFill(grd);
    this.add.text(W / 2, 330, 'FIRE FASTER OR FALL', textStyle(28, '#f2c14e', { fontStyle: 'italic' })).setOrigin(0.5);

    this.startBtn = uiButton(this, W / 2, 640, 380, 118, 'START', BTN_BLUE, () => this.start(), { size: 60 });
    this.tweens.add({ targets: this.startBtn, scale: 1.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.drawCaptainPicker();
    this.add.text(W / 2, H - 22, 'v' + VERSION, textStyle(16, '#9fb3ad', { strokeThickness: 3 })).setOrigin(0.5);

    this.input.keyboard.on('keydown-ONE', () => this.select('blitz'));
    this.input.keyboard.on('keydown-TWO', () => this.select('tank'));
    this.input.keyboard.on('keydown-THREE', () => this.select('surge'));
    this.input.keyboard.on('keydown-ENTER', () => this.start());
    this.input.keyboard.on('keydown-SPACE', () => this.start());

    if (!Store.get('seenHelp', false)) openHelp(this);
  }

  // Top-left, like Last War's: captain portrait with a level-style badge
  // (best wave), a fire-rate bar like their stamina bar, and slim strips.
  drawPlayerCluster() {
    const best = Store.get('best', null) || { wave: 0, topSpeed: 1, score: 0 };
    const px = 18;
    const py = 18;
    const ps = 104;
    const frame = this.add.graphics();
    frame.fillStyle(0x0a0f0e, 1);
    frame.fillRoundedRect(px - 5, py - 5, ps + 10, ps + 10, 14);
    frame.fillStyle(PANEL_TRIM, 1);
    frame.fillRoundedRect(px - 2, py - 2, ps + 4, ps + 4, 12);
    this.portrait = this.add.image(px + ps / 2, py + ps / 2, 'portrait_knight').setDisplaySize(ps - 4, ps - 4);
    const badge = this.add.graphics();
    badge.fillStyle(0x0a0f0e, 0.95);
    badge.fillRoundedRect(px - 5, py + ps - 34, 58, 40, 8);
    this.add.text(px + 24, py + ps - 14, String(best.wave), textStyle(30, '#ffffff')).setOrigin(0.5);

    // Best fire rate as a bar under the portrait.
    const by = py + ps + 12;
    const ratio = clamp((best.topSpeed - 1) / (TUNING.maxSpeed - 1), 0, 1);
    const bar = this.add.graphics();
    bar.fillStyle(0x0a0f0e, 1);
    bar.fillRoundedRect(px - 4, by - 3, ps + 8, 26, 8);
    bar.fillStyle(0x1b1f1e, 1);
    bar.fillRoundedRect(px - 1, by, ps + 2, 20, 6);
    bar.fillStyle(COLORS.ember, 1);
    bar.fillRoundedRect(px - 1, by, Math.max(10, (ps + 2) * ratio), 20, 6);
    this.add.image(px + 4, by + 10, 'icon_flame').setScale(0.5);
    this.add.text(px + ps / 2 + 8, by + 10, 'x' + best.topSpeed.toFixed(1), textStyle(16, '#ffffff', { strokeThickness: 3 })).setOrigin(0.5);

    const sx = px + ps + 8;
    uiStrip(this, sx, py + 24, 'icon_score', 0.8, 28).set(best.score ? best.score.toLocaleString('en-US') : '0');
    uiStrip(this, sx, py + 74, 'skull', 0.85, 22, '#c9d6d2').set(best.wave ? 'BEST WAVE ' + best.wave : 'NO RUNS YET');
  }

  // Bottom strip: three captain tiles; the chosen one is framed in gold and
  // leads the squad on the road.
  drawCaptainPicker() {
    const top = H - 300;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(20, top, W - 40, 262, 18);
    g.lineStyle(2, 0xffffff, 0.2);
    g.strokeRoundedRect(20, top, W - 40, 262, 18);
    this.add.text(W / 2, top - 4, 'CAPTAIN', textStyle(26, '#f2c14e')).setOrigin(0.5);
    this.roleText = this.add.text(W / 2, top + 238, '', textStyle(20, '#ffffff', { strokeThickness: 4 })).setOrigin(0.5);
    this.tiles = {};
    ['blitz', 'tank', 'surge'].forEach((key, i) => {
      const hero = HEROES[key];
      const c = this.add.container(W / 2 + (i - 1) * 210, top + 118);
      const bg = this.add.graphics();
      const img = this.add.image(0, -14, key === 'tank' ? 'portrait_champion' : 'portrait_knight').setDisplaySize(118, 118);
      // Surge glows with its speed power.
      if (key === 'surge') img.setTint(0x9fe8ff);
      const name = this.add.text(0, 66, hero.name, textStyle(26, '#ffffff')).setOrigin(0.5);
      c.add([bg, img, name]);
      c.setSize(180, 180);
      c.setInteractive({ useHandCursor: true });
      c.on('pointerup', () => {
        Sfx.resume();
        Sfx.click();
        this.select(key);
      });
      c.bg = bg;
      this.tiles[key] = c;
    });
    this.refreshTiles();
  }

  refreshTiles() {
    Object.keys(this.tiles).forEach((key) => {
      const on = key === this.selected;
      const c = this.tiles[key];
      const g = c.bg;
      g.clear();
      g.fillStyle(0x0a0f0e, 1);
      g.fillRoundedRect(-84, -86, 168, 176, 14);
      g.fillStyle(on ? COLORS.gold : 0x2c3a37, 1);
      g.fillRoundedRect(-80, -82, 160, 168, 12);
      g.fillStyle(0x0a0f0e, 1);
      g.fillRoundedRect(-62, -74, 124, 124, 8);
      c.setScale(on ? 1.06 : 0.94);
      c.setAlpha(on ? 1 : 0.8);
    });
    this.roleText.setText(HEROES[this.selected].role.toUpperCase());
    this.portrait.setTexture(this.selected === 'tank' ? 'portrait_champion' : 'portrait_knight');
  }

  select(key) {
    this.selected = key;
    Store.set('captain', key);
    this.refreshTiles();
  }

  start() {
    Sfx.resume();
    this.scene.start('Game', { hero: this.selected });
  }

  update(time, delta) {
    this.t += delta / 1000;
    if (World3D.active) World3D.showcase(this, this.t, this.selected);
    else this.road.tilePositionY -= delta * 0.12;
    // The airship hovers over the road between the logo and START.
    this.airship.setPosition(W / 2 + Math.sin(this.t * 0.6) * 24, 488 + Math.sin(this.t * 1.8) * 8);
  }
}
