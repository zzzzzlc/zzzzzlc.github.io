import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThemeMode } from '../app/theme/ThemeProvider';

const PARTICLE_COUNT = 6000;
const SPHERE_RADIUS = 200;
const REPEL_RADIUS = 130;
const REPEL_STRENGTH = 70;

// 形态切换时长（ms）
const MORPH_DURATION = 1100; // 球面↔角色
const WINK_DURATION = 720;   // 一次眨眼

const CHARACTER_SRC = '/character.png';

/** 圆形光点纹理 */
function createCircleTexture(): THREE.Texture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
}

function getAccentColor(): THREE.Color {
    const css = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent')
        .trim();
    return new THREE.Color(css || '#1677ff');
}

type Phase = 'scatter' | 'morphing' | 'wink' | 'unmorphing';

/**
 * 3D 粒子聚合特效（three.js）。
 *
 * 默认：粒子聚合成均匀球面（fibonacci），缓慢自转，鼠标靠近被排斥散开。
 *
 * 「告别挽留」序列（离开意图触发，因浏览器无法在真正关闭瞬间播动画）：
 * 检测到鼠标快速冲向视口顶部 → 粒子从球面重组成角色图（采样 public/character.svg
 * 的不透明像素）→ 程序化 wink（上半脸纵向 squash + 轻微前倾）→ 恢复球面 → 冷却。
 *
 * 颜色与混合模式跟随主题（暗色 Additive 发光 / 亮色 Normal 可见）。
 */
