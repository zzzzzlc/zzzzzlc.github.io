import { Card, Col, Divider, Row, Typography, Upload, Watermark } from 'antd';
import { FileImageOutlined, SafetyOutlined } from '@ant-design/icons';
import type { WatermarkController } from '../types';
import { SAMPLE_TEXT } from '../utils/constants';

export interface PreviewAreaProps {
    controller: WatermarkController;
}

/** 预览区域：按模式渲染页面水印 / 文件下载 / 内容水印 */
export function PreviewArea({ controller }: PreviewAreaProps) {
    const { mode, watermarkProps, imageEl, fileName, previewCanvasRef, handleImageUpload } = controller;

    if (mode === 'page') {
        return (
            <Card title="预览" style={{ marginBottom: 16 }}>
                <Watermark {...watermarkProps}>
                    <div style={{
                        background: '#fff', padding: 40, minHeight: '60vh',
                        borderRadius: 8, border: '1px solid #f0f0f0',
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
            </Card>
        );
    }

    if (mode === 'file') {
        return (
            <Card title="预览" style={{ marginBottom: 16 }}>
                <Card title={imageEl ? `预览：${fileName}` : '图片预览'} style={{ minHeight: 300 }}>
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
                                padding: '60px 0', textAlign: 'center',
                                border: '2px dashed #d9d9d9', borderRadius: 8,
                                cursor: 'pointer', transition: 'border-color 0.3s',
                            }}>
                                <FileImageOutlined style={{ fontSize: 48, color: '#bbb' }} />
                                <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
                                    点击或拖拽上传图片
                                </Typography.Paragraph>
                            </div>
                        </Upload>
                    )}
                </Card>
            </Card>
        );
    }

    // content 模式
    return (
        <Card title="预览" style={{ marginBottom: 16 }}>
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
        </Card>
    );
}
