import { Typography } from 'antd';
import { useMarket2d } from './hooks/useMarket2d';
import { Market2DToolbar } from './components/Market2DToolbar';
import { Market2DStage } from './components/Market2DStage';
import { Market2DLegend } from './components/Market2DLegend';
import './market-2d.css';

/** 实时金融 2D 行情：RxJS 处理 WS 流 + Canvas 2D 手写引擎渲染 K线 + 成交量 */
export default function Market2D() {
    const controller = useMarket2d();

    return (
        <div className="market-2d">
            <Typography.Title level={3} style={{ marginBottom: 16 }}>
                实时金融 2D 行情
            </Typography.Title>
            <Market2DToolbar controller={controller} />
            <div className="market-2d__body">
                <div className="market-2d__legend">
                    <Market2DLegend controller={controller} />
                </div>
                <div className="market-2d__stage">
                    <Market2DStage controller={controller} />
                </div>
            </div>
        </div>
    );
}
