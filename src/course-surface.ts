// Source: src/course-surface.ts. Build with npm run build; do not edit dist/course-surface.js directly.
// Modern course surface: continuous world-space UVs, CC0 textures
// (public/assets/course, see CREDITS.md) and shader-painted tile markings.
// Visual only; collision still uses the engine's own track data.
import * as THREE from "./vendor/three.module.js";
const E = window.HoverEngine;

// Tile codes to marking kinds; floor kinds match the source renderer.
const KIND: Record<string, number> = {
  ".": 0,
  s: 0,
  "*": 1,
  ">": 2,
  g: 3,
  d: 4,
  J: 5,
  P: 6,
  // Inner banks and outer walls; their source colours are not used.
  "&": 16,
  "+": 16,
  "%": 16,
  "#": 16,
  Y: 17,
  "?": 17,
  T: 17,
  E: 17,
};
// Texture repeat length in world units.
const PANEL = 40;
// Per theme: reflection sky [top, horizon], key light colour and direction.
const LOOK = [
  { sky: [0x0a1426, 0x2a3850], key: 0x8fa4c8, dir: [0.4, 0.55, 0.3] },
  { sky: [0x6f8fb8, 0xd0d8e0], key: 0xfff0dc, dir: [0.3, 0.8, 0.4] },
  { sky: [0x1c2430, 0x5a6472], key: 0xc8ccd4, dir: [-0.3, 0.7, 0.4] },
  { sky: [0x141a24, 0x3a4250], key: 0x9aa8c0, dir: [0.5, 0.6, -0.2] },
  { sky: [0x180808, 0x6a3020], key: 0xffa070, dir: [-0.8, 0.35, 0.3] },
];

// Shared GLSL: anti-aliased bands.
const HELPERS = `
varying vec2 vCell;
varying float vKind;
varying float vLane;
varying float vStripe;
varying vec2 vSize;
varying vec2 vPanel;
vec3 courseGlow;
float courseRough;
float bandW(float x, float a, float b, float w) {
  return smoothstep(a - w, a + w, x) - smoothstep(b - w, b + w, x);
}
float band(float x, float a, float b) { return bandW(x, a, b, fwidth(x) * 1.2); }
// band() over fract(x): the edge width comes from the unwrapped x, since
// fwidth jumps where fract wraps and would draw a thin false line there.
float bandFract(float x, float a, float b) {
  return bandW(fract(x), a, b, fwidth(x) * 1.2);
}
`;

