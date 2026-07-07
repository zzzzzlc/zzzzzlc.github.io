import React, { useMemo, useState } from 'react';
import { Layout as AntLayout, Menu, Typography, Button, AutoComplete, theme } from 'antd';
import { Outlet, useNavigate, useLocation, Link } from 'react-router';
import { MoonOutlined, SunOutlined, SearchOutlined } from '@ant-design/icons';
import { useThemeMode } from '../../app/theme/ThemeProvider';
import blogIndex from 'virtual:blog-index';
import { author } from '../../app/blog/author';
import SocialLinks from '../blog/SocialLinks';

const { Header, Content, Footer } = AntLayout;

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
    const { token } = theme.useToken();
    const isDark = mode === 'dark';
    const isHome = location.pathname === '/';
    const [searchQuery, setSearchQuery] = useState('');

    const selectedKey = location.pathname === '/' || location.pathname.startsWith('/post')
        ? 'home'
        : location.pathname.replace('/', '') || 'home';

    // 全局搜索：匹配 title / tags / category
    const searchOptions = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return [];
        return blogIndex
            .filter(post =>
                post.title?.toLowerCase().includes(q) ||
                post.category?.toLowerCase().includes(q) ||
                post.tags?.some((t: string) => t.toLowerCase().includes(q))
            )
            .slice(0, 8)
            .map(post => ({
                value: post.slug,
                label: (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {post.title}
                        </span>
                        {post.category && (
                            <Typography.Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
                                {post.category}
                            </Typography.Text>
                        )}
                    </div>
                ),
            }));
    }, [searchQuery]);

    const handleSearchSelect = (slug: string) => {
        if (!slug) return;
        navigate(`/post/${slug}`);
        setSearchQuery('');
    };

    return (
        <AntLayout style={{ minHeight: '100vh', background: token.colorBgLayout }}>
            <Header
                className="blog-header"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 32px',
                    background: token.colorBgContainer,
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                    height: 56,
                    lineHeight: '56px',
                }}
            >
                <Link to="/" className="blog-logo" aria-label={author.name}>
                    {author.nickname}
                </Link>

                <Menu
                    mode="horizontal"
                    selectedKeys={[selectedKey]}
                    items={NAV_ITEMS.map(item => ({
                        ...item,
                        onClick: () => navigate(item.path),
                    }))}
                    className="blog-nav"
                    style={{ minWidth: 0, fontSize: 14, background: 'transparent', borderBottom: 'none', flex: 1, marginLeft: 32 }}
                />

                <AutoComplete
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onSelect={handleSearchSelect}
                    options={searchOptions}
                    placeholder="搜索文章..."
                    className="blog-search"
                    style={{ width: 200 }}
                    allowClear
                    suffixIcon={<SearchOutlined style={{ color: token.colorTextSecondary }} />}
                    filterOption={false}
                />

                <Button
                    type="text"
                    icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                    onClick={(e) => toggleFromEvent(e)}
                    title={isDark ? '切换到浅色模式' : '切换到深色模式'}
                    className="blog-theme-toggle"
                    aria-label="切换主题"
                />
            </Header>

            <Content
                className="blog-content"
                style={{
                    padding: isHome ? 0 : '32px 24px 64px',
                    width: '100%',
                    boxSizing: 'border-box',
                }}
            >
                <Outlet />
            </Content>

            {!isHome && (
                <Footer className="blog-footer" style={{ background: token.colorBgContainer }}>
                <div className="blog-footer-inner">
                    <div className="blog-footer-col blog-footer-author">
                        <div className="blog-footer-name">
                            <Link to="/about">{author.name}</Link>
                        </div>
                        <div className="blog-footer-bio">{author.bio}</div>
                        <SocialLinks size="small" />
                    </div>

                    <div className="blog-footer-col blog-footer-nav">
                        <div className="blog-footer-heading">站点</div>
                        <nav>
                            {NAV_ITEMS.map(item => (
                                <Link key={item.key} to={item.path} className="blog-footer-link">{item.label}</Link>
                            ))}
                        </nav>
                    </div>

                    <div className="blog-footer-col blog-footer-meta">
                        <div className="blog-footer-copyright">
                            © {new Date().getFullYear()} {author.name}
                        </div>
                        <div className="blog-footer-powered">
                            Built with React · Vite · Ant Design
                        </div>
                    </div>
                </div>
                </Footer>
            )}
        </AntLayout>
    );
}

export default BlogLayout;
