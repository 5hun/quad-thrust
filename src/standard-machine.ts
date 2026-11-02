import * as THREE from "./vendor/three.module.js";

// Independently authored QUAD THRUST hull, rudders and footprint.
// Exhaust parts 2/3 use the original standard machine in renderer.ts.
export const STANDARD_MODEL = "QUAD_01";
// The hull thickens upwards from its existing underside. Rudder blades keep
// their size, while their hinges and the nozzles follow the thicker body.
const BODY_HEIGHT = 1.6;
const HULL_THICKNESS = 1.65;
const HULL_LIFT = 0.28 * (HULL_THICKNESS - 1);
const hullY = (y: number) => y * HULL_THICKNESS + HULL_LIFT;
export const STANDARD_MOUNTS = {
  rudder: [
    [-76, -100 * BODY_HEIGHT * hullY(0.25), -205],
    [76, -100 * BODY_HEIGHT * hullY(0.25), -205],
  ],
  side: [
    [-164, -100 * BODY_HEIGHT * hullY(-0.1), 135],
    [-164, -100 * BODY_HEIGHT * hullY(-0.1), -135],
    [164, -100 * BODY_HEIGHT * hullY(-0.1), 135],
    [164, -100 * BODY_HEIGHT * hullY(-0.1), -135],
  ],
  rear: [
    [-112, -100 * BODY_HEIGHT * hullY(0), -240],
    [112, -100 * BODY_HEIGHT * hullY(0), -240],
  ],
};

type Station = [z: number, halfWidth: number, bottom: number, top: number];

