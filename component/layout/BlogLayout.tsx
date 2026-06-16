import React from 'react';
import { Layout as AntLayout, Menu, Typography, Button, theme } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { useThemeMode } from '../../app/theme/ThemeProvider';

const { Header, Content, Footer } = AntLayout;

const menuItems = [
    { key: 'home', label: '首页' },
    { key: 'categories', label: '分类' },
    { key: 'projects', label: '项目' },
    { key: 'about', label: '关于' },
];

function BlogLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { mode, toggleFromEvent } = useThemeMode();
    const { token } = theme.useToken();
    const isDark = mode === 'dark';

    const selectedKey = location.pathname === '/' || location.pathname.startsWith('/post')
        ? 'home'
        : location.pathname.replace('/', '') || 'home';

    return (
        <AntLayout style={{ minHeight: '100vh', background: token.colorBgLayout }}>
            <Header
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 24px',
                    background: token.colorBgContainer,
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                }}
            >
                <Typography.Title
                    level={4}
                    style={{
                        margin: 0,
                        marginRight: 40,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        background: 'linear-gradient(90deg, #ff7e5f, #feb47b)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}
                    onClick={() => navigate('/')}
                >
                    ZLC BLOG
                </Typography.Title>
                <Menu
                    mode="horizontal"
                    selectedKeys={[selectedKey]}
                    items={menuItems.map(item => ({
                        ...item,
                        onClick: () => navigate(item.key === 'home' ? '/' : `/${item.key}`),
                    }))}
                    style={{ flex: 1, minWidth: 0, fontSize: 16, background: 'transparent', borderBottom: 'none' }}
                />
                <Button
                    type="text"
                    icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                    onClick={(e) => toggleFromEvent(e)}
                    title={isDark ? '切换到浅色模式' : '切换到暗色模式'}
                    style={{ fontSize: 18 }}
                />
            </Header>
            <Content style={{ padding: '24px 48px', maxWidth: 1400, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
                <Outlet />
            </Content>
            <Footer style={{ textAlign: 'center', color: token.colorTextSecondary, background: 'transparent' }}>
                zenglingchao Blog &copy; {new Date().getFullYear()}
            </Footer>
        </AntLayout>
    );
}

export default BlogLayout;
