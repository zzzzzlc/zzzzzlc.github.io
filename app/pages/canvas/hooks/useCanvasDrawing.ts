import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import type { CanvasController, DrawStyle, HistoryEntry, Point, Tool } from '../types';
import {
    applyStyle, drawCircleByCenter, drawDot, drawRectByCenter, drawTriangleByCenter,
} from '../utils/draw';

/**
 * 画板核心逻辑聚合 hook：绘制状态、历史栈、画布事件、撤销/重做/清空/下载
 */
export const useCanvasDrawing = (): CanvasController => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [tool, setTool] = useState<Tool>('pen');
    const [strokeColor, setStrokeColor] = useState('#000000');
    const [fillColor, setFillColor] = useState('#ffffff');
    const [fillEnabled, setFillEnabled] = useState(false);
    const [lineWidth, setLineWidth] = useState(3);
    const [opacity, setOpacity] = useState(100);
    const [dotSize, setDotSize] = useState(10);
    const [rectW, setRectW] = useState(100);
    const [rectH, setRectH] = useState(80);
    const [circleR, setCircleR] = useState(40);
    const [fixedSize, setFixedSize] = useState(false);
    const [drawing, setDrawing] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [cursor, setCursor] = useState<Point | null>(null);

    const startPos = useRef<Point>({ x: 0, y: 0 });
    const snapshotRef = useRef<ImageData | null>(null);
    // 用 ref 跟踪 historyIndex / history，避免 saveToHistory 闭包陈旧
    const historyIndexRef = useRef(-1);
    const historyRef = useRef<HistoryEntry[]>([]);

    // 由样式状态派生的绘制样式，传给纯绘制函数
    const drawStyle: DrawStyle = {
        strokeColor, fillColor, fillEnabled, lineWidth, opacity, dotSize,
    };

    const getCtx = useCallback(() => canvasRef.current?.getContext('2d') ?? null, []);

    const saveToHistory = useCallback(() => {
        const ctx = getCtx();
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const next = historyRef.current.slice(0, historyIndexRef.current + 1);
        next.push({ data });
        historyRef.current = next;
        historyIndexRef.current = next.length - 1;
        setHistory(next);
        setHistoryIndex(next.length - 1);
    }, [getCtx]);

    // 初始化画布尺寸与白底，写入初始历史
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory([{ data }]);
        historyIndexRef.current = 0;
        setHistoryIndex(0);
    }, []);

    const getPos = (e: MouseEvent<HTMLCanvasElement>): Point => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
        // 仅响应左键，避免右键（自定义菜单）触发误绘制、污染历史栈
        if (e.button !== 0) return;
        const ctx = getCtx();
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;
        const pos = getPos(e);
        startPos.current = pos;

        // 点工具：单击即放置
        if (tool === 'dot') {
            applyStyle(ctx, drawStyle);
            drawDot(ctx, pos.x, pos.y, drawStyle);
            saveToHistory();
            return;
        }

        // 固定尺寸的形状：单击放置（以点击点为中心）
        if (fixedSize && (tool === 'rect' || tool === 'circle' || tool === 'triangle')) {
            applyStyle(ctx, drawStyle);
            if (tool === 'rect') drawRectByCenter(ctx, pos.x, pos.y, rectW, rectH, drawStyle);
            else if (tool === 'circle') drawCircleByCenter(ctx, pos.x, pos.y, circleR, drawStyle);
            else drawTriangleByCenter(ctx, pos.x, pos.y, rectW, rectH, drawStyle);
            saveToHistory();
            return;
        }

        // 自由模式：开始拖拽绘制
        setDrawing(true);
        if (tool === 'pen' || tool === 'eraser') {
            applyStyle(ctx, drawStyle, tool === 'eraser');
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        }
        // 形状预览快照
        snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    };

    const onMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
        const ctx = getCtx();
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;
        const pos = getPos(e);
        setCursor(pos);

        if (!drawing) return;

        if (tool === 'pen' || tool === 'eraser') {
            applyStyle(ctx, drawStyle, tool === 'eraser');
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            return;
        }

        if (snapshotRef.current) {
            ctx.putImageData(snapshotRef.current, 0, 0);
            applyStyle(ctx, drawStyle);
            const sx = startPos.current.x;
            const sy = startPos.current.y;

            if (tool === 'line') {
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
            } else if (tool === 'rect') {
                drawRectByCenter(ctx, (sx + pos.x) / 2, (sy + pos.y) / 2, Math.abs(pos.x - sx), Math.abs(pos.y - sy), drawStyle);
            } else if (tool === 'circle') {
                const r = Math.hypot(pos.x - sx, pos.y - sy) / 2;
                drawCircleByCenter(ctx, (sx + pos.x) / 2, (sy + pos.y) / 2, r, drawStyle);
            } else if (tool === 'triangle') {
                drawTriangleByCenter(ctx, (sx + pos.x) / 2, (sy + pos.y) / 2, Math.abs(pos.x - sx), Math.abs(pos.y - sy), drawStyle);
            }
        }
    };

    const onMouseUp = () => {
        if (drawing) {
            setDrawing(false);
            saveToHistory();
        }
    };

    const onMouseLeave = () => {
        setCursor(null);
        onMouseUp();
    };

    const handleUndo = () => {
        const ctx = getCtx();
        if (!ctx || historyIndexRef.current <= 0) return;
        const newIndex = historyIndexRef.current - 1;
        ctx.putImageData(historyRef.current[newIndex].data, 0, 0);
        setHistoryIndex(newIndex);
    };

    const handleRedo = () => {
        const ctx = getCtx();
        if (!ctx || historyIndexRef.current >= historyRef.current.length - 1) return;
        const newIndex = historyIndexRef.current + 1;
        ctx.putImageData(historyRef.current[newIndex].data, 0, 0);
        setHistoryIndex(newIndex);
    };

    const handleClear = () => {
        const ctx = getCtx();
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        saveToHistory();
    };

    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = 'canvas-drawing.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;

    return {
        canvasRef, cursor, tool, setTool,
        strokeColor, setStrokeColor, fillColor, setFillColor,
        fillEnabled, setFillEnabled, lineWidth, setLineWidth,
        opacity, setOpacity, dotSize, setDotSize,
        rectW, setRectW, rectH, setRectH, circleR, setCircleR,
        fixedSize, setFixedSize, canUndo, canRedo,
        onMouseDown, onMouseMove, onMouseUp, onMouseLeave,
        handleUndo, handleRedo, handleClear, handleDownload,
    };
};
