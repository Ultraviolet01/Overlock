// Characters are AI-generated images in assets/. Everything else (bolts, road,
// barrels, effects) is drawn in code at boot.

function makeTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  function bake(key, w, h, draw) {
    g.clear();
    draw(g);
    g.generateTexture(key, w, h);
  }

  // Spectral bolt fired by the knights.
  bake('bolt', 14, 40, (g) => {
    g.fillStyle(COLORS.knight, 0.3);
    g.fillEllipse(7, 20, 14, 40);
    g.fillStyle(COLORS.knight, 0.8);
    g.fillEllipse(7, 18, 8, 30);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(7, 14, 4, 18);
  });

  // Rune barrel: break it for an upgrade before it rolls into the squad.
  bake('barrel', 80, 88, (g) => {
    g.fillStyle(COLORS.knight, 0.18);
    g.fillCircle(40, 44, 40);
    g.fillStyle(0x0b0b0b, 1);
    g.fillRoundedRect(10, 6, 60, 76, 16);
    g.fillStyle(0x6b4426, 1);
    g.fillRoundedRect(14, 10, 52, 68, 13);
    g.fillStyle(0x845733, 1);
    g.fillRect(24, 10, 8, 68);
    g.fillRect(48, 10, 6, 68);
    g.fillStyle(0x2b2f33, 1);
    g.fillRect(14, 20, 52, 7);
    g.fillRect(14, 61, 52, 7);
    g.fillStyle(COLORS.knight, 1);
    g.fillTriangle(40, 30, 50, 44, 40, 58);
    g.fillTriangle(40, 30, 30, 44, 40, 58);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(40, 37, 44, 44, 40, 51);
    g.fillTriangle(40, 37, 36, 44, 40, 51);
  });

  // Forest road, tiled vertically and scrolled to show speed.
  bake('road', W, 512, (g) => {
    g.fillStyle(0x0d1a15, 1);
    g.fillRect(0, 0, W, 512);
    g.fillStyle(COLORS.road, 1);
    g.fillRect(80, 0, W - 160, 512);
    g.fillStyle(0x24302b, 1);
    for (let row = 0; row < 8; row++) {
      const y = row * 64;
      const shift = row % 2 === 0 ? 0 : 45;
      for (let x = 80 - shift; x < W - 80; x += 90) {
        const x0 = Math.max(x + 3, 83);
        const x1 = Math.min(x + 87, W - 83);
        if (x1 > x0) g.fillRect(x0, y + 3, x1 - x0, 58);
      }
    }
    g.fillStyle(0x2f4a2a, 0.5);
    [[120, 40], [560, 150], [300, 300], [610, 420], [200, 470]].forEach((m) => g.fillEllipse(m[0], m[1], 50, 18));
    g.fillStyle(0x08120e, 1);
    g.fillRect(70, 0, 12, 512);
    g.fillRect(W - 82, 0, 12, 512);
    for (let i = 0; i < 6; i++) {
      const y = i * 86 + 20;
      g.fillStyle(0x10291c, 1);
      g.fillTriangle(-10, y + 90, 80, y + 90, 30, y - 30);
      g.fillTriangle(W + 10, y + 130, W - 80, y + 130, W - 30, y + 10);
      g.fillStyle(0x163626, 1);
      g.fillTriangle(0, y + 70, 60, y + 70, 30, y - 10);
      g.fillTriangle(W, y + 110, W - 60, y + 110, W - 30, y + 30);
    }
  });

  // Skull marker for the boss health bar and the next-horror progress bar.
  bake('skull', 40, 40, (g) => {
    g.fillStyle(0x0b0b0b, 1);
    g.fillCircle(20, 17, 16);
    g.fillRoundedRect(10, 22, 20, 16, 4);
    g.fillStyle(0xf3efc8, 1);
    g.fillCircle(20, 17, 13);
    g.fillRoundedRect(13, 22, 14, 13, 3);
    g.fillStyle(0x0b0b0b, 1);
    g.fillCircle(14, 17, 4);
    g.fillCircle(26, 17, 4);
    g.fillTriangle(20, 21, 17, 26, 23, 26);
    g.fillRect(16, 30, 2, 5);
    g.fillRect(22, 30, 2, 5);
  });

  // Score badge: blue shield with a gold star.
  bake('icon_score', 44, 48, (g) => {
    g.fillStyle(0x0a0f0e, 1);
    g.fillRoundedRect(2, 2, 40, 30, 8);
    g.fillTriangle(2, 26, 42, 26, 22, 47);
    g.fillStyle(0x3d78b8, 1);
    g.fillRoundedRect(5, 5, 34, 25, 6);
    g.fillTriangle(5, 26, 39, 26, 22, 43);
    g.fillStyle(COLORS.gold, 1);
    const star = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = i % 2 === 0 ? 13 : 5.5;
      star.push(new Phaser.Geom.Point(22 + Math.cos(a) * r, 22 + Math.sin(a) * r));
    }
    g.fillPoints(star, true);
  });

  // Flame for the fire rate meter.
  bake('icon_flame', 52, 64, (g) => {
    g.fillStyle(0x0a0f0e, 1);
    g.fillCircle(26, 42, 20);
    g.fillTriangle(8, 40, 44, 40, 28, 0);
    g.fillStyle(COLORS.ember, 1);
    g.fillCircle(26, 42, 16);
    g.fillTriangle(12, 40, 40, 40, 28, 6);
    g.fillStyle(COLORS.gold, 1);
    g.fillCircle(26, 46, 9);
    g.fillTriangle(18, 46, 34, 46, 27, 22);
    g.fillStyle(0xfff4c8, 1);
    g.fillCircle(26, 49, 4);
  });

  // Dark pine for the forest along the road; drawn at its base so it can be
  // placed on the ground and scaled by distance.
  bake('tree', 120, 200, (g) => {
    g.fillStyle(0x2b1d14, 1);
    g.fillRect(52, 160, 16, 40);
    const layer = (y, w, h, c) => {
      g.fillStyle(0x060d0a, 1);
      g.fillTriangle(60 - w / 2 - 4, y + 4, 60 + w / 2 + 4, y + 4, 60, y - h - 6);
      g.fillStyle(c, 1);
      g.fillTriangle(60 - w / 2, y, 60 + w / 2, y, 60, y - h);
    };
    layer(170, 116, 80, 0x10291c);
    layer(130, 96, 74, 0x143322);
    layer(92, 74, 66, 0x183d29);
    layer(56, 50, 54, 0x1d4731);
  });

  // Parachute canopy for the opening drop: dark cloth dome with a blue rune.
  bake('chute', 150, 124, (g) => {
    const dome = (rx, ry, cy) => {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const a = Math.PI + (i / 24) * Math.PI;
        pts.push(new Phaser.Geom.Point(75 + Math.cos(a) * rx, cy + Math.sin(a) * ry));
      }
      return pts;
    };
    g.lineStyle(3, 0x0a0f0e, 1);
    [12, 48, 102, 138].forEach((x) => g.lineBetween(x, 60, 75, 122));
    g.fillStyle(0x0a0f0e, 1);
    g.fillPoints(dome(75, 58, 62), true);
    g.fillStyle(0x3b4250, 1);
    g.fillPoints(dome(69, 52, 59), true);
    g.fillStyle(0x4d5666, 1);
    g.fillPoints(dome(32, 48, 59), true);
    g.fillStyle(COLORS.knight, 1);
    g.fillTriangle(75, 18, 87, 34, 75, 50);
    g.fillTriangle(75, 18, 63, 34, 75, 50);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(75, 26, 80, 34, 75, 42);
    g.fillTriangle(75, 26, 70, 34, 75, 42);
  });

  bake('shadow', 80, 30, (g) => {
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(40, 15, 80, 30);
  });

  // Pointing hand for the swipe tutorial.
  bake('hand', 70, 96, (g) => {
    g.fillStyle(0x0a0f0e, 1);
    g.fillRoundedRect(22, 0, 24, 62, 12);
    g.fillRoundedRect(8, 40, 56, 54, 18);
    g.fillStyle(0xf6dcb8, 1);
    g.fillRoundedRect(26, 4, 16, 58, 8);
    g.fillRoundedRect(12, 44, 48, 46, 15);
    g.fillStyle(0xe2bf95, 1);
    g.fillRoundedRect(14, 74, 44, 14, 7);
  });

  bake('dot', 8, 8, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
  });

  bake('streak', 4, 80, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 4, 80);
  });

  bake('flash', 48, 48, (g) => {
    g.fillStyle(COLORS.knight, 0.35);
    g.fillCircle(24, 24, 24);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(24, 24, 10);
  });

  bake('fog', W, 360, (g) => {
    for (let i = 0; i < 36; i++) {
      g.fillStyle(0x0b1412, 1 - i / 36);
      g.fillRect(0, i * 10, W, 10);
    }
  });

  g.destroy();
}
