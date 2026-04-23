import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Select, Typography, Row, Col, Card } from 'antd';

const LANGUAGES = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'css', label: 'CSS' },
    { value: 'html', label: 'HTML' },
    { value: 'json', label: 'JSON' },
    { value: 'markdown', label: 'Markdown' },
    { value: 'sql', label: 'SQL' },
    { value: 'go', label: 'Go' },
    { value: 'rust', label: 'Rust' },
    { value: 'cpp', label: 'C++' },
];

const DEFAULT_CODE = `// 在这里编写代码
function greet(name) {
    console.log(\`Hello, \${name}!\`);
    return \`Welcome to the Code Editor\`;
}

greet('World');
`;

export default function CodeEditor() {
    const [language, setLanguage] = useState('javascript');
    const [code, setCode] = useState(DEFAULT_CODE);

    return (
        <div>
            <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                <Col>
                    <Typography.Title level={3} style={{ margin: 0 }}>代码编辑器</Typography.Title>
                </Col>
                <Col>
                    <Select
                        value={language}
                        onChange={setLanguage}
                        options={LANGUAGES}
                        style={{ width: 160 }}
                    />
                </Col>
            </Row>
            <Card bodyStyle={{ padding: 0 }}>
                <Editor
                    height="70vh"
                    language={language}
                    value={code}
                    onChange={value => setCode(value ?? '')}
                    theme="vs-dark"
                    options={{
                        fontSize: 14,
                        minimap: { enabled: true },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        wordWrap: 'on',
                        tabSize: 4,
                    }}
                />
            </Card>
        </div>
    );
}