// Hull=0, rudder=1, footprint=4. Exhaust is intentionally not re-created here.
export function standardMachinePart(index: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `quad-01-part-${index}`;
  if (index === 0 || index === 1) group.scale.y = BODY_HEIGHT;
  const colors = {
    shell: 0xf8f9f7,
    frame: 0x263e4a,
    accent: 0xf2a43a,
    light: 0x67f1de,
  };
  const mesh = (
    geometry: THREE.BufferGeometry,
    color: number,
    surface = true,
  ) => {
    const material = new THREE.MeshLambertMaterial({
      color,
      flatShading: true,
    });
    material.userData.machineSurface = surface;
    const result = new THREE.Mesh(geometry, material);
    if (index === 0) {
      result.scale.y = HULL_THICKNESS;
      result.position.y = HULL_LIFT;
    }
    group.add(result);
    return result;
  };
  const box = (size: Vec3, position: Vec3, color: number, surface = true) => {
    const result = mesh(new THREE.BoxGeometry(...size), color, surface);
    result.position.set(
      position[0],
      index === 0 ? hullY(position[1]) : position[1],
      position[2],
    );
    return result;
  };
  // Longitudinal sections produce a tapered nose and tail, rather than a box
  // with a bevel. Eight vertices per section keep the racing silhouette clean.
  const fairing = (
    stations: Station[],
    x: number,
    color: number,
    surface = true,
  ) => {
    const rings = stations.map(([z, w, bottom, top]) => {
      const h = top - bottom;
      return [
        [x - w * 0.6, top, z],
        [x + w * 0.6, top, z],
        [x + w, top - h * 0.3, z],
        [x + w, bottom + h * 0.25, z],
        [x + w * 0.6, bottom, z],
        [x - w * 0.6, bottom, z],
        [x - w, bottom + h * 0.25, z],
        [x - w, top - h * 0.3, z],
      ];
    });
    const positions: number[] = [],
      uvs: number[] = [];
    const triangle = (points: number[][], uv: number[][]) => {
      points.forEach((p) => positions.push(...p));
      uv.forEach((p) => uvs.push(...p));
    };
    for (let j = 0; j < rings.length - 1; j++) {
      for (let k = 0; k < 8; k++) {
        const n = (k + 1) % 8,
          v = (stations[j][0] + 3) / 2.5,
          nextV = (stations[j + 1][0] + 3) / 2.5;
        const a = [k / 8, v],
          b = [k / 8, nextV],
          c = [(k + 1) / 8, v],
          d = [(k + 1) / 8, nextV];
        triangle([rings[j][k], rings[j + 1][k], rings[j][n]], [a, b, c]);
        triangle([rings[j][n], rings[j + 1][k], rings[j + 1][n]], [c, b, d]);
      }
    }
    for (const j of [0, rings.length - 1]) {
      const [z, , bottom, top] = stations[j],
        center = [x, (bottom + top) / 2, z];
      for (let k = 0; k < 8; k++) {
        const n = (k + 1) % 8;
        triangle(
          j === 0
            ? [center, rings[j][k], rings[j][n]]
            : [center, rings[j][n], rings[j][k]],
          [
            [0.5, 0.5],
            [0, 0],
            [1, 1],
          ],
        );
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    return mesh(geometry, color, surface);
  };
  if (index === 0) {
    // Broader centre and canopy inside the unchanged outer pod footprint.
    const centerProfile: Station[] = [
      // Broad chisel nose in plan view; retain the thin vertical wedge.
      [-2.85, 0.38, -0.08, -0.02],
      [-1.75, 0.61, -0.22, 0.28],
      [-0.6, 0.88, -0.25, 0.44],
      [1.35, 0.76, -0.22, 0.38],
      [2.2, 0.4, -0.12, 0.16],
    ];
    const center = fairing(centerProfile, 0, colors.shell);
    center.name = "central-hull";
    // Clip the upper hull triangles to a glazing footprint. Every pane vertex
    // remains on its original hull face; there is no extra canopy volume.
    const outline = [
      [-0.26, -1.9],
      [0.26, -1.9],
      [0.66, -0.6],
      [0.61, 0.1],
      [0.24, 1.05],
      [-0.24, 1.05],
      [-0.61, 0.1],
      [-0.66, -0.6],
    ];
    const panePositions: number[] = [],
      paneUVs: number[] = [];
    const positions = center.geometry.getAttribute("position");
    const side = (p: number[], a: number[], b: number[]) =>
      (b[0] - a[0]) * (p[2] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    for (let i = 0; i < positions.count; i += 3) {
      let polygon = [0, 1, 2].map((k) => [
        positions.getX(i + k),
        positions.getY(i + k),
        positions.getZ(i + k),
      ]);
      const origin = new THREE.Vector3().fromArray(polygon[0]);
      const normal = new THREE.Vector3().crossVectors(
        new THREE.Vector3().fromArray(polygon[1]).sub(origin),
        new THREE.Vector3().fromArray(polygon[2]).sub(origin),
      );
      if (normal.y <= 0) continue;
      for (let edge = 0; edge < outline.length && polygon.length; edge++) {
        const a = outline[edge],
          b = outline[(edge + 1) % outline.length];
        const clipped: number[][] = [];
        for (let k = 0; k < polygon.length; k++) {
          const from = polygon[k],
            to = polygon[(k + 1) % polygon.length];
          const d0 = side(from, a, b),
            d1 = side(to, a, b);
          const fromInside = d0 >= 0,
            toInside = d1 >= 0;
          if (fromInside) clipped.push(from);
          if (fromInside !== toInside) {
            const t = d0 / (d0 - d1);
            clipped.push(from.map((v, axis) => v + (to[axis] - v) * t));
          }
        }
        polygon = clipped;
      }
      for (let k = 1; k + 1 < polygon.length; k++)
        for (const point of [polygon[0], polygon[k], polygon[k + 1]]) {
          panePositions.push(...point);
          paneUVs.push((point[0] + 0.88) / 1.76, (point[2] + 1.9) / 2.95);
        }
    }
    const paneGeometry = new THREE.BufferGeometry();
    paneGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(panePositions, 3),
    );
    paneGeometry.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(paneUVs, 2),
    );
    paneGeometry.computeVertexNormals();
    const canopy = mesh(paneGeometry, 0xffffff, false);
    canopy.name = "flush-canopy";
    // Resolve coplanar depth without lifting the glass above the body.
    canopy.material.polygonOffset = true;
    canopy.material.polygonOffsetFactor = -1;
    canopy.material.polygonOffsetUnits = -1;
    const size = 128,
      pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = x / (size - 1),
          v = y / (size - 1);
        const reflection = Math.exp(-Math.pow((u + v * 0.35 - 0.58) / 0.13, 2));
        const edge = Math.pow(Math.abs(u - 0.5) * 2, 3);
        const index = (y * size + x) * 4;
        pixels.set(
          [
            18 + reflection * 34,
            55 + v * 12 + reflection * 49 - edge * 12,
            72 + v * 14 + reflection * 56 - edge * 12,
            255,
          ],
          index,
        );
      }
    const glassTexture = new THREE.DataTexture(
      pixels,
      size,
      size,
      THREE.RGBAFormat,
    );
    glassTexture.name = "quad-01-tinted-glass";
    glassTexture.colorSpace = THREE.SRGBColorSpace;
    glassTexture.magFilter = glassTexture.minFilter = THREE.LinearFilter;
    glassTexture.userData.disposeWithMesh = true;
    glassTexture.needsUpdate = true;
    canopy.material.map = glassTexture;
    for (const side of [-1, 1]) {
      const x = side * 1.12;
      for (const z of [-1.35, 1.35]) {
        // Swept, low-profile arms join the independently controlled pods.
        fairing(
          [
            [z - 0.28, 0.45, -0.18, -0.07],
            [z + 0.16, 0.45, -0.2, -0.05],
          ],
          side * 0.72,
          colors.frame,
        );
        box([0.13, 0.2, 0.38], [side * 1.59, -0.1, z], colors.frame);
        box([0.015, 0.1, 0.25], [side * 1.66, -0.1, z], colors.light, false);
      }
      fairing(
        [
          [-2.65, 0.28, -0.06, -0.02],
          [-1.55, 0.46, -0.28, 0.22],
          [-0.65, 0.42, -0.26, 0.2],
          [-0.25, 0.12, -0.1, 0.03],
        ],
        x,
        colors.shell,
      );
      fairing(
        [
          [0.25, 0.12, -0.1, 0.03],
          [0.85, 0.43, -0.25, 0.2],
          [1.65, 0.43, -0.25, 0.18],
          [2.4, 0.3, -0.17, 0.15],
        ],
        x,
        colors.shell,
      );
      box([0.12, 0.11, 0.85], [x, -0.12, 0], colors.frame);
      box([0.48, 0.28, 0.12], [x, 0, 2.36], colors.frame);
      box([0.32, 0.18, 0.015], [x, 0, 2.425], colors.light, false);
      // Thin racing stripe follows the front pod's sloping upper surface.
      const stripe = fairing(
        [
          [-2.5, 0.055, -0.01, 0.05],
          [-1.55, 0.065, 0.22, 0.232],
          [-0.7, 0.06, 0.2, 0.213],
        ],
        x,
        colors.accent,
      );
      stripe.name = "pod-racing-stripe";
    }
    box([1.65, 0.1, 0.23], [0, 0.18, 1.98], colors.frame);
  } else if (index === 1) {
    // Leading-edge hinge, swept leading edge and a thin trailing surface.
    fairing(
      [
        [0, 0.045, 0, 0.16],
        [0.38, 0.055, 0, 0.7],
        [0.92, 0.025, 0, 0.66],
        [1.1, 0.008, 0.02, 0.56],
      ],
      0,
      colors.shell,
    );
    fairing(
      [
        [0.4, 0.057, 0.6, 0.705],
        [0.92, 0.027, 0.56, 0.665],
        [1.1, 0.009, 0.5, 0.565],
      ],
      0,
      colors.accent,
    );
  } else if (index === 4) {
    box([1.05, 0.005, 4.4], [0, 0, -0.25], 0x000000, false);
    for (const x of [-1.12, 1.12])
      for (const z of [-1.35, 1.35])
        box([0.85, 0.005, 2.1], [x, 0, z], 0x000000, false);
  }
  return group;
}
