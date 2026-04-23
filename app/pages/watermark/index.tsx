import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Card, Typography, Button, Space, Input, Slider,
    ColorPicker, Segmented, Switch, Select, Upload,
    Row, Col, Divider, message, Watermark,
} from 'antd';
import {
    DownloadOutlined, UndoOutlined, UploadOutlined,
    FileImageOutlined, LayoutOutlined, SafetyOutlined,
} from '@ant-design/icons';

type WatermarkMode = 'page' | 'file' | 'content';
type WatermarkPosition = 'tile' | 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

interface WatermarkConfig {
    text: string;
    fontSize: number;
    color: string;
    rotation: number;
    gapX: number;
    gapY: number;
    opacity: number;
    movable: boolean;
}

const DEFAULT_CONFIG: WatermarkConfig = {
    text: '机密文件 CONFIDENTIAL',
    fontSize: 16,
    color: '#000000',
    rotation: -22,
    gapX: 100,
    gapY: 100,
    opacity: 0.15,
    movable: false,
};

const MODE_OPTIONS = [
    { label: '页面水印', value: 'page' as WatermarkMode },
    { label: '文件下载', value: 'file' as WatermarkMode },
    { label: '内容水印', value: 'content' as WatermarkMode },
];

const POSITION_OPTIONS = [
    { label: '平铺', value: 'tile' as WatermarkPosition },
    { label: '居中', value: 'center' as WatermarkPosition },
    { label: '右下角', value: 'bottom-right' as WatermarkPosition },
    { label: '左下角', value: 'bottom-left' as WatermarkPosition },
    { label: '右上角', value: 'top-right' as WatermarkPosition },
    { label: '左上角', value: 'top-left' as WatermarkPosition },
];

// --- 示例文档内容 ---
const SAMPLE_TEXT = [
    '这是一段示例文档内容，用于演示页面水印效果。在实际应用中，水印通常用于保护敏感文档，防止未经授权的复制或截图传播。',
    '水印可以包含公司名称、用户信息、时间戳等标识内容。当文档被截图或拍照外传时，水印可以帮助追溯信息来源。',
    '本工具支持自定义水印文本、字体大小、颜色、旋转角度、透明度和间距等参数，满足不同场景的安全需求。',
    '除了文本水印外，系统还支持在图片上添加水印并导出，适用于图片版权保护和品牌标识。',
];

