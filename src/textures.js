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
