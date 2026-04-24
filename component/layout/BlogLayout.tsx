import React from 'react';
import { Layout as AntLayout, Menu, Typography } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router';

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

    const selectedKey = location.pathname === '/' || location.pathname.startsWith('/post')
        ? 'home'
        : location.pathname.replace('/', '') || 'home';

    return (
        <AntLayout style={{ minHeight: '100vh' }}>
            <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
                <Typography.Title
                    level={4}
                    style={{ color: '#fff', margin: 0, marginRight: 40, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    onClick={() => navigate('/')}
                >
                    ZLC BLOG
                    {/* logo区域 */}
                </Typography.Title>
                <Menu
                    theme="dark"
                    mode="horizontal"
                    selectedKeys={[selectedKey]}
                    items={menuItems.map(item => ({
                        ...item,
                        onClick: () => navigate(item.key === 'home' ? '/' : `/${item.key}`),
                    }))}
                    style={{ flex: 1, minWidth: 0, fontSize: 24 }}
                />
            </Header>
            <Content style={{ padding: '24px 48px', maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
                <Outlet />
            </Content>
            <Footer style={{ textAlign: 'center', color: '#999' }}>
                zenglingchao Blog &copy; {new Date().getFullYear()}
            </Footer>
        </AntLayout>
    );
}

export default BlogLayout;
