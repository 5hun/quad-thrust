// Source: src/renderer.ts. Build with npm run build; do not edit dist/renderer.js directly.
import * as THREE from "./vendor/three.module.js";
import { OriginalBackground } from "./background.js";
const E = window.HoverEngine;
const TILE = {
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
const THEMES = [0x202020, 0x787878, 0x404040, 0x282828, 0x060202].map((fog) => ({ fog }));
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
    renderer;
    scene;
    camera;
    trackGroup;
    cache;
    modelCache;
    loader;
    background;
    ships;
    track;
    yaw;
    follow = { yaw: 0, pitch: 0, roll: 0, distance: 0 };
    retro;
    frames;
    errors;
    canvas;
    countScene;
    countCamera;
    countDigits;
    skyGroup;
    countdown = null;
    retroUniform = { value: 1 };
    result = null;
    resultText = "";
    resultLetters = new THREE.Group();
    constructor(canvas) {
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
        this.countScene.add(this.resultLetters);
        this.skyGroup = new THREE.Group();
        this.scene.add(this.skyGroup);
    }
    texture(path) {
        if (!this.cache.has(path)) {
            const t = this.loader.load("assets/" + path);
            t.colorSpace = THREE.SRGBColorSpace;
            t.magFilter = THREE.NearestFilter;
            t.minFilter = THREE.NearestFilter;
            t.generateMipmaps = false;
            this.cache.set(path, t);
        }
        return this.cache.get(path);
    }
    // WebGL perspective interpolation is cancelled by carrying clip W with UV.
    // The 320x240 snap is applied only in RETRO, independent of canvas CSS size.
    sourceMaterial(material) {
        material.onBeforeCompile = (shader) => {
            shader.uniforms.sourceRetro = this.retroUniform;
            const header = "uniform float sourceRetro;\nvarying float sourceW;\n";
            shader.vertexShader =
                header +
                    shader.vertexShader.replace("#include <project_vertex>", `
        #include <project_vertex>
        sourceW = mix(1.0, gl_Position.w, sourceRetro);
        #ifdef USE_MAP
          vMapUv *= sourceW;
        #endif
        if (sourceRetro > 0.5 && gl_Position.w > 0.0) {
          vec2 pixel = gl_Position.xy / gl_Position.w * vec2(160.0, 120.0);
          gl_Position.xy = floor(pixel + 0.5) / vec2(160.0, 120.0) * gl_Position.w;
        }
      `);
            shader.fragmentShader =
                header +
                    shader.fragmentShader
                        .replace("#include <map_fragment>", THREE.ShaderChunk.map_fragment.replace("vMapUv", "(vMapUv / sourceW)"))
                        .replace("#include <dithering_fragment>", `
          #include <dithering_fragment>
          if (sourceRetro > 0.5) gl_FragColor.rgb = floor(clamp(gl_FragColor.rgb, 0.0, 1.0) * 31.0 + 0.5) / 31.0;
        `);
        };
        material.customProgramCacheKey = () => "hover-source-raster-v1";
        return material;
    }
    resize() {
        const r = this.canvas.getBoundingClientRect();
        const h = this.retro ? 240 : Math.min(1080, Math.round(r.height));
        this.renderer.setSize(Math.round((h * r.width) / r.height), h, false);
        this.camera.aspect = r.width / r.height;
        this.camera.updateProjectionMatrix();
    }
    clear(group) {
        group.traverse((o) => {
            if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
                if (o instanceof THREE.Mesh)
                    o.geometry.dispose();
                if (Array.isArray(o.material))
                    o.material.forEach((m) => m.dispose());
                else {
                    if (o.material.map?.userData.disposeWithMesh)
                        o.material.map.dispose();
                    o.material.dispose();
                }
            }
        });
        group.clear();
    }
    setTrack(track) {
        if (this.track === track)
            return;
        this.track = track;
        this.clear(this.trackGroup);
        this.clear(this.skyGroup);
        const theme = THEMES[track.theme];
        this.scene.background = null;
        this.scene.fog = new THREE.Fog(theme.fog, 700, 2300);
        const buffers = new Map();
        const add = (a, b, c, d, t) => {
            const bucket = buffers.get(t) || { p: [], uv: [] };
            buffers.set(t, bucket);
            const points = [a, b, c, d], uvs = [
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
        const boundary = (p, row, ys) => {
            const l = p.l, r = p.r, w = Math.hypot(r[0] - l[0], r[2] - l[2]), dx = (r[0] - l[0]) / w, dz = (r[2] - l[2]) / w;
            if (row === 0)
                return [l[0] - dx * 10.24, l[1] - 2.56, l[2] - dz * 10.24];
            if (row === 1)
                return [l[0], l[1] + 5.12, l[2]];
            if (row === ys - 1)
                return [r[0], r[1] + 5.12, r[2]];
            if (row === ys)
                return [r[0] + dx * 10.24, r[1] - 2.56, r[2] + dz * 10.24];
            const t = (row - 2) / (ys - 4);
            return l.map((x, i) => E.mix(x, r[i], t));
        };
        for (let i = 0; i < track.nodes.length; i++) {
            const p = track.nodes[i], q = p.end || track.nodes[(i + 1) % track.nodes.length], tiles = p.allTiles, ys = tiles.length;
            for (let row = 0; row < ys; row++)
                add(boundary(p, row, ys), boundary(q, row, ys), boundary(p, row + 1, ys), boundary(q, row + 1, ys), TILE[tiles[row]] ?? 0);
        }
        for (const [tile, data] of buffers) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.p, 3));
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
    modelObject(name, index, ghost = false) {
        const group = new THREE.Group();
        const data = window.HOVER_MODELS[name][index];
        for (const [material, attrs] of Object.entries(data)) {
            const geometry = new THREE.BufferGeometry();
            for (const [key, size] of [
                ["position", 3],
                ["normal", 3],
                ["color", 3],
                ["uv", 2],
            ]) {
                const a = attrs[key].slice();
                if (key === "position" || key === "normal")
                    for (let j = 2; j < a.length; j += 3)
                        a[j] *= -1;
                geometry.setAttribute(key, new THREE.Float32BufferAttribute(a, size));
            }
            const [textureName, semi] = material.split("|");
            const fx = name === "OTHER" ||
                (name !== "YAKA_MAN" &&
                    !name.startsWith("ALP_") &&
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
            this.sourceMaterial(mat);
            if (ghost) {
                mat.color.set(0x70edff);
                if (mat instanceof THREE.MeshLambertMaterial)
                    mat.emissive.set(0x194251);
            }
            group.add(new THREE.Mesh(geometry, mat));
        }
        return group;
    }
    makeShip(type, ghost = false) {
        const name = E.MACHINES[type].model, root = new THREE.Group(), body = new THREE.Group();
        root.add(body);
        let flames = [], sides = [], rudders = [];
        const limbs = [];
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
                hand.position.y = -1.3056;
                fore.add(hand);
                body.add(arm);
                const leg = new THREE.Group();
                leg.position.set(s * 0.489, -2.4472, -0.0555);
                leg.add(this.modelObject(name, 3, ghost));
                const knee = this.modelObject(name, 4, ghost);
                knee.position.y = -2.265;
                leg.add(knee);
                const foot = this.modelObject(name, 8, ghost);
                foot.position.y = -1.815;
                knee.add(foot);
                body.add(leg);
                limbs.push({ arm, fore, leg, knee, foot, s });
            }
            body.position.y = 4.5;
        }
        else {
            body.add(this.modelObject(name, 0, ghost));
            const mounts = MOUNTS[type], mount = (index, p) => {
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
        let shadow;
        if (type !== 5) {
            shadow = this.modelObject(name, 4, false);
            shadow.traverse((o) => {
                if (o instanceof THREE.Mesh) {
                    o.material.dispose();
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
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                opacity: 0.5,
                // DRAW_SP.C draw_bomb submits screen-space sprites at OT depth 0.
                // Ship and road depth must never occlude this overlay.
                depthTest: false,
                depthWrite: false,
            }));
            sprite.visible = false;
            sprite.renderOrder = 100;
            root.add(sprite);
            return sprite;
        });
        const power = this.modelObject("OTHER", 0);
        body.add(power);
        power.visible = false;
        this.scene.add(root);
        const debris = new THREE.InstancedMesh(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([-0.16, 0, 0, 0.16, 0, 0, 0, 0.3, 0], 3)), new THREE.MeshBasicMaterial({ color: 0xb0b0b0, side: THREE.DoubleSide }), 64);
        debris.count = 0;
        debris.frustumCulled = false;
        root.add(debris);
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
            debris,
            motionFrame: 0,
            motionTick: -1,
        };
    }
    updateShip(ship, p, input, time) {
        ship.root.visible = true;
        const tick = p.ticks ?? Math.floor(time * 60);
        const explosion = p.explosionFrames;
        // Original over counts down from 300; car_draw hides the last 120 ticks.
        ship.body.visible = explosion === undefined || explosion <= 180;
        ship.explosions.forEach((s, i) => {
            const t = p.explosionFrames ?? Infinity;
            s.visible = Number.isFinite(t) && t < 300;
            if (s.visible) {
                const phase = (t + i * 2) % 8;
                const cycle = Math.floor((t + i * 2) / 8);
                let seed = (Math.imul(cycle + 1, 1664525) + i * 1013904223) >>> 0;
                const rand = () => {
                    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                    return seed;
                };
                const scale = (rand() & 8191) + 4096;
                s.material.map.offset.set(Math.floor(phase / 4) * 0.5, 1 - ((phase % 4) + 1) * 0.25);
                s.position.set(((rand() & 31) - 16) * 0.08, ((rand() & 31) - 16) * 0.08, 0);
                s.scale.setScalar((32 * scale) / 51200);
            }
        });
        ship.root.position.set(p.x, p.y, -p.z);
        ship.root.rotation.set(0, -p.heading, 0);
        ship.body.rotation.set(p.pitch || 0, 0, p.roll || 0);
        for (const g of ship.rudders)
            g.rotation.y = (-(p.rudderAngle || 0) * Math.PI * 2) / 4096;
        const size = (input.accel || p.turbo ? 64 : p.fireTail || 0) + (p.turbo ? 16 : 0);
        for (const g of ship.flames) {
            g.visible = size > 0 && (tick & 1) === 0;
            g.scale.setScalar(size / 64);
            g.rotation.z = (-Math.floor(tick / 2) * 165 * Math.PI * 2) / 4096;
            g.traverse((o) => {
                if (o instanceof THREE.Mesh) {
                    o.material.transparent = !!p.turbo;
                    o.material.opacity = p.turbo ? 0.5 : 1;
                }
            });
        }
        const effect = p.repairFrames || 0;
        ship.power.visible = effect > 0;
        ship.power.scale.setScalar(Math.max(0, effect - 1) / 16);
        ship.power.rotation.y = (-(effect - 1) * Math.PI) / 4;
        const names = ["l1", "l2", "r1", "r2"];
        ship.sides.forEach((g, i) => {
            g.visible = !!input[names[i]] && (tick & 1) === 1;
            g.rotation.x = (-tick * 165 * Math.PI * 2) / 4096;
        });
        if (ship.motionTick !== tick) {
            const elapsed = ship.motionTick < 0 ? 0 : Math.max(0, tick - ship.motionTick);
            ship.motionFrame += elapsed * (((p.sourceSpeed || 0) >> 7) + 1);
            ship.motionTick = tick;
        }
        // OMAKE.C DASH tables and cap_work's four-way integer interpolation.
        const arm0 = [25, 30, 58, 74, 68, 39, 24, -7, -9, -11, -21];
        const arm1 = [-57, -46, -8, -4, -8, -25, -54, -89, -100, -86, -59];
        const foot0 = [0, 0, 19, 20, 11, -9, -30, -42, -36, -22, -14];
        const foot1 = [27, 37, 34, 51, 79, 83, 87, 45, 14, -1, 10];
        const motion = (a, frame, parent) => {
            const f = frame % 44, j = Math.floor(f / 4), k = (j + 1) % 11;
            const value = Math.trunc(-((a[j] - (parent?.[j] || 0)) * 4096 * (4 - (f % 4)) +
                (a[k] - (parent?.[k] || 0)) * 4096 * ((f % 4) + 1)) /
                4 /
                360);
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
        const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
        ship.debris.count = Math.min(64, p.debris?.length || 0);
        for (let i = 0; i < ship.debris.count; i++) {
            const d = p.debris[i];
            rotation.setFromEuler(new THREE.Euler((48 - d.life) * 0.7, d.seed % 8, (48 - d.life) * 0.4));
            matrix.compose(new THREE.Vector3(d.x, d.y, -d.z), rotation, new THREE.Vector3(1, 1, 1));
            ship.debris.setMatrixAt(i, matrix.premultiply(inverse));
        }
        ship.debris.instanceMatrix.needsUpdate = true;
    }
    updateCamera(car, startCount = 0) {
        if (this.yaw === null) {
            this.follow = {
                yaw: startCount > 0 ? 0 : car.heading,
                pitch: startCount > 0 ? 0 : car.pitch || 0,
                roll: startCount > 0 ? 0 : car.roll || 0,
                distance: 0,
            };
        }
        E.cameraStep(this.follow, car, startCount);
        this.yaw = this.follow.yaw;
    }
    draw(track, car, bots, state, time, input, ghost = null) {
        this.setTrack(track);
        this.retroUniform.value = this.retro ? 1 : 0;
        const racers = [car, ...bots, ...(ghost ? [ghost] : [])];
        while (this.ships.length > racers.length) {
            const s = this.ships.pop();
            this.scene.remove(s.root);
            if (s.shadow)
                this.scene.remove(s.shadow);
            this.clear(s.root);
            if (s.shadow)
                this.clear(s.shadow);
        }
        racers.forEach((p, i) => {
            const g = i === racers.length - 1 && !!ghost;
            if (!this.ships[i] ||
                this.ships[i].type !== p.type ||
                this.ships[i].ghost !== g) {
                if (this.ships[i]) {
                    const old = this.ships[i];
                    this.scene.remove(old.root);
                    if (old.shadow)
                        this.scene.remove(old.shadow);
                    this.clear(old.root);
                    if (old.shadow)
                        this.clear(old.shadow);
                }
                this.ships[i] = this.makeShip(p.type, g);
            }
            this.updateShip(this.ships[i], p, i === 0 ? input : p.active || { accel: true }, time);
        });
        if (this.yaw === null)
            this.updateCamera(car, this.countdown || 0);
        const menu = state === "menu", distance = menu
            ? 24
            : 35 + this.follow.distance / 400 + (this.countdown || 0);
        const yaw = menu ? car.heading - 0.42 : this.follow.yaw, sy = Math.sin(yaw), cy = Math.cos(yaw);
        this.camera.position.set(car.x - sy * distance, car.y + (menu ? 10 : 8.5), -car.z + cy * distance);
        const pitch = menu
            ? -0.18
            : this.follow.pitch - (Math.trunc((4096 * 7) / 360) * Math.PI * 2) / 4096;
        const roll = menu ? 0 : this.follow.roll;
        this.camera.up.set(-Math.cos(yaw) * Math.sin(roll), Math.cos(roll), Math.sin(yaw) * Math.sin(roll));
        this.camera.lookAt(car.x + sy * 30, car.y + 8.5 + Math.tan(pitch) * (distance + 30), -car.z - cy * 30);
        this.skyGroup.position.set(car.x, 0, -car.z);
        this.renderer.autoClear = true;
        this.background.draw(this.renderer, this.camera, track.theme, time);
        this.renderer.autoClear = false;
        this.renderer.clearDepth();
        this.renderer.render(this.scene, this.camera);
        this.renderer.autoClear = true;
        this.resultLetters.visible = !!this.result;
        if (this.countdown !== null && this.countdown !== undefined) {
            const n = this.countdown;
            let i = Math.floor(n / 60);
            const j = n % 60;
            if (i < 4) {
                if (j <= 20 && i !== 0)
                    i--;
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
                    this.resultLetters.add(this.modelObject(first === "A" ? "ALP_A_O" : "ALP_P_O", ch.charCodeAt(0) - first.charCodeAt(0)));
                }
            }
            this.countDigits.forEach((m) => (m.visible = false));
            this.resultLetters.visible = true;
            // TRAINIG.C: one character every 8 ticks, Z 8000 -> 6000 by 200,
            // Y rotation 4096/5 per tick while approaching the final position.
            this.resultLetters.children.forEach((m, i) => {
                const age = frame - (i + 1) * 8;
                const steps = Math.min(10, Math.max(0, age + 1));
                m.visible = age >= 0;
                m.position.set((i - (text.length - 1) / 2) * 6, 0, -80 + steps * 2);
                m.rotation.y = (-steps * 819 * Math.PI * 2) / 4096;
            });
            this.renderer.autoClear = false;
            this.renderer.clearDepth();
            this.renderer.render(this.countScene, this.countCamera);
            this.renderer.autoClear = true;
        }
        else
            this.resultLetters.visible = false;
    }
    // Dedicated black-background selection pass. Reuse original TMD letters and
    // the actual course mesh instead of a browser illustration of the course.
    menuScene = new THREE.Scene();
    menuLetters = new THREE.Group();
    menuHeading = "";
    menuShip = null;
    menuCamera = new THREE.PerspectiveCamera((2 * Math.atan(120 / 320) * 180) / Math.PI, 4 / 3, 0.1, 10000);
    drawMenu(screen, track, type, time, age = 1) {
        this.retroUniform.value = this.retro ? 1 : 0;
        if (this.menuScene.children.length === 0) {
            this.menuScene.background = new THREE.Color(0);
            this.menuScene.add(new THREE.AmbientLight(0xffffff, 1.6));
            const light = new THREE.DirectionalLight(0xffffff, 1.5);
            light.position.set(0, 256, 128);
            this.menuScene.add(light, this.menuLetters);
        }
        const heading = screen === "car"
            ? "CARSELECT"
            : screen === "course"
                ? "COURCESELECT"
                : "";
        if (heading !== this.menuHeading) {
            this.clear(this.menuLetters);
            this.menuHeading = heading;
            [...heading].forEach((ch, i) => {
                const first = ch <= "O" ? "A" : "P";
                const letter = this.modelObject(first === "A" ? "ALP_A_O" : "ALP_P_O", ch.charCodeAt(0) - first.charCodeAt(0));
                letter.position.set(-37.5 + i * 5.6 + (i > (screen === "car" ? 2 : 5) ? 5.6 : 0), 25.5, -90);
                this.menuLetters.add(letter);
            });
        }
        const entryFrame = Math.min(0, Math.floor(age * 60) - 60);
        this.menuLetters.children.forEach((letter, i) => {
            const count = heading.length;
            const lag = Math.max(0, -entryFrame * (screen === "car" ? 4 : 6) +
                (count - i) * 12 -
                (screen === "car" ? 120 : 156));
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
                if (this.menuShip.shadow)
                    this.scene.remove(this.menuShip.shadow);
            }
            const ship = this.menuShip;
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
        }
        else if (screen === "course") {
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
            drawCalls: this.renderer.info.render.calls,
            triangles: this.renderer.info.render.triangles,
            geometries: this.renderer.info.memory.geometries,
            textures: this.renderer.info.memory.textures,
            assetErrors: this.errors,
        };
    }
}
