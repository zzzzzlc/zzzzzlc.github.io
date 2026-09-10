import { useNavigate } from 'react-router';
import { ArrowLeftOutlined } from '@ant-design/icons';

export default function GobackButton() {
    const navigate = useNavigate();
    return (
        <button
            className="blog-float-btn blog-float-btn--goback"
            onClick={() => navigate('/')}
            title="返回"
        >
            <ArrowLeftOutlined />
        </button>
    );
}
