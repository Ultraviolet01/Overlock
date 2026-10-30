// All sound is synthesized with WebAudio, so there are no audio files to load.
// The music tempo follows the squad's fire rate.

const Sfx = {
  ctx: null,
  master: null,
  musicBus: null,
  sfxBus: null,
  lastShot: 0,

  init() {
    if (this.ctx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.applyVolumes();
    } catch (e) {
      this.ctx = null;
    }
  },

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  // Reads the music and sound effect volumes from Settings.
  applyVolumes() {
    if (!this.ctx) return;
    this.musicBus.gain.value = Settings.get('music');
    this.sfxBus.gain.value = Settings.get('sfx');
  },

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  },

  tone(freq, dur, type, vol, t, slideTo, bus) {
    if (!this.ctx) return;
    t = t || this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(bus || this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  noise(dur, vol, t, filterFreq, filterType, bus) {
    if (!this.ctx) return;
    t = t || this.ctx.currentTime;
    if (!this.noiseBuffer) {
      const len = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType || 'highpass';
    filter.frequency.value = filterFreq || 4000;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus || this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  },

  shoot(speed) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - this.lastShot < 0.07) return;
    this.lastShot = t;
    this.tone(880 + speed * 60, 0.06, 'square', 0.035, t, 440);
  },

  hit() {
    this.noise(0.05, 0.05, 0, 2500);
  },

  kill() {
    this.tone(220, 0.12, 'sawtooth', 0.05, 0, 80);
  },

  bite() {
    this.tone(140, 0.25, 'sawtooth', 0.12, 0, 50);
    this.noise(0.2, 0.08, 0, 600, 'lowpass');
  },

  gateGood() {
    const t = this.now();
    this.tone(523, 0.12, 'triangle', 0.12, t);
    this.tone(784, 0.18, 'triangle', 0.12, t + 0.08);
    this.tone(1046, 0.25, 'triangle', 0.1, t + 0.16);
  },

  gateBad() {
    const t = this.now();
    this.tone(330, 0.2, 'sawtooth', 0.1, t, 160);
    this.tone(220, 0.3, 'sawtooth', 0.1, t + 0.12, 90);
  },

  gateTick() {
    this.tone(1400, 0.03, 'sine', 0.03);
  },

  bossRoar() {
    this.tone(90, 1.2, 'sawtooth', 0.2, 0, 40);
    this.noise(1.0, 0.12, 0, 400, 'lowpass');
  },

  bossDown() {
    const t = this.now();
    this.noise(0.8, 0.2, t, 300, 'lowpass');
    [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.12, t + i * 0.09));
  },

  click() {
    this.tone(660, 0.05, 'triangle', 0.08);
  },

  surge() {
    this.tone(300, 0.5, 'square', 0.08, 0, 1800);
  },

  lose() {
    const t = this.now();
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.12, t + i * 0.18));
  },
};

const Music = {
  playing: false,
  nextTime: 0,
  step: 0,
  bass: [55, 55, 65.4, 55, 49, 49, 58.3, 61.7],

  start() {
    if (!Sfx.ctx) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = Sfx.ctx.currentTime + 0.05;
  },

  stop() {
    this.playing = false;
  },

  // Called every frame. Schedules a little ahead so timing stays tight.
  update(speed) {
    if (!this.playing || !Sfx.ctx) return;
    const bpm = 92 + (speed - 1) * 29;
    const stepDur = 60 / bpm / 2;
    const ahead = Sfx.ctx.currentTime + 0.12;
    if (this.nextTime < Sfx.ctx.currentTime - 0.5) this.nextTime = Sfx.ctx.currentTime;
    while (this.nextTime < ahead) {
      this.playStep(this.step, this.nextTime, speed);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 16;
    }
  },

  playStep(s, t, speed) {
    const bus = Sfx.musicBus;
    if (s % 4 === 0) Sfx.tone(110, 0.18, 'sine', 0.22, t, 40, bus);
    if (s % 8 === 4) Sfx.noise(0.12, 0.08, t, 1800, 'bandpass', bus);
    if (s % 2 === 1) Sfx.noise(0.03, speed > 4 ? 0.035 : 0.02, t, 7000, 'highpass', bus);
    if (s % 2 === 0) Sfx.tone(this.bass[(s / 2) % 8], 0.2, 'triangle', 0.09, t, 0, bus);
    if (speed > 6 && s % 4 === 2) Sfx.tone(this.bass[(s / 2) % 8] * 4, 0.08, 'square', 0.025, t, 0, bus);
  },
};
