// The run itself: squad, horde, gates, barrels, boss, waves, and the speed HUD.

// scale is the sprite's display scale; r is the hit radius in screen pixels.
const ENEMIES = {
  walker: { key: 'walker', scale: 0.6, hp: 3, speed: 110, r: 28, bite: 1, pts: 10, gain: 0.025 },
  sprinter: { key: 'sprinter', scale: 0.55, hp: 1.6, speed: 270, r: 24, bite: 1, pts: 15, gain: 0.04 },
  brute: { key: 'brute', scale: 0.72, hp: 16, speed: 70, r: 54, bite: 4, pts: 50, gain: 0.12 },
};

const UNIT = {
  knight: { key: 'knight', scale: 0.44 },
  champion: { key: 'champion', scale: 0.5 },
};

const MERGE_SIZE = 10;         // this many knights merge into one champion
const MAX_UNITS = 40;          // sprites drawn for the squad
const MAX_CHAMPIONS = 30;
const SQUAD_MIN_X = 110;
const CARD_W = 268;
const CARD_H = 140;
const BOSS_SCALE = 0.8;
const SLAM_HALF_W = 95;
const MAX_SQUAD_RADIUS = 120; // keeps a big crowd narrow enough to dodge

function lerpColor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

function formation(i, spacing) {
  if (i === 0) return { x: 0, y: 0 };
  const r = spacing * Math.sqrt(i);
  const a = i * 2.39996;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.55 };
}

