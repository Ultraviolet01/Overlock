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
    scene: [BootScene, TitleScene, GameScene, GameOverScene],
  });
}

if (document.fonts && document.fonts.load) {
  document.fonts.load('40px "Lilita One"').then(startGame, startGame);
  setTimeout(startGame, 3000);
} else {
  startGame();
}
