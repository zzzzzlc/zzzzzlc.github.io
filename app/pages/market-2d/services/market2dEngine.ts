import { WINDOW_SIZE } from '../../../market/constants';
import { formatPrice, klineColorCss, maxVolume, priceRange } from '../../../market/kline';
import type { Kline, SymbolSnapshot } from '../../../market/types';
import type { HoverInfo2D } from '../types';
import {
    AXIS_H, AXIS_W, DPR_CAP, DPR_CAP_MOBILE, EPS, FONT, LERP, PAD_RATIO,
    PALETTE, PRICE_TICKS, TIME_GAP, VOLUME_RATIO,
} from '../utils/constants';

/** 绘图区几何（CSS 像素，resize 时重算） */
interface View {
    cssW: number;
    cssH: number;
    plotLeft: number;
    plotTop: number;
    plotW: number;
    plotH: number;
    volTop: number;
    volH: number;
    slotW: number;
}

/** 引擎对外句柄：组件/hook 不直接触碰 canvas 上下文 */
export interface Market2dEngine {
    /** 标记需要重绘（外部交互触发） */
    invalidate: () => void;
    /** 手动触发尺寸自适应（一般由 ResizeObserver 自动处理） */
    resize: () => void;
    /** 注册 hover 回调（命中 K线时回传信息供 HUD 定位 tooltip） */
    setHoverHandler: (cb: (info: HoverInfo2D | null) => void) => void;
    /** 销毁：停循环 / 移除监听 / 移除 canvas */
    destroy: () => void;
}

/**
 * 创建实时行情 2D 引擎（Canvas 2D，零依赖手写）：
 * - 主图 K线（实体 + 影线）+ 成交量副图 + 价格/时间轴 + 网格；
 * - 当前价虚线 + 右缘价签（价格 tick 级 lerp 平滑）；
 * - 新 K线全图滑入 + 新柱生长（grow lerp），坐标系随极值平滑重缩放；
 * - 「按需渲染 + 动画延续」：数据/交互/尺寸变化时 invalidate，lerp 未收敛时持续重绘，
 *   数据静默且动画收敛且无交互时跳过绘制，CPU 占用降到 ~0。
 *
 * 数据通过 getActiveSnapshot 每帧拉取（绕过 React 重渲染节奏，性能优）。
 * hover 命中用槽位 O(1) 数学（非二分/线性扫描），pointermove 只记录坐标，
 * 帧循环内统一计算与回调，React setState 频率与鼠标事件率解耦（≤ 帧率且仅在变化时发射）。
 */
