import { Typography } from 'antd';
import { CustomerServiceOutlined } from '@ant-design/icons';

export interface AudioPlaceholderProps {
    isPlaying: boolean;
    fileName: string;
}

/** 音频模式占位：旋转图标 + 文件名 + 音波动画条 */
export function AudioPlaceholder({ isPlaying, fileName }: AudioPlaceholderProps) {
    return (
        <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: '#fff', gap: 16, pointerEvents: 'none',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        }}>
            <CustomerServiceOutlined
                style={{ fontSize: 72, filter: 'drop-shadow(0 0 12px rgba(22,119,255,0.6))' }}
                spin={isPlaying}
            />
            <Typography.Text style={{ color: 'rgba(255,255,255,0.85)', maxWidth: '70%', textAlign: 'center' }} ellipsis>
                {fileName || '音频播放中'}
            </Typography.Text>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 28 }}>
                {Array.from({ length: 16 }).map((_, i) => (
                    <span
                        key={i}
                        style={{
                            width: 3,
                            height: isPlaying ? `${20 + ((i * 37) % 80)}%` : '20%',
                            background: '#1677ff',
                            borderRadius: 2,
                            transformOrigin: 'bottom',
                            animation: isPlaying ? `eq 0.9s ${i * 0.06}s ease-in-out infinite alternate` : 'none',
                        }}
                    />
                ))}
            </div>
            <style>{`@keyframes eq { from { transform: scaleY(0.4) } to { transform: scaleY(1) } }`}</style>
        </div>
    );
}
