import { Typography } from 'antd';
import { useMarket3D } from './hooks/useMarket3D';
import { MarketToolbar } from './components/MarketToolbar';
import { Market3DStage } from './components/Market3DStage';
import { MarketLegend } from './components/MarketLegend';
import './market-3d.css';

/** 实时金融 3D 行情：RxJS 处理 WS 流 + three.js 渲染 K线柱阵 + 价格曲面 */
export default function Market3D() {
    const controller = useMarket3D();

    return (
        <div className="market-3d">
            <Typography.Title level={3} style={{ marginBottom: 16 }}>
                实时金融 3D 行情
            </Typography.Title>
            <MarketToolbar controller={controller} />
            <div className="market-3d__body">
                <div className="market-3d__legend">
                    <MarketLegend controller={controller} />
                </div>
                <div className="market-3d__stage">
                    <Market3DStage controller={controller} />
                </div>
            </div>
        </div>
    );
}
