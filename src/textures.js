// Every sprite is drawn in code at boot, so the build has no image files.

function makeTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  function bake(key, w, h, draw) {
    g.clear();
    draw(g);
    g.generateTexture(key, w, h);
  }

  // Cursed knight: steel armor, blue soul-light visor and chest rune.
  bake('knight', 40, 52, (g) => {
    g.fillStyle(COLORS.knight, 0.16);
    g.fillCircle(20, 30, 20);
    g.fillStyle(0x16202b, 1);
    g.fillTriangle(6, 46, 34, 46, 20, 18);
    g.fillStyle(0x2c3e50, 1);
    g.fillRoundedRect(11, 22, 18, 22, 5);
    g.fillStyle(0x42596e, 1);
    g.fillCircle(11, 25, 5);
    g.fillCircle(29, 25, 5);
    g.fillStyle(COLORS.knight, 1);
    g.fillRect(18, 26, 4, 14);
    g.fillRect(14, 31, 12, 3);
    g.fillStyle(0x4a6278, 1);
    g.fillCircle(20, 15, 9);
    g.fillRect(11, 14, 18, 7);
    g.fillStyle(COLORS.knightCore, 1);
    g.fillRect(13, 15, 14, 3);
    g.fillStyle(0x16202b, 1);
    g.fillRect(17, 4, 6, 4);
  });

  // Spectral bolt fired by the knights.
  bake('bolt', 14, 40, (g) => {
    g.fillStyle(COLORS.knight, 0.3);
    g.fillEllipse(7, 20, 14, 40);
    g.fillStyle(COLORS.knight, 0.8);
    g.fillEllipse(7, 18, 8, 30);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(7, 14, 4, 18);
  });

  // Hooded cultist, the basic horde unit.
  bake('walker', 56, 64, (g) => {
    g.fillStyle(COLORS.horde, 0.14);
    g.fillCircle(28, 34, 28);
    g.fillStyle(0x4a1312, 1);
    g.fillTriangle(8, 62, 48, 62, 28, 14);
    g.fillStyle(COLORS.hordeDark, 1);
    g.fillTriangle(14, 60, 42, 60, 28, 22);
    g.fillStyle(COLORS.horde, 1);
    g.fillTriangle(16, 34, 40, 34, 28, 6);
    g.fillStyle(0x200807, 1);
    g.fillEllipse(28, 28, 16, 12);
    g.fillStyle(COLORS.rot, 1);
    g.fillCircle(24, 28, 2.5);
    g.fillCircle(32, 28, 2.5);
  });

  // Sprinter: a fast, low crawler.
  bake('sprinter', 52, 46, (g) => {
    g.fillStyle(COLORS.rot, 0.16);
    g.fillCircle(26, 24, 22);
    g.lineStyle(4, 0x3f5f22, 1);
    g.lineBetween(8, 8, 20, 22);
    g.lineBetween(44, 8, 32, 22);
    g.lineBetween(6, 40, 20, 28);
    g.lineBetween(46, 40, 32, 28);
    g.fillStyle(0x5f8f2f, 1);
    g.fillEllipse(26, 25, 24, 30);
    g.fillStyle(COLORS.rot, 1);
    g.fillEllipse(26, 20, 14, 14);
    g.fillStyle(COLORS.horde, 1);
    g.fillCircle(22, 34, 3);
    g.fillCircle(30, 34, 3);
  });

  // Brute: a slow flesh mass with many eyes.
  bake('brute', 100, 100, (g) => {
    g.fillStyle(COLORS.horde, 0.14);
    g.fillCircle(50, 52, 48);
    g.fillStyle(COLORS.hordeDark, 1);
    g.fillCircle(50, 54, 38);
    g.fillCircle(30, 40, 18);
    g.fillCircle(70, 40, 18);
    g.fillStyle(0xa02a26, 1);
    g.fillCircle(50, 50, 28);
    g.fillStyle(0xf3efc8, 1);
    [[40, 44, 6], [60, 44, 6], [50, 58, 7], [34, 60, 4], [66, 60, 4]].forEach((e) => g.fillCircle(e[0], e[1], e[2]));
    g.fillStyle(0x1a0606, 1);
    [[40, 45, 3], [60, 45, 3], [50, 59, 3.5], [34, 61, 2], [66, 61, 2]].forEach((e) => g.fillCircle(e[0], e[1], e[2]));
  });

  // Boss: a many-eyed horror with tentacles.
  bake('boss', 320, 280, (g) => {
    g.fillStyle(COLORS.horde, 0.12);
    g.fillCircle(160, 150, 140);
    g.fillStyle(0x3a0c0b, 1);
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * 0.15 + (i / 7) * Math.PI * 0.7;
      const x = 160 + Math.cos(a) * 110;
      const y = 150 + Math.sin(a) * 110;
      g.fillTriangle(160 + Math.cos(a) * 60 - 14, 150 + Math.sin(a) * 60, 160 + Math.cos(a) * 60 + 14, 150 + Math.sin(a) * 60, x, y);
    }
    g.fillStyle(COLORS.hordeDark, 1);
    g.fillCircle(160, 130, 105);
    g.fillStyle(0x9c2421, 1);
    g.fillCircle(160, 125, 85);
    g.fillStyle(0x5a1210, 1);
    g.fillEllipse(160, 175, 110, 34);
    g.fillStyle(0xf3efc8, 1);
    g.fillRect(118, 168, 8, 14);
    g.fillRect(140, 170, 8, 16);
    g.fillRect(172, 170, 8, 16);
    g.fillRect(194, 168, 8, 14);
    const eyes = [[160, 105, 22], [116, 92, 12], [204, 92, 12], [128, 136, 10], [192, 136, 10], [160, 60, 9], [96, 124, 7], [224, 124, 7]];
    g.fillStyle(0xf6f2c0, 1);
    eyes.forEach((e) => g.fillCircle(e[0], e[1], e[2]));
    g.fillStyle(COLORS.rot, 1);
    eyes.forEach((e) => g.fillCircle(e[0], e[1] + 1, e[2] * 0.55));
    g.fillStyle(0x0c0303, 1);
    eyes.forEach((e) => g.fillCircle(e[0], e[1] + 1, e[2] * 0.25));
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