export const createMarket2dEngine = (
    container: HTMLDivElement,
    getActiveSnapshot: () => SymbolSnapshot | undefined,
): Market2dEngine => {
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return {
            invalidate: () => undefined,
            resize: () => undefined,
            setHoverHandler: () => undefined,
            destroy: () => undefined,
        };
    }
    container.appendChild(canvas);

    const view: View = {
        cssW: 0, cssH: 0, plotLeft: 8, plotTop: 8, plotW: 0, plotH: 0,
        volTop: 0, volH: 0, slotW: 1,
    };

    // —— 动画状态：current → target，逐帧 lerp ——
    let curSlide = 0;                 // 新K线滑入偏移（px），触发时置 slotW，目标恒 0
    let curMin = 0, curMax = 1;       // 价格坐标系（动画量，平滑重缩放）
    let tgtMin = 0, tgtMax = 1;
    let curVolMax = 1, tgtVolMax = 1; // 成交量归一化上限
    let curPrice = 0, tgtPrice = 0;   // 当前价（虚线/价签，tick 级平滑）
    const curGrow = new Float32Array(WINDOW_SIZE);
    const tgtGrow = new Float32Array(WINDOW_SIZE);
    let curHoverAlpha = 0, tgtHoverAlpha = 0;
    let hoveredId = -1;
    let prevN = 0;
    let prevLastTs = 0;
    let hasData = false;
    let lastKs: readonly Kline[] = [];

    // —— 坐标映射（绘制期基于 current 状态，动画即坐标动画） ——
    const yOf = (p: number): number =>
        view.plotTop + (1 - (p - curMin) / (curMax - curMin || 1)) * view.plotH;
    const priceAt = (y: number): number =>
        curMin + (1 - (y - view.plotTop) / (view.plotH || 1)) * (curMax - curMin);
    const xOf = (i: number): number => view.plotLeft + (i + 0.5) * view.slotW + curSlide;

    /** 根据最新快照重算全部 target（坐标系/量程/新柱生长/滑入触发） */
    const recompute = (snap: SymbolSnapshot, lastTs: number): void => {
        const ks = snap.klines;
        const n = ks.length;
        lastKs = ks;
        const [min, max] = priceRange(ks);
        const pad = (max - min) * PAD_RATIO || 1;
        tgtMin = min - pad;
        tgtMax = max + pad;
        tgtVolMax = maxVolume(ks);
        tgtPrice = snap.lastPrice;
        if (!hasData) {
            // 首帧直接落位，不播入场动画（50 根历史一次灌入）
            curMin = tgtMin; curMax = tgtMax; curVolMax = tgtVolMax; curPrice = tgtPrice;
            curGrow.fill(1);
            hasData = true;
        } else {
            // 新 K线（数量或末根时间变化）→ 全图右偏一槽后滑入归位，最右新柱从 0 生长
            if (n !== prevN || lastTs !== prevLastTs) {
                curSlide = view.slotW;
                if (n > 0) curGrow[n - 1] = 0;
            }
            // 新槽位的柱从 0 生长（覆盖窗口滚动时的最右新柱）
            for (let i = prevN; i < n; i++) curGrow[i] = 0;
        }
        for (let i = 0; i < n; i++) tgtGrow[i] = 1;
        prevN = n;
        prevLastTs = lastTs;
    };

    /** 推进一帧 lerp，返回是否仍有未完成动画 */
    const step = (): boolean => {
        let moving = false;
        const drive = (cur: number, tgt: number): number => {
            const d = tgt - cur;
            if (Math.abs(d) > EPS) return cur + d * LERP;
            return tgt;
        };
        const next = drive(curSlide, 0);
        if (next !== curSlide) { moving = true; curSlide = next; }
        const nextMin = drive(curMin, tgtMin);
        if (nextMin !== curMin) { moving = true; curMin = nextMin; }
        const nextMax = drive(curMax, tgtMax);
        if (nextMax !== curMax) { moving = true; curMax = nextMax; }
        const nextVol = drive(curVolMax, tgtVolMax);
        if (nextVol !== curVolMax) { moving = true; curVolMax = nextVol; }
        const nextPrice = drive(curPrice, tgtPrice);
        if (nextPrice !== curPrice) { moving = true; curPrice = nextPrice; }
        const nextAlpha = drive(curHoverAlpha, tgtHoverAlpha);
        if (nextAlpha !== curHoverAlpha) { moving = true; curHoverAlpha = nextAlpha; }
        for (let i = 0; i < WINDOW_SIZE; i++) {
            const g = drive(curGrow[i], tgtGrow[i]);
            if (g !== curGrow[i]) { moving = true; curGrow[i] = g; }
        }
        return moving;
    };

    /** 每渲染帧全量重绘（60 柱 + 网格 + 文字 < 0.5ms，无需离屏分层） */
    const draw = (): void => {
        const n = lastKs.length;
        ctx.clearRect(0, 0, view.cssW, view.cssH);
        ctx.font = FONT;
        ctx.textBaseline = 'middle';
        const plotRight = view.plotLeft + view.plotW;
        const volBottom = view.volTop + view.volH;

        // 网格 + 右侧价格刻度
        for (let t = 0; t < PRICE_TICKS; t++) {
            const p = curMin + (t / (PRICE_TICKS - 1)) * (curMax - curMin);
            const y = yOf(p);
            ctx.strokeStyle = PALETTE.grid;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(view.plotLeft, y);
            ctx.lineTo(plotRight, y);
            ctx.stroke();
            ctx.fillStyle = PALETTE.axisText;
            ctx.textAlign = 'left';
            ctx.fillText(formatPrice(p), plotRight + 6, y);
        }

        // 纵向时间刻度（每 TIME_GAP 根一条，随滑入偏移滚动）
        ctx.textAlign = 'center';
        for (let i = 0; i < n; i += TIME_GAP) {
            const cx = xOf(i);
            ctx.strokeStyle = PALETTE.grid;
            ctx.beginPath();
            ctx.moveTo(cx, view.plotTop);
            ctx.lineTo(cx, volBottom);
            ctx.stroke();
            ctx.fillStyle = PALETTE.axisText;
            const label = new Date(lastKs[i].ts).toLocaleTimeString('zh-CN', { hour12: false });
            ctx.fillText(label, cx, volBottom + AXIS_H / 2);
        }

        // K线 + 成交量：clip 绘图区，滑入期间不侵入坐标轴
        ctx.save();
        ctx.beginPath();
        ctx.rect(view.plotLeft - 2, view.plotTop - 2, view.plotW + 4, volBottom - view.plotTop + 4);
        ctx.clip();
        const bodyW = Math.max(view.slotW * 0.66, 1.5);

        // 成交量副图（半透明，与 K线同色系）
        ctx.globalAlpha = 0.4;
        for (let i = 0; i < n; i++) {
            const k = lastKs[i];
            const h = (k.v / curVolMax) * (view.volH - 4);
            ctx.fillStyle = klineColorCss(k);
            ctx.fillRect(xOf(i) - bodyW / 2, volBottom - h, bodyW, h);
        }
        ctx.globalAlpha = 1;

        // 影线（grow 收缩围绕中心，形成生长动画）
        ctx.lineWidth = 1;
        for (let i = 0; i < n; i++) {
            const grow = curGrow[i];
            if (grow < 0.01) continue;
            const k = lastKs[i];
            const top = yOf(k.h);
            const bot = yOf(k.l);
            const cy = (top + bot) / 2;
            const half = ((bot - top) / 2) * grow;
            ctx.strokeStyle = klineColorCss(k);
            ctx.beginPath();
            ctx.moveTo(xOf(i), cy - half);
            ctx.lineTo(xOf(i), cy + half);
            ctx.stroke();
        }

        // 实体（最小高度 1px，doji 可见）
        for (let i = 0; i < n; i++) {
            const grow = curGrow[i];
            if (grow < 0.01) continue;
            const k = lastKs[i];
            const yO = yOf(k.o);
            const yC = yOf(k.c);
            const top = Math.min(yO, yC);
            const h = Math.max(Math.abs(yO - yC), 1);
            const cy = top + h / 2;
            const gh = (h / 2) * grow;
            ctx.fillStyle = klineColorCss(k);
            ctx.fillRect(xOf(i) - bodyW / 2, cy - gh, bodyW, gh * 2);
        }

        // 悬停槽位高亮（淡入淡出）
        if (hoveredId >= 0 && hoveredId < n && curHoverAlpha > 0.01) {
            const x = xOf(hoveredId) - view.slotW / 2 + 1;
            ctx.globalAlpha = curHoverAlpha;
            ctx.fillStyle = 'rgba(226, 232, 240, 0.07)';
            ctx.fillRect(x, view.plotTop, view.slotW - 2, volBottom - view.plotTop);
            ctx.strokeStyle = PALETTE.hoverRing;
            ctx.strokeRect(x, view.plotTop, view.slotW - 2, volBottom - view.plotTop);
            ctx.globalAlpha = 1;
        }
        ctx.restore();

        // 当前价虚线 + 右缘价签（色随窗口末根涨跌）
        const priceY = yOf(curPrice);
        if (hasData && priceY >= view.plotTop && priceY <= volBottom) {
            const lastK = lastKs[n - 1];
            const dirColor = lastK ? klineColorCss(lastK) : PALETTE.pointer;
            ctx.strokeStyle = PALETTE.pointer;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(view.plotLeft, priceY);
            ctx.lineTo(plotRight, priceY);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = dirColor;
            ctx.fillRect(plotRight + 2, priceY - 9, AXIS_W - 6, 18);
            ctx.fillStyle = '#0b1220';
            ctx.textAlign = 'center';
            ctx.font = 'bold 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
            ctx.fillText(formatPrice(curPrice), plotRight + 2 + (AXIS_W - 6) / 2, priceY);
            ctx.font = FONT;
        }

        // 十字光标（x 吸附命中柱中心，y 跟随鼠标；轴上气泡反解数值）
        if (pointer && hoveredId >= 0 && hoveredId < n) {
            const cx = xOf(hoveredId);
            const py = Math.min(Math.max(pointer.y, view.plotTop), volBottom);
            ctx.strokeStyle = PALETTE.crosshair;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(cx, view.plotTop);
            ctx.lineTo(cx, volBottom);
            ctx.moveTo(view.plotLeft, py);
            ctx.lineTo(plotRight, py);
            ctx.stroke();
            ctx.setLineDash([]);
            // 右轴价格气泡
            const bp = formatPrice(priceAt(py));
            ctx.fillStyle = PALETTE.bubbleBg;
            ctx.fillRect(plotRight + 2, py - 9, AXIS_W - 6, 18);
            ctx.fillStyle = PALETTE.bubbleText;
            ctx.textAlign = 'center';
            ctx.fillText(bp, plotRight + 2 + (AXIS_W - 6) / 2, py);
            // 底轴时间气泡
            const bl = new Date(lastKs[hoveredId].ts).toLocaleTimeString('zh-CN', { hour12: false });
            ctx.fillStyle = PALETTE.bubbleBg;
            const bw = AXIS_W + 14;
            ctx.fillRect(cx - bw / 2, volBottom + 3, bw, AXIS_H - 6);
            ctx.fillStyle = PALETTE.bubbleText;
            ctx.fillText(bl, cx, volBottom + AXIS_H / 2);
        }
    };

    // —— hover：pointermove 只记录坐标，帧内统一算命中并回调（与鼠标事件率解耦） ——
    interface PointerState { x: number; y: number; cx: number; cy: number }
    let pointer: PointerState | null = null;
    let hoverHandler: ((info: HoverInfo2D | null) => void) | null = null;
    let lastEmitKey = '';

    const updateHover = (): void => {
        const n = lastKs.length;
        let idx = -1;
        if (pointer && n > 0
            && pointer.x >= view.plotLeft && pointer.x <= view.plotLeft + view.plotW
            && pointer.y >= view.plotTop && pointer.y <= view.volTop + view.volH) {
            const rel = pointer.x - view.plotLeft - curSlide;
            idx = Math.min(Math.max(Math.floor(rel / view.slotW), 0), n - 1);
        }
        if (idx !== hoveredId) {
            hoveredId = idx;
            tgtHoverAlpha = idx >= 0 ? 1 : 0;
        }
        if (!hoverHandler) return;
        if (idx >= 0 && pointer) {
            const key = `${idx}|${Math.round(pointer.cx)}|${Math.round(pointer.cy)}`;
            if (key !== lastEmitKey) {
                lastEmitKey = key;
                hoverHandler({
                    kline: lastKs[idx],
                    index: idx,
                    price: priceAt(Math.min(Math.max(pointer.y, view.plotTop), view.plotTop + view.plotH)),
                    clientX: pointer.cx,
                    clientY: pointer.cy,
                });
            }
        } else if (lastEmitKey !== '') {
            lastEmitKey = '';
            hoverHandler(null);
        }
    };

    const onPointerMove = (e: PointerEvent): void => {
        const rect = canvas.getBoundingClientRect();
        pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top, cx: e.clientX, cy: e.clientY };
        invalidate();
    };
    const onPointerLeave = (): void => {
        pointer = null;
        invalidate();
    };
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);

    // —— 按需渲染 + 动画延续（骨架与 3D 引擎一致） ——
    let needsRender = true;
    let lastSig = '';
    const invalidate = (): void => { needsRender = true; };

    const animate = (): void => {
        frameId = requestAnimationFrame(animate);
        const snap = getActiveSnapshot();
        const lastTs = snap && snap.klines.length > 0 ? snap.klines[snap.klines.length - 1].ts : 0;
        // sig 比 3D 多 lastPrice：价格线获得 tick 级平滑（recompute ~80ms 一次，60 次循环可忽略）
        const sig = snap ? `${snap.symbol}|${snap.klines.length}|${lastTs}|${snap.lastPrice}` : '';
        if (sig !== lastSig) {
            lastSig = sig;
            if (snap) recompute(snap, lastTs);
            needsRender = true;
        }
        updateHover();
        const moving = step();
        if (needsRender || moving) {
            draw();
            needsRender = false;
        }
    };
    let frameId = requestAnimationFrame(animate);

    // —— 自适应：ResizeObserver 监听容器（覆盖侧栏折叠等 resize 捕获不到的场景） ——
    const handleResize = (): void => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w === 0 || h === 0) return;
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        const dpr = Math.min(window.devicePixelRatio, isMobile ? DPR_CAP_MOBILE : DPR_CAP);
        // DPR 铁律：width 赋值会清空画布并重置 transform，必须随后 setTransform
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        view.cssW = w;
        view.cssH = h;
        view.plotW = w - view.plotLeft - AXIS_W;
        view.volH = (h - AXIS_H) * VOLUME_RATIO;
        view.plotH = h - AXIS_H - view.plotTop - view.volH - 4;
        view.volTop = view.plotTop + view.plotH + 4;
        view.slotW = view.plotW / WINDOW_SIZE;
        invalidate();
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    return {
        invalidate,
        resize: handleResize,
        setHoverHandler: (cb) => { hoverHandler = cb; },
        destroy: () => {
            resizeObserver.disconnect();
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('pointerleave', onPointerLeave);
            cancelAnimationFrame(frameId);
            if (canvas.parentNode === container) container.removeChild(canvas);
        },
    };
};
