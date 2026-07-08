import Editor from '@monaco-editor/react';
import type { CssTestController } from '../types';

export interface EditorPaneProps {
    controller: CssTestController;
}

/** Monaco 代码编辑器，注册 Ctrl/Cmd+Enter 运行快捷键 */
export function EditorPane({ controller }: EditorPaneProps) {
    const { current, setCurrent, monacoLang, monacoTheme, handleRunRef } = controller;

    return (
        <section className="css-lab-editor">
            <Editor
                language={monacoLang}
                theme={monacoTheme}
                value={current}
                onChange={(val) => setCurrent(val ?? '')}
                onMount={(editor, monaco) => {
                    // Ctrl/Cmd + Enter 运行（通过 ref 调最新版）
                    editor.addCommand(
                        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
                        () => handleRunRef.current(),
                    );
                }}
                options={{
                    fontSize: 13,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'off',
                    tabSize: 2,
                    renderWhitespace: 'selection',
                    fixedOverflowWidgets: true,
                }}
            />
        </section>
    );
}
