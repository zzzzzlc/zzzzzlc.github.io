import { VerticalAlignTopOutlined } from '@ant-design/icons';

export default function TopButton() {
    return (
        <button
            className="blog-float-btn blog-float-btn--top"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="回到顶部"
        >
            <VerticalAlignTopOutlined />
        </button>
    );
}
