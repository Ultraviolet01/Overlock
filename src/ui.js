// Shared interface pieces: beveled buttons, icon buttons, pop-up panels,
// sliders and toggles, plus the settings, how-to-play and pause panels.

const UI_DEPTH = 100;
const PANEL_TRIM = 0x4a86b8;   // steel blue, like Last War's portrait frames
const BTN_BLUE = 0x3d78b8;
const BTN_RED = 0xc0392b;

function darken(color, amount) {
  return Phaser.Display.Color.ValueToColor(color).darken(amount).color;
}

function hex(color) {
  return '#' + color.toString(16).padStart(6, '0');
}

// A chunky rounded button with a bevel and a pressed state.
function uiButton(scene, x, y, w, h, label, color, onTap, opts) {
  opts = opts || {};
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const t = scene.add.text(0, -3, label, textStyle(opts.size || 34, opts.textColor || '#ffffff')).setOrigin(0.5);
  const r = Math.min(20, h / 2);
  const draw = (pressed) => {
    const off = pressed ? 5 : 0;
    g.clear();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-w / 2, -h / 2 + 9, w, h, r);
    g.fillStyle(0x0a0f0e, 1);
    g.fillRoundedRect(-w / 2 - 3, -h / 2 - 3 + off, w + 6, h + 6 - off, r + 3);
    g.fillStyle(darken(color, 38), 1);
    g.fillRoundedRect(-w / 2, -h / 2 + 6, w, h - 6, r);
    g.fillStyle(color, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + off, w, h - 10, r);
    g.fillStyle(0xffffff, 0.28);
    g.fillRoundedRect(-w / 2 + 8, -h / 2 + off + 5, w - 16, (h - 10) * 0.38, Math.max(4, r - 6));
    t.y = off - 3;
  };
  draw(false);
  c.add([g, t]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => draw(true));
  c.on('pointerout', () => draw(false));
  c.on('pointerup', () => {
    draw(false);
    Sfx.resume();
    Sfx.click();
    onTap();
  });
  c.label = t;
  return c;
}

// A square icon button: 'gear', 'pause' or 'help'. Dark and see-through,
// with a white glyph, like the small buttons over Last War's battle.
function uiIconButton(scene, x, y, icon, onTap, size) {
  size = size || 76;
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const k = size / 84;
  const draw = (pressed) => {
    const off = pressed ? 3 : 0;
    g.clear();
    g.fillStyle(0x000000, 0.55);
    g.fillRoundedRect(-size / 2, -size / 2 + off, size, size, 14);
    g.lineStyle(3, 0xffffff, 0.45);
    g.strokeRoundedRect(-size / 2, -size / 2 + off, size, size, 14);
    const cy = off;
    g.fillStyle(0x0a0f0e, 1);
    if (icon === 'pause') {
      g.fillRoundedRect(-20 * k, cy - 23 * k, 16 * k, 46 * k, 4);
      g.fillRoundedRect(4 * k, cy - 23 * k, 16 * k, 46 * k, 4);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(-17 * k, cy - 20 * k, 10 * k, 40 * k, 3);
      g.fillRoundedRect(7 * k, cy - 20 * k, 10 * k, 40 * k, 3);
    } else if (icon === 'gear') {
      const gear = (r1, r2) => {
        const pts = [];
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const rr = (i % 2 === 0 ? r1 : r2) * k;
          pts.push(new Phaser.Geom.Point(Math.cos(a) * rr, cy + Math.sin(a) * rr));
        }
        return pts;
      };
      g.fillPoints(gear(29, 22), true);
      g.fillStyle(0xffffff, 1);
      g.fillPoints(gear(26, 19), true);
      g.fillStyle(0x0a0f0e, 1);
      g.fillCircle(0, cy, 9 * k);
    }
    if (c.q) c.q.y = cy - 2;
  };
  c.add(g);
  if (icon === 'help') {
    c.q = scene.add.text(0, 0, '?', textStyle(Math.round(50 * k), '#ffffff')).setOrigin(0.5);
    c.add(c.q);
  }
  draw(false);
  c.setSize(size, size);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => draw(true));
  c.on('pointerout', () => draw(false));
  c.on('pointerup', () => {
    draw(false);
    Sfx.resume();
    Sfx.click();
    onTap();
  });
  return c;
}

// A slim dark see-through strip with an icon overlapping its left edge and a
// number, like Last War's resource readouts. Call strip.set(text).
function uiStrip(scene, x, y, iconKey, iconScale, size, color) {
  const g = scene.add.graphics();
  const icon = scene.add.image(x + 16, y, iconKey).setScale(iconScale);
  const t = scene.add.text(x + 40, y, '', textStyle(size, color || '#ffffff')).setOrigin(0, 0.5);
  const strip = { g, icon, t };
  strip.set = (str) => {
    if (t.text === str) return;
    t.setText(str);
    g.clear();
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(x + 8, y - size * 0.62, t.width + 44, size * 1.24, 6);
  };
  strip.setDepth = (d) => {
    g.setDepth(d);
    icon.setDepth(d + 1);
    t.setDepth(d + 1);
    return strip;
  };
  strip.setVisible = (v) => {
    g.setVisible(v);
    icon.setVisible(v);
    t.setVisible(v);
    return strip;
  };
  return strip;
}

