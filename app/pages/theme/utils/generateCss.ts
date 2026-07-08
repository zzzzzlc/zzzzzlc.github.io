import type { ThemeConfig } from '../types';

/**
 * 由主题配置生成 CSS 变量字符串
 * 纯函数：无副作用，给定 config 输出确定
 */
export const generateCss = (t: ThemeConfig): string => `:root {
  --color-primary: ${t.primaryColor};
  --color-bg-base: ${t.colorBgBase};
  --color-text-base: ${t.colorTextBase};
  --color-success: ${t.colorSuccess};
  --color-warning: ${t.colorWarning};
  --color-error: ${t.colorError};
  --border-radius: ${t.borderRadius}px;
  --font-size-base: ${t.fontSize}px;
  --font-family: ${t.fontFamily};
  --color-bg-layout: ${t.mode === 'dark' ? '#141414' : '#f5f5f5'};
  --color-bg-container: ${t.mode === 'dark' ? '#1f1f1f' : '#ffffff'};
}`;
