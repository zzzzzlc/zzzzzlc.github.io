import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useThemeMode } from '../../../theme/ThemeProvider';
import type {
    CssTestController, Mode, MonacoLanguage, MonacoTheme, RunSnapshot, Tab,
} from '../types';
import { DEFAULT_CSS, DEFAULT_HTML, MODE_LABEL } from '../utils/constants';
import { LS_CSS, LS_HTML, LS_MODE, readMode } from '../utils/storage';
import { compile } from '../services/compiler';

/** CSS 实验室核心逻辑：状态 + 持久化 + 编译触发 + 编辑器控制 */
export const useCssLab = (): CssTestController => {
    const [mode, setMode] = useState<Mode>(readMode);
    const [html, setHtml] = useState(() => localStorage.getItem(LS_HTML) ?? DEFAULT_HTML);
    const [cssBank, setCssBank] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        (Object.keys(MODE_LABEL) as Mode[]).forEach((m) => {
            init[m] = localStorage.getItem(LS_CSS(m)) ?? DEFAULT_CSS[m];
        });
        return init;
    });
    const [tab, setTab] = useState<Tab>('css');
    const [compilerLoading, setCompilerLoading] = useState(false);
    const [error, setError] = useState('');
    // 已运行过的代码快照（用于"未运行"标记 & 防止代码与预览不同步）
    const [lastRun, setLastRun] = useState<RunSnapshot>({
        css: cssBank[mode],
        html,
        mode,
    });
    const [runToken, setRunToken] = useState(0); // 自增触发器
    const [preview, setPreview] = useState({ css: cssBank[mode], html });

    const currentCss = cssBank[mode];

    // 持久化
    useEffect(() => { localStorage.setItem(LS_HTML, html); }, [html]);
    useEffect(() => { localStorage.setItem(LS_MODE, mode); }, [mode]);
    useEffect(() => { localStorage.setItem(LS_CSS(mode), currentCss); }, [mode, currentCss]);

    // 切换模式
    const handleModeChange = useCallback((next: Mode) => {
        setMode(next);
        setTab('css');
        setError('');
    }, []);

    // 手动运行：把当前代码快照入栈并触发编译
    const handleRun = useCallback(() => {
        setLastRun({ css: cssBank[mode], html, mode });
        setRunToken((t) => t + 1);
    }, [cssBank, html, mode]);

    // 让 Monaco onMount 注册的快捷键能拿到最新的 handleRun（避免闭包陈旧）
    const handleRunRef = useRef(handleRun);
    useEffect(() => { handleRunRef.current = handleRun; }, [handleRun]);

    // 首次挂载自动跑一次，让用户看到已有代码的效果
    useEffect(() => {
        handleRun();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // 编译：仅由 runToken 触发
    useEffect(() => {
        if (runToken === 0) return; // 初始化时不自动运行
        let cancelled = false;
        const run = async () => {
            setCompilerLoading(true);
            const out = await compile(lastRun.css, lastRun.mode, lastRun.html);
            if (cancelled) return;
            setError(out.error);
            if (!out.error) setPreview(out);
            setCompilerLoading(false);
        };
        run();
        return () => { cancelled = true; };
    }, [runToken]); // eslint-disable-line react-hooks/exhaustive-deps

    // 脏标记：当前代码 vs 上次运行的代码
    const dirty = currentCss !== lastRun.css || html !== lastRun.html || mode !== lastRun.mode;

    const srcDoc = useMemo(
        () => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>${preview.css}</style>
</head>
<body>${preview.html}</body>
</html>`,
        [preview],
    );

    const handleReset = () => {
        if (!confirm(`重置 ${MODE_LABEL[mode]} 代码到默认？当前内容将被清空。`)) return;
        // 重置当前模式 CSS（HTML 不分模式，单独询问）
        setCssBank((b) => ({ ...b, [mode]: DEFAULT_CSS[mode] }));
        if (confirm('同时重置 HTML 吗？')) setHtml(DEFAULT_HTML);
    };

    const current = tab === 'css' ? currentCss : html;
    const setCurrent = useCallback((val: string) => {
        if (tab === 'css') setCssBank((b) => ({ ...b, [mode]: val }));
        else setHtml(val);
    }, [tab, mode]);

    // Monaco 语言：CSS Modules 走 css 高亮即可
    const monacoLang: MonacoLanguage = tab === 'html'
        ? 'html'
        : (mode === 'less' ? 'less' : (mode === 'scss' ? 'scss' : 'css'));
    const { mode: themeMode } = useThemeMode();
    const monacoTheme: MonacoTheme = themeMode === 'dark' ? 'vs-dark' : 'vs';

    return {
        mode, tab, compilerLoading, error, dirty, current, monacoLang, monacoTheme, srcDoc,
        handleModeChange, setTab, setCurrent, handleRun, handleReset, handleRunRef,
    };
};
