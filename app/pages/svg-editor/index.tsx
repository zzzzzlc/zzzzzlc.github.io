import React, { useState, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { Row, Col, Card, Typography, Button, Space, message } from 'antd';
import { CopyOutlined, DownloadOutlined, UndoOutlined } from '@ant-design/icons';

const DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <rect width="400" height="300" fill="#f0f2f5" rx="8"/>

  <!-- 太阳 -->
  <circle cx="320" cy="60" r="40" fill="#ffd93d"/>
  <circle cx="320" cy="60" r="48" fill="none" stroke="#ffd93d" stroke-width="2" opacity="0.4"/>

  <!-- 山 -->
  <polygon points="0,300 120,120 240,300" fill="#2d6a4f"/>
  <polygon points="140,300 280,90 420,300" fill="#40916c"/>
  <polygon points="80,300 200,160 320,300" fill="#52b788" opacity="0.7"/>

  <!-- 树 -->
  <rect x="60" y="220" width="8" height="30" fill="#6b4226"/>
  <polygon points="44,230 64,180 84,230" fill="#2d6a4f"/>
  <polygon points="48,210 64,170 80,210" fill="#40916c"/>

  <!-- 湖 -->
  <ellipse cx="200" cy="260" rx="180" ry="30" fill="#74c0fc" opacity="0.6"/>
</svg>`;

const SAMPLES: { label: string; code: string }[] = [
    {
        label: '风景画',
        code: DEFAULT_SVG,
    },
    {
        label: '几何图形',
        code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <rect width="400" height="300" fill="#1a1a2e"/>
  <rect x="50" y="50" width="100" height="100" fill="#e94560" rx="8" opacity="0.9"/>
  <circle cx="250" cy="100" r="60" fill="#0f3460" stroke="#16213e" stroke-width="4"/>
  <polygon points="200,250 250,170 300,250" fill="#533483" opacity="0.9"/>
  <line x1="50" y1="250" x2="350" y2="250" stroke="#e94560" stroke-width="2" stroke-dasharray="8"/>
</svg>`,
    },
    {
        label: '笑脸',
        code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="400" height="400">
  <circle cx="100" cy="100" r="90" fill="#ffd93d" stroke="#f0a500" stroke-width="4"/>
  <circle cx="70" cy="80" r="12" fill="#333"/>
  <circle cx="130" cy="80" r="12" fill="#333"/>
  <circle cx="74" cy="76" r="4" fill="#fff"/>
  <circle cx="134" cy="76" r="4" fill="#fff"/>
  <path d="M 60 120 Q 100 160 140 120" fill="none" stroke="#333" stroke-width="4" stroke-linecap="round"/>
</svg>`,
    },
];

export default function SvgEditor() {
    const [code, setCode] = useState(DEFAULT_SVG);

    const svgError = useMemo(() => {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(code, 'image/svg+xml');
            const errNode = doc.querySelector('parsererror');
            return errNode ? errNode.textContent : null;
        } catch {
            return null;
        }
    }, [code]);

    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => message.success('已复制到剪贴板'));
    };

    const handleDownload = () => {
        const blob = new Blob([code], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'drawing.svg';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleReset = () => setCode(DEFAULT_SVG);

    return (
        <div>
            <Typography.Title level={3} style={{ marginBottom: 16 }}>SVG 绘制</Typography.Title>
            <Space wrap style={{ marginBottom: 16 }}>
                <Typography.Text type="secondary">示例：</Typography.Text>
                {SAMPLES.map(s => (
                    <Button key={s.label} size="small" onClick={() => setCode(s.code)}>
                        {s.label}
                    </Button>
                ))}
            </Space>
            <Row gutter={16}>
                <Col xs={24} lg={12}>
                    <Card
                        title="SVG 代码"
                        extra={
                            <Space>
                                <Button size="small" icon={<CopyOutlined />} onClick={handleCopy}>复制</Button>
                                <Button size="small" icon={<UndoOutlined />} onClick={handleReset}>重置</Button>
                            </Space>
                        }
                        bodyStyle={{ padding: 0 }}
                    >
                        <Editor
                            height="65vh"
                            language="xml"
                            value={code}
                            onChange={value => setCode(value ?? '')}
                            theme="vs-dark"
                            options={{
                                fontSize: 14,
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                wordWrap: 'on',
                                tabSize: 2,
                            }}
                        />
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    <Card
                        title="预览"
                        extra={
                            <Button size="small" icon={<DownloadOutlined />} onClick={handleDownload}>下载 SVG</Button>
                        }
                    >
                        <div style={{
                            minHeight: '65vh',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#fafafa',
                            border: '1px dashed #d9d9d9',
                            borderRadius: 8,
                            padding: 16,
                            overflow: 'auto',
                        }}>
                            {svgError ? (
                                <Typography.Text type="danger">SVG 语法错误，请检查代码</Typography.Text>
                            ) : (
                                <div dangerouslySetInnerHTML={{ __html: code }} />
                            )}
                        </div>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}
