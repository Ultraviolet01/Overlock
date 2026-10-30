let game;

// Wait for the bundled font so the first frame already uses it.
function startGame() {
  if (game) return;
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: COLORS.bg,
    transparent: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    input: {
      activePointers: 2,
    },
    render: {
      antialias: true,
    },
    scene: [BootScene, TitleScene, SelectScene, GameScene, GameOverScene],
  });
}

// Set up the 3D battlefield and load its models; if WebGL is missing or
// anything fails, the game falls back to the 2D battlefield.
function load3D() {
  try {
    World3D.init(document.getElementById('game'));
    return World3D.load();
  } catch (e) {
    World3D.ready = false;
    return Promise.resolve();
  }
}

const fontReady = document.fonts && document.fonts.load
  ? document.fonts.load('40px "Lilita One"').catch(() => {})
  : Promise.resolve();
Promise.all([fontReady, load3D()]).then(startGame, startGame);
setTimeout(startGame, 30000);
