// The battlefield in real 3D, drawn by three.js on a canvas under Phaser's.
// Game logic still runs in flat world coordinates (x across the road, y down
// the road, the squad at LINE_Y). Each frame, World3D.sync() places a 3D model
// for every knight, enemy, boss and barrel at its world position, and
// World3D.project() maps world points to the screen for the 2D overlay
// (bolts, gates, numbers, HUD).

const U = 0.01; // 3D units per world pixel

// Model height in 3D units at the squad line.
const MODEL_SIZE = {
  knight: 1.3, champion: 1.75, walker: 1.35, sprinter: 0.95, brute: 2.0,
  wraith: 1.4, bloater: 1.55, shield: 1.5, summoner: 1.6, splitter: 1.0, slimelet: 0.5,
  boss: 3.2, colossus: 3.3, brood: 2.6, wraithking: 3.4, barrel: 0.75,
};

// Natural height of each hand-built model before scaling.
const HAND_BASE = {
  walker: 1.15, wraith: 1.25, bloater: 1.4, shield: 1.35, summoner: 1.45, splitter: 0.9, slimelet: 0.45,
  barrel: 0.75,
};

// Walk cycle for the AI models, which are single solid meshes with no
// skeleton: the vertex shader swings everything below the hips forward and
// back (left and right in opposite phase, feet lifting on the forward swing)
// and swings the arms the other way. quad: four-legged, front and back legs
// alternate too. Values are fractions of the model's height or half-width.
const GAIT = {
  knight: { hip: 0.42, stride: 0.2, arms: [0.5, 0.78], armX: 0.62 },
  walker: { hip: 0.45, stride: 0.22, arms: [0.5, 0.8], armX: 0.55 },
  brute: { hip: 0.4, stride: 0.18, arms: [0.35, 0.75], armX: 0.6 },
  boss: { hip: 0.42, stride: 0.12, arms: [0.3, 0.7], armX: 0.6 },
  sprinter: { hip: 0.75, stride: 0.22, quad: true, arms: [2, 2], armX: 1 },
  colossus: { hip: 0.38, stride: 0.1, arms: [0.3, 0.7], armX: 0.6 },
  brood: { hip: 0.35, stride: 0.08, quad: true, arms: [2, 2], armX: 1 },
  wraithking: { hip: 0.42, stride: 0.1, arms: [0.3, 0.7], armX: 0.6 },
};

// AI-generated textured models; every other kind is built from shapes below.
const GLB_MODELS = ['knight', 'walker', 'sprinter', 'brute', 'boss', 'colossus', 'brood', 'wraithking'];

// Enemies that have Higgsfield PNGs but no GLB; rendered as billboards.
const BILLBOARD_MODELS = ['wraith', 'bloater', 'shield', 'summoner', 'splitter'];

