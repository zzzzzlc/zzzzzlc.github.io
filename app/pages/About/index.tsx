import { Link } from 'react-router';
import blogIndex from 'virtual:blog-index';
import { author } from '../../blog/author';
import PageContainer from '../../../component/blog/PageContainer';
import BlogTag from '../../../component/blog/BlogTag';
import AuthorBio from '../../../component/blog/AuthorBio';
import './about.css';

const TECH_STACK = [
    'TypeScript', 'React', 'Vue', 'Node', 'Next.js',
    'CSS', 'HTML', 'Vite', 'Webpack', 'Rollup',
    'Jest', 'Vitest', 'Docker', 'Nginx', 'PostgreSQL',
    'Redis', 'Go', 'Python', 'Three.js', 'RxJS',
];

const RECENT_COUNT = 5;

export default function About() {
    const recentPosts = (blogIndex as Array<{ slug: string; title: string; date: string }>)
        .slice(0, RECENT_COUNT);

    return (
        <PageContainer>
            <AuthorBio variant="full" />

            <section className="about-section">
                <h3 className="section-heading">关于我</h3>
                <p className="about-text">
                    我是 {author.name}，一名前端工程师。热衷于工程化、可视化、性能优化与开发者体验，
                    偶尔写一些技术文章分享学习心得。{author.location && `现居 ${author.location}。`}
                </p>
                <p className="about-text">
                    工作之余喜欢探索新技术、折腾工具链、把复杂的问题拆成简单的小问题。博客是记录思考与成长的地方，
                    所有文章均原创，欢迎交流。
                </p>
            </section>

            <section className="about-section">
                <h3 className="section-heading">关于本站</h3>
                <p className="about-text">
                    本站基于 React + Vite + Ant Design 构建，文章使用 Markdown 编写，
                    通过 Vite 插件在构建期编译为虚拟模块，零运行时开销。
                    支持暗色模式、代码高亮、目录跳转、阅读进度等。
                </p>
            </section>

            <section className="about-section">
                <h3 className="section-heading">技术栈</h3>
                <div className="about-stack">
                    {TECH_STACK.map(tech => (
                        <BlogTag key={tech} tag={tech} />
                    ))}
                </div>
            </section>

            <section className="about-section">
                <h3 className="section-heading">最近文章</h3>
                <ul className="about-recent-list">
                    {recentPosts.map(p => (
                        <li key={p.slug}>
                            <Link to={`/post/${p.slug}`} className="about-recent-row">
                                <span className="about-recent-title">{p.title}</span>
                                <time className="about-recent-date">{p.date}</time>
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>
        </PageContainer>
    );
}
