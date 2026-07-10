import { Outlet, useLocation, useNavigate, Link } from 'react-router';
import { useThemeMode } from '../../app/theme/ThemeProvider';
import { author } from '../../app/blog/author';
import HeaderSearch from './HeaderSearch';

const NAV_ITEMS = [
    { key: 'home', label: '首页', path: '/' },
    { key: 'categories', label: '分类', path: '/categories' },
    { key: 'projects', label: '项目', path: '/projects' },
    { key: 'about', label: '关于', path: '/about' },
];

function BlogLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { mode, toggleFromEvent } = useThemeMode();
    const isHome = location.pathname === '/';
    const selectedKey = location.pathname === '/' || location.pathname.startsWith('/post')
        ? 'home'
        : location.pathname.replace('/', '') || 'home';

    return (
        <div className="blog-shell">
            <header className="blog-header">
                <Link to="/" className="blog-logo" aria-label={author.name}>
                    {author.nickname}
                </Link>

                <nav className="blog-nav" aria-label="主导航">
                    {NAV_ITEMS.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            className={`blog-nav-link${selectedKey === item.key ? ' blog-nav-link-active' : ''}`}
                            onClick={() => navigate(item.path)}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="blog-header-actions">
                    <HeaderSearch />
                    <button
                        type="button"
                        className="blog-theme-toggle"
                        onClick={(event) => toggleFromEvent(event)}
                        aria-label="切换主题"
                        title={mode === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
                    >
                        {mode === 'dark' ? '☀' : '☾'}
                    </button>
                </div>
            </header>

            <main
                className="blog-content"
                style={{
                    padding: isHome ? 0 : '32px 24px 64px',
                    width: '100%',
                    boxSizing: 'border-box',
                }}
            >
                <Outlet />
            </main>

            {!isHome && (
                <footer className="blog-footer">
                    <div className="blog-footer-inner">
                        <div className="blog-footer-col blog-footer-author">
                            <div className="blog-footer-name">
                                <Link to="/about">{author.name}</Link>
                            </div>
                            <div className="blog-footer-bio">{author.bio}</div>
                            <div className="blog-footer-links">
                                <a href={author.social.github} target="_blank" rel="noreferrer">GitHub</a>
                                <a href={author.social.email}>Email</a>
                                <a href={author.social.rss}>RSS</a>
                            </div>
                        </div>

                        <div className="blog-footer-col blog-footer-nav">
                            <div className="blog-footer-heading">站点</div>
                            <nav>
                                {NAV_ITEMS.map((item) => (
                                    <Link key={item.key} to={item.path} className="blog-footer-link">
                                        {item.label}
                                    </Link>
                                ))}
                            </nav>
                        </div>

                        <div className="blog-footer-col blog-footer-meta">
                            <div className="blog-footer-copyright">
                                © {new Date().getFullYear()} {author.name}
                            </div>
                            <div className="blog-footer-powered">
                                Built with React · Vite · TypeScript
                            </div>
                        </div>
                    </div>
                </footer>
            )}
        </div>
    );
}

export default BlogLayout;
