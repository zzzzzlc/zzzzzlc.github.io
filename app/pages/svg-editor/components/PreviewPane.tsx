import { Button, Card, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { SvgEditorController } from '../types';

export interface PreviewPaneProps {
    controller: SvgEditorController;
}

/** SVG 预览：渲染代码或语法错误提示 + 下载 */
export function PreviewPane({ controller }: PreviewPaneProps) {
    const { code, svgError, handleDownload } = controller;

    return (
        <Card
            title="预览"
            extra={<Button size="small" icon={<DownloadOutlined />} onClick={handleDownload}>下载 SVG</Button>}
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
    );
}