// Clean near-future plating with lit tile markings.
const PAINT = `
{
  int k = int(vKind + 0.5);
  vec2 c = vCell;
  // Along-track position in cell widths, so patterns keep their shape
  // whatever the cell's length.
  vec2 sq = vec2(c.x, c.y * vSize.y / vSize.x);
  vec3 paint = vec3(0.0);
  float cover = 0.0;
  vec3 light = vec3(0.0);
  float lit = 0.0;
  const vec3 white = vec3(0.85), amber = vec3(1.0, 0.62, 0.12), blue = vec3(0.15, 0.55, 1.0), cyan = vec3(0.35, 0.9, 1.0), black = vec3(0.03), green = vec3(0.3, 1.0, 0.4), magenta = vec3(1.0, 0.15, 0.55), violet = vec3(0.6, 0.35, 1.0);
  if (k < 16) {
    if (k == 0) {
      // Low-contrast bands, one tile long, on every other tile: they sweep
      // past the camera and give the plain deck a sense of speed.
      float sp = step(0.5, vStripe);
      paint = vec3(0.30, 0.32, 0.36); cover = sp * 0.07;
    } else if (k == 1) {
      // Slow floor: violet rings on a dark pad, three across each cell
      // (the source tile is a grid of studs).
      // fwidth(d) spikes at the cell wrap; the clamp keeps rings crisp.
      float d = length(fract(sq * 3.0) - 0.5);
      paint = vec3(0.07, 0.05, 0.10); cover = 0.9;
      light = violet; lit = bandW(d, 0.22, 0.34, min(fwidth(d), 0.05) * 1.2);
      courseRough = 1.3;
    } else if (k == 2) {
      // Forward chevrons sweeping along the cell.
      float y = sq.y + abs(c.x - 0.5) * 0.9 - courseTime * 1.0;
      float chev = bandFract(y, 0.2, 0.5);
      paint = vec3(0.08); cover = 0.9;
      light = amber; lit = chev;
    } else if (k == 3) {
      vec2 g = floor(c * 4.0);
      paint = mix(black, white, mod(g.x + g.y, 2.0)); cover = 1.0;
    } else if (k == 4) {
      // Track-space stripes, so neighbouring cells join into one pattern.
      float s = bandFract((vPanel.x + vPanel.y) * 5.0, 0.25, 0.75);
      paint = mix(vec3(0.06), vec3(0.18, 0.04, 0.12), s); cover = 0.9;
      light = magenta; lit = s * (0.6 + 0.4 * sin(courseTime * 6.0));
    } else if (k == 5) {
      vec2 q = abs(c - 0.5) * vSize / min(vSize.x, vSize.y);
      float ring = band(max(q.x, q.y), 0.36, 0.44);
      float arrow = band(c.y + abs(c.x - 0.5) * 1.2, 0.45, 0.62) * band(c.x, 0.2, 0.8);
      paint = vec3(0.08); cover = 0.85;
      light = cyan; lit = max(ring, arrow);
    } else if (k == 6) {
      vec2 q = abs(c - 0.5) * vSize / min(vSize.x, vSize.y);
      float plus = max(band(q.x, -1.0, 0.08) * band(q.y, -1.0, 0.3), band(q.y, -1.0, 0.08) * band(q.x, -1.0, 0.3));
      paint = vec3(0.06, 0.12, 0.08); cover = 0.9;
      light = green; lit = plus;
    }
  } else {
    // Banks and walls: painted panels with one blue light strip.
    bool outer = k == 17;
    // Regular panels, one per tile: tones alternate faintly like the deck
    // bands, with a thin dark seam where tiles meet.
    float sw = fwidth(c.y);
    float seam = 1.0 - smoothstep(sw, 2.0 * sw, min(c.y, 1.0 - c.y));
    paint = mix(vec3(0.25, 0.27, 0.31), vec3(0.28, 0.30, 0.34), step(0.5, vStripe));
    paint *= 1.0 - 0.15 * seam;
    cover = 0.7;
    // Rows run left to right, so the right-hand bank and wall are
    // mirrored; flip them to match the left side.
    float x = vLane > 0.5 ? 1.0 - c.x : c.x;
    float strip = outer ? band(x, 0.42, 0.56) : band(x, 0.82, 0.94);
    light = blue; lit = strip;
    if (outer) diffuseColor.rgb *= mix(0.45, 1.0, x);
  }
  diffuseColor.rgb = mix(diffuseColor.rgb * 0.75, paint * 2.2, cover);
  // Diffuser: a dim lit body.
  courseGlow = light * lit * 1.8;
  diffuseColor.rgb = mix(diffuseColor.rgb, light * 0.25, min(lit, 1.0) * 0.5);
}
`;

type Buffers = {
  p: number[];
  uv: number[];
  cell: number[];
  kind: number[];
  lane: number[];
  stripe: number[];
  size: number[];
};
const buffers = (): Buffers => ({
  p: [],
  uv: [],
  cell: [],
  kind: [],
  lane: [],
  stripe: [],
  size: [],
});

export class CourseSurface {
  // Seconds of world time, for marking animations.
  time = { value: 0 };
  private textures = new Map<string, THREE.Texture>();
  constructor(private renderer: THREE.WebGLRenderer) {}

  private texture(name: string, color = false) {
    if (!this.textures.has(name)) {
      const t = new THREE.TextureLoader().load("assets/course/" + name);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
      if (color) t.colorSpace = THREE.SRGBColorSpace;
      this.textures.set(name, t);
    }
    return this.textures.get(name)!;
  }

