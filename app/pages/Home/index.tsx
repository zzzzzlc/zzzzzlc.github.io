import { Link } from 'react-router';
import blogIndex from 'virtual:blog-index';
import { author } from '../../blog/author';
import BlogAvatar from '../../../component/blog/BlogAvatar';
import ParticleField from '../../../component/ParticleField';
import './home.css';

interface PostMeta {
    category?: string;
}

/**
 * 首页：单入口 landing 页（严格一屏、无滚动）。
 * 不展示文章列表，仅一个「浏览全部文章」入口指向 /categories。
 */
export default function Home() {
    const postCount = blogIndex.length;
    const categoryCount = new Set(
        (blogIndex as PostMeta[]).map(p => p.category || '未分类'),
    ).size;

    return (
        <div className="home-screen">
            <ParticleField />
            <div className="home-landing">
                <BlogAvatar size={112} />

                <h1 className="home-landing-name">{author.name}</h1>
                <p className="home-landing-slogan">{author.tagline}</p>

                <Link to="/categories" className="home-landing-cta">
                    浏览全部 {postCount} 篇文章 →
                </Link>

                <div className="home-landing-stats">
                    <span><strong>{postCount}</strong> 篇文章</span>
                    <span className="home-landing-dot">·</span>
                    <span><strong>{categoryCount}</strong> 个分类</span>
                </div>
            </div>
        </div>
    );
}
