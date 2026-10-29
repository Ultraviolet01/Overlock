// End of run: how close you got to the next horror, stat cards, and buttons to go again.

class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  init(data) {
    this.result = data;
  }

  create() {
    const r = this.result;
    this.add.tileSprite(W / 2, H / 2, W, H, 'road').setTint(0x5f6f6a);

    const prev = Store.get('best', null);
    const isBest = !prev || r.score > prev.score;
    if (isBest) Store.set('best', { wave: r.wave, topSpeed: r.topSpeed, score: r.score, maxSquad: r.maxSquad });

    const panel = uiModal(this, 640, 1060, 'WAVE ' + r.wave);
    panel.y = H / 2 - 20;
    const add = (o) => {
      panel.add(o);
      return o;
    };

    add(this.add.text(0, -440, 'THE HORDE BROKE THROUGH', textStyle(38, '#e0413a', { stroke: '#0b1412', strokeThickness: 6 })).setOrigin(0.5));
    if (isBest) {
      const nb = add(this.add.text(0, -385, 'NEW BEST RUN', textStyle(30, '#f2c14e')).setOrigin(0.5));
      this.tweens.add({ targets: nb, scale: 1.12, duration: 420, yoyo: true, repeat: -1 });
    } else {
      add(this.add.text(0, -385, 'Best: ' + prev.score + ' pts, wave ' + prev.wave,
        textStyle(24, COLORS.textDim, { fontStyle: 'normal' })).setOrigin(0.5));
    }

    // Progress toward the next horror, like a level progress bar.
    const every = TUNING.bossEvery;
    const base = Math.floor((r.wave - 1) / every) * every;
    const nextBoss = base + every;
    const progress = clamp((r.wave - base) / every, 0, 1);
    const g = add(this.add.graphics());
    g.fillStyle(0x0a1310, 1);
    g.fillRoundedRect(-240, -320, 440, 30, 15);
    g.fillStyle(COLORS.gold, 1);
    g.fillRoundedRect(-240, -320, Math.max(30, 440 * progress), 30, 15);
    add(this.add.text(-20, -305, Math.round(progress * 100) + '%', textStyle(20, '#0b1412')).setOrigin(0.5));
    add(this.add.image(235, -305, 'skull').setScale(1.1));
    const atBoss = r.wave % every === 0;
    add(this.add.text(0, -265, atBoss ? 'YOU REACHED THE HORROR' : 'NEXT HORROR: WAVE ' + nextBoss,
      textStyle(20, COLORS.textDim)).setOrigin(0.5));

    const cards = [
      ['TOP FIRE RATE', 'x' + r.topSpeed.toFixed(1), '#4fc3ff'],
      ['BIGGEST SQUAD', String(r.maxSquad), COLORS.text],
      ['WAVE REACHED', String(r.wave), '#f2c14e'],
      ['HORDE SLAIN', String(r.kills), COLORS.text],
      ['HORRORS SLAIN', String(r.bosses), COLORS.text],
      ['SCORE', String(r.score), '#f2c14e'],
    ];
    cards.forEach((c, i) => {
      const x = (i % 2 === 0 ? -1 : 1) * 135;
      const y = -150 + Math.floor(i / 2) * 140;
      const cg = add(this.add.graphics());
      cg.fillStyle(0x1d2a26, 1);
      cg.fillRoundedRect(x - 125, y - 58, 250, 116, 16);
      cg.lineStyle(2, COLORS.knight, 0.35);
      cg.strokeRoundedRect(x - 125, y - 58, 250, 116, 16);
      add(this.add.text(x, y - 28, c[0], textStyle(18, COLORS.textDim)).setOrigin(0.5));
      add(this.add.text(x, y + 14, c[1], textStyle(44, c[2])).setOrigin(0.5));
    });

    const again = () => this.scene.start('Game', { hero: r.hero });
    add(uiButton(this, 0, 320, 460, 112, 'RUN AGAIN', COLORS.gold, again, { size: 46 }));
    add(uiButton(this, 0, 450, 460, 88, 'CHANGE CAPTAIN', 0x2f7f74, () => this.scene.start('Title'), { size: 30, textColor: '#ffffff' }));

    this.input.keyboard.once('keydown-SPACE', again);
    this.input.keyboard.once('keydown-ENTER', again);
  }
}
