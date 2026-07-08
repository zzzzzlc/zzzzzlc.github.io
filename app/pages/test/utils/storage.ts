import type { Mode } from '../types';
import { MODE_LABEL } from './constants';

export const LS_HTML = 'css-lab:html';
export const LS_CSS = (mode: Mode) => `css-lab:css:${mode}`;
export const LS_MODE = 'css-lab:mode';

/** 读取持久化的模式，非法值回退 css */
export const readMode = (): Mode => {
    const m = localStorage.getItem(LS_MODE) as Mode | null;
    return m && m in MODE_LABEL ? m : 'css';
};
