import type { RefObject } from 'react';

/** 样式语言模式 */
export type Mode = 'css' | 'less' | 'scss' | 'css-module';

/** 编辑器标签页 */
export type Tab = 'css' | 'html';

/** Monaco 语言标识 */
export type MonacoLanguage = 'html' | 'less' | 'scss' | 'css';

/** Monaco 主题 */
export type MonacoTheme = 'vs-dark' | 'vs';

/** 编译输出 */
export interface CompileResult {
    css: string;
    html: string;
    error: string;
}

/** 已运行代码快照（用于脏标记与防不同步） */
export interface RunSnapshot {
    css: string;
    html: string;
    mode: Mode;
}

/** ESM 动态加载的编译器模块（less / sass） */
export interface CompilerModule {
    default?: CompilerModule;
    render?: (code: string) => Promise<{ css: string }>;
    compileString?: (code: string, opts?: { syntax: string }) => { css: string };
}

/** CSS 实验室控制器：useCssLab 的对外契约 */
export interface CssTestController {
    mode: Mode;
    tab: Tab;
    compilerLoading: boolean;
    error: string;
    dirty: boolean;
    current: string;
    monacoLang: MonacoLanguage;
    monacoTheme: MonacoTheme;
    srcDoc: string;
    handleModeChange: (mode: Mode) => void;
    setTab: (tab: Tab) => void;
    setCurrent: (val: string) => void;
    handleRun: () => void;
    handleReset: () => void;
    handleRunRef: RefObject<() => void>;
}
