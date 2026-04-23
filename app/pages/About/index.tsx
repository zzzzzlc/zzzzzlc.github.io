import React from 'react';
import { Typography, Divider } from 'antd';

export default function About() {
    return (
        <div style={{ maxWidth: 700 }}>
            <Typography.Title level={3}>关于我</Typography.Title>
            <Typography.Paragraph>
                Hi, 我是 zenglingchao，一名前端开发者。
            </Typography.Paragraph>
            <Divider />
            <Typography.Title level={4}>关于本站</Typography.Title>
            <Typography.Paragraph>
                这是我的个人博客，使用 React + Vite + TypeScript + antd 构建。
                文章使用 Markdown 编写，在构建时编译为静态页面，部署在 GitHub Pages 上。
            </Typography.Paragraph>
            <Typography.Title level={4}>技术栈</Typography.Title>
            <ul>
                <li>React 19</li>
                <li>TypeScript</li>
                <li>Vite 7</li>
                <li>Ant Design 6</li>
                <li>GitHub Pages</li>
            </ul>
        </div>
    );
}
