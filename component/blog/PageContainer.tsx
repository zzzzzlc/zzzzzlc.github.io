import React from 'react';

type ContainerVariant = 'content' | 'reading' | 'wide';

interface PageContainerProps {
    children: React.ReactNode;
    /**
     * 容器宽度档位（对应 .blog-container-{variant} 的 max-width）：
     * - content（默认 1320px）：列表/网格页主体（首页、分类、项目、关于）
     * - reading（800px，--reading-width）：纯阅读列（移动端文章页、独立文本页）
     * - wide（1440px）：双栏布局（文章正文 + 右侧目录）
     */
    variant?: ContainerVariant;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * 站点统一容器：居中 + 左右内边距，宽度由 variant 决定。
 * 宽度档位定义在 app/index.css 的 .blog-container-{variant}。
 */
export default function PageContainer({ children, variant = 'content', className, style }: PageContainerProps) {
    return (
        <div
            className={`blog-container blog-container-${variant}${className ? ' ' + className : ''}`}
            style={style}
        >
            {children}
        </div>
    );
}
