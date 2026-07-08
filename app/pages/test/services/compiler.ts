import type { CompileResult, CompilerModule, Mode } from '../types';
import { COMPILER_SRC } from '../utils/constants';

/* ------------------------- 编译器加载（ESM 动态 import） ------------------------- */
const moduleCache: Partial<Record<Mode, Promise<CompilerModule>>> = {};

// @vite-ignore 让 Vite 不要尝试预打包 CDN 模块
const importEsm = (url: string): Promise<CompilerModule> =>
    import(/* @vite-ignore */ url) as unknown as Promise<CompilerModule>;

const ensureModule = (mode: Mode): Promise<CompilerModule | null> => {
    if (mode === 'css' || mode === 'css-module') return Promise.resolve(null);
    const url = COMPILER_SRC[mode];
    if (!url) return Promise.reject(new Error(`未知模式：${mode}`));
    if (!moduleCache[mode]) {
        moduleCache[mode] = importEsm(url).catch((e: unknown) => {
            // 失败清缓存，允许下次重试
            moduleCache[mode] = undefined;
            const msg = e instanceof Error ? e.message : String(e);
            throw new Error(`编译器加载失败（${url}）：${msg}`);
        });
    }
    return moduleCache[mode]!;
};

/* ------------------------- CSS Modules 轻量改写 ------------------------- */
const compileCssModule = (css: string, html: string): CompileResult => {
    const map = new Map<string, string>();
    const hash = Math.random().toString(36).slice(2, 8);
    // 仅处理 .className 形式选择器，不动 #id、[attr]、:pseudo 等
    const classRegex = /\.(-?[_a-zA-Z][\w-]*)/g;
    const scopedCss = css.replace(classRegex, (_full, name: string) => {
        if (!map.has(name)) map.set(name, `${name}_${hash}`);
        return '.' + map.get(name);
    });
    // HTML 中 class="a b c" 按映射重命名
    const scopedHtml = html.replace(/class\s*=\s*("([^"]*)"|'([^']*)')/g, (_full, q: string) => {
        const val = q.slice(1, -1);
        const renamed = val
            .split(/\s+/)
            .map((c: string) => map.get(c) ?? c)
            .join(' ');
        return `class="${renamed}"`;
    });
    return { css: scopedCss, html: scopedHtml, error: '' };
};

/* ------------------------- 主编译入口 ------------------------- */
export const compile = async (
    code: string,
    mode: Mode,
    html: string,
): Promise<CompileResult> => {
    try {
        if (mode === 'css') return { css: code, html, error: '' };
        if (mode === 'css-module') return compileCssModule(code, html);
        if (mode === 'less') {
            const mod = await ensureModule('less');
            const less = mod?.default ?? mod;
            if (!less || typeof less.render !== 'function') {
                throw new Error('less 模块未导出 render 方法');
            }
            const out = await less.render(code);
            return { css: out.css, html, error: '' };
        }
        if (mode === 'scss') {
            const mod = await ensureModule('scss');
            const sass = mod?.default ?? mod;
            if (!sass || typeof sass.compileString !== 'function') {
                throw new Error('sass 模块未导出 compileString 方法');
            }
            const out = sass.compileString(code, { syntax: 'scss' });
            return { css: out.css, html, error: '' };
        }
        return { css: code, html, error: '' };
    } catch (e: unknown) {
        const err = e as { message?: string; formatted?: string };
        const msg = err?.message || err?.formatted || (e == null ? '编译失败' : String(e)) || '编译失败';
        return { css: '', html, error: msg };
    }
};
