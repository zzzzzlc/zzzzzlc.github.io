import { Card, Divider, Statistic, Typography } from 'antd';
import type { MarketController } from '../types';
import { formatPrice } from '../../../market/kline';

const { Text, Paragraph } = Typography;

export interface MarketLegendProps {
    controller: MarketController;
}

/** 图例 / 实时数值面板：最新价 + 涨跌 + 交互提示 */
export function MarketLegend({ controller }: MarketLegendProps) {
    const { activeSymbol, lastPrice, change, changePct } = controller;
    const up = change >= 0;
    const color = up ? '#2ecc71' : '#e74c3c';

    return (
        <Card>
            <Statistic
                title={`${activeSymbol} / USDT`}
                value={lastPrice}
                precision={2}
                prefix="$"
                valueStyle={{ color: lastPrice === 0 ? undefined : color }}
            />
            <Text style={{ color }}>
                {up ? '+' : ''}{formatPrice(change)} ({up ? '+' : ''}{changePct.toFixed(2)}%)
            </Text>
            <Divider style={{ margin: '12px 0' }} />
            <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
                拖拽旋转 · 滚轮缩放 · 悬停 K线 查看 OHLC
            </Paragraph>
        </Card>
    );
}
