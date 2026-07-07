import Editor from '@monaco-editor/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useThemeMode } from '../../theme/ThemeProvider';
import './index.css';

type Mode = 'css' | 'less' | 'scss' | 'css-module';
type Tab = 'css' | 'html';

const MODE_LABEL: Record<Mode, string> = {
    css: 'CSS',
    less: 'LESS',
    scss: 'SCSS',
    'css-module': 'CSS Modules',
};

const COMPILER_SRC: Partial<Record<Mode, string>> = {
    less: 'https://esm.sh/less@4.2.0',
    scss: 'https://esm.sh/sass@1.77.8',
};

const DEFAULT_HTML = `<div class="grid-container">
  <div class="grid-item">1</div>
  <div class="grid-item">2</div>
  <div class="grid-item">3</div>
  <div class="grid-item">4</div>
  <div class="grid-item">5</div>
  <div class="grid-item">6</div>
  <div class="grid-item">7</div>
  <div class="grid-item">8</div>
  <div class="grid-item">9</div>
</div>`;

const DEFAULT_CSS: Record<Mode, string> = {
    css: `.grid-container {
  display: grid;
  grid-template-columns: auto auto auto;
  grid-gap: 20px;
  padding: 10px;
  background-color: cadetblue;
  justify-content: space-around;
}
.grid-item {
  background-color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.8);
  padding: 20px;
  font-size: 30px;
  text-align: center;
}`,
    less: `@gap: 20px;
@item-bg: rgba(255, 255, 255, 0.8);

.grid-container {
  display: grid;
  grid-template-columns: repeat(3, auto);
  grid-gap: @gap;
  padding: 10px;
  background-color: cadetblue;
  justify-content: space-around;

  .grid-item {
    background-color: @item-bg;
    border: 1px solid rgba(0, 0, 0, 0.8);
    padding: @gap;
    font-size: 30px;
    text-align: center;
  }
}`,
    scss: `$gap: 20px;
$item-bg: rgba(255, 255, 255, 0.8);

.grid-container {
  display: grid;
  grid-template-columns: auto auto auto;
  grid-gap: $gap;
  padding: 10px;
  background-color: cadetblue;
  justify-content: space-around;

  .grid-item {
    background-color: $item-bg;
    border: 1px solid rgba(0, 0, 0, 0.8);
    padding: $gap;
    font-size: 30px;
    text-align: center;
  }
}`,
    'css-module': `/* 类名会被自动 hash 改写，HTML class 同步重命名 */
.grid-container {
  display: grid;
  grid-template-columns: auto auto auto;
  grid-gap: 20px;
  padding: 10px;
  background-color: cadetblue;
  justify-content: space-around;
}
.grid-item {
  background-color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.8);
  padding: 20px;
  font-size: 30px;
  text-align: center;
}`,
};

const LS_HTML = 'css-lab:html';
const LS_CSS = (mode: Mode) => `css-lab:css:${mode}`;
const LS_MODE = 'css-lab:mode';

/* ------------------------- 编译器加载（ESM 动态 import） ------------------------- */
const moduleCache: Partial<Record<Mode, Promise<any>>> = {};
function importEsm(url: string): Promise<any> {
    // @vite-ignore 让 Vite 不要尝试预打包 CDN 模块
    return import(/* @vite-ignore */ url);
}
function ensureModule(mode: Mode): Promise<any> {
    if (mode === 'css' || mode === 'css-module') return Promise.resolve(null);
    const url = COMPILER_SRC[mode];
    if (!url) return Promise.reject(new Error(`未知模式：${mode}`));
    if (!moduleCache[mode]) {
        moduleCache[mode] = importEsm(url).catch((e) => {
            // 失败清缓存，允许下次重试
            moduleCache[mode] = undefined;
            throw new Error(`编译器加载失败（${url}）：${e?.message || e}`);
        });
    }
    return moduleCache[mode]!;
}

/* ------------------------- CSS Modules 轻量改写 ------------------------- */
function compileCssModule(css: string, html: string) {
    const map = new Map<string, string>();
    const hash = Math.random().toString(36).slice(2, 8);
    // 仅处理 .className 形式选择器，不动 #id、[attr]、:pseudo 等
    const classRegex = /\.(-?[_a-zA-Z][\w-]*)/g;
    const scopedCss = css.replace(classRegex, (_full, name: string) => {
        if (!map.has(name)) map.set(name, `${name}_${hash}`);
        return '.' + map.get(name);
    });
    // HTML 中 class="a b c" 按映射重命名
    const scopedHtml = html.replace(/class\s*=\s*("([^"]*)"|'([^']*)')/g, (full, _q) => {
        const val = _q.slice(1, -1);
        const renamed = val
            .split(/\s+/)
            .map((c: string) => map.get(c) ?? c)
            .join(' ');
        return `class="${renamed}"`;
    });
    return { css: scopedCss, html: scopedHtml, error: '' };
}

/* ------------------------- 主编译入口 ------------------------- */
async function compile(
    code: string,
    mode: Mode,
    html: string,
): Promise<{ css: string; html: string; error: string }> {
    try {
        if (mode === 'css') return { css: code, html, error: '' };
        if (mode === 'css-module') return compileCssModule(code, html);
        if (mode === 'less') {
            const mod = await ensureModule('less');
            const less = mod?.default ?? mod;
            if (typeof less?.render !== 'function') {
                throw new Error('less 模块未导出 render 方法');
            }
            const out = await less.render(code);
            return { css: out.css, html, error: '' };
        }
        if (mode === 'scss') {
            const mod = await ensureModule('scss');
            const sass = mod?.default ?? mod;
            if (typeof sass?.compileString !== 'function') {
                throw new Error('sass 模块未导出 compileString 方法');
            }
            const out = sass.compileString(code, { syntax: 'scss' });
            return { css: out.css, html, error: '' };
        }
        return { css: code, html, error: '' };
    } catch (e: any) {
        const msg = e?.message || e?.formatted || e?.toString?.() || '编译失败';
        return { css: '', html, error: msg };
    }
}

/* ------------------------- 组件 ------------------------- */
function readMode(): Mode {
    const m = localStorage.getItem(LS_MODE) as Mode | null;
    return m && m in MODE_LABEL ? m : 'css';
}

export default function CssTest() {
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
    const [lastRun, setLastRun] = useState<{ css: string; html: string; mode: Mode }>({
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
        if (tab === 'css' || true) {
            // 重置当前模式 CSS + HTML（HTML 不分模式）
            setCssBank((b) => ({ ...b, [mode]: DEFAULT_CSS[mode] }));
            if (confirm('同时重置 HTML 吗？')) setHtml(DEFAULT_HTML);
        }
    };

    const current = tab === 'css' ? currentCss : html;
    const setCurrent = useCallback((val: string) => {
        if (tab === 'css') setCssBank((b) => ({ ...b, [mode]: val }));
        else setHtml(val);
    }, [tab, mode]);

    // Monaco 语言：CSS Modules 走 css 高亮即可
    const monacoLang = tab === 'html' ? 'html' : (mode === 'less' ? 'less' : (mode === 'scss' ? 'scss' : 'css'));
    const { mode: themeMode } = useThemeMode();
    const monacoTheme = themeMode === 'dark' ? 'vs-dark' : 'vs';

    return (
        <div className="css-lab">
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

            {error && (
                <pre className="css-lab-error-panel">{error}</pre>
            )}

            <main className="css-lab-main">
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
                <section className="css-lab-preview">
                    <iframe title="preview" srcDoc={srcDoc} />
                </section>
            </main>
        </div>
    );
}
