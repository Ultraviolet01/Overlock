// The run itself: squad, horde, gates, barrels, boss, waves, and the speed HUD.

// scale is the sprite's display scale; r is the hit radius in screen pixels.
// unlock is the first wave a type can appear; weight(w) is its spawn weight.
// The first time a type shows up in a run, its name and tip are announced.
const ENEMIES = {
  walker: { key: 'walker', scale: 0.68, hp: 3, speed: 140, r: 28, bite: 1, pts: 10, gain: 0.025, unlock: 1, weight: () => 60 },
  sprinter: {
    key: 'sprinter', scale: 0.56, hp: 1.6, speed: 330, r: 24, bite: 1, pts: 15, gain: 0.04,
    unlock: 2, weight: (w) => 16 + w * 2, name: 'CRAWLER', tip: 'Fast. Shoot it early',
  },
  brute: {
    key: 'brute', scale: 0.86, hp: 16, speed: 90, r: 54, bite: 4, pts: 50, gain: 0.12, tag: true,
    unlock: 3, weight: (w) => 6 + w, name: 'BRUTE', tip: 'Tough, and bites hard',
  },
  wraith: {
    key: 'wraith', scale: 0.62, hp: 2.4, speed: 190, r: 26, bite: 1, pts: 20, gain: 0.05, zigzag: true,
    unlock: 4, weight: (w) => 8 + w, name: 'WRAITH', tip: 'Weaves across the road',
  },
  bloater: {
    key: 'bloater', scale: 0.62, hp: 9, speed: 80, r: 44, bite: 3, pts: 40, gain: 0.1, tag: true, explodes: true,
    unlock: 6, weight: (w) => 5 + w * 0.6, name: 'BLOATER', tip: 'Pop it to blast the horde around it',
  },
  shield: {
    key: 'shield', scale: 0.68, hp: 8, speed: 110, r: 32, bite: 2, pts: 35, gain: 0.08, tag: true, armor: 0.4,
    unlock: 7, weight: (w) => 6 + w, name: 'SHIELD SKELETON', tip: 'Its shield blocks most of each spell',
  },
  summoner: {
    key: 'summoner', scale: 0.7, hp: 10, speed: 75, r: 32, bite: 2, pts: 60, gain: 0.15, tag: true, summons: true,
    unlock: 9, weight: (w) => 3 + w * 0.3, name: 'NECROMANCER', tip: 'Stops and raises cultists. Kill it first',
  },
  splitter: {
    key: 'splitter', scale: 0.66, hp: 7, speed: 110, r: 36, bite: 2, pts: 30, gain: 0.08, tag: true, splits: true,
    unlock: 11, weight: (w) => 5 + w * 0.6, name: 'FLESH SLIME', tip: 'Splits in two when slain',
  },
  slimelet: { key: 'splitter', scale: 0.36, hp: 2, speed: 170, r: 20, bite: 1, pts: 8, gain: 0.02, unlock: 99, weight: () => 0 },
};

// Bosses take turns every 5th wave; each has its own attack. width is the
// display width in screen pixels at the squad line.
const BOSSES = [
  { key: 'boss', name: 'THE HORROR', tip: 'Slide out of the red lane before it slams', attack: 'slam', width: 300 },
  { key: 'colossus', name: 'BONE COLOSSUS', tip: 'Dodge the falling skulls', attack: 'boulders', width: 290 },
  { key: 'brood', name: 'BROOD MOTHER', tip: 'Her crawlers pour out. Keep firing', attack: 'brood', width: 360 },
  { key: 'wraithking', name: 'WRAITH KING', tip: 'Shoot when his shield drops', attack: 'shield', width: 280 },
];

function bossForWave(wave) {
  return BOSSES[(Math.max(1, Math.round(wave / TUNING.bossEvery)) - 1) % BOSSES.length];
}

const UNIT = {
  knight: { key: 'knight', scale: 0.56 },
  champion: { key: 'champion', scale: 0.62 },
};

const MERGE_SIZE = 10;         // this many wizards merge into one archmage
const MAX_UNITS = 40;          // sprites drawn for the squad
const MAX_CHAMPIONS = 30;
const SQUAD_MIN_X = 110;
const CARD_W = 290;
const GATE_GAP = 60;           // open space between the two gates of a row
const CARD_H = 180;
const SLAM_HALF_W = 95;
const MAX_SQUAD_RADIUS = 120; // keeps a big crowd narrow enough to dodge

// Camera: behind and above the squad, looking down the road at an angle, like
// Last War's battle view. The game logic stays in flat world coordinates
// (x across the road, y down the road, the squad at LINE_Y). At draw time every
// world object is projected: far things shrink toward the top, near things grow,
// and the road leans slightly to one side.
const VIEW = {
  horizon: -500,   // screen y the road would meet at infinite distance
  base: 880,       // screen y of the squad line
  depth: 900,      // camera distance; smaller means stronger perspective
  skew: 0.12,      // lean of the road, in screen x per screen y
  far: -520,       // world y at the top of the screen; things spawn just above it
  near: 1320,      // world y at the bottom of the screen
};

