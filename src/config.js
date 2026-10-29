// Shared constants, tuning values and small helpers.

const W = 720;
const H = 1280;

// The line where the squad stands. Zombies that reach it bite the squad,
// gates that reach it are walked through.
const LINE_Y = 1080;

const COLORS = {
  bg: 0x0b1412,
  road: 0x1c2622,
  knight: 0x4fc3ff,
  knightCore: 0xc8f1ff,
  horde: 0xe0413a,
  hordeDark: 0x7a1c1a,
  rot: 0x8fd14f,
  gold: 0xf2c14e,
  ember: 0xff8a3d,
  bad: 0xe0413a,
  speedGate: 0x4fe0c8,
  text: '#e8f4f0',
  textDim: '#8fa8a0',
};

const TUNING = {
  waveLength: 15,          // seconds per wave; the horde speeds up each wave
  bossEvery: 5,            // a boss charges at the start of every 5th wave
  maxSpeed: 10,            // fire rate multiplier cap
  maxShooters: 8,          // bullets per volley; bigger squads hit harder instead
  boltSpeed: 1300,
  gateEvery: 8.5,          // seconds between gate rows
  gateFall: 150,           // gate fall speed in px/s
  speedDecay: 0.05,        // fire rate lost per second, so you must keep killing
  bossTime: 14,            // seconds the boss needs to reach the squad
  squadCap: 9999,
};

const HEROES = {
  blitz: {
    key: 'blitz',
    name: 'BLITZ',
    role: 'Fastest fire rate, light bolts',
    interval: 0.38,
    damage: 0.7,
    hitLoss: 1,
    startSquad: 5,
    ability: null,
  },
  tank: {
    key: 'tank',
    name: 'BULWARK',
    role: 'Slow fire, hits barely slow you',
    interval: 0.55,
    damage: 1.2,
    hitLoss: 0.25,
    startSquad: 6,
    ability: null,
  },
  surge: {
    key: 'surge',
    name: 'SURGE',
    role: 'Tap SURGE to double all speed for 5s',
    interval: 0.48,
    damage: 0.95,
    hitLoss: 1,
    startSquad: 5,
    ability: 'surge',
  },
};

const Store = {
  get(key, fallback) {
    try {
      const raw = window.localStorage.getItem('overclock.' + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem('overclock.' + key, JSON.stringify(value));
    } catch (e) {
      // Storage can be blocked inside some embeds; the game works without it.
    }
  },
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function weighted(entries) {
  let total = 0;
  for (const e of entries) total += e[1];
  let r = Math.random() * total;
  for (const e of entries) {
    r -= e[1];
    if (r <= 0) return e[0];
  }
  return entries[entries.length - 1][0];
}

function textStyle(size, color, extra) {
  return Object.assign({
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: size + 'px',
    color: color || COLORS.text,
    fontStyle: 'bold',
  }, extra || {});
}
