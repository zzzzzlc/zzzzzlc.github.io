import { useRef, useState, useCallback, useEffect } from 'react';
import { Button, Space, ColorPicker, Slider, Card, Typography, Tooltip, Switch, InputNumber, Segmented, Divider } from 'antd';
import {
    UndoOutlined,
    RedoOutlined,
    DeleteOutlined,
    DownloadOutlined,
    EditOutlined,
    AimOutlined,
    LineOutlined,
    BorderOutlined,
} from '@ant-design/icons';

type Tool = 'dot' | 'pen' | 'line' | 'rect' | 'circle' | 'triangle' | 'eraser';

interface HistoryEntry {
    data: ImageData;
}

const TOOL_GROUPS: { label: string; items: { key: Tool; label: string; icon: React.ReactNode }[] }[] = [
    {
        label: '绘制',
        items: [
            { key: 'dot', label: '点', icon: <AimOutlined /> },
            { key: 'pen', label: '画笔', icon: <EditOutlined /> },
            { key: 'line', label: '直线', icon: <LineOutlined /> },
        ],
    },
    {
        label: '形状',
        items: [
            { key: 'rect', label: '矩形', icon: <BorderOutlined /> },
            { key: 'circle', label: '圆形', icon: <BorderOutlined /> },
            { key: 'triangle', label: '三角形', icon: <BorderOutlined /> },
        ],
    },
    {
        label: '编辑',
        items: [{ key: 'eraser', label: '橡皮', icon: <DeleteOutlined /> }],
    },
];

