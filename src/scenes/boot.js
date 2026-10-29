class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    ['knight', 'champion', 'walker', 'sprinter', 'brute', 'boss', 'portrait_knight', 'portrait_champion', 'airship',
      'wraith', 'bloater', 'shield', 'summoner', 'splitter', 'colossus', 'brood', 'wraithking'].forEach((key) => {
      this.load.image(key, './assets/' + key + '.png');
    });
  }

  create() {
    makeTextures(this);
    this.scene.start('Title');
  }
}
