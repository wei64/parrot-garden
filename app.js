/* 小鹦鹉 · 成长花园 —— 第一个 3D 画面
 * 使用本地 three.min.js（r128，经典脚本），双击 index.html 即可运行。
 */
(function () {
  "use strict";

  var canvas = document.getElementById("scene");
  var loading = document.getElementById("loading");
  var fallback = document.getElementById("fallback");
  var speechEl = document.getElementById("speech");
  var hintEl = document.getElementById("interaction-hint");
  var soundToggle = document.getElementById("sound-toggle");

  if (!window.THREE) {
    loading.classList.add("is-hidden");
    fallback.hidden = false;
    return;
  }

  var COLORS = {
    sky: 0xbfe8ff,
    cloud: 0xffffff,
    grass: 0x76c17f,
    grassDark: 0x5aa864,
    bark: 0x9a6a45,
    barkDark: 0x7d5233,
    leaf: 0x4faa62,
    leafLight: 0x7ccd86,
    bodyWhite: 0xfbfbf7,
    bodyShade: 0xdde8ea,
    wing: 0xe7f0f2,
    crest: 0xffe6a3,
    beak: 0xf5a63c,
    beakDark: 0xdd8626,
    cheek: 0xffb8bd,
    eye: 0x2b3630,
    tail: 0xdde8ea,
    heart: 0xff8fa3,
    sparkle: 0xffd76a,
    seed: 0xd8a253,
    eggShell: 0xfdf3e0,
    eggSpot: 0xf0c9a0,
    sickBody: 0xa9b8ad,
    sickWing: 0xb3c1b6,
    sickShade: 0x93a296
  };

  // 每 10 分换一种颜色：白 -> 红 -> 橙 -> 黄 -> 绿 -> 蓝 -> 紫 -> 粉 -> 灰 -> 黑
  var LEVEL_COLORS = [
    { name: "白色", hex: 0xfbfbf7 },
    { name: "红色", hex: 0xe8615a },
    { name: "橙色", hex: 0xf0913c },
    { name: "黄色", hex: 0xf2c53d },
    { name: "绿色", hex: 0x4faa62 },
    { name: "蓝色", hex: 0x4a8fd4 },
    { name: "紫色", hex: 0x8b6bd4 },
    { name: "粉色", hex: 0xef8fb8 },
    { name: "灰色", hex: 0x8d9aa5 },
    { name: "黑色", hex: 0x3a4148 }
  ];

  var SCORE_PER_LEVEL = 10;
  var EGG_SCORE = -10;
  var REVIVE_SICK_AT = 10;
  var REVIVE_DONE_AT = 20;
  var ANGER_FREE_MS = 5 * 60 * 1000;
  var ANGER_AUTO_MS = 10 * 60 * 1000;
  var STORAGE_KEY = "parrot-garden-score-v1";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------- renderer
  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  if ("outputEncoding" in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.sky);
  scene.fog = new THREE.Fog(COLORS.sky, 16, 34);

  var camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    120
  );

  // ---------------------------------------------------------------- lighting
  scene.add(new THREE.HemisphereLight(0xdff2ff, 0x8fc79a, 0.85));

  var sun = new THREE.DirectionalLight(0xfff3d6, 1.05);
  sun.position.set(5.5, 9, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 1024;
  sun.shadow.mapSize.height = 1024;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 30;
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  scene.add(new THREE.AmbientLight(0xffffff, 0.22));

  // ---------------------------------------------------------------- helpers
  function mat(color, opts) {
    var options = Object.assign(
      { color: color, roughness: 0.72, metalness: 0.02 },
      opts || {}
    );
    return new THREE.MeshStandardMaterial(options);
  }

  function mesh(geometry, material, parent) {
    var m = new THREE.Mesh(geometry, material);
    m.castShadow = true;
    m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }

  function sphere(radius, material, parent, segments) {
    var seg = segments || 26;
    return mesh(new THREE.SphereGeometry(radius, seg, Math.max(12, seg - 8)), material, parent);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  // ---------------------------------------------------------------- world
  var world = new THREE.Group();
  scene.add(world);

  // ground
  var groundMat = mat(COLORS.grass, { roughness: 0.95 });
  var ground = mesh(new THREE.CircleGeometry(26, 64), groundMat, world);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2.45;
  ground.castShadow = false;

  var groundRing = mesh(
    new THREE.RingGeometry(9, 26, 64),
    mat(COLORS.grassDark, { roughness: 1, transparent: true, opacity: 0.3 }),
    world
  );
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = -2.44;
  groundRing.castShadow = false;

  // soft hills at the horizon
  for (var h = 0; h < 5; h++) {
    var hill = sphere(4 + h * 0.6, mat(COLORS.grassDark, { roughness: 1 }), world, 18);
    hill.position.set(-14 + h * 7.5, -3.6, -11 - (h % 2) * 2.2);
    hill.scale.set(1.3, 0.42, 1);
    hill.castShadow = false;
  }

  // tree trunk + branch
  var trunk = mesh(
    new THREE.CylinderGeometry(0.34, 0.52, 5, 18),
    mat(COLORS.barkDark, { roughness: 0.95 }),
    world
  );
  trunk.position.set(2.5, 0.05, -0.55);

  var branch = mesh(
    new THREE.CylinderGeometry(0.15, 0.19, 5.6, 16),
    mat(COLORS.bark, { roughness: 0.9 }),
    world
  );
  branch.rotation.z = Math.PI / 2;
  branch.rotation.y = 0.06;
  branch.position.set(0.1, -0.05, -0.1);

  // a smaller branch offshoot
  var twig = mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 1.5, 12),
    mat(COLORS.bark, { roughness: 0.9 }),
    world
  );
  twig.position.set(-1.9, 0.5, -0.3);
  twig.rotation.z = 0.7;
  twig.rotation.x = -0.2;

  // leaves
  var leafMat = mat(COLORS.leaf, { roughness: 0.85 });
  var leafLightMat = mat(COLORS.leafLight, { roughness: 0.85 });
  var leafSpots = [
    [3.1, 2.1, -0.9, 1.35],
    [2.1, 2.8, -0.5, 1.15],
    [3.9, 2.9, -1.4, 1.5],
    [1.6, 2.2, 0.1, 0.9],
    [-2.2, 0.95, -0.4, 0.72],
    [-2.9, 1.35, -0.6, 0.55],
    [4.3, 1.7, -1.9, 0.95]
  ];
  for (var i = 0; i < leafSpots.length; i++) {
    var spot = leafSpots[i];
    var blob = sphere(
      spot[3],
      i % 2 === 0 ? leafMat : leafLightMat,
      world,
      20
    );
    blob.position.set(spot[0], spot[1], spot[2]);
    blob.scale.set(1.15, 0.82, 1);
  }

  // flowers on the grass
  var petalColors = [0xff9fb0, 0xffd166, 0xa7d8ff, 0xffb27a, 0xd7a8ff];
  var stemMat = mat(0x4a9a5c, { roughness: 0.9 });
  var flowerSpots = [
    [-4.2, -2.35, 2.2],
    [-3.1, -2.35, 3.6],
    [3.4, -2.35, 2.6],
    [4.6, -2.35, 1.1],
    [-5.4, -2.35, 0.4],
    [1.9, -2.35, 4.3],
    [-1.2, -2.35, 4.6],
    [5.6, -2.35, -0.6]
  ];
  for (var f = 0; f < flowerSpots.length; f++) {
    var fs = flowerSpots[f];
    var flower = new THREE.Group();
    flower.position.set(fs[0], fs[1], fs[2]);
    world.add(flower);

    var stem = mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.6, 8), stemMat, flower);
    stem.position.y = 0.3;

    var petalMat = mat(petalColors[f % petalColors.length], { roughness: 0.8 });
    for (var p = 0; p < 5; p++) {
      var angle = (p / 5) * Math.PI * 2;
      var petal = sphere(0.11, petalMat, flower, 14);
      petal.position.set(Math.cos(angle) * 0.13, 0.62, Math.sin(angle) * 0.13);
      petal.scale.set(1, 0.6, 1);
    }
    var center = sphere(0.075, mat(0xfff0b8, { roughness: 0.7 }), flower, 12);
    center.position.y = 0.66;
  }

  // grass tufts
  var tuftMat = mat(COLORS.grassDark, { roughness: 1 });
  for (var g = 0; g < 60; g++) {
    var angle2 = Math.random() * Math.PI * 2;
    var radius2 = 3 + Math.random() * 12;
    var tuft = mesh(new THREE.ConeGeometry(0.07, 0.34 + Math.random() * 0.3, 5), tuftMat, world);
    tuft.position.set(
      Math.cos(angle2) * radius2,
      -2.35,
      Math.sin(angle2) * radius2 * 0.8
    );
    tuft.rotation.z = (Math.random() - 0.5) * 0.5;
    tuft.castShadow = false;
  }

  // clouds
  var clouds = [];
  var cloudMat = mat(COLORS.cloud, { roughness: 1, emissive: 0x9fd8f5, emissiveIntensity: 0.08 });
  for (var c = 0; c < 5; c++) {
    var cloud = new THREE.Group();
    cloud.position.set(-13 + c * 6.4, 5.2 + (c % 3) * 0.9, -8 - (c % 2) * 2.5);
    world.add(cloud);
    for (var q = 0; q < 4; q++) {
      var puff = sphere(0.85 + q * 0.12, cloudMat, cloud, 16);
      puff.position.set((q - 1.5) * 0.85, Math.sin(q) * 0.18, 0);
      puff.scale.set(1, 0.72, 0.8);
      puff.castShadow = false;
    }
    clouds.push(cloud);
  }

  // sun disc
  var sunDisc = sphere(
    1.15,
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.9 }),
    world,
    24
  );
  sunDisc.position.set(-7.5, 5.6, -9);
  sunDisc.castShadow = false;

  // ---------------------------------------------------------------- parrot
  var parrot = new THREE.Group();
  world.add(parrot);
  parrot.position.y = 0.12;

  var bodyMat = mat(COLORS.bodyWhite, { roughness: 0.62 });
  var shadeMat = mat(COLORS.bodyShade, { roughness: 0.7 });
  var wingMat = mat(COLORS.wing, { roughness: 0.66 });
  var crestMat = mat(COLORS.crest, { roughness: 0.6 });
  var beakMat = mat(COLORS.beak, { roughness: 0.45 });
  var beakDarkMat = mat(COLORS.beakDark, { roughness: 0.5 });
  var cheekMat = mat(COLORS.cheek, {
    roughness: 0.8,
    transparent: true,
    opacity: 0.85
  });
  var eyeMat = mat(COLORS.eye, { roughness: 0.25 });
  var tailMat = mat(COLORS.tail, { roughness: 0.6 });

  // body
  var body = sphere(1.02, bodyMat, parrot, 32);
  body.position.set(0, 1.34, 0);
  body.scale.set(1, 1.12, 0.96);

  // belly patch
  var belly = sphere(0.72, mat(0xffffff, { roughness: 0.6 }), parrot, 26);
  belly.position.set(0, 1.18, 0.42);
  belly.scale.set(1, 1.12, 0.62);

  // head
  var head = new THREE.Group();
  head.position.set(0, 2.28, 0.08);
  parrot.add(head);

  var skull = sphere(0.7, bodyMat, head, 30);
  skull.scale.set(1, 0.98, 0.96);

  // crest feathers
  var crestSpecs = [
    [-0.13, 0.62, -0.12, 0.3],
    [0.0, 0.72, -0.2, 0.42],
    [0.13, 0.62, -0.14, 0.3]
  ];
  for (var cs = 0; cs < crestSpecs.length; cs++) {
    var spec = crestSpecs[cs];
    var feather = mesh(
      new THREE.ConeGeometry(0.1, 0.56 + cs * 0.04, 10),
      crestMat,
      head
    );
    feather.position.set(spec[0], spec[1], spec[2]);
    feather.rotation.x = -spec[3];
    feather.rotation.z = spec[0] * 1.6;
    feather.scale.set(1, 1, 0.5);
  }

  // eyes
  var eyes = [];
  for (var e = 0; e < 2; e++) {
    var side = e === 0 ? -1 : 1;
    var eyeGroup = new THREE.Group();
    eyeGroup.position.set(side * 0.335, 0.135, 0.62);
    head.add(eyeGroup);

    var white = sphere(0.165, mat(0xffffff, { roughness: 0.3 }), eyeGroup, 18);
    white.scale.set(1, 1.02, 0.7);

    var pupil = sphere(0.105, eyeMat, eyeGroup, 18);
    pupil.position.z = 0.1;

    var glint = sphere(
      0.036,
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      eyeGroup,
      10
    );
    glint.position.set(side * -0.04, 0.045, 0.19);

    eyes.push(eyeGroup);
  }

  // beak
  var beakGroup = new THREE.Group();
  beakGroup.position.set(0, -0.03, 0.6);
  head.add(beakGroup);

  var upperBeak = mesh(new THREE.ConeGeometry(0.19, 0.46, 16), beakMat, beakGroup);
  upperBeak.rotation.x = Math.PI / 2;
  upperBeak.rotation.z = 0;
  upperBeak.position.set(0, 0.02, 0.14);
  upperBeak.scale.set(1.15, 1, 0.9);

  var lowerBeak = mesh(new THREE.ConeGeometry(0.13, 0.26, 14), beakDarkMat, beakGroup);
  lowerBeak.rotation.x = Math.PI / 2;
  lowerBeak.position.set(0, -0.15, 0.06);
  lowerBeak.scale.set(1.05, 1, 0.8);

  // cheeks
  for (var ch = 0; ch < 2; ch++) {
    var cheek = sphere(0.145, cheekMat, head, 14);
    cheek.position.set((ch === 0 ? -1 : 1) * 0.44, -0.07, 0.5);
    cheek.scale.set(1, 0.82, 0.42);
    cheek.rotation.y = (ch === 0 ? -1 : 1) * 0.4;
    cheek.castShadow = false;
  }

  // wings
  var wings = [];
  for (var w = 0; w < 2; w++) {
    var wSide = w === 0 ? -1 : 1;
    var wingPivot = new THREE.Group();
    wingPivot.position.set(wSide * 0.82, 1.62, -0.05);
    parrot.add(wingPivot);

    var wing = sphere(0.62, wingMat, wingPivot, 22);
    wing.scale.set(0.34, 1.05, 0.66);
    wing.position.set(wSide * 0.14, -0.5, -0.05);
    wing.rotation.z = wSide * 0.12;

    var wingTip = sphere(0.36, shadeMat, wingPivot, 18);
    wingTip.scale.set(0.3, 0.86, 0.5);
    wingTip.position.set(wSide * 0.2, -1.12, -0.16);
    wingTip.rotation.z = wSide * 0.2;

    wings.push(wingPivot);
  }

  // tail feathers
  var tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.86, -0.72);
  parrot.add(tailGroup);
  for (var t = 0; t < 3; t++) {
    var tailFeather = mesh(
      new THREE.ConeGeometry(0.17, 1.5 + t * 0.12, 10),
      t === 1 ? tailMat : shadeMat,
      tailGroup
    );
    tailFeather.position.set((t - 1) * 0.2, -0.5, -0.28 - Math.abs(t - 1) * 0.06);
    tailFeather.rotation.x = -1.95;
    tailFeather.rotation.z = (t - 1) * 0.16;
    tailFeather.scale.set(1, 1, 0.55);
  }

  // legs + feet
  var legMat = mat(COLORS.beakDark, { roughness: 0.55 });
  for (var l = 0; l < 2; l++) {
    var lSide = l === 0 ? -1 : 1;
    var leg = mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.46, 10), legMat, parrot);
    leg.position.set(lSide * 0.3, 0.3, 0.04);

    var foot = new THREE.Group();
    foot.position.set(lSide * 0.3, 0.07, 0.06);
    parrot.add(foot);
    for (var toe = 0; toe < 3; toe++) {
      var toeMesh = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.26, 8), legMat, foot);
      toeMesh.rotation.x = Math.PI / 2;
      toeMesh.rotation.y = (toe - 1) * 0.42;
      toeMesh.position.set((toe - 1) * 0.08, 0, 0.1);
    }
  }

  // ---------------------------------------------------------------- egg
  var eggGroup = new THREE.Group();
  eggGroup.position.set(0, 0.78, 0.05);
  eggGroup.visible = false;
  world.add(eggGroup);

  var eggShell = sphere(0.62, mat(COLORS.eggShell, { roughness: 0.5 }), eggGroup, 30);
  eggShell.scale.set(0.86, 1.16, 0.86);

  var eggSpotMat = mat(COLORS.eggSpot, { roughness: 0.7 });
  var eggSpotSpots = [
    [0.3, 0.34, 0.42, 0.13],
    [-0.34, 0.06, 0.46, 0.1],
    [0.18, -0.3, 0.46, 0.12],
    [-0.2, -0.52, 0.38, 0.09]
  ];
  for (var es = 0; es < eggSpotSpots.length; es++) {
    var eSpot = sphere(eggSpotSpots[es][3], eggSpotMat, eggGroup, 12);
    eSpot.position.set(eggSpotSpots[es][0], eggSpotSpots[es][1], eggSpotSpots[es][2]);
    eSpot.scale.set(1, 0.8, 0.4);
  }

  // ---------------------------------------------------------------- particles
  var particles = [];
  var heartGeo = new THREE.SphereGeometry(0.1, 10, 8);
  var sparkleGeo = new THREE.OctahedronGeometry(0.11, 0);
  var seedGeo = new THREE.SphereGeometry(0.065, 8, 6);

  function spawn(kind, count) {
    for (var n = 0; n < count; n++) {
      var material;
      var geometry;

      if (kind === "heart") {
        geometry = heartGeo;
        material = new THREE.MeshBasicMaterial({
          color: COLORS.heart,
          transparent: true,
          opacity: 1
        });
      } else if (kind === "sparkle") {
        geometry = sparkleGeo;
        material = new THREE.MeshBasicMaterial({
          color: COLORS.sparkle,
          transparent: true,
          opacity: 1
        });
      } else {
        geometry = seedGeo;
        material = new THREE.MeshBasicMaterial({
          color: COLORS.seed,
          transparent: true,
          opacity: 1
        });
      }

      var item = new THREE.Mesh(geometry, material);
      item.castShadow = false;
      var angle = Math.random() * Math.PI * 2;
      var radius = kind === "seed" ? 0.4 + Math.random() * 0.5 : 0.7 + Math.random() * 0.7;

      item.position.set(
        parrot.position.x + Math.cos(angle) * radius,
        1.9 + Math.random() * 1.2,
        parrot.position.z + Math.sin(angle) * radius * 0.5 + 0.4
      );
      item.scale.setScalar(kind === "sparkle" ? 1 : 0.85);
      world.add(item);

      particles.push({
        mesh: item,
        kind: kind,
        life: 0,
        ttl: kind === "seed" ? 1.5 : 1.9,
        vx: Math.cos(angle) * (kind === "seed" ? 0.15 : 0.55),
        vy: kind === "seed" ? -0.9 : 1.35 + Math.random() * 0.5,
        vz: Math.sin(angle) * 0.25 + (kind === "seed" ? 0.5 : 0.2),
        spin: (Math.random() - 0.5) * 5
      });
    }
  }

  function updateParticles(dt) {
    for (var n = particles.length - 1; n >= 0; n--) {
      var p = particles[n];
      p.life += dt;
      var t = p.life / p.ttl;

      if (t >= 1) {
        world.remove(p.mesh);
        p.mesh.material.dispose();
        particles.splice(n, 1);
        continue;
      }

      if (p.kind === "heart") {
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.x += Math.sin(p.life * 6) * 0.4 * dt;
        p.mesh.scale.setScalar(0.9 + Math.sin(t * Math.PI) * 0.35);
      } else if (p.kind === "sparkle") {
        p.mesh.position.y += p.vy * 0.4 * dt;
        p.mesh.position.x += p.vx * 0.35 * dt;
        p.mesh.position.z += p.vz * 0.35 * dt;
        p.mesh.rotation.x += p.spin * dt;
        p.mesh.rotation.y += p.spin * 0.8 * dt;
      } else {
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        if (p.mesh.position.y < 0.35) p.mesh.position.y = 0.35;
      }

      p.mesh.material.opacity = 1 - t * t;
      p.mesh.rotation.z += p.spin * 0.4 * dt;
    }
  }

  // ---------------------------------------------------------------- state
  var state = {
    score: 0,
    mode: "healthy", // healthy | sick | egg
    reviving: false,
    reviveProgress: 0,
    angerStartedAt: null,
    pats: 0,
    lastInteraction: 0,
    actionTimer: 0,
    action: null,
    blinkTimer: 2 + Math.random() * 2,
    blink: 0
  };

  var speechTimer = null;

  function say(text, duration) {
    speechEl.textContent = text;
    speechEl.classList.add("is-visible");
    if (speechTimer) window.clearTimeout(speechTimer);
    speechTimer = window.setTimeout(function () {
      speechEl.classList.remove("is-visible");
    }, duration || 2600);
  }

  function mixHex(hex, target, amount) {
    var r = (hex >> 16) & 255;
    var g = (hex >> 8) & 255;
    var b = hex & 255;
    var tr = (target >> 16) & 255;
    var tg = (target >> 8) & 255;
    var tb = target & 255;
    return (
      (Math.round(lerp(r, tr, amount)) << 16) |
      (Math.round(lerp(g, tg, amount)) << 8) |
      Math.round(lerp(b, tb, amount))
    );
  }

  function lightenHex(hex) {
    return mixHex(hex, 0xffffff, 0.22);
  }

  function darkenHex(hex) {
    return mixHex(hex, 0x000000, 0.16);
  }

  function levelIndexFromScore(score) {
    var lv = Math.floor(Math.max(0, score) / SCORE_PER_LEVEL);
    return Math.round(clamp(lv, 0, LEVEL_COLORS.length - 1));
  }

  // 同一种颜色里，分数越高，宠物越大
  function sizeFromScore(score) {
    var maxScore = LEVEL_COLORS.length * SCORE_PER_LEVEL - 0.001;
    var capped = clamp(score, 0, maxScore);
    var lv = Math.floor(capped / SCORE_PER_LEVEL);
    var within = (capped % SCORE_PER_LEVEL) / SCORE_PER_LEVEL;
    return lerp(0.55, 1.14, clamp((lv + within) / LEVEL_COLORS.length, 0, 1));
  }

  function formatDuration(ms) {
    var total = Math.max(0, Math.round(ms / 1000));
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + "分" + (s < 10 ? "0" : "") + s + "秒";
  }

  function save() {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          score: state.score,
          mode: state.mode,
          reviving: state.reviving,
          reviveProgress: state.reviveProgress
        })
      );
    } catch (err) {
      /* 隐私模式等存不了就忽略 */
    }
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (typeof data.score === "number") state.score = data.score;
      if (data.mode === "sick" || data.mode === "egg" || data.mode === "healthy") {
        state.mode = data.mode;
      }
      state.reviving = !!data.reviving;
      if (typeof data.reviveProgress === "number") {
        state.reviveProgress = clamp(data.reviveProgress, 0, REVIVE_DONE_AT);
      }
    } catch (err) {
      /* 数据坏了就从头开始 */
    }
  }

  function applyAppearance() {
    var isEgg = state.mode === "egg";
    parrot.visible = !isEgg;
    eggGroup.visible = isEgg;

    if (isEgg) {
      parrot.userData.targetScale = 1;
      return;
    }

    if (state.mode === "sick") {
      bodyMat.color.setHex(COLORS.sickBody);
      wingMat.color.setHex(COLORS.sickWing);
      shadeMat.color.setHex(COLORS.sickShade);
      tailMat.color.setHex(COLORS.sickWing);
      parrot.userData.targetScale = 0.5;
      return;
    }

    var lv = LEVEL_COLORS[levelIndexFromScore(state.score)];
    bodyMat.color.setHex(lv.hex);
    wingMat.color.setHex(lightenHex(lv.hex));
    shadeMat.color.setHex(darkenHex(lv.hex));
    tailMat.color.setHex(lightenHex(lv.hex));
    parrot.userData.targetScale = sizeFromScore(state.score);
  }

  function renderHud() {
    var levelEl = document.getElementById("level-text");
    var scoreEl = document.getElementById("score-text");
    var fill = document.getElementById("growth-fill");
    var hint = document.getElementById("growth-hint");

    if (state.reviving) {
      levelEl.textContent = state.mode === "egg" ? "一颗蛋" : "生病中";
      scoreEl.textContent = state.reviveProgress + " / " + REVIVE_DONE_AT;
      fill.classList.add("is-revive");
      fill.style.width = ((state.reviveProgress / REVIVE_DONE_AT) * 100).toFixed(1) + "%";
      hint.textContent =
        state.mode === "egg" ? "加满 10 分，我就先孵出来" : "再加满 10 分，我就完全好了";
      return;
    }

    fill.classList.remove("is-revive");

    if (state.mode === "sick") {
      levelEl.textContent = "生病了";
      scoreEl.textContent = state.score + " 分";
      fill.style.width = "0%";
      hint.textContent = "回到 0 分，我就好了";
      return;
    }

    var lv = levelIndexFromScore(state.score);
    var within = Math.max(0, state.score) % SCORE_PER_LEVEL;
    levelEl.textContent = LEVEL_COLORS[lv].name;
    scoreEl.textContent = state.score + " 分";
    fill.style.width = ((within / SCORE_PER_LEVEL) * 100).toFixed(1) + "%";
    hint.textContent =
      state.score <= 0
        ? "做一件好事，我就会长大"
        : "再攒 " + (SCORE_PER_LEVEL - within) + " 分就换颜色";
  }

  function changeScore(delta, options) {
    var opts = options || {};

    // 蛋和刚孵出来的生病阶段，加分都记在“复活进度”上
    if (state.reviving) {
      if (delta <= 0) {
        if (!opts.silent) say("我现在还很虚弱，先做好事吧", 3200);
        return false;
      }
      state.reviveProgress = clamp(state.reviveProgress + delta, 0, REVIVE_DONE_AT);

      if (state.reviveProgress >= REVIVE_DONE_AT) {
        state.reviving = false;
        state.mode = "healthy";
        state.score = 0;
        if (!opts.silent) {
          say("我完全好啦！谢谢你没有放弃我", 3800);
          chirp([520, 700, 900]);
          spawn("sparkle", 14);
        }
      } else if (state.reviveProgress >= REVIVE_SICK_AT) {
        state.mode = "sick";
        if (!opts.silent) {
          say("我孵出来了，但还有点不舒服", 3400);
          spawn("heart", 6);
        }
      } else {
        state.mode = "egg";
      }

      save();
      applyAppearance();
      renderHud();
      return true;
    }

    state.score += delta;

    if (state.score <= EGG_SCORE) {
      state.score = EGG_SCORE;
      state.mode = "egg";
      state.reviving = true;
      state.reviveProgress = 0;
      if (!opts.silent) {
        say("我变成一颗蛋了……做好事我就会回来", 4200);
        chirp([300, 260]);
      }
    } else if (state.score < 0) {
      state.mode = "sick";
      if (!opts.silent) {
        say(delta < 0 ? "我有点不舒服……" : "我好一点了，但还是没精神", 3400);
      }
    } else {
      state.mode = "healthy";
    }

    save();
    applyAppearance();
    renderHud();
    return true;
  }

  // ---------------------------------------------------------------- 生气计时
  var angerPanel = document.getElementById("anger-panel");
  var angerTimeEl = document.getElementById("anger-time");
  var angerHintEl = document.getElementById("anger-hint");

  function showAngerPanel() {
    angerPanel.hidden = false;
    if (hintEl) hintEl.classList.add("is-hidden");
  }

  function hideAngerPanel() {
    angerPanel.hidden = true;
  }

  function updateAngerPanel(elapsed) {
    var total = Math.floor(elapsed / 1000);
    var m = Math.floor(total / 60);
    var s = total % 60;
    angerTimeEl.textContent = m + ":" + (s < 10 ? "0" : "") + s;
    angerHintEl.textContent =
      elapsed < ANGER_FREE_MS
        ? "5 分钟内平静下来，我就会变回来"
        : "已经超过 5 分钟啦，现在平静不加也不减";
  }

  function startAnger() {
    if (state.angerStartedAt !== null) {
      say("我知道你还在生气，深呼吸，我陪着你");
      return;
    }
    if (state.mode === "egg") {
      say("我还是一颗蛋……先做好事让我回来好吗", 3400);
      return;
    }
    state.angerStartedAt = Date.now();
    changeScore(-1, { silent: true });
    say("没关系，我在。慢慢呼吸，我等你", 4200);
    showAngerPanel();
    updateAngerPanel(0);
    chirp([420, 360]);
  }

  function calmDown() {
    if (state.angerStartedAt === null) {
      say("现在没有在生气呀，我们一起保持", 3000);
      chirp([620, 760]);
      return;
    }

    var elapsed = Date.now() - state.angerStartedAt;
    state.angerStartedAt = null;
    hideAngerPanel();

    if (elapsed <= ANGER_FREE_MS) {
      changeScore(1, { silent: true });
      say("你做到了！只用 " + formatDuration(elapsed) + "，我变回来啦", 3800);
      spawn("sparkle", 10);
      chirp([620, 820]);
    } else {
      say("谢谢你平静下来。这一次不加也不减", 3600);
      chirp([520, 620]);
    }
  }

  function checkAngerTimer() {
    if (state.angerStartedAt === null) return;
    var elapsed = Date.now() - state.angerStartedAt;
    updateAngerPanel(elapsed);

    if (elapsed >= ANGER_AUTO_MS) {
      state.angerStartedAt = null;
      hideAngerPanel();
      changeScore(-1, { silent: true });
      say("过了 10 分钟了。我再小一点，但我还在，等你", 4200);
      chirp([380, 320]);
    }
  }

  // ---------------------------------------------------------------- actions
  function playPat() {
    state.action = "pat";
    state.actionTimer = 0.9;
    state.pats++;
    spawn("heart", 7);
    say(pick(["好舒服～", "再摸一下嘛", "咕噜咕噜～", "我喜欢你"]));
    chirp([620, 780]);
  }

  function playBrush() {
    state.action = "brush";
    state.actionTimer = 1.1;
    spawn("sparkle", 10);
    say(pick(["羽毛亮亮啦", "好干净呀", "谢谢你帮我梳毛"]));
    chirp([520, 660, 820]);
  }

  function playFeed() {
    state.action = "feed";
    state.actionTimer = 1.3;
    spawn("seed", 9);
    say(pick(["好好吃！", "小米真香～", "吃饱啦，谢谢你"]));
    chirp([440, 560]);
  }

  function playTalk() {
    state.action = "talk";
    state.actionTimer = 1.0;
    say(pick(["你好呀！", "我在这里～", "今天也要开心哦", "咕咕，咕咕！"]));
    chirp([700, 900, 760]);
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function react(name) {
    if (name === "pat") playPat();
    else if (name === "brush") playBrush();
    else if (name === "feed") playFeed();
    else playTalk();
  }

  function flash(button) {
    button.classList.add("is-busy");
    window.setTimeout(function () {
      button.classList.remove("is-busy");
    }, 220);
  }

  // 照顾面板：不加分也不扣分，就是陪它玩
  var careButtons = document.querySelectorAll(".care-button");
  for (var b = 0; b < careButtons.length; b++) {
    (function (button) {
      button.addEventListener("click", function () {
        react(button.getAttribute("data-action"));
        flash(button);
        dismissHint();
      });
    })(careButtons[b]);
  }

  // 记录面板：加分和扣分
  var scoreButtons = document.querySelectorAll(".score-button");
  for (var sb = 0; sb < scoreButtons.length; sb++) {
    (function (button) {
      button.addEventListener("click", function () {
        var action = button.getAttribute("data-action");
        flash(button);
        dismissHint();

        if (action === "angry") {
          startAnger();
        } else if (action === "calm") {
          calmDown();
        } else if (action === "homework-done") {
          changeScore(1);
          say("作业完成啦，真棒！", 3000);
          spawn("sparkle", 8);
          chirp([560, 720]);
        } else if (action === "homework-missed") {
          changeScore(-1);
          say("没完成也没关系，明天再试一次", 3200);
          chirp([400, 340]);
        } else if (action === "talk-happy") {
          changeScore(2);
          say("你们商量得很开心，我长大一点点", 3400);
          spawn("heart", 8);
          chirp([620, 780, 900]);
        } else if (action === "talk-sad") {
          changeScore(-2);
          say("商量完还是难过……我陪着你，下次再试", 3600);
          chirp([420, 350]);
        }
      });
    })(scoreButtons[sb]);
  }

  // 面板切换：记录 / 照顾
  var tabs = document.querySelectorAll(".dock-tab");
  var panels = document.querySelectorAll(".dock-panel");
  for (var tb = 0; tb < tabs.length; tb++) {
    (function (tab) {
      tab.addEventListener("click", function () {
        var name = tab.getAttribute("data-tab");
        for (var i = 0; i < tabs.length; i++) {
          var on = tabs[i] === tab;
          tabs[i].classList.toggle("is-active", on);
          tabs[i].setAttribute("aria-selected", on ? "true" : "false");
        }
        for (var j = 0; j < panels.length; j++) {
          panels[j].hidden = panels[j].getAttribute("data-panel") !== name;
        }
      });
    })(tabs[tb]);
  }

  var calmButton = document.getElementById("calm-button");
  if (calmButton) {
    calmButton.addEventListener("click", function () {
      calmDown();
    });
  }

  function dismissHint() {
    hintEl.classList.add("is-hidden");
  }

  // ---------------------------------------------------------------- sound
  var soundOn = true;
  var audioCtx = null;

  function ensureAudio() {
    if (!soundOn) return null;
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      try {
        audioCtx = new Ctx();
      } catch (err) {
        return null;
      }
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function chirp(notes) {
    var ctx = ensureAudio();
    if (!ctx) return;
    var now = ctx.currentTime;
    for (var n = 0; n < notes.length; n++) {
      var start = now + n * 0.1;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(notes[n], start);
      osc.frequency.exponentialRampToValueAtTime(notes[n] * 1.25, start + 0.09);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    }
  }

  soundToggle.addEventListener("click", function () {
    soundOn = !soundOn;
    soundToggle.setAttribute("aria-pressed", soundOn ? "true" : "false");
    soundToggle.setAttribute("aria-label", soundOn ? "关闭声音" : "打开声音");
    if (soundOn) {
      say("我又有声音啦");
      chirp([620, 820]);
    } else {
      say("好的，我安静一点");
    }
  });

  // ---------------------------------------------------------------- camera control
  var orbit = { yaw: 0, pitch: 0.26, distance: 7.2 };
  var sway = 0;
  var target = new THREE.Vector3(0, 1.35, 0);

  function fitDistance() {
    var aspect = camera.aspect;
    var distance = orbit.distance;
    // 竖屏（手机）时把镜头拉远一点，鹦鹉就不会顶满整个画面
    if (aspect < 1) distance *= 1 + (1 - aspect) * 0.85;
    return distance;
  }

  function updateCamera() {
    var distance = fitDistance();
    var yaw = orbit.yaw + sway;
    var cosP = Math.cos(orbit.pitch);
    camera.position.set(
      Math.sin(yaw) * cosP * distance,
      target.y + Math.sin(orbit.pitch) * distance,
      Math.cos(yaw) * cosP * distance
    );
    camera.lookAt(target);
  }

  var dragging = false;
  var dragStart = { x: 0, y: 0, time: 0 };
  var moved = 0;
  var pointerId = null;

  canvas.addEventListener("pointerdown", function (event) {
    dragging = true;
    moved = 0;
    pointerId = event.pointerId;
    dragStart.x = event.clientX;
    dragStart.y = event.clientY;
    dragStart.time = performance.now();
    canvas.classList.add("is-dragging");
    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (err) {
        /* ignore */
      }
    }
  });

  canvas.addEventListener("pointermove", function (event) {
    if (!dragging) return;
    var dx = event.clientX - dragStart.x;
    var dy = event.clientY - dragStart.y;
    moved += Math.abs(dx) + Math.abs(dy);

    orbit.yaw -= dx * 0.006;
    orbit.pitch = clamp(orbit.pitch + dy * 0.004, 0.04, 0.62);

    dragStart.x = event.clientX;
    dragStart.y = event.clientY;
    state.lastInteraction = performance.now();
  });

  function endDrag(event) {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove("is-dragging");
    if (canvas.releasePointerCapture && pointerId !== null) {
      try {
        canvas.releasePointerCapture(pointerId);
      } catch (err) {
        /* ignore */
      }
    }
    pointerId = null;

    var elapsed = performance.now() - dragStart.time;
    if (moved < 8 && elapsed < 500) {
      handleTap(event);
    }
  }

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", function () {
    dragging = false;
    canvas.classList.remove("is-dragging");
    pointerId = null;
  });

  canvas.addEventListener(
    "wheel",
    function (event) {
      event.preventDefault();
      orbit.distance = clamp(orbit.distance + event.deltaY * 0.0016, 4.8, 11);
      state.lastInteraction = performance.now();
    },
    { passive: false }
  );

  var raycaster = new THREE.Raycaster();
  var pointer = new THREE.Vector2();

  function handleTap(event) {
    var rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    var hits = raycaster.intersectObject(parrot, true);
    if (hits.length > 0) {
      playPat();
      dismissHint();
      state.lastInteraction = performance.now();
    }
  }

  // ---------------------------------------------------------------- loop
  var clock = new THREE.Clock();
  var elapsed = 0;
  var scaleNow = 1;

  function animate() {
    window.requestAnimationFrame(animate);

    var dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    var now = performance.now();

    // gentle idle sway (keeps the parrot in frame instead of drifting away)
    var idle = !dragging && now - state.lastInteraction > 3200;
    var swayGoal = idle && !reduceMotion ? Math.sin(elapsed * 0.18) * 0.12 : 0;
    sway = lerp(sway, swayGoal, 0.06);

    // breathing
    var breath = reduceMotion ? 0 : Math.sin(elapsed * 2.1) * 0.022;
    body.scale.set(1 + breath, 1.12 + breath, 0.96 + breath);

    // head bob
    head.position.y = 2.28 + (reduceMotion ? 0 : Math.sin(elapsed * 1.6) * 0.035);
    head.rotation.z = reduceMotion ? 0 : Math.sin(elapsed * 0.7) * 0.05;
    head.rotation.y = reduceMotion ? 0 : Math.sin(elapsed * 0.43) * 0.14;

    // tail sway
    tailGroup.rotation.z = reduceMotion ? 0 : Math.sin(elapsed * 1.35) * 0.07;

    // wings
    var flap = 0;
    if (state.action === "pat" || state.action === "talk") {
      flap = Math.sin(state.actionTimer * 22) * 0.35;
    } else if (!reduceMotion) {
      flap = Math.sin(elapsed * 1.1) * 0.035;
    }
    wings[0].rotation.z = flap;
    wings[1].rotation.z = -flap;

    // blink
    state.blinkTimer -= dt;
    if (state.blinkTimer <= 0 && state.blink <= 0) {
      state.blink = 0.13;
      state.blinkTimer = 2 + Math.random() * 3;
    }
    if (state.blink > 0) state.blink -= dt;
    var lid = state.blink > 0 ? 0.12 : state.mode === "sick" ? 0.45 : 1;
    for (var ei = 0; ei < eyes.length; ei++) {
      eyes[ei].scale.y = lid;
    }

    // 生病时垂头丧气，变成蛋以后轻轻晃动
    parrot.rotation.z = lerp(parrot.rotation.z, state.mode === "sick" ? 0.13 : 0, 0.06);
    if (eggGroup.visible) {
      eggGroup.rotation.z = reduceMotion ? 0 : Math.sin(elapsed * 2.4) * 0.05;
      eggGroup.position.y = 0.78 + (reduceMotion ? 0 : Math.sin(elapsed * 1.8) * 0.03);
    }

    checkAngerTimer();

    // action hop
    if (state.actionTimer > 0) {
      state.actionTimer -= dt;
      var bounce = Math.max(0, Math.sin(state.actionTimer * 12)) * 0.12;
      parrot.position.y = 0.12 + bounce;
    } else {
      parrot.position.y = lerp(parrot.position.y, 0.12, 0.12);
      state.action = null;
    }

    // grow / shrink smoothly
    var goal = parrot.userData.targetScale || 1;
    scaleNow = lerp(scaleNow, goal, 0.07);
    parrot.scale.setScalar(scaleNow);

    // clouds drift
    for (var ci = 0; ci < clouds.length; ci++) {
      clouds[ci].position.x += dt * (0.18 + ci * 0.03);
      if (clouds[ci].position.x > 16) clouds[ci].position.x = -16;
    }

    updateParticles(dt);
    updateCamera();
    renderer.render(scene, camera);
  }

  // ---------------------------------------------------------------- resize
  var appEl = document.getElementById("app");

  function resize() {
    var w = appEl.clientWidth || window.innerWidth;
    var h = appEl.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", function () {
    window.setTimeout(resize, 220);
  });

  if (window.ResizeObserver) {
    new window.ResizeObserver(resize).observe(appEl);
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) clock.getDelta();
  });

  // ---------------------------------------------------------------- boot
  resize();
  load();
  applyAppearance();
  renderHud();
  updateCamera();
  renderer.render(scene, camera);
  animate();

  window.setTimeout(function () {
    loading.classList.add("is-hidden");
    if (state.mode === "egg") {
      say("我还在蛋里……做好事我就会回来", 4200);
    } else if (state.mode === "sick") {
      say("我有点没精神……做好事我就会好起来", 4200);
    } else {
      say("你好，我是小白！");
    }
  }, 320);

  // 提示看一会儿就收起来，不要挡住小鹦鹉
  window.setTimeout(dismissHint, 6000);

  // 给以后的功能（周报、商场等）和自动测试用
  window.parrotGame = {
    addScore: changeScore,
    setScore: function (value) {
      state.reviving = false;
      state.reviveProgress = 0;
      state.score = Math.round(value);
      if (state.score <= EGG_SCORE) {
        state.score = EGG_SCORE;
        state.mode = "egg";
        state.reviving = true;
        state.reviveProgress = 0;
      } else if (state.score < 0) {
        state.mode = "sick";
      } else {
        state.mode = "healthy";
      }
      save();
      applyAppearance();
      renderHud();
    },
    startAnger: startAnger,
    calmDown: calmDown,
    shiftAnger: function (ms) {
      if (state.angerStartedAt !== null) state.angerStartedAt -= ms;
    },
    say: say,
    react: react,
    getState: function () {
      return {
        score: state.score,
        mode: state.mode,
        reviving: state.reviving,
        reviveProgress: state.reviveProgress,
        angerActive: state.angerStartedAt !== null,
        level:
          state.mode === "healthy"
            ? LEVEL_COLORS[levelIndexFromScore(state.score)].name
            : state.mode
      };
    }
  };
})();
