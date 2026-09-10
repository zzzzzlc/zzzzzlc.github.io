# market-3d mock WebSocket server

仅 **dev 演示**用 —— 本地 node 进程推送实时金融行情，供 `app/pages/market-3d` 订阅。生产环境（GitHub Pages 等）浏览器无法访问 `localhost`，故不可用。

## 启动

```bash
node server/market-3d/mock.js                 # 默认 port=8787 interval=300
node server/market-3d/mock.js --port 8787 --interval 300
```

或用 package.json 脚本：`pnpm mock:market`。

## 协议

连接 `ws://localhost:8787` 后周期推送 JSON：

```jsonc
{ "type": "tick",  "symbol": "BTC", "price": 64213.5, "volume": 1.2, "ts": 1700000000000 }
{ "type": "kline", "symbol": "BTC", "o": 64100, "h": 64300, "l": 64050, "c": 64213.5, "v": 8.4, "ts": 1700000000000 }
```

- `tick`：每个 interval、每个 symbol 一条（最新价 + 成交量）。
- `kline`：每 8 个 tick 聚合一根（OHLCV）。
- 新连接即收到每个 symbol 当前 K线快照，便于前端立即渲染。

symbols：BTC / ETH / SOL，各自独立随机游走波动率。Ctrl+C 优雅关闭。
