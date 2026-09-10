import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { HoverInfo, Kline, SymbolSnapshot } from '../types';
import { normalize, priceRange } from '../../../market/kline';
import { WINDOW_SIZE } from '../../../market/constants';
import {
    CAMERA_FAR, CAMERA_FOV, CAMERA_INITIAL_POSITION, CAMERA_NEAR,
    CANDLE_SPACING, CANDLE_WIDTH, COLOR_DOWN, COLOR_FLAT, COLOR_GRID, COLOR_POINTER, COLOR_SURFACE, COLOR_UP,
    CONTROLS_TARGET, DPR_CAP, DPR_CAP_MOBILE,
    SURFACE_COLS, SURFACE_ROWS,
} from '../utils/constants';

/** K线涨跌色（three 数字形态）：c > o 涨 / c < o 跌 / 平 */
const klineColorHex = (k: Kline): number =>
    k.c > k.o ? COLOR_UP : k.c < k.o ? COLOR_DOWN : COLOR_FLAT;

/** 价格→Y 轴映射的最大刻度（K线影线/实体/曲面/指针共用同一价格坐标系） */
const PRICE_SCALE = 26;
/** 动画 lerp 因子与收敛阈值（小于阈值即吸附，停止动画） */
const LERP = 0.16;
const EPS = 0.01;
/** 曲面在 Z 方向铺开的深度带（位于 K线后方作为价格幕布） */
const SURFACE_Z_FRONT = -3;
const SURFACE_Z_BACK = -9;

/** 引擎对外句柄：组件/hook 不直接触碰 three.js */
export interface MarketEngine {
    /** 标记需要重绘（外部交互触发） */
    invalidate: () => void;
    /** 手动触发尺寸自适应（一般由 ResizeObserver 自动处理） */
    resize: () => void;
    /** 注册 hover 回调（命中 K线时回传信息供 HUD 定位 tooltip） */
    setHoverHandler: (cb: (info: HoverInfo | null) => void) => void;
    /** 销毁：停循环 / 移除监听 / 释放资源 */
    destroy: () => void;
}

/**
 * 创建实时行情 3D 引擎：
 * - InstancedMesh 批量绘制 K线（实体 + 影线，单 draw call）；
 * - BufferGeometry 动态更新顶点 Y 形成价格波动曲面；
 * - 当前价水平指针；
 * - 「按需渲染 + 动画延续」：数据/交互/尺寸变化时 invalidate，lerp 未收敛时持续渲染，
 *   数据静默且动画收敛且无交互时跳过绘制，GPU 占用降到 ~0。
 *
 * 数据通过 getActiveSnapshot 每帧拉取（绕过 React 重渲染节奏，性能优）。
 */