export default function CanvasBoard() {
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
    const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

    const startPos = useRef({ x: 0, y: 0 });
    const snapshotRef = useRef<ImageData | null>(null);

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

    // 用 ref 跟踪 historyIndex / history，避免 saveToHistory 闭包陈旧
    const historyIndexRef = useRef(-1);
    const historyRef = useRef<HistoryEntry[]>([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory([{ data }]);
        historyIndexRef.current = 0;
        setHistoryIndex(0);
    }, []);

    const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    // 应用通用样式（颜色、线宽、透明度）
    const applyStyle = (ctx: CanvasRenderingContext2D, isEraser = false) => {
        ctx.globalAlpha = opacity / 100;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = isEraser ? lineWidth * 4 : lineWidth;
        ctx.strokeStyle = isEraser ? '#ffffff' : strokeColor;
        ctx.fillStyle = isEraser ? '#ffffff' : fillColor;
    };

    // 在指定中心点绘制点
    const drawDot = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
        ctx.beginPath();
        ctx.arc(x, y, dotSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = strokeColor;
        ctx.fill();
    };

    // 绘制三角形：以 (cx, cy) 为中心，给定宽高
    const drawTriangleByCenter = (
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        w: number,
        h: number,
    ) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy - h / 2);
        ctx.lineTo(cx - w / 2, cy + h / 2);
        ctx.lineTo(cx + w / 2, cy + h / 2);
        ctx.closePath();
        if (fillEnabled) ctx.fill();
        ctx.stroke();
    };

    // 绘制矩形：以 (cx, cy) 为中心
    const drawRectByCenter = (
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        w: number,
        h: number,
    ) => {
        ctx.beginPath();
        ctx.rect(cx - w / 2, cy - h / 2, w, h);
        if (fillEnabled) ctx.fill();
        ctx.stroke();
    };

    // 绘制圆形：以 (cx, cy) 为中心，半径 r
    const drawCircleByCenter = (
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        r: number,
    ) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        if (fillEnabled) ctx.fill();
        ctx.stroke();
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const ctx = getCtx();
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;
        const pos = getPos(e);
        startPos.current = pos;

        // 点工具：单击即放置
        if (tool === 'dot') {
            applyStyle(ctx);
            drawDot(ctx, pos.x, pos.y);
            saveToHistory();
            return;
        }

        // 固定尺寸的形状：单击放置（以点击点为中心）
        if (fixedSize && (tool === 'rect' || tool === 'circle' || tool === 'triangle')) {
            applyStyle(ctx);
            if (tool === 'rect') drawRectByCenter(ctx, pos.x, pos.y, rectW, rectH);
            else if (tool === 'circle') drawCircleByCenter(ctx, pos.x, pos.y, circleR);
            else drawTriangleByCenter(ctx, pos.x, pos.y, rectW, rectH);
            saveToHistory();
            return;
        }

        // 自由模式：开始拖拽绘制
        setDrawing(true);
        if (tool === 'pen' || tool === 'eraser') {
            applyStyle(ctx, tool === 'eraser');
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        }
        // 形状预览快照
        snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const ctx = getCtx();
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;
        const pos = getPos(e);
        setCursor(pos);

        if (!drawing) return;

        if (tool === 'pen' || tool === 'eraser') {
            applyStyle(ctx, tool === 'eraser');
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            return;
        }

        if (snapshotRef.current) {
            ctx.putImageData(snapshotRef.current, 0, 0);
            applyStyle(ctx);
            const sx = startPos.current.x;
            const sy = startPos.current.y;

            if (tool === 'line') {
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
            } else if (tool === 'rect') {
                drawRectByCenter(ctx, (sx + pos.x) / 2, (sy + pos.y) / 2, Math.abs(pos.x - sx), Math.abs(pos.y - sy));
            } else if (tool === 'circle') {
                const r = Math.hypot(pos.x - sx, pos.y - sy) / 2;
                drawCircleByCenter(ctx, (sx + pos.x) / 2, (sy + pos.y) / 2, r);
            } else if (tool === 'triangle') {
                drawTriangleByCenter(ctx, (sx + pos.x) / 2, (sy + pos.y) / 2, Math.abs(pos.x - sx), Math.abs(pos.y - sy));
            }
        }
    };

    const handleMouseUp = () => {
        if (drawing) {
            setDrawing(false);
            saveToHistory();
        }
    };

    const handleMouseLeave = () => {
        setCursor(null);
        handleMouseUp();
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

    // 是否显示形状尺寸输入
    const showShapeSize = tool === 'rect' || tool === 'circle' || tool === 'triangle';

    return (
        <div>
            <Typography.Title level={3} style={{ marginBottom: 16 }}>Canvas 画板</Typography.Title>

            {/* 工具栏 */}
            <Card style={{ marginBottom: 16 }}>
                <Space wrap size="middle" align="center">
                    {TOOL_GROUPS.map((group, i) => (
                        <Space key={group.label} size="small" align="center">
                            {i > 0 && <Divider type="vertical" style={{ height: 28, margin: '0 4px' }} />}
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{group.label}</Typography.Text>
                            <Segmented
                                value={tool}
                                onChange={(v) => setTool(v as Tool)}
                                options={group.items.map((item) => ({
                                    value: item.key,
                                    label: (
                                        <Tooltip title={item.label}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                {item.icon}
                                                <span style={{ fontSize: 12 }}>{item.label}</span>
                                            </span>
                                        </Tooltip>
                                    ),
                                }))}
                            />
                        </Space>
                    ))}
                </Space>
            </Card>

            {/* 属性面板 */}
            <Card style={{ marginBottom: 16 }} size="small">
                <Space wrap size="middle" align="center">
                    <Tooltip title="描边颜色">
                        <Space size={4}>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>描边</Typography.Text>
                            <ColorPicker value={strokeColor} onChange={(_, hex) => setStrokeColor(hex)} disabledAlpha />
                        </Space>
                    </Tooltip>
                    <Tooltip title="填充颜色">
                        <Space size={4}>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>填充</Typography.Text>
                            <ColorPicker value={fillColor} onChange={(_, hex) => setFillColor(hex)} disabledAlpha disabled={!fillEnabled} />
                        </Space>
                    </Tooltip>
                    <Tooltip title="启用填充">
                        <Space size={4}>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>填充</Typography.Text>
                            <Switch size="small" checked={fillEnabled} onChange={setFillEnabled} />
                        </Space>
                    </Tooltip>
                    <Divider type="vertical" style={{ height: 28 }} />
                    <Tooltip title="线宽">
                        <Space size={4}>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>线宽</Typography.Text>
                            <Slider min={1} max={30} value={lineWidth} onChange={setLineWidth} style={{ width: 100, margin: 0 }} />
                            <span style={{ fontSize: 12, width: 24 }}>{lineWidth}</span>
                        </Space>
                    </Tooltip>
                    <Tooltip title="不透明度">
                        <Space size={4}>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>透明</Typography.Text>
                            <Slider min={10} max={100} value={opacity} onChange={setOpacity} style={{ width: 90, margin: 0 }} />
                            <span style={{ fontSize: 12, width: 30 }}>{opacity}%</span>
                        </Space>
                    </Tooltip>
                    <Divider type="vertical" style={{ height: 28 }} />
                    {tool === 'dot' && (
                        <Tooltip title="点直径">
                            <Space size={4}>
                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>点大小</Typography.Text>
                                <InputNumber min={1} max={200} value={dotSize} onChange={(v) => setDotSize(v ?? 10)} size="small" style={{ width: 72 }} />
                            </Space>
                        </Tooltip>
                    )}
                    {showShapeSize && (
                        <>
                            <Tooltip title="启用后单击即按指定尺寸放置；不启用则拖拽绘制">
                                <Space size={4}>
                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>固定尺寸</Typography.Text>
                                    <Switch size="small" checked={fixedSize} onChange={setFixedSize} />
                                </Space>
                            </Tooltip>
                            {fixedSize && (tool === 'rect' || tool === 'triangle') && (
                                <>
                                    <Space size={4}>
                                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>宽</Typography.Text>
                                        <InputNumber min={1} max={1000} value={rectW} onChange={(v) => setRectW(v ?? 100)} size="small" style={{ width: 72 }} />
                                    </Space>
                                    <Space size={4}>
                                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>高</Typography.Text>
                                        <InputNumber min={1} max={1000} value={rectH} onChange={(v) => setRectH(v ?? 80)} size="small" style={{ width: 72 }} />
                                    </Space>
                                </>
                            )}
                            {fixedSize && tool === 'circle' && (
                                <Space size={4}>
                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>半径</Typography.Text>
                                    <InputNumber min={1} max={500} value={circleR} onChange={(v) => setCircleR(v ?? 40)} size="small" style={{ width: 72 }} />
                                </Space>
                            )}
                        </>
                    )}
                    <Divider type="vertical" style={{ height: 28 }} />
                    <Tooltip title="撤销">
                        <Button icon={<UndoOutlined />} onClick={handleUndo} disabled={historyIndex <= 0} size="small" />
                    </Tooltip>
                    <Tooltip title="重做">
                        <Button icon={<RedoOutlined />} onClick={handleRedo} disabled={historyIndex >= history.length - 1} size="small" />
                    </Tooltip>
                    <Tooltip title="清空">
                        <Button icon={<DeleteOutlined />} onClick={handleClear} danger size="small" />
                    </Tooltip>
                    <Tooltip title="下载">
                        <Button icon={<DownloadOutlined />} onClick={handleDownload} type="primary" size="small" />
                    </Tooltip>
                </Space>
            </Card>

            <Card styles={{ body: { padding: 0, overflow: 'hidden', position: 'relative' } }}>
                <canvas
                    ref={canvasRef}
                    style={{
                        width: '100%',
                        height: '70vh',
                        cursor: tool === 'eraser' ? 'cell' : 'crosshair',
                        display: 'block',
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                />
                {/* 光标坐标显示 */}
                {cursor && (
                    <div style={{
                        position: 'absolute',
                        right: 8,
                        bottom: 8,
                        padding: '2px 8px',
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        fontSize: 12,
                        borderRadius: 4,
                        pointerEvents: 'none',
                        fontFamily: 'monospace',
                    }}>
                        x: {Math.round(cursor.x)}, y: {Math.round(cursor.y)}
                    </div>
                )}
            </Card>
        </div>
    );
}
