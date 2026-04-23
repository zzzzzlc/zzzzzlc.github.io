import React, { useState, useEffect } from 'react';
import {
    Card, Typography, ColorPicker, Slider, Button, Space, Row, Col,
    Segmented, Divider, message,
} from 'antd';
import {
    CheckOutlined, UndoOutlined, CopyOutlined,
    BgColorsOutlined, FontSizeOutlined, BorderOutlined,
} from '@ant-design/icons';

interface ThemeConfig {
    mode: 'light' | 'dark';
    primaryColor: string;
    borderRadius: number;
    fontSize: number;
    colorBgBase: string;
    colorTextBase: string;
    colorSuccess: string;
    colorWarning: string;
    colorError: string;
    fontFamily: string;
}

const DEFAULT_LIGHT: ThemeConfig = {
    mode: 'light',
    primaryColor: '#1677ff',
    borderRadius: 6,
    fontSize: 14,
    colorBgBase: '#ffffff',
    colorTextBase: '#000000',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const DEFAULT_DARK: ThemeConfig = {
    mode: 'dark',
    primaryColor: '#1668dc',
    borderRadius: 6,
    fontSize: 14,
    colorBgBase: '#141414',
    colorTextBase: '#ffffff',
    colorSuccess: '#49aa19',
    colorWarning: '#d89614',
    colorError: '#d32029',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const PRESETS = [
    { label: '默认蓝', primary: '#1677ff' },
    { label: '极客绿', primary: '#00b96b' },
    { label: '热情红', primary: '#f5222d' },
    { label: '优雅紫', primary: '#722ed1' },
    { label: '活力橙', primary: '#fa8c16' },
    { label: '深邃青', primary: '#08979c' },
    { label: '浪漫粉', primary: '#eb2f96' },
    { label: '沉稳灰', primary: '#595959' },
];

const FONT_OPTIONS = [
    { label: '系统默认', value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
    { label: '宋体', value: "'SimSun', serif" },
    { label: '黑体', value: "'SimHei', sans-serif" },
    { label: '楷体', value: "'KaiTi', serif" },
    { label: '等宽', value: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace" },
];

const STORAGE_KEY = 'blog-theme-config';

export default function ThemeCustomizer() {
    const [theme, setTheme] = useState<ThemeConfig>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try { return { ...DEFAULT_LIGHT, ...JSON.parse(saved) }; } catch { /* ignore */ }
        }
        return DEFAULT_LIGHT;
    });

    const isDark = theme.mode === 'dark';
    const bgCard = isDark ? '#1f1f1f' : '#ffffff';
    const bgBody = isDark ? '#141414' : '#f5f5f5';
    const textBase = theme.colorTextBase;

    const update = <K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]) => {
        setTheme(prev => ({ ...prev, [key]: value }));
    };

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    }, [theme]);

    const handleReset = () => {
        const defaultTheme = isDark ? DEFAULT_DARK : DEFAULT_LIGHT;
        setTheme(defaultTheme);
        message.success('已重置为默认主题');
    };

    const handleModeChange = (mode: 'light' | 'dark') => {
        setTheme(mode === 'dark' ? DEFAULT_DARK : DEFAULT_LIGHT);
    };

    const handleExport = () => {
        const css = generateCSS(theme);
        navigator.clipboard.writeText(css).then(() => message.success('CSS 已复制到剪贴板'));
    };

    const handleApply = () => {
        const css = generateCSS(theme);
        let styleEl = document.getElementById('dynamic-theme') as HTMLStyleElement | null;
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'dynamic-theme';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = css;
        message.success('主题已应用');
    };

    return (
        <div>
            <Typography.Title level={3} style={{ marginBottom: 16 }}>主题定制</Typography.Title>

            <Row gutter={16}>
                {/* 左侧配置面板 */}
                <Col xs={24} lg={10}>
                    <Card title={<><BgColorsOutlined /> 主题配置</>} style={{ marginBottom: 16 }}>
                        <Space direction="vertical" style={{ width: '100%' }} size="middle">

                            {/* 模式切换 */}
                            <div>
                                <Typography.Text strong>模式</Typography.Text>
                                <div style={{ marginTop: 8 }}>
                                    <Segmented
                                        value={theme.mode}
                                        onChange={v => handleModeChange(v as 'light' | 'dark')}
                                        options={[
                                            { label: '浅色', value: 'light' },
                                            { label: '深色', value: 'dark' },
                                        ]}
                                    />
                                </div>
                            </div>

                            <Divider style={{ margin: '8px 0' }} />

                            {/* 主色 */}
                            <div>
                                <Typography.Text strong>主色调</Typography.Text>
                                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <ColorPicker
                                        value={theme.primaryColor}
                                        onChange={(_, hex) => update('primaryColor', hex)}
                                        disabledAlpha
                                    />
                                    <Typography.Text code>{theme.primaryColor}</Typography.Text>
                                </div>
                                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {PRESETS.map(p => (
                                        <div
                                            key={p.primary}
                                            onClick={() => update('primaryColor', p.primary)}
                                            style={{
                                                width: 28, height: 28, borderRadius: 6,
                                                background: p.primary, cursor: 'pointer',
                                                border: theme.primaryColor === p.primary ? '2px solid ' + textBase : '2px solid transparent',
                                                transition: 'border 0.2s',
                                            }}
                                            title={p.label}
                                        />
                                    ))}
                                </div>
                            </div>

                            <Divider style={{ margin: '8px 0' }} />

                            {/* 功能色 */}
                            <div>
                                <Typography.Text strong>功能色</Typography.Text>
                                <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
                                    <Space><Typography.Text type="secondary">成功</Typography.Text><ColorPicker value={theme.colorSuccess} onChange={(_, hex) => update('colorSuccess', hex)} disabledAlpha size="small" /></Space>
                                    <Space><Typography.Text type="secondary">警告</Typography.Text><ColorPicker value={theme.colorWarning} onChange={(_, hex) => update('colorWarning', hex)} disabledAlpha size="small" /></Space>
                                    <Space><Typography.Text type="secondary">错误</Typography.Text><ColorPicker value={theme.colorError} onChange={(_, hex) => update('colorError', hex)} disabledAlpha size="small" /></Space>
                                </div>
                            </div>

                            <Divider style={{ margin: '8px 0' }} />

                            {/* 字号 */}
                            <div>
                                <Typography.Text strong><FontSizeOutlined /> 字号</Typography.Text>
                                <Slider min={12} max={20} value={theme.fontSize} onChange={v => update('fontSize', v)} />
                            </div>

                            {/* 圆角 */}
                            <div>
                                <Typography.Text strong><BorderOutlined /> 圆角</Typography.Text>
                                <Slider min={0} max={16} value={theme.borderRadius} onChange={v => update('borderRadius', v)} />
                            </div>

                            {/* 字体 */}
                            <div>
                                <Typography.Text strong>字体</Typography.Text>
                                <div style={{ marginTop: 8 }}>
                                    <Segmented
                                        value={theme.fontFamily}
                                        onChange={v => update('fontFamily', v as string)}
                                        options={FONT_OPTIONS}
                                    />
                                </div>
                            </div>

                            <Divider style={{ margin: '8px 0' }} />

                            <Space>
                                <Button type="primary" icon={<CheckOutlined />} onClick={handleApply}>应用主题</Button>
                                <Button icon={<CopyOutlined />} onClick={handleExport}>导出 CSS</Button>
                                <Button icon={<UndoOutlined />} onClick={handleReset}>重置</Button>
                            </Space>
                        </Space>
                    </Card>
                </Col>

                {/* 右侧预览 */}
                <Col xs={24} lg={14}>
                    <Card title="实时预览" style={{ marginBottom: 16 }}>
                        <div style={{
                            background: bgBody,
                            borderRadius: theme.borderRadius,
                            padding: 24,
                            fontFamily: theme.fontFamily,
                            fontSize: theme.fontSize,
                            color: textBase,
                            transition: 'all 0.3s',
                        }}>
                            {/* 预览 Header */}
                            <div style={{
                                background: theme.primaryColor,
                                padding: '12px 20px',
                                borderRadius: theme.borderRadius,
                                marginBottom: 16,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                            }}>
                                <span style={{ color: '#fff', fontWeight: 600, fontSize: theme.fontSize + 2 }}>My Blog</span>
                                {['首页', '文章', '关于'].map(item => (
                                    <span key={item} style={{ color: 'rgba(255,255,255,0.85)', cursor: 'pointer' }}>{item}</span>
                                ))}
                            </div>

                            {/* 预览卡片 */}
                            <Row gutter={12}>
                                <Col span={12}>
                                    <div style={{
                                        background: bgCard,
                                        borderRadius: theme.borderRadius,
                                        padding: 16,
                                        marginBottom: 12,
                                    }}>
                                        <Typography.Text strong style={{ color: textBase, fontSize: theme.fontSize }}>文章标题示例</Typography.Text>
                                        <p style={{ color: textBase, opacity: 0.6, marginTop: 8, fontSize: theme.fontSize - 2 }}>
                                            这是一段文章摘要，展示了当前主题下的文字排版效果...
                                        </p>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {['React', 'TypeScript'].map(tag => (
                                                <span key={tag} style={{
                                                    background: theme.primaryColor + '20',
                                                    color: theme.primaryColor,
                                                    padding: '2px 8px',
                                                    borderRadius: theme.borderRadius / 2,
                                                    fontSize: theme.fontSize - 2,
                                                }}>{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                </Col>
                                <Col span={12}>
                                    <div style={{
                                        background: bgCard,
                                        borderRadius: theme.borderRadius,
                                        padding: 16,
                                        marginBottom: 12,
                                    }}>
                                        <Typography.Text strong style={{ color: textBase }}>组件预览</Typography.Text>
                                        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{
                                                background: theme.primaryColor, color: '#fff',
                                                padding: '4px 16px', borderRadius: theme.borderRadius,
                                                fontSize: theme.fontSize - 1,
                                            }}>主要按钮</span>
                                            <span style={{
                                                border: `1px solid ${theme.primaryColor}`, color: theme.primaryColor,
                                                padding: '4px 16px', borderRadius: theme.borderRadius,
                                                fontSize: theme.fontSize - 1,
                                            }}>次要按钮</span>
                                        </div>
                                        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                                            <span style={{ color: theme.colorSuccess, fontSize: theme.fontSize - 1 }}>成功</span>
                                            <span style={{ color: theme.colorWarning, fontSize: theme.fontSize - 1 }}>警告</span>
                                            <span style={{ color: theme.colorError, fontSize: theme.fontSize - 1 }}>错误</span>
                                        </div>
                                    </div>
                                </Col>
                            </Row>

                            {/* 预览输入框 */}
                            <div style={{
                                background: bgCard,
                                borderRadius: theme.borderRadius,
                                padding: 16,
                            }}>
                                <Typography.Text strong style={{ color: textBase }}>表单样式</Typography.Text>
                                <div style={{
                                    marginTop: 8,
                                    border: `1px solid ${isDark ? '#444' : '#d9d9d9'}`,
                                    borderRadius: theme.borderRadius,
                                    padding: '6px 12px',
                                    color: isDark ? '#666' : '#bbb',
                                    fontSize: theme.fontSize - 1,
                                }}>
                                    请输入内容...
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* CSS 代码预览 */}
                    <Card title="生成的 CSS 变量" size="small">
                        <pre style={{
                            background: isDark ? '#0d1117' : '#f6f8fa',
                            padding: 16,
                            borderRadius: 8,
                            fontSize: 12,
                            overflow: 'auto',
                            margin: 0,
                            color: isDark ? '#c9d1d9' : '#24292f',
                        }}>
                            {generateCSS(theme)}
                        </pre>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}

function generateCSS(t: ThemeConfig): string {
    return `:root {
  --color-primary: ${t.primaryColor};
  --color-bg-base: ${t.colorBgBase};
  --color-text-base: ${t.colorTextBase};
  --color-success: ${t.colorSuccess};
  --color-warning: ${t.colorWarning};
  --color-error: ${t.colorError};
  --border-radius: ${t.borderRadius}px;
  --font-size-base: ${t.fontSize}px;
  --font-family: ${t.fontFamily};
  --color-bg-layout: ${t.mode === 'dark' ? '#141414' : '#f5f5f5'};
  --color-bg-container: ${t.mode === 'dark' ? '#1f1f1f' : '#ffffff'};
}`;
}