class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.hero = HEROES[(data && data.hero) || 'blitz'] || HEROES.blitz;
  }

  create() {
    this.s = {
      squad: this.hero.startSquad,
      maxSquad: this.hero.startSquad,
      speed: 1,
      topSpeed: 1,
      wave: 1,
      waveTime: 0,
      score: 0,
      kills: 0,
      bosses: 0,
      boltMult: 1,
      dmgMult: 1,
      pierce: 0,
      slowTimer: 0,
      surgeTimer: 0,
      surgeCd: 0,
      bossActive: false,
      over: false,
    };
    this.paused = false;
    this.time.paused = false;
    this.squadX = W / 2;
    this.targetX = W / 2;
    this.fireTimer = 0.2;
    this.spawnTimer = 1.2;
    this.gateTimer = 2.5;
    this.barrelTimer = 14;
    this.elapsed = 0;
    this.gateRows = [];
    this.drag = null;
    this.units = 0;
    this.spacing = 26;
    this.champions = 0;
    this.slam = null;

    this.createWorld();
    this.createSquad();
    this.createCombat();
    this.createHud();
    this.createInput();

    Sfx.resume();
    Music.start();
    this.events.once('shutdown', () => Music.stop());

    this.banner('DRAG TO STEER', '#c8f1ff', 'Shoot gold cards to raise them');
  }

  // ---------------------------------------------------------------- setup

  createWorld() {
    this.road = this.add.tileSprite(W / 2, H / 2, W, H, 'road').setDepth(0);

    this.streaks = [];
    for (let i = 0; i < 34; i++) {
      const s = this.add.image(0, 0, 'streak').setDepth(1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      this.resetStreak(s, true);
      this.streaks.push(s);
    }
    this.embers = [];
    for (let i = 0; i < 40; i++) {
      const e = this.add.image(Math.random() * W, Math.random() * H, 'dot').setDepth(2)
        .setTint(COLORS.ember).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3 + Math.random() * 0.5);
      e.drift = Math.random() * Math.PI * 2;
      this.embers.push(e);
    }
    this.add.image(W / 2, 0, 'fog').setOrigin(0.5, 0).setDepth(45);
  }

  resetStreak(s, anywhere) {
    const side = Math.random() < 0.5;
    s.x = side ? 20 + Math.random() * 90 : W - 20 - Math.random() * 90;
    if (Math.random() < 0.3) s.x = 100 + Math.random() * (W - 200);
    s.y = anywhere ? Math.random() * H : -100 - Math.random() * 300;
    s.setScale(1, 0.6 + Math.random() * 1.2);
    s.setTint(Math.random() < 0.7 ? COLORS.knight : COLORS.ember);
  }

  createSquad() {
    this.knights = [];
    for (let i = 0; i < MAX_UNITS; i++) {
      const k = this.add.image(this.squadX, LINE_Y, 'knight').setVisible(false);
      k.off = { x: 0, y: 0 };
      k.phase = Math.random() * Math.PI * 2;
      this.knights.push(k);
    }
    this.squadLabel = this.add.text(this.squadX, LINE_Y - 90, '', textStyle(54, '#ffffff', { fontStyle: 'italic' }))
      .setOrigin(0.5).setDepth(46);
    this.setSquad(this.s.squad, true);
  }

  createCombat() {
    this.bullets = this.physics.add.group({ defaultKey: 'bolt', maxSize: 500 });
    this.enemies = this.physics.add.group({ maxSize: 260 });
    this.bosses = this.physics.add.group({ maxSize: 2 });
    this.barrels = this.physics.add.group({ maxSize: 6 });
    // A group made from a config object starts with one placeholder sprite; drop it.
    [this.bullets, this.enemies, this.bosses, this.barrels].forEach((grp) => grp.clear(true, true));
    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHit, null, this);
    this.physics.add.overlap(this.bullets, this.bosses, this.onBulletHit, null, this);
    this.physics.add.overlap(this.bullets, this.barrels, this.onBulletHit, null, this);

    const burst = (tint) => this.add.particles(0, 0, 'dot', {
      speed: { min: 80, max: 300 },
      lifespan: { min: 250, max: 500 },
      scale: { start: 1, end: 0 },
      tint,
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(30);
    this.burstRed = burst(COLORS.horde);
    this.burstRot = burst(COLORS.rot);
    this.burstBlue = burst(COLORS.knight);
    this.burstGold = burst(COLORS.gold);

    this.slamGfx = this.add.graphics().setDepth(8);

    this.numbers = [];
    for (let i = 0; i < 40; i++) {
      this.numbers.push(this.add.text(0, 0, '', textStyle(28, '#ffffff', { fontStyle: 'italic' }))
        .setOrigin(0.5).setDepth(40).setVisible(false));
    }
    this.numberIndex = 0;
  }

  // Last War style HUD: a small cluster in the top-left corner (portrait with a
  // wave badge, a wave bar, and slim strips), a small pause button, and the
  // battle everywhere else. Fire rate, the jam theme, gets a big meter at the bottom.
  createHud() {
    const px = 18;
    const py = 18;
    const ps = 104;
    this.hudPortrait = { px, py, ps };
    const frame = this.add.graphics().setDepth(50);
    frame.fillStyle(0x0a0f0e, 1);
    frame.fillRoundedRect(px - 5, py - 5, ps + 10, ps + 10, 14);
    frame.fillStyle(PANEL_TRIM, 1);
    frame.fillRoundedRect(px - 2, py - 2, ps + 4, ps + 4, 12);
    this.add.image(px + ps / 2, py + ps / 2, this.hero.key === 'tank' ? 'portrait_champion' : 'portrait_knight')
      .setDisplaySize(ps - 4, ps - 4).setDepth(50);
    const badge = this.add.graphics().setDepth(51);
    badge.fillStyle(0x0a0f0e, 0.95);
    badge.fillRoundedRect(px - 5, py + ps - 34, 58, 40, 8);
    this.waveBadge = this.add.text(px + 24, py + ps - 14, '1', textStyle(30, '#ffffff')).setOrigin(0.5).setDepth(52);
    this.waveBar = this.add.graphics().setDepth(50);
    this.waveBarText = this.add.text(px + ps / 2 + 6, py + ps + 22, 'WAVE', textStyle(16, '#ffffff', { strokeThickness: 3 }))
      .setOrigin(0.5).setDepth(51);

    const sx = px + ps + 8;
    this.scoreStrip = uiStrip(this, sx, py + 24, 'icon_score', 0.8, 28).setDepth(50);
    this.killStrip = uiStrip(this, sx + 190, py + 24, 'skull', 0.85, 28).setDepth(50);
    this.bossStrip = uiStrip(this, sx, py + 74, 'skull', 0.85, 22, '#ff8a7a').setDepth(50);
    this.statusText = this.add.text(px - 2, py + ps + 46, '', textStyle(20, '#4fe0c8', { strokeThickness: 4, lineSpacing: 4 }))
      .setDepth(51);

    this.pauseBtn = uiIconButton(this, W - 52, 54, 'pause', () => this.pauseGame(), 72).setDepth(52);

    // Boss bar: a huge outlined number sitting on a fat red bar.
    this.bossBar = this.add.graphics().setDepth(51);
    this.bossNum = this.add.text(W / 2, 214, '', textStyle(72, '#ffffff', { fontStyle: 'italic' }))
      .setOrigin(0.5).setDepth(52).setVisible(false);

    // Fire rate meter at the bottom: flame, big slanted number, fat bar.
    this.fireBar = this.add.graphics().setDepth(50);
    this.add.image(46, H - 70, 'icon_flame').setScale(1.2).setDepth(52);
    this.speedText = this.add.text(84, H - 104, 'x1.0', textStyle(60, '#ffffff', { fontStyle: 'italic' }))
      .setOrigin(0, 0.5).setDepth(52);
    this.add.text(470, H - 104, 'FIRE RATE', textStyle(20, '#ffffff', { strokeThickness: 4 })).setOrigin(1, 0.5).setDepth(52);

    if (this.hero.ability === 'surge') {
      this.surgeBtn = this.add.container(W - 92, H - 92).setDepth(52);
      this.surgeGfx = this.add.graphics();
      this.surgeText = this.add.text(0, 0, 'SURGE', textStyle(28, '#ffffff')).setOrigin(0.5);
      this.surgeBtn.add([this.surgeGfx, this.surgeText]);
      this.surgeBtn.setSize(150, 150);
      this.surgeBtn.setInteractive({ useHandCursor: true });
      this.surgeBtn.on('pointerdown', () => this.triggerSurge());
    }
  }

  createInput() {
    this.input.on('pointerdown', (p, over) => {
      Sfx.resume();
      if (over && over.length) return;
      this.drag = { px: p.x, sx: this.targetX, id: p.id };
    });
    this.input.on('pointermove', (p) => {
      if (!this.drag || p.id !== this.drag.id || !p.isDown) return;
      this.targetX = this.clampSquadX(this.drag.sx + (p.x - this.drag.px) * 1.25);
    });
    this.input.on('pointerup', (p) => {
      if (this.drag && p.id === this.drag.id) this.drag = null;
    });
    this.keys = this.input.keyboard.addKeys('LEFT,RIGHT,A,D,SPACE');
    this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
    this.input.keyboard.on('keydown-P', () => this.pauseGame());

    // Pause when the player switches apps or tabs.
    const onHidden = () => this.pauseGame();
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.events.once('shutdown', () => this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden));
  }

  pauseGame() {
    if (this.paused || this.s.over) return;
    this.paused = true;
    this.drag = null;
    this.physics.pause();
    this.tweens.pauseAll();
    this.time.paused = true;
    Music.stop();
    openPause(this, {
      resume: () => this.resumeGame(),
      quit: () => this.scene.start('Title'),
    });
  }

  resumeGame() {
    this.paused = false;
    this.physics.resume();
    this.tweens.resumeAll();
    this.time.paused = false;
    Music.start();
  }

  // Camera shake that respects the screen shake setting.
  shake(duration, intensity) {
    if (Settings.get('shake')) this.cameras.main.shake(duration, intensity);
  }

  // ---------------------------------------------------------------- state helpers

  effSpeed() {
    return Math.min(this.s.speed, TUNING.maxSpeed) * (this.s.surgeTimer > 0 ? 2 : 1);
  }

  waveScale() {
    const w = this.s.wave - 1;
    return 1 + w * 0.35 + w * w * 0.02;
  }

  hordeMult() {
    return (1 + (this.s.wave - 1) * 0.09) * (this.s.slowTimer > 0 ? 0.45 : 1);
  }

  addSpeed(delta) {
    this.s.speed = clamp(this.s.speed + delta, 1, TUNING.maxSpeed);
  }

  setSquad(n, silent) {
    const prev = this.s.squad;
    this.s.squad = clamp(Math.round(n), 0, TUNING.squadCap);
    this.s.maxSquad = Math.max(this.s.maxSquad, this.s.squad);
    this.squadLabel.setText(String(this.s.squad));
    this.layoutSquad(silent);
    if (!silent && prev !== this.s.squad) {
      this.tweens.killTweensOf(this.squadLabel);
      this.squadLabel.setScale(1.35);
      this.tweens.add({ targets: this.squadLabel, scale: 1, duration: 220, ease: 'Back.easeOut' });
    }
    if (this.s.squad <= 0) this.gameOver();
  }

  // Every MERGE_SIZE knights merge into one champion, so big squads stay readable.
  layoutSquad(silent) {
    const n = this.s.squad;
    const champs = Math.min(MAX_CHAMPIONS, Math.floor(n / MERGE_SIZE));
    const singles = Math.min(MERGE_SIZE - 1, n - champs * MERGE_SIZE);
    if (!silent && champs > this.champions) {
      this.burstBlue.explode(24, this.squadX, LINE_Y - 20);
      this.popNumber(this.squadX, LINE_Y - 290, 'CHAMPION RISES', '#4fc3ff', 30);
    }
    this.champions = champs;
    this.units = champs + singles;
    const base = champs > 0 ? 34 : 26;
    this.spacing = this.units > 1 ? Math.min(base, MAX_SQUAD_RADIUS / Math.sqrt(this.units - 1)) : base;
    for (let i = 0; i < this.knights.length; i++) {
      const k = this.knights[i];
      if (i >= this.units) {
        k.setVisible(false);
        continue;
      }
      const u = i < champs ? UNIT.champion : UNIT.knight;
      if (k.texture.key !== u.key) k.setTexture(u.key);
      k.setScale(u.scale);
      k.isChampion = i < champs;
      k.off = formation(i, this.spacing);
      k.setDepth(20 + (k.off.y + 60) * 0.01);
      if (!k.visible) {
        k.setPosition(this.squadX + k.off.x, LINE_Y + k.off.y).setVisible(true);
      }
    }
  }

  squadSpread() {
    return this.units > 1 ? this.spacing * Math.sqrt(this.units - 1) : 0;
  }

  // A bigger crowd is wider, so keep the whole crowd on the road.
  clampSquadX(x) {
    const lo = Math.max(SQUAD_MIN_X, 96 + this.squadSpread());
    return clamp(x, lo, W - lo);
  }

  // ---------------------------------------------------------------- main loop

  update(time, delta) {
    if (this.paused) return;
    const dt = Math.min(delta / 1000, 0.05);
    this.elapsed += dt;
    const s = this.s;

    if (s.over) {
      this.updateSquadVisual(dt, 1);
      return;
    }

    if (s.slowTimer > 0) s.slowTimer -= dt;
    if (s.surgeTimer > 0) s.surgeTimer -= dt;
    if (s.surgeCd > 0) s.surgeCd -= dt;
    if (s.speed > 1) this.addSpeed(-TUNING.speedDecay * dt);

    const eff = this.effSpeed();
    s.topSpeed = Math.max(s.topSpeed, eff);
    Music.update(eff);

    if (this.keys.LEFT.isDown || this.keys.A.isDown) this.targetX = this.clampSquadX(this.targetX - 760 * dt);
    if (this.keys.RIGHT.isDown || this.keys.D.isDown) this.targetX = this.clampSquadX(this.targetX + 760 * dt);
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.triggerSurge();
    this.targetX = this.clampSquadX(this.targetX);
    this.squadX += (this.targetX - this.squadX) * Math.min(1, dt * 14);

    this.updateSquadVisual(dt, eff);
    this.updateFiring(dt, eff);
    this.updateBullets();
    this.updateEnemies();
    if (s.over) return;
    this.updateBarrels(dt);
    if (s.over) return;
    this.updateBoss(dt);
    if (s.over) return;
    this.updateGates(dt);
    if (s.over) return;
    this.updateSpawning(dt);
    this.updateWaves(dt);
    this.updateSpeedFx(dt, eff);
    this.updateHud(eff);
  }

  updateSquadVisual(dt, eff) {
    const k = Math.min(1, dt * 12);
    const bobRate = 8 + eff * 1.6;
    for (let i = 0; i < this.units; i++) {
      const kn = this.knights[i];
      const tx = this.squadX + kn.off.x;
      const ty = LINE_Y + kn.off.y + Math.sin(this.elapsed * bobRate + kn.phase) * 3;
      kn.x += (tx - kn.x) * k;
      kn.y += (ty - kn.y) * k;
    }
    const spread = this.squadSpread();
    this.squadLabel.setPosition(this.squadX, LINE_Y - 100 - spread * 0.55);
  }

  // ---------------------------------------------------------------- shooting

  updateFiring(dt, eff) {
    const interval = this.hero.interval / eff;
    this.fireTimer -= dt;
    if (this.fireTimer < -interval * 3) this.fireTimer = 0;
    while (this.fireTimer <= 0) {
      this.fireVolley(eff);
      this.fireTimer += interval;
    }
  }

  fireVolley(eff) {
    const shown = this.units;
    if (shown <= 0) return;
    const shooters = Math.min(this.s.squad, TUNING.maxShooters);
    const dmg = this.hero.damage * this.s.dmgMult * this.s.squad / shooters;
    const vy = TUNING.boltSpeed * this.s.boltMult * (this.s.surgeTimer > 0 ? 1.5 : 1);
    for (let j = 0; j < shooters; j++) {
      const kn = this.knights[Math.floor(Math.random() * shown)];
      const y = kn.y - (kn.isChampion ? 56 : 36);
      const b = this.bullets.get(kn.x, y, 'bolt');
      if (!b) break;
      b.enableBody(true, kn.x, y, true, true);
      b.setDepth(15).setBlendMode(Phaser.BlendModes.ADD);
      b.body.setSize(10, 30);
      b.setVelocity((Math.random() - 0.5) * 50, -vy);
      b.dmg = dmg;
      b.pierce = this.s.pierce;
      b.lastHit = null;
    }
    const kn = this.knights[Math.floor(Math.random() * shown)];
    const f = this.add.image(kn.x, kn.y - 30, 'flash').setDepth(31).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.5 + eff * 0.08);
    this.tweens.add({ targets: f, alpha: 0, scale: f.scale * 1.6, duration: 90, onComplete: () => f.destroy() });
    Sfx.shoot(eff);
    if (eff > 5) this.shake(50, 0.0004 * eff);
  }

  killBullet(b) {
    b.disableBody(true, true);
  }

  updateBullets() {
    const list = this.bullets.getChildren();
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.active) continue;
      if (b.y < -60) {
        this.killBullet(b);
        continue;
      }
      for (const row of this.gateRows) {
        if (row.done || b.y > row.y + CARD_H / 2 || b.y < row.y - CARD_H / 2) continue;
        const card = row.cards[b.x < W / 2 ? 0 : 1];
        if (card && card.shootable) {
          this.hitCard(card);
          this.killBullet(b);
          break;
        }
      }
    }
  }

  onBulletHit(a, b) {
    let bullet = a;
    let target = b;
    if (bullet.texture.key !== 'bolt') {
      bullet = b;
      target = a;
    }
    if (!bullet.active || !target.active || bullet.lastHit === target) return;
    this.damage(target, bullet.dmg);
    if (bullet.pierce > 0 && !target.isBoss && !target.isBarrel) {
      bullet.pierce--;
      bullet.lastHit = target;
    } else {
      this.killBullet(bullet);
    }
  }

  damage(e, dmg) {
    e.hp -= dmg;
    e.dmgAcc += dmg;
    e.hitFlash = 0.05;
    if (this.elapsed - e.lastNum > (e.isBoss ? 0.09 : 0.14) || e.hp <= 0) {
      const big = e.isBoss || e.dmgAcc > 30;
      this.popNumber(e.x + (Math.random() - 0.5) * (e.isBoss ? 160 : 30), e.y - (e.isBoss ? 60 : 20),
        Math.max(1, Math.round(e.dmgAcc)).toString(), e.isBoss ? '#f2c14e' : '#ffffff', big ? 40 : 26);
      e.dmgAcc = 0;
      e.lastNum = this.elapsed;
      if (Math.random() < 0.5) Sfx.hit();
    }
    if (e.hp > 0) return;
    if (e.isBarrel) this.breakBarrel(e);
    else this.killEnemy(e, true);
  }

  // ---------------------------------------------------------------- horde

  spawnEnemy(type, x) {
    const def = ENEMIES[type];
    const e = this.enemies.get(x, -70, def.key);
    if (!e) return;
    e.setTexture(def.key);
    e.enableBody(true, x, -70, true, true);
    e.setScale(def.scale);
    const rt = def.r / def.scale;
    e.setCircle(rt, e.width / 2 - rt, e.height / 2 - rt);
    e.setDepth(10).clearTint().setAlpha(1);
    e.def = def;
    e.isBoss = false;
    e.isBarrel = false;
    e.hp = def.hp * this.waveScale();
    e.dmgAcc = 0;
    e.lastNum = 0;
    e.hitFlash = 0;
    e.wobble = Math.random() * Math.PI * 2;
  }

  updateSpawning(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const w = this.s.wave;
    const base = Math.max(0.16, 1.0 / (1 + (w - 1) * 0.28));
    this.spawnTimer = base * (this.s.bossActive ? 2.6 : 1) * (0.7 + Math.random() * 0.6);

    const type = weighted([
      ['walker', 70],
      ['sprinter', w >= 2 ? 18 + w * 2 : 0],
      ['brute', w >= 3 ? 6 + w : 0],
    ]);
    const x = 130 + Math.random() * (W - 260);
    if (type === 'walker') {
      const n = 1 + Math.floor(Math.random() * Math.min(4, 1 + w * 0.5));
      for (let i = 0; i < n; i++) this.spawnEnemy('walker', clamp(x + (i - (n - 1) / 2) * 46, 110, W - 110));
    } else {
      this.spawnEnemy(type, x);
    }
  }

  updateEnemies() {
    const mult = this.hordeMult();
    const list = this.enemies.getChildren();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) {
        if (e.hpText) e.hpText.setVisible(false);
        continue;
      }
      if (e.def.key === 'brute') this.hpTag(e, e.y + 34);
      const vy = e.def.speed * mult;
      let vx;
      if (e.y > 620) {
        vx = clamp((this.squadX - e.x) * 1.3, -170 * mult, 170 * mult);
      } else {
        vx = Math.sin(this.elapsed * 2 + e.wobble) * 30;
      }
      e.setVelocity(vx, vy);
      e.setFlipX(vx < -20);
      this.applyHitFlash(e);
      if (e.y >= LINE_Y - 30) this.bite(e);
      if (this.s.over) return;
    }
  }

  // Health painted right on the object as a big outlined number.
  hpTag(o, y) {
    if (!o.hpText) {
      o.hpText = this.add.text(0, 0, '', textStyle(30, '#ffffff', { fontStyle: 'italic' })).setOrigin(0.5).setDepth(35);
    }
    o.hpText.setVisible(true).setPosition(o.x, y).setText(String(Math.max(1, Math.ceil(o.hp))));
  }

  applyHitFlash(e) {
    if (e.hitFlash > 0) {
      e.hitFlash -= this.game.loop.delta / 1000;
      e.setTintFill(0xffffff);
    } else if (e.isTinted) {
      e.clearTint();
    }
  }

  bite(e) {
    const lost = e.def.bite * Math.ceil(this.s.wave / 3);
    e.disableBody(true, true);
    this.addSpeed(-0.3 * e.def.bite * this.hero.hitLoss);
    this.burstRed.explode(14, e.x, LINE_Y - 10);
    this.popNumber(this.squadX, LINE_Y - 230, '-' + lost, '#e0413a', 40);
    this.shake(120, 0.006);
    this.cameras.main.flash(80, 120, 20, 20);
    Sfx.bite();
    vibrate(40);
    this.setSquad(this.s.squad - lost);
  }

  killEnemy(e, rewarded) {
    if (!e.active) return;
    const eff = this.effSpeed();
    if (e.isBoss) {
      this.bossDown(e);
      return;
    }
    e.disableBody(true, true);
    if (!rewarded) return;
    this.s.kills++;
    this.s.score += e.def.pts * Math.ceil(eff);
    this.addSpeed(e.def.gain);
    (e.def.key === 'sprinter' ? this.burstRot : this.burstRed).explode(e.def.key === 'brute' ? 26 : 10, e.x, e.y);
    Sfx.kill();
  }

  // ---------------------------------------------------------------- rune barrels

  // A barrel rolls down a lane. Break it for an upgrade, or it crashes into the squad.
  spawnBarrel() {
    const x = 150 + Math.random() * (W - 300);
    const b = this.barrels.get(x, -60, 'barrel');
    if (!b) return;
    b.enableBody(true, x, -60, true, true);
    b.setCircle(34, b.width / 2 - 34, b.height / 2 - 34);
    b.setDepth(9).clearTint().setScale(1).setAngle(0);
    b.isBarrel = true;
    b.isBoss = false;
    b.hp = b.maxHp = 28 * this.waveScale();
    b.dmgAcc = 0;
    b.lastNum = 0;
    b.hitFlash = 0;
  }

  updateBarrels(dt) {
    this.barrelTimer -= dt;
    if (this.barrelTimer <= 0) {
      this.spawnBarrel();
      this.barrelTimer = 16 + Math.random() * 6;
    }
    const fall = TUNING.gateFall * 1.15 * (1 + (this.s.wave - 1) * 0.04);
    const list = this.barrels.getChildren();
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.active) {
        if (b.hpText) b.hpText.setVisible(false);
        continue;
      }
      this.hpTag(b, b.y + 4);
      b.setVelocity(0, fall);
      b.setAngle(Math.sin(this.elapsed * 4 + b.x) * 8);
      this.applyHitFlash(b);
      if (b.y >= LINE_Y - 40) {
        if (Math.abs(b.x - this.squadX) < this.squadSpread() + 60) {
          this.barrelCrash(b);
          if (this.s.over) return;
        } else if (b.y > H + 80) {
          b.disableBody(true, true);
        }
      }
    }
  }

  barrelCrash(b) {
    b.disableBody(true, true);
    const lost = Math.ceil(this.s.squad * 0.15) + 2;
    this.burstGold.explode(30, b.x, LINE_Y - 20);
    this.popNumber(this.squadX, LINE_Y - 250, 'BARREL CRASH -' + lost, '#e0413a', 36);
    vibrate(80);
    this.shake(200, 0.01);
    Sfx.bite();
    this.setSquad(this.s.squad - lost);
  }

  breakBarrel(b) {
    b.disableBody(true, true);
    const s = this.s;
    const reward = weighted([
      ['pierce', s.pierce < 2 ? 35 : 0],
      ['power', 35],
      ['squad', 30],
    ]);
    let msg;
    if (reward === 'pierce') {
      s.pierce++;
      msg = 'PIERCING BOLTS ' + s.pierce;
    } else if (reward === 'power') {
      s.dmgMult *= 1.3;
      msg = 'BOLT DAMAGE +30%';
    } else {
      const n = 5 + s.wave * 2;
      msg = '+' + n + ' KNIGHTS';
      this.setSquad(s.squad + n);
    }
    this.burstGold.explode(40, b.x, b.y);
    this.burstBlue.explode(30, b.x, b.y);
    this.popNumber(b.x, b.y - 40, msg, '#4fe0c8', 34);
    this.addSpeed(0.3);
    Sfx.gateGood();
  }

  // ---------------------------------------------------------------- boss

  spawnBoss() {
    const b = this.bosses.get(W / 2, -220, 'boss');
    if (!b) return;
    b.enableBody(true, W / 2, -220, true, true);
    b.setScale(BOSS_SCALE);
    const rt = 125 / BOSS_SCALE;
    b.setCircle(rt, b.width / 2 - rt, b.height / 2 - rt - 20);
    b.setDepth(11).clearTint();
    b.isBoss = true;
    b.isBarrel = false;
    b.maxHp = 900 * Math.pow(this.s.wave / TUNING.bossEvery, 1.6);
    b.hp = b.maxHp;
    b.dmgAcc = 0;
    b.lastNum = 0;
    b.hitFlash = 0;
    b.startY = -220;
    b.endY = LINE_Y - 260;
    b.slamTimer = 2.5;
    this.boss = b;
    this.slam = null;
    this.s.bossActive = true;
    this.banner('A HORROR APPROACHES', '#e0413a', 'Dodge the red slams');
    Sfx.bossRoar();
    this.shake(600, 0.008);
  }

  updateBoss(dt) {
    const b = this.boss;
    if (!b || !b.active) {
      this.bossBar.clear();
      this.slamGfx.clear();
      this.bossNum.setVisible(false);
      return;
    }
    const v = (b.endY - b.startY) / TUNING.bossTime * (this.s.slowTimer > 0 ? 0.45 : 1);
    b.setVelocity(Math.sin(this.elapsed * 1.5) * 40, v);
    b.x = clamp(b.x, 190, W - 190);
    this.applyHitFlash(b);
    b.setScale(BOSS_SCALE * (1 + Math.sin(this.elapsed * 6) * 0.02));

    this.updateSlam(b, dt);
    if (this.s.over || !b.active) return;

    const hpRatio = clamp(b.hp / b.maxHp, 0, 1);
    const reach = clamp((b.y - b.startY) / (b.endY - b.startY), 0, 1);
    this.drawBossBar(hpRatio, reach, b.hp);

    if (b.y >= b.endY) this.bossSmash(b);
  }

  // The boss marks a lane where the squad stands, then slams it.
  // Sliding out in time is a dodge and gives a little fire rate.
  updateSlam(b, dt) {
    const g = this.slamGfx;
    g.clear();
    if (!this.slam) {
      b.slamTimer -= dt;
      if (b.slamTimer > 0) return;
      const warn = Math.max(0.75, 1.15 - this.s.wave * 0.02);
      this.slam = { x: this.squadX, t: warn, warn };
      b.slamTimer = Math.max(2, 3.4 - this.s.wave * 0.05);
      Sfx.tone(180, 0.3, 'sawtooth', 0.08, 0, 120);
    }
    const sl = this.slam;
    sl.t -= dt;
    const top = Math.max(0, b.y);
    const pulse = 0.18 + 0.14 * Math.sin(this.elapsed * 30);
    g.fillStyle(COLORS.horde, pulse + (1 - sl.t / sl.warn) * 0.2);
    g.fillRect(sl.x - SLAM_HALF_W, top, SLAM_HALF_W * 2, H - top);
    g.lineStyle(4, COLORS.horde, 0.9);
    g.strokeRect(sl.x - SLAM_HALF_W, top, SLAM_HALF_W * 2, H - top);
    if (sl.t > 0) return;

    this.slam = null;
    const flash = this.add.rectangle(sl.x, (top + H) / 2, SLAM_HALF_W * 2, H - top, 0xffd0c0, 0.7).setDepth(32);
    this.tweens.add({ targets: flash, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
    for (let y = top + 80; y < H; y += 160) this.burstRed.explode(8, sl.x, y);
    this.shake(220, 0.012);
    Sfx.noise(0.4, 0.2, 0, 300, 'lowpass');

    if (Math.abs(this.squadX - sl.x) < SLAM_HALF_W + this.squadSpread() * 0.4) {
      const lost = Math.ceil(this.s.squad * 0.2) + 2;
      this.addSpeed(-0.8 * this.hero.hitLoss);
      this.popNumber(this.squadX, LINE_Y - 250, 'SLAMMED -' + lost, '#e0413a', 40);
      vibrate(120);
      Sfx.bite();
      this.setSquad(this.s.squad - lost);
    } else {
      this.addSpeed(0.4);
      this.popNumber(this.squadX, LINE_Y - 250, 'DODGED  +SPEED', '#4fe0c8', 36);
    }
  }

  endBoss(b) {
    b.disableBody(true, true);
    this.boss = null;
    this.slam = null;
    this.slamGfx.clear();
    this.s.bossActive = false;
  }

  bossSmash(b) {
    this.endBoss(b);
    const lost = Math.ceil(this.s.squad * 0.5) + 3;
    this.addSpeed(-2 * this.hero.hitLoss);
    this.burstRed.explode(60, this.squadX, LINE_Y - 40);
    this.popNumber(this.squadX, LINE_Y - 250, '-' + lost, '#e0413a', 56);
    this.shake(500, 0.02);
    this.cameras.main.flash(200, 160, 20, 20);
    Sfx.bite();
    Sfx.bossRoar();
    this.banner('IT BROKE THROUGH', '#e0413a');
    vibrate(250);
    this.setSquad(this.s.squad - lost);
  }

  bossDown(b) {
    this.endBoss(b);
    this.s.bosses++;
    this.s.kills++;
    this.s.score += Math.round(1000 * (this.s.wave / TUNING.bossEvery) * Math.ceil(this.effSpeed()));
    this.addSpeed(1.5);
    this.burstRed.explode(80, b.x, b.y);
    this.burstGold.explode(60, b.x, b.y);
    this.shake(400, 0.015);
    this.cameras.main.flash(150, 255, 220, 140);
    Sfx.bossDown();
    this.banner('HORROR SLAIN', '#f2c14e', 'Fire rate +1.5');
  }

  // ---------------------------------------------------------------- gates

  goodGate() {
    const w = this.s.wave;
    const kind = weighted([['add', 34], ['mul', w >= 2 ? 20 : 8], ['fire', 15], ['bolt', 13], ['slow', 12]]);
    if (kind === 'add') return { kind, value: Math.round(3 + w * 1.5 + Math.random() * (3 + w)) };
    if (kind === 'mul') return { kind, value: Math.random() < 0.75 ? 2 : 3 };
    return { kind };
  }

  badGate() {
    const w = this.s.wave;
    const kind = weighted([['add', 45], ['div', 25], ['trap', 30]]);
    if (kind === 'add') return { kind, value: -Math.round(2 + w + Math.random() * (2 + w)) };
    if (kind === 'div') return { kind, value: 2, prog: 0 };
    return { kind, pct: 40, prog: 0 };
  }

  spawnGateRow() {
    const picks = Phaser.Utils.Array.Shuffle([this.goodGate(), Math.random() < 0.6 ? this.badGate() : this.goodGate()]);
    const row = { y: -CARD_H, cards: [], done: false };
    picks.forEach((p, i) => {
      const x = i === 0 ? W / 2 - CARD_W / 2 - 8 : W / 2 + CARD_W / 2 + 8;
      const c = this.add.container(x, row.y).setDepth(5);
      c.gate = p;
      // Shooting raises +/- cards, and makes the red divide and trap cards worse.
      c.shootable = p.kind === 'add' || p.kind === 'div' || p.kind === 'trap';
      c.startValue = p.value || 0;
      c.bg = this.add.graphics();
      c.label = this.add.text(0, -12, '', textStyle(68, '#ffffff', { fontStyle: 'italic' })).setOrigin(0.5);
      c.sub = this.add.text(0, 52, '', textStyle(18, '#ffffff', { strokeThickness: 4 })).setOrigin(0.5);
      c.add([c.bg, c.label, c.sub]);
      this.drawCard(c);
      row.cards.push(c);
    });
    this.gateRows.push(row);
  }

  cardInfo(g) {
    switch (g.kind) {
      case 'add': {
        const v = Math.round(g.value);
        return { text: (v >= 0 ? '+' : '') + v, sub: 'KNIGHTS', color: v > 0 ? COLORS.gold : COLORS.bad };
      }
      case 'mul': return { text: 'x' + g.value, sub: 'KNIGHTS', color: COLORS.gold };
      case 'div': return { text: '÷' + g.value, sub: 'KNIGHTS', color: COLORS.bad };
      case 'fire': return { text: 'x2', sub: 'FIRE RATE', color: COLORS.speedGate };
      case 'trap': return { text: '-' + g.pct + '%', sub: 'FIRE RATE', color: COLORS.bad };
      case 'bolt': return { text: '+50%', sub: 'BOLT SPEED', color: COLORS.speedGate };
      case 'slow': return { text: 'SLOW', sub: 'HORDE 5s', color: COLORS.speedGate };
    }
    return { text: '?', sub: '', color: COLORS.gold };
  }

  // Glassy see-through gate panel, tinted gold (good), red (bad) or teal
  // (speed), with a big white slanted number, like Last War's gates.
  drawCard(c) {
    const info = this.cardInfo(c.gate);
    const g = c.bg;
    const hw = CARD_W / 2;
    const hh = CARD_H / 2;
    g.clear();
    g.fillStyle(0x0a0f0e, 0.9);
    g.fillRoundedRect(-hw - 4, -hh - 4, CARD_W + 8, CARD_H + 8, 16);
    g.fillStyle(info.color, 0.72);
    g.fillRoundedRect(-hw, -hh, CARD_W, CARD_H, 12);
    g.fillStyle(darken(info.color, 35), 0.55);
    g.fillRoundedRect(-hw, hh - 30, CARD_W, 30, { tl: 0, tr: 0, bl: 12, br: 12 });
    g.fillStyle(0xffffff, 0.22);
    g.fillRoundedRect(-hw + 8, -hh + 7, CARD_W - 16, CARD_H * 0.32, 10);
    g.lineStyle(4, 0xffffff, 0.8);
    g.strokeRoundedRect(-hw, -hh, CARD_W, CARD_H, 12);
    c.label.setText(info.text);
    c.sub.setText(info.sub);
    c.shownText = info.text;
  }

  hitCard(c) {
    const g = c.gate;
    if (g.kind === 'add') {
      const cap = c.startValue + 30 + this.s.wave * 3;
      g.value = Math.min(cap, g.value + 0.34);
    } else if (g.kind === 'div') {
      g.prog++;
      g.value = Math.min(5, 2 + Math.floor(g.prog / 30));
    } else if (g.kind === 'trap') {
      g.prog++;
      g.pct = Math.min(80, 40 + Math.floor(g.prog / 12) * 5);
    }
    const info = this.cardInfo(g);
    if (info.text !== c.shownText) {
      this.drawCard(c);
      c.label.setScale(1.25);
      this.tweens.add({ targets: c.label, scale: 1, duration: 120 });
      Sfx.gateTick();
    }
    (g.kind === 'add' ? this.burstBlue : this.burstRed).explode(2, c.x + (Math.random() - 0.5) * 120, c.y + CARD_H / 2 - 10);
  }

  updateGates(dt) {
    this.gateTimer -= dt;
    if (this.gateTimer <= 0 && !this.s.bossActive) {
      this.spawnGateRow();
      this.gateTimer = TUNING.gateEvery * (0.85 + Math.random() * 0.3);
    }
    const fall = TUNING.gateFall * (1 + (this.s.wave - 1) * 0.04);
    for (let i = this.gateRows.length - 1; i >= 0; i--) {
      const row = this.gateRows[i];
      row.y += fall * dt;
      row.cards.forEach((c) => { c.y = row.y; });
      if (!row.done && row.y >= LINE_Y - 30) {
        row.done = true;
        const chosen = row.cards[this.squadX < W / 2 ? 0 : 1];
        const other = row.cards[this.squadX < W / 2 ? 1 : 0];
        this.applyGate(chosen.gate);
        this.tweens.add({ targets: chosen, scale: 1.25, alpha: 0, duration: 260, onComplete: () => chosen.destroy() });
        this.tweens.add({ targets: other, alpha: 0, duration: 200, onComplete: () => other.destroy() });
        this.gateRows.splice(i, 1);
        if (this.s.over) return;
      }
    }
  }

  applyGate(g) {
    const s = this.s;
    let good = true;
    let msg = '';
    switch (g.kind) {
      case 'add': {
        const v = Math.round(g.value);
        good = v >= 0;
        msg = (v >= 0 ? '+' : '') + v;
        this.setSquad(s.squad + v);
        break;
      }
      case 'mul':
        msg = 'x' + g.value;
        this.setSquad(s.squad * g.value);
        break;
      case 'div':
        good = false;
        msg = '÷' + g.value;
        this.setSquad(Math.ceil(s.squad / g.value));
        break;
      case 'fire':
        msg = 'FIRE RATE x2';
        s.speed = Math.min(TUNING.maxSpeed, s.speed * 2);
        break;
      case 'trap':
        good = false;
        msg = 'FIRE RATE -' + g.pct + '%';
        s.speed = Math.max(1, s.speed * (1 - g.pct / 100));
        break;
      case 'bolt':
        msg = 'BOLT SPEED +50%';
        s.boltMult = Math.min(2.5, s.boltMult * 1.5);
        break;
      case 'slow':
        msg = 'HORDE SLOWED';
        s.slowTimer = 5;
        break;
    }
    if (s.over) return;
    this.popNumber(this.squadX, LINE_Y - 260, msg, good ? '#f2c14e' : '#e0413a', 44);
    if (good) {
      this.burstGold.explode(30, this.squadX, LINE_Y - 20);
      Sfx.gateGood();
    } else {
      this.burstRed.explode(30, this.squadX, LINE_Y - 20);
      this.shake(150, 0.006);
      Sfx.gateBad();
      vibrate(40);
    }
  }

  // ---------------------------------------------------------------- waves

  updateWaves(dt) {
    if (this.s.bossActive) return;
    this.s.waveTime += dt;
    if (this.s.waveTime < TUNING.waveLength) return;
    this.s.waveTime = 0;
    this.s.wave++;
    this.s.score += 100 * this.s.wave;
    if (this.s.wave % TUNING.bossEvery === 0) {
      this.spawnBoss();
    } else {
      this.banner('WAVE ' + this.s.wave, '#f2c14e', 'The horde quickens');
    }
  }

  triggerSurge() {
    if (this.hero.ability !== 'surge' || this.s.surgeCd > 0 || this.s.over) return;
    this.s.surgeTimer = 5;
    this.s.surgeCd = 20;
    Sfx.surge();
    this.cameras.main.flash(120, 79, 195, 255);
    this.banner('SURGE', '#4fc3ff', 'All speed doubled');
  }

  // ---------------------------------------------------------------- effects

  updateSpeedFx(dt, eff) {
    const ratio = clamp((eff - 1) / (TUNING.maxSpeed - 1), 0, 1.5);
    this.road.tilePositionY -= (140 + eff * 75) * dt;

    const activeStreaks = Math.floor(4 + ratio * 30);
    const streakSpeed = 900 + eff * 260;
    for (let i = 0; i < this.streaks.length; i++) {
      const st = this.streaks[i];
      const on = i < activeStreaks;
      st.setVisible(on);
      if (!on) continue;
      st.setAlpha(0.06 + ratio * 0.22);
      st.y += streakSpeed * dt;
      if (st.y > H + 100) this.resetStreak(st, false);
    }
    for (const e of this.embers) {
      e.y += (80 + eff * 70) * dt;
      e.x += Math.sin(this.elapsed * 2 + e.drift) * 20 * dt;
      e.setAlpha(0.25 + ratio * 0.5);
      if (e.y > H + 10) {
        e.y = -10;
        e.x = Math.random() * W;
      }
    }
  }

  popNumber(x, y, str, color, size) {
    const t = this.numbers[this.numberIndex];
    this.numberIndex = (this.numberIndex + 1) % this.numbers.length;
    this.tweens.killTweensOf(t);
    t.setText(str).setColor(color).setFontSize(size).setStroke('#0a0f0e', Math.max(4, Math.round(size * 0.16))).setPosition(x, y).setAlpha(1).setScale(1.3).setVisible(true);
    this.tweens.add({ targets: t, scale: 1, duration: 120, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: y - 70, alpha: 0, delay: 250, duration: 500, onComplete: () => t.setVisible(false) });
  }

  banner(title, color, subtitle) {
    const t = this.add.text(W / 2, 520, title, textStyle(76, color, { fontStyle: 'italic' }))
      .setOrigin(0.5).setDepth(60).setScale(0.4).setAlpha(0);
    const parts = [t];
    if (subtitle) {
      parts.push(this.add.text(W / 2, 590, subtitle, textStyle(30, '#ffffff'))
        .setOrigin(0.5).setDepth(60).setAlpha(0));
    }
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    if (parts[1]) this.tweens.add({ targets: parts[1], alpha: 1, duration: 260, delay: 100 });
    this.tweens.add({ targets: parts, alpha: 0, delay: 1500, duration: 400, onComplete: () => parts.forEach((p) => p.destroy()) });
  }

  updateHud(eff) {
    const ratio = clamp((eff - 1) / (TUNING.maxSpeed - 1), 0, 1);
    const color = ratio < 0.5
      ? lerpColor(COLORS.knight, COLORS.gold, ratio * 2)
      : lerpColor(COLORS.gold, COLORS.ember, (ratio - 0.5) * 2);

    // Fire rate meter.
    const fb = this.fireBar;
    const bx = 40;
    const by = H - 72;
    const bw = 440;
    const bh = 34;
    fb.clear();
    fb.fillStyle(0x0a0f0e, 1);
    fb.fillRoundedRect(bx - 4, by - 4, bw + 8, bh + 8, (bh + 8) / 2);
    fb.fillStyle(0x1b1f1e, 1);
    fb.fillRoundedRect(bx, by, bw, bh, bh / 2);
    const fw = Math.max(bh, bw * Math.max(0.04, ratio));
    fb.fillStyle(darken(color, 25), 1);
    fb.fillRoundedRect(bx, by, fw, bh, bh / 2);
    fb.fillStyle(color, 1);
    fb.fillRoundedRect(bx, by, fw, bh - 8, (bh - 8) / 2);
    fb.fillStyle(0xffffff, 0.3);
    fb.fillRoundedRect(bx + 8, by + 4, Math.max(0, fw - 16), 8, 4);
    this.speedText.setText('x' + eff.toFixed(1));
    this.speedText.setScale(1 + ratio * 0.12 + (this.s.surgeTimer > 0 ? 0.1 : 0));

    // Top-left cluster.
    const { px, py, ps } = this.hudPortrait;
    this.waveBadge.setText(String(this.s.wave));
    const wb = this.waveBar;
    const wy = py + ps + 12;
    const wp = this.s.bossActive ? 1 : this.s.waveTime / TUNING.waveLength;
    wb.clear();
    wb.fillStyle(0x0a0f0e, 1);
    wb.fillRoundedRect(px - 4, wy - 3, ps + 8, 26, 8);
    wb.fillStyle(0x1b1f1e, 1);
    wb.fillRoundedRect(px - 1, wy, ps + 2, 20, 6);
    wb.fillStyle(0x5fd35a, 1);
    wb.fillRoundedRect(px - 1, wy, Math.max(10, (ps + 2) * wp), 20, 6);
    this.scoreStrip.set(this.s.score.toLocaleString('en-US'));
    this.killStrip.set(String(this.s.kills));
    const toBoss = TUNING.bossEvery - (this.s.wave % TUNING.bossEvery);
    this.bossStrip.set(this.s.bossActive ? 'HORROR ATTACKING' : toBoss === 1 ? 'HORROR NEXT WAVE' : 'HORROR IN ' + toBoss + ' WAVES');

    const status = [];
    if (this.s.slowTimer > 0) status.push('HORDE SLOW ' + Math.ceil(this.s.slowTimer) + 's');
    if (this.s.surgeTimer > 0) status.push('SURGE ' + Math.ceil(this.s.surgeTimer) + 's');
    if (this.s.boltMult > 1) status.push('BOLT SPEED x' + this.s.boltMult.toFixed(1));
    if (this.s.dmgMult > 1) status.push('BOLT DAMAGE x' + this.s.dmgMult.toFixed(1));
    if (this.s.pierce > 0) status.push('PIERCE ' + this.s.pierce);
    this.statusText.setText(status.join('\n'));

    if (this.surgeBtn) {
      const ready = this.s.surgeCd <= 0;
      const sg = this.surgeGfx;
      sg.clear();
      sg.fillStyle(0x0a0f0e, 1);
      sg.fillCircle(0, 0, 74);
      sg.fillStyle(ready ? BTN_BLUE : 0x2a3331, 1);
      sg.fillCircle(0, 0, 68);
      sg.fillStyle(0xffffff, ready ? 0.25 : 0.08);
      sg.fillEllipse(0, -30, 100, 40);
      if (!ready) {
        sg.lineStyle(8, COLORS.knight, 1);
        sg.beginPath();
        sg.arc(0, 0, 68, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - this.s.surgeCd / 20), false);
        sg.strokePath();
      }
      this.surgeText.setColor(ready ? '#ffffff' : '#7d8b88');
    }
  }

  drawBossBar(hpRatio, reach, hp) {
    const g = this.bossBar;
    const bx = 100;
    const by = 230;
    const bw = W - 200;
    const bh = 42;
    g.clear();
    g.fillStyle(0x0a0f0e, 1);
    g.fillRoundedRect(bx - 5, by - 5, bw + 10, bh + 10, (bh + 10) / 2);
    g.fillStyle(0x111414, 1);
    g.fillRoundedRect(bx, by, bw, bh, bh / 2);
    const fw = Math.max(bh, bw * hpRatio);
    g.fillStyle(0xb8260f, 1);
    g.fillRoundedRect(bx, by, fw, bh, bh / 2);
    g.fillStyle(0xff4a1c, 1);
    g.fillRoundedRect(bx, by, fw, bh - 10, (bh - 10) / 2);
    g.fillStyle(0xffffff, 0.25);
    g.fillRoundedRect(bx + 10, by + 5, Math.max(0, fw - 20), 9, 4);
    // How close the horror is to the squad.
    g.fillStyle(0x0a0f0e, 1);
    g.fillRoundedRect(bx + 40, by + bh + 10, bw - 80, 12, 6);
    g.fillStyle(COLORS.gold, 1);
    g.fillRoundedRect(bx + 42, by + bh + 12, Math.max(8, (bw - 84) * (1 - reach)), 8, 4);
    this.bossNum.setText(String(Math.ceil(hp))).setVisible(true);
  }

  // ---------------------------------------------------------------- end

  gameOver() {
    if (this.s.over) return;
    this.s.over = true;
    Music.stop();
    Sfx.lose();
    vibrate([100, 60, 200]);
    this.physics.pause();
    this.pauseBtn.setVisible(false);
    this.slamGfx.clear();
    this.shake(400, 0.012);
    this.squadLabel.setText('0');
    this.banner('FALLEN', '#e0413a');
    const s = this.s;
    this.time.delayedCall(1400, () => {
      this.scene.start('GameOver', {
        hero: this.hero.key,
        wave: s.wave,
        topSpeed: s.topSpeed,
        maxSquad: s.maxSquad,
        kills: s.kills,
        bosses: s.bosses,
        score: s.score,
      });
    });
  }
}
