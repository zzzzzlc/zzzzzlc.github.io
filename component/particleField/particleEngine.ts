import * as THREE from 'three';
import {
    PARTICLE_COUNT,
    PARTICLE_SIZE,
    REPEL_RADIUS,
    REPEL_STRENGTH,
    SPHERE_RADIUS,
    SWING_AMP,
    WINK_DURATION,
} from './constants';
import { sampleCharacter } from './sampleCharacter';

/**
 * 粒子引擎句柄：组件不直接接触 three.js，统一经由本引擎。
 */
export interface ParticleEngine {
    /** 销毁：取消渲染循环 / 移除监听 / 释放几何 / 材质 / 渲染器资源 */
    destroy: () => void;
}

type Phase = 'idle' | 'wink';

/** 圆形光点纹理：中心实色、边缘透明，让粒子拼出的角色边缘柔和 */
const createCircleTexture = (): THREE.Texture => {
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
};

/** 取主题 --accent 色（开场散落粒子色，聚合后过渡到角色真实色） */
const getAccentColor = (): THREE.Color => {
    const css = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    return new THREE.Color(css || '#1677ff');
};

/**
 * 创建 three.js 粒子引擎。
 *
 * 形态：粒子开场散落 → 聚成球面 →（角色图采样就绪后）聚合成角色完整形象，
 * 且每个粒子携带 character.png 对应像素的真实颜色（vertexColors）。
 * 常驻：缓慢 y 轴小幅度摆动（2.5D，避免持续自转把角色转扁）+ 鼠标排斥。
 * 离开挽留：检测鼠标快速冲向视口顶部 → 触发一次纵向 wink 收缩。
 */
export const createParticleEngine = (container: HTMLDivElement): ParticleEngine => {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 2000);
    camera.position.z = 520;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 位置 / 颜色缓冲：positions 当前坐标，sphereTargets 球面开场+回退，颜色 accent→角色真实色
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const sphereTargets = new Float32Array(PARTICLE_COUNT * 3);
    const currentColors = new Float32Array(PARTICLE_COUNT * 3);
    const targetColors = new Float32Array(PARTICLE_COUNT * 3);
    const accent = getAccentColor();
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const phi = Math.acos(1 - (2 * (i + 0.5)) / PARTICLE_COUNT);
        const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
        sphereTargets[i * 3]     = SPHERE_RADIUS * Math.sin(phi) * Math.cos(theta);
        sphereTargets[i * 3 + 1] = SPHERE_RADIUS * Math.cos(phi);
        sphereTargets[i * 3 + 2] = SPHERE_RADIUS * Math.sin(phi) * Math.sin(theta);

        positions[i * 3]     = (Math.random() - 0.5) * 1000;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 1000;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 1000;

        currentColors[i * 3]     = accent.r;
        currentColors[i * 3 + 1] = accent.g;
        currentColors[i * 3 + 2] = accent.b;
        targetColors[i * 3]      = accent.r;
        targetColors[i * 3 + 1]  = accent.g;
        targetColors[i * 3 + 2]  = accent.b;
    }

    // 当前聚拢目标：开场球面，角色采样就绪后切换为彩色角色
    let targetPositions: Float32Array = sphereTargets;
    let charReady = false;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(currentColors, 3));

    const material = new THREE.PointsMaterial({
        size: PARTICLE_SIZE,
        map: createCircleTexture(),
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        sizeAttenuation: true,
        vertexColors: true,          // 显示每个粒子的真实采样色
        blending: THREE.NormalBlending, // 彩色角色必须 Normal 才能正确显色（Additive 会过曝泛白）
    });
    // material.color 默认白色：作为 vertexColor 的 tint，白色即保留原色

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let disposed = false;

    // 异步采样角色 → 切换聚拢目标与颜色到角色真实像素
    sampleCharacter(PARTICLE_COUNT).then((sample) => {
        if (!sample || disposed) return;
        targetPositions = sample.positions;
        targetColors.set(sample.colors);
        charReady = true;
    });

    // 鼠标排斥 + 离开意图检测
    const mouse = new THREE.Vector3(99999, 99999, 0);
    const ndc = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    let lastMouseY = window.innerHeight / 2;
    let lastMouseTime = performance.now();

    let phase: Phase = 'idle';
    let phaseStart = performance.now();

    const triggerWink = () => {
        if (phase !== 'idle' || !charReady) return;
        phase = 'wink';
        phaseStart = performance.now();
    };

    const onMouseMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);
        raycaster.ray.intersectPlane(plane, mouse);

        const now = performance.now();
        const dt = Math.max(now - lastMouseTime, 1);
        const vy = (lastMouseY - e.clientY) / dt; // px/ms，向上为正
        lastMouseY = e.clientY;
        lastMouseTime = now;
        if (e.clientY <= 6 && vy > 0.45) triggerWink();
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

    // 动画循环
    let raf = 0;
    let elapsed = 0;
    let last = performance.now();
    const repelR2 = REPEL_RADIUS * REPEL_RADIUS;
    const invMatrix = new THREE.Matrix4();
    const mouseLocal = new THREE.Vector3();

    const animate = () => {
        raf = requestAnimationFrame(animate);
        const now = performance.now();
        elapsed += now - last;
        last = now;

        // wink 脉冲推进
        const winkT = now - phaseStart;
        if (phase === 'wink' && winkT > WINK_DURATION) {
            phase = 'idle';
            phaseStart = now;
        }
        const winkScaleY = phase === 'wink'
            ? 1 - 0.12 * Math.sin(Math.min(winkT / WINK_DURATION, 1) * Math.PI)
            : 1;

        // 缓慢 y 轴小幅度摆动（2.5D 立体感，幅度受 SWING_AMP 约束避免角色转扁）
        points.rotation.y = Math.sin(elapsed * 0.0004) * SWING_AMP;
        points.updateMatrixWorld();

        // 颜色插值：accent 散落 → 角色真实色
        const colorLerp = charReady ? 0.06 : 0.04;
        for (let i = 0; i < currentColors.length; i++) {
            currentColors[i] += (targetColors[i] - currentColors[i]) * colorLerp;
        }
        geometry.attributes.color.needsUpdate = true;

        // 鼠标世界坐标 → 粒子本地坐标
        invMatrix.copy(points.matrixWorld).invert();
        mouseLocal.copy(mouse).applyMatrix4(invMatrix);
        const mlx = mouseLocal.x, mly = mouseLocal.y, mlz = mouseLocal.z;

        const speed = charReady ? 0.07 : 0.05;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const ix = i * 3;
            let tx = targetPositions[ix];
            let ty = targetPositions[ix + 1] * winkScaleY;
            let tz = targetPositions[ix + 2];

            // 鼠标排斥
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

            positions[ix]     += (tx - positions[ix]) * speed;
            positions[ix + 1] += (ty - positions[ix + 1]) * speed;
            positions[ix + 2] += (tz - positions[ix + 2]) * speed;
        }
        geometry.attributes.position.needsUpdate = true;

        renderer.render(scene, camera);
    };
    animate();

    return {
        destroy: () => {
            disposed = true;
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
        },
    };
};