export default function ParticleField() {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const materialRef = useRef<THREE.PointsMaterial | null>(null);
    const { mode } = useThemeMode();
    const modeRef = useRef(mode);
    modeRef.current = mode;

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || window.innerHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, width / height, 1, 2000);
        camera.position.z = 520;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // 球面目标（fibonacci）+ 当前位置（开场散落）
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const sphereTargets = new Float32Array(PARTICLE_COUNT * 3);
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const phi = Math.acos(1 - (2 * (i + 0.5)) / PARTICLE_COUNT);
            const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
            sphereTargets[i * 3]     = SPHERE_RADIUS * Math.sin(phi) * Math.cos(theta);
            sphereTargets[i * 3 + 1] = SPHERE_RADIUS * Math.cos(phi);
            sphereTargets[i * 3 + 2] = SPHERE_RADIUS * Math.sin(phi) * Math.sin(theta);

            positions[i * 3]     = (Math.random() - 0.5) * 1000;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 1000;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 1000;
        }

        // 图片目标（角色形态，供粒子聚拢过渡用），加载完成后填充
        const imageTargets = new Float32Array(PARTICLE_COUNT * 3);
        let imageReady = false;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: getAccentColor(),
            size: 4.5,
            map: createCircleTexture(),
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            sizeAttenuation: true,
            blending: modeRef.current === 'dark' ? THREE.AdditiveBlending : THREE.NormalBlending,
        });
        materialRef.current = material;

        const points = new THREE.Points(geometry, material);
        scene.add(points);

        // ---- 状态机 ----
        let phase: Phase = 'scatter';
        let phaseStart = performance.now();
        // 形态权重：0=球面(大粒子+发光)，1=图像(小粒子+Normal 锐利保细节)，平滑过渡避免突变
        let imageWeight = 0;

        const triggerMorph = () => {
            if (phase !== 'scatter' || !imageReady) return;
            phase = 'morphing';
            phaseStart = performance.now();
        };

        // ---- 加载并采样角色图（保持宽高比，alpha / 背景色双判定前景） ----
        const img = new Image();
        img.onload = () => {
            // 保持原图宽高比，最长边归一化到 ~440
            const ow = img.naturalWidth || img.width;
            const oh = img.naturalHeight || img.height;
            const MAX = 440;
            const scale = MAX / Math.max(ow, oh);
            const w = Math.max(1, Math.round(ow * scale));
            const h = Math.max(1, Math.round(oh * scale));

            const cvs = document.createElement('canvas');
            cvs.width = w;
            cvs.height = h;
            const ctx = cvs.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(img, 0, 0, w, h);
            let data: Uint8ClampedArray;
            try {
                data = ctx.getImageData(0, 0, w, h).data;
            } catch {
                return; // CORS 等异常
            }

            // 采样四角作为背景色，用于无透明背景时的前景判定
            const corner = (cx: number, cy: number) => {
                const i = (cy * w + cx) * 4;
                return [data[i], data[i + 1], data[i + 2]];
            };
            const corners = [
                corner(0, 0), corner(w - 1, 0),
                corner(0, h - 1), corner(w - 1, h - 1),
            ];

            // 检测图是否有效使用了透明背景（网格采样若干点）
            let lowAlpha = 0;
            const sx = Math.max(1, Math.floor(w / 50));
            const sy = Math.max(1, Math.floor(h / 50));
            for (let y = 0; y < h; y += sy) {
                for (let x = 0; x < w; x += sx) {
                    if (data[(y * w + x) * 4 + 3] < 250) lowAlpha++;
                }
            }
            const hasAlpha = lowAlpha > 3;

            // 前景判定：透明背景图纯走 alpha（避免深色前景被误判为背景）；
            // 无透明通道的图才退化到"与四角背景色差异"判定。
            const isFg = (x: number, y: number) => {
                const i = (y * w + x) * 4;
                if (hasAlpha) return data[i + 3] > 128;
                const r = data[i], g = data[i + 1], b = data[i + 2];
                for (const c of corners) {
                    const dr = r - c[0], dg = g - c[1], db = b - c[2];
                    if (dr * dr + dg * dg + db * db < 900) return false;
                }
                return true;
            };

            // 坐标缩放：把画布像素映射到 three 空间（居中，y 翻转）
            const SP = 1.0; // MAX=440 已是合理尺寸
            const pts: number[] = [];
            // 采样步长自适应：目标前景点数约为粒子数的 1.2 倍，保证细节区粒子密度
            // 先粗扫一遍估算前景比例，再反推步长
            let fgCount = 0;
            const probeStep = 3;
            for (let y = 0; y < h; y += probeStep) {
                for (let x = 0; x < w; x += probeStep) {
                    if (isFg(x, y)) fgCount++;
                }
            }
            const totalProbed = Math.ceil(w / probeStep) * Math.ceil(h / probeStep);
            const fgRatio = fgCount / totalProbed;
            const area = w * h;
            // step² * fgRatio ≈ area / (PARTICLE_COUNT * 1.2)
            const step = Math.max(1, Math.round(Math.sqrt((area * fgRatio) / (PARTICLE_COUNT * 1.2)) / probeStep) * probeStep);
            for (let y = 0; y < h; y += step) {
                for (let x = 0; x < w; x += step) {
                    if (!isFg(x, y)) continue;
                    const px = (x - w / 2) * SP;
                    const py = -(y - h / 2) * SP;
                    pts.push(px, py, 0);
                }
            }
            if (pts.length === 0) return;
            const m = pts.length / 3;
            // 当粒子数 < 前景点数时，均匀跳采整张图（否则 i%m 只会取到上半部）
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const k = m >= PARTICLE_COUNT
                    ? Math.floor((i / PARTICLE_COUNT) * m)  // 点多：均匀跨图采样
                    : i % m;                                  // 点少：循环复用全部点
                const s = k * 3;
                imageTargets[i * 3]     = pts[s];
                imageTargets[i * 3 + 1] = pts[s + 1];
                imageTargets[i * 3 + 2] = pts[s + 2];
            }
            imageReady = true;
        };
        img.src = CHARACTER_SRC;

        // ---- 鼠标：排斥 + 离开意图检测 ----
        const mouse = new THREE.Vector3(99999, 99999, 0);
        const ndc = new THREE.Vector2();
        const raycaster = new THREE.Raycaster();
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

        let lastMouseY = window.innerHeight / 2;
        let lastMouseTime = performance.now();

        const onMouseMove = (e: MouseEvent) => {
            const rect = container.getBoundingClientRect();
            ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(ndc, camera);
            raycaster.ray.intersectPlane(plane, mouse);

            // 离开意图：快速向上 + 已贴近视口顶部
            const now = performance.now();
            const dt = Math.max(now - lastMouseTime, 1);
            const vy = (lastMouseY - e.clientY) / dt; // px/ms，向上为正
            lastMouseY = e.clientY;
            lastMouseTime = now;
            if (e.clientY <= 6 && vy > 0.45) {
                triggerMorph();
            }
        };
        window.addEventListener('mousemove', onMouseMove);

        const onResize = () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            if (!w || !h) return;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener('resize', onResize);

        // ---- 动画循环 ----
        let raf = 0;
        const repelR2 = REPEL_RADIUS * REPEL_RADIUS;
        const invMatrix = new THREE.Matrix4();
        const mouseLocal = new THREE.Vector3();

        const animate = () => {
            const now = performance.now();
            const t = now - phaseStart;

            // 推进状态机
            if (phase === 'morphing' && t > MORPH_DURATION) {
                phase = 'wink';
                phaseStart = now;
            } else if (phase === 'wink' && t > WINK_DURATION) {
                phase = 'unmorphing';
                phaseStart = now;
            } else if (phase === 'unmorphing' && t > MORPH_DURATION) {
                phase = 'scatter';
                phaseStart = now;
            }

            // 球面态缓慢自转；图片态停止自转保持稳定
            if (phase === 'scatter') {
                points.rotation.y += 0.0016;
                points.rotation.x += 0.0004;
            }
            points.updateMatrixWorld();

            // 形态权重平滑过渡（粒子聚拢用）
            const targetWeight = (phase === 'morphing' || phase === 'wink' || phase === 'unmorphing') ? 1 : 0;
            imageWeight += (targetWeight - imageWeight) * 0.08;
            material.size = 4.5 + (2.4 - 4.5) * imageWeight;
            material.blending = imageWeight > 0.5
                ? THREE.NormalBlending
                : (modeRef.current === 'dark' ? THREE.AdditiveBlending : THREE.NormalBlending);

            // 粒子与清晰图片配合：显示态粒子淡出让位，由真实图片呈现完整角色（面部/肢体细节都在）
            // morphing 后半段：粒子从聚拢态淡出；wink：几乎不可见（留极淡光晕）；unmorphing：恢复
            let particleOpacity = 0.9;
            let imgOpacity = 0;
            let imgScaleY = 1;
            if (phase === 'morphing') {
                const p = Math.min(t / MORPH_DURATION, 1);
                imgOpacity = Math.max(0, (p - 0.45) / 0.55);  // 后半段图片淡入
                particleOpacity = 0.9 * (1 - Math.max(0, (p - 0.45) / 0.55) * 0.85);
            } else if (phase === 'wink') {
                imgOpacity = 1;
                particleOpacity = 0.12;  // 极淡光晕
                // wink：整图纵向 squash 脉冲（单图模拟眨眼/俏皮收缩）
                imgScaleY = 1 - 0.1 * Math.sin(Math.min(t / WINK_DURATION, 1) * Math.PI);
            } else if (phase === 'unmorphing') {
                const p = Math.min(t / MORPH_DURATION, 1);
                imgOpacity = Math.max(0, 1 - p / 0.5);  // 前半段图片淡出
                particleOpacity = 0.12 + 0.78 * Math.max(0, (p - 0.5) / 0.5);  // 后半段粒子恢复
            }
            material.opacity = particleOpacity;

            const imgEl = imgRef.current;
            if (imgEl) {
                imgEl.style.opacity = String(imgOpacity);
                imgEl.style.transform = `translate(-50%, -50%) scale(1, ${imgScaleY})`;
            }

            // 鼠标排斥只在球面态生效
            let mlx = 99999, mly = 99999, mlz = 99999;
            if (phase === 'scatter') {
                invMatrix.copy(points.matrixWorld).invert();
                mouseLocal.copy(mouse).applyMatrix4(invMatrix);
                mlx = mouseLocal.x; mly = mouseLocal.y; mlz = mouseLocal.z;
            }

            // 各相位插值速度
            const speed =
                phase === 'scatter' ? 0.05 :
                phase === 'morphing' ? 0.09 :
                phase === 'wink' ? 0.14 :
                0.08; // unmorphing

            const useImage = phase === 'morphing' || phase === 'wink' || phase === 'unmorphing';

            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const ix = i * 3;
                let tx: number, ty: number, tz: number;

                if (useImage && imageReady) {
                    tx = imageTargets[ix];
                    ty = imageTargets[ix + 1];
                    tz = imageTargets[ix + 2];
                } else {
                    tx = sphereTargets[ix];
                    ty = sphereTargets[ix + 1];
                    tz = sphereTargets[ix + 2];
                    // 球面态鼠标排斥
                    const px = positions[ix], py = positions[ix + 1], pz = positions[ix + 2];
                    const mdx = px - mlx, mdy = py - mly, mdz = pz - mlz;
                    const md2 = mdx * mdx + mdy * mdy + mdz * mdz;
                    if (md2 < repelR2) {
                        const mdist = Math.sqrt(md2) || 0.01;
                        const force = (1 - mdist / REPEL_RADIUS) * REPEL_STRENGTH;
                        tx += (mdx / mdist) * force;
                        ty += (mdy / mdist) * force;
                        tz += (mdz / mdist) * force;
                    }
                }

                positions[ix]     += (tx - positions[ix]) * speed;
                positions[ix + 1] += (ty - positions[ix + 1]) * speed;
                positions[ix + 2] += (tz - positions[ix + 2]) * speed;
            }
            geometry.attributes.position.needsUpdate = true;

            renderer.render(scene, camera);
            raf = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('resize', onResize);
            geometry.dispose();
            material.map?.dispose();
            material.dispose();
            renderer.dispose();
            if (renderer.domElement.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
            materialRef.current = null;
        };
    }, []);

    // 主题切换：只更新颜色（混合模式由 animate 里的 imageWeight 按相位自管）
    useEffect(() => {
        const mat = materialRef.current;
        if (!mat) return;
        mat.color = getAccentColor();
    }, [mode]);

    return <div ref={containerRef} className="particle-field" aria-hidden="true" />;
}
