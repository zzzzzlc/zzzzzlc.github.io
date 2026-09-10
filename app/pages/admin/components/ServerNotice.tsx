import { Alert, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

interface ServerNoticeProps {
    message: string;
    onRetry: () => void;
}

/** 服务不可用提示（如未启动 pnpm admin:server） */
export const ServerNotice = ({ message, onRetry }: ServerNoticeProps) => (
    <Alert
        type="warning"
        showIcon
        title="文章服务不可用"
        description={
            <>
                <div>{message}</div>
                <Button size="small" icon={<ReloadOutlined />} onClick={onRetry} style={{ marginTop: 8 }}>
                    重试
                </Button>
            </>
        }
    />
);