// A pop-up panel with a dark overlay that blocks taps underneath, and a
// ribbon title. Returns the panel container; call panel.close() to remove it.
function uiModal(scene, w, h, title) {
  const overlay = scene.add.rectangle(W / 2, H / 2, W, H, 0x050a09, 0.72).setDepth(UI_DEPTH).setInteractive();
  const panel = scene.add.container(W / 2, H / 2).setDepth(UI_DEPTH + 1);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4);
  g.fillRoundedRect(-w / 2, -h / 2 + 12, w, h, 28);
  g.fillStyle(0x0a0f0e, 1);
  g.fillRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 26);
  g.fillStyle(0x16211f, 0.97);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 22);
  g.lineStyle(3, PANEL_TRIM, 0.9);
  g.strokeRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 18);
  const rw = Math.min(w - 60, 440);
  g.fillStyle(0x0a0f0e, 1);
  g.fillRoundedRect(-rw / 2 - 4, -h / 2 - 42, rw + 8, 80, 16);
  g.fillStyle(darken(PANEL_TRIM, 30), 1);
  g.fillRoundedRect(-rw / 2, -h / 2 - 38, rw, 72, 14);
  g.fillStyle(PANEL_TRIM, 1);
  g.fillRoundedRect(-rw / 2, -h / 2 - 38, rw, 62, 14);
  g.fillStyle(0xffffff, 0.25);
  g.fillRoundedRect(-rw / 2 + 8, -h / 2 - 33, rw - 16, 22, 10);
  const t = scene.add.text(0, -h / 2 - 7, title, textStyle(40, '#ffffff')).setOrigin(0.5);
  panel.add([g, t]);
  panel.setScale(0.85);
  scene.tweens.add({ targets: panel, scale: 1, duration: 180, ease: 'Back.easeOut' });
  panel.close = () => {
    overlay.destroy();
    panel.destroy();
  };
  return panel;
}

// A labelled volume slider from 0 to 1.
function uiSlider(scene, panel, y, label, value, onChange) {
  const tw = 440;
  const left = -tw / 2;
  const lab = scene.add.text(left, y - 44, label, textStyle(28, COLORS.text)).setOrigin(0, 0.5);
  const pct = scene.add.text(-left, y - 44, '', textStyle(28, '#f2c14e')).setOrigin(1, 0.5);
  const g = scene.add.graphics();
  const zone = scene.add.zone(0, y, tw + 40, 60).setInteractive({ useHandCursor: true });
  const draw = () => {
    g.clear();
    g.fillStyle(0x0a1310, 1);
    g.fillRoundedRect(left, y - 9, tw, 18, 9);
    g.fillStyle(COLORS.knight, 1);
    g.fillRoundedRect(left, y - 9, Math.max(18, tw * value), 18, 9);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(left + tw * value, y, 20);
    g.lineStyle(4, COLORS.knight, 1);
    g.strokeCircle(left + tw * value, y, 20);
    pct.setText(Math.round(value * 100) + '%');
  };
  const set = (p) => {
    const m = zone.getWorldTransformMatrix();
    const local = m.applyInverse(p.x, p.y);
    value = clamp((local.x + tw / 2) / tw, 0, 1);
    draw();
    onChange(value);
  };
  zone.on('pointerdown', set);
  zone.on('pointermove', (p) => { if (p.isDown) set(p); });
  draw();
  panel.add([lab, pct, g, zone]);
}

// A labelled on/off switch.
function uiToggle(scene, panel, y, label, on, onChange) {
  const lab = scene.add.text(-220, y, label, textStyle(28, COLORS.text)).setOrigin(0, 0.5);
  const g = scene.add.graphics();
  const c = scene.add.container(170, y);
  const draw = () => {
    g.clear();
    g.fillStyle(on ? COLORS.knight : 0x34423e, 1);
    g.fillRoundedRect(-50, -24, 100, 48, 24);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(on ? 26 : -26, 0, 19);
  };
  draw();
  c.add(g);
  c.setSize(110, 56);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerup', () => {
    on = !on;
    draw();
    Sfx.click();
    onChange(on);
  });
  panel.add([lab, c]);
}

// ---------------------------------------------------------------- panels

