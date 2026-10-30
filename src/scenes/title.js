// Home screen: live 3D road, floating magic particles, animated logo,
// player stats, and a big START button.

class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
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

    this.buildLogo();
    this.spawnParticles();

    this.startBtn = uiButton(this, W / 2, 620, 400, 120, 'START', BTN_BLUE, () => this.start(), { size: 64 });
    this.tweens.add({ targets: this.startBtn, scale: 1.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Selected wizard hint below START
    const heroName = HEROES[this.selected].name;
    this.wizardHint = this.add.text(W / 2, 700, 'PLAYING AS ' + heroName, textStyle(22, COLORS.textDim, { strokeThickness: 4 })).setOrigin(0.5);

    // Best run banner (fills the empty bottom area)
    this.drawBestBanner();

    this.add.text(W / 2, H - 22, 'v' + VERSION, textStyle(16, '#9fb3ad', { strokeThickness: 3 })).setOrigin(0.5);

    this.input.keyboard.on('keydown-ENTER', () => this.start());
    this.input.keyboard.on('keydown-SPACE', () => this.start());

    if (!Store.get('seenHelp', false)) openHelp(this);
  }

  buildLogo() {
    // Glow behind the logo
    this.logoGlow = this.add.graphics();
    this.logoGlow.fillStyle(0x3d78b8, 0.12);
    this.logoGlow.fillEllipse(W / 2, 255, 520, 140);

    const logo = this.add.text(W / 2, 250, 'OVERCLOCK', textStyle(104, '#ffffff', {
      fontStyle: 'italic', strokeThickness: 16, shadow: { offsetX: 0, offsetY: 9, color: '#000000', blur: 0, fill: true, stroke: true },
    })).setOrigin(0.5);
    const grd = logo.context.createLinearGradient(0, 0, 0, logo.height);
    grd.addColorStop(0.15, '#ffffff');
    grd.addColorStop(0.5, '#9fdcff');
    grd.addColorStop(0.9, '#2f86d6');
    logo.setFill(grd);
    this.logo = logo;

    this.add.text(W / 2, 330, 'FIRE FASTER OR FALL', textStyle(28, '#f2c14e', { fontStyle: 'italic' })).setOrigin(0.5);
  }

  spawnParticles() {
    this.motes = [];
    for (let i = 0; i < 18; i++) {
      const mote = this.add.image(
        Math.random() * W,
        Math.random() * H,
        'dot'
      ).setScale(0.5 + Math.random() * 1.2);
      mote.setTint(pick([0x7b3dff, 0x9f6aff, 0xd4b8ff, 0x4fc3ff]));
      mote.setAlpha(0.2 + Math.random() * 0.4);
      mote.vx = (Math.random() - 0.5) * 30;
      mote.vy = -20 - Math.random() * 40;
      mote.baseAlpha = mote.alpha;
      mote.phase = Math.random() * Math.PI * 2;
      this.motes.push(mote);
    }
  }

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
    this.add.image(px + ps / 2, py + ps / 2, this.selected === 'tank' ? 'portrait_champion' : 'portrait_knight').setDisplaySize(ps - 4, ps - 4);
    const badge = this.add.graphics();
    badge.fillStyle(0x0a0f0e, 0.95);
    badge.fillRoundedRect(px - 5, py + ps - 34, 58, 40, 8);
    this.add.text(px + 24, py + ps - 14, String(best.wave), textStyle(30, '#ffffff')).setOrigin(0.5);

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

  drawBestBanner() {
    const best = Store.get('best', null) || { wave: 0, topSpeed: 1, score: 0 };
    if (best.wave === 0) return;

    const by = 940;
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0f0e, 0.65);
    bg.fillRoundedRect(40, by - 20, W - 80, 56, 12);
    bg.lineStyle(2, COLORS.gold, 0.25);
    bg.strokeRoundedRect(40, by - 20, W - 80, 56, 12);

    const cols = [
      { icon: 'skull', val: 'WAVE ' + best.wave, x: 130 },
      { icon: 'icon_flame', val: 'x' + best.topSpeed.toFixed(1), x: 330 },
      { icon: 'icon_score', val: best.score.toLocaleString('en-US'), x: 510 },
    ];
    cols.forEach((c) => {
      this.add.image(c.x - 28, by + 8, c.icon).setScale(0.48);
      this.add.text(c.x, by + 8, c.val, textStyle(18, COLORS.textDim, { strokeThickness: 3 })).setOrigin(0, 0.5);
    });
  }

  start() {
    Sfx.resume();
    this.scene.start('Select');
  }

  update(time, delta) {
    this.t += delta / 1000;
    const dt = delta / 1000;

    if (World3D.active) World3D.showcase(this, this.t, this.selected);
    else this.road.tilePositionY -= delta * 0.12;

    this.airship.setPosition(W / 2 + Math.sin(this.t * 0.6) * 24, 488 + Math.sin(this.t * 1.8) * 8);

    // Logo glow pulse
    if (this.logoGlow) {
      this.logoGlow.clear();
      const pulse = 0.08 + Math.sin(this.t * 1.5) * 0.04;
      this.logoGlow.fillStyle(0x3d78b8, pulse);
      this.logoGlow.fillEllipse(W / 2, 255, 520 + Math.sin(this.t * 2) * 20, 140);
    }

    // Floating magic motes
    for (const m of this.motes) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.phase += dt * 2;
      m.setAlpha(m.baseAlpha * (0.6 + Math.sin(m.phase) * 0.4));
      if (m.y < -20) { m.y = H + 10; m.x = Math.random() * W; }
      if (m.x < -20) m.x = W + 10;
      if (m.x > W + 20) m.x = -10;
    }
  }
}
