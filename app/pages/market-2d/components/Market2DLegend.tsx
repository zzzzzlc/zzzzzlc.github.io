import { Card, Divider, Statistic, Typography } from 'antd';
import { formatPrice } from '../../../market/kline';
import { MARKET_COLORS } from '../../../market/constants';
import type { Market2DController } from '../types';

const { Text, Paragraph } = Typography;

export interface Market2DLegendProps {
    controller: Market2DController;
}

/** 图例 / 实时数值面板：最新价 + 涨跌 + 交互提示 */
export function Market2DLegend({ controller }: Market2DLegendProps) {
    const { activeSymbol, lastPrice, change, changePct } = controller;
    const up = change >= 0;
    const color = up ? MARKET_COLORS.up : MARKET_COLORS.down;

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
                悬停 K线 查看 OHLC · 十字光标 · 暂停冻结画面
            </Paragraph>
        </Card>
    );
}
