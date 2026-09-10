/**
 * 实时金融行情 mock WebSocket server（仅 dev 演示用，生产环境不可达）。
 *
 * 启动：node server/market-3d/mock.js [--port 8787] [--interval 300]
 *
 * 推送两类报文（JSON）：
 *   { type:'tick',  symbol, price, volume, ts }   每个间隔、每个 symbol 一条
 *   { type:'kline', symbol, o,h,l,c,v, ts }        每 KLINE_TICKS 个 tick 聚合一根并推送
 *
 * 价格用随机游走（每 symbol 独立波动率）。前端 market-3d 页面订阅后实时渲染。
 */
import { WebSocketServer, WebSocket } from 'ws';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};

const PORT = getArg('port', 8787);
const INTERVAL = getArg('interval', 120);     // 推送间隔 ms（更密 → 实时感更强）
const KLINE_TICKS = 4;                         // 每 N 个 tick 聚一根 K线（≈480ms 一根，柱阵滚动更勤）
const HISTORY_SIZE = 50;                       // 连接即推送的历史 K线根数，让前端首屏满屏

/** 初始 symbol 与波动率 */
const SYMBOLS = [
    { symbol: 'BTC', price: 64200, vol: 0.0015 },
    { symbol: 'ETH', price: 3150, vol: 0.0020 },
    { symbol: 'SOL', price: 148, vol: 0.0030 },
];

/** 近似高斯噪声（三个 uniform 之和，比单一 random 更平滑） */
const randn = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

const round = (n) => Math.round(n * 100) / 100;

/**
 * 为单个 symbol 向前随机游走生成 HISTORY_SIZE 根历史 K线，
 * 返回 K线数组与游走结束价（供后续 live tick 续接）。
 */
const seedHistory = (s) => {
    const klines = [];
    let price = s.price;
    const baseTs = Date.now() - HISTORY_SIZE * KLINE_TICKS * INTERVAL;
    for (let i = 0; i < HISTORY_SIZE; i += 1) {
        const o = price;
        let h = price;
        let l = price;
        for (let j = 0; j < KLINE_TICKS; j += 1) {
            price = Math.max(0.01, price * (1 + randn() * s.vol));
            h = Math.max(h, price);
            l = Math.min(l, price);
        }
        klines.push({
            o: round(o), h: round(h), l: round(l), c: round(price),
            v: round(Math.random() * KLINE_TICKS * 2),
            ts: baseTs + i * KLINE_TICKS * INTERVAL,
        });
    }
    return { klines, lastPrice: price };
};

/** 每个 symbol 的运行状态：历史 K线 + 当前未关闭桶 + 最新价（续接历史末值） */
const state = SYMBOLS.map((s) => {
    const { klines, lastPrice } = seedHistory(s);
    return {
        ...s,
        price: lastPrice,
        history: klines,
        kline: { o: lastPrice, h: lastPrice, l: lastPrice, c: lastPrice, v: 0, count: 0 },
    };
});

const wss = new WebSocketServer({ port: PORT });
console.log(`[market-ws] listening on ws://localhost:${PORT}  interval=${INTERVAL}ms  klineEvery=${KLINE_TICKS}ticks`);

wss.on('connection', (ws) => {
    console.log('[market-ws] client connected; total', wss.clients.size);
    const now = Date.now();
    for (const s of state) {
        // 先推历史 K线，前端连接即见满屏柱阵（按时间正序到达）
        for (const k of s.history) {
            ws.send(JSON.stringify({ type: 'kline', symbol: s.symbol, ...k }));
        }
        // 再推当前未闭合 K线快照
        ws.send(JSON.stringify({
            type: 'kline', symbol: s.symbol,
            o: round(s.kline.o), h: round(s.kline.h), l: round(s.kline.l),
            c: round(s.kline.c), v: round(s.kline.v), ts: now,
        }));
    }
});

/** 向所有已连接客户端广播 */
const broadcast = (msg) => {
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
    }
};

/** 一次行情推进：每个 symbol 随机游走 + 更新 K线桶 + 广播 tick（桶满时附 kline） */
const tick = () => {
    const now = Date.now();
    for (const s of state) {
        s.price = Math.max(0.01, s.price * (1 + randn() * s.vol));
        const volume = Math.random() * 2;
        const k = s.kline;
        if (k.count === 0) k.o = s.price;
        k.h = Math.max(k.h, s.price);
        k.l = Math.min(k.l, s.price);
        k.c = s.price;
        k.v += volume;
        k.count += 1;

        broadcast(JSON.stringify({
            type: 'tick', symbol: s.symbol,
            price: round(s.price), volume: round(volume), ts: now,
        }));

        if (k.count >= KLINE_TICKS) {
            broadcast(JSON.stringify({
                type: 'kline', symbol: s.symbol,
                o: round(k.o), h: round(k.h), l: round(k.l),
                c: round(k.c), v: round(k.v), ts: now,
            }));
            // 开新桶，开盘价 = 当前价
            s.kline = { o: s.price, h: s.price, l: s.price, c: s.price, v: 0, count: 0 };
        }
    }
};

setInterval(tick, INTERVAL);

process.on('SIGINT', () => {
    console.log('\n[market-ws] shutting down');
    wss.close();
    process.exit(0);
});
