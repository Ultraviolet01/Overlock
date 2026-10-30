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

    // Each record is kept on its own; the highest wave is the headline one.
    const prev = Store.get('best', null) || { wave: 0, topSpeed: 1, score: 0, maxSquad: 0 };
    const isBest = r.wave > prev.wave;
    const best = {
      wave: Math.max(prev.wave || 0, r.wave),
      topSpeed: Math.max(prev.topSpeed || 1, r.topSpeed),
      score: Math.max(prev.score || 0, r.score),
      maxSquad: Math.max(prev.maxSquad || 0, r.maxSquad),
    };
    Store.set('best', best);

    const panel = uiModal(this, 640, 1060, 'WAVE ' + r.wave);
    panel.y = H / 2 - 20;
    const add = (o) => {
      panel.add(o);
      return o;
    };

    add(this.add.text(0, -440, 'THE HORDE BROKE THROUGH', textStyle(42, '#ff5a3c', { fontStyle: 'italic' })).setOrigin(0.5));
    if (isBest) {
      const nb = add(this.add.text(0, -385, 'NEW BEST WAVE', textStyle(32, '#f2c14e')).setOrigin(0.5));
      this.tweens.add({ targets: nb, scale: 1.12, duration: 420, yoyo: true, repeat: -1 });
    } else {
      add(this.add.text(0, -385, 'BEST WAVE ' + best.wave + '  |  BEST SCORE ' + best.score.toLocaleString('en-US'),
        textStyle(24, '#c9d6d2')).setOrigin(0.5));
    }

    // Progress toward the next horror, like a level progress bar.
    const every = TUNING.bossEvery;
    const base = Math.floor((r.wave - 1) / every) * every;
    const nextBoss = base + every;
    const progress = clamp((r.wave - base) / every, 0, 1);
    const g = add(this.add.graphics());
    g.fillStyle(0x0a0f0e, 1);
    g.fillRoundedRect(-244, -324, 448, 38, 19);
    g.fillStyle(0x1b1f1e, 1);
    g.fillRoundedRect(-240, -320, 440, 30, 15);
    g.fillStyle(0x3e9c3a, 1);
    g.fillRoundedRect(-240, -320, Math.max(30, 440 * progress), 30, 15);
    g.fillStyle(0x5fd35a, 1);
    g.fillRoundedRect(-240, -320, Math.max(30, 440 * progress), 22, 11);
    add(this.add.text(-20, -305, Math.round(progress * 100) + '%', textStyle(22, '#ffffff')).setOrigin(0.5));
    add(this.add.image(235, -305, 'skull').setScale(1.2));
    const atBoss = r.wave % every === 0;
    add(this.add.text(0, -265, atBoss ? 'YOU REACHED THE HORROR' : 'NEXT HORROR: WAVE ' + nextBoss,
      textStyle(20, '#c9d6d2', { strokeThickness: 4 })).setOrigin(0.5));

    const cards = [
      ['TOP SPEED', 'x' + r.topSpeed.toFixed(1), '#4fc3ff'],
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
      cg.fillStyle(0x000000, 0.45);
      cg.fillRoundedRect(x - 125, y - 58, 250, 116, 12);
      cg.lineStyle(2, 0xffffff, 0.2);
      cg.strokeRoundedRect(x - 125, y - 58, 250, 116, 12);
      add(this.add.text(x, y - 30, c[0], textStyle(18, '#c9d6d2', { strokeThickness: 4 })).setOrigin(0.5));
      add(this.add.text(x, y + 14, c[1], textStyle(48, c[2] === COLORS.text ? '#ffffff' : c[2], { fontStyle: 'italic' })).setOrigin(0.5));
    });

    const again = () => this.scene.start('Game', { hero: r.hero });
    add(uiButton(this, 0, 320, 460, 112, 'RUN AGAIN', 0x5fd35a, again, { size: 50 }));
    add(uiButton(this, 0, 450, 460, 88, 'CHANGE WIZARD', BTN_BLUE, () => this.scene.start('Select'), { size: 30 }));

    this.input.keyboard.once('keydown-SPACE', again);
    this.input.keyboard.once('keydown-ENTER', again);
  }
}