export const createMarketEngine = (
    container: HTMLDivElement,
    getActiveSnapshot: () => SymbolSnapshot | undefined,
): MarketEngine => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    const center = (WINDOW_SIZE - 1) / 2;

    // —— 基础场景 ——
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, CAMERA_NEAR, CAMERA_FAR);
    camera.position.set(...CAMERA_INITIAL_POSITION);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);     // 透明背景，交由 CSS 主题底色
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? DPR_CAP_MOBILE : DPR_CAP));
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(...CONTROLS_TARGET);
    controls.minDistance = 20;
    controls.maxDistance = 120;
    controls.maxPolarAngle = Math.PI * 0.49;   // 不让相机钻到地面以下
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(8, 16, 10);
    scene.add(dirLight);

    // —— 地面网格（空间参照） ——
    const grid = new THREE.GridHelper(70, 35, COLOR_GRID, COLOR_GRID);
    const gridMat = grid.material as THREE.Material | THREE.Material[];
    if (Array.isArray(gridMat)) gridMat.forEach((m) => { m.transparent = true; m.opacity = 0.35; });
    else { gridMat.transparent = true; gridMat.opacity = 0.35; }
    scene.add(grid);

    // —— K线：实体 + 影线 各一个 InstancedMesh（单 draw call × 2） ——
    const bodyGeo = new THREE.BoxGeometry(CANDLE_WIDTH, 1, CANDLE_WIDTH);
    const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.1 });
    const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, WINDOW_SIZE);
    bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const wickGeo = new THREE.BoxGeometry(CANDLE_WIDTH * 0.18, 1, CANDLE_WIDTH * 0.18);
    const wickMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05 });
    const wicks = new THREE.InstancedMesh(wickGeo, wickMat, WINDOW_SIZE);
    wicks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(bodies, wicks);

    // —— 价格曲面：自定义 BufferGeometry，顶点 Y 跟随历史收盘价 ——
    const surfaceGeo = buildSurfaceGeometry();
    const surfaceMat = new THREE.MeshStandardMaterial({
        color: COLOR_SURFACE,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        flatShading: true,             // 屏幕空间求面法线，无需 normal 属性、免重算
        roughness: 0.6,
        metalness: 0.1,
        vertexColors: true,
    });
    const surfaceWireMat = new THREE.MeshBasicMaterial({
        color: COLOR_SURFACE,
        wireframe: true,
        transparent: true,
        opacity: 0.18,
    });
    const surface = new THREE.Mesh(surfaceGeo, surfaceMat);
    const surfaceWire = new THREE.Mesh(surfaceGeo, surfaceWireMat);
    scene.add(surface, surfaceWire);

    // —— 当前价指针 ——
    const pointerGeo = new THREE.BoxGeometry((WINDOW_SIZE - 1) * CANDLE_SPACING + 2, 0.12, 0.5);
    const pointerMat = new THREE.MeshBasicMaterial({ color: COLOR_POINTER });
    const pointer = new THREE.Mesh(pointerGeo, pointerMat);
    pointer.position.set(0, 0, 2.2);
    scene.add(pointer);

    // —— 动画状态：current → target，逐帧 lerp ——
    const curBodyCY = new Float32Array(WINDOW_SIZE);
    const curBodyH = new Float32Array(WINDOW_SIZE);
    const curWickCY = new Float32Array(WINDOW_SIZE);
    const curWickH = new Float32Array(WINDOW_SIZE);
    const tgtBodyCY = new Float32Array(WINDOW_SIZE);
    const tgtBodyH = new Float32Array(WINDOW_SIZE);
    const tgtWickCY = new Float32Array(WINDOW_SIZE);
    const tgtWickH = new Float32Array(WINDOW_SIZE);
    const colors = new Float32Array(WINDOW_SIZE).fill(COLOR_FLAT);
    const curSurfY = new Float32Array(SURFACE_COLS);
    const tgtSurfY = new Float32Array(SURFACE_COLS);
    let curPointerY = 0;
    let tgtPointerY = 0;
    let hoveredId = -1;
    let liftCurr = 0;
    let liftTgt = 0;

    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();

    /** 根据最新快照重算所有 target（K线/曲面/指针） */
    const recompute = (snap: SymbolSnapshot): void => {
        const ks = snap.klines;
        const n = ks.length;
        const [min, max] = priceRange(ks);
        for (let i = 0; i < WINDOW_SIZE; i++) {
            const k = i < n ? ks[i] : null;
            if (!k) {
                tgtBodyCY[i] = 0; tgtBodyH[i] = 0; tgtWickCY[i] = 0; tgtWickH[i] = 0;
                colors[i] = COLOR_FLAT;
                continue;
            }
            const no = normalize(k.o, min, max), nc = normalize(k.c, min, max);
            const nl = normalize(k.l, min, max), nh = normalize(k.h, min, max);
            const yLow = Math.min(no, nc), yHigh = Math.max(no, nc);
            tgtBodyCY[i] = ((yLow + yHigh) / 2) * PRICE_SCALE;
            tgtBodyH[i] = Math.max((yHigh - yLow) * PRICE_SCALE, 0.25);
            tgtWickCY[i] = ((nl + nh) / 2) * PRICE_SCALE;
            tgtWickH[i] = Math.max((nh - nl) * PRICE_SCALE, 0.1);
            colors[i] = klineColorHex(k);
        }
        for (let c = 0; c < SURFACE_COLS; c++) {
            const k = c < n ? ks[c] : n > 0 ? ks[n - 1] : null;
            tgtSurfY[c] = k ? normalize(k.c, min, max) * PRICE_SCALE : 0;
        }
        const last = n > 0 ? ks[n - 1] : null;
        tgtPointerY = last ? normalize(last.c, min, max) * PRICE_SCALE : 0;
    };

    /** 把 current 状态写入 GPU buffer（仅渲染帧调用） */
    const sync = (): void => {
        for (let i = 0; i < WINDOW_SIZE; i++) {
            const x = (i - center) * CANDLE_SPACING;
            const lift = i === hoveredId ? liftCurr : 0;
            dummy.position.set(x, curBodyCY[i] + lift, 0);
            dummy.scale.set(1, curBodyH[i] || 0.0001, 1);
            dummy.updateMatrix();
            bodies.setMatrixAt(i, dummy.matrix);
            dummy.position.set(x, curWickCY[i], 0);
            dummy.scale.set(1, curWickH[i] || 0.0001, 1);
            dummy.updateMatrix();
            wicks.setMatrixAt(i, dummy.matrix);
            tmpColor.setHex(colors[i]);
            bodies.setColorAt(i, tmpColor);
        }
        bodies.instanceMatrix.needsUpdate = true;
        if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
        wicks.instanceMatrix.needsUpdate = true;

        const pos = surfaceGeo.attributes.position as THREE.BufferAttribute;
        const col = surfaceGeo.attributes.color as THREE.BufferAttribute;
        for (let r = 0; r < SURFACE_ROWS; r++) {
            const z = SURFACE_Z_FRONT + (r / (SURFACE_ROWS - 1)) * (SURFACE_Z_BACK - SURFACE_Z_FRONT);
            for (let c = 0; c < SURFACE_COLS; c++) {
                const idx = (r * SURFACE_COLS + c) * 3;
                const y = curSurfY[c];
                const arr = pos.array as Float32Array;
                arr[idx] = (c - center) * CANDLE_SPACING;
                arr[idx + 1] = y;
                arr[idx + 2] = z;
                const t = Math.max(0, Math.min(1, y / PRICE_SCALE));
                const carr = col.array as Float32Array;
                carr[idx] = 0.05 + t * 0.25;
                carr[idx + 1] = 0.15 + t * 0.45;
                carr[idx + 2] = 0.4 + t * 0.6;
            }
        }
        pos.needsUpdate = true;
        col.needsUpdate = true;
        pointer.position.y = curPointerY;
    };

    /** 推进一帧 lerp，返回是否仍有未完成动画 */
    const step = (): boolean => {
        let moving = false;
        const drive = (cur: Float32Array, tgt: Float32Array): void => {
            for (let i = 0; i < cur.length; i++) {
                const d = tgt[i] - cur[i];
                if (Math.abs(d) > EPS) { cur[i] += d * LERP; moving = true; }
                else cur[i] = tgt[i];
            }
        };
        drive(curBodyCY, tgtBodyCY);
        drive(curBodyH, tgtBodyH);
        drive(curWickCY, tgtWickCY);
        drive(curWickH, tgtWickH);
        drive(curSurfY, tgtSurfY);
        const pd = tgtPointerY - curPointerY;
        if (Math.abs(pd) > EPS) { curPointerY += pd * LERP; moving = true; }
        else curPointerY = tgtPointerY;
        const ld = liftTgt - liftCurr;
        if (Math.abs(ld) > EPS) { liftCurr += ld * LERP; moving = true; }
        else liftCurr = liftTgt;
        return moving;
    };

    // —— 按需渲染 + 动画延续 ——
    let needsRender = true;
    let bufferDirty = true;
    let lastSig = '';
    const invalidate = (): void => { needsRender = true; };
    controls.addEventListener('change', invalidate);

    const animate = (): void => {
        frameId = requestAnimationFrame(animate);
        controls.update();

        const snap = getActiveSnapshot();
        const lastTs = snap && snap.klines.length > 0 ? snap.klines[snap.klines.length - 1].ts : 0;
        const sig = snap ? `${snap.symbol}|${snap.klines.length}|${lastTs}` : '';
        if (sig !== lastSig) {
            lastSig = sig;
            if (snap) recompute(snap);
            bufferDirty = true;
            needsRender = true;
        }

        const moving = step();
        if (needsRender || moving) {
            if (bufferDirty || moving) { sync(); bufferDirty = false; }
            renderer.render(scene, camera);
            needsRender = false;
        }
    };
    let frameId = requestAnimationFrame(animate);

    // —— hover：raycaster 命中 K线实体，回传 OHLC + 鼠标坐标 ——
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let hoverHandler: ((info: HoverInfo | null) => void) | null = null;

    const onPointerMove = (e: PointerEvent): void => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointerNdc, camera);
        const hits = raycaster.intersectObject(bodies);
        const snap = getActiveSnapshot();
        if (hits.length > 0 && snap) {
            const id = hits[0].instanceId ?? -1;
            const k = id >= 0 && id < snap.klines.length ? snap.klines[id] : null;
            if (k && id !== hoveredId) {
                hoveredId = id;
                liftTgt = 1.4;
                bufferDirty = true;
                needsRender = true;
            }
            if (k) hoverHandler?.({ kline: k, clientX: e.clientX, clientY: e.clientY });
            return;
        }
        if (hoveredId !== -1) {
            hoveredId = -1;
            liftTgt = 0;
            bufferDirty = true;
            needsRender = true;
        }
        hoverHandler?.(null);
    };
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    // —— 自适应：ResizeObserver 监听容器（覆盖侧栏折叠等 resize 捕获不到的场景） ——
    const handleResize = (): void => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        invalidate();
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return {
        invalidate,
        resize: handleResize,
        setHoverHandler: (cb) => { hoverHandler = cb; },
        destroy: () => {
            resizeObserver.disconnect();
            controls.removeEventListener('change', invalidate);
            renderer.domElement.removeEventListener('pointermove', onPointerMove);
            cancelAnimationFrame(frameId);
            controls.dispose();
            bodyGeo.dispose(); bodyMat.dispose();
            wickGeo.dispose(); wickMat.dispose();
            surfaceGeo.dispose();
            surfaceMat.dispose(); surfaceWireMat.dispose();
            pointerGeo.dispose(); pointerMat.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
            if (renderer.domElement.parentNode === container) {
                container.removeChild(renderer.domElement);
            }
        },
    };
};

/** 构建价格曲面网格几何（COLS × ROWS 顶点，position + color 属性） */
const buildSurfaceGeometry = (): THREE.BufferGeometry => {
    const vertexCount = SURFACE_COLS * SURFACE_ROWS;
    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const indices: number[] = [];
    for (let r = 0; r < SURFACE_ROWS - 1; r++) {
        for (let c = 0; c < SURFACE_COLS - 1; c++) {
            const a = r * SURFACE_COLS + c;
            const b = r * SURFACE_COLS + c + 1;
            const d = (r + 1) * SURFACE_COLS + c;
            const e = (r + 1) * SURFACE_COLS + c + 1;
            indices.push(a, b, d, b, e, d);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    return geo;
};
