import type { CssTestController, Mode } from '../types';
import { MODE_LABEL } from '../utils/constants';

export interface LabHeaderProps {
    controller: CssTestController;
}

/** 顶部工具栏：标题 / 模式选择 / 标签页 / 状态 / 运行 / 重置 */
export function LabHeader({ controller }: LabHeaderProps) {
    const {
        mode, handleModeChange, tab, setTab, compilerLoading, dirty, error,
        handleRun, handleReset,
    } = controller;

    return (
        <header className="css-lab-bar">
            <h2>CSS 实验室</h2>

            <select
                className="css-lab-mode"
                value={mode}
                onChange={(e) => handleModeChange(e.target.value as Mode)}
                title="选择样式语言"
            >
                {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
                    <option key={m} value={m}>{MODE_LABEL[m]}</option>
                ))}
            </select>

            <div className="css-lab-tabs">
                <button
                    type="button"
                    className={tab === 'css' ? 'active' : ''}
                    onClick={() => setTab('css')}
                >
                    {MODE_LABEL[mode]}
                </button>
                <button
                    type="button"
                    className={tab === 'html' ? 'active' : ''}
                    onClick={() => setTab('html')}
                >
                    HTML
                </button>
            </div>

            <div className="css-lab-status">
                {compilerLoading && <span className="css-lab-loading">编译中...</span>}
                {!compilerLoading && dirty && <span className="css-lab-dirty">未运行</span>}
                {error && <span className="css-lab-error" title={error}>编译失败</span>}
            </div>

            <button
                type="button"
                className={`css-lab-run${dirty ? ' dirty' : ''}`}
                onClick={handleRun}
                disabled={compilerLoading}
                title="运行（Ctrl/Cmd + Enter）"
            >
                运行
            </button>

            <button type="button" className="css-lab-reset" onClick={handleReset}>
                重置
            </button>
        </header>
    );
}
