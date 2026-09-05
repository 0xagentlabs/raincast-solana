# RainCast

Solana Devnet 天气预测市场 Demo。用户可选择上海、北京、广州、深圳、成都、杭州、武汉或西安，预测未来 30 分钟内是否达到 0.1 mm 降水；Open‑Meteo 数据由受控预言机签名并用于链上结算。每个市场开放预测 25 分钟、在第 30 分钟结算；页面和链上按城市派生的 schedule PDA 会阻止同一城市创建时间重叠的市场，不同城市可同时开市。

结算时平台收取奖池的 1%，其余资金全部按份额分配给获胜方；连接链上 Config authority 钱包时会自动进入独立管理面板，可一次领取累计平台收益，普通用户则在市场中查看自己的 YES/NO 份额与领取状态。

Admin（Config authority）与 Oracle 当前均为：`Dy6mBH4YeqJCRZohd39iSFaf4jyLaxPeBakbZwt1jToL`。连接该钱包后页面进入平台管理面板；该地址也拥有到期市场的天气结算权限。

> 仅供技术演示。使用 Devnet 测试 SOL，不构成博彩或投资服务。

## 快速开始

```bash
pnpm install --ignore-scripts
pnpm --dir app dev
```

Program ID: `BbkDnkPC7HD8TeNHp3iCDwjLxF3WDmg2Yrh9gVZrwohH`。完整 ABI 见 `ABI.md`，操作和安全说明见 `docs/项目使用说明书.md`。

- App: https://raincast-solana-0xcevin-5020s-projects.vercel.app
- Explorer: https://explorer.solana.com/address/BbkDnkPC7HD8TeNHp3iCDwjLxF3WDmg2Yrh9gVZrwohH?cluster=devnet
