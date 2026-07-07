import React, { useEffect, useState } from 'react';
import './ReadingProgress.css';

/**
 * 顶部阅读进度条：固定在视口顶部，根据 document 滚动百分比更新宽度
 * 用于 BlogPost 文章详情页
 */
export default function ReadingProgress() {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const onScroll = () => {
            const doc = document.documentElement;
            const scrollTop = window.scrollY || doc.scrollTop;
            const height = doc.scrollHeight - doc.clientHeight;
            const pct = height > 0 ? Math.min(100, Math.max(0, (scrollTop / height) * 100)) : 0;
            setProgress(pct);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
        };
    }, []);

    return (
        <div className="reading-progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <div className="reading-progress-bar" style={{ width: `${progress}%` }} />
        </div>
    );
}
