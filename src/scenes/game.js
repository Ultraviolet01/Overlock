// The run itself: squad, horde, gates, boss, waves, and the speed HUD.

const ENEMIES = {
  walker: { key: 'walker', hp: 3, speed: 110, r: 20, bite: 1, pts: 10, gain: 0.025 },
  sprinter: { key: 'sprinter', hp: 1.6, speed: 270, r: 17, bite: 1, pts: 15, gain: 0.04 },
  brute: { key: 'brute', hp: 16, speed: 70, r: 36, bite: 4, pts: 50, gain: 0.12 },
};

const MAX_SHOWN_KNIGHTS = 40;
const SQUAD_MIN_X = 110;
const SQUAD_MAX_X = W - 110;
const CARD_W = 268;
const CARD_H = 140;

function lerpColor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

function formation(i) {
  if (i === 0) return { x: 0, y: 0 };
  const r = 17 * Math.sqrt(i);
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
      slowTimer: 0,
      surgeTimer: 0,
      surgeCd: 0,
      bossActive: false,
      over: false,
    };
    this.squadX = W / 2;
    this.targetX = W / 2;
    this.fireTimer = 0.2;
    this.spawnTimer = 1.2;
    this.gateTimer = 2.5;
    this.elapsed = 0;
    this.gateRows = [];
    this.drag = null;

    this.createWorld();
    this.createSquad();
    this.createCombat();
    this.createHud();
    this.createInput();

    Sfx.resume();
    Music.start();
    this.events.once('shutdown', () => Music.stop());

    this.banner('DRAG TO STEER', '#c8f1ff', 'Shoot the cards to raise them');
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
    for (let i = 0; i < MAX_SHOWN_KNIGHTS; i++) {
      const k = this.add.image(this.squadX, LINE_Y, 'knight').setDepth(20 + i * 0.01);
      k.off = formation(i);
      k.phase = Math.random() * Math.PI * 2;
      this.knights.push(k);
    }
    this.squadLabel = this.add.text(this.squadX, LINE_Y - 90, '', textStyle(46, '#c8f1ff', {
      stroke: '#0b1412', strokeThickness: 8,
    })).setOrigin(0.5).setDepth(46);
    this.setSquad(this.s.squad, true);
  }

  createCombat() {
    this.bullets = this.physics.add.group({ defaultKey: 'bolt', maxSize: 500 });
    this.enemies = this.physics.add.group({ maxSize: 260 });
    this.bosses = this.physics.add.group({ maxSize: 2 });
    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHit, null, this);
    this.physics.add.overlap(this.bullets, this.bosses, this.onBulletHit, null, this);

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

    this.numbers = [];
    for (let i = 0; i < 40; i++) {
      this.numbers.push(this.add.text(0, 0, '', textStyle(28, '#ffffff', { stroke: '#0b1412', strokeThickness: 6 }))
        .setOrigin(0.5).setDepth(40).setVisible(false));
    }
    this.numberIndex = 0;
  }

  createHud() {
    this.gauge = this.add.graphics().setDepth(50);
    this.speedText = this.add.text(W / 2, 186, 'x1.0', textStyle(52, '#ffffff', { stroke: '#0b1412', strokeThickness: 8 }))
      .setOrigin(0.5).setDepth(51);
    this.add.text(W / 2, 232, 'FIRE RATE', textStyle(20, COLORS.textDim)).setOrigin(0.5).setDepth(51);

    this.waveText = this.add.text(28, 26, 'WAVE 1', textStyle(34, '#f2c14e', { stroke: '#0b1412', strokeThickness: 6 })).setDepth(51);
    this.waveBar = this.add.graphics().setDepth(51);
    this.statusText = this.add.text(28, 108, '', textStyle(22, '#4fe0c8', { stroke: '#0b1412', strokeThickness: 5 })).setDepth(51);

    this.scoreText = this.add.text(W - 28, 26, '0', textStyle(34, COLORS.text, { stroke: '#0b1412', strokeThickness: 6 }))
      .setOrigin(1, 0).setDepth(51);
    this.muteText = this.add.text(W - 28, 74, Sfx.muted ? 'SOUND OFF' : 'SOUND ON', textStyle(20, COLORS.textDim))
      .setOrigin(1, 0).setDepth(51).setInteractive({ useHandCursor: true });
    this.muteText.on('pointerdown', () => {
      this.muteText.setText(Sfx.toggleMute() ? 'SOUND OFF' : 'SOUND ON');
    });

    this.bossBar = this.add.graphics().setDepth(51);
    this.bossLabel = this.add.text(W / 2, 268, '', textStyle(22, '#e0413a', { stroke: '#0b1412', strokeThickness: 5 }))
      .setOrigin(0.5).setDepth(51);

    if (this.hero.ability === 'surge') {
      this.surgeBtn = this.add.container(W - 92, H - 92).setDepth(52);
      this.surgeGfx = this.add.graphics();
      this.surgeText = this.add.text(0, 0, 'SURGE', textStyle(24, '#ffffff')).setOrigin(0.5);
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
    if (!silent && prev !== this.s.squad) {
      this.tweens.killTweensOf(this.squadLabel);
      this.squadLabel.setScale(1.35);
      this.tweens.add({ targets: this.squadLabel, scale: 1, duration: 220, ease: 'Back.easeOut' });
    }
    if (this.s.squad <= 0) this.gameOver();
  }

  squadSpread() {
    const shown = Math.min(this.s.squad, MAX_SHOWN_KNIGHTS);
    return shown > 1 ? 17 * Math.sqrt(shown - 1) : 0;
  }

  // A bigger crowd is wider, so keep the whole crowd on the road.
  clampSquadX(x) {
    const lo = Math.max(SQUAD_MIN_X, 96 + this.squadSpread());
    return clamp(x, lo, W - lo);
  }

  // ---------------------------------------------------------------- main loop

  update(time, delta) {
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
    this.updateBoss();
    if (s.over) return;
    this.updateGates(dt);
    if (s.over) return;
    this.updateSpawning(dt);
    this.updateWaves(dt);
    this.updateSpeedFx(dt, eff);
    this.updateHud(eff);
  }

  updateSquadVisual(dt, eff) {
    const shown = Math.min(this.s.squad, MAX_SHOWN_KNIGHTS);
    const k = Math.min(1, dt * 12);
    const bobRate = 8 + eff * 1.6;
    for (let i = 0; i < this.knights.length; i++) {
      const kn = this.knights[i];
      kn.setVisible(i < shown);
      if (i >= shown) continue;
      const tx = this.squadX + kn.off.x;
      const ty = LINE_Y + kn.off.y + Math.sin(this.elapsed * bobRate + kn.phase) * 3;
      kn.x += (tx - kn.x) * k;
      kn.y += (ty - kn.y) * k;
    }
    const spread = this.squadSpread();
    this.squadLabel.setPosition(this.squadX, LINE_Y - 70 - spread * 0.55);
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
    const shown = Math.min(this.s.squad, MAX_SHOWN_KNIGHTS);
    if (shown <= 0) return;
    const shooters = Math.min(this.s.squad, TUNING.maxShooters, shown);
    const dmg = this.hero.damage * this.s.squad / shooters;
    const vy = TUNING.boltSpeed * this.s.boltMult * (this.s.surgeTimer > 0 ? 1.5 : 1);
    for (let j = 0; j < shooters; j++) {
      const kn = this.knights[Math.floor(Math.random() * shown)];
      const b = this.bullets.get(kn.x, kn.y - 24, 'bolt');
      if (!b) break;
      b.enableBody(true, kn.x, kn.y - 24, true, true);
      b.setDepth(15).setBlendMode(Phaser.BlendModes.ADD);
      b.body.setSize(10, 30);
      b.setVelocity((Math.random() - 0.5) * 50, -vy);
      b.dmg = dmg;
    }
    const kn = this.knights[Math.floor(Math.random() * shown)];
    const f = this.add.image(kn.x, kn.y - 28, 'flash').setDepth(31).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.5 + eff * 0.08);
    this.tweens.add({ targets: f, alpha: 0, scale: f.scale * 1.6, duration: 90, onComplete: () => f.destroy() });
    Sfx.shoot(eff);
    if (eff > 5) this.cameras.main.shake(50, 0.0004 * eff);
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
    if (!bullet.active || !target.active) return;
    this.killBullet(bullet);
    this.damage(target, bullet.dmg);
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
    if (e.hp <= 0) this.killEnemy(e, true);
  }

  // ---------------------------------------------------------------- horde

  spawnEnemy(type, x) {
    const def = ENEMIES[type];
    const e = this.enemies.get(x, -70, def.key);
    if (!e) return;
    e.setTexture(def.key);
    e.enableBody(true, x, -70, true, true);
    e.setCircle(def.r, e.width / 2 - def.r, e.height / 2 - def.r);
    e.setDepth(10).clearTint().setScale(1).setAlpha(1);
    e.def = def;
    e.isBoss = false;
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
      if (!e.active) continue;
      const vy = e.def.speed * mult;
      let vx;
      if (e.y > 620) {
        vx = clamp((this.squadX - e.x) * 1.3, -170 * mult, 170 * mult);
      } else {
        vx = Math.sin(this.elapsed * 2 + e.wobble) * 30;
      }
      e.setVelocity(vx, vy);
      this.applyHitFlash(e);
      if (e.y >= LINE_Y - 30) this.bite(e);
      if (this.s.over) return;
    }
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
    this.popNumber(this.squadX, LINE_Y - 130, '-' + lost, '#e0413a', 40);
    this.cameras.main.shake(120, 0.006);
    this.cameras.main.flash(80, 120, 20, 20);
    Sfx.bite();
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

  // ---------------------------------------------------------------- boss

  spawnBoss() {
    const b = this.bosses.get(W / 2, -170, 'boss');
    if (!b) return;
    b.enableBody(true, W / 2, -170, true, true);
    b.setCircle(115, b.width / 2 - 115, b.height / 2 - 125);
    b.setDepth(11).clearTint();
    b.isBoss = true;
    b.maxHp = 900 * Math.pow(this.s.wave / TUNING.bossEvery, 1.6);
    b.hp = b.maxHp;
    b.dmgAcc = 0;
    b.lastNum = 0;
    b.hitFlash = 0;
    b.startY = -170;
    b.endY = LINE_Y - 190;
    this.boss = b;
    this.s.bossActive = true;
    this.banner('A HORROR APPROACHES', '#e0413a', 'Kill it before it reaches your knights');
    Sfx.bossRoar();
    this.cameras.main.shake(600, 0.008);
  }

  updateBoss() {
    const b = this.boss;
    if (!b || !b.active) {
      this.bossBar.clear();
      this.bossLabel.setText('');
      return;
    }
    const v = (b.endY - b.startY) / TUNING.bossTime * (this.s.slowTimer > 0 ? 0.45 : 1);
    b.setVelocity(Math.sin(this.elapsed * 1.5) * 40, v);
    b.x = clamp(b.x, 170, W - 170);
    this.applyHitFlash(b);
    b.setScale(1 + Math.sin(this.elapsed * 6) * 0.02);

    const hpRatio = clamp(b.hp / b.maxHp, 0, 1);
    const reach = clamp((b.y - b.startY) / (b.endY - b.startY), 0, 1);
    this.bossBar.clear();
    this.bossBar.fillStyle(0x0a1310, 0.85);
    this.bossBar.fillRoundedRect(110, 284, W - 220, 22, 8);
    this.bossBar.fillStyle(COLORS.horde, 1);
    this.bossBar.fillRoundedRect(112, 286, (W - 224) * hpRatio, 18, 7);
    this.bossBar.fillStyle(COLORS.gold, 1);
    this.bossBar.fillRect(110, 312, (W - 220) * (1 - reach), 5);
    this.bossLabel.setText('HORROR  ' + Math.ceil(b.hp));

    if (b.y >= b.endY) this.bossSmash(b);
  }

  bossSmash(b) {
    b.disableBody(true, true);
    this.boss = null;
    this.s.bossActive = false;
    const lost = Math.ceil(this.s.squad * 0.5) + 3;
    this.addSpeed(-2 * this.hero.hitLoss);
    this.burstRed.explode(60, this.squadX, LINE_Y - 40);
    this.popNumber(this.squadX, LINE_Y - 150, '-' + lost, '#e0413a', 56);
    this.cameras.main.shake(500, 0.02);
    this.cameras.main.flash(200, 160, 20, 20);
    Sfx.bite();
    Sfx.bossRoar();
    this.banner('IT BROKE THROUGH', '#e0413a');
    this.setSquad(this.s.squad - lost);
  }

  bossDown(b) {
    b.disableBody(true, true);
    this.boss = null;
    this.s.bossActive = false;
    this.s.bosses++;
    this.s.kills++;
    this.s.score += Math.round(1000 * (this.s.wave / TUNING.bossEvery) * Math.ceil(this.effSpeed()));
    this.addSpeed(1.5);
    this.burstRed.explode(80, b.x, b.y);
    this.burstGold.explode(60, b.x, b.y);
    this.cameras.main.shake(400, 0.015);
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
    if (kind === 'div') return { kind, value: 2 };
    return { kind };
  }

  spawnGateRow() {
    const picks = Phaser.Utils.Array.Shuffle([this.goodGate(), Math.random() < 0.6 ? this.badGate() : this.goodGate()]);
    const row = { y: -CARD_H, cards: [], done: false };
    picks.forEach((p, i) => {
      const x = i === 0 ? W / 2 - CARD_W / 2 - 8 : W / 2 + CARD_W / 2 + 8;
      const c = this.add.container(x, row.y).setDepth(5);
      c.gate = p;
      c.shootable = p.kind === 'add';
      c.startValue = p.value || 0;
      c.bg = this.add.graphics();
      c.label = this.add.text(0, -12, '', textStyle(56, '#ffffff', { stroke: '#0b1412', strokeThickness: 8 })).setOrigin(0.5);
      c.sub = this.add.text(0, 44, '', textStyle(20, COLORS.text)).setOrigin(0.5);
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
      case 'trap': return { text: '-40%', sub: 'FIRE RATE', color: COLORS.bad };
      case 'bolt': return { text: '+50%', sub: 'BOLT SPEED', color: COLORS.speedGate };
      case 'slow': return { text: 'SLOW', sub: 'HORDE 5s', color: COLORS.speedGate };
    }
    return { text: '?', sub: '', color: COLORS.gold };
  }

  drawCard(c) {
    const info = this.cardInfo(c.gate);
    const g = c.bg;
    const hw = CARD_W / 2;
    const hh = CARD_H / 2;
    g.clear();
    g.fillStyle(0x0e1916, 0.82);
    g.fillRoundedRect(-hw, -hh, CARD_W, CARD_H, 14);
    g.fillStyle(info.color, 0.16);
    g.fillRoundedRect(-hw, -hh, CARD_W, CARD_H, 14);
    g.lineStyle(4, info.color, 1);
    g.strokeRoundedRect(-hw, -hh, CARD_W, CARD_H, 14);
    g.lineStyle(2, info.color, 0.6);
    g.strokeRoundedRect(-hw + 8, -hh + 8, CARD_W - 16, CARD_H - 16, 10);
    g.fillStyle(info.color, 1);
    [[-hw + 18, -hh + 18], [hw - 18, -hh + 18], [-hw + 18, hh - 18], [hw - 18, hh - 18]].forEach((p) => {
      g.fillTriangle(p[0], p[1] - 6, p[0] + 6, p[1], p[0], p[1] + 6);
      g.fillTriangle(p[0], p[1] - 6, p[0] - 6, p[1], p[0], p[1] + 6);
    });
    c.label.setText(info.text);
    c.label.setColor('#' + info.color.toString(16).padStart(6, '0'));
    c.sub.setText(c.shootable ? info.sub + '  (shoot me)' : info.sub);
    c.shownText = info.text;
  }

  hitCard(c) {
    const cap = c.startValue + 30 + this.s.wave * 3;
    c.gate.value = Math.min(cap, c.gate.value + 0.34);
    const info = this.cardInfo(c.gate);
    if (info.text !== c.shownText) {
      this.drawCard(c);
      c.label.setScale(1.25);
      this.tweens.add({ targets: c.label, scale: 1, duration: 120 });
      Sfx.gateTick();
    }
    this.burstBlue.explode(2, c.x + (Math.random() - 0.5) * 120, c.y + CARD_H / 2 - 10);
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
        msg = 'FIRE RATE -40%';
        s.speed = Math.max(1, s.speed * 0.6);
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
    this.popNumber(this.squadX, LINE_Y - 160, msg, good ? '#f2c14e' : '#e0413a', 44);
    if (good) {
      this.burstGold.explode(30, this.squadX, LINE_Y - 20);
      Sfx.gateGood();
    } else {
      this.burstRed.explode(30, this.squadX, LINE_Y - 20);
      this.cameras.main.shake(150, 0.006);
      Sfx.gateBad();
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
    t.setText(str).setColor(color).setFontSize(size).setPosition(x, y).setAlpha(1).setScale(1.3).setVisible(true);
    this.tweens.add({ targets: t, scale: 1, duration: 120, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: y - 70, alpha: 0, delay: 250, duration: 500, onComplete: () => t.setVisible(false) });
  }

  banner(title, color, subtitle) {
    const t = this.add.text(W / 2, 520, title, textStyle(70, color, { stroke: '#0b1412', strokeThickness: 10 }))
      .setOrigin(0.5).setDepth(60).setScale(0.4).setAlpha(0);
    const parts = [t];
    if (subtitle) {
      parts.push(this.add.text(W / 2, 590, subtitle, textStyle(28, COLORS.text, { stroke: '#0b1412', strokeThickness: 6 }))
        .setOrigin(0.5).setDepth(60).setAlpha(0));
    }
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    if (parts[1]) this.tweens.add({ targets: parts[1], alpha: 1, duration: 260, delay: 100 });
    this.tweens.add({ targets: parts, alpha: 0, delay: 1500, duration: 400, onComplete: () => parts.forEach((p) => p.destroy()) });
  }

  updateHud(eff) {
    const g = this.gauge;
    const cx = W / 2;
    const cy = 120;
    const r = 82;
    const a0 = Phaser.Math.DegToRad(135);
    const a1 = Phaser.Math.DegToRad(405);
    const ratio = clamp((eff - 1) / (TUNING.maxSpeed - 1), 0, 1);
    const color = ratio < 0.5
      ? lerpColor(COLORS.knight, COLORS.gold, ratio * 2)
      : lerpColor(COLORS.gold, COLORS.ember, (ratio - 0.5) * 2);
    g.clear();
    g.fillStyle(0x0a1310, 0.75);
    g.fillCircle(cx, cy, r + 22);
    g.lineStyle(18, 0x1d2a26, 1);
    g.beginPath();
    g.arc(cx, cy, r, a0, a1, false);
    g.strokePath();
    g.lineStyle(14, color, 1);
    g.beginPath();
    g.arc(cx, cy, r, a0, a0 + (a1 - a0) * Math.max(0.01, ratio), false);
    g.strokePath();
    for (let i = 0; i <= 9; i++) {
      const a = a0 + (a1 - a0) * (i / 9);
      g.lineStyle(3, 0x8fa8a0, 0.7);
      g.lineBetween(cx + Math.cos(a) * (r + 12), cy + Math.sin(a) * (r + 12), cx + Math.cos(a) * (r + 19), cy + Math.sin(a) * (r + 19));
    }
    const na = a0 + (a1 - a0) * ratio + Math.sin(this.elapsed * 40) * 0.01 * eff;
    g.lineStyle(5, 0xffffff, 1);
    g.lineBetween(cx, cy, cx + Math.cos(na) * (r - 16), cy + Math.sin(na) * (r - 16));
    g.fillStyle(color, 1);
    g.fillCircle(cx, cy, 9);

    this.speedText.setText('x' + eff.toFixed(1));
    this.speedText.setColor('#' + color.toString(16).padStart(6, '0'));
    this.speedText.setScale(1 + ratio * 0.15 + (this.s.surgeTimer > 0 ? 0.1 : 0));

    this.waveText.setText('WAVE ' + this.s.wave);
    this.waveBar.clear();
    this.waveBar.fillStyle(0x0a1310, 0.85);
    this.waveBar.fillRect(28, 74, 190, 10);
    this.waveBar.fillStyle(COLORS.gold, 1);
    this.waveBar.fillRect(28, 74, 190 * (this.s.bossActive ? 1 : this.s.waveTime / TUNING.waveLength), 10);
    this.scoreText.setText(String(this.s.score));

    const status = [];
    if (this.s.slowTimer > 0) status.push('HORDE SLOW ' + Math.ceil(this.s.slowTimer) + 's');
    if (this.s.surgeTimer > 0) status.push('SURGE ' + Math.ceil(this.s.surgeTimer) + 's');
    if (this.s.boltMult > 1) status.push('BOLTS x' + this.s.boltMult.toFixed(1));
    this.statusText.setText(status.join('\n'));

    if (this.surgeBtn) {
      const ready = this.s.surgeCd <= 0;
      const sg = this.surgeGfx;
      sg.clear();
      sg.fillStyle(0x0e1916, 0.9);
      sg.fillCircle(0, 0, 70);
      sg.lineStyle(6, ready ? COLORS.knight : 0x3a4a46, 1);
      sg.strokeCircle(0, 0, 70);
      if (!ready) {
        sg.lineStyle(6, COLORS.knight, 1);
        sg.beginPath();
        sg.arc(0, 0, 70, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - this.s.surgeCd / 20), false);
        sg.strokePath();
      }
      this.surgeText.setColor(ready ? '#ffffff' : '#5f6f6a');
    }
  }

  // ---------------------------------------------------------------- end

  gameOver() {
    if (this.s.over) return;
    this.s.over = true;
    Music.stop();
    Sfx.lose();
    this.physics.pause();
    this.cameras.main.shake(400, 0.012);
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
