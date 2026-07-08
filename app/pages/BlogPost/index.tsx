import { Navigate } from 'react-router';
import { Spin } from 'antd';
import TopButton from '@components/TopButton';
import GobackButton from '@components/GobackButton';
import ReadingProgress from '../../../component/blog/ReadingProgress';
import PageContainer from '../../../component/blog/PageContainer';
import { useBlogPost } from './hooks/useBlogPost';
import { PostHeader } from './components/PostHeader';
import { PostBody } from './components/PostBody';
import { PostFooter } from './components/PostFooter';
import './blog-post.css';

export default function BlogPost() {
    const controller = useBlogPost();

    if (controller.state.status === 'notfound') return <Navigate to="/" replace />;
    if (controller.state.status === 'loading') {
        return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
    }

    return (
        <>
            <ReadingProgress />
            <PageContainer variant="wide">
                <article className="post-article">
                    <PostHeader controller={controller} />
                    <PostBody controller={controller} />
                    <PostFooter controller={controller} />
                </article>
            </PageContainer>
            <GobackButton />
            {controller.showBackTop && <TopButton />}
        </>
    );
}