export default function WatermarkTool() {
    const [mode, setMode] = useState<WatermarkMode>('page');
    const [config, setConfig] = useState<WatermarkConfig>({ ...DEFAULT_CONFIG });

    // 文件模式状态
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
    const [fileName, setFileName] = useState('');
    const [position, setPosition] = useState<WatermarkPosition>('tile');
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);

    const updateConfig = <K extends keyof WatermarkConfig>(key: K, value: WatermarkConfig[K]) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleReset = () => {
        setConfig({ ...DEFAULT_CONFIG });
        message.success('已重置为默认配置');
    };

    // --- 文件模式：图片上传 ---
    const handleImageUpload = (file: File) => {
        if (!file.type.startsWith('image/')) {
            message.error('请上传图片文件');
            return false;
        }

        if (imageUrl) URL.revokeObjectURL(imageUrl);

        const url = URL.createObjectURL(file);
        setImageUrl(url);
        setFileName(file.name);

        const img = new Image();
        img.onload = () => setImageEl(img);
        img.src = url;

        return false;
    };

    // --- 文件模式：Canvas 水印渲染 ---
    const renderWatermarkedCanvas = useCallback((img: HTMLImageElement, cfg: WatermarkConfig, pos: WatermarkPosition): HTMLCanvasElement => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;

        // 绘制原始图片
        ctx.drawImage(img, 0, 0);

        // 应用水印
        ctx.globalAlpha = cfg.opacity;
        ctx.fillStyle = cfg.color;
        ctx.font = `bold ${cfg.fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const radians = (cfg.rotation * Math.PI) / 180;
        const { width: cw, height: ch } = canvas;

        if (pos === 'tile') {
            for (let y = -ch; y < ch * 2; y += cfg.gapY) {
                for (let x = -cw; x < cw * 2; x += cfg.gapX) {
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.rotate(radians);
                    ctx.fillText(cfg.text, 0, 0);
                    ctx.restore();
                }
            }
        } else {
            const padding = 40;
            let tx = cw / 2;
            let ty = ch / 2;

            if (pos === 'top-left') { tx = padding + 100; ty = padding + 20; }
            else if (pos === 'top-right') { tx = cw - padding - 100; ty = padding + 20; }
            else if (pos === 'bottom-left') { tx = padding + 100; ty = ch - padding - 20; }
            else if (pos === 'bottom-right') { tx = cw - padding - 100; ty = ch - padding - 20; }

            ctx.save();
            ctx.translate(tx, ty);
            ctx.rotate(radians);
            ctx.fillText(cfg.text, 0, 0);
            ctx.restore();
        }

        ctx.globalAlpha = 1;
        return canvas;
    }, []);

    // --- 文件模式：预览渲染 ---
    useEffect(() => {
        if (mode !== 'file' || !imageEl || !previewCanvasRef.current) return;

        const previewCanvas = previewCanvasRef.current;
        const container = previewCanvas.parentElement;
        if (!container) return;

        const maxW = container.clientWidth;
        const maxH = 500;
        const scale = Math.min(maxW / imageEl.naturalWidth, maxH / imageEl.naturalHeight, 1);

        previewCanvas.width = imageEl.naturalWidth * scale;
        previewCanvas.height = imageEl.naturalHeight * scale;

        const watermarked = renderWatermarkedCanvas(imageEl, config, position);
        const ctx = previewCanvas.getContext('2d')!;
        ctx.drawImage(watermarked, 0, 0, previewCanvas.width, previewCanvas.height);
    }, [mode, imageEl, config, position, renderWatermarkedCanvas]);

    // --- 文件模式：下载 ---
    const handleDownload = () => {
        if (!imageEl) { message.warning('请先上传图片'); return; }

        const canvas = renderWatermarkedCanvas(imageEl, config, position);
        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `watermarked_${fileName}`;
            a.click();
            URL.revokeObjectURL(url);
            message.success('下载成功');
        }, 'image/png');
    };

    // 清理
    useEffect(() => {
        return () => {
            if (imageUrl) URL.revokeObjectURL(imageUrl);
        };
    }, [imageUrl]);

    // --- antd Watermark props ---
    const watermarkProps = {
        content: [config.text],
        fontColor: config.color,
        fontSize: config.fontSize,
        rotate: (config.rotation * Math.PI) / 180,
        gap: [config.gapX, config.gapY] as [number, number],
        width: 120,
        height: 64,
        movable: config.movable,
    };

    // --- 配置面板 ---
    const renderConfigPanel = () => (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
                <Typography.Text strong>水印文本</Typography.Text>
                <Input
                    value={config.text}
                    onChange={e => updateConfig('text', e.target.value)}
                    placeholder="输入水印文本"
                    style={{ marginTop: 4 }}
                />
            </div>

            <Divider style={{ margin: '8px 0' }} />

            <div>
                <Typography.Text strong>字号：{config.fontSize}px</Typography.Text>
                <Slider min={12} max={48} value={config.fontSize} onChange={v => updateConfig('fontSize', v)} />
            </div>

            <div>
                <Typography.Text strong>颜色</Typography.Text>
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ColorPicker
                        value={config.color}
                        onChange={(_, hex) => updateConfig('color', hex)}
                        disabledAlpha
                    />
                    <Typography.Text code>{config.color}</Typography.Text>
                </div>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            <div>
                <Typography.Text strong>旋转角度：{config.rotation}°</Typography.Text>
                <Slider
                    min={-180} max={180} value={config.rotation}
                    onChange={v => updateConfig('rotation', v)}
                    marks={{ '-45': '-45°', 0: '0°', 45: '45°' }}
                />
            </div>

            <div>
                <Typography.Text strong>水平间距：{config.gapX}px</Typography.Text>
                <Slider min={20} max={400} value={config.gapX} onChange={v => updateConfig('gapX', v)} />
            </div>

            <div>
                <Typography.Text strong>垂直间距：{config.gapY}px</Typography.Text>
                <Slider min={20} max={400} value={config.gapY} onChange={v => updateConfig('gapY', v)} />
            </div>

            <Divider style={{ margin: '8px 0' }} />

            <div>
                <Typography.Text strong>透明度：{config.opacity.toFixed(2)}</Typography.Text>
                <Slider min={0.05} max={1} step={0.05} value={config.opacity} onChange={v => updateConfig('opacity', v)} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Typography.Text strong>跟随鼠标</Typography.Text>
                <Switch checked={config.movable} onChange={v => updateConfig('movable', v)} />
            </div>

            {/* 文件模式额外配置 */}
            {mode === 'file' && (
                <>
                    <Divider style={{ margin: '8px 0' }} />
                    <div>
                        <Typography.Text strong>水印定位</Typography.Text>
                        <Select
                            value={position}
                            onChange={setPosition}
                            options={POSITION_OPTIONS}
                            style={{ width: '100%', marginTop: 4 }}
                        />
                    </div>
                    <Upload
                        accept=".png,.jpg,.jpeg,.webp,.bmp"
                        showUploadList={false}
                        beforeUpload={handleImageUpload}
                    >
                        <Button icon={<UploadOutlined />} block>上传图片</Button>
                    </Upload>
                    <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={handleDownload}
                        disabled={!imageEl}
                        block
                    >
                        下载水印图片
                    </Button>
                </>
            )}

            <Divider style={{ margin: '8px 0' }} />
            <Button icon={<UndoOutlined />} onClick={handleReset} block>重置配置</Button>
        </Space>
    );

    // --- 预览区域 ---
    const renderPreview = () => {
        if (mode === 'page') {
            return (
                <Watermark {...watermarkProps}>
                    <div style={{
                        background: '#fff',
                        padding: 40,
                        minHeight: '60vh',
                        borderRadius: 8,
                        border: '1px solid #f0f0f0',
                    }}>
                        <Typography.Title level={4} style={{ marginBottom: 16 }}>
                            <SafetyOutlined /> 机密文档示例 — 项目技术方案
                        </Typography.Title>
                        <Typography.Text type="secondary">文档编号：DOC-2026-0423 &nbsp;|&nbsp; 密级：机密</Typography.Text>
                        <Divider />
                        {SAMPLE_TEXT.map((p, i) => (
                            <Typography.Paragraph key={i} style={{ textIndent: '2em', lineHeight: 1.8 }}>
                                {p}
                            </Typography.Paragraph>
                        ))}
                        <Divider />
                        <Typography.Text type="secondary">
                            本文档受公司信息安全管理制度保护，未经授权不得复制、传播或用于其他目的。
                        </Typography.Text>
                    </div>
                </Watermark>
            );
        }

        if (mode === 'file') {
            return (
                <Card
                    title={imageEl ? `预览：${fileName}` : '图片预览'}
                    style={{ minHeight: 300 }}
                >
                    {imageEl ? (
                        <div style={{ textAlign: 'center', overflow: 'auto' }}>
                            <canvas
                                ref={previewCanvasRef}
                                style={{ maxWidth: '100%', border: '1px solid #f0f0f0', borderRadius: 4 }}
                            />
                        </div>
                    ) : (
                        <Upload
                            accept=".png,.jpg,.jpeg,.webp,.bmp"
                            showUploadList={false}
                            beforeUpload={handleImageUpload}
                        >
                            <div style={{
                                padding: '60px 0',
                                textAlign: 'center',
                                border: '2px dashed #d9d9d9',
                                borderRadius: 8,
                                cursor: 'pointer',
                                transition: 'border-color 0.3s',
                            }}>
                                <FileImageOutlined style={{ fontSize: 48, color: '#bbb' }} />
                                <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
                                    点击或拖拽上传图片
                                </Typography.Paragraph>
                            </div>
                        </Upload>
                    )}
                </Card>
            );
        }

        // content 模式
        return (
            <Watermark {...watermarkProps}>
                <Row gutter={16}>
                    <Col span={12}>
                        <Card title="用户信息" style={{ minHeight: 250 }}>
                            <Typography.Text strong>姓名：</Typography.Text><Typography.Text>张三</Typography.Text><br />
                            <Typography.Text strong>部门：</Typography.Text><Typography.Text>技术研发部</Typography.Text><br />
                            <Typography.Text strong>工号：</Typography.Text><Typography.Text>EMP-20260423</Typography.Text><br />
                            <Typography.Text strong>邮箱：</Typography.Text><Typography.Text>zhangsan@example.com</Typography.Text><br />
                            <Divider style={{ margin: '12px 0' }} />
                            <Typography.Text type="secondary">
                                此信息受内容水印保护，截图传播可追溯到当前用户。
                            </Typography.Text>
                        </Card>
                    </Col>
                    <Col span={12}>
                        <Card title="财务数据" style={{ minHeight: 250 }}>
                            <Typography.Text strong>季度营收：</Typography.Text><Typography.Text>¥ 1,280,000</Typography.Text><br />
                            <Typography.Text strong>净利润：</Typography.Text><Typography.Text>¥ 360,000</Typography.Text><br />
                            <Typography.Text strong>增长率：</Typography.Text><Typography.Text>12.5%</Typography.Text><br />
                            <Divider style={{ margin: '12px 0' }} />
                            <Typography.Text type="secondary">
                                敏感财务数据，仅限内部查看，水印用于防止数据泄露。
                            </Typography.Text>
                        </Card>
                    </Col>
                </Row>
            </Watermark>
        );
    };

    return (
        <div>
            <Typography.Title level={3} style={{ marginBottom: 16 }}>
                <LayoutOutlined /> 水印工具
            </Typography.Title>

            <Card style={{ marginBottom: 16 }}>
                <Space>
                    <Typography.Text strong>模式：</Typography.Text>
                    <Segmented
                        value={mode}
                        onChange={v => setMode(v as WatermarkMode)}
                        options={MODE_OPTIONS}
                    />
                </Space>
            </Card>

            <Row gutter={16}>
                <Col xs={24} lg={8}>
                    <Card
                        title={<><SafetyOutlined /> 水印配置</>}
                        style={{ marginBottom: 16 }}
                    >
                        {renderConfigPanel()}
                    </Card>
                </Col>
                <Col xs={24} lg={16}>
                    <Card title="预览" style={{ marginBottom: 16 }}>
                        {renderPreview()}
                    </Card>
                </Col>
            </Row>
        </div>
    );
}
