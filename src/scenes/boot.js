class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    ['knight', 'champion', 'walker', 'sprinter', 'brute', 'boss'].forEach((key) => {
      this.load.image(key, './assets/' + key + '.png');
    });
  }

  create() {
    makeTextures(this);
    this.scene.start('Title');
  }
}
