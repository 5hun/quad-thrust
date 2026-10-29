// Source: src/background.ts. Build with npm run build; do not edit dist/background.js directly.
import * as THREE from "./vendor/three.module.js";
// Screen-space TMD background, ported from make_back_tmd / back_draw.
// BackRotX excludes the fixed seven-degree chase-camera tilt.
// MT2 scales all three axes by two; its translation projects at 1/50.
// It is scenery beneath the track, not a collision surface.
export class OriginalBackground {
    texture;
    scene;
    camera;
    group;
    sky;
    ground;
    beams;
    direction;
    theme;
    bank;
    cap;
    constructor(texture) {
        this.texture = texture;
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(0, 320, 0, 240, -100, 100);
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.sky = [];
        this.ground = [];
        this.beams = [];
        this.direction = new THREE.Vector3();
    }
    quad(map) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(12), 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
        geometry.setIndex([0, 2, 1, 1, 2, 3]);
        const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
            map,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false,
        }));
        mesh.frustumCulled = false;
        this.group.add(mesh);
        return mesh;
    }
    points(mesh, points) {
        mesh.geometry.attributes.position.array.set(points);
        mesh.geometry.attributes.position.needsUpdate = true;
    }
    setTheme(theme) {
        if (this.theme === theme)
            return;
        this.theme = theme;
        for (const child of this.group.children) {
            const m = child;
            m.geometry.dispose();
            m.material.dispose();
        }
        this.group.clear();
        const bank = window.HOVER_BACKGROUNDS[theme];
        this.bank = bank;
        this.scene.background = new THREE.Color(...bank.bottom.map((v) => v / 255)).convertSRGBToLinear();
        this.sky = Array.from({ length: 4 }, () => this.quad(null));
        this.cap = this.quad(null);
        this.cap.material.color.setRGB(...bank.top.map((v) => v / 255), THREE.SRGBColorSpace);
        this.ground = Array.from({ length: 3 }, (_, row) => Array.from({ length: 6 }, () => this.quad(this.texture(bank.ground[row] + ".png"))));
        this.beams = [];
        if (theme === 0)
            for (let i = 0; i < 5; i++) {
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(9), 3));
                const colors = [0xffffff, 0xffffc0, 0xc0c0ff, 0xffc0ff, 0xffffc0], a = new THREE.Color(colors[i]), b = new THREE.Color(0x202040);
                geometry.setAttribute("color", new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...b.toArray()], 3));
                const m = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
                    vertexColors: true,
                    transparent: true,
                    opacity: 0.5,
                    depthTest: false,
                    depthWrite: false,
                    side: THREE.DoubleSide,
                }));
                m.frustumCulled = false;
                this.group.add(m);
                this.beams.push(m);
            }
    }
    draw(renderer, camera, theme, time) {
        this.setTheme(theme);
        camera.getWorldDirection(this.direction);
        const yaw = Math.atan2(this.direction.x, -this.direction.z), pitch = Math.atan2(this.direction.y, Math.hypot(this.direction.x, this.direction.z));
        const k = ((((yaw / (Math.PI * 2) + 0.5) % 1) + 1) % 1) * 1920, offset = 320 * Math.tan(pitch + (7 * Math.PI) / 180), yp = theme === 0 ? 24 : 0, top = -20 + yp + offset;
        this.points(this.cap, [
            0,
            0,
            0,
            320,
            0,
            0,
            0,
            Math.max(0, top),
            0,
            320,
            Math.max(0, top),
            0,
        ]);
        this.cap.renderOrder = -2;
        for (let i = 0; i < 4; i++) {
            const strip = (Math.floor(k / 128) + i) % 15, m = this.sky[i], x = -(k % 128) - 20 + i * 128;
            const tex = this.texture(this.bank.sky[Math.floor(strip / 5)] + ".png");
            m.material.map = tex;
            const u = (strip % 5) / 5, v = ((strip % 5) + 1) / 5;
            m.geometry.attributes.uv.array.set([u, 1, v, 1, u, 0, v, 0]);
            m.geometry.attributes.uv.needsUpdate = true;
            this.points(m, [
                x,
                top,
                0,
                x + 129,
                top,
                0,
                x,
                top + 120,
                0,
                x + 129,
                top + 120,
                0,
            ]);
            m.renderOrder = -1;
        }
        for (let row = 0; row < 3; row++)
            for (let col = 0; col < 6; col++) {
                const p = [];
                for (const [x, y] of [
                    [col, row],
                    [col + 1, row],
                    [col, row + 1],
                    [col + 1, row + 1],
                ])
                    p.push(160 +
                        Math.trunc((((x - 3) * 128 + 64 - Math.floor(k % 128)) * (y + 2)) / 2), 120 + (y * 128 - 18) * 1.2 + (offset - 1 + yp), 0);
                this.points(this.ground[row][col], p);
            }
        const lx = [700, 780, 810, 1200, 1250], lx2 = [700, 730, 890, 1150, 1350], width = [100, 50, 80, 106, 110], ly = [0, -13, -10, 0, -20], phase = [0, 1024, 2562, 500, 100], rate = [5, 4, 2, 5, 1];
        this.beams.forEach((m, i) => {
            let x = lx[i] - k;
            while (x < -960)
                x += 1920;
            while (x > 960)
                x -= 1920;
            const sweep = width[i] *
                Math.sin(((phase[i] + Math.floor(time * 60) * rate[i]) * Math.PI) / 1024), tip = x + lx2[i] - lx[i] + sweep, dy = 120 + (offset - 1 + yp);
            this.points(m, [
                160 + x,
                dy - 60 - ly[i],
                0,
                160 + tip - 6,
                dy - 200 - ly[i],
                0,
                160 + tip + 6,
                dy - 200 - ly[i],
                0,
            ]);
            m.renderOrder = 1;
        });
        renderer.render(this.scene, this.camera);
    }
}
