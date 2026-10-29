// Shared interface pieces: beveled buttons, icon buttons, pop-up panels,
// sliders and toggles, plus the settings, how-to-play and pause panels.

const UI_DEPTH = 100;

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
  const t = scene.add.text(0, -3, label, textStyle(opts.size || 34, opts.textColor || '#0b1412', {
    fontFamily: 'Georgia, "Times New Roman", serif',
  })).setOrigin(0.5);
  const r = Math.min(20, h / 2);
  const draw = (pressed) => {
    const off = pressed ? 5 : 0;
    g.clear();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-w / 2, -h / 2 + 9, w, h, r);
    g.fillStyle(darken(color, 38), 1);
    g.fillRoundedRect(-w / 2, -h / 2 + 6, w, h - 2, r);
    g.fillStyle(color, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + off, w, h - 6, r);
    g.fillStyle(0xffffff, 0.2);
    g.fillRoundedRect(-w / 2 + 10, -h / 2 + off + 6, w - 20, (h - 6) * 0.34, Math.max(4, r - 8));
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

// A square icon button: 'gear', 'pause' or 'help'.
function uiIconButton(scene, x, y, icon, onTap) {
  const size = 84;
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const draw = (pressed) => {
    const off = pressed ? 4 : 0;
    g.clear();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-size / 2, -size / 2 + 7, size, size, 18);
    g.fillStyle(darken(0x2c4a44, 30), 1);
    g.fillRoundedRect(-size / 2, -size / 2 + 5, size, size - 2, 18);
    g.fillStyle(0x2c4a44, 1);
    g.fillRoundedRect(-size / 2, -size / 2 + off, size, size - 5, 18);
    g.lineStyle(3, COLORS.knight, 0.8);
    g.strokeRoundedRect(-size / 2, -size / 2 + off, size, size - 5, 18);
    const cy = off - 2;
    g.fillStyle(0xe8f4f0, 1);
    if (icon === 'pause') {
      g.fillRoundedRect(-17, cy - 20, 12, 40, 3);
      g.fillRoundedRect(5, cy - 20, 12, 40, 3);
    } else if (icon === 'gear') {
      const pts = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const rr = i % 2 === 0 ? 26 : 19;
        pts.push(new Phaser.Geom.Point(Math.cos(a) * rr, cy + Math.sin(a) * rr));
      }
      g.fillPoints(pts, true);
      g.fillStyle(0x2c4a44, 1);
      g.fillCircle(0, cy, 8);
    }
    if (c.q) c.q.y = cy;
  };
  c.add(g);
  if (icon === 'help') {
    c.q = scene.add.text(0, 0, '?', textStyle(48, '#e8f4f0')).setOrigin(0.5);
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

// A pop-up panel with a dark overlay that blocks taps underneath, and a
// ribbon title. Returns the panel container; call panel.close() to remove it.
function uiModal(scene, w, h, title) {
  const overlay = scene.add.rectangle(W / 2, H / 2, W, H, 0x050a09, 0.72).setDepth(UI_DEPTH).setInteractive();
  const panel = scene.add.container(W / 2, H / 2).setDepth(UI_DEPTH + 1);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4);
  g.fillRoundedRect(-w / 2, -h / 2 + 12, w, h, 28);
  g.fillStyle(0x13201c, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 28);
  g.lineStyle(5, COLORS.gold, 1);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 28);
  g.lineStyle(2, COLORS.gold, 0.35);
  g.strokeRoundedRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 20);
  const rw = Math.min(w - 80, 420);
  g.fillStyle(darken(COLORS.gold, 35), 1);
  g.fillRoundedRect(-rw / 2, -h / 2 - 34, rw, 76, 18);
  g.fillStyle(COLORS.gold, 1);
  g.fillRoundedRect(-rw / 2, -h / 2 - 38, rw, 70, 18);
  const t = scene.add.text(0, -h / 2 - 4, title, textStyle(38, '#0b1412')).setOrigin(0.5);
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
  uiSlider(scene, panel, -270, 'Music', Settings.get('music'), (v) => {
    Settings.set('music', v);
    Sfx.applyVolumes();
  });
  uiSlider(scene, panel, -150, 'Sound effects', Settings.get('sfx'), (v) => {
    Settings.set('sfx', v);
    Sfx.applyVolumes();
  });
  uiToggle(scene, panel, -50, 'Vibration', Settings.get('vibration'), (v) => {
    Settings.set('vibration', v);
    if (v) vibrate(60);
  });
  uiToggle(scene, panel, 40, 'Screen shake', Settings.get('shake'), (v) => Settings.set('shake', v));

  let armed = false;
  const reset = uiButton(scene, 0, 150, 440, 76, 'RESET BEST RUN', 0x8a2f2b, () => {
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
    textStyle(20, COLORS.textDim, { fontStyle: 'normal' })).setOrigin(0.5));
  panel.add(uiButton(scene, 0, 340, 320, 86, 'CLOSE', COLORS.gold, () => {
    panel.close();
    if (onClose) onClose();
  }));
  return panel;
}

