import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Button, Space, ColorPicker, Slider, Card, Typography, Select, Tooltip } from 'antd';
import {
    UndoOutlined,
    RedoOutlined,
    DeleteOutlined,
    DownloadOutlined,
} from '@ant-design/icons';

type Tool = 'pen' | 'eraser' | 'line' | 'rect' | 'circle';

interface HistoryEntry {
    data: ImageData;
}

export default function CanvasBoard() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [tool, setTool] = useState<Tool>('pen');
    const [color, setColor] = useState('#000000');
    const [lineWidth, setLineWidth] = useState(3);
    const [drawing, setDrawing] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const startPos = useRef({ x: 0, y: 0 });
    const snapshotRef = useRef<ImageData | null>(null);

    const getCtx = useCallback(() => {
        return canvasRef.current?.getContext('2d') ?? null;
    }, []);

    const saveToHistory = useCallback(() => {
        const ctx = getCtx();
        if (!ctx || !canvasRef.current) return;
        const data = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({ data });
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex, getCtx]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Save initial state
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory([{ data }]);
        setHistoryIndex(0);
    }, []);

    const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const ctx = getCtx();
        if (!ctx || !canvasRef.current) return;
        setDrawing(true);
        const pos = getPos(e);
        startPos.current = pos;

        if (tool === 'pen' || tool === 'eraser') {
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        }
        // Save snapshot for shape preview
        snapshotRef.current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const ctx = getCtx();
        if (!ctx || !drawing) return;
        const pos = getPos(e);

        if (tool === 'pen') {
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        } else if (tool === 'eraser') {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = lineWidth * 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        } else if (snapshotRef.current) {
            // Restore snapshot then draw shape preview
            ctx.putImageData(snapshotRef.current, 0, 0);
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            const sx = startPos.current.x;
            const sy = startPos.current.y;

            if (tool === 'line') {
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
            } else if (tool === 'rect') {
                ctx.beginPath();
                ctx.strokeRect(sx, sy, pos.x - sx, pos.y - sy);
            } else if (tool === 'circle') {
                const rx = Math.abs(pos.x - sx) / 2;
                const ry = Math.abs(pos.y - sy) / 2;
                const cx = sx + (pos.x - sx) / 2;
                const cy = sy + (pos.y - sy) / 2;
                ctx.beginPath();
                ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    };

    const handleMouseUp = () => {
        if (drawing) {
            setDrawing(false);
            saveToHistory();
        }
    };

    const handleUndo = () => {
        const ctx = getCtx();
        if (!ctx || historyIndex <= 0) return;
        const newIndex = historyIndex - 1;
        ctx.putImageData(history[newIndex].data, 0, 0);
        setHistoryIndex(newIndex);
    };

    const handleRedo = () => {
        const ctx = getCtx();
        if (!ctx || historyIndex >= history.length - 1) return;
        const newIndex = historyIndex + 1;
        ctx.putImageData(history[newIndex].data, 0, 0);
        setHistoryIndex(newIndex);
    };

    const handleClear = () => {
        const ctx = getCtx();
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;
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

    const tools: { key: Tool; label: string }[] = [
        { key: 'pen', label: '画笔' },
        { key: 'eraser', label: '橡皮擦' },
        { key: 'line', label: '直线' },
        { key: 'rect', label: '矩形' },
        { key: 'circle', label: '圆形' },
    ];

    return (
        <div>
            <Typography.Title level={3} style={{ marginBottom: 16 }}>Canvas 画板</Typography.Title>
            <Card style={{ marginBottom: 16 }}>
                <Space wrap size="middle">
                    <Select
                        value={tool}
                        onChange={setTool}
                        style={{ width: 100 }}
                        options={tools.map(t => ({ value: t.key, label: t.label }))}
                    />
                    <Tooltip title="颜色">
                        <ColorPicker
                            value={color}
                            onChange={(_, hex) => setColor(hex)}
                            disabledAlpha
                        />
                    </Tooltip>
                    <Tooltip title="线条粗细">
                        <Slider
                            min={1}
                            max={30}
                            value={lineWidth}
                            onChange={setLineWidth}
                            style={{ width: 120, margin: 0 }}
                        />
                    </Tooltip>
                    <Tooltip title="撤销">
                        <Button icon={<UndoOutlined />} onClick={handleUndo} disabled={historyIndex <= 0} />
                    </Tooltip>
                    <Tooltip title="重做">
                        <Button icon={<RedoOutlined />} onClick={handleRedo} disabled={historyIndex >= history.length - 1} />
                    </Tooltip>
                    <Tooltip title="清空">
                        <Button icon={<DeleteOutlined />} onClick={handleClear} danger />
                    </Tooltip>
                    <Tooltip title="下载">
                        <Button icon={<DownloadOutlined />} onClick={handleDownload} type="primary" />
                    </Tooltip>
                </Space>
            </Card>
            <Card bodyStyle={{ padding: 0, overflow: 'hidden' }}>
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
                    onMouseLeave={handleMouseUp}
                />
            </Card>
        </div>
    );
}
