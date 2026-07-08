import { Card } from 'antd';
import type { ThemeController } from '../types';
import { generateCss } from '../utils/generateCss';

export interface CssCodePreviewProps {
    controller: ThemeController;
}

/** CSS 变量代码预览 */
export function CssCodePreview({ controller }: CssCodePreviewProps) {
    const { theme, isDark } = controller;
    const css = generateCss(theme);

    return (
        <Card title="生成的 CSS 变量" size="small">
            <pre style={{
                background: isDark ? '#0d1117' : '#f6f8fa',
                padding: 16,
                borderRadius: 8,
                fontSize: 12,
                overflow: 'auto',
                margin: 0,
                color: isDark ? '#c9d1d9' : '#24292f',
            }}>
                {css}
            </pre>
        </Card>
    );
}
