import React, { Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { author } from '../../blog/author';
import BlogAvatar from '../../../component/blog/BlogAvatar';
import './home.css';

const ParticleField = React.lazy(() => import('../../../component/ParticleField'));

/**
 * 首屏 landing 页：优先让标题先绘制，装饰性的粒子背景延后加载。
 */
export default function Home() {
    const [showParticleField, setShowParticleField] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setShowParticleField(true);
        }, 0);

        return () => window.clearTimeout(timer);
    }, []);

    return (
        <div className="home-screen">
            {showParticleField && (
                <Suspense fallback={null}>
                    <ParticleField />
                </Suspense>
            )}
            <div className="home-landing">
                <BlogAvatar size={112} />

                <h1 className="home-landing-name">{author.name}</h1>
                <p className="home-landing-slogan">{author.tagline}</p>

                <Link to="/categories" className="home-landing-cta">
                    浏览全部文章 →
                </Link>
            </div>
        </div>
    );
}