function openSettings(scene, onClose) {
  const panel = uiModal(scene, 600, 860, 'SETTINGS');
  uiSlider(scene, panel, -270, 'MUSIC', Settings.get('music'), (v) => {
    Settings.set('music', v);
    Sfx.applyVolumes();
  });
  uiSlider(scene, panel, -150, 'SOUND EFFECTS', Settings.get('sfx'), (v) => {
    Settings.set('sfx', v);
    Sfx.applyVolumes();
  });
  uiToggle(scene, panel, -50, 'VIBRATION', Settings.get('vibration'), (v) => {
    Settings.set('vibration', v);
    if (v) vibrate(60);
  });
  uiToggle(scene, panel, 40, 'SCREEN SHAKE', Settings.get('shake'), (v) => Settings.set('shake', v));

  let armed = false;
  const reset = uiButton(scene, 0, 150, 440, 76, 'RESET BEST RUN', BTN_RED, () => {
    if (!armed) {
      armed = true;
      reset.label.setText('TAP AGAIN TO CONFIRM');
      return;
    }
    Store.set('best', null);
    reset.label.setText('BEST RUN CLEARED');
  }, { size: 26, textColor: '#ffffff' });
  panel.add(reset);

  panel.add(scene.add.text(0, 240, 'Overclock v' + VERSION + '  |  Made for Slapjam AI 2',
    textStyle(20, '#9fb3ad', { strokeThickness: 3 })).setOrigin(0.5));
  panel.add(uiButton(scene, 0, 340, 320, 86, 'CLOSE', COLORS.gold, () => {
    panel.close();
    if (onClose) onClose();
  }));
  return panel;
}

function miniCard(scene, x, y, text, color) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(color, 0.55);
  g.fillRoundedRect(-48, -32, 96, 64, 10);
  g.fillStyle(0xffffff, 0.22);
  g.fillRoundedRect(-44, -28, 88, 22, 8);
  g.lineStyle(3, 0xffffff, 0.8);
  g.strokeRoundedRect(-48, -32, 96, 64, 10);
  c.add([g, scene.add.text(0, 0, text, textStyle(32, '#ffffff', { fontStyle: 'italic' })).setOrigin(0.5)]);
  return c;
}

function openHelp(scene, onClose) {
  const panel = uiModal(scene, 660, 1120, 'HOW TO PLAY');
  const rows = [
    [() => scene.add.image(0, 0, 'knight').setScale(0.42), 'STEER', 'Drag left or right. Your wizards cast spells on their own.'],
    [() => scene.add.image(0, 0, 'icon_flame').setScale(1.1), 'SPEED IS EVERYTHING', 'The run speeds up as you go. Bites slow you. Speed multiplies score. x5 = OVERCLOCK.'],
    [() => miniCard(scene, 0, 0, '+8', COLORS.gold), 'GOLD AND BLUE GATES', 'Gold adds wizards. Blue hides it in quick math: solve it before you pass! Shooting will not change it.'],
    [() => miniCard(scene, 0, 0, '-30', COLORS.bad), 'RED GATES', 'They take wizards. Shoot them: the number climbs, turns gold and gives wizards.'],
    [() => scene.add.image(0, 0, 'barrel').setScale(0.75), 'RUNE BARRELS', 'Break one for an upgrade, or it crashes into you.'],
    [() => scene.add.image(0, 0, 'champion').setScale(0.36), 'ARCHMAGES', 'Every 10 wizards merge into one archmage.'],
    [() => scene.add.image(0, 0, 'boss').setScale(0.24), 'BOSSES', 'Every 5th wave: the Horror, Bone Colossus, Brood Mother, then the Wraith King.'],
  ];
  const top = -440;
  rows.forEach((row, i) => {
    const y = top + i * 122;
    const icon = row[0]();
    icon.setPosition(-230, y);
    const head = scene.add.text(-150, y - 24, row[1], textStyle(28, '#f2c14e')).setOrigin(0, 0.5);
    const body = scene.add.text(-150, y + 16, row[2], textStyle(21, '#ffffff', {
      strokeThickness: 4, wordWrap: { width: 420 },
    })).setOrigin(0, 0.5);
    panel.add([icon, head, body]);
  });
  panel.add(uiButton(scene, 0, 470, 320, 86, 'GOT IT', COLORS.gold, () => {
    Store.set('seenHelp', true);
    panel.close();
    if (onClose) onClose();
  }));
  return panel;
}

// handlers: { resume, quit }
function openPause(scene, handlers) {
  const panel = uiModal(scene, 540, 700, 'PAUSED');
  panel.add(uiButton(scene, 0, -170, 400, 100, 'RESUME', COLORS.gold, () => {
    panel.close();
    handlers.resume();
  }, { size: 40 }));
  panel.add(uiButton(scene, 0, -40, 400, 86, 'HOW TO PLAY', BTN_BLUE, () => {
    panel.setVisible(false);
    openHelp(scene, () => panel.setVisible(true));
  }, { size: 30, textColor: '#ffffff' }));
  panel.add(uiButton(scene, 0, 75, 400, 86, 'SETTINGS', BTN_BLUE, () => {
    panel.setVisible(false);
    openSettings(scene, () => panel.setVisible(true));
  }, { size: 30, textColor: '#ffffff' }));
  panel.add(uiButton(scene, 0, 205, 400, 86, 'QUIT TO TITLE', BTN_RED, () => {
    panel.close();
    handlers.quit();
  }, { size: 30, textColor: '#ffffff' }));
  return panel;
}
