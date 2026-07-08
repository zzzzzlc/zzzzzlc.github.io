import { Card, Col, Row, Typography } from 'antd';
import type { ThemeController } from '../types';

export interface LivePreviewProps {
    controller: ThemeController;
}

/** 实时预览：按当前主题配置渲染博客界面预览（Header / 卡片 / 表单） */
export function LivePreview({ controller }: LivePreviewProps) {
    const { theme, bgCard, bgBody, textBase, isDark } = controller;

    return (
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
    );
}
