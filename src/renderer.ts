// Source: src/renderer.ts. Build with npm run build; do not edit dist/renderer.js directly.
import * as THREE from "./vendor/three.module.js";
import { OriginalBackground } from "./background.js";
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
  errors: string[];
  canvas: HTMLCanvasElement;
  countScene: THREE.Scene;
  countCamera: THREE.PerspectiveCamera;
  countDigits: THREE.Group[];
  skyGroup: THREE.Group;
  countdown: number | null = null;

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
    this.camera = new THREE.PerspectiveCamera(42, 4 / 3, 0.15, 6000);
    this.trackGroup = new THREE.Group();
    this.scene.add(this.trackGroup);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const light = new THREE.DirectionalLight(0xffffff, 1.5);
    light.position.set(-100, 180, 100);
    this.scene.add(light);
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
    this.scene.fog = new THREE.Fog(theme.fog, 700, 2300);
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
      this.trackGroup.add(new THREE.Mesh(geometry, mat));
    }
    this.yaw = null;
  }
  modelObject(name: string, index: number, ghost = false) {
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
        (!["YAKA_MAN", "ALP_0_9"].includes(name) &&
          (index === 2 || index === 3));
      const Material = fx ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
      const mat = new Material({
        map: textureName === "solid" ? null : this.texture(textureName),
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: ghost || !!semi,
        opacity: ghost ? 0.28 : semi ? 0.5 : 1,
        depthWrite: !ghost && !semi,
        alphaTest: 0.01,
      });
      if (ghost) {
        mat.color.set(0x70edff);
        if (mat instanceof THREE.MeshLambertMaterial)
          mat.emissive.set(0x194251);
      }
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
    const limbs: { arm: THREE.Group; leg: THREE.Group; s: number }[] = [];
    if (type === 5) {
      const torso = this.modelObject(name, 2, ghost);
      body.add(torso);
      body.add(this.modelObject(name, 6, ghost));
      for (const s of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(s * 1.2675, -0.6104, 0);
        arm.add(this.modelObject(name, 0, ghost));
        const fore = this.modelObject(name, 1, ghost);
        fore.position.y = -1.05;
        arm.add(fore);
        const hand = this.modelObject(name, 5, ghost);
        hand.position.y = -2.3556;
        arm.add(hand);
        body.add(arm);
        const leg = new THREE.Group();
        leg.position.set(s * 0.489, -2.4472, -0.0555);
        leg.add(this.modelObject(name, 3, ghost));
        const knee = this.modelObject(name, 4, ghost);
        knee.position.y = -2.265;
        leg.add(knee);
        const foot = this.modelObject(name, 8, ghost);
        foot.position.y = -4.08;
        leg.add(foot);
        body.add(leg);
        limbs.push({ arm, leg, s });
      }
      body.position.y = 4.5;
    } else {
      body.add(this.modelObject(name, 0, ghost));
      const mounts = MOUNTS[type],
        mount = (index: number, p: Vec3) => {
          const g = this.modelObject(name, index, ghost);
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
          opacity: 0.65,
          depthWrite: false,
        }),
      );
      sprite.visible = false;
      root.add(sprite);
      return sprite;
    });
    const power = this.modelObject("OTHER", 0);
    body.add(power);
    power.visible = false;
    this.scene.add(root);
    return {
      type,
      root,
      body,
      flames,
      sides,
      rudders,
      limbs,
      shadow,
      ghost,
      power,
      explosions,
    };
  }
  updateShip(
    ship: ReturnType<HoverRenderer["makeShip"]>,
    p: Pose,
    input: Input,
    time: number,
  ) {
    ship.root.visible = true;
    ship.explosions.forEach((s, i) => {
      const t = p.explosionFrames ?? Infinity;
      s.visible = Number.isFinite(t) && t < 300;
      if (s.visible) {
        const phase = (t + i * 2) % 8;
        s.material.map!.offset.set(
          Math.floor(phase / 4) * 0.5,
          1 - ((phase % 4) + 1) * 0.25,
        );
        s.position.set(
          Math.sin(i * 3.7 + Math.floor(t / 8)) * 2,
          Math.cos(i * 5 + Math.floor(t / 8)) * 2,
          0,
        );
        s.scale.setScalar(7 + i * 2);
      }
    });
    ship.root.position.set(p.x, p.y, -p.z);
    ship.root.rotation.set(0, -p.heading, 0);
    ship.body.rotation.set(p.pitch || 0, 0, p.roll || 0);
    for (const g of ship.rudders)
      g.rotation.y = (-(p.rudderAngle || 0) * Math.PI * 2) / 4096;
    const tick = p.ticks ?? Math.floor(time * 60);
    const size =
      (input.accel || p.turbo ? 64 : p.fireTail || 0) + (p.turbo ? 16 : 0);
    for (const g of ship.flames) {
      g.visible = size > 0 && (tick & 1) === 0;
      g.scale.setScalar(size / 64);
      g.rotation.z = (-Math.floor(tick / 2) * 165 * Math.PI * 2) / 4096;
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          (o.material as THREE.Material).transparent = !!p.turbo;
          (o.material as THREE.Material).opacity = p.turbo ? 0.5 : 1;
        }
      });
    }
    const effect = p.repairFrames || 0;
    ship.power.visible = effect > 0;
    ship.power.scale.setScalar(Math.max(0, effect - 1) / 16);
    ship.power.rotation.y = (-(effect - 1) * Math.PI) / 4;
    const names: (keyof Input)[] = ["l1", "l2", "r1", "r2"];
    ship.sides.forEach((g, i) => {
      g.visible = !!input[names[i]] && (tick & 1) === 1;
      g.rotation.x = (-tick * 165 * Math.PI * 2) / 4096;
    });
    ship.limbs.forEach(({ arm, leg, s }) => {
      const phase = time * ((p.sourceSpeed ?? 0) > 40 ? 12 : 3);
      arm.rotation.x = Math.sin(phase) * s * 0.6;
      leg.rotation.x = -Math.sin(phase) * s * 0.6;
    });
    if (ship.shadow) {
      ship.shadow.visible = p.y - (p.groundY ?? p.y - 2) < 20;
      ship.shadow.position.set(p.x, (p.groundY ?? p.y - 2) + 0.06, -p.z);
      ship.shadow.rotation.set(0, -p.heading, 0);
    }
  }
  updateCamera(car: Pose) {
    if (this.yaw === null) {
      this.follow = {
        yaw: car.heading,
        pitch: car.pitch || 0,
        roll: car.roll || 0,
        distance: 0,
      };
    }
    E.cameraStep(this.follow, car);
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
    if (this.yaw === null) this.updateCamera(car);
    const menu = state === "menu",
      distance = menu ? 24 : 35 + this.follow.distance / 400;
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
      : this.follow.pitch - (Math.trunc((4096 * 7) / 360) * Math.PI * 2) / 4096;
    const roll = menu ? 0 : this.follow.roll;
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
    this.skyGroup.position.set(car.x, 0, -car.z);
    this.renderer.autoClear = true;
    this.background.draw(this.renderer, this.camera, track.theme, time);
    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
    this.renderer.autoClear = true;
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
  }
  diagnostics() {
    return {
      renderer: "Three.js " + THREE.REVISION,
      backgroundTheme: this.background.theme,
      groundBands: this.background.ground.length,
      searchlights: this.background.beams.length,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      assetErrors: this.errors,
    };
  }
}