  build(
    track: Track,
    group: THREE.Group,
    fog: number,
    lights: { ambient: THREE.Color; sun: THREE.DirectionalLight },
  ) {
    const road = buffers(),
      wall = buffers(),
      under = buffers();
    const boundary = E.boundaryVertex;
    const n = track.nodes.length;
    // Distance along the centre line, so textures stay square on curves.
    const along = [0];
    for (let i = 0; i < n; i++) {
      const p = track.nodes[i],
        q = p.end || track.nodes[(i + 1) % n],
        ys = p.allTiles.length;
      const mid = (v: RawBoundary) => {
        const a = boundary(v, 1, ys),
          b = boundary(v, ys - 1, ys);
        return a.map((x, k) => (x + b[k]) / 2);
      };
      const a = mid(p),
        b = mid(q);
      along.push(along[i] + Math.hypot(...a.map((x, k) => b[k] - x)));
    }
    const push = (
      out: Buffers,
      pts: Vec3[],
      uvs: number[][],
      kind = 0,
      lanes = [0, 0],
      stripe = 0,
    ) => {
      for (const i of [0, 2, 1, 2, 3, 1]) {
        out.p.push(pts[i][0], pts[i][1], -pts[i][2]);
        out.uv.push(uvs[i][0], uvs[i][1]);
        out.cell.push(i >= 2 ? 1 : 0, i & 1);
        out.kind.push(kind);
        out.lane.push(lanes[i >= 2 ? 1 : 0]);
        out.stripe.push(stripe);
        // Cell extent in texture units, so markings can stay square.
        out.size.push(uvs[2][0] - uvs[0][0] || 1, uvs[1][1] - uvs[0][1] || 1);
      }
    };
    for (let i = 0; i < n; i++) {
      const p = track.nodes[i],
        q = p.end || track.nodes[(i + 1) % n],
        tiles = p.allTiles,
        ys = tiles.length,
        v0 = along[i] / PANEL,
        v1 = along[i + 1] / PANEL;
      // Across-track coordinate per vertex, measured from the road's left
      // edge at that vertex's own node, so it matches the neighbouring
      // quads even where curves or banks change the row widths.
      const across = (v: RawBoundary) => {
        const u = [0];
        for (let row = 0; row < ys; row++) {
          const a = boundary(v, row, ys),
            c = boundary(v, row + 1, ys);
          u.push(u[row] + Math.hypot(...a.map((x, k) => c[k] - x)) / PANEL);
        }
        return u.map((x) => x - u[2]);
      };
      const up = across(p),
        uq = across(q);
      for (let row = 0; row < ys; row++) {
        const kind = KIND[tiles[row]] ?? 0;
        push(
          kind >= 16 ? wall : road,
          [
            boundary(p, row, ys),
            boundary(q, row, ys),
            boundary(p, row + 1, ys),
            boundary(q, row + 1, ys),
          ],
          [
            [up[row], v0],
            [uq[row], v1],
            [up[row + 1], v0],
            [uq[row + 1], v1],
          ],
          kind,
          [(row - 2) / (ys - 4), (row - 1) / (ys - 4)],
          i & 1,
        );
      }
      // V-shaped underside from MAKEMAP.C, steel plated.
      const bottom = (v: RawBoundary) => boundary(v, ys + 1, ys);
      const u0 = up[ys] - up[0],
        w = u0 / 2;
      push(
        under,
        [boundary(p, 0, ys), boundary(q, 0, ys), bottom(p), bottom(q)],
        [
          [0, v0],
          [0, v1],
          [w, v0],
          [w, v1],
        ],
      );
      push(
        under,
        [bottom(p), bottom(q), boundary(p, ys, ys), boundary(q, ys, ys)],
        [
          [w, v0],
          [w, v1],
          [u0, v0],
          [u0, v1],
        ],
      );
    }
    const look = LOOK[track.theme];
    const mesh = (data: Buffers, material: THREE.Material) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(data.p, 3),
      );
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uv, 2));
      geometry.setAttribute(
        "cell",
        new THREE.Float32BufferAttribute(data.cell, 2),
      );
      geometry.setAttribute(
        "kind",
        new THREE.Float32BufferAttribute(data.kind, 1),
      );
      geometry.setAttribute(
        "lane",
        new THREE.Float32BufferAttribute(data.lane, 1),
      );
      geometry.setAttribute(
        "stripe",
        new THREE.Float32BufferAttribute(data.stripe, 1),
      );
      geometry.setAttribute(
        "size",
        new THREE.Float32BufferAttribute(data.size, 2),
      );
      geometry.computeVertexNormals();
      group.add(new THREE.Mesh(geometry, material));
    };
    const material = (
      name: string,
      metalness: number,
      roughness: number,
      painted: boolean,
    ) => this.material(name, metalness, roughness, painted, fog, look, lights);
    // The deck is matte like asphalt; walls and underside stay metal.
    mesh(road, material("road", 0, 0.92, true));
    mesh(wall, material("wall", 0.5, 0.05, true));
    mesh(under, material("under", 0.8, 0.05, false));
  }

  // Hand-written lighting instead of MeshStandardMaterial: Lambert from the
  // scene lights plus a raking key, and reflections of an analytic sky
  // gradient (the old PMREM map only held that gradient anyway).
  private material(
    name: string,
    metalness: number,
    // Lower bound on the roughness map.
    roughness: number,
    painted: boolean,
    fog: number,
    look: (typeof LOOK)[number],
    lights: { ambient: THREE.Color; sun: THREE.DirectionalLight },
  ) {
    const [top, horizon] = look.sky.map((c) => new THREE.Color(c));
    const material = new THREE.ShaderMaterial({
      side: painted ? THREE.FrontSide : THREE.DoubleSide,
      uniforms: {
        map: { value: this.texture(name + "-color.jpg", true) },
        // Packed: rg = tangent-space normal xy, b = roughness.
        surfaceMap: { value: this.texture(name + "-surface.jpg") },
        courseTime: this.time,
        metalness: { value: metalness },
        minRough: { value: roughness },
        courseFog: { value: new THREE.Color(fog) },
        ambient: { value: lights.ambient },
        sunColor: { value: lights.sun.color },
        sunDir: { value: lights.sun.position.clone().normalize() },
        keyColor: { value: new THREE.Color(look.key) },
        keyDir: { value: new THREE.Vector3(...look.dir).normalize() },
        skyTop: { value: top },
        skyHorizon: { value: horizon },
      },
      vertexShader: `
        attribute vec2 cell;
        attribute float kind;
        attribute float lane;
        attribute float stripe;
        attribute vec2 size;
        varying vec2 vCell;
        varying float vKind;
        varying float vLane;
        varying float vStripe;
        varying vec2 vSize;
        varying vec2 vPanel;
        varying vec3 vView;
        varying vec3 vNormal;
        void main() {
          vCell = cell; vKind = kind; vLane = lane; vStripe = stripe; vPanel = uv; vSize = size;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = mv.xyz;
          vNormal = normalMatrix * normal;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader:
        `
        uniform sampler2D map, surfaceMap;
        uniform float courseTime, metalness, minRough;
        uniform vec3 courseFog, ambient, sunColor, sunDir, keyColor, keyDir, skyTop, skyHorizon;
        varying vec3 vView;
        varying vec3 vNormal;
        ` +
        HELPERS +
        `
        vec3 sky(float y) {
          return y < 0.0 ? skyHorizon * 0.25 : mix(skyHorizon, skyTop, y);
        }
        void main() {
          vec4 diffuseColor = texture2D(map, vPanel);
          courseGlow = vec3(0.0); courseRough = 1.0;
          ` +
        (painted ? PAINT : "") +
        `
          vec3 packed = texture2D(surfaceMap, vPanel).rgb;
          float rough = clamp(packed.b * courseRough, minRough, 1.0);
          // Derivative tangent frame (three.js perturbNormal2Arb).
          vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
          vec3 t = vec3(packed.rg * 2.0 - 1.0, 0.0);
          t.z = sqrt(max(1.0 - dot(t.xy, t.xy), 0.0));
          vec3 q0 = dFdx(vView), q1 = dFdy(vView);
          vec2 s0 = dFdx(vPanel), s1 = dFdy(vPanel);
          vec3 q1p = cross(q1, n), q0p = cross(n, q0);
          vec3 T = q1p * s0.x + q0p * s1.x, B = q1p * s0.y + q0p * s1.y;
          float det = max(dot(T, T), dot(B, B));
          n = normalize((T * t.x + B * t.y) * (det == 0.0 ? 0.0 : inversesqrt(det)) + n * t.z);
          vec3 v = normalize(-vView);
          vec3 base = diffuseColor.rgb;
          vec3 f0 = mix(vec3(0.04), base, metalness);
          vec3 sun = normalize((viewMatrix * vec4(sunDir, 0.0)).xyz);
          vec3 key = normalize((viewMatrix * vec4(keyDir, 0.0)).xyz);
          vec3 col = base * (1.0 - metalness) * (ambient * 0.35 / 3.14159 + sunColor * max(dot(n, sun), 0.0) + keyColor * max(dot(n, key), 0.0) * 1.3 / 3.14159);
          // Sky reflection, blurred towards the average with roughness.
          vec3 r = (vec4(reflect(-v, n), 0.0) * viewMatrix).xyz;
          vec3 env = mix(sky(r.y), (skyTop + skyHorizon) * 0.5, rough);
          float fres = pow(1.0 - max(dot(n, v), 0.0), 5.0) * (1.0 - rough);
          col += env * (f0 + (1.0 - f0) * fres) * (1.0 - rough * 0.5);
          // Key highlight (Blinn) so the normal maps catch the light.
          float spec = pow(max(dot(n, normalize(key + v)), 0.0), mix(200.0, 8.0, rough));
          col += keyColor * f0 * spec * (1.0 - rough);
          col += courseGlow;
          float f = 1.0 - exp(-pow(length(vView) / 2600.0, 2.0));
          gl_FragColor = vec4(mix(col, courseFog, f), 1.0);
          #include <colorspace_fragment>
        }`,
    });
    return material;
  }
}