const World3D = {
  active: false,
  ready: false,
  templates: {},
  pools: {},
  live: new Set(),
  frame: 0,
  decals: [],

  // ---------------------------------------------------------------- setup

  init(parent) {
    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    r.setSize(W, H, false);
    r.outputEncoding = THREE.sRGBEncoding;
    const c = r.domElement;
    c.className = 'world3d';
    Object.assign(c.style, { position: 'absolute', left: '0px', top: '0px', zIndex: '0', display: 'none' });
    parent.style.position = 'relative';
    parent.insertBefore(c, parent.firstChild);
    this.renderer = r;
    this.canvas = c;

    const s = new THREE.Scene();
    s.background = new THREE.Color(0x0b1412);
    s.fog = new THREE.Fog(0x0b1412, 14, 26);
    this.scene = s;

    const cam = new THREE.PerspectiveCamera(48, W / H, 0.1, 80);
    cam.position.set(0, 10, 6.5);
    cam.lookAt(0, 0, -2.5);
    cam.rotateZ(-0.035); // a slight lean, like Last War's road
    cam.updateMatrixWorld();
    this.camera = cam;
    this.refDist = cam.position.length();
    this._v = new THREE.Vector3();

    s.add(new THREE.HemisphereLight(0xcfe0f0, 0x2a3a30, 1.25));
    const sun = new THREE.DirectionalLight(0xffe6c8, 1.0);
    sun.position.set(-4, 9, 5);
    s.add(sun);

    this.buildGround();
    this.buildTrees();
    this.shadowMat = new THREE.MeshBasicMaterial({ map: this.radialTexture('rgba(0,0,0,0.55)'), transparent: true, depthWrite: false });
    this.shadowGeo = new THREE.PlaneGeometry(1, 1);
    this.decalGeo = { lane: new THREE.PlaneGeometry(1, 1), circle: new THREE.CircleGeometry(1, 32) };
    this.decalPool = [];
  },

  // Loads the AI-generated models. Resolves even if a model fails; that kind
  // then falls back to a hand-built model.
  load() {
    const loader = new THREE.GLTFLoader();
    return Promise.all(GLB_MODELS.map((name) => new Promise((done) => {
      loader.load('./assets/models/' + name + '.glb', (gltf) => {
        this.templates[name] = this.normalize(gltf.scene, MODEL_SIZE[name]);
        if (name === 'wraithking') this.templates[name].userData.float = 0.3;
        done();
      }, undefined, () => done());
    }))).then(() => {
      const texLoader = new THREE.TextureLoader();
      return Promise.all(BILLBOARD_MODELS.map((name) => new Promise((done) => {
        texLoader.load('./assets/' + name + '.png', (tex) => {
          tex.encoding = THREE.sRGBEncoding;
          this.billboards = this.billboards || {};
          this.billboards[name] = tex;
          done();
        }, undefined, () => done());
      })));
    }).then(() => { this.ready = true; });
  },

  // Matte material, computed normals (the generated files have none), feet
  // on the ground, centered, and scaled to the target height.
  normalize(root, height) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.computeVertexNormals();
      o.material = new THREE.MeshLambertMaterial({ map: o.material.map || null, color: o.material.map ? 0xffffff : o.material.color });
      if (o.material.map) o.material.map.encoding = THREE.sRGBEncoding;
    });
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    // Gait geometry in the mesh's own coordinates, for the walk shader.
    root.updateMatrixWorld(true);
    let geo = null;
    root.traverse((o) => { if (o.isMesh && !geo) geo = o.geometry; });
    if (geo) {
      geo.computeBoundingBox();
      const b = geo.boundingBox;
      root.userData.gaitBox = { minY: b.min.y, maxY: b.max.y, cx: (b.min.x + b.max.x) / 2, cz: (b.min.z + b.max.z) / 2, halfW: (b.max.x - b.min.x) / 2 };
    }
    const k = height / size.y;
    root.scale.setScalar(k);
    root.position.set(-(box.min.x + size.x / 2) * k, -box.min.y * k, -(box.min.z + size.z / 2) * k);
    const g = new THREE.Group();
    g.add(root);
    return g;
  },

  radialTexture(inner) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const x = cv.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, inner);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  },

  // Stone road texture: staggered blocks, joints and a dashed center line.
  roadTexture() {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 256;
    const x = cv.getContext('2d');
    x.fillStyle = '#1b2421';
    x.fillRect(0, 0, 256, 256);
    const rows = 8;
    const rh = 256 / rows;
    for (let r = 0; r < rows; r++) {
      const shift = r % 2 ? 20 : 0;
      for (let c = -1; c < 7; c++) {
        const bx = c * 41 + shift + 2;
        const tone = 42 + ((r * 7 + c * 13) % 9);
        x.fillStyle = 'rgb(' + tone + ',' + (tone + 10) + ',' + (tone + 6) + ')';
        x.fillRect(bx, r * rh + 2, 37, rh - 4);
      }
    }
    x.fillStyle = 'rgba(120,135,128,0.55)';
    x.fillRect(124, 20, 8, 80);
    x.fillRect(124, 148, 8, 80);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  },

  buildGround() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: 0x0f2219 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.02, -15);
    this.scene.add(floor);

    this.roadLen = 44;
    this.roadTex = this.roadTexture();
    this.roadTex.repeat.set(1, this.roadLen / 5.6);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(5.6, this.roadLen), new THREE.MeshLambertMaterial({ map: this.roadTex }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -this.roadLen / 2 + 6);
    this.scene.add(road);

    const curbMat = new THREE.MeshLambertMaterial({ color: 0x3a4743 });
    [-2.88, 2.88].forEach((x) => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, this.roadLen), curbMat);
      curb.position.set(x, 0.07, -this.roadLen / 2 + 6);
      this.scene.add(curb);
    });
  },

  buildTrees() {
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x2b1d14 });
    const leaf = [0x10291c, 0x143322, 0x183d29, 0x1d4731].map((c) => new THREE.MeshLambertMaterial({ color: c }));
    this.trees = [];
    for (let i = 0; i < 40; i++) {
      const t = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.6, 6), trunkMat);
      trunk.position.y = 0.3;
      t.add(trunk);
      for (let k = 0; k < 4; k++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.0 - k * 0.2, 1.1, 7), leaf[k]);
        cone.position.y = 0.9 + k * 0.6;
        t.add(cone);
      }
      const side = i % 2 === 0 ? -1 : 1;
      t.position.set(side * (3.6 + Math.random() * 2.4), 0, -32 + (i / 40) * 40);
      t.scale.setScalar(0.9 + Math.random() * 0.7);
      t.rotation.y = Math.random() * Math.PI;
      this.scene.add(t);
      this.trees.push(t);
    }
  },

  // ---------------------------------------------------------------- per run

  setActive(on) {
    if (!this.canvas) return;
    this.active = on;
    this.canvas.style.display = on ? 'block' : 'none';
    if (!on) this.clear();
  },

  clear() {
    this.live.forEach((m) => this.release(m));
    this.live.clear();
    this.show = null;
    this.decalPool.forEach((d) => { d.visible = false; });
  },

  // World point (x, y on the road, h height in world pixels) to screen.
  // s is the size factor relative to the squad line.
  project(wx, wy, h) {
    const v = this._v.set((wx - W / 2) * U, (h || 0) * U, (wy - LINE_Y) * U);
    const dist = v.distanceTo(this.camera.position);
    v.project(this.camera);
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, s: this.refDist / dist };
  },

  // ---------------------------------------------------------------- models

  acquire(kind) {
    const pool = this.pools[kind] || (this.pools[kind] = []);
    let m = pool.pop();
    if (!m) {
      m = this.build(kind);
      m.userData.kind = kind;
      const sh = new THREE.Mesh(this.shadowGeo, this.shadowMat);
      sh.rotation.x = -Math.PI / 2;
      sh.renderOrder = -1;
      const w = (MODEL_SIZE[kind] || 1) * (kind === 'sprinter' ? 1.2 : 0.75);
      sh.scale.set(w, w * 0.7, 1);
      m.userData.shadow = sh;
      m.add(sh);
      // Own materials per model, so a hit flash only lights up that one.
      m.userData.mats = [];
      m.traverse((o) => {
        if (o.isMesh && o !== sh) {
          o.material = o.material.clone();
          o.material.userData.baseEmissive = o.material.emissive ? o.material.emissive.getHex() : 0;
          m.userData.mats.push(o.material);
        }
      });
      if (m.userData.gait && m.userData.inner) {
        const box = m.userData.inner.userData.gaitBox || this.templates.knight.children[0].userData.gaitBox;
        m.userData.walkU = m.userData.mats.map((mt) => this.walkShader(mt, m.userData.gait, box));
      }
      m.userData.innerY = m.userData.inner ? m.userData.inner.position.y : 0;
      m.userData.baseScaleY = m.scale.y;
      this.scene.add(m);
    }
    m.visible = true;
    this.live.add(m);
    return m;
  },

  release(m) {
    m.visible = false;
    if (m.userData.owner) m.userData.owner._m3 = null;
    m.userData.owner = null;
    this.live.delete(m);
    this.pools[m.userData.kind].push(m);
  },

  buildBillboard(kind) {
    const texKind = kind === 'slimelet' ? 'splitter' : kind;
    const tex = this.billboards[texKind];
    const h = MODEL_SIZE[kind] || 1.3;
    const aspect = tex.image ? tex.image.width / tex.image.height : 0.7;
    const w = h * aspect;
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = h / 2;
    const g = new THREE.Group();
    g.add(mesh);
    g.userData.inner = mesh;
    g.userData.billboard = true;
    if (kind === 'wraith') g.userData.float = 0.25;
    return g;
  },

  build(kind) {
    if (kind === 'champion' && this.templates.knight) return this.buildChampion();
    if (this.templates[kind]) {
      const g = this.templates[kind].clone(true);
      g.userData.inner = g.children[0];
      g.userData.gait = GAIT[kind];
      return g;
    }
    const bbKind = kind === 'slimelet' ? 'splitter' : kind;
    if (this.billboards && this.billboards[bbKind]) return this.buildBillboard(kind);
    const f = this['build_' + kind] || this.build_walker;
    const g = f.call(this);
    const base = HAND_BASE[kind] || HAND_BASE.walker;
    g.scale.multiplyScalar((MODEL_SIZE[kind] || base) / base);
    return g;
  },

  walkShader(mat, gait, b) {
    const h = b.maxY - b.minY;
    const u = {
      uPhase: { value: 0 },
      uAmp: { value: 0 },
      uMinY: { value: b.minY },
      uHip: { value: b.minY + gait.hip * h },
      uStride: { value: gait.stride * h },
      uCx: { value: b.cx },
      uCz: { value: b.cz },
      uQuad: { value: gait.quad ? 1 : 0 },
      uArmLo: { value: b.minY + gait.arms[0] * h },
      uArmHi: { value: b.minY + gait.arms[1] * h },
      uArmX: { value: gait.armX * b.halfW },
    };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = 'uniform float uPhase, uAmp, uMinY, uHip, uStride, uCx, uCz, uQuad, uArmLo, uArmHi, uArmX;\n' +
        sh.vertexShader.replace('#include <begin_vertex>', [
          '#include <begin_vertex>',
          'float side = position.x > uCx ? 1.0 : -1.0;',
          'if (uQuad > 0.5) side *= position.z > uCz ? 1.0 : -1.0;',
          'float swing = sin(uPhase) * side;',
          'if (position.y < uHip) {',
          '  float k = clamp((uHip - position.y) / max(uHip - uMinY, 0.0001), 0.0, 1.0);',
          '  transformed.z += swing * k * uStride * uAmp;',
          '  transformed.y += max(0.0, swing) * k * uStride * 0.45 * uAmp;',
          '}',
          'if (position.y > uArmLo && position.y < uArmHi && abs(position.x - uCx) > uArmX) {',
          '  float a = (position.y - uArmLo) / max(uArmHi - uArmLo, 0.0001);',
          '  transformed.z -= swing * (1.0 - a) * uStride * 0.7 * uAmp;',
          '}',
        ].join('\n'));
    };
    mat.customProgramCacheKey = () => 'walk';
    return u;
  },

  mat(color, emissive) {
    return new THREE.MeshLambertMaterial({ color, emissive: emissive || 0x000000 });
  },

  part(geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  },

  // A small walking figure body: two legs that swing in the walk cycle.
  legs(g, color, spread, len, width) {
    const legs = [-1, 1].map((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(s * spread, len, 0);
      pivot.add(this.part(new THREE.CylinderGeometry(width, width * 0.9, len, 6), this.mat(color), 0, -len / 2, 0));
      g.add(pivot);
      return pivot;
    });
    g.userData.legs = legs;
  },

  buildChampion() {
    const g = this.templates.knight.clone(true);
    g.userData.inner = g.children[0];
    g.userData.gait = GAIT.knight;
    g.scale.setScalar(MODEL_SIZE.champion / MODEL_SIZE.knight);
    // Gold-lit armor and blue soul flames on the shoulders mark a champion.
    g.traverse((o) => { if (o.isMesh) o.material = o.material.clone(); });
    g.traverse((o) => { if (o.isMesh) o.material.color.setHex(0xffd88a); });
    [-0.24, 0.24].forEach((x) => g.add(this.part(new THREE.SphereGeometry(0.08, 8, 6), this.mat(0x4fc3ff, 0x2a9fdf), x, 0.62, 0)));
    return g;
  },

  build_walker() {
    const g = new THREE.Group();
    const robe = this.mat(0x7a1c1a);
    g.add(this.part(new THREE.ConeGeometry(0.38, 1.0, 8), robe, 0, 0.55, 0));
    g.add(this.part(new THREE.SphereGeometry(0.2, 10, 8), this.mat(0x5e1513), 0, 1.05, 0));
    [-0.07, 0.07].forEach((x) => g.add(this.part(new THREE.SphereGeometry(0.035, 6, 4), this.mat(0x8fd14f, 0x6aa63a), x, 1.05, 0.17)));
    return g;
  },

  build_wraith() {
    const g = new THREE.Group();
    const cloth = this.mat(0x1b1d22);
    g.add(this.part(new THREE.ConeGeometry(0.42, 1.1, 9, 1, true), cloth, 0, 0.75, 0));
    g.add(this.part(new THREE.SphereGeometry(0.24, 10, 8), cloth, 0, 1.25, 0));
    [-0.08, 0.08].forEach((x) => g.add(this.part(new THREE.SphereGeometry(0.045, 6, 4), this.mat(0x8fd14f, 0x7ed957), x, 1.26, 0.2)));
    [-0.34, 0.34].forEach((x) => g.add(this.part(new THREE.SphereGeometry(0.08, 6, 4), this.mat(0xb8c8b0), x, 0.95, 0.25)));
    const smoke = this.part(new THREE.ConeGeometry(0.3, 0.5, 8), new THREE.MeshLambertMaterial({ color: 0x2a3a33, transparent: true, opacity: 0.6 }), 0, 0.12, 0);
    smoke.rotation.x = Math.PI;
    g.add(smoke);
    g.userData.float = 0.25;
    return g;
  },

  build_bloater() {
    const g = new THREE.Group();
    this.legs(g, 0x4a3a5a, 0.18, 0.35, 0.1);
    const skin = this.mat(0x7fae5a);
    const belly = this.part(new THREE.SphereGeometry(0.5, 14, 10), skin, 0, 0.75, 0);
    belly.scale.set(1, 0.9, 0.95);
    g.add(belly);
    g.add(this.part(new THREE.SphereGeometry(0.2, 10, 8), skin, 0, 1.3, 0.02));
    [-0.08, 0.08].forEach((x) => g.add(this.part(new THREE.SphereGeometry(0.06, 6, 4), this.mat(0xf6f2c0), x, 1.34, 0.17)));
    const boil = this.mat(0xf2e05a, 0xb8a020);
    [[0.2, 0.9, 0.4], [-0.25, 0.7, 0.4], [0.05, 0.55, 0.45], [0.35, 0.6, 0.3], [-0.1, 1.0, 0.42]].forEach((p) => g.add(this.part(new THREE.SphereGeometry(0.07, 6, 4), boil, p[0], p[1], p[2])));
    [-0.52, 0.52].forEach((x) => g.add(this.part(new THREE.SphereGeometry(0.13, 8, 6), skin, x, 0.8, 0.05)));
    return g;
  },

  build_shield() {
    const g = new THREE.Group();
    this.legs(g, 0xe8e2c8, 0.13, 0.45, 0.06);
    const bone = this.mat(0xe8e2c8);
    g.add(this.part(new THREE.CylinderGeometry(0.16, 0.12, 0.5, 8), bone, 0, 0.75, 0));
    g.add(this.part(new THREE.SphereGeometry(0.17, 10, 8), bone, 0, 1.15, 0));
    g.add(this.part(new THREE.SphereGeometry(0.19, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), this.mat(0x2b2f36), 0, 1.18, 0));
    [-1, 1].forEach((s) => {
      const horn = this.part(new THREE.ConeGeometry(0.05, 0.28, 6), this.mat(0xe8dcb8), s * 0.2, 1.33, 0);
      horn.rotation.z = -s * 0.7;
      g.add(horn);
    });
    [-0.06, 0.06].forEach((x) => g.add(this.part(new THREE.SphereGeometry(0.03, 6, 4), this.mat(0xe0413a, 0xe0413a), x, 1.15, 0.15)));
    g.add(this.part(new THREE.BoxGeometry(0.72, 0.9, 0.08), this.mat(0x2b2f36), 0, 0.7, 0.3));
    g.add(this.part(new THREE.BoxGeometry(0.62, 0.8, 0.09), this.mat(0x6b3a22), 0, 0.7, 0.31));
    g.add(this.part(new THREE.SphereGeometry(0.08, 8, 6), this.mat(0x5a6068), 0, 0.72, 0.36));
    return g;
  },

  build_summoner() {
    const g = new THREE.Group();
    const robe = this.mat(0x5e1520);
    g.add(this.part(new THREE.ConeGeometry(0.4, 1.15, 9), robe, 0, 0.6, 0));
    g.add(this.part(new THREE.SphereGeometry(0.22, 10, 8), robe, 0, 1.18, 0));
    g.add(this.part(new THREE.SphereGeometry(0.13, 10, 8), this.mat(0xf3efe0), 0, 1.15, 0.1));
    g.add(this.part(new THREE.CylinderGeometry(0.03, 0.04, 1.5, 6), this.mat(0x4a2e1a), 0.38, 0.8, 0.1));
    g.add(this.part(new THREE.SphereGeometry(0.14, 10, 8), this.mat(0x8fd14f, 0x6ad13a), 0.38, 1.6, 0.1));
    return g;
  },

  build_splitter() {
    const g = new THREE.Group();
    const flesh = new THREE.MeshPhongMaterial({ color: 0x8e1b2a, shininess: 60 });
    const body = this.part(new THREE.SphereGeometry(0.5, 16, 12), flesh, 0, 0.42, 0);
    body.scale.set(1, 0.8, 0.95);
    g.add(body);
    [-0.17, 0.17].forEach((x) => g.add(this.part(new THREE.SphereGeometry(0.1, 8, 6), this.mat(0xf2e05a, 0xd8c020), x, 0.55, 0.38)));
    g.add(this.part(new THREE.BoxGeometry(0.32, 0.06, 0.04), this.mat(0xf2e05a, 0x806010), 0, 0.33, 0.45));
    g.userData.squish = true;
    return g;
  },

  build_slimelet() {
    const g = this.build_splitter();
    g.scale.setScalar(0.5);
    return g;
  },

  build_colossus() {
    const g = new THREE.Group();
    const bone = this.mat(0xe6dcc0);
    this.legs(g, 0xe6dcc0, 0.45, 1.1, 0.16);
    g.add(this.part(new THREE.BoxGeometry(1.0, 0.3, 0.5), bone, 0, 1.15, 0));
    for (let i = 0; i < 4; i++) {
      const rib = this.part(new THREE.TorusGeometry(0.55 - i * 0.04, 0.07, 6, 16, Math.PI * 1.3), bone, 0, 1.45 + i * 0.25, 0);
      rib.rotation.set(Math.PI / 2, 0, Math.PI * 0.85);
      g.add(rib);
    }
    g.add(this.part(new THREE.CylinderGeometry(0.1, 0.1, 1.1, 6), bone, 0, 1.75, -0.2));
    [-1, 1].forEach((s) => {
      g.add(this.part(new THREE.SphereGeometry(0.26, 10, 8), bone, s * 0.8, 2.4, 0));
      const arm = this.part(new THREE.CylinderGeometry(0.12, 0.1, 1.1, 6), bone, s * 0.95, 1.85, 0.1);
      arm.rotation.z = s * 0.25;
      g.add(arm);
      g.add(this.part(new THREE.SphereGeometry(0.28, 10, 8), bone, s * 1.05, 1.25, 0.2));
      const horn = this.part(new THREE.ConeGeometry(0.12, 0.6, 8), this.mat(0xd8cba8), s * 0.42, 3.2, 0);
      horn.rotation.z = -s * 0.6;
      g.add(horn);
    });
    g.add(this.part(new THREE.SphereGeometry(0.48, 14, 10), bone, 0, 2.85, 0.05));
    [-0.17, 0.17].forEach((x) => g.add(this.part(new THREE.SphereGeometry(0.1, 8, 6), this.mat(0x8fd14f, 0x7ed957), x, 2.9, 0.42)));
    return g;
  },

  build_brood() {
    const g = new THREE.Group();
    const shell = this.mat(0x8a1c1c);
    g.add(this.part(new THREE.SphereGeometry(0.85, 16, 12), shell, 0, 1.7, -0.3));
    const egg = this.part(new THREE.SphereGeometry(0.9, 16, 12), new THREE.MeshPhongMaterial({ color: 0x7ed957, emissive: 0x204a10, shininess: 50 }), 0, 1.0, 0.45);
    g.add(egg);
    [[-0.25, 1.95], [0.25, 1.95], [-0.15, 1.75], [0.15, 1.75]].forEach((p) => g.add(this.part(new THREE.SphereGeometry(0.1, 8, 6), this.mat(0x8fd14f, 0x7ed957), p[0], p[1], 0.48)));
    const legMat = this.mat(0x6e1515);
    g.userData.spiderLegs = [];
    for (let i = 0; i < 8; i++) {
      const s = i < 4 ? -1 : 1;
      const k = i % 4;
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.6, 1.7, -0.6 + k * 0.45);
      const upper = this.part(new THREE.CylinderGeometry(0.07, 0.06, 1.3, 6), legMat, 0, 0, 0);
      upper.rotation.z = s * 1.0;
      upper.position.set(s * 0.55, 0.35, 0);
      const lower = this.part(new THREE.CylinderGeometry(0.06, 0.03, 1.6, 6), legMat, s * 1.15, -0.55, 0);
      lower.rotation.z = -s * 0.35;
      pivot.add(upper, lower);
      g.add(pivot);
      g.userData.spiderLegs.push(pivot);
    }
    return g;
  },

  build_wraithking() {
    const g = new THREE.Group();
    g.add(this.part(new THREE.ConeGeometry(1.0, 2.6, 10, 1, true), this.mat(0x1c2433), 0, 1.5, 0));
    const flame = new THREE.MeshLambertMaterial({ color: 0x4fe0a0, emissive: 0x2fbf78, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      g.add(this.part(new THREE.ConeGeometry(0.22, 0.7, 6), flame, Math.cos(a) * 0.9, 0.35, Math.sin(a) * 0.9));
    }
    g.add(this.part(new THREE.SphereGeometry(0.38, 12, 10), this.mat(0xf0ead8), 0, 2.95, 0.05));
    [-0.13, 0.13].forEach((x) => g.add(this.part(new THREE.SphereGeometry(0.07, 8, 6), this.mat(0x7ed957, 0x7ed957), x, 2.98, 0.35)));
    const gold = this.mat(0xc9922e, 0x5a3a08);
    g.add(this.part(new THREE.CylinderGeometry(0.34, 0.36, 0.18, 12, 1, true), gold, 0, 3.3, 0.05));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.add(this.part(new THREE.ConeGeometry(0.06, 0.22, 5), gold, Math.cos(a) * 0.33, 3.48, 0.05 + Math.sin(a) * 0.33));
    }
    const blade = this.part(new THREE.BoxGeometry(0.16, 2.2, 0.05), this.mat(0x9fe8c8, 0x3fbf88), 1.15, 2.0, 0.3);
    blade.rotation.z = -0.25;
    g.add(blade);
    [-1, 1].forEach((s) => g.add(this.part(new THREE.SphereGeometry(0.22, 10, 8), this.mat(0x2a3448), s * 0.95, 2.1, 0.3)));
    g.userData.float = 0.3;
    return g;
  },

  build_barrel() {
    const g = new THREE.Group();
    const body = this.part(new THREE.CylinderGeometry(0.32, 0.32, 0.72, 16), this.mat(0x6b4426), 0, 0.36, 0);
    g.add(body);
    [0.14, 0.58].forEach((y) => {
      const band = this.part(new THREE.TorusGeometry(0.325, 0.03, 6, 20), this.mat(0x2b2f33), 0, y, 0);
      band.rotation.x = Math.PI / 2;
      g.add(band);
    });
    g.add(this.part(new THREE.OctahedronGeometry(0.12), this.mat(0x4fc3ff, 0x2f9fdf), 0, 0.38, 0.32));
    return g;
  },

  // ---------------------------------------------------------------- per frame

  place(o, kind, t, speed) {
    let m = o._m3;
    if (!m || m.userData.kind !== kind) {
      if (m) this.release(m);
      m = o._m3 = this.acquire(kind);
      m.userData.owner = o;
    }
    m.userData.frame = this.frame;
    const lift = (o.lift || 0) * U + (m.userData.float || 0);
    m.position.set((o.x - W / 2) * U, lift, (o.y - LINE_Y) * U);
    // Walk cycle: a step bob and a waddle, legs swing when the model has them.
    const ph = t * (6 + speed / 35) + (o.wobble || o.phase || 0);
    if (speed > 0) {
      if (m.userData.walkU) {
        m.userData.walkU.forEach((u) => { u.uPhase.value = ph; u.uAmp.value = 1; });
        m.userData.inner.position.y = m.userData.innerY - Math.abs(Math.cos(ph)) * 0.025;
      } else if (m.userData.inner) {
        m.userData.inner.position.y = m.userData.innerY + Math.abs(Math.sin(ph)) * 0.03;
      }
      m.rotation.z = Math.sin(ph) * 0.035;
      m.rotation.x = 0.1;
      if (m.userData.legs) m.userData.legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + i * Math.PI) * 0.6; });
      if (m.userData.spiderLegs) m.userData.spiderLegs.forEach((l, i) => { l.rotation.x = Math.sin(ph * 1.5 + i) * 0.3; });
      if (m.userData.squish) m.scale.y = m.userData.baseScaleY * (1 + Math.sin(ph * 2) * 0.08);
    }
    if (m.userData.billboard && m.userData.inner) {
      m.userData.inner.lookAt(this.camera.position);
    }
    m.userData.shadow.position.y = -lift + 0.03;
    const flash = o.hitFlash > 0 || (o.isBoss && o.immune);
    if (flash !== m.userData.flashing) {
      m.userData.flashing = flash;
      const c = o.immune ? 0x2f7fb0 : (kind === 'knight' || kind === 'champion' ? 0xc8201a : 0xffffff);
      m.userData.mats.forEach((mt) => {
        if (mt.emissive) mt.emissive.setHex(flash ? c : (mt.userData.baseEmissive || 0));
        else if (m.userData.billboard) mt.color.setHex(flash ? 0xff9090 : 0xffffff);
      });
    }
    return m;
  },

  // Keep the 3D canvas exactly under Phaser's canvas.
  fitCanvas(pc) {
    const c = this.canvas;
    if (c.style.width !== pc.style.width || c.style.height !== pc.style.height) {
      c.style.width = pc.style.width;
      c.style.height = pc.style.height;
    }
    c.style.left = pc.offsetLeft + 'px';
    c.style.top = pc.offsetTop + 'px';
  },

  // Home screen backdrop: the squad marching in place on the live 3D road,
  // road and forest scrolling, the chosen captain at the front.
  showcase(scene, t, captain) {
    if (!this.active) return;
    this.fitCanvas(scene.game.canvas);
    const n = 9;
    if (!this.show) this.show = [];
    const lead = captain === 'tank' ? 'champion' : 'knight';
    for (let i = 0; i < n; i++) {
      const kind = i === 0 ? lead : 'knight';
      let m = this.show[i];
      if (!m || m.userData.kind !== kind) {
        if (m) this.release(m);
        m = this.show[i] = this.acquire(kind);
      }
      const f = formation(i, 34);
      m.position.set(f.x * U, 0, f.y * U + (i === 0 ? 0.25 : 0));
      const ph = t * 9 + i * 1.7;
      if (m.userData.walkU) m.userData.walkU.forEach((u) => { u.uPhase.value = ph; u.uAmp.value = 1; });
      if (m.userData.inner) m.userData.inner.position.y = m.userData.innerY - Math.abs(Math.cos(ph)) * 0.025;
      m.rotation.set(0.1, 0, Math.sin(ph) * 0.035);
    }
    const scroll = t * 160;
    this.roadTex.offset.y = scroll * U / 5.6;
    const span = 40;
    this.trees.forEach((tr, i) => {
      tr.position.z = ((-32 + (i / 40) * span + scroll * U) % span + span) % span - 32;
    });
    this.syncGates(null);
    this.drawDecals([]);
    this.renderer.render(this.scene, this.camera);
  },

  sync(g) {
    if (!this.active) return;
    this.frame++;
    // On a slow phone, drop the 3D resolution once to keep the frame rate up.
    if (this.frame % 180 === 0 && !this.lowRes && g.game.loop.actualFps < 45 && this.renderer.getPixelRatio() > 1) {
      this.lowRes = true;
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(W, H, false);
    }
    const t = g.elapsed;
    this.fitCanvas(g.game.canvas);

    for (let i = 0; i < g.knights.length; i++) {
      const k = g.knights[i];
      // Knights march faster as fire rate rises; no steps while parachuting.
      if (k.visible) this.place(k, k.isChampion ? 'champion' : 'knight', t, k.lift ? 0 : 140 + g.effSpeed() * 25);
    }
    g.enemies.getChildren().forEach((e) => {
      if (e.active) this.place(e, e.def === ENEMIES.slimelet ? 'slimelet' : e.def.key, t, e.def.speed);
    });
    g.bosses.getChildren().forEach((b) => { if (b.active) this.place(b, b.def.key, t * 0.6, 60); });
    g.barrels.getChildren().forEach((b) => {
      if (!b.active) return;
      const m = this.place(b, 'barrel', t, 0);
      m.rotation.x = -t * 4;
    });
    // Hide models whose owner is gone this frame.
    this.live.forEach((m) => {
      const o = m.userData.owner;
      if (m.userData.frame !== this.frame || !o || !o.active) this.release(m);
    });

    // Road and forest scroll toward the camera with the run's speed.
    this.roadTex.offset.y = (g.roadScroll || 0) * U / 5.6;
    const span = 40;
    const scroll = (g.roadScroll || 0) * U;
    this.trees.forEach((tr, i) => {
      tr.position.z = ((-32 + (i / 40) * span + scroll) % span + span) % span - 32;
    });

    this.syncGates(g);
    this.drawDecals(g.decals || []);
    this.renderer.render(this.scene, this.camera);
  },

  // Last War style gates: an upright glass panel between two posts with a
  // crossbar, standing on the road. The value sign faces the camera so it
  // stays readable from above.
  buildGate() {
    const w = 3.3;
    const h = 1.7;
    const g = new THREE.Group();
    const glassMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
    glass.position.y = h / 2;
    g.add(glass);
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x2b2f36, transparent: true });
    const trimMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true });
    [-1, 1].forEach((sd) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, h + 0.25, 0.16), frameMat);
      post.position.set(sd * w / 2, (h + 0.25) / 2, 0);
      g.add(post);
    });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.16, 0.18), trimMat);
    bar.position.y = h + 0.1;
    g.add(bar);
    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.08, 0.2), trimMat);
    base.position.y = 0.04;
    g.add(base);
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 256;
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    const signMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, w * 0.45), signMat);
    sign.position.y = h * 0.55;
    sign.renderOrder = 2;
    g.add(sign);
    g.userData = { glassMat, frameMat, trimMat, signMat, sign, cv, tex, shown: null };
    this.scene.add(g);
    return g;
  },

  drawGateSign(m, info) {
    const u = m.userData;
    const x = u.cv.getContext('2d');
    const hex = '#' + info.color.toString(16).padStart(6, '0');
    x.clearRect(0, 0, 512, 256);
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.lineJoin = 'round';
    x.font = 'italic 150px ' + FONT;
    x.lineWidth = 22;
    x.strokeStyle = '#0a0f0e';
    x.strokeText(info.text, 256, 100);
    x.fillStyle = '#ffffff';
    x.fillText(info.text, 256, 100);
    x.font = '46px ' + FONT;
    x.lineWidth = 12;
    x.strokeText(info.sub, 256, 212);
    x.fillStyle = hex;
    x.fillText(info.sub, 256, 212);
    u.tex.needsUpdate = true;
    u.glassMat.color.setHex(info.color);
    u.trimMat.color.setHex(info.color);
  },

  // One standing gate per card on the road; gates whose card is gone go back to the pool.
  syncGates(g) {
    const map = this.gates || (this.gates = new Map());
    const pool = this.gatePool || (this.gatePool = []);
    const cards = [];
    if (g) {
      g.gateRows.forEach((r) => r.cards.forEach((c) => cards.push(c)));
      g.fadingCards.forEach((c) => cards.push(c));
    }
    const seen = new Set(cards);
    map.forEach((m, c) => {
      if (seen.has(c)) return;
      m.visible = false;
      pool.push(m);
      map.delete(c);
    });
    cards.forEach((c) => {
      let m = map.get(c);
      if (!m) {
        m = pool.pop() || this.buildGate();
        m.userData.shown = null;
        map.set(c, m);
      }
      m.visible = true;
      const info = g.cardInfo(c.gate);
      const key = info.text + '|' + info.sub + '|' + info.color;
      if (m.userData.shown !== key) {
        this.drawGateSign(m, info);
        m.userData.shown = key;
      }
      m.position.set((c.x - W / 2) * U, 0, (c.y - LINE_Y) * U);
      m.scale.setScalar(c.scaleX);
      const a = c.alpha;
      const u = m.userData;
      u.glassMat.opacity = 0.35 * a;
      u.signMat.opacity = a;
      u.frameMat.opacity = a;
      u.trimMat.opacity = a;
      u.sign.lookAt(this.camera.position);
    });
  },

  // Red ground markings for boss attacks: lanes and circles.
  drawDecals(list) {
    while (this.decalPool.length < list.length) {
      const m = new THREE.Mesh(this.decalGeo.lane, new THREE.MeshBasicMaterial({ color: 0xe0413a, transparent: true, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 1;
      this.scene.add(m);
      this.decalPool.push(m);
    }
    this.decalPool.forEach((m, i) => {
      const d = list[i];
      if (!d) {
        m.visible = false;
        return;
      }
      m.visible = true;
      m.material.opacity = d.a;
      m.material.color.setHex(d.color || 0xe0413a);
      if (d.k === 'lane') {
        m.geometry = this.decalGeo.lane;
        const z0 = (d.y0 - LINE_Y) * U;
        const z1 = (d.y1 - LINE_Y) * U;
        m.scale.set(d.w * U, Math.abs(z1 - z0), 1);
        m.position.set((d.x - W / 2) * U, 0.04, (z0 + z1) / 2);
      } else {
        m.geometry = this.decalGeo.circle;
        m.scale.set(d.rx * U, d.ry * U, 1);
        m.position.set((d.x - W / 2) * U, 0.04, (d.y - LINE_Y) * U);
      }
    });
  },
};