// h is height above the road in world pixels; only the 3D camera uses it.
function project(wx, wy, h) {
  if (World3D.active) return World3D.project(wx, wy, h);
  const z = LINE_Y - wy;
  const s = VIEW.depth / (VIEW.depth + z);
  const y = VIEW.horizon + (VIEW.base - VIEW.horizon) * s;
  const x = W / 2 + (wx - W / 2) * s + (y - VIEW.base) * VIEW.skew;
  return { x, y, s };
}

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
      overclock: 0,
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
    this.fadingCards = [];
    this.drag = null;
    this.units = 0;
    this.spacing = 26;
    this.champions = 0;
    this.slam = null;
    this.seen = { walker: true };
    this.rocks = [];

    this.createWorld();
    this.createSquad();
    this.createCombat();
    this.createHud();
    this.createInput();

    Sfx.resume();
    Music.start();
    this.events.once('shutdown', () => Music.stop());

    this.startIntro();
  }

  // ---------------------------------------------------------------- setup

  createWorld() {
    // In 3D, three.js draws the road, forest, models and shadows; the 2D
    // versions below are the fallback when WebGL or the models are missing.
    World3D.setActive(World3D.ready);
    this.events.once('shutdown', () => World3D.setActive(false));
    this.ground = this.add.graphics().setDepth(0);
    this.shadowGfx = this.add.graphics().setDepth(4.5);
    this.roadScroll = 0;
    this.decals = [];
    this.trees = [];
    for (let i = 0; i < (World3D.active ? 0 : 26); i++) {
      const left = i % 2 === 0;
      const t = this.add.image(0, 0, 'tree').setOrigin(0.5, 0.95).setDepth(3);
      t.x = left ? -10 - Math.random() * 70 : W + 10 + Math.random() * 70;
      t.y = VIEW.far + (i / 26) * (VIEW.near - VIEW.far + 200);
      t.setScale(1.2 + Math.random() * 0.5);
      this.trees.push(t);
    }

    this.streaks = [];
    for (let i = 0; i < 34; i++) {
      const s = this.add.image(0, 0, 'streak').setDepth(1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      this.resetStreak(s, true);
      this.streaks.push(s);
    }
    this.embers = [];
    for (let i = 0; i < 40; i++) {
      const e = this.add.image(Math.random() * W, VIEW.far + Math.random() * (VIEW.near - VIEW.far), 'dot').setDepth(2)
        .setTint(COLORS.ember).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3 + Math.random() * 0.5);
      e.drift = Math.random() * Math.PI * 2;
      this.embers.push(e);
    }
    this.add.image(W / 2, 0, 'fog').setOrigin(0.5, 0).setDepth(45);

    this.events.on('prerender', this.projectAll, this);
    this.events.on('render', this.restoreAll, this);
    // Scene events outlive a restart; without this, RUN AGAIN would project
    // twice per frame and leave the squad hidden.
    this.events.once('shutdown', () => {
      this.events.off('prerender', this.projectAll, this);
      this.events.off('render', this.restoreAll, this);
    });
  }

  // Before drawing, move every world object to its projected screen spot and
  // scale it by distance; after drawing, put the world coordinates back so
  // physics and game logic never see screen coordinates.
  projectAll() {
    const list = this.projected || (this.projected = []);
    list.length = 0;
    const sg = this.shadowGfx;
    sg.clear();
    const hidden = this.hidden3d || (this.hidden3d = []);
    hidden.length = 0;
    const is3d = World3D.active;
    if (is3d) World3D.sync(this);
    const add = (o, depthFromY, walker) => {
      if (!o || !o.visible) return;
      // Drawn as a 3D model; hide the 2D sprite while Phaser draws.
      if (is3d && depthFromY) {
        hidden.push(o);
        o.visible = false;
        return;
      }
      list.push(o);
      o._w = [o.x, o.y, o.scaleX, o.scaleY];
      const p = project(o.x, o.y, (o.h3 || 0) + (is3d ? (o.lift || 0) : 0));
      o.x = p.x;
      o.y = is3d ? p.y : p.y - (o.lift || 0) * p.s;
      o.setScale(o._w[2] * p.s, o._w[3] * p.s);
      if (!depthFromY) return;
      o.setDepth(10 + (o._w[1] + 1000) / 10000);
      // Shadow on the road at the feet, offset a little like a low sun.
      if (!o.lift) {
        const w = o.displayWidth * 0.7;
        sg.fillStyle(0x000000, 0.34);
        sg.fillEllipse(p.x + 8 * p.s, p.y + o.displayHeight * 0.42, w, w * 0.3);
      }
      // Walking: a step bob and a side-to-side sway, faster for faster enemies.
      if (walker) {
        const f = 6 + (o.def ? o.def.speed : 100) / 35;
        const ph = this.elapsed * f + (o.wobble || 0);
        o.y -= Math.abs(Math.sin(ph)) * 7 * p.s;
        o.setAngle(Math.sin(ph) * 5);
      }
    };
    this.trees.forEach((o) => add(o));
    this.streaks.forEach((o) => add(o));
    this.embers.forEach((o) => add(o));
    // In 3D the gates are standing models; the flat cards only draw in 2D.
    const gateCard = (c) => {
      if (!is3d) return add(c);
      if (c.visible) {
        hidden.push(c);
        c.visible = false;
      }
    };
    this.gateRows.forEach((row) => row.cards.forEach(gateCard));
    this.fadingCards.forEach(gateCard);
    this.barrels.getChildren().forEach((o) => { add(o, true); add(o.hpText); });
    this.enemies.getChildren().forEach((o) => { add(o, true, true); add(o.hpText); });
    this.bosses.getChildren().forEach((o) => add(o, true));
    (this.rocks || []).forEach((r) => add(r.img));
    this.knights.forEach((o) => add(o, true));
    this.bullets.getChildren().forEach((o) => add(o));
    add(this.squadLabel);
    add(this.squadHeart);
    if (this.airship) add(this.airship);
    if (this.drops) {
      this.drops.forEach((d) => {
        if (d.shadow) add(d.shadow);
        if (d.chute) add(d.chute);
      });
    }
  }

  restoreAll() {
    (this.hidden3d || []).forEach((o) => { o.visible = true; });
    const list = this.projected;
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      o.x = o._w[0];
      o.y = o._w[1];
      o.setScale(o._w[2], o._w[3]);
    }
    list.length = 0;
  }

  // Particle bursts live in screen space, so project the world point first.
  explode(emitter, count, wx, wy) {
    const p = project(wx, wy);
    emitter.explode(count, p.x, p.y);
  }

  // The road, drawn in perspective every frame: dark forest floor, the stone
  // road narrowing toward the top, scrolling stone joints and dark curbs.
  drawGround() {
    const g = this.ground;
    g.clear();
    g.fillStyle(0x0d1a15, 1);
    g.fillRect(0, 0, W, H);
    const top = VIEW.far - 40;
    const bot = VIEW.near + 40;
    const corner = (x, y) => project(x, y);
    const tl = corner(80, top);
    const tr = corner(640, top);
    const br = corner(640, bot);
    const bl = corner(80, bot);
    g.fillStyle(0x2a3431, 1);
    g.fillPoints([tl, tr, br, bl].map((p) => new Phaser.Geom.Point(p.x, p.y)), true);

    // Stone joints: rows every 64 world units, staggered vertical joints.
    const step = 64;
    const off = this.roadScroll % step;
    g.lineStyle(3, 0x1b2421, 1);
    let row = Math.floor(this.roadScroll / step);
    for (let y = top - step + off; y < bot; y += step) {
      row--;
      const a = corner(80, y);
      const b = corner(640, y);
      g.lineBetween(a.x, a.y, b.x, b.y);
      const shift = (row & 1) ? 45 : 0;
      for (let x = 80 + 90 - shift; x < 640; x += 90) {
        const c = corner(x, y);
        const d = corner(x, y + step);
        g.lineBetween(c.x, c.y, d.x, d.y);
      }
    }
    // Lane dashes down the middle, like road markings, moving with speed.
    g.fillStyle(0x56625e, 1);
    for (let y = top - 160 + (this.roadScroll % 160); y < bot; y += 160) {
      const a = corner(352, y);
      const b = corner(368, y);
      const c = corner(368, y + 70);
      const d = corner(352, y + 70);
      g.fillPoints([a, b, c, d].map((p) => new Phaser.Geom.Point(p.x, p.y)), true);
    }
    // Curbs.
    g.lineStyle(10, 0x08120e, 1);
    g.lineBetween(tl.x, tl.y, bl.x, bl.y);
    g.lineBetween(tr.x, tr.y, br.x, br.y);
    g.lineStyle(4, 0x3e4a46, 1);
    const tl2 = corner(86, top);
    const bl2 = corner(86, bot);
    const tr2 = corner(634, top);
    const br2 = corner(634, bot);
    g.lineBetween(tl2.x, tl2.y, bl2.x, bl2.y);
    g.lineBetween(tr2.x, tr2.y, br2.x, br2.y);
  }

  resetStreak(s, anywhere) {
    const side = Math.random() < 0.5;
    s.x = side ? 20 + Math.random() * 90 : W - 20 - Math.random() * 90;
    if (Math.random() < 0.3) s.x = 100 + Math.random() * (W - 200);
    s.y = anywhere ? VIEW.far + Math.random() * (VIEW.near - VIEW.far) : VIEW.far - 100 - Math.random() * 300;
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
    this.squadHeart = this.add.image(this.squadX, LINE_Y - 90, 'heart').setDepth(46);
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
    this.bestWave = (Store.get('best', null) || {}).wave || 0;
    this.bestStrip = uiStrip(this, sx + 340, py + 24, 'skull', 0.85, 26, '#f2c14e').setDepth(50);
    this.bestStrip.icon.setTint(0xf2c14e);
    this.bestStrip.set('BEST ' + this.bestWave);
    if (!this.bestWave) this.bestStrip.setVisible(false);
    this.statusText = this.add.text(px - 2, py + ps + 46, '', textStyle(20, '#4fe0c8', { strokeThickness: 4, lineSpacing: 4 }))
      .setDepth(51);

    this.pauseBtn = uiIconButton(this, W - 52, 54, 'pause', () => this.pauseGame(), 72).setDepth(52);

    // Boss bar: a huge outlined number sitting on a fat red bar.
    this.bossBar = this.add.graphics().setDepth(51);
    this.bossNum = this.add.text(W / 2, 170, '', textStyle(54, '#ffffff', { fontStyle: 'italic' }))
      .setOrigin(0.5).setDepth(52).setVisible(false);

    // Fire rate meter at the bottom: flame, big slanted number, fat bar.
    this.fireBar = this.add.graphics().setDepth(50);
    this.add.image(46, H - 70, 'icon_flame').setScale(1.2).setDepth(52);
    this.speedText = this.add.text(84, H - 104, 'x1.0', textStyle(60, '#ffffff', { fontStyle: 'italic' }))
      .setOrigin(0, 0.5).setDepth(52);
    this.speedLabel = this.add.text(470, H - 118, 'SPEED', textStyle(22, '#ffffff', { strokeThickness: 4 })).setOrigin(1, 0.5).setDepth(52);
    this.multText = this.add.text(470, H - 92, 'SCORE x1', textStyle(22, '#f2c14e', { strokeThickness: 4 })).setOrigin(1, 0.5).setDepth(52);
    this.edgeGlow = this.add.image(W / 2, H / 2, 'edgeglow').setDisplaySize(W, H).setDepth(49)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);

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
      if (this.tutorial) this.tutorial.moved += Math.abs(p.x - p.prevPosition.x);
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

  // How fast spells fly out at a given speed: x5 speed fires 10 times as fast.
  fireMult(eff) {
    return 1 + (eff - 1) * 2.25;
  }

  // More wizards hit harder, but with diminishing returns, so a huge squad
  // from multiply gates cannot steamroll the horde.
  squadPower() {
    const n = this.s.squad;
    return n <= 5 ? n : 5 * Math.pow(n / 5, TUNING.powerCurve);
  }

  // Every point of score is multiplied by the current speed.
  scoreMult() {
    return Math.max(1, Math.floor(this.effSpeed() + 0.001));
  }

  waveScale() {
    const w = this.s.wave - 1;
    return 1 + w * 0.6 + w * w * TUNING.hpCurve;
  }

  hordeMult() {
    return (1 + (this.s.wave - 1) * 0.09) * (this.s.slowTimer > 0 ? 0.45 : 1);
  }

  addSpeed(delta) {
    this.s.speed = clamp(this.s.speed + delta, 1, TUNING.maxSpeed);
  }

  setSquad(n, silent) {
    const prev = this.s.squad;
    if (!silent && n < prev) this.wizardsFall(prev - Math.max(0, Math.round(n)));
    this.s.squad = clamp(Math.round(n), 0, TUNING.squadCap);
    this.s.maxSquad = Math.max(this.s.maxSquad, this.s.squad);
    this.squadLabel.setText(String(this.s.squad));
    this.layoutSquad(silent);
    if (!silent && prev !== this.s.squad) {
      this.tweens.killTweensOf(this.squadLabel);
      this.squadLabel.setScale(1.35);
      this.tweens.add({ targets: this.squadLabel, scale: 1, duration: 220, ease: 'Back.easeOut' });
      if (this.s.squad < prev) {
        this.squadLabel.setColor('#ff5a4f');
        this.squadHeart.setTintFill(0xffffff);
        if (this.hurtTimer) this.hurtTimer.remove();
        this.hurtTimer = this.time.delayedCall(260, () => {
          this.squadLabel.setColor('#ffffff');
          this.squadHeart.clearTint();
        });
      }
    }
    if (this.s.squad <= 0) this.gameOver();
  }

  // Lost wizards fall over in red and fade, and the whole squad flashes red,
  // so every hit reads clearly even when merging hides the count change.
  wizardsFall(lost) {
    const alive = this.knights.slice(0, this.units).filter((k) => k.visible);
    if (!alive.length) return;
    alive.forEach((k) => { k.hitFlash = 0.3; });
    const n = Math.min(lost, 10);
    for (let i = 0; i < n; i++) {
      const k = alive[(i * 7) % alive.length];
      const p = project(k.x + (Math.random() - 0.5) * 30, k.y + (Math.random() - 0.5) * 16);
      const side = Math.random() < 0.5 ? -1 : 1;
      const body = this.add.image(p.x, p.y, k.isChampion ? 'champion' : 'knight')
        .setOrigin(0.5, 1).setScale((k.isChampion ? UNIT.champion : UNIT.knight).scale * p.s)
        .setTintFill(0xe0413a).setDepth(45);
      this.tweens.add({ targets: body, angle: side * 85, x: p.x + side * 26 * p.s, duration: 320, delay: i * 40, ease: 'Quad.easeIn' });
      this.tweens.add({ targets: body, alpha: 0, y: p.y + 10, duration: 380, delay: 420 + i * 40, onComplete: () => body.destroy() });
      this.explode(this.burstRed, 8, k.x, k.y - 20);
    }
  }

  // Every MERGE_SIZE knights merge into one champion, so big squads stay readable.
  layoutSquad(silent) {
    const n = this.s.squad;
    const champs = Math.min(MAX_CHAMPIONS, Math.floor(n / MERGE_SIZE));
    const singles = Math.min(MERGE_SIZE - 1, n - champs * MERGE_SIZE);
    if (!silent && champs > this.champions) {
      this.explode(this.burstBlue, 24, this.squadX, LINE_Y - 20);
      this.popNumber(this.squadX, LINE_Y - 290, 'CHAMPION RISES', '#4fc3ff', 30);
    }
    this.champions = champs;
    this.units = champs + singles;
    const base = champs > 0 ? 40 : 32;
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

    if (this.introActive) {
      this.updateIntro(dt);
      this.updateSpeedFx(dt, 1);
      this.updateHud(1);
      return;
    }
    this.updateTutorial(dt);
    this.updateAirship(dt);

    if (s.slowTimer > 0) s.slowTimer -= dt;
    if (s.surgeTimer > 0) s.surgeTimer -= dt;
    if (s.surgeCd > 0) s.surgeCd -= dt;
    if (s.overclock > 0) {
      s.overclock -= dt;
      if (s.overclock <= 0) this.endOverclock();
    } else if (s.speed >= TUNING.maxSpeed) {
      this.startOverclock();
    } else {
      this.addSpeed(TUNING.speedClimb * dt);
    }

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
    this.updateEnemies(dt);
    if (s.over) return;
    this.updateBarrels(dt);
    if (s.over) return;
    this.decals.length = 0;
    this.updateBoss(dt);
    if (s.over) return;
    this.updateGates(dt);
    if (s.over) return;
    this.updateSpawning(dt);
    this.updateWaves(dt);
    this.updateSpeedFx(dt, eff);
    this.updateHud(eff);
  }

  // ---------------------------------------------------------------- opening drop

  // Like Last War's opening: a transport hovers over the road, the squad
  // parachutes down to its spot, the transport flies off, then the run starts.
  startIntro() {
    this.introActive = true;
    this.introT = 0;
    this.squadLabel.setVisible(false);
    this.squadHeart.setVisible(false);
    this.airship = this.add.image(W / 2, LINE_Y - 400, 'airship').setDepth(40).setScale(World3D.active ? 0.85 : 1.45);
    this.airship.lift = 260;
    this.drops = [];
    for (let i = 0; i < this.units; i++) {
      const kn = this.knights[i];
      kn.setVisible(false);
      this.drops.push({
        kn,
        chute: this.add.image(0, 0, 'chute').setDepth(21).setVisible(false).setScale(kn.isChampion ? 0.9 : 0.7),
        shadow: this.add.image(0, 0, 'shadow').setDepth(4).setVisible(false),
        start: 0.7 + i * 0.25,
        dur: 1.7,
        landed: false,
      });
    }
    Sfx.tone(70, 1.6, 'sawtooth', 0.05, 0, 90);
  }

  updateIntro(dt) {
    this.introT += dt;
    const t = this.introT;
    const a = this.airship;
    const last = this.drops.length ? this.drops[this.drops.length - 1].start : 0;
    if (a && t > last + 0.5) a.leaving = true;
    this.updateAirship(dt);

    let allLanded = true;
    for (const d of this.drops) {
      if (d.landed) continue;
      allLanded = false;
      if (t < d.start) continue;
      if (!d.from) {
        d.from = { x: (a ? a.x : W / 2) + (Math.random() - 0.5) * 80, y: (a ? a.y : LINE_Y - 400) + 20, lift: 200 };
      }
      const k = Math.min(1, (t - d.start) / d.dur);
      const e = 1 - (1 - k) * (1 - k);
      const kn = d.kn;
      const tx = this.squadX + kn.off.x;
      const ty = LINE_Y + kn.off.y;
      kn.setVisible(true);
      kn.x = d.from.x + (tx - d.from.x) * e;
      kn.y = d.from.y + (ty - d.from.y) * e;
      kn.lift = d.from.lift * (1 - e) + Math.sin(k * Math.PI * 3) * 6 * (1 - k);
      d.chute.setVisible(true).setPosition(kn.x, kn.y);
      d.chute.lift = kn.lift + (kn.isChampion ? 130 : 110);
      d.chute.setAngle(Math.sin(t * 3 + kn.phase) * 6);
      d.shadow.setVisible(true).setPosition(kn.x, kn.y + 6).setScale(0.5 + 0.5 * e).setAlpha(0.3 + 0.5 * e);
      if (k >= 1) {
        d.landed = true;
        kn.lift = 0;
        const chute = d.chute;
        d.chute = null;
        this.tweens.add({ targets: chute, alpha: 0, scaleY: 0.2, duration: 300, onComplete: () => chute.destroy() });
        d.shadow.destroy();
        d.shadow = null;
        this.explode(this.burstGold, 8, kn.x, kn.y);
        Sfx.tone(130, 0.14, 'sine', 0.18, 0, 60);
      }
    }
    if (allLanded && this.drops.length) this.finishIntro();
  }

  // Hovers until the drop is done, then flies off to the right and is removed.
  updateAirship(dt) {
    const a = this.airship;
    if (!a) return;
    if (!a.leaving) {
      a.lift = 260 + Math.sin(this.introT * 2.2) * 12;
      return;
    }
    a.x += 900 * dt;
    a.lift += 120 * dt;
    if (project(a.x, a.y).x > W + 260) {
      a.destroy();
      this.airship = null;
    }
  }

  finishIntro() {
    this.introActive = false;
    if (this.airship) this.airship.leaving = true;
    this.knights.forEach((k) => { k.lift = 0; });
    this.squadLabel.setVisible(true);
    this.squadHeart.setVisible(true);
    this.banner('WAVE 1', '#f2c14e', 'Hold the road');
    this.startTutorial();
  }

  // "Swipe left or right" hint with a sliding hand, for the first few runs.
  startTutorial() {
    const runs = Store.get('tutorialRuns', 0);
    if (runs >= 3) return;
    Store.set('tutorialRuns', runs + 1);
    const y = 1000;
    const c = this.add.container(0, 0).setDepth(55);
    const g = this.add.graphics();
    const arrow = (x1, x2) => {
      const dir = Math.sign(x2 - x1);
      g.lineStyle(10, 0x0a0f0e, 0.9);
      g.lineBetween(x1, y + 64, x2, y + 64);
      g.lineStyle(5, 0xffffff, 1);
      g.lineBetween(x1, y + 64, x2, y + 64);
      g.fillStyle(0x0a0f0e, 0.9);
      g.fillTriangle(x2 + dir * 22, y + 64, x2 - dir * 6, y + 46, x2 - dir * 6, y + 82);
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(x2 + dir * 16, y + 64, x2 - dir * 2, y + 51, x2 - dir * 2, y + 77);
    };
    arrow(300, 150);
    arrow(420, 570);
    const txt = this.add.text(W / 2, y, 'SWIPE LEFT OR RIGHT TO MOVE YOUR WIZARDS', textStyle(24, '#ffffff')).setOrigin(0.5);
    const hand = this.add.image(W / 2, y + 100, 'hand');
    c.add([g, txt, hand]);
    this.tweens.add({ targets: hand, x: { from: 270, to: 450 }, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tutorial = { c, t: 0, moved: 0 };
  }

  updateTutorial(dt) {
    const tu = this.tutorial;
    if (!tu) return;
    tu.t += dt;
    if (this.keys.LEFT.isDown || this.keys.RIGHT.isDown || this.keys.A.isDown || this.keys.D.isDown) tu.moved += 600 * dt;
    if (tu.t > 6 || tu.moved > 160) {
      this.tutorial = null;
      this.tweens.add({ targets: tu.c, alpha: 0, duration: 300, onComplete: () => tu.c.destroy() });
    }
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
      kn.glow = this.s.overclock > 0;
      if (kn.hitFlash > 0) {
        kn.hitFlash -= dt;
        kn.setTint(0xff5a50);
      } else if (kn.glow) {
        kn.setTint(0x9fefff);
      } else if (kn.isTinted) {
        kn.clearTint();
      }
    }
    const spread = this.squadSpread();
    if (World3D.active) {
      this.squadLabel.setPosition(this.squadX, LINE_Y - spread * 0.55);
      this.squadLabel.h3 = 170;
    } else {
      this.squadLabel.setPosition(this.squadX, LINE_Y - 100 - spread * 0.55);
    }
    this.squadHeart.setPosition(this.squadX - this.squadLabel.width / 2 - 30, this.squadLabel.y);
    this.squadHeart.h3 = this.squadLabel.h3;
  }

  // ---------------------------------------------------------------- shooting

  updateFiring(dt, eff) {
    const interval = this.hero.interval / this.fireMult(eff);
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
    const dmg = this.hero.damage * this.s.dmgMult * this.squadPower() / shooters;
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
      b.h3 = 55;
      b.pierce = this.s.pierce + (this.s.overclock > 0 ? 2 : 0);
      b.lastHit = null;
    }
    const kn = this.knights[Math.floor(Math.random() * shown)];
    const fp = project(kn.x, kn.y - 30);
    const f = this.add.image(fp.x, fp.y, 'flash').setDepth(31).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.5 + eff * 0.08);
    this.tweens.add({ targets: f, alpha: 0, scale: f.scale * 1.6, duration: 90, onComplete: () => f.destroy() });
    Sfx.shoot(eff);
    if (eff > 4) this.shake(50, 0.0008 * eff);
  }

  killBullet(b) {
    b.disableBody(true, true);
  }

  updateBullets() {
    const list = this.bullets.getChildren();
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.active) continue;
      if (b.y < VIEW.far - 60) {
        this.killBullet(b);
        continue;
      }
      for (const row of this.gateRows) {
        if (row.done || b.y > row.y + CARD_H / 2 || b.y < row.y - CARD_H / 2) continue;
        const card = row.cards[b.x < W / 2 ? 0 : 1];
        // Bolts fly on through the gate, counting once per gate on the way.
        if (card && card.shootable && b.gateRow !== row && Math.abs(b.x - card.x) <= CARD_W / 2) {
          b.gateRow = row;
          this.hitCard(card);
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
    if (e.isBoss && e.immune) {
      if (this.elapsed - e.lastNum > 0.3) {
        this.popNumber(e.x + (Math.random() - 0.5) * 120, e.y - 60, 'IMMUNE', '#7fd3ff', 30);
        e.lastNum = this.elapsed;
      }
      return;
    }
    if (e.def && e.def.armor) dmg *= e.def.armor;
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

  spawnEnemy(type, x, y) {
    const def = ENEMIES[type];
    if (y === undefined) y = VIEW.far - 40;
    const e = this.enemies.get(x, y, def.key);
    if (!e) return null;
    e.setTexture(def.key);
    e.enableBody(true, x, y, true, true);
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
    e.latched = false;
    e.wobble = Math.random() * Math.PI * 2;
    e.summonT = 2;
    if (def.name && !this.seen[type]) {
      this.seen[type] = true;
      this.notice('NEW: ' + def.name, def.tip);
    }
    return e;
  }

  // A smaller announcement than a banner, for new enemy types. Several in a
  // row wait their turn instead of stacking.
  notice(title, sub) {
    const now = this.time.now;
    const at = Math.max(now, this.noticeFree || 0);
    this.noticeFree = at + 2600;
    if (at > now) {
      this.time.delayedCall(at - now, () => this.showNotice(title, sub));
      return;
    }
    this.showNotice(title, sub);
  }

  showNotice(title, sub) {
    const t = this.add.text(W / 2, 360, title, textStyle(44, '#ff8a7a', { fontStyle: 'italic' })).setOrigin(0.5).setDepth(58).setAlpha(0);
    const t2 = this.add.text(W / 2, 408, sub, textStyle(24, '#ffffff')).setOrigin(0.5).setDepth(58).setAlpha(0);
    this.tweens.add({ targets: [t, t2], alpha: 1, duration: 200 });
    this.tweens.add({ targets: [t, t2], alpha: 0, delay: 2000, duration: 400, onComplete: () => { t.destroy(); t2.destroy(); } });
  }

  updateSpawning(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    // Keep the road readable (and phones smooth): later waves get tougher
    // enemies rather than an endless swarm.
    if (this.enemies.countActive() >= TUNING.maxEnemies) return;
    const w = this.s.wave;
    const base = Math.max(0.12, 1.0 / (1 + (w - 1) * 0.35));
    this.spawnTimer = base * (this.s.bossActive ? 2.6 : 1) * (0.7 + Math.random() * 0.6);

    const summoners = this.enemies.getChildren().filter((e) => e.active && e.def && e.def.summons).length;
    const type = weighted(Object.keys(ENEMIES).map((k) => {
      const d = ENEMIES[k];
      if (w < d.unlock || (d.summons && summoners >= 2)) return [k, 0];
      return [k, d.weight(w)];
    }));
    const x = 130 + Math.random() * (W - 260);
    if (type === 'walker') {
      const n = 1 + Math.floor(Math.random() * Math.min(5, 1 + w * 0.5));
      for (let i = 0; i < n; i++) this.spawnEnemy('walker', clamp(x + (i - (n - 1) / 2) * 46, 110, W - 110));
    } else {
      this.spawnEnemy(type, x);
    }
    // Later waves send extra enemies alongside each spawn.
    const extra = Math.min(2, Math.floor(w / TUNING.extraEvery));
    for (let i = 0; i < extra; i++) this.spawnEnemy(w >= 3 && Math.random() < 0.4 ? 'sprinter' : 'walker', 130 + Math.random() * (W - 260));
  }

  updateEnemies(dt) {
    const mult = this.hordeMult();
    const list = this.enemies.getChildren();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) {
        if (e.hpText) e.hpText.setVisible(false);
        continue;
      }
      if (e.def.tag) this.hpTag(e, e.y + 34);
      let vy = e.def.speed * mult;
      let vx;
      if (e.y > 620) {
        vx = clamp((this.squadX - e.x) * 1.3, -170 * mult, 170 * mult);
      } else if (e.def.zigzag) {
        vx = Math.sin(this.elapsed * 3.2 + e.wobble) * 230 * mult;
      } else {
        vx = Math.sin(this.elapsed * 2 + e.wobble) * 30;
      }
      if (e.def.zigzag && e.x < 110) vx = Math.abs(vx);
      if (e.def.zigzag && e.x > W - 110) vx = -Math.abs(vx);
      // The necromancer stops partway down the road and raises cultists.
      if (e.def.summons && e.y > 320) {
        vy = 0;
        vx = Math.sin(this.elapsed + e.wobble) * 40;
        e.summonT -= dt;
        if (e.summonT <= 0) {
          e.summonT = 3.2;
          this.explode(this.burstRot, 12, e.x, e.y);
          for (const off of [-50, 50]) this.spawnEnemy('walker', clamp(e.x + off, 110, W - 110), e.y + 30);
        }
      }
      // Enemies that reach the squad stay on its front line and keep biting
      // until they are shot down.
      const front = LINE_Y - this.squadSpread() * 0.55 - 34;
      if (!e.latched && e.y >= front) {
        e.latched = true;
        e.biteT = 0;
      }
      if (e.latched) {
        e.y = front;
        vy = 0;
        vx = clamp((this.squadX + (e.wobble % 1 - 0.5) * this.squadSpread() - e.x) * 4, -400, 400);
        e.biteT -= dt;
        if (e.biteT <= 0) {
          e.biteT = 0.9;
          this.bite(e);
        }
      }
      e.setVelocity(vx, vy);
      e.setFlipX(vx < -20);
      this.applyHitFlash(e);
      if (this.s.over) return;
    }
  }

  // Health painted right on the object as a big outlined number.
  hpTag(o, y) {
    if (!o.hpText) {
      o.hpText = this.add.text(0, 0, '', textStyle(30, '#ffffff', { fontStyle: 'italic' })).setOrigin(0.5).setDepth(35);
    }
    if (o.isBarrel && !o.hpText.barrelStyle) {
      o.hpText.barrelStyle = true;
      o.hpText.setFontSize(44).setColor('#7fe8ff').setStroke('#0a0f0e', 8);
    }
    if (World3D.active) {
      y = o.y;
      o.hpText.h3 = o.isBarrel ? 150 : (MODEL_SIZE[o.def ? o.def.key : 'barrel'] || 1) * 100 + 30;
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
    // Big squads lose a share of themselves, so size alone is no shield.
    const lost = Math.max(e.def.bite * Math.ceil(this.s.wave / 3), Math.ceil(this.s.squad * TUNING.biteShare * e.def.bite));
    this.addSpeed(-0.3 * e.def.bite * this.hero.hitLoss);
    this.explode(this.burstRed, 14, e.x, LINE_Y - 10);
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
    this.s.score += e.def.pts * this.scoreMult();
    this.addSpeed(e.def.gain * 2);
    const green = e.def.key === 'sprinter' || e.def.key === 'wraith' || e.def.key === 'bloater';
    this.explode(green ? this.burstRot : this.burstRed, e.def.tag ? 26 : 10, e.x, e.y);
    Sfx.kill();
    if (e.def.explodes) this.blast(e.x, e.y);
    if (e.def.splits) {
      for (const off of [-34, 34]) this.spawnEnemy('slimelet', clamp(e.x + off, 110, W - 110), e.y);
    }
  }

  // A popped bloater hurts every horde unit near it, which can chain.
  blast(x, y) {
    const dmg = 8 * this.waveScale();
    this.explode(this.burstRot, 50, x, y);
    this.explode(this.burstGold, 20, x, y);
    this.shake(160, 0.008);
    Sfx.noise(0.35, 0.18, 0, 500, 'lowpass');
    this.enemies.getChildren().forEach((o) => {
      if (!o.active) return;
      const dx = o.x - x;
      const dy = o.y - y;
      if (dx * dx + dy * dy < 150 * 150) this.damage(o, dmg);
    });
  }

  // ---------------------------------------------------------------- rune barrels

  // A barrel rolls down a lane. Break it for an upgrade, or it crashes into the squad.
  spawnBarrel() {
    const x = 150 + Math.random() * (W - 300);
    const b = this.barrels.get(x, VIEW.far - 40, 'barrel');
    if (!b) return;
    b.enableBody(true, x, VIEW.far - 40, true, true);
    b.setCircle(44, b.width / 2 - 44, b.height / 2 - 44);
    b.setDepth(9).clearTint().setScale(1).setAngle(0);
    if (!this.seen.barrel) {
      this.seen.barrel = true;
      this.notice('RUNE BARREL', 'Shoot it open for a reward');
    }
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
    const bar = this.barrelBar || (this.barrelBar = this.add.graphics().setDepth(34));
    bar.clear();
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.active) {
        if (b.hpText) b.hpText.setVisible(false);
        continue;
      }
      this.hpTag(b, b.y - 100);
      this.drawBarrelBar(bar, b);
      b.setVelocity(0, fall);
      b.setAngle(90 + Math.sin(this.elapsed * 4 + b.x) * 6);
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

  // A health bar over the barrel that drains as it is shot.
  drawBarrelBar(g, b) {
    const p = World3D.active ? project(b.x, b.y, 112) : project(b.x, b.y - 66);
    const w = 120 * p.s;
    const h = 16 * p.s;
    const x = p.x - w / 2;
    const y = p.y - h / 2;
    const ratio = clamp(b.hp / b.maxHp, 0, 1);
    g.fillStyle(0x0a0f0e, 0.9);
    g.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, h / 2 + 3);
    g.fillStyle(0x1b2a2e, 1);
    g.fillRoundedRect(x, y, w, h, h / 2);
    if (ratio > 0.02) {
      g.fillStyle(0x4fe0ff, 1);
      g.fillRoundedRect(x, y, Math.max(h, w * ratio), h, h / 2);
      g.fillStyle(0xffffff, 0.35);
      g.fillRoundedRect(x + 2, y + 2, Math.max(h, w * ratio) - 4, h * 0.35, h * 0.2);
    }
  }

  startOverclock() {
    const s = this.s;
    s.overclock = TUNING.overclockTime;
    this.banner('OVERCLOCK!', '#4fe0ff', 'Spells pierce. Max speed');
    this.cameras.main.flash(160, 79, 224, 255);
    this.shake(250, 0.008);
    Sfx.surge();
    vibrate(60);
  }

  endOverclock() {
    this.s.overclock = 0;
    this.s.speed = TUNING.maxSpeed * 0.7;
  }

  barrelCrash(b) {
    b.disableBody(true, true);
    const lost = Math.ceil(this.s.squad * 0.15) + 2;
    this.explode(this.burstGold, 30, b.x, LINE_Y - 20);
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
      msg = 'PIERCING SPELLS ' + s.pierce;
    } else if (reward === 'power') {
      s.dmgMult *= 1.3;
      msg = 'SPELL DAMAGE +30%';
    } else {
      const n = 5 + s.wave * 2;
      msg = '+' + n + ' WIZARDS';
      this.setSquad(s.squad + n);
    }
    this.explode(this.burstGold, 40, b.x, b.y);
    this.explode(this.burstBlue, 30, b.x, b.y);
    this.popNumber(b.x, b.y - 40, msg, '#4fe0c8', 34);
    this.addSpeed(0.3);
    Sfx.gateGood();
  }

  // ---------------------------------------------------------------- boss

  spawnBoss() {
    const def = bossForWave(this.s.wave);
    const b = this.bosses.get(W / 2, VIEW.far - 120, def.key);
    if (!b) return;
    b.setTexture(def.key);
    b.enableBody(true, W / 2, VIEW.far - 120, true, true);
    b.def = def;
    b.baseScale = def.width / b.width;
    b.setScale(b.baseScale);
    const rt = (def.width * 0.42) / b.baseScale;
    b.setCircle(rt, b.width / 2 - rt, b.height / 2 - rt);
    b.atkTimer = 2.2;
    b.immune = false;
    b.setDepth(11).clearTint();
    b.isBoss = true;
    b.isBarrel = false;
    b.reached = false;
    b.smashT = undefined;
    // At least the wave's base health, and at least about 8 seconds of the
    // squad's current firepower, so a huge squad still gets a real fight.
    const dps = this.squadPower() * this.hero.damage * this.s.dmgMult * this.fireMult(this.effSpeed()) / this.hero.interval;
    // Each boss in the run is tougher: the first can be beaten before it
    // reaches the squad, later ones carry more of the squad's firepower in health.
    const nth = Math.max(1, Math.round(this.s.wave / TUNING.bossEvery));
    const secs = Math.min(TUNING.bossSeconds, 7 + (nth - 1) * 3);
    b.maxHp = Math.max(1500 * Math.pow(this.s.wave / TUNING.bossEvery, 1.7), dps * secs);
    b.hp = b.maxHp;
    b.dmgAcc = 0;
    b.lastNum = 0;
    b.hitFlash = 0;
    b.startY = VIEW.far - 120;
    b.endY = LINE_Y - 260;
    b.slamTimer = 2.5;
    this.boss = b;
    this.slam = null;
    this.s.bossActive = true;
    this.rocks = [];
    this.banner(def.name, '#e0413a', def.tip);
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
    b.setScale(b.baseScale * (1 + Math.sin(this.elapsed * 6) * 0.02));

    this.slamGfx.clear();
    if (b.def.attack === 'slam') this.updateSlam(b, dt);
    else if (b.def.attack === 'boulders') this.updateBoulders(b, dt);
    else if (b.def.attack === 'brood') this.updateBrood(b, dt);
    else if (b.def.attack === 'shield') this.updateShield(b, dt);
    if (this.s.over || !b.active) return;

    const hpRatio = clamp(b.hp / b.maxHp, 0, 1);
    const reach = clamp((b.y - b.startY) / (b.endY - b.startY), 0, 1);
    this.drawBossBar(hpRatio, reach, b.hp);

    if (b.y >= b.endY) {
      b.y = b.endY;
      b.setVelocity(0, 0);
      b.smashT = (b.smashT === undefined ? 0 : b.smashT) - dt;
      if (b.smashT <= 0) {
        b.smashT = 1.7;
        this.bossSmash(b);
      }
    }
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
      b.slamTimer = Math.max(2, 3.4 - this.s.wave * 0.05) * TUNING.bossAttackGap;
      Sfx.tone(180, 0.3, 'sawtooth', 0.08, 0, 120);
    }
    const sl = this.slam;
    sl.t -= dt;
    const top = Math.max(VIEW.far, b.y);
    const lane = [
      project(sl.x - SLAM_HALF_W, top), project(sl.x + SLAM_HALF_W, top),
      project(sl.x + SLAM_HALF_W, VIEW.near), project(sl.x - SLAM_HALF_W, VIEW.near),
    ].map((p) => new Phaser.Geom.Point(p.x, p.y));
    const pulse = 0.18 + 0.14 * Math.sin(this.elapsed * 30);
    if (World3D.active) {
      this.decals.push({ k: 'lane', x: sl.x, y0: top, y1: VIEW.near, w: SLAM_HALF_W * 2, a: pulse + 0.25 + (1 - sl.t / sl.warn) * 0.25 });
    } else {
      g.fillStyle(COLORS.horde, pulse + (1 - sl.t / sl.warn) * 0.2);
      g.fillPoints(lane, true);
      g.lineStyle(4, COLORS.horde, 0.9);
      g.strokePoints(lane, true);
    }
    if (sl.t > 0) return;

    this.slam = null;
    const flash = this.add.graphics().setDepth(32);
    flash.fillStyle(0xffd0c0, 0.7);
    flash.fillPoints(lane, true);
    this.tweens.add({ targets: flash, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
    for (let y = top + 80; y < VIEW.near; y += 160) this.explode(this.burstRed, 8, sl.x, y);
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

  // Bone Colossus: marks spots on the road (one under the squad), then skulls
  // crash down on them. Move off the marked spot.
  updateBoulders(b, dt) {
    b.atkTimer -= dt;
    if (b.atkTimer <= 0) {
      b.atkTimer = Math.max(1.6, 2.7 - this.s.wave * 0.03) * TUNING.bossAttackGap;
      const xs = [this.squadX, 140 + Math.random() * 440, 140 + Math.random() * 440];
      xs.forEach((x, i) => {
        const img = this.add.image(x, LINE_Y, 'skull').setScale(2.6).setDepth(33);
        img.lift = 700;
        this.rocks.push({ x, y: LINE_Y + (i === 0 ? 0 : (Math.random() - 0.5) * 120), t: 1.1, dur: 1.1, img });
      });
      Sfx.tone(240, 0.3, 'sawtooth', 0.07, 0, 120);
    }
    const g = this.slamGfx;
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const r = this.rocks[i];
      r.t -= dt;
      const k = 1 - Math.max(0, r.t) / r.dur;
      r.img.setPosition(r.x, r.y);
      r.img.lift = 700 * (1 - k * k);
      r.img.setAngle(k * 360);
      const pts = [];
      for (let a = 0; a < 24; a++) {
        const ang = (a / 24) * Math.PI * 2;
        const p = project(r.x + Math.cos(ang) * 80, r.y + Math.sin(ang) * 60);
        pts.push(new Phaser.Geom.Point(p.x, p.y));
      }
      if (World3D.active) {
        this.decals.push({ k: 'circle', x: r.x, y: r.y, rx: 80, ry: 80, a: 0.3 + k * 0.45 });
      } else {
        g.fillStyle(COLORS.horde, 0.2 + k * 0.35);
        g.fillPoints(pts, true);
        g.lineStyle(4, COLORS.horde, 0.9);
        g.strokePoints(pts, true);
      }
      if (r.t > 0) continue;
      this.rocks.splice(i, 1);
      r.img.destroy();
      this.explode(this.burstGold, 24, r.x, r.y);
      this.shake(140, 0.01);
      Sfx.noise(0.3, 0.18, 0, 400, 'lowpass');
      if (Math.abs(this.squadX - r.x) < 80 + this.squadSpread() * 0.5 && Math.abs(r.y - LINE_Y) < 90) {
        const lost = Math.ceil(this.s.squad * 0.12) + 2;
        this.addSpeed(-0.6 * this.hero.hitLoss);
        this.popNumber(this.squadX, LINE_Y - 250, 'CRUSHED -' + lost, '#e0413a', 40);
        vibrate(100);
        Sfx.bite();
        this.setSquad(this.s.squad - lost);
        if (this.s.over) return;
      }
    }
  }

  // Brood Mother: crawlers pour out of her as she comes.
  updateBrood(b, dt) {
    b.atkTimer -= dt;
    if (b.atkTimer > 0) return;
    b.atkTimer = Math.max(1.6, 2.6 - this.s.wave * 0.02) * TUNING.bossAttackGap;
    this.explode(this.burstRot, 20, b.x, b.y + 40);
    for (const off of [-90, 0, 90]) this.spawnEnemy('sprinter', clamp(b.x + off, 110, W - 110), b.y + 60);
    Sfx.tone(160, 0.25, 'square', 0.06, 0, 90);
  }

  // Wraith King: raises a shield that blocks every spell and calls wraiths,
  // then drops it. Damage only lands while the shield is down.
  updateShield(b, dt) {
    b.atkTimer -= dt;
    if (!b.immune && b.atkTimer <= 0) {
      b.immune = true;
      b.atkTimer = 1.8;
      Sfx.surge();
      for (const off of [-120, 120]) this.spawnEnemy('wraith', clamp(b.x + off, 110, W - 110), b.y + 40);
    } else if (b.immune && b.atkTimer <= 0) {
      b.immune = false;
      b.atkTimer = Math.max(2.6, 4 - this.s.wave * 0.03) * TUNING.bossAttackGap;
    }
    if (b.immune) {
      b.setTint(0x7fd3ff);
      const p = project(b.x, b.y);
      this.slamGfx.lineStyle(8, 0x7fd3ff, 0.5 + 0.3 * Math.sin(this.elapsed * 12));
      this.slamGfx.strokeCircle(p.x, p.y, 150 * p.s);
    }
  }

  endBoss(b) {
    b.disableBody(true, true);
    b.immune = false;
    (this.rocks || []).forEach((r) => r.img.destroy());
    this.rocks = [];
    this.boss = null;
    this.slam = null;
    this.slamGfx.clear();
    this.s.bossActive = false;
  }

  // A boss that reaches the squad stays and smashes it until it is killed.
  bossSmash(b) {
    const first = !b.reached;
    b.reached = true;
    const lost = Math.ceil(this.s.squad * 0.3) + 3;
    this.addSpeed(-2 * this.hero.hitLoss);
    this.explode(this.burstRed, 60, this.squadX, LINE_Y - 40);
    this.popNumber(this.squadX, LINE_Y - 250, '-' + lost, '#e0413a', 56);
    this.shake(500, 0.02);
    this.cameras.main.flash(200, 160, 20, 20);
    Sfx.bite();
    Sfx.bossRoar();
    if (first) this.banner('KILL IT!', '#e0413a', 'It is smashing your wizards');
    vibrate(250);
    this.setSquad(this.s.squad - lost);
  }

  bossDown(b) {
    this.endBoss(b);
    this.s.bosses++;
    this.s.kills++;
    this.s.score += Math.round(1000 * (this.s.wave / TUNING.bossEvery) * this.scoreMult());
    this.addSpeed(1.5);
    this.explode(this.burstRed, 80, b.x, b.y);
    this.explode(this.burstGold, 60, b.x, b.y);
    this.shake(400, 0.015);
    this.cameras.main.flash(150, 255, 220, 140);
    Sfx.bossDown();
    this.banner(b.def.name + ' SLAIN', '#f2c14e', 'Fire rate +1.5');
  }

  // ---------------------------------------------------------------- gates

  goodGate() {
    const w = this.s.wave;
    // Multiply gates are an early boost; a big squad only gets + gates.
    const mulW = this.s.squad >= TUNING.mulSquadMax ? 0 : w >= 2 ? 13 : 8;
    const kind = weighted([['add', 44], ['mul', mulW], ['bolt', 18], ['slow', 14]]);
    if (kind === 'add') return { kind, value: Math.round(3 + w * 1.5 + Math.random() * (3 + w)) };
    if (kind === 'mul') return { kind, value: Math.random() < 0.9 ? 2 : 3 };
    return { kind };
  }

  // Red gates take a big random bite out of the squad. Shooting them pushes
  // the number up until it crosses zero and turns into a gold gate.
  badGate() {
    const w = this.s.wave;
    return { kind: 'add', value: -Math.round(10 + w * 3 + Math.random() * (15 + w * 4)) };
  }

  spawnGateRow() {
    // From wave 3, some rows are two red gates: take the smaller loss or shoot one gold.
    const bothRed = this.s.wave >= 3 && Math.random() < 0.25;
    const a = bothRed ? this.badGate() : this.goodGate();
    let b = bothRed ? this.badGate() : Math.random() < 0.6 ? this.badGate() : this.goodGate();
    // Never show two gates of the same kind and color in one row.
    const look = (g) => g.kind + (g.value < 0 ? '-' : '+');
    let tries = 0;
    while (!bothRed && look(b) === look(a) && tries < 6) {
      b = Math.random() < 0.6 ? this.badGate() : this.goodGate();
      tries++;
    }
    const picks = Phaser.Utils.Array.Shuffle([a, b]);
    const row = { y: VIEW.far - CARD_H / 2, cards: [], done: false };
    picks.forEach((p, i) => {
      const x = W / 2 + (i === 0 ? -1 : 1) * (CARD_W + GATE_GAP) / 2;
      const c = this.add.container(x, row.y).setDepth(5);
      c.gate = p;
      // Shooting raises the number on wizard gates.
      c.shootable = p.kind === 'add';
      c.h3 = 0;
      c.startValue = p.value || 0;
      c.bg = this.add.graphics();
      c.icon = this.add.image(-CARD_W / 2 + 30, -CARD_H / 2 + 28, 'dot').setScale(0.7);
      c.label = this.add.text(0, -16, '', textStyle(72, '#ffffff', { fontStyle: 'italic' })).setOrigin(0.5);
      c.sub = this.add.text(0, 54, '', textStyle(22, '#ffffff', { strokeThickness: 4 })).setOrigin(0.5);
      c.add([c.bg, c.icon, c.label, c.sub]);
      this.drawCard(c);
      row.cards.push(c);
    });
    this.gateRows.push(row);
  }

  cardInfo(g) {
    switch (g.kind) {
      case 'add': {
        const v = Math.round(g.value);
        return { text: (v >= 0 ? '+' : '') + v, sub: v > 0 ? 'ADD WIZARDS' : 'LOSE WIZARDS', color: v > 0 ? COLORS.gold : COLORS.bad, icon: 'knight' };
      }
      case 'mul': return { text: 'x' + g.value, sub: 'MULTIPLY WIZARDS', color: COLORS.gold, icon: 'knight' };
      case 'bolt': return { text: '+50%', sub: 'SPELL POWER UP', color: COLORS.speedGate, icon: 'bolt' };
      case 'slow': return { text: 'SLOW', sub: 'FREEZE HORDE 5s', color: COLORS.speedGate, icon: 'skull' };
    }
    return { text: '?', sub: '', color: COLORS.gold };
  }

  drawCard(c) {
    const info = this.cardInfo(c.gate);
    const g = c.bg;
    const hw = CARD_W / 2;
    const hh = CARD_H / 2;
    g.clear();
    g.fillStyle(0x0a0f0e, 0.7);
    g.fillRoundedRect(-hw - 3, -hh - 3, CARD_W + 6, CARD_H + 6, 16);
    g.fillStyle(info.color, 0.42);
    g.fillRoundedRect(-hw, -hh, CARD_W, CARD_H, 14);
    g.lineStyle(4, info.color, 0.9);
    g.strokeRoundedRect(-hw, -hh, CARD_W, CARD_H, 14);
    g.fillStyle(0xffffff, 0.14);
    g.fillRoundedRect(-hw + 6, -hh + 5, CARD_W - 12, CARD_H * 0.35, 10);
    if (c.icon && info.icon) {
      c.icon.setTexture(info.icon).setScale(info.icon === 'knight' ? 0.32 : 0.55);
    }
    c.label.setText(info.text);
    c.sub.setText(info.sub);
    c.shownText = info.text;
  }

  hitCard(c) {
    const g = c.gate;
    if (g.kind === 'add') {
      // Big red numbers climb faster per hit, so they can be turned around.
      const start = c.startValue;
      const step = start < 0 ? 0.34 + -start * 0.012 : 0.34;
      const cap = start < 0 ? -start * 0.5 + 5 + this.s.wave * 2 : start + 30 + this.s.wave * 3;
      g.value = Math.min(cap, g.value + step);
    }
    const info = this.cardInfo(g);
    if (info.text !== c.shownText) {
      this.drawCard(c);
      c.label.setScale(1.25);
      this.tweens.add({ targets: c.label, scale: 1, duration: 120 });
      Sfx.gateTick();
    }
    this.explode(g.value >= 0 ? this.burstBlue : this.burstRed, 2, c.x + (Math.random() - 0.5) * 120, c.y + CARD_H / 2 - 10);
  }

  updateGates(dt) {
    this.gateTimer -= dt;
    if (this.gateTimer <= 0 && !this.s.bossActive) {
      this.spawnGateRow();
      this.gateTimer = TUNING.gateEvery * (0.85 + Math.random() * 0.3);
    }
    const fall = TUNING.gateFall * (1 + (this.s.wave - 1) * 0.02);
    for (let i = this.gateRows.length - 1; i >= 0; i--) {
      const row = this.gateRows[i];
      row.y += fall * dt;
      row.cards.forEach((c) => { c.y = row.y; });
      if (!row.done && row.y >= LINE_Y - 30) {
        row.done = true;
        const chosen = row.cards[this.squadX < W / 2 ? 0 : 1];
        const other = row.cards[this.squadX < W / 2 ? 1 : 0];
        this.applyGate(chosen.gate);
        this.fadingCards.push(chosen, other);
        const gone = (c) => {
          Phaser.Utils.Array.Remove(this.fadingCards, c);
          c.destroy();
        };
        this.tweens.add({ targets: chosen, scale: 1.25, alpha: 0, duration: 260, onComplete: () => gone(chosen) });
        this.tweens.add({ targets: other, alpha: 0, duration: 200, onComplete: () => gone(other) });
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
      case 'bolt':
        msg = 'SPELL POWER +50%';
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
      this.explode(this.burstGold, 30, this.squadX, LINE_Y - 20);
      Sfx.gateGood();
    } else {
      this.explode(this.burstRed, 30, this.squadX, LINE_Y - 20);
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
    this.s.score += 100 * this.s.wave * this.scoreMult();
    const record = this.bestWave > 0 && this.s.wave > this.bestWave;
    if (record) {
      this.bestStrip.set('BEST ' + this.s.wave);
      this.bestStrip.t.setColor('#5fd35a');
      this.bestStrip.icon.setTint(0x5fd35a);
    }
    const firstRecord = record && this.s.wave === this.bestWave + 1;
    if (this.s.wave % TUNING.bossEvery === 0) {
      this.spawnBoss();
      if (firstRecord) this.popNumber(this.squadX, LINE_Y - 320, 'NEW BEST WAVE', '#5fd35a', 44);
    } else {
      this.banner('WAVE ' + this.s.wave, '#f2c14e', firstRecord ? 'New best wave!' : 'The horde quickens');
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
    const roadSpeed = 180 + ratio * 900;
    this.roadScroll += roadSpeed * dt;
    if (!World3D.active) this.drawGround();
    for (const t of this.trees) {
      t.y += roadSpeed * dt;
      if (t.y > VIEW.near + 200) t.y -= VIEW.near - VIEW.far + 400;
    }

    const activeStreaks = Math.floor(4 + ratio * 30);
    const streakSpeed = 900 + eff * 260;
    for (let i = 0; i < this.streaks.length; i++) {
      const st = this.streaks[i];
      const on = i < activeStreaks;
      st.setVisible(on);
      if (!on) continue;
      st.setAlpha(0.06 + ratio * 0.22);
      st.y += streakSpeed * dt;
      if (st.y > VIEW.near + 100) this.resetStreak(st, false);
    }
    for (const e of this.embers) {
      e.y += (80 + eff * 70) * dt;
      e.x += Math.sin(this.elapsed * 2 + e.drift) * 20 * dt;
      e.setAlpha(0.25 + ratio * 0.5);
      if (e.y > VIEW.near + 10) {
        e.y = VIEW.far - 10;
        e.x = Math.random() * W;
      }
    }
  }

  popNumber(x, y, str, color, size) {
    const t = this.numbers[this.numberIndex];
    this.numberIndex = (this.numberIndex + 1) % this.numbers.length;
    this.tweens.killTweensOf(t);
    const p = project(x, y);
    t.setText(str).setColor(color).setFontSize(size).setStroke('#0a0f0e', Math.max(4, Math.round(size * 0.16))).setPosition(p.x, p.y).setAlpha(1).setScale(1.3).setVisible(true);
    this.tweens.add({ targets: t, scale: 1, duration: 120, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: p.y - 70, alpha: 0, delay: 250, duration: 500, onComplete: () => t.setVisible(false) });
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
    const oc = this.s.overclock > 0;
    this.speedText.setText('x' + eff.toFixed(1));
    this.speedLabel.setText(oc ? 'OVERCLOCK!' : 'SPEED').setColor(oc ? '#4fe0ff' : '#ffffff');
    this.multText.setText('SCORE x' + this.scoreMult());
    // Screen edges glow from x4 up, and pulse hard during OVERCLOCK.
    this.edgeGlow.setTint(oc ? 0x4fe0ff : 0xff8a3c);
    this.edgeGlow.setAlpha(oc ? 0.75 + 0.25 * Math.sin(this.elapsed * 14) : clamp((ratio - 0.7) / 0.3, 0, 1) * 0.6);
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
    const nextName = this.boss && this.boss.def ? this.boss.def.name : bossForWave(this.s.wave + toBoss).name;
    this.bossStrip.set(this.s.bossActive ? nextName + ' ATTACKING' : toBoss === 1 ? nextName + ' NEXT WAVE' : nextName + ' IN ' + toBoss + ' WAVES');

    const status = [];
    if (this.s.slowTimer > 0) status.push('HORDE SLOW ' + Math.ceil(this.s.slowTimer) + 's');
    if (this.s.surgeTimer > 0) status.push('SURGE ' + Math.ceil(this.s.surgeTimer) + 's');
    if (this.s.boltMult > 1) status.push('SPELL POWER x' + this.s.boltMult.toFixed(1));
    if (this.s.dmgMult > 1) status.push('SPELL DAMAGE x' + this.s.dmgMult.toFixed(1));
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
    const bx = 190;
    const by = 182;
    const bw = W - 380;
    const bh = 30;
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
