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
// GP next race intro: its length in frames, the countdown swing's steady
// rate and lag (source angle units per frame), and the extra downward look
// at its start.
export const INTRO_FRAMES = 210;
const INTRO_SWING_RATE = 16;
const INTRO_SWING_LAG = 204;
const INTRO_PITCH = (48 * Math.PI) / 180;
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
  frames: number;
  holdCamera = false;
  replayView = false;
  replayDirector = new ReplayDirector();
  private wasReplay = false;
  errors: string[];
  canvas: HTMLCanvasElement;
  skyGroup: THREE.Group;
  countdown: number | null = null;
  finishCamera = false;
  // COURCE.C DQA * H * 65536 / 4096^2, with PS1 units / 100.
  sourceDepth = { value: 96 };
  // Next race intro: frames left before the countdown takes over.
  introLeft: number | null = null;
  introReach = 0;

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
    this.frames = 0;
    this.errors = [];
    this.loader.manager.onError = (u) => this.errors.push(u);
    this.canvas = canvas;
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
  sourceMaterial(material: THREE.Material) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.sourceDepth = this.sourceDepth;
      shader.uniforms.sourceAmbient = { value: this.ambient.color };
      shader.uniforms.sourceCameraLight =
        material.userData.sourceCameraLight ||= { value: 0 };
      shader.uniforms.sourceUnlit = material.userData.sourceUnlit ||= {
        value: 0,
      };
      const header =
        "uniform float sourceDepth;\nuniform float sourceUnlit;\nuniform float sourceCameraLight;\nuniform vec3 sourceAmbient;\n";
      shader.fragmentShader =
        header +
        shader.fragmentShader
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
          );
    };
    material.customProgramCacheKey = () => "hover-source-raster-v4";
    return material;
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    // Bound both height and total pixels, including very wide displays.
    const h = Math.max(
      1,
      Math.floor(
        Math.min(1080, r.height, Math.sqrt((3840 * 1080 * r.height) / r.width)),
      ),
    );
    this.renderer.setSize(Math.round((h * r.width) / r.height), h, false);
    for (const camera of [this.camera, this.menuCamera]) {
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
    }
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
    this.buildTrackGeometry(track, this.trackGroup);
    this.yaw = null;
  }
  private buildTrackGeometry(track: Track, group: THREE.Group, source = true) {
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
      for (const i of [0, 2, 1, 2, 3, 1]) {
        bucket.p.push(points[i][0], points[i][1], -points[i][2]);
        bucket.uv.push(...uvs[i]);
      }
    };
    const boundary = E.boundaryVertex;
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
      // MAKEMAP.C adds a dark, double-sided V-shaped underside. It becomes
      // visible while falling; the textured road faces remain one-sided.
      const bottom = (v: RawBoundary) => boundary(v, ys + 1, ys);
      add(boundary(p, 0, ys), boundary(q, 0, ys), bottom(p), bottom(q), -1);
      add(bottom(p), bottom(q), boundary(p, ys, ys), boundary(q, ys, ys), -1);
    }
    for (const [tile, data] of buffers) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(data.p, 3),
      );
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uv, 2));
      geometry.computeVertexNormals();
      const mat = source
        ? new THREE.MeshBasicMaterial({
            map: tile < 0 ? null : this.texture("tile-" + tile + ".png"),
            color: tile < 0 ? 0x080808 : 0xffffff,
            side: tile < 0 ? THREE.DoubleSide : THREE.FrontSide,
            alphaTest: 0.1,
          })
        : new THREE.MeshLambertMaterial({
            color: tile < 0 ? 0x344351 : tile === 3 ? 0x20e5ec : 0xb9c7d3,
            side: THREE.DoubleSide,
          });
      if (source) this.sourceMaterial(mat);
      group.add(new THREE.Mesh(geometry, mat));
    }
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
      const jet = !name.startsWith("ALP_") && (index === 2 || index === 3);
      const fx = name === "OTHER" || jet;
      // The source draws rear jets opaque on alternate ticks, which the eye
      // averages in linear light. Drawn every tick, a 65% sRGB blend matches
      // that average over typical road colours.
      const rearJet = jet && index === 2;
      const half = translucent || !!semi;
      const mat = new THREE.MeshLambertMaterial({
        map: textureName === "solid" ? null : this.texture(textureName),
        vertexColors: true,
        // Rear/side jet TMD packets have flag=0 (single-sided). Their nested
        // shells expose three blue colours; back faces would hide the core.
        side: jet ? THREE.FrontSide : THREE.DoubleSide,
        transparent: half || rearJet,
        opacity: half ? 0.5 : rearJet ? 0.65 : 1,
        depthWrite: !half && !rearJet,
        alphaTest: 0.01,
      });
      mat.userData.sourceCameraLight = { value: fx ? 1 : 0 };
      this.sourceMaterial(mat);
      group.add(new THREE.Mesh(geometry, mat));
      if (rearJet) {
        // Depth-only pass, so only the nearest shell blends over the scene
        // instead of every nested shell darkening the one behind it.
        const depth = mat.clone();
        depth.transparent = false;
        depth.opacity = 1;
        depth.depthWrite = true;
        depth.colorWrite = false;
        group.add(new THREE.Mesh(geometry, depth));
      }
    }
    return group;
  }
  makeShip(type: number, ghost = false) {
    const name = E.MACHINES[type].model,
      root = new THREE.Group(),
      body = new THREE.Group();
    root.add(body);
    body.add(this.modelObject(name, 0));
    const mounts = MOUNTS[type],
      mount = (index: number, p: Vec3) => {
        const g = this.modelObject(name, index);
        g.position.set(p[0] / 100, -p[1] / 100, -p[2] / 100);
        body.add(g);
        return g;
      };
    const rudders = mounts.rudder.map((p) => mount(1, p));
    const flames = mounts.rear.map((p) => mount(2, p));
    const sides = mounts.side.map((p, i) => {
      const g = mount(3, p);
      g.rotation.y = i < 2 ? -Math.PI / 2 : Math.PI / 2;
      return g;
    });
    // Original TMD silhouette follows the ground independently from the body.
    const shadow = this.modelObject(name, 4, false);
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
      hull: body.children[0],
      flames,
      sides,
      rudders,
      shadow,
      ghost,
      power,
      explosions,
      debris,
    };
  }
  sourceWorldMatrix(source: Vec3) {
    // Original coordinates -> Three: (x,y,z) -> (x,-y,-z).
    const s = [1, -1, -1],
      matrix = new THREE.Matrix4();
    matrix.set(
      ...(Array.from({ length: 16 }, (_, i) => {
        const row = Math.floor(i / 4),
          column = i % 4;
        return row < 3 && column < 3
          ? (source[row * 3 + column] * s[row] * s[column]) / 4096
          : i === 15
            ? 1
            : 0;
      }) as Parameters<THREE.Matrix4["set"]>),
    );
    return matrix;
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
        p.warningActive ??
        ((p.energy ?? 100) < 12.5 && explosion === undefined && !p.cpuSlot);
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
    if (p.sourceMatrix) {
      ship.root.rotation.set(0, 0, 0);
      ship.body.matrixAutoUpdate = false;
      ship.body.matrix
        .copy(this.sourceWorldMatrix(p.sourceMatrix))
        .setPosition(ship.body.position);
      ship.body.matrixWorldNeedsUpdate = true;
    } else {
      ship.root.rotation.set(0, -p.heading, 0);
      ship.body.matrixAutoUpdate = true;
      ship.body.rotation.set(p.pitch || 0, 0, p.roll || 0);
    }
    for (const g of ship.rudders)
      g.rotation.y = (-(p.rudderAngle || 0) * Math.PI * 2) / 4096;
    const size =
      (input.accel || p.turbo ? 64 : p.fireTail || 0) + (p.turbo ? 16 : 0);
    // The original blinks rear jets on even ticks, which strobes at 30 Hz on
    // modern displays, so they are drawn every tick with a partial blend.
    for (const g of ship.flames) {
      g.visible = size > 0;
      g.scale.setScalar(size / 64);
      // The source turns 165 units every other tick; spread it over both ticks
      // so the faceted shells do not jump and re-shade at 30 Hz.
      g.rotation.z = (-tick * 165 * Math.PI) / 4096;
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
      g.visible =
        (!p.cpuSlot || ship.ghost) &&
        !!input[names[i]] &&
        ((tick + (p.cpuSlot || 0)) & 1) === 1;
      g.rotation.x = (-tick * 165 * Math.PI * 2) / 4096;
    });
    if (ship.shadow) {
      ship.shadow.visible =
        p.onRoad !== false && (explosion === undefined || explosion <= 180);
      ship.shadow.position.set(p.x, (p.groundY ?? p.y - 2) + 0.06, -p.z);
      if (p.sourceShadowMatrix) {
        ship.shadow.matrixAutoUpdate = false;
        ship.shadow.matrix
          .copy(this.sourceWorldMatrix(p.sourceShadowMatrix))
          .setPosition(ship.shadow.position);
        ship.shadow.matrixWorldNeedsUpdate = true;
      } else {
        ship.shadow.matrixAutoUpdate = true;
        const n = p.groundNormal || [0, 4096, 0];
        const up = new THREE.Vector3(n[0], n[1], -n[2]).normalize();
        ship.shadow.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          up,
        );
        ship.shadow.rotateY(-p.heading);
      }
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
        "index" in car && typeof car.index === "number"
          ? car.index
          : E.nearest(this.track, car.x, car.z).index,
      );
      if (this.replayDirector.mode !== 33)
        E.cameraStep(this.follow, car, 0, this.replayDirector.mode);
    } else
      E.cameraStep(this.follow, car, startCount, this.finishCamera ? 17 : 0);
    this.wasReplay = this.replayView;
    this.yaw = this.follow.yaw;
  }
  // The GP intro hands over to the countdown camera without resetting it:
  // its yaw already trails the swing target as it does a few frames into
  // an ordinary countdown, so the swing continues at its steady rate.
  settleCountdown(car: Pose, startCount: number, track: Track) {
    this.follow = {
      yaw:
        car.heading -
        ((Math.max(0, startCount - 120) * 16 + INTRO_SWING_LAG) * Math.PI * 2) /
          4096,
      pitch: car.pitch || 0,
      roll: car.roll || 0,
      distance: 0,
    };
    this.yaw = this.follow.yaw;
    // Start far enough out to take in the course around the grid.
    const reach = Math.max(
      ...track.nodes.map((p) => Math.hypot(p.x - car.x, p.z - car.z)),
    );
    this.introReach = Math.min(2400, Math.max(1100, reach * 0.9));
  }
  // The intro is the countdown camera run back in time: one spiral that
  // starts at rest high above the course and turns the same way as the
  // countdown swing, reaching its distance, pitch and turning rate exactly
  // when the countdown takes over.
  introRig(left: number) {
    const s = Math.max(0, left - 1),
      u = s / INTRO_FRAMES;
    return {
      yaw:
        this.follow.yaw -
        (INTRO_SWING_RATE * (s - (s * s) / (2 * INTRO_FRAMES)) * Math.PI * 2) /
          4096,
      pitch: -INTRO_PITCH * u * u,
      distance:
        s +
        (this.introReach - 35 - (this.countdown || 0) - INTRO_FRAMES) * u * u,
    };
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
      this.updateShip(this.ships[i], p, i === 0 ? input : p.active || {}, time);
    });
    if (state !== "falling" && !this.holdCamera) {
      if (this.yaw === null) this.updateCamera(car, this.countdown || 0);
      const intro =
        this.introLeft === null
          ? { yaw: 0, pitch: 0, distance: 0 }
          : this.introRig(this.introLeft);
      const menu = state === "menu",
        distance = menu
          ? 24
          : 35 +
            this.follow.distance /
              (this.replayView || this.finishCamera ? 100 : 400) +
            (this.countdown || 0) +
            intro.distance;
      const yaw = menu
        ? car.heading - 0.42
        : this.introLeft === null
          ? this.follow.yaw
          : intro.yaw;
      const pitch = menu
        ? -0.18
        : this.follow.pitch *
            (this.finishCamera ||
            (this.replayView && this.replayDirector.mode === 17)
              ? -1
              : 1) -
          (Math.trunc((4096 * 7) / 360) * Math.PI * 2) / 4096 +
          intro.pitch;
      const roll =
        menu || this.replayView || this.finishCamera ? 0 : this.follow.roll;
      // GsSetView2 is a view matrix: its translation must be inverted
      // through the entire pitch/yaw/roll basis, including the 850 Y offset.
      const rotation = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(pitch, -yaw, roll, "YXZ"),
      );
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(rotation);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
      this.camera.position
        .set(car.x, car.y, -car.z)
        .addScaledVector(up, menu ? 10 : 8.5)
        .addScaledVector(forward, -distance);
      this.camera.up.copy(up);
      this.camera.lookAt(this.camera.position.clone().add(forward));
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
  private machineScene = new THREE.Scene();
  private machineCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
  private machineBackdrop = new THREE.Scene();
  private machineBackdropCamera = new THREE.OrthographicCamera(
    -1,
    1,
    1,
    -1,
    0,
    1,
  );
  private machineCenter = new THREE.Vector3();
  private machineRadius = 1;
  private machineReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );

  private dimMenuDemo() {
    if (!this.machineBackdrop.children.length) {
      this.machineBackdrop.add(
        new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.MeshBasicMaterial({
            color: 0x00050d,
            transparent: true,
            opacity: 0.55,
            depthTest: false,
            depthWrite: false,
          }),
        ),
      );
    }
    this.renderer.autoClear = false;
    this.renderer.setViewport(0, 0, this.canvas.width, this.canvas.height);
    this.renderer.render(this.machineBackdrop, this.machineBackdropCamera);
    this.renderer.clearDepth();
  }
  private coursePreviewScene = new THREE.Scene();
  private coursePreviewGroup = new THREE.Group();
  private coursePreviewTrack: Track | null = null;
  private coursePreviewCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 10000);
  private coursePreviewRadius = 1;
  private coursePreviewTarget = new THREE.WebGLRenderTarget(1, 1, {
    samples: 4,
  });
  private coursePreviewComposite = new THREE.Scene();

  drawCoursePreview(track: Track, time: number) {
    if (!this.coursePreviewScene.children.length) {
      const light = new THREE.DirectionalLight(0xffffff, 1.5);
      light.position.set(-1, 3, 2);
      this.coursePreviewScene.add(new THREE.AmbientLight(0xffffff, 1.4), light);
    }
    if (this.coursePreviewTrack !== track) {
      this.clear(this.coursePreviewGroup);
      this.coursePreviewGroup.position.set(0, 0, 0);
      this.buildTrackGeometry(track, this.coursePreviewGroup, false);
      const bounds = new THREE.Box3().setFromObject(this.coursePreviewGroup);
      this.coursePreviewGroup.position
        .copy(bounds.getCenter(new THREE.Vector3()))
        .multiplyScalar(-1);
      this.coursePreviewRadius =
        bounds.getSize(new THREE.Vector3()).length() / 2;
      this.coursePreviewScene.add(this.coursePreviewGroup);
      this.coursePreviewTrack = track;
    }
    const width = this.canvas.width,
      height = this.canvas.height;
    const safeWidth = Math.min(width, (height * 16) / 9);
    const previewWidth = safeWidth * 0.43,
      previewHeight = height * 0.46;
    const camera = this.coursePreviewCamera;
    camera.aspect = previewWidth / previewHeight;
    camera.updateProjectionMatrix();
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const distance =
      this.coursePreviewRadius /
      Math.sin(Math.min(halfFov, Math.atan(Math.tan(halfFov) * camera.aspect)));
    // A race-sized near plane wastes depth precision at this overview scale,
    // making the road and its underside fight for the same depth values.
    camera.near = Math.max(0.1, distance - this.coursePreviewRadius * 1.1);
    camera.far = distance + this.coursePreviewRadius * 1.1;
    camera.updateProjectionMatrix();
    const angle = this.machineReducedMotion.matches ? 0.6 : 0.6 + time * 0.18;
    camera.position.set(
      Math.sin(angle) * distance * 0.75,
      distance * 0.66,
      Math.cos(angle) * distance * 0.75,
    );
    camera.lookAt(0, 0, 0);
    this.dimMenuDemo();
    // Resolve multisampled preview edges separately from the deliberately
    // pixelated race. Both passes reuse the existing WebGL context.
    const target = this.coursePreviewTarget;
    const targetWidth = Math.max(1, Math.round(previewWidth));
    const targetHeight = Math.max(1, Math.round(previewHeight));
    if (target.width !== targetWidth || target.height !== targetHeight)
      target.setSize(targetWidth, targetHeight);
    if (!this.coursePreviewComposite.children.length) {
      this.coursePreviewComposite.add(
        new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.MeshBasicMaterial({
            map: target.texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
          }),
        ),
      );
    }
    const clearColor = this.renderer.getClearColor(new THREE.Color());
    const clearAlpha = this.renderer.getClearAlpha();
    this.renderer.setRenderTarget(target);
    this.renderer.setViewport(0, 0, targetWidth, targetHeight);
    this.renderer.setClearColor(0, 0);
    this.renderer.clear();
    this.renderer.render(this.coursePreviewScene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(clearColor, clearAlpha);
    this.renderer.setViewport(
      (width - safeWidth) / 2 + safeWidth * 0.5,
      height * 0.36,
      previewWidth,
      previewHeight,
    );
    this.renderer.render(
      this.coursePreviewComposite,
      this.machineBackdropCamera,
    );
    this.renderer.setViewport(0, 0, width, height);
    this.renderer.autoClear = true;
  }
  // Composite over the running demo using the same WebGL context. The viewport
  // follows the DOM menu's centered 16:9 safe area, including ultrawide screens.
  drawMachinePreview(type: number, time: number) {
    if (!this.machineScene.children.length) {
      const light = new THREE.DirectionalLight(0xffffff, 1.5);
      light.position.set(-8, 12, -8);
      this.machineScene.add(new THREE.AmbientLight(0xffffff, 1.6), light);
    }
    const changed = this.menuShip?.type !== type;
    const ship = this.getMenuShip(type);
    ship.flames.forEach((m) => (m.visible = false));
    ship.sides.forEach((m) => (m.visible = false));
    if (changed || ship.root.parent !== this.machineScene) {
      ship.root.position.set(0, 0, 0);
      ship.root.rotation.set(0, 0, 0);
      // Hidden engine/power effects extend beyond the hull and must not shrink
      // the preview's framing.
      const bounds = new THREE.Box3().setFromObject(ship.hull);
      ship.rudders.forEach((rudder) => bounds.expandByObject(rudder));
      bounds.getCenter(this.machineCenter);
      this.machineRadius = bounds.getSize(new THREE.Vector3()).length() / 2;
      this.machineScene.add(ship.root);
    }
    const angle = this.machineReducedMotion.matches ? 0.6 : 0.6 + time * 0.18;
    ship.root.rotation.set(0, angle, 0);
    ship.root.position
      .copy(this.machineCenter)
      .multiplyScalar(-1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    const width = this.canvas.width,
      height = this.canvas.height;
    const safeWidth = Math.min(width, (height * 16) / 9);
    const previewWidth = safeWidth * 0.46,
      previewHeight = height * 0.34;
    this.machineCamera.aspect = previewWidth / previewHeight;
    this.machineCamera.updateProjectionMatrix();
    const halfFov = THREE.MathUtils.degToRad(this.machineCamera.fov / 2);
    const distance =
      this.machineRadius /
      Math.sin(
        Math.min(
          halfFov,
          Math.atan(Math.tan(halfFov) * this.machineCamera.aspect),
        ),
      );
    this.machineCamera.position.set(0, distance * 0.42, -distance * 0.91);
    this.machineCamera.lookAt(0, 0, 0);
    this.dimMenuDemo();
    this.renderer.setViewport(
      (width - safeWidth) / 2 + safeWidth * 0.5,
      height * 0.48,
      previewWidth,
      previewHeight,
    );
    this.renderer.render(this.machineScene, this.machineCamera);
    this.renderer.setViewport(0, 0, width, height);
    this.renderer.autoClear = true;
  }
  getMenuShip(type: number) {
    if (this.menuShip?.type !== type) {
      if (this.menuShip) {
        this.menuShip.root.removeFromParent();
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
    return this.menuShip;
  }
  drawMenu(screen: string, track: Track, type: number, time: number, age = 1) {
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
      const ship = this.getMenuShip(type);
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
