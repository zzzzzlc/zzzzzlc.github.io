import { Button, Card, Space } from 'antd';
import { CopyOutlined, UndoOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import type { SvgEditorController } from '../types';

export interface CodeEditorPaneProps {
    controller: SvgEditorController;
}

/** SVG 代码编辑器：Monaco Editor + 复制/重置 */
export function CodeEditorPane({ controller }: CodeEditorPaneProps) {
    const { code, setCode, handleCopy, handleReset } = controller;

    return (
        <Card
            title="SVG 代码"
            extra={
                <Space>
                    <Button size="small" icon={<CopyOutlined />} onClick={handleCopy}>复制</Button>
                    <Button size="small" icon={<UndoOutlined />} onClick={handleReset}>重置</Button>
                </Space>
            }
            styles={{ body: { padding: 0 } }}
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
    );
}
