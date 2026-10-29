// Source: src/renderer.ts. Build with npm run build; do not edit dist/renderer.js directly.
import * as THREE from "./vendor/three.module.js";
import { OriginalBackground } from "./background.js";
import { ReplayDirector } from "./replay.js";
const E = window.HoverEngine;
const TILE: Record<string, number> = {
  ".": 0,
  s: 0,
  "*": 1,
  ">": 2,
  g: 3,
  d: 4,
  J: 5,
  P: 6,
  B: 7,
  "&": 16,
  "+": 17,
  Y: 18,
  "?": 19,
  "%": 20,
  "#": 21,
  T: 22,
  E: 23,
};
const THEMES = [0x202020, 0x787878, 0x404040, 0x282828, 0x060202].map(
  (fog) => ({ fog }),
);
// Mount positions copied from CARS_PROPATIE, in PS1 coordinates.
const MOUNTS = [
  {
    rudder: [
      [-56, -104, -208],
      [56, -104, -208],
    ],
    side: [
      [-112, 56, 48],
      [-112, 56, -128],
      [112, 56, 48],
      [112, 56, -128],
    ],
    rear: [
      [-64, 32, -240],
      [64, 32, -240],
    ],
  },
  {
    rudder: [
      [-57, -134, -249],
      [57, -134, -249],
    ],
    side: [
      [-115, 28, 95],
      [-115, 28, -76],
      [115, 28, 95],
      [115, 28, -76],
    ],
    rear: [
      [-64, 38, -268],
      [64, 38, -268],
    ],
  },
  {
    rudder: [],
    side: [
      [-96, 24, 96],
      [-112, 24, -114],
      [96, 24, 96],
      [112, 24, -114],
    ],
    rear: [
      [-96, -16, -288],
      [96, -16, -288],
    ],
  },
  {
    rudder: [
      [-64, -104, -160],
      [64, -104, -160],
    ],
    side: [
      [-112, 56, 48],
      [-112, 56, -128],
      [112, 56, 48],
      [112, 56, -128],
    ],
    rear: [
      [-64, 32, -240],
      [64, 32, -240],
    ],
  },
];
MOUNTS.push(MOUNTS[2], MOUNTS[1]);
export class HoverRenderer {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  ambient: THREE.AmbientLight;
  sunlight: THREE.DirectionalLight;
  camera: THREE.PerspectiveCamera;
  trackGroup: THREE.Group;
  cache: Map<string, THREE.Texture>;
  modelCache: Map<string, THREE.Group>;
  loader: THREE.TextureLoader;
  background: OriginalBackground;
  ships: ReturnType<HoverRenderer["makeShip"]>[];
  track: Track | null;
  yaw: number | null;
  follow = { yaw: 0, pitch: 0, roll: 0, distance: 0 };
  retro: boolean;
  frames: number;
  holdCamera = false;
  replayView = false;
  replayDirector = new ReplayDirector();
  private wasReplay = false;
  errors: string[];
  canvas: HTMLCanvasElement;
  countScene: THREE.Scene;
  countCamera: THREE.PerspectiveCamera;
  countDigits: THREE.Group[];
  skyGroup: THREE.Group;
  countdown: number | null = null;
  retroUniform = { value: 1 };
  // COURCE.C DQA * H * 65536 / 4096^2, with PS1 units / 100.
  sourceDepth = { value: 96 };
  result: {
    text: "COMPLETE" | "MISS" | "FINISH" | "1ST" | "2ND" | "3RD" | "4TH";
    frame: number;
  } | null = null;
  nameEntry: {
    indices: number[];
    selected: number;
    rotation: number;
    frame: number;
  } | null = null;
  nameLetters = new THREE.Group();
  nameKey = "";
  continuePrompt: { choice: number; rotation: number } | null = null;
  continueLetters = new THREE.Group();
  resultText = "";
  resultLetters = new THREE.Group();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      (2 * Math.atan(120 / 320) * 180) / Math.PI,
      4 / 3,
      0.15,
      6000,
    );
    this.trackGroup = new THREE.Group();
    this.scene.add(this.trackGroup);
    this.ambient = new THREE.AmbientLight(0xffffff, 1);
    this.sunlight = new THREE.DirectionalLight(0xffffff, Math.PI);
    this.scene.add(this.ambient, this.sunlight);
    this.cache = new Map();
    this.modelCache = new Map();
    this.loader = new THREE.TextureLoader();
    this.background = new OriginalBackground((path) => this.texture(path));
    this.ships = [];
    this.track = null;
    this.yaw = null;
    this.retro = true;
    this.frames = 0;
    this.errors = [];
    this.loader.manager.onError = (u) => this.errors.push(u);
    this.canvas = canvas;
    this.countScene = new THREE.Scene();
    this.countCamera = new THREE.PerspectiveCamera(42, 4 / 3, 0.15, 100);
    this.countDigits = [1, 2, 3].map((i) => {
      const m = this.modelObject("ALP_0_9", i);
      m.position.set(-10, 4, -60);
      this.countScene.add(m);
      return m;
    });
    this.countScene.add(new THREE.AmbientLight(0xffffff, 2));
    this.countScene.add(this.resultLetters);
    this.skyGroup = new THREE.Group();
    this.scene.add(this.skyGroup);
  }
  texture(path: string) {
    if (!this.cache.has(path)) {
      const t = this.loader.load("assets/" + path);
      t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      this.cache.set(path, t);
    }
    return this.cache.get(path)!;
  }
  // WebGL perspective interpolation is cancelled by carrying clip W with UV.
  // The 320x240 snap is applied only in RETRO, independent of canvas CSS size.
  sourceMaterial(material: THREE.Material) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.sourceRetro = this.retroUniform;
      shader.uniforms.sourceDepth = this.sourceDepth;
      shader.uniforms.sourceAmbient = { value: this.ambient.color };
      shader.uniforms.sourceCameraLight =
        material.userData.sourceCameraLight ||= { value: 0 };
      shader.uniforms.sourceUnlit = material.userData.sourceUnlit ||= {
        value: 0,
      };
      const header =
        "uniform float sourceRetro;\nuniform float sourceDepth;\nuniform float sourceUnlit;\nuniform float sourceCameraLight;\nuniform vec3 sourceAmbient;\nvarying float sourceW;\n";
      shader.vertexShader =
        header +
        shader.vertexShader.replace(
          "#include <project_vertex>",
          `
        #include <project_vertex>
        sourceW = mix(1.0, gl_Position.w, sourceRetro);
        #ifdef USE_MAP
          vMapUv *= sourceW;
        #endif
        if (sourceRetro > 0.5 && gl_Position.w > 0.0) {
          vec2 pixel = gl_Position.xy / gl_Position.w * vec2(160.0, 120.0);
          gl_Position.xy = floor(pixel + 0.5) / vec2(160.0, 120.0) * gl_Position.w;
        }
      `,
        );
      shader.fragmentShader =
        header +
        shader.fragmentShader
          .replace(
            "#include <map_fragment>",
            THREE.ShaderChunk.map_fragment.replace(
              "vMapUv",
              "(vMapUv / sourceW)",
            ),
          )
          .replace(
            "#include <opaque_fragment>",
            `
            #ifdef LAMBERT
              vec3 cameraLight = sourceAmbient + vec3(120.0 / 255.0) * max(dot(normal, normalize(vec3(0.0,128.0,32.0))), 0.0);
              outgoingLight = mix(outgoingLight, diffuseColor.rgb * cameraLight, sourceCameraLight);
            #endif
            outgoingLight = mix(outgoingLight, diffuseColor.rgb, sourceUnlit);
            #include <opaque_fragment>
          `,
          )
          .replace(
            "#include <fog_fragment>",
            `
            #ifdef USE_FOG
              float fogFactor = (1.0 - sourceUnlit) * clamp(1.25 - sourceDepth / max(vFogDepth, 0.0001), 0.0, 1.0);
              // GTE depth-cues the lighting colour before the GPU modulates
              // it with the texture (0x80 means unchanged texture brightness).
              #ifdef USE_MAP
                vec3 farTexture = linearToOutputTexel(sampledDiffuseColor).rgb * fogColor * 2.0;
                gl_FragColor.rgb = mix(gl_FragColor.rgb, farTexture, fogFactor);
              #else
                gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
              #endif
            #endif
          `,
          )
          .replace(
            "#include <dithering_fragment>",
            `
          #include <dithering_fragment>
          if (sourceRetro > 0.5) gl_FragColor.rgb = floor(clamp(gl_FragColor.rgb, 0.0, 1.0) * 31.0 + 0.5) / 31.0;
        `,
          );
    };
    material.customProgramCacheKey = () => "hover-source-raster-v3";
    return material;
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    const h = this.retro ? 240 : Math.min(1080, Math.round(r.height));
    this.renderer.setSize(Math.round((h * r.width) / r.height), h, false);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
  }
  clear(group: THREE.Group) {
    group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else {
          if (o.material.map?.userData.disposeWithMesh)
            o.material.map.dispose();
          o.material.dispose();
        }
      }
    });
    group.clear();
  }
  setTrack(track: Track) {
    if (this.track === track) return;
    this.track = track;
    this.clear(this.trackGroup);
    this.clear(this.skyGroup);
    const theme = THEMES[track.theme];
    this.scene.background = null;
    // COURCE.C / TRAINIG.C: ROCK selects GsSetLightMode(0), without fog.
    this.scene.fog = track.theme === 1 ? null : new THREE.Fog(theme.fog);
    this.sourceDepth.value = [96, 160, 144, 144, 144][track.theme];
    const ambient = [
      [0.75, 0.75, 0.75],
      [0.75, 0.75, 0.75],
      [0.375, 0.375, 0.375],
      [0.5, 0.5, 0.5],
      [0.4375, 0.375, 0.375],
    ][track.theme];
    this.ambient.color.setRGB(ambient[0], ambient[1], ambient[2]);
    const light = [
      [40, 40, 40],
      [120, 120, 120],
      [70, 70, 70],
      [60, 60, 60],
      [90, 60, 60],
    ][track.theme];
    this.sunlight.color.setRGB(light[0] / 255, light[1] / 255, light[2] / 255);
    this.sunlight.position.set(
      track.theme === 4 ? -40 : 0,
      track.theme === 4 ? 32 : 128,
      128,
    );
    const buffers = new Map<number, { p: number[]; uv: number[] }>();
    const add = (a: Vec3, b: Vec3, c: Vec3, d: Vec3, t: number) => {
      const bucket = buffers.get(t) || { p: [], uv: [] };
      buffers.set(t, bucket);
      const points = [a, b, c, d],
        uvs = [
          [0.015, 0.985],
          [0.015, 0.015],
          [0.985, 0.985],
          [0.985, 0.015],
        ];
      for (const i of [0, 1, 2, 2, 1, 3]) {
        bucket.p.push(points[i][0], points[i][1], -points[i][2]);
        bucket.uv.push(...uvs[i]);
      }
    };
    const boundary = (p: Boundary, row: number, ys: number) => {
      const l = p.l,
        r = p.r,
        w = Math.hypot(r[0] - l[0], r[2] - l[2]),
        dx = (r[0] - l[0]) / w,
        dz = (r[2] - l[2]) / w;
      if (row === 0) return [l[0] - dx * 10.24, l[1] - 2.56, l[2] - dz * 10.24];
      if (row === 1) return [l[0], l[1] + 5.12, l[2]];
      if (row === ys - 1) return [r[0], r[1] + 5.12, r[2]];
      if (row === ys)
        return [r[0] + dx * 10.24, r[1] - 2.56, r[2] + dz * 10.24];
      const t = (row - 2) / (ys - 4);
      return l.map((x, i) => E.mix(x, r[i], t));
    };
    for (let i = 0; i < track.nodes.length; i++) {
      const p = track.nodes[i],
        q = p.end || track.nodes[(i + 1) % track.nodes.length],
        tiles = p.allTiles,
        ys = tiles.length;
      for (let row = 0; row < ys; row++)
        add(
          boundary(p, row, ys),
          boundary(q, row, ys),
          boundary(p, row + 1, ys),
          boundary(q, row + 1, ys),
          TILE[tiles[row]] ?? 0,
        );
    }
    for (const [tile, data] of buffers) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(data.p, 3),
      );
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uv, 2));
      geometry.computeVertexNormals();
      const mat = new THREE.MeshBasicMaterial({
        map: this.texture("tile-" + tile + ".png"),
        side: THREE.DoubleSide,
        alphaTest: 0.1,
      });
      this.sourceMaterial(mat);
      this.trackGroup.add(new THREE.Mesh(geometry, mat));
    }
    this.yaw = null;
  }
  modelObject(name: string, index: number, translucent = false) {
    const group = new THREE.Group();
    const data = window.HOVER_MODELS[name][index];
    for (const [material, attrs] of Object.entries(data)) {
      const geometry = new THREE.BufferGeometry();
      for (const [key, size] of [
        ["position", 3],
        ["normal", 3],
        ["color", 3],
        ["uv", 2],
      ] as ["position" | "normal" | "color" | "uv", number][]) {
        const a = attrs[key].slice();
        if (key === "position" || key === "normal")
          for (let j = 2; j < a.length; j += 3) a[j] *= -1;
        geometry.setAttribute(key, new THREE.Float32BufferAttribute(a, size));
      }
      const [textureName, semi] = material.split("|");
      const fx =
        name === "OTHER" ||
        (name !== "YAKA_MAN" &&
          !name.startsWith("ALP_") &&
          (index === 2 || index === 3));
      const mat = new THREE.MeshLambertMaterial({
        map: textureName === "solid" ? null : this.texture(textureName),
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: translucent || !!semi,
        opacity: translucent || semi ? 0.5 : 1,
        depthWrite: !translucent && !semi,
        alphaTest: 0.01,
      });
      mat.userData.sourceCameraLight = { value: fx ? 1 : 0 };
      this.sourceMaterial(mat);
      group.add(new THREE.Mesh(geometry, mat));
    }
    return group;
  }
  makeShip(type: number, ghost = false) {
    const name = E.MACHINES[type].model,
      root = new THREE.Group(),
      body = new THREE.Group();
    root.add(body);
    let flames: THREE.Group[] = [],
      sides: THREE.Group[] = [],
      rudders: THREE.Group[] = [];
    const limbs: {
      arm: THREE.Group;
      fore: THREE.Group;
      leg: THREE.Group;
      knee: THREE.Group;
      foot: THREE.Group;
      s: number;
    }[] = [];
    if (type === 5) {
      const torso = this.modelObject(name, 2);
      body.add(torso);
      body.add(this.modelObject(name, 6));
      for (const s of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(s * 1.2675, -0.6104, 0);
        arm.add(this.modelObject(name, 0));
        const fore = this.modelObject(name, 1);
        fore.position.y = -1.05;
        arm.add(fore);
        const hand = this.modelObject(name, 5);
        hand.position.y = -1.3056;
        fore.add(hand);
        body.add(arm);
        const leg = new THREE.Group();
        leg.position.set(s * 0.489, -2.4472, -0.0555);
        leg.add(this.modelObject(name, 3));
        const knee = this.modelObject(name, 4);
        knee.position.y = -2.265;
        leg.add(knee);
        const foot = this.modelObject(name, 8);
        foot.position.y = -1.815;
        knee.add(foot);
        body.add(leg);
        limbs.push({ arm, fore, leg, knee, foot, s });
      }
      body.position.y = 4.5;
    } else {
      body.add(this.modelObject(name, 0));
      const mounts = MOUNTS[type],
        mount = (index: number, p: Vec3) => {
          const g = this.modelObject(name, index);
          g.position.set(p[0] / 100, -p[1] / 100, -p[2] / 100);
          body.add(g);
          return g;
        };
      rudders = mounts.rudder.map((p) => mount(1, p));
      flames = mounts.rear.map((p) => mount(2, p));
      sides = mounts.side.map((p, i) => {
        const g = mount(3, p);
        g.rotation.y = i < 2 ? -Math.PI / 2 : Math.PI / 2;
        return g;
      });
    }
    // Original TMD silhouette follows the ground independently from the body.
    let shadow: THREE.Group | undefined;
    if (type !== 5) {
      shadow = this.modelObject(name, 4, false);
      shadow.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          (o.material as THREE.Material).dispose();
          o.material = new THREE.MeshBasicMaterial({
            color: 0x050509,
            transparent: true,
            opacity: 0.45,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
        }
      });
      this.scene.add(shadow);
    }
    const explosions = Array.from({ length: 4 }, () => {
      const texture = this.texture("bomb.png").clone();
      texture.repeat.set(0.5, 0.25);
      texture.userData.disposeWithMesh = true;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity: 0.5,
          // DRAW_SP.C draw_bomb submits screen-space sprites at OT depth 0.
          // Ship and road depth must never occlude this overlay.
          depthTest: false,
          depthWrite: false,
        }),
      );
      sprite.visible = false;
      sprite.renderOrder = 100;
      root.add(sprite);
      return sprite;
    });
    const power = this.modelObject("OTHER", 0);
    body.add(power);
    power.visible = false;
    this.scene.add(root);
    // GP1_MAIN.C o1/o2/o3 and GAME.C make_chip_tmd's white/gold faces.
    const debrisMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });
    this.sourceMaterial(debrisMaterial);
    const compileDebris = debrisMaterial.onBeforeCompile;
    debrisMaterial.onBeforeCompile = (shader, renderer) => {
      compileDebris(shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `
        #include <color_fragment>
        diffuseColor.rgb *= gl_FrontFacing ? vec3(1.0) : vec3(1.0, 0.57758044, 0.0);
      `,
      );
    };
    debrisMaterial.customProgramCacheKey = () => "hover-source-debris-v1";
    const debris = new THREE.InstancedMesh(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [0, -0.15, 0, -0.1, 0.1, 0, 0.1, 0.1, 0],
          3,
        ),
      ),
      debrisMaterial,
      64,
    );
    debris.geometry.computeVertexNormals();
    debris.count = 0;
    debris.frustumCulled = false;
    root.add(debris);
    return {
      type,
      root,
      body,
      hull: type === 5 ? null : body.children[0],
      flames,
      sides,
      rudders,
      limbs,
      shadow,
      ghost,
      power,
      explosions,
      debris,
      motionFrame: 0,
      motionTick: -1,
    };
  }
  updateShip(
    ship: ReturnType<HoverRenderer["makeShip"]>,
    p: Pose,
    input: Input,
    time: number,
  ) {
    ship.root.visible = true;
    const tick = p.ticks ?? Math.floor(time * 60);
    const explosion = p.explosionFrames;
    // Original over counts down from 300; car_draw hides the last 120 ticks.
    ship.body.visible = explosion === undefined || explosion <= 180;
    // CAR_CTR.C changes the hull only; rudders, jets and shadow keep their attributes.
    ship.hull?.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mat = o.material as THREE.MeshLambertMaterial;
      const critical =
        (p.energy ?? 100) < 12.5 && explosion === undefined && !p.cpuSlot;
      (mat.userData.sourceUnlit ||= { value: 0 }).value =
        p.damageLight || (critical && (tick & 7) === 0) ? 1 : 0;
      const semi = ship.ghost || !!p.damageSemi;
      if (mat.transparent !== semi) {
        mat.transparent = semi;
        mat.needsUpdate = true;
      }
      mat.opacity = semi ? 0.5 : 1;
      mat.depthWrite = !semi;
    });
    ship.explosions.forEach((s, i) => {
      const t = p.explosionFrames ?? Infinity;
      s.visible = Number.isFinite(t) && t < 236;
      if (s.visible) {
        const phase = (t + i * 2) % 8;
        const cycle = Math.floor((t + i * 2) / 8);
        let seed = (Math.imul(cycle + 1, 1664525) + i * 1013904223) >>> 0;
        const rand = () => {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          return seed;
        };
        const scale = (rand() & 8191) + 4096;
        s.material.map!.offset.set(
          Math.floor(phase / 4) * 0.5,
          1 - ((phase % 4) + 1) * 0.25,
        );
        s.position.set(
          ((rand() & 31) - 16) * 0.08,
          ((rand() & 31) - 16) * 0.08,
          0,
        );
        s.scale.setScalar((32 * scale) / 51200);
      }
    });
    ship.root.position.set(p.x, p.y, -p.z);
    ship.root.rotation.set(0, -p.heading, 0);
    ship.body.rotation.set(p.pitch || 0, 0, p.roll || 0);
    for (const g of ship.rudders)
      g.rotation.y = (-(p.rudderAngle || 0) * Math.PI * 2) / 4096;
    const size =
      (input.accel || p.turbo ? 64 : p.fireTail || 0) + (p.turbo ? 16 : 0);
    for (const g of ship.flames) {
      g.visible = size > 0 && ((tick + (p.cpuSlot || 0)) & 1) === 0;
      g.scale.setScalar(size / 64);
      g.rotation.z = (-Math.floor(tick / 2) * 165 * Math.PI * 2) / 4096;
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          // Turbo sets DOBJ_FIRE bit 6 (lighting off), not bit 30.
          // The flame becomes full-bright; it does not become translucent.
          const mat = o.material as THREE.MeshLambertMaterial;
          (mat.userData.sourceUnlit ||= { value: 0 }).value = p.turbo ? 1 : 0;
        }
      });
    }
    const effect = p.repairFrames || 0;
    ship.power.visible = effect > 0;
    ship.power.scale.setScalar(Math.max(0, effect - 1) / 16);
    ship.power.rotation.y = (-(effect - 1) * Math.PI) / 4;
    const names: (keyof Input)[] = ["l1", "l2", "r1", "r2"];
    ship.sides.forEach((g, i) => {
      g.visible = !p.cpuSlot && !!input[names[i]] && (tick & 1) === 1;
      g.rotation.x = (-tick * 165 * Math.PI * 2) / 4096;
    });
    if (ship.motionTick !== tick) {
      const elapsed =
        ship.motionTick < 0 ? 0 : Math.max(0, tick - ship.motionTick);
      ship.motionFrame += elapsed * (((p.sourceSpeed || 0) >> 7) + 1);
      ship.motionTick = tick;
    }
    // OMAKE.C DASH tables and cap_work's four-way integer interpolation.
    const arm0 = [25, 30, 58, 74, 68, 39, 24, -7, -9, -11, -21];
    const arm1 = [-57, -46, -8, -4, -8, -25, -54, -89, -100, -86, -59];
    const foot0 = [0, 0, 19, 20, 11, -9, -30, -42, -36, -22, -14];
    const foot1 = [27, 37, 34, 51, 79, 83, 87, 45, 14, -1, 10];
    const motion = (a: number[], frame: number, parent?: number[]) => {
      const f = frame % 44,
        j = Math.floor(f / 4),
        k = (j + 1) % 11;
      const value = Math.trunc(
        -(
          (a[j] - (parent?.[j] || 0)) * 4096 * (4 - (f % 4)) +
          (a[k] - (parent?.[k] || 0)) * 4096 * ((f % 4) + 1)
        ) /
          4 /
          360,
      );
      return ((value + Math.trunc((13 * 4096) / 360 / 2)) * Math.PI * 2) / 4096;
    };
    ship.limbs.forEach(({ arm, fore, leg, knee, s }) => {
      const f = ship.motionFrame + (s > 0 ? 0 : 22);
      const standing = (p.sourceSpeed || 0) < 20;
      arm.rotation.x = standing ? 0 : motion(arm0, f);
      fore.rotation.x = standing ? 0 : motion(arm1, f, arm0);
      leg.rotation.x = standing ? 0 : motion(foot0, f + 22);
      knee.rotation.x = standing ? 0 : motion(foot1, f + 22, foot0);
    });
    if (ship.shadow) {
      ship.shadow.visible =
        p.onRoad !== false && (explosion === undefined || explosion <= 180);
      ship.shadow.position.set(p.x, (p.groundY ?? p.y - 2) + 0.06, -p.z);
      const n = p.groundNormal || [0, 4096, 0];
      const up = new THREE.Vector3(n[0], n[1], -n[2]).normalize();
      ship.shadow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      ship.shadow.rotateY(-p.heading);
    }
    const inverse = new THREE.Matrix4();
    ship.root.updateMatrixWorld(true);
    inverse.copy(ship.root.matrixWorld).invert();
    const matrix = new THREE.Matrix4(),
      rotation = new THREE.Quaternion();
    ship.debris.count = Math.min(64, p.debris?.length || 0);
    for (let i = 0; i < ship.debris.count; i++) {
      const d = p.debris![i];
      rotation.setFromEuler(
        new THREE.Euler((48 - d.life) * 0.7, d.seed % 8, (48 - d.life) * 0.4),
      );
      matrix.compose(
        new THREE.Vector3(d.x, d.y, -d.z),
        rotation,
        new THREE.Vector3(1, 1, 1),
      );
      ship.debris.setMatrixAt(i, matrix.premultiply(inverse));
    }
    ship.debris.instanceMatrix.needsUpdate = true;
  }
  updateCamera(car: Pose, startCount = 0) {
    if (this.yaw === null) {
      this.follow = {
        yaw: startCount > 0 ? 0 : car.heading,
        pitch: startCount > 0 ? 0 : car.pitch || 0,
        roll: startCount > 0 ? 0 : car.roll || 0,
        distance: 0,
      };
    }
    if (this.replayView && this.track) {
      if (!this.wasReplay) this.replayDirector.reset();
      this.replayDirector.step(
        this.track,
        E.nearest(this.track, car.x, car.z).index,
      );
      if (this.replayDirector.mode !== 33)
        E.cameraStep(this.follow, car, 0, this.replayDirector.mode);
    } else E.cameraStep(this.follow, car, startCount);
    this.wasReplay = this.replayView;
    this.yaw = this.follow.yaw;
  }
  draw(
    track: Track,
    car: Pose,
    bots: Car[],
    state: string,
    time: number,
    input: Input,
    ghost: Pose | null = null,
  ) {
    this.setTrack(track);
    this.retroUniform.value = this.retro ? 1 : 0;
    const racers = [car, ...bots, ...(ghost ? [ghost] : [])];
    while (this.ships.length > racers.length) {
      const s = this.ships.pop()!;
      this.scene.remove(s.root);
      if (s.shadow) this.scene.remove(s.shadow);
      this.clear(s.root);
      if (s.shadow) this.clear(s.shadow);
    }
    racers.forEach((p, i) => {
      const g = i === racers.length - 1 && !!ghost;
      if (
        !this.ships[i] ||
        this.ships[i].type !== p.type ||
        this.ships[i].ghost !== g
      ) {
        if (this.ships[i]) {
          const old = this.ships[i];
          this.scene.remove(old.root);
          if (old.shadow) this.scene.remove(old.shadow);
          this.clear(old.root);
          if (old.shadow) this.clear(old.shadow);
        }
        this.ships[i] = this.makeShip(p.type, g);
      }
      this.updateShip(
        this.ships[i],
        p,
        i === 0 ? input : p.active || { accel: true },
        time,
      );
    });
    if (state !== "falling" && !this.holdCamera) {
      if (this.yaw === null) this.updateCamera(car, this.countdown || 0);
      const menu = state === "menu",
        distance = menu
          ? 24
          : 35 +
            this.follow.distance / (this.replayView ? 100 : 400) +
            (this.countdown || 0);
      const yaw = menu ? car.heading - 0.42 : this.follow.yaw,
        sy = Math.sin(yaw),
        cy = Math.cos(yaw);
      this.camera.position.set(
        car.x - sy * distance,
        car.y + (menu ? 10 : 8.5),
        -car.z + cy * distance,
      );
      const pitch = menu
        ? -0.18
        : this.follow.pitch *
            (this.replayView && this.replayDirector.mode === 17 ? -1 : 1) -
          (Math.trunc((4096 * 7) / 360) * Math.PI * 2) / 4096;
      const roll = menu || this.replayView ? 0 : this.follow.roll;
      this.camera.up.set(
        -Math.cos(yaw) * Math.sin(roll),
        Math.cos(roll),
        Math.sin(yaw) * Math.sin(roll),
      );
      this.camera.lookAt(
        car.x + sy * 30,
        car.y + 8.5 + Math.tan(pitch) * (distance + 30),
        -car.z - cy * 30,
      );
    }
    if (this.replayView && this.replayDirector.anchor && !this.holdCamera) {
      const anchor = this.replayDirector.anchor;
      this.camera.position.set(anchor.x, anchor.y, -anchor.z);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(car.x, car.y, -car.z);
    }
    this.skyGroup.position.set(car.x, 0, -car.z);
    this.renderer.autoClear = true;
    this.background.draw(this.renderer, this.camera, track.theme, time);
    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
    this.renderer.autoClear = true;
    this.nameLetters.visible = !!this.nameEntry;
    this.continueLetters.visible = !!this.continuePrompt;
    this.resultLetters.visible = !!this.result;
    if (this.countdown !== null && this.countdown !== undefined) {
      const n = this.countdown;
      let i = Math.floor(n / 60);
      const j = n % 60;
      if (i < 4) {
        if (j <= 20 && i !== 0) i--;
        this.countDigits.forEach((m, k) => {
          m.visible = k === i;
          if (m.visible)
            m.rotation.y =
              j <= 20 ? (-(-204 * (j - 40)) * Math.PI * 2) / 4096 : 0;
        });
        this.renderer.autoClear = false;
        this.renderer.clearDepth();
        this.renderer.render(this.countScene, this.countCamera);
        this.renderer.autoClear = true;
      }
    }
    this.frames++;
    if (this.result) {
      const { text, frame } = this.result;
      if (this.resultText !== text) {
        this.clear(this.resultLetters);
        this.resultText = text;
        for (const ch of text) {
          const first = ch <= "O" ? "A" : "P";
          this.resultLetters.add(
            this.modelObject(
              /[0-9]/.test(ch)
                ? "ALP_0_9"
                : first === "A"
                  ? "ALP_A_O"
                  : "ALP_P_O",
              /[0-9]/.test(ch) ? +ch : ch.charCodeAt(0) - first.charCodeAt(0),
            ),
          );
        }
      }
      this.countDigits.forEach((m) => (m.visible = false));
      this.resultLetters.visible = true;
      // TRAINIG.C: one character every 8 ticks, Z 8000 -> 6000 by 200,
      // Y rotation 4096/5 per tick while approaching the final position.
      this.resultLetters.children.forEach((m, i) => {
        const age = frame - (i + 1) * 8;
        const training = text === "COMPLETE" || text === "MISS";
        const steps = Math.min(training ? 10 : 5, Math.max(0, age + 1));
        m.visible = age >= 0;
        m.position.set(
          (i - (text.length - 1) / 2) * 6,
          training || text === "FINISH" ? 0 : 6,
          -(training ? 80 : 50) + steps * 2,
        );
        m.rotation.y = (-steps * 819 * Math.PI * 2) / 4096;
      });
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.countScene, this.countCamera);
      this.renderer.autoClear = true;
    } else this.resultLetters.visible = false;
    this.continueLetters.visible = !!this.continuePrompt;
    if (this.continuePrompt) {
      if (!this.continueLetters.children.length) {
        [..."CONTINUE?YESNO"].forEach((ch, i) => {
          const first = ch <= "O" ? "A" : "P";
          const letter = this.modelObject(
            ch === "?" ? "ALP_0_9" : first === "A" ? "ALP_A_O" : "ALP_P_O",
            ch === "?" ? 12 : ch.charCodeAt(0) - first.charCodeAt(0),
          );
          letter.position.set(
            i < 9 ? -24 + i * 6 : i < 12 ? -6 + (i - 9) * 6 : -3 + (i - 12) * 6,
            i < 9 ? 10 : -10,
            i < 9 ? -60 : -50,
          );
          this.continueLetters.add(letter);
        });
        this.countScene.add(this.continueLetters);
      }
      this.countDigits.forEach((m) => (m.visible = false));
      this.resultLetters.visible = false;
      this.continueLetters.children.forEach((letter, i) => {
        letter.visible =
          i < 9 || (this.continuePrompt!.choice === 0 ? i < 12 : i >= 12);
        letter.rotation.y = i < 9 ? 0 : this.continuePrompt!.rotation;
      });
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.countScene, this.countCamera);
      this.renderer.autoClear = true;
    }
    if (this.nameEntry) {
      const entry = this.nameEntry,
        key = entry.indices.join(",");
      if (this.nameKey !== key) {
        this.clear(this.nameLetters);
        this.nameKey = key;
        entry.indices.forEach((index) =>
          this.nameLetters.add(
            this.modelObject(
              ["ALP_A_O", "ALP_P_O", "ALP_0_9"][Math.floor(index / 15)],
              index % 15,
            ),
          ),
        );
        if (!this.nameLetters.parent) this.countScene.add(this.nameLetters);
      }
      this.countDigits.forEach((m) => (m.visible = false));
      this.resultLetters.visible = false;
      this.continueLetters.visible = false;
      this.nameLetters.visible = true;
      const sine = (rate: number, offset = 0) =>
        Math.sin(((entry.frame * rate + offset) * Math.PI * 2) / 720);
      this.nameLetters.children.forEach((letter, i) => {
        const selected = i === entry.selected;
        letter.position.set(
          i * 8 - 8 + (selected ? sine(1) * 0.64 : 0),
          selected ? -sine(7) * 0.64 : 0,
          -50 + (selected ? 10 + sine(1, 45) * 0.16 : 0),
        );
        const rotation = entry.rotation;
        letter.rotation.set(
          selected && rotation ? (sine(3) * Math.PI * 2) / 64 : 0,
          selected
            ? ((Math.abs(rotation) > 8
                ? -Math.sign(rotation) * (16 - Math.abs(rotation))
                : rotation) *
                Math.PI) /
                16
            : 0,
          selected && rotation ? (sine(5) * Math.PI * 2) / 64 : 0,
        );
      });
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.countScene, this.countCamera);
      this.renderer.autoClear = true;
    }
  }
  // Dedicated black-background selection pass. Reuse original TMD letters and
  // the actual course mesh instead of a browser illustration of the course.
  menuScene = new THREE.Scene();
  menuLetters = new THREE.Group();
  menuHeading = "";
  menuShip: ReturnType<HoverRenderer["makeShip"]> | null = null;
  menuCamera = new THREE.PerspectiveCamera(
    (2 * Math.atan(120 / 320) * 180) / Math.PI,
    4 / 3,
    0.1,
    10000,
  );
  drawMenu(screen: string, track: Track, type: number, time: number, age = 1) {
    this.retroUniform.value = this.retro ? 1 : 0;
    if (this.menuScene.children.length === 0) {
      this.menuScene.background = new THREE.Color(0);
      this.menuScene.add(new THREE.AmbientLight(0xffffff, 1.6));
      const light = new THREE.DirectionalLight(0xffffff, 1.5);
      light.position.set(0, 256, 128);
      this.menuScene.add(light, this.menuLetters);
    }
    const heading =
      screen === "car"
        ? "CARSELECT"
        : screen === "course"
          ? "COURCESELECT"
          : "";
    if (heading !== this.menuHeading) {
      this.clear(this.menuLetters);
      this.menuHeading = heading;
      [...heading].forEach((ch, i) => {
        const first = ch <= "O" ? "A" : "P";
        const letter = this.modelObject(
          first === "A" ? "ALP_A_O" : "ALP_P_O",
          ch.charCodeAt(0) - first.charCodeAt(0),
        );
        letter.position.set(
          -37.5 + i * 5.6 + (i > (screen === "car" ? 2 : 5) ? 5.6 : 0),
          25.5,
          -90,
        );
        this.menuLetters.add(letter);
      });
    }
    const entryFrame = Math.min(0, Math.floor(age * 60) - 60);
    this.menuLetters.children.forEach((letter, i) => {
      const count = heading.length;
      const lag = Math.max(
        0,
        -entryFrame * (screen === "car" ? 4 : 6) +
          (count - i) * 12 -
          (screen === "car" ? 120 : 156),
      );
      letter.position.x =
        -37.5 +
        i * 5.6 +
        (i > (screen === "car" ? 2 : 5) ? 5.6 : 0) -
        lag * 0.2 * (count - i);
      letter.rotation.y = (lag * 4 * (i + 2) * Math.PI * 2) / 4096;
    });
    this.menuCamera.position.set(0, 0, 0);
    this.menuCamera.up.set(0, 1, 0);
    this.menuCamera.lookAt(0, 0, -90);
    this.renderer.autoClear = true;
    this.renderer.render(this.menuScene, this.menuCamera);
    if (screen === "car") {
      if (this.menuShip?.type !== type) {
        if (this.menuShip) {
          this.clear(this.menuShip.root);
          if (this.menuShip.shadow) {
            this.scene.remove(this.menuShip.shadow);
            this.clear(this.menuShip.shadow);
          }
        }
        this.menuShip = this.makeShip(type);
        this.scene.remove(this.menuShip.root);
        if (this.menuShip.shadow) this.scene.remove(this.menuShip.shadow);
      }
      const ship = this.menuShip!;
      ship.flames.forEach((m) => (m.visible = false));
      ship.sides.forEach((m) => (m.visible = false));
      ship.root.position.set(3.5 - entryFrame * 0.08, 0, 0);
      ship.root.rotation.set(0, (time * Math.PI * 2) / 3, 0);
      const modelScene = new THREE.Scene();
      modelScene.add(ship.root, new THREE.AmbientLight(0xffffff, 1.6));
      const light = new THREE.DirectionalLight(0xffffff, 1.5);
      light.position.set(0, 256, 128);
      modelScene.add(light);
      this.menuCamera.position.set(0, 9, -14);
      this.menuCamera.lookAt(0, 4, 0);
      // Original projection places the model in the left half of the display.

      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(modelScene, this.menuCamera);

      modelScene.remove(ship.root);
    } else if (screen === "course") {
      this.setTrack(track);
      const box = new THREE.Box3().setFromObject(this.trackGroup);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const pivot = new THREE.Group();
      pivot.add(this.trackGroup);
      this.trackGroup.position.copy(center).multiplyScalar(-1);
      pivot.rotation.set(0, (time * 16 * 60 * Math.PI * 2) / 4096, 0);
      const preview = new THREE.Scene();
      preview.add(pivot);
      const distance = Math.max(size.x, size.z) * 1.5;
      this.menuCamera.position.set(0, distance * 0.94, distance * 0.342);
      this.menuCamera.lookAt(0, 0, 0);
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(preview, this.menuCamera);
      this.trackGroup.position.set(0, 0, 0);
      this.scene.add(this.trackGroup);
    }
    if (heading) {
      this.menuCamera.position.set(0, 0, 0);
      this.menuCamera.lookAt(0, 0, -90);
      this.menuScene.background = null;
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.menuScene, this.menuCamera);
      this.menuScene.background = new THREE.Color(0);
    }
    this.renderer.autoClear = true;
    this.frames++;
  }
  diagnostics() {
    return {
      renderer: "Three.js " + THREE.REVISION,
      backgroundTheme: this.background.theme,
      groundBands: this.background.ground.length,
      searchlights: this.background.beams.length,
      replayCameraMode: this.replayView ? this.replayDirector.mode : null,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      assetErrors: this.errors,
    };
  }
}