function miniCard(scene, x, y, text, color) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x0e1916, 1);
  g.fillRoundedRect(-48, -32, 96, 64, 10);
  g.fillStyle(color, 0.18);
  g.fillRoundedRect(-48, -32, 96, 64, 10);
  g.lineStyle(3, color, 1);
  g.strokeRoundedRect(-48, -32, 96, 64, 10);
  c.add([g, scene.add.text(0, 0, text, textStyle(30, hex(color))).setOrigin(0.5)]);
  return c;
}

function openHelp(scene, onClose) {
  const panel = uiModal(scene, 660, 1120, 'HOW TO PLAY');
  const rows = [
    [() => scene.add.image(0, 0, 'knight').setScale(0.42), 'STEER', 'Drag left or right. Your knights shoot on their own.'],
    [() => scene.add.text(0, 0, 'x4.0', textStyle(38, '#f2c14e')).setOrigin(0.5), 'FIRE RATE IS SPEED', 'Kills speed it up. Bites slow it down.'],
    [() => miniCard(scene, 0, 0, '+8', COLORS.gold), 'GOLD CARDS', 'Walk through to add or multiply knights. Shoot them to raise the number.'],
    [() => miniCard(scene, 0, 0, '÷2', COLORS.bad), 'RED CARDS', 'Avoid them. Shooting makes them worse.'],
    [() => scene.add.image(0, 0, 'barrel').setScale(0.9), 'RUNE BARRELS', 'Break one for an upgrade, or it crashes into you.'],
    [() => scene.add.image(0, 0, 'champion').setScale(0.36), 'CHAMPIONS', 'Every 10 knights merge into one champion.'],
    [() => scene.add.image(0, 0, 'boss').setScale(0.24), 'THE HORROR', 'Comes every 5th wave. Slide out of the red lane before it slams.'],
  ];
  const top = -440;
  rows.forEach((row, i) => {
    const y = top + i * 122;
    const icon = row[0]();
    icon.setPosition(-230, y);
    const head = scene.add.text(-150, y - 22, row[1], textStyle(26, '#f2c14e')).setOrigin(0, 0.5);
    const body = scene.add.text(-150, y + 16, row[2], textStyle(21, COLORS.text, {
      fontStyle: 'normal', wordWrap: { width: 420 },
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
  panel.add(uiButton(scene, 0, -40, 400, 86, 'HOW TO PLAY', 0x2f7f74, () => {
    panel.setVisible(false);
    openHelp(scene, () => panel.setVisible(true));
  }, { size: 30, textColor: '#ffffff' }));
  panel.add(uiButton(scene, 0, 75, 400, 86, 'SETTINGS', 0x2f7f74, () => {
    panel.setVisible(false);
    openSettings(scene, () => panel.setVisible(true));
  }, { size: 30, textColor: '#ffffff' }));
  panel.add(uiButton(scene, 0, 205, 400, 86, 'QUIT TO TITLE', 0x8a2f2b, () => {
    panel.close();
    handlers.quit();
  }, { size: 30, textColor: '#ffffff' }));
  return panel;
}
